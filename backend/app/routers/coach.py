import logging
from typing import List, Annotated, Dict, Any
from datetime import date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from ..db import get_db
from ..models import User, ChatMessage, Transaction, PlaidAccount, FinancialReport, Budget
from ..schemas import ChatQuery, ChatResponse, ChatMessageResponse, BadHabitResponse, SavingsProjectionQuery, SavingsProjectionResponse, ProjectionYear, WeeklySummaryResponse
from .auth import get_current_user
from ..services import openai_service

router = APIRouter(prefix="/coach", tags=["coach"])
logger = logging.getLogger("finance_coach.coach")


@router.post("/chat", response_model=ChatResponse)
def chat_with_coach(
    query: ChatQuery,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    """
    Send a message to the AI Personal Finance Coach and retrieve the reply.
    """
    # 1. Save user's message
    user_msg = ChatMessage(
        user_id=current_user.id,
        role="user",
        content=query.message
    )
    db.add(user_msg)
    db.commit()
    
    # 2. Retrieve last 10 messages for context
    history_records = db.query(ChatMessage).filter(
        ChatMessage.user_id == current_user.id
    ).order_by(ChatMessage.created_at).all()
    
    chat_history = [{"role": msg.role, "content": msg.content} for msg in history_records]
    
    # 3. Retrieve user financial details for context
    accounts_records = db.query(PlaidAccount).join(
        PlaidAccount.plaid_item
    ).filter(
        PlaidItem.user_id == current_user.id
    ).all()
    
    accounts = [
        {
            "name": acc.name,
            "subtype": acc.subtype or acc.type,
            "balance_current": float(acc.balance_current)
        } for acc in accounts_records
    ]
    
    transactions_records = db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    ).order_by(desc(Transaction.date)).limit(30).all()
    
    transactions = [
        {
            "date": str(tx.date),
            "name": tx.name,
            "ai_category": tx.ai_category,
            "amount": float(tx.amount)
        } for tx in transactions_records
    ]
    
    # 4. Invoke LLM Coach
    reply = openai_service.chat_coach(query.message, chat_history, accounts, transactions)
    
    # 5. Save assistant reply
    assistant_msg = ChatMessage(
        user_id=current_user.id,
        role="assistant",
        content=reply
    )
    db.add(assistant_msg)
    db.commit()
    
    # Reload all messages for full response history
    updated_history = db.query(ChatMessage).filter(
        ChatMessage.user_id == current_user.id
    ).order_by(ChatMessage.created_at).all()
    
    return ChatResponse(
        reply=reply,
        history=[
            ChatMessageResponse(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                created_at=msg.created_at
            ) for msg in updated_history
        ]
    )


@router.get("/chat/history", response_model=List[ChatMessageResponse])
def get_chat_history(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    """
    Get entire conversation logs with the Coach.
    """
    history = db.query(ChatMessage).filter(
        ChatMessage.user_id == current_user.id
    ).order_by(ChatMessage.created_at).all()
    return history


@router.get("/habits", response_model=BadHabitResponse)
def scan_bad_habits(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    """
    Run transaction auditing to list user spending flags.
    """
    transactions_records = db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    ).order_by(desc(Transaction.date)).limit(100).all()
    
    transactions = [
        {
            "name": tx.name,
            "ai_category": tx.ai_category,
            "amount": float(tx.amount),
            "date": tx.date
        } for tx in transactions_records
    ]
    
    habits = openai_service.detect_bad_habits(transactions)
    return {"habits": habits}


@router.post("/projections", response_model=SavingsProjectionResponse)
def calculate_projections(
    query: SavingsProjectionQuery,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    """
    Calculates current user savings rates and projects wealth compounding over years.
    """
    # 1. Fetch historical income and expenses to evaluate current savings rate
    # Let's check last 60 days
    sixty_days_ago = date.today() - timedelta(days=60)
    
    totals = db.query(
        Transaction.ai_category,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= sixty_days_ago,
        Transaction.ai_category != "Transfer"
    ).group_by(Transaction.ai_category).all()
    
    total_income = Decimal("0.0")
    total_expenses = Decimal("0.0")
    
    for row in totals:
        cat, val = row[0], row[1] or Decimal("0.0")
        if cat == "Income":
            total_income += val
        else:
            total_expenses += val
            
    # Monthly averages
    avg_monthly_income = (total_income / Decimal("2.0")) if total_income > 0 else Decimal("0.0")
    avg_monthly_expenses = (total_expenses / Decimal("2.0")) if total_expenses > 0 else Decimal("0.0")
    
    current_savings_rate = Decimal("0.0")
    if avg_monthly_income > 0:
        savings = avg_monthly_income - avg_monthly_expenses
        current_savings_rate = (savings / avg_monthly_income) * Decimal("100.0")
        
    # 2. Run compound interest projections
    projection_years = []
    current_balance = Decimal("0.0")
    
    # Get current savings bank accounts balance
    savings_accounts = db.query(PlaidAccount).join(
        PlaidAccount.plaid_item
    ).filter(
        PlaidItem.user_id == current_user.id,
        PlaidAccount.subtype == "savings"
    ).all()
    
    if savings_accounts:
        current_balance = sum(acc.balance_current for acc in savings_accounts)
        
    balance = current_balance
    total_contributed = Decimal("0.0")
    
    rate = query.annual_return_rate / Decimal("12.0") # Monthly rate
    months = query.years * 12
    
    for month_idx in range(1, months + 1):
        # Accrue interest
        interest = balance * rate
        balance += interest
        
        # Add contribution
        balance += query.monthly_contribution
        total_contributed += query.monthly_contribution
        
        # Save at end of each year
        if month_idx % 12 == 0:
            year_num = month_idx // 12
            total_interest = balance - (current_balance + total_contributed)
            projection_years.append(
                ProjectionYear(
                    year=year_num,
                    balance=round(balance, 2),
                    total_contributed=round(current_balance + total_contributed, 2),
                    total_interest=round(max(Decimal("0.0"), total_interest), 2)
                )
            )
            
    return SavingsProjectionResponse(
        current_savings_rate=round(current_savings_rate, 2),
        average_monthly_income=round(avg_monthly_income, 2),
        average_monthly_expenses=round(avg_monthly_expenses, 2),
        projection=projection_years
    )


@router.get("/reports", response_model=List[WeeklySummaryResponse])
def get_reports(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    """
    Get list of generated financial summaries.
    """
    reports = db.query(FinancialReport).filter(
        FinancialReport.user_id == current_user.id
    ).order_by(desc(FinancialReport.created_at)).all()
    return reports


@router.post("/reports/trigger", response_model=WeeklySummaryResponse)
def trigger_report_generation(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    """
    Manually triggers generation of a weekly report for testing and validation.
    """
    # Let's generate a report for the last 7 days
    end_date = date.today()
    start_date = end_date - timedelta(days=7)
    
    # 1. Fetch transactions in range
    txs_records = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date
    ).all()
    
    transactions = [
        {
            "name": tx.name,
            "ai_category": tx.ai_category,
            "amount": float(tx.amount),
            "date": tx.date
        } for tx in txs_records
    ]
    
    # 2. Fetch accounts
    accounts_records = db.query(PlaidAccount).join(
        PlaidAccount.plaid_item
    ).filter(
        PlaidItem.user_id == current_user.id
    ).all()
    
    accounts = [
        {
            "name": acc.name,
            "type": acc.type,
            "subtype": acc.subtype,
            "balance_current": float(acc.balance_current)
        } for acc in accounts_records
    ]
    
    # 3. Fetch budgets
    month_str = end_date.strftime("%Y-%m")
    budgets_records = db.query(Budget).filter(
        Budget.user_id == current_user.id,
        Budget.month == month_str
    ).all()
    
    budgets = [
        {
            "category": b.category,
            "amount": float(b.amount)
        } for b in budgets_records
    ]
    
    # 4. Generate report via LLM
    report_data = openai_service.generate_weekly_report(
        user_name=current_user.full_name or current_user.email,
        start_date=start_date,
        end_date=end_date,
        transactions=transactions,
        accounts=accounts,
        budgets=budgets
    )
    
    # 5. Save report to DB
    report = FinancialReport(
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
        report_type="weekly",
        content=report_data
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    
    # Print Mock Email to Log
    from ..services.email_service import send_financial_summary_email
    send_financial_summary_email(current_user.email, report_data)
    
    return report
