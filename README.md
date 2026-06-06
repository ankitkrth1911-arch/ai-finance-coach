# Clarity AI - Personal Finance Coach

A full-stack, AI-powered Personal Finance Coach web application built using React, FastAPI, PostgreSQL, Plaid Sandbox, and OpenAI GPT-4o.

---

## Features Built

1. **Plaid Link Integration**: Secure bank account linking via Plaid's sandbox mode (using credentials like `user_good`/`pass_good`).
2. **AI-Powered Transaction Categorizer**: Uses OpenAI GPT-4o to automatically assign clean, contextual categories (e.g. Dining Out, Groceries, Subscriptions) and provides written justifications.
3. **Cash Flow & Spending Breakdown Analytics**: Rich charts made with Recharts displaying allocations and month-over-month income vs. outflow trends.
4. **Interactive Budget Manager**: Set monthly category limits and track expenditures dynamically with color-coded alerts (Safe, Warning, Exceeded).
5. **AI Financial Coach chatbot**: A friendly, knowledgeable assistant that references connected account balances and transaction history.
6. **Automated Bad Habit Scanner**: Scans historical transactions to identify leaks (e.g. subscription piles, coffee runs, dining out spikes) and provides action plans.
7. **Weekly Financial Reports**: Generated on a cron schedule (using APScheduler) and emailed to the user using SMTP (falls back to logging on stdout).
8. **Compound Interest Projection Simulator**: Runs future growth curves based on monthly contributions and expected investment return rates.

---

## Directory Structure

```
/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                     # App startup & middleware
│   │   ├── config.py                   # Environment settings
│   │   ├── db.py                       # DB engine & session manager
│   │   ├── models.py                   # SQLAlchemy model schemas
│   │   ├── schemas.py                  # Pydantic validation schemas
│   │   ├── routers/
│   │   │   ├── auth.py                 # JWT Registration, login, settings
│   │   │   ├── plaid_routes.py         # Plaid token exchanges & syncs
│   │   │   ├── webhooks.py             # Plaid transaction webhook handler
│   │   │   ├── transactions.py         # Metrics, filters, adjustments
│   │   │   ├── budgets.py              # Budget targets & thresholds
│   │   │   └── coach.py                # AI coach chat, audits, calculations
│   │   └── services/
│   │       ├── plaid_service.py        # Plaid client SDK wrapper
│   │       ├── openai_service.py       # OpenAI GPT-4o service & fallbacks
│   │       ├── scheduler.py            # APScheduler weekly cron compiler
│   │       └── email_service.py        # SMTP email notification formatting
│   └── requirements.txt                # Python package list
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth.jsx                # Login / Registration screens
│   │   │   ├── Dashboard.jsx           # Main stats & transaction list
│   │   │   ├── PlaidLinkButton.jsx     # Plaid Link controller
│   │   │   ├── SpendingCharts.jsx      # Recharts allocation visuals
│   │   │   ├── BudgetGoalSetter.jsx    # Limit setting panel
│   │   │   ├── AICoachChat.jsx         # Conversational assistant box
│   │   │   ├── BadHabitDetector.jsx    # Savings leak alert display
│   │   │   ├── SavingsCalculator.jsx   # Interest compounding grapher
│   │   │   └── WeeklyReportView.jsx    # Generated health reports archive
│   │   ├── context/
│   │   │   └── AuthContext.jsx         # User sessions & tokens context
│   │   ├── App.jsx                     # Route tabs wrapper
│   │   ├── main.jsx                    # React mounting script
│   │   └── index.css                   # Global styles & custom animations
│   ├── index.html                      # Landing index file
│   ├── vite.config.js                  # Vite compiler configurations
│   ├── tailwind.config.js              # Tailwind custom layouts
│   ├── postcss.config.js               # PostCSS styling processing
│   └── package.json                    # Node script packages
├── schema.sql                          # Core PostgreSQL database schema
├── plaid_setup.md                      # Plaid Sandbox config guide
├── .env.example                        # Variables template config
└── README.md                           # Master application documentation
```

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+ and NPM
- PostgreSQL instance running

---

### Step 1: Database Setup

Create a database named `finance_coach` in your PostgreSQL instance:
```sql
CREATE DATABASE finance_coach;
```
To run the database migrations and create the tables, you can execute the contents of the `schema.sql` file in your database console or let SQLAlchemy automatically create the tables on app startup.

---

### Step 2: Backend Setup

1. Open your terminal in the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   # On Windows (CMD):
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install the required python packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Create your local `.env` configuration file:
   Copy `.env.example` from the root folder to `backend/.env` and update the keys:
   - Configure your PostgreSQL `DATABASE_URL`.
   - Add your `PLAID_CLIENT_ID` and `PLAID_SECRET`.
   - Add your `OPENAI_API_KEY` to unlock AI-powered categorizations, chats, and automated weekly summaries (the application incorporates rule-based/static heuristics as fallback if no key is supplied).
5. Start the FastAPI backend:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
The backend server will launch at [http://localhost:8000](http://localhost:8000).

---

### Step 3: Frontend Setup

1. Open another terminal in the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install the node packages:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
Open [http://localhost:5173](http://localhost:5173) in your browser to access the dashboard.

---

## Testing Sandbox Flow

1. Register an account on the login page.
2. Navigate to **Bank Link** and click **Connect a Bank**.
3. Choose any bank (e.g. "Chase") and authenticate using the Sandbox credentials:
   - **Username**: `user_good`
   - **Password**: `pass_good`
4. The system will retrieve accounts, run an initial sync of transactions, and trigger AI transaction categorization in the background.
5. Head to the **Dashboard** and click **Sync Transactions** to see your imported balances and transaction ledgers.
6. Explore **Budgets**, **Cash Analysis**, and chat with your **AI Coach** about your spending!
