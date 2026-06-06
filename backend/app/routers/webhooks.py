import logging
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status, Request
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import PlaidItem, PlaidAccount, Transaction
from ..services import plaid_service
from ..services import openai_service

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger("finance_coach.webhooks")


def sync_item_transactions_background(plaid_item_id: int, db_session_factory):
    """
    Background worker that runs transaction synchronization for a specific PlaidItem.
    """
    db = db_session_factory()
    try:
        item = db.query(PlaidItem).filter(PlaidItem.id == plaid_item_id).first()
        if not item:
            logger.error(f"Plaid Item {plaid_item_id} not found in DB during background webhook sync.")
            return

        logger.info(f"Webhook triggered sync for Plaid Item ID {item.id} (Plaid Item ID: {item.item_id})")
        
        # Sync account balances
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
        
        # Handle removals
        for tx in removed:
            db.query(Transaction).filter(Transaction.transaction_id == tx.transaction_id).delete()
            
        # Handle modifications
        for tx in modified:
            db_tx = db.query(Transaction).filter(Transaction.transaction_id == tx.transaction_id).first()
            if db_tx:
                db_tx.amount = tx.amount
                db_tx.pending = tx.pending
                db_tx.date = tx.date
                db_tx.name = tx.name
                
        # Handle additions
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
                    user_id=item.user_id,
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
                
        # Update Plaid Item sync details
        item.cursor = next_cursor
        item.status = "active"
        db.commit()
        logger.info(f"Webhook sync completed for Plaid Item ID {item.id}. Added {len(added)} transactions.")
        
    except Exception as e:
        logger.error(f"Error during webhook background sync for Plaid Item {plaid_item_id}: {e}", exc_info=True)
        db.rollback()
        # Mark status as error
        item = db.query(PlaidItem).filter(PlaidItem.id == plaid_item_id).first()
        if item:
            item.status = "error"
            db.commit()
    finally:
        db.close()


@router.post("/plaid")
async def plaid_webhook_receiver(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Main webhook listener endpoint for Plaid notifications.
    """
    try:
        payload = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse webhook JSON payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    webhook_type = payload.get("webhook_type")
    webhook_code = payload.get("webhook_code")
    item_id = payload.get("item_id")

    logger.info(f"Received Plaid webhook. Type: {webhook_type}, Code: {webhook_code}, Item ID: {item_id}")

    if not item_id:
        return {"status": "ignored", "reason": "No item_id provided"}

    # Find the matching Plaid Item in our database
    plaid_item = db.query(PlaidItem).filter(PlaidItem.item_id == item_id).first()
    if not plaid_item:
        logger.warning(f"Plaid Item {item_id} not found in database. Ignoring webhook.")
        return {"status": "ignored", "reason": "Item not found"}

    # Handle transaction updates
    if webhook_type == "TRANSACTIONS":
        if webhook_code in ["SYNC_UPDATES_AVAILABLE", "INITIAL_UPDATE", "HISTORICAL_UPDATE", "DEFAULT_UPDATE"]:
            # Queue sync task
            from ..db import SessionLocal
            background_tasks.add_task(
                sync_item_transactions_background,
                plaid_item.id,
                SessionLocal
            )
            return {"status": "sync_queued", "item_id": item_id}
            
    # Handle item errors (e.g. credentials revoked)
    elif webhook_type == "ITEM":
        if webhook_code == "ERROR":
            plaid_item.status = "error"
            db.commit()
            logger.warning(f"Plaid Item {item_id} entered error state via Webhook ITEM ERROR")
            return {"status": "item_error_updated", "item_id": item_id}

    return {"status": "received", "message": f"Webhook type '{webhook_type}' and code '{webhook_code}' acknowledged"}
