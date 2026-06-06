import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_balance_get_request import AccountsBalanceGetRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.depository_filter import DepositoryFilter
from plaid.model.link_token_account_filters import LinkTokenAccountFilters

from ..config import settings

# Determine Plaid environment URL
if settings.PLAID_ENV == "sandbox":
    plaid_env = plaid.Environment.Sandbox
elif settings.PLAID_ENV == "development":
    plaid_env = plaid.Environment.Development
else:
    plaid_env = plaid.Environment.Production

# Initialize Plaid API client configuration
configuration = plaid.Configuration(
    host=plaid_env,
    api_key={
        'clientId': settings.PLAID_CLIENT_ID,
        'secret': settings.PLAID_SECRET,
    }
)

api_client = plaid.ApiClient(configuration)
plaid_client = plaid_api.PlaidApi(api_client)


def get_plaid_client():
    return plaid_client


def create_link_token(user_id: str, webhook_url: str = None) -> str:
    """
    Creates a link token to initialize Plaid Link for a user.
    """
    products = [Products(p.strip()) for p in settings.PLAID_PRODUCTS.split(",") if p.strip()]
    country_codes = [CountryCode(c.strip()) for c in settings.PLAID_COUNTRY_CODES.split(",") if c.strip()]
    
    user_payload = LinkTokenCreateRequestUser(client_user_id=str(user_id))
    
    request = LinkTokenCreateRequest(
        user=user_payload,
        client_name=settings.PROJECT_NAME,
        products=products,
        country_codes=country_codes,
        language="en"
    )
    
    if webhook_url:
        request.webhook = webhook_url
        
    response = plaid_client.link_token_create(request)
    return response.link_token


def exchange_public_token(public_token: str) -> dict:
    """
    Exchanges a public token from Plaid Link for an access token.
    """
    request = ItemPublicTokenExchangeRequest(
        public_token=public_token
    )
    response = plaid_client.item_public_token_exchange(request)
    return {
        "access_token": response.access_token,
        "item_id": response.item_id
    }


def get_accounts(access_token: str) -> list:
    """
    Retrieves accounts associated with a Plaid access token, along with real-time balance.
    """
    request = AccountsBalanceGetRequest(
        access_token=access_token
    )
    response = plaid_client.accounts_balance_get(request)
    return response.accounts


def sync_transactions(access_token: str, cursor: str = None) -> dict:
    """
    Fetches transaction updates (added, modified, removed) using Plaid's transactions_sync API.
    """
    added = []
    modified = []
    removed = []
    has_more = True
    next_cursor = cursor or ""
    
    # Iterate through pagination if has_more is true
    while has_more:
        request = TransactionsSyncRequest(
            access_token=access_token,
            cursor=next_cursor,
            count=500
        )
        response = plaid_client.transactions_sync(request)
        
        added.extend(response.added)
        modified.extend(response.modified)
        removed.extend(response.removed)
        
        has_more = response.has_more
        next_cursor = response.next_cursor
        
    return {
        "added": added,
        "modified": modified,
        "removed": removed,
        "next_cursor": next_cursor
    }
