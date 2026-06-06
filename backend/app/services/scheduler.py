import logging
from datetime import date, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models import User, Transaction, PlaidAccount, PlaidItem, Budget, FinancialReport
from . import plaid_service, openai_service, email_service

logger = logging.getLogger("finance_coach.scheduler")
scheduler = BackgroundScheduler()


def run_weekly_report_for_user(user_id: str):
    """
    Core engine that gathers user data, runs categorization updates,
    generates an AI summary, commits it to the DB, and emails the user.
    """
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.weekly_report_enabled:
            return

        logger.info(f"Running weekly report job for user: {user.email}")
        
        # 1. Pull latest Plaid transactions to ensure data freshness before report
        items = db.query(PlaidItem).filter(PlaidItem.user_id == user.id, PlaidItem.status == "active").all()
        for item in items:
            try:
                sync_res = plaid_service.sync_transactions(item.access_token, cursor=item.cursor)
                added = sync_res.get("added", [])
                
                # Update balances
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

                # Process additions
                if added:
                    txs_to_cat = [{"transaction_id": tx.transaction_id, "name": tx.name, "amount": tx.amount, "category": tx.category or []} for tx in added]
                    ai_cats = openai_service.categorize_transactions(txs_to_cat)
                    ai_map = {c["transaction_id"]: c for c in ai_cats}

                    for tx in added:
                        existing = db.query(Transaction).filter(Transaction.transaction_id == tx.transaction_id).first()
                        if existing:
                            continue
                        db_acc_id = account_map.get(tx.account_id)
                        if not db_acc_id:
                            continue
                            
                        ai_data = ai_map.get(tx.transaction_id, {})
                        
                        db_tx = Transaction(
                            user_id=user.id,
                            plaid_account_id=db_acc_id,
                            transaction_id=tx.transaction_id,
                            category=", ".join(tx.category) if tx.category else "Uncategorized",
                            ai_category=ai_data.get("ai_category", "Other"),
                            ai_justification=ai_data.get("ai_justification", "Weekly report auto-sync."),
                            amount=tx.amount,
                            date=tx.date,
                            name=tx.name,
                            merchant_name=tx.merchant_name or tx.name,
                            pending=tx.pending
                        )
                        db.add(db_tx)
                    
                    item.cursor = sync_res.get("next_cursor", "")
                    db.commit()
            except Exception as item_err:
                logger.error(f"Error syncing Plaid item {item.id} during weekly report: {item_err}")
                
        # 2. Gather data for report compilation
        end_date = date.today()
        start_date = end_date - timedelta(days=7)
        
        txs_records = db.query(Transaction).filter(
            Transaction.user_id == user.id,
            Transaction.date >= start_date,
            Transaction.date <= end_date
        ).all()
        
        transactions = [{
            "name": tx.name,
            "ai_category": tx.ai_category,
            "amount": float(tx.amount),
            "date": tx.date
        } for tx in txs_records]
        
        accounts_records = db.query(PlaidAccount).join(PlaidAccount.plaid_item).filter(PlaidItem.user_id == user.id).all()
        accounts = [{
            "name": acc.name,
            "type": acc.type,
            "subtype": acc.subtype,
            "balance_current": float(acc.balance_current)
        } for acc in accounts_records]
        
        month_str = end_date.strftime("%Y-%m")
        budgets_records = db.query(Budget).filter(Budget.user_id == user.id, Budget.month == month_str).all()
        budgets = [{
            "category": b.category,
            "amount": float(b.amount)
        } for b in budgets_records]
        
        # 3. Generate report via OpenAI
        report_data = openai_service.generate_weekly_report(
            user_name=user.full_name or user.email,
            start_date=start_date,
            end_date=end_date,
            transactions=transactions,
            accounts=accounts,
            budgets=budgets
        )
        
        # 4. Save and email report
        report = FinancialReport(
            user_id=user.id,
            start_date=start_date,
            end_date=end_date,
            report_type="weekly",
            content=report_data
        )
        db.add(report)
        db.commit()
        
        email_service.send_financial_summary_email(user.email, report_data)
        logger.info(f"Successfully processed weekly report for user {user.email}")
        
    except Exception as e:
        logger.error(f"Weekly report compilation failed for user {user_id}: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


def weekly_report_job():
    """
    Scan for all active users with weekly report enabled, and process them.
    """
    logger.info("Executing weekly financial coach report cron job.")
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.is_active == True, User.weekly_report_enabled == True).all()
        for user in users:
            # We process sequentially in the background job thread
            run_weekly_report_for_user(str(user.id))
    except Exception as e:
        logger.error(f"Failed executing weekly report job: {e}", exc_info=True)
    finally:
        db.close()


def start_scheduler():
    """
    Starts the scheduler daemon. Runs every Sunday at midnight (00:00).
    """
    if not scheduler.running:
        # Run weekly report job every Sunday at 00:00
        scheduler.add_job(weekly_report_job, "cron", day_of_week="sun", hour=0, minute=0, id="weekly_reports")
        scheduler.start()
        logger.info("APScheduler initialized and running weekly report job.")


def stop_scheduler():
    """
    Shutdown scheduler safely.
    """
    if scheduler.running:
        scheduler.shutdown()
        logger.info("APScheduler stopped.")
