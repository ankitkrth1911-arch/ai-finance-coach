import json
import logging
from typing import List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from openai import OpenAI

from ..config import settings

logger = logging.getLogger("finance_coach.openai")

# Initialize OpenAI client
client = None
if settings.OPENAI_API_KEY:
    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI client: {e}")

# Standard Category Scheme
ALLOWED_CATEGORIES = [
    "Dining Out",
    "Groceries",
    "Rent & Mortgage",
    "Utilities",
    "Subscriptions",
    "Income",
    "Transfer",
    "Entertainment",
    "Shopping",
    "Other"
]

def fallback_categorize(transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Keyword-based categorization fallback if OpenAI API fails or is unconfigured.
    """
    results = []
    for tx in transactions:
        name_lower = tx.get("name", "").lower()
        original_cat = " ".join(tx.get("category") or []).lower()
        
        assigned_cat = "Other"
        justification = "Categorized via rule-based keywords fallback (no OpenAI API key configured)."
        
        # Rule checks
        if any(kw in name_lower for kw in ["netflix", "spotify", "hulu", "disney", "youtube", "amazon prime", "sub", "cloud", "apple.com"]):
            assigned_cat = "Subscriptions"
        elif any(kw in name_lower for kw in ["starbucks", "mcdonald", "burger", "restaurant", "cafe", "pizza", "grill", "pub", "bar", "diner", "eats"]):
            assigned_cat = "Dining Out"
        elif any(kw in name_lower for kw in ["safeway", "grocery", "groceries", "kroger", "whole foods", "supermarket", "walmart", "target", "costco", "aldi"]):
            assigned_cat = "Groceries"
        elif any(kw in name_lower for kw in ["rent", "mortgage", "housing", "landlord", "apartment"]):
            assigned_cat = "Rent & Mortgage"
        elif any(kw in name_lower for kw in ["utility", "electric", "gas", "water", "sewer", "trash", "power", "comcast", "verizon", "at&t", "internet", "phone"]):
            assigned_cat = "Utilities"
        elif any(kw in name_lower for kw in ["payroll", "salary", "direct deposit", "stripe", "paypal", "venmo", "reimbursement", "dividend", "interest"]):
            assigned_cat = "Income"
        elif any(kw in name_lower for kw in ["transfer", "wire", "atm", "zelle", "internal"]):
            assigned_cat = "Transfer"
        elif any(kw in name_lower for kw in ["cinema", "movie", "spotify", "steam", "nintendo", "playstation", "ticketmaster", "concert", "museum", "bowling"]):
            assigned_cat = "Entertainment"
        elif any(kw in name_lower for kw in ["nike", "zara", "clothing", "shoe", "department store", "boutique", "mall", "nordstrom", "macys"]):
            assigned_cat = "Shopping"
        
        # Check original Plaid category as a secondary heuristic
        if assigned_cat == "Other" and original_cat:
            if "food" in original_cat or "dining" in original_cat:
                assigned_cat = "Dining Out"
            elif "grocer" in original_cat:
                assigned_cat = "Groceries"
            elif "payment" in original_cat or "rent" in original_cat:
                assigned_cat = "Rent & Mortgage"
            elif "utility" in original_cat or "bill" in original_cat:
                assigned_cat = "Utilities"
            elif "subscription" in original_cat:
                assigned_cat = "Subscriptions"
            elif "transfer" in original_cat:
                assigned_cat = "Transfer"
            elif "recreation" in original_cat or "entertainment" in original_cat:
                assigned_cat = "Entertainment"
            elif "shop" in original_cat:
                assigned_cat = "Shopping"
            elif "income" in original_cat or "salary" in original_cat:
                assigned_cat = "Income"
                
        results.append({
            "transaction_id": tx["transaction_id"],
            "ai_category": assigned_cat,
            "ai_justification": justification
        })
    return results


def categorize_transactions(transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Categorizes a batch of transactions using OpenAI GPT-4o.
    """
    if not client:
        return fallback_categorize(transactions)
        
    # Format batch for GPT
    batch_data = []
    for tx in transactions:
        batch_data.append({
            "id": tx["transaction_id"],
            "name": tx["name"],
            "amount": float(tx["amount"]),
            "plaid_categories": tx.get("category", [])
        })
        
    prompt = f"""You are a personal finance ledger bot. Categorize the list of bank transactions below into exactly one of these categories:
{json.dumps(ALLOWED_CATEGORIES, indent=2)}

Format your output as a raw JSON list of objects. Each object MUST have keys:
- "transaction_id": matching the transaction ID provided
- "ai_category": one of the listed categories above
- "ai_justification": a short sentence explaining your categorization decision based on merchant name, amount, or Plaid hints.

Do not include any markdown backticks, explanations, or additional text. Just output the raw JSON array.

Transactions:
{json.dumps(batch_data, indent=2)}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert financial ledger assistant that outputs strict JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0
        )
        content = response.choices[0].message.content.strip()
        # Clean markdown formatting if returned
        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```json") or lines[0].startswith("```"):
                content = "\n".join(lines[1:-1])
        
        parsed = json.loads(content)
        # Validate category choices
        for item in parsed:
            if item.get("ai_category") not in ALLOWED_CATEGORIES:
                item["ai_category"] = "Other"
        return parsed
    except Exception as e:
        logger.error(f"OpenAI transaction categorization failed: {e}. Falling back.")
        return fallback_categorize(transactions)


def chat_coach(
    user_message: str,
    chat_history: List[Dict[str, str]],
    accounts: List[Dict[str, Any]],
    transactions: List[Dict[str, Any]]
) -> str:
    """
    Asks the AI Financial Coach a question incorporating recent bank balances and transaction trends.
    """
    if not client:
        # Fallback response
        return (
            "Hi there! I am your AI Financial Coach. It looks like the OpenAI API Key is not set, "
            "so I'm in fallback mode. However, looking at your accounts, I can see you have "
            f"{len(accounts)} connected bank account(s). "
            "To unlock complete AI-powered feedback, please configure the `OPENAI_API_KEY` in your backend `.env` file!"
        )
        
    # Format financial profile context
    profile_context = "User Bank Accounts:\n"
    for acc in accounts:
        profile_context += f"- {acc['name']} ({acc['subtype']}): ${acc['balance_current']:.2f}\n"
        
    profile_context += "\nRecent Transactions:\n"
    for tx in transactions[:15]: # Last 15 transactions
        profile_context += f"- {tx['date']} | {tx['name']} | {tx['ai_category']} | ${tx['amount']:.2f}\n"

    messages = [
        {
            "role": "system",
            "content": (
                "You are an empathetic, knowledgeable, and highly analytical AI Personal Finance Coach. "
                "You help users optimize their spending, grow their savings rate, spot bad habits, "
                "and achieve financial independence. Be concise, actionable, and friendly. "
                "Reference their connected bank account balances and recent transactions if relevant."
            )
        }
    ]
    
    # Append chat history
    for msg in chat_history[-10:]: # Limit history to last 10 messages
        messages.append({"role": msg["role"], "content": msg["content"]})
        
    # Append user question with financial context
    user_prompt = f"""[Financial Profile Context]
{profile_context}

User's Question: "{user_message}"
"""
    messages.append({"role": "user", "content": user_prompt})
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.5
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"OpenAI Financial Coach Chat failed: {e}")
        return "Sorry, I am having trouble connecting to my coaching brain. Please check the backend console or configuration."


def detect_bad_habits(transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Analyzes historical transactions to spot negative behavioral patterns (subscriptions, coffee, dining spikes).
    """
    if not client:
        # Static analytics-based heuristics fallback
        habits = []
        # Let's count dining out transactions
        dining_txs = [t for t in transactions if t["ai_category"] == "Dining Out"]
        dining_total = sum(float(t["amount"]) for t in dining_txs)
        if len(dining_txs) > 8:
            habits.append({
                "title": "Frequent Dining Out Habit",
                "description": f"You ordered out {len(dining_txs)} times recently, totaling ${dining_total:.2f}.",
                "impact": "High. Eating out routinely eats away at potential savings and compounding interest.",
                "remediation": "Try meal prepping on weekends or limit dining out to twice a week."
            })
            
        sub_txs = [t for t in transactions if t["ai_category"] == "Subscriptions"]
        sub_total = sum(float(t["amount"]) for t in sub_txs)
        if sub_total > 50:
            habits.append({
                "title": "Subscription Accumulation",
                "description": f"You spent ${sub_total:.2f} across subscriptions.",
                "impact": "Medium. Recurring services often run silently and add up quickly.",
                "remediation": "Audit your monthly bills and cancel any services not used in the last 30 days."
            })
            
        shopping_txs = [t for t in transactions if t["ai_category"] == "Shopping"]
        shopping_total = sum(float(t["amount"]) for t in shopping_txs)
        if shopping_total > 300:
            habits.append({
                "title": "Discretionary Shopping Spike",
                "description": f"You spent ${shopping_total:.2f} on shopping retail items recently.",
                "impact": "Medium. Impulse shopping leads to lifestyle creep.",
                "remediation": "Implement a 24-hour cooling-off rule before clicking purchase on non-essential goods."
            })

        if not habits:
            habits.append({
                "title": "Healthy Spending Patterns Detected!",
                "description": "Your transactions don't show any major flags or excessive repeating spikes.",
                "impact": "Positive! You're saving more and keeping impulsive habits at bay.",
                "remediation": "Maintain this progress. Direct extra funds automatically to investments."
            })
        return habits

    # Build transaction details list for AI analysis
    tx_list = []
    for tx in transactions[:60]: # last 60 transactions
        tx_list.append({
            "name": tx["name"],
            "category": tx["ai_category"],
            "amount": float(tx["amount"]),
            "date": str(tx["date"])
        })
        
    prompt = f"""You are an elite financial auditor. Analyze these transaction histories for bad recurring financial habits:
{json.dumps(tx_list, indent=2)}

Detect issues like:
- 3x dining out spikes
- Unused subscription duplicates
- Microtransaction leaks (e.g. coffee shop visits every single morning)
- High credit card utilization / fee hazards

Output a strict JSON array of objects. Each object MUST contain keys:
- "title": Name of the bad habit
- "description": Why it was flagged, with details (e.g. "Spent $240 across 12 coffee visits")
- "impact": The financial risk / cost (e.g. "Destroys savings momentum")
- "remediation": Clear, actionable step to curb it

Do not include markdown wrappers. Just return raw JSON. If no habits are found, return a list containing a positive financial behavior praise block.
"""
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a professional auditor. Output strict raw JSON lists."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```json") or lines[0].startswith("```"):
                content = "\n".join(lines[1:-1])
        return json.loads(content)
    except Exception as e:
        logger.error(f"OpenAI bad habits detector failed: {e}")
        return fallback_categorize([]) # Fallback empty behavior or reuse local rules


def generate_weekly_report(
    user_name: str,
    start_date: date,
    end_date: date,
    transactions: List[Dict[str, Any]],
    accounts: List[Dict[str, Any]],
    budgets: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Generates a structured weekly financial health report using OpenAI.
    """
    # Calculate statistics locally to feed into LLM
    total_spending = Decimal("0.0")
    total_income = Decimal("0.0")
    category_totals = {}
    
    for tx in transactions:
        amt = Decimal(str(tx["amount"]))
        cat = tx["ai_category"]
        if cat == "Income":
            total_income += amt
        else:
            total_spending += amt
            category_totals[cat] = category_totals.get(cat, Decimal("0.0")) + amt
            
    # Convert category totals to floats
    category_spending = {k: float(v) for k, v in category_totals.items()}
    
    # Calculate savings rate
    savings_rate = 0.0
    if total_income > 0:
        savings = total_income - total_spending
        savings_rate = float((savings / total_income) * 100)
        
    # Format budgets status
    budget_comparison = []
    for b in budgets:
        # find spending in this category
        cat_spent = float(category_totals.get(b["category"], Decimal("0.0")))
        budget_comparison.append({
            "category": b["category"],
            "limit": float(b["amount"]),
            "spent": cat_spent,
            "status": "exceeded" if cat_spent > float(b["amount"]) else "warning" if cat_spent > float(b["amount"]) * 0.85 else "safe"
        })
        
    net_worth = sum(float(a["balance_current"]) for a in accounts if a["type"] == "depository") - \
                sum(float(a["balance_current"]) for a in accounts if a["type"] == "credit")

    summary_stats = {
        "user_name": user_name,
        "start_date": str(start_date),
        "end_date": str(end_date),
        "total_spending": float(total_spending),
        "total_income": float(total_income),
        "net_worth": float(net_worth),
        "savings_rate": savings_rate,
        "category_spending": category_spending,
        "budgets": budget_comparison
    }
    
    if not client:
        # Fallback generated text
        advice = (
            f"Hello {user_name}! In the week of {start_date} to {end_date}, you spent a total of "
            f"${total_spending:.2f} and earned ${total_income:.2f}. "
            f"Your current savings rate is {savings_rate:.1f}%. "
            "To activate full AI-crafted recommendations and weekly breakdowns, please set up the OpenAI API Key."
        )
        return {
            "statistics": summary_stats,
            "summary": advice,
            "actionable_tips": [
                "Track discretionary categories like Dining Out and Shopping closely.",
                "Adjust category budgets in your settings if limits are routinely exceeded.",
                "Ensure your incoming transfers are categorized correctly."
            ],
            "habit_warnings": ["Mock warning: Configure OpenAI API key to search for complex habits."]
        }
        
    prompt = f"""You are an elite financial coach. Generate a weekly financial health report for {user_name} based on the statistics below:

{json.dumps(summary_stats, indent=2)}

Output a strict JSON object with exactly these keys:
- "summary": A friendly, paragraph-long overview summarizing their weekly performance, highlighting whether they saved well or overspent.
- "actionable_tips": An array of 3 specific, concrete tasks they should do next week based on this data (e.g. "Reduce Starbucks visits", "Adjust your Groceries budget").
- "habit_warnings": An array of any spending behaviors that looked sub-optimal.

Do not include markdown blocks. Output raw JSON.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a professional personal finance coach. Output raw JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.4
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```json") or lines[0].startswith("```"):
                content = "\n".join(lines[1:-1])
        parsed = json.loads(content)
        parsed["statistics"] = summary_stats
        return parsed
    except Exception as e:
        logger.error(f"OpenAI weekly report failed: {e}")
        # Return fallback values
        return {
            "statistics": summary_stats,
            "summary": f"Could not generate AI summary due to error: {e}",
            "actionable_tips": ["Review transactions.", "Keep spending down."],
            "habit_warnings": []
        }
