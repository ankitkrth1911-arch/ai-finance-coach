from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Any
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal

# --- User & Auth ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[UUID] = None

class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: Optional[str] = None
    weekly_report_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Plaid ---
class LinkTokenCreate(BaseModel):
    pass

class LinkTokenResponse(BaseModel):
    link_token: str

class PublicTokenExchange(BaseModel):
    public_token: str
    institution_id: Optional[str] = None
    institution_name: Optional[str] = None

class PlaidAccountResponse(BaseModel):
    id: int
    account_id: str
    name: str
    mask: Optional[str] = None
    type: str
    subtype: Optional[str] = None
    balance_available: Optional[Decimal] = None
    balance_current: Decimal
    balance_limit: Optional[Decimal] = None
    currency: str

    class Config:
        from_attributes = True

class PlaidItemResponse(BaseModel):
    id: int
    item_id: str
    institution_name: Optional[str] = None
    status: str
    accounts: List[PlaidAccountResponse] = []

    class Config:
        from_attributes = True

# --- Transactions ---
class TransactionResponse(BaseModel):
    id: int
    transaction_id: str
    category: Optional[str] = None
    ai_category: str
    ai_justification: Optional[str] = None
    amount: Decimal
    date: date
    name: str
    merchant_name: Optional[str] = None
    pending: bool
    plaid_account_id: int
    account_name: Optional[str] = None

    class Config:
        from_attributes = True

# --- Budget ---
class BudgetCreate(BaseModel):
    category: str
    amount: Decimal
    month: str = Field(..., pattern=r"^\d{4}-\d{2}$") # YYYY-MM

class BudgetResponse(BaseModel):
    id: int
    category: str
    amount: Decimal
    month: str
    current_spending: Decimal = Decimal("0.0")

    class Config:
        from_attributes = True

# --- Chat & AI Coach ---
class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class ChatQuery(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str
    history: List[ChatMessageResponse] = []

# --- Bad Habits & Alerts ---
class BadHabit(BaseModel):
    title: str
    description: str
    impact: str
    remediation: str

class BadHabitResponse(BaseModel):
    habits: List[BadHabit] = []

# --- Savings Projections ---
class SavingsProjectionQuery(BaseModel):
    monthly_contribution: Decimal
    annual_return_rate: Decimal = Decimal("0.07") # 7% default
    years: int = 10

class ProjectionYear(BaseModel):
    year: int
    balance: Decimal
    total_contributed: Decimal
    total_interest: Decimal

class SavingsProjectionResponse(BaseModel):
    current_savings_rate: Decimal
    average_monthly_income: Decimal
    average_monthly_expenses: Decimal
    projection: List[ProjectionYear]

# --- Weekly Health Summary ---
class WeeklySummaryResponse(BaseModel):
    id: int
    start_date: date
    end_date: date
    report_type: str
    content: Any # JSON content
    created_at: datetime

    class Config:
        from_attributes = True
