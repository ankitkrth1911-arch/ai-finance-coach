from typing import List, Annotated, Optional
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, and_, desc
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User, Transaction, PlaidAccount
from ..schemas import TransactionResponse
from .auth import get_current_user

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=List[TransactionResponse])
def get_transactions(
    current_user: Annotated[User, Depends(get_current_user)],
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    Get user transactions with optional filters.
    """
    query = db.query(
        Transaction.id,
        Transaction.transaction_id,
        Transaction.category,
        Transaction.ai_category,
        Transaction.ai_justification,
        Transaction.amount,
        Transaction.date,
        Transaction.name,
        Transaction.merchant_name,
        Transaction.pending,
        Transaction.plaid_account_id,
        PlaidAccount.name.label("account_name")
    ).join(
        PlaidAccount, Transaction.plaid_account_id == PlaidAccount.id
    ).filter(
        Transaction.user_id == current_user.id
    )

    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if category:
        query = query.filter(Transaction.ai_category == category)
    if search:
        query = query.filter(
            and_(
                Transaction.name.ilike(f"%{search}%") | 
                Transaction.merchant_name.ilike(f"%{search}%")
            )
        )

    results = query.order_by(desc(Transaction.date), desc(Transaction.id)).offset(offset).limit(limit).all()

    # Convert results into Pydantic models
    return [
        TransactionResponse(
            id=row.id,
            transaction_id=row.transaction_id,
            category=row.category,
            ai_category=row.ai_category,
            ai_justification=row.ai_justification,
            amount=row.amount,
            date=row.date,
            name=row.name,
            merchant_name=row.merchant_name,
            pending=row.pending,
            plaid_account_id=row.plaid_account_id,
            account_name=row.account_name
        ) for row in results
    ]


@router.get("/summary")
def get_spending_summary(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    """
    Returns spending broken down by category and monthly trends.
    """
    # 1. Total spending by AI category (excluding Income and Transfers)
    category_spending = db.query(
        Transaction.ai_category,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.ai_category != "Income",
        Transaction.ai_category != "Transfer"
    ).group_by(
        Transaction.ai_category
    ).all()

    breakdown = [{"category": row[0], "value": float(row[1])} for row in category_spending]

    # 2. Monthly Trend (Total Spent vs Income over the last 6 months)
    # Format month as YYYY-MM
    monthly_data = db.query(
        func.to_char(Transaction.date, 'YYYY-MM').label("month"),
        func.sum(
            func.coalesce(Transaction.amount, 0)
        ).filter(Transaction.ai_category != "Income").label("spending"),
        func.sum(
            func.coalesce(Transaction.amount, 0)
        ).filter(Transaction.ai_category == "Income").label("income")
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.ai_category != "Transfer"
    ).group_by(
        "month"
    ).order_by(
        "month"
    ).limit(6).all()

    trends = []
    for row in monthly_data:
        # Avoid null values
        spending_val = float(row[1]) if row[1] is not None else 0.0
        income_val = float(row[2]) if row[2] is not None else 0.0
        trends.append({
            "month": row[0],
            "spending": spending_val,
            "income": income_val,
            "savings": max(0.0, income_val - spending_val)
        })

    return {
        "breakdown": breakdown,
        "trends": trends
    }


@router.put("/{transaction_id}/category")
def update_transaction_category(
    transaction_id: int,
    category: str,
    justification: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    """
    Allows the user to manually correct a transaction's category.
    """
    tx = db.query(Transaction).filter(
        Transaction.id == transaction_id, 
        Transaction.user_id == current_user.id
    ).first()
    
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    # Allowed categories validation
    from ..services.openai_service import ALLOWED_CATEGORIES
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category must be one of: {', '.join(ALLOWED_CATEGORIES)}"
        )

    tx.ai_category = category
    tx.ai_justification = justification or f"Manually adjusted by user to {category}."
    db.commit()
    db.refresh(tx)

    return {"status": "success", "transaction_id": tx.id, "ai_category": tx.ai_category}
