# Plaid Sandbox Setup & Testing Guide

This guide details how to configure, run, and test Plaid Link and transaction synchronization in the sandbox environment.

---

## 1. Credentials Setup

To initialize Plaid API Sandbox, you must register for a free developer account at [Plaid Dashboard](https://dashboard.plaid.com/signup).

Once registered:
1. Log in and go to **Team Settings** > **Keys**.
2. Copy your **Client ID** and **Sandbox Secret**.
3. Paste these values in your backend `.env` file:
   ```env
   PLAID_CLIENT_ID=your_client_id
   PLAID_SECRET=your_sandbox_secret
   PLAID_ENV=sandbox
   ```

---

## 2. Testing Credentials in Sandbox Mode

When you click **Connect a Bank** inside the dashboard, the Plaid Link flow will open in Sandbox mode. Search for any standard bank (e.g. "Chase", "Bank of America") or pick a card.

Use the following credentials to authenticate:

### Successful login
- **Username**: `user_good`
- **Password**: `pass_good`

This returns mock accounts including:
- Checking accounts
- Savings accounts
- Credit Card accounts
- Loan/Investment accounts

### MFA Verification
If the selected institution prompts for Multi-Factor Authentication (MFA):
- Enter `1234` or any text to succeed.

### Simulating Errors & Disconnects
You can simulate specific sync errors or item repair flows by logging in with:
- **Username**: `user_bad` or `user_locked`
- **Password**: `pass_good`

---

## 3. Simulating Webhooks Locally

Plaid sends webhooks when new transactions are synced. Because local environments (`localhost:8000`) cannot be reached by Plaid's servers directly, you must configure a secure tunnel.

### Step 3.1: Create a secure tunnel
Run a utility like **ngrok** to proxy calls:
```bash
# Expose FastAPI backend
ngrok http 8000
```
This generates a public forwarding URL (e.g. `https://a1b2-34-56-78.ngrok-free.app`).

### Step 3.2: Configure Webhook URLs
To pass webhooks, supply your ngrok forwarding endpoint in the Plaid Link configurations.
In `backend/app/routers/plaid_routes.py`, update `create_link_token` call to register the webhook URL:
```python
link_token = plaid_service.create_link_token(
    user_id=str(current_user.id),
    webhook_url="https://a1b2-34-56-78.ngrok-free.app/webhooks/plaid"
)
```

### Step 3.3: Trigger Webhooks from the Plaid Dashboard
1. Go to the [Plaid Dashboard Webhook Tool](https://dashboard.plaid.com/developers/webhooks).
2. Enter your Plaid Item's Access Token (find it in your database under `plaid_items`).
3. Select `TRANSACTIONS` as the type and `SYNC_UPDATES_AVAILABLE` as the code.
4. Click **Fire Webhook**.
5. Check your backend console logs. You should see the webhook hit `/webhooks/plaid` and trigger a background sync automatically.
