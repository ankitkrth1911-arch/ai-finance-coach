from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db import get_db
from ..models import User, Budget, Transaction
from ..schemas import BudgetCreate, BudgetResponse
from .auth import get_current_user

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("", response_model=List[BudgetResponse])
def get_budgets(
    month: str, # Format: YYYY-MM
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    """
    Get all budgets for a given month, with current spending in that category.
    """
    budgets = db.query(Budget).filter(
        Budget.user_id == current_user.id,
        Budget.month == month
    ).all()

    # Calculate actual spending for each category in this month
    # Parse start and end date of the month
    try:
        year_str, month_str = month.split("-")
        year = int(year_str)
        mon = int(month_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM.")

    # Get start date and end date of the month
    import calendar
    _, last_day = calendar.monthrange(year, mon)
    start_dt = f"{month}-01"
    end_dt = f"{month}-{last_day}"

    # Group spending by category
    spending_query = db.query(
        Transaction.ai_category,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_dt,
        Transaction.date <= end_dt,
        Transaction.ai_category != "Income",
        Transaction.ai_category != "Transfer"
    ).group_by(Transaction.ai_category).all()

    spending_map = {row[0]: row[1] for row in spending_query}

    response = []
    for budget in budgets:
        spent = spending_map.get(budget.category, 0)
        response.append(
            BudgetResponse(
                id=budget.id,
                category=budget.category,
                amount=budget.amount,
                month=budget.month,
                current_spending=spent
            )
        )
    return response


@router.post("", response_model=BudgetResponse)
def create_or_update_budget(
    budget_in: BudgetCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    """
    Create a new budget goal or update an existing one.
    """
    # Validate category choice
    from ..services.openai_service import ALLOWED_CATEGORIES
    if budget_in.category not in ALLOWED_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category must be one of: {', '.join(ALLOWED_CATEGORIES)}"
        )
    if budget_in.category in ["Income", "Transfer"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot set spending budget on Income or Transfer categories."
        )

    # Check if a budget already exists for this category/month
    budget = db.query(Budget).filter(
        Budget.user_id == current_user.id,
        Budget.category == budget_in.category,
        Budget.month == budget_in.month
    ).first()

    if budget:
        budget.amount = budget_in.amount
    else:
        budget = Budget(
            user_id=current_user.id,
            category=budget_in.category,
            amount=budget_in.amount,
            month=budget_in.month
        )
        db.add(budget)

    db.commit()
    db.refresh(budget)

    # Fetch current spending for response
    import calendar
    year_str, month_str = budget.month.split("-")
    _, last_day = calendar.monthrange(int(year_str), int(month_str))
    start_dt = f"{budget.month}-01"
    end_dt = f"{budget.month}-{last_day}"

    spent_sum = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.ai_category == budget.category,
        Transaction.date >= start_dt,
        Transaction.date <= end_dt
    ).scalar() or 0

    return BudgetResponse(
        id=budget.id,
        category=budget.category,
        amount=budget.amount,
        month=budget.month,
        current_spending=spent_sum
    )


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(
    budget_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    budget = db.query(Budget).filter(
        Budget.id == budget_id,
        Budget.user_id == current_user.id
    ).first()

    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    db.delete(budget)
    db.commit()
    return None
