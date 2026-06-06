import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Numeric, Date, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from .db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    weekly_report_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    plaid_items = relationship("PlaidItem", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="user", cascade="all, delete-orphan")
    financial_reports = relationship("FinancialReport", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")


class PlaidItem(Base):
    __tablename__ = "plaid_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    item_id = Column(String(255), unique=True, nullable=False)
    access_token = Column(String(255), nullable=False)
    institution_id = Column(String(100), nullable=True)
    institution_name = Column(String(255), nullable=True)
    status = Column(String(50), default="active")
    cursor = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="plaid_items")
    accounts = relationship("PlaidAccount", back_populates="plaid_item", cascade="all, delete-orphan")


class PlaidAccount(Base):
    __tablename__ = "plaid_accounts"

    id = Column(Integer, primary_key=True, index=True)
    plaid_item_id = Column(Integer, ForeignKey("plaid_items.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    mask = Column(String(20), nullable=True)
    type = Column(String(50), nullable=False)
    subtype = Column(String(50), nullable=True)
    balance_available = Column(Numeric(15, 2), nullable=True)
    balance_current = Column(Numeric(15, 2), nullable=False)
    balance_limit = Column(Numeric(15, 2), nullable=True)
    currency = Column(String(10), default="USD")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    plaid_item = relationship("PlaidItem", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plaid_account_id = Column(Integer, ForeignKey("plaid_accounts.id", ondelete="CASCADE"), nullable=False)
    transaction_id = Column(String(255), unique=True, nullable=False)
    category = Column(String(255), nullable=True)
    ai_category = Column(String(100), default="Other")
    ai_justification = Column(Text, nullable=True)
    amount = Column(Numeric(15, 2), nullable=False)
    date = Column(Date, nullable=False)
    name = Column(String(255), nullable=False)
    merchant_name = Column(String(255), nullable=True)
    pending = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="transactions")
    account = relationship("PlaidAccount", back_populates="transactions")


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category = Column(String(100), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    month = Column(String(7), nullable=False)  # YYYY-MM
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="budgets")


class FinancialReport(Base):
    __tablename__ = "financial_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    report_type = Column(String(50), default="weekly")
    content = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="financial_reports")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="chat_messages")
