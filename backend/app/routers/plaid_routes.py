import logging
from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User, PlaidItem, PlaidAccount, Transaction
from ..schemas import LinkTokenResponse, PublicTokenExchange, PlaidItemResponse
from .auth import get_current_user
from ..services import plaid_service
from ..services import openai_service

router = APIRouter(prefix="/plaid", tags=["plaid"])
logger = logging.getLogger("finance_coach.plaid_routes")


def run_initial_sync(item_id: int, user_id: str, access_token: str, db: Session):
    """
    Background worker to fetch, AI categorize, and store transactions on new connection.
    """
    try:
        logger.info(f"Starting initial sync for Plaid Item {item_id}")
        
        # 1. Sync transactions from Plaid
        sync_result = plaid_service.sync_transactions(access_token, cursor=None)
        added = sync_result.get("added", [])
        next_cursor = sync_result.get("next_cursor", "")
        
        if not added:
            logger.info(f"No transactions found for Plaid Item {item_id}")
            # Update cursor anyway
            item = db.query(PlaidItem).filter(PlaidItem.id == item_id).first()
            if item:
                item.cursor = next_cursor
                db.commit()
            return
            
        # 2. Get accounts mappings
        accounts = db.query(PlaidAccount).filter(PlaidAccount.plaid_item_id == item_id).all()
        account_map = {acc.account_id: acc.id for acc in accounts}
        
        # 3. Batch categorize using AI Personal Finance rules or GPT-4o
        txs_to_categorize = []
        for tx in added:
            txs_to_categorize.append({
                "transaction_id": tx.transaction_id,
                "name": tx.name,
                "amount": tx.amount,
                "category": tx.category or []
            })
            
        ai_categories = openai_service.categorize_transactions(txs_to_categorize)
        ai_cat_map = {c["transaction_id"]: c for c in ai_categories}
        
        # 4. Save to Database
        for tx in added:
            # Skip if transaction already exists
            existing = db.query(Transaction).filter(Transaction.transaction_id == tx.transaction_id).first()
            if existing:
                continue
                
            db_account_id = account_map.get(tx.account_id)
            if not db_account_id:
                # If account is missing for some reason, log and skip
                logger.warning(f"Skipping transaction {tx.transaction_id}: account {tx.account_id} not found in DB")
                continue
                
            ai_data = ai_cat_map.get(tx.transaction_id, {})
            ai_cat = ai_data.get("ai_category", "Other")
            ai_just = ai_data.get("ai_justification", "Default assignment.")
            
            db_tx = Transaction(
                user_id=user_id,
                plaid_account_id=db_account_id,
                transaction_id=tx.transaction_id,
                category=", ".join(tx.category) if tx.category else "Uncategorized",
                ai_category=ai_cat,
                ai_justification=ai_just,
                amount=tx.amount,
                date=tx.date,
                name=tx.name,
                merchant_name=tx.merchant_name or tx.name,
                pending=tx.pending
            )
            db.add(db_tx)
            
        # Update Plaid Item status and cursor
        item = db.query(PlaidItem).filter(PlaidItem.id == item_id).first()
        if item:
            item.cursor = next_cursor
            item.status = "active"
            
        db.commit()
        logger.info(f"Completed initial sync for Plaid Item {item_id}. Processed {len(added)} transactions.")
        
    except Exception as e:
        logger.error(f"Error during initial sync for Plaid Item {item_id}: {e}", exc_info=True)
        # Mark item as failed
        db.rollback()
        item = db.query(PlaidItem).filter(PlaidItem.id == item_id).first()
        if item:
            item.status = "error"
            db.commit()


@router.post("/link-token", response_model=LinkTokenResponse)
def create_link_token(
    current_user: Annotated[User, Depends(get_current_user)]
):
    try:
        # Generate link token
        # In a real environment, you'd specify a webhook URL here
        link_token = plaid_service.create_link_token(user_id=str(current_user.id))
        return {"link_token": link_token}
    except Exception as e:
        logger.error(f"Error generating link token: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Plaid API Error: {str(e)}"
        )


@router.post("/exchange", response_model=PlaidItemResponse)
def exchange_public_token(
    payload: PublicTokenExchange,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    try:
        # 1. Exchange token
        exchange_data = plaid_service.exchange_public_token(payload.public_token)
        access_token = exchange_data["access_token"]
        item_id = exchange_data["item_id"]
        
        # 2. Check if item exists, or create new
        plaid_item = db.query(PlaidItem).filter(PlaidItem.item_id == item_id).first()
        if plaid_item:
            plaid_item.access_token = access_token
            plaid_item.status = "syncing"
            plaid_item.institution_name = payload.institution_name or plaid_item.institution_name
            plaid_item.institution_id = payload.institution_id or plaid_item.institution_id
        else:
            plaid_item = PlaidItem(
                user_id=current_user.id,
                item_id=item_id,
                access_token=access_token,
                institution_id=payload.institution_id,
                institution_name=payload.institution_name,
                status="syncing"
            )
            db.add(plaid_item)
            
        db.commit()
        db.refresh(plaid_item)
        
        # 3. Retrieve and cache bank accounts
        accounts = plaid_service.get_accounts(access_token)
        db_accounts = []
        for acc in accounts:
            # Check if account already exists
            db_acc = db.query(PlaidAccount).filter(PlaidAccount.account_id == acc.account_id).first()
            
            # Extract balances
            available = acc.balances.available
            current = acc.balances.current
            limit = acc.balances.limit
            
            if db_acc:
                db_acc.balance_available = available
                db_acc.balance_current = current
                db_acc.balance_limit = limit
                db_acc.name = acc.name
                db_acc.mask = acc.mask
            else:
                db_acc = PlaidAccount(
                    plaid_item_id=plaid_item.id,
                    account_id=acc.account_id,
                    name=acc.name,
                    mask=acc.mask,
                    type=str(acc.type),
                    subtype=str(acc.subtype) if acc.subtype else None,
                    balance_available=available,
                    balance_current=current,
                    balance_limit=limit,
                    currency=acc.balances.iso_currency_code or "USD"
                )
                db.add(db_acc)
            db_accounts.append(db_acc)
            
        db.commit()
        
        # 4. Trigger initial transaction sync in the background
        background_tasks.add_task(
            run_initial_sync,
            plaid_item.id,
            current_user.id,
            access_token,
            db
        )
        
        # Reload plaid item with accounts populated
        db.refresh(plaid_item)
        return plaid_item
        
    except Exception as e:
        logger.error(f"Error exchanging public token: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Plaid Exchange Error: {str(e)}"
        )


@router.post("/sync")
def sync_user_transactions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    """
    Triggers manual synchronization of all user accounts.
    """
    items = db.query(PlaidItem).filter(PlaidItem.user_id == current_user.id).all()
    if not items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No connected bank accounts found."
        )
        
    synced_items_count = 0
    total_added = 0
    
    for item in items:
        try:
            # Sync balances first
            accounts = plaid_service.get_accounts(item.access_token)
            account_map = {}
            for acc in accounts:
                db_acc = db.query(PlaidAccount).filter(PlaidAccount.account_id == acc.account_id).first()
                if db_acc:
                    db_acc.balance_available = acc.balances.available
                    db_acc.balance_current = acc.balances.current
                    db_acc.balance_limit = acc.balances.limit
                    account_map[acc.account_id] = db_acc.id
                    
            db.commit()
            
            # Sync transactions
            sync_result = plaid_service.sync_transactions(item.access_token, cursor=item.cursor)
            added = sync_result.get("added", [])
            modified = sync_result.get("modified", [])
            removed = sync_result.get("removed", [])
            next_cursor = sync_result.get("next_cursor", "")
            
            # Process removals
            for tx in removed:
                db.query(Transaction).filter(Transaction.transaction_id == tx.transaction_id).delete()
                
            # Process modifications
            for tx in modified:
                db_tx = db.query(Transaction).filter(Transaction.transaction_id == tx.transaction_id).first()
                if db_tx:
                    db_tx.amount = tx.amount
                    db_tx.pending = tx.pending
                    db_tx.date = tx.date
                    db_tx.name = tx.name
                    
            # Process additions
            if added:
                txs_to_categorize = []
                for tx in added:
                    txs_to_categorize.append({
                        "transaction_id": tx.transaction_id,
                        "name": tx.name,
                        "amount": tx.amount,
                        "category": tx.category or []
                    })
                
                ai_categories = openai_service.categorize_transactions(txs_to_categorize)
                ai_cat_map = {c["transaction_id"]: c for c in ai_categories}
                
                for tx in added:
                    existing = db.query(Transaction).filter(Transaction.transaction_id == tx.transaction_id).first()
                    if existing:
                        continue
                        
                    db_acc_id = account_map.get(tx.account_id)
                    if not db_acc_id:
                        db_acc = db.query(PlaidAccount).filter(PlaidAccount.account_id == tx.account_id).first()
                        if db_acc:
                            db_acc_id = db_acc.id
                            
                    if not db_acc_id:
                        continue
                        
                    ai_data = ai_cat_map.get(tx.transaction_id, {})
                    ai_cat = ai_data.get("ai_category", "Other")
                    ai_just = ai_data.get("ai_justification", "Default assignment.")
                    
                    db_tx = Transaction(
                        user_id=current_user.id,
                        plaid_account_id=db_acc_id,
                        transaction_id=tx.transaction_id,
                        category=", ".join(tx.category) if tx.category else "Uncategorized",
                        ai_category=ai_cat,
                        ai_justification=ai_just,
                        amount=tx.amount,
                        date=tx.date,
                        name=tx.name,
                        merchant_name=tx.merchant_name or tx.name,
                        pending=tx.pending
                    )
                    db.add(db_tx)
                    total_added += 1
            
            # Save progress cursor
            item.cursor = next_cursor
            item.status = "active"
            db.commit()
            synced_items_count += 1
            
        except Exception as e:
            logger.error(f"Error syncing Plaid Item {item.id}: {e}", exc_info=True)
            item.status = "error"
            db.commit()
            
    return {
        "status": "success",
        "synced_items": synced_items_count,
        "new_transactions_added": total_added
    }


@router.get("/items", response_model=List[PlaidItemResponse])
def get_plaid_items(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    items = db.query(PlaidItem).filter(PlaidItem.user_id == current_user.id).all()
    return items


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_plaid_item(
    item_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    item = db.query(PlaidItem).filter(PlaidItem.id == item_id, PlaidItem.user_id == current_user.id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plaid connection not found."
        )
    db.delete(item)
    db.commit()
    return None
