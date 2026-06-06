import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .config import settings
from .db import engine, Base
from .routers import auth, plaid_routes, transactions, budgets, coach, webhooks
from .services.scheduler import start_scheduler, stop_scheduler

# Configure logging format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("finance_coach")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("Starting up AI Personal Finance Coach application...")
    try:
        # Create database tables automatically if they don't exist
        Base.metadata.create_all(bind=engine)
        logger.info("Database connection verified and tables checked.")
    except Exception as e:
        logger.error(f"Error during database startup: {e}", exc_info=True)
        
    try:
        # Start weekly reports background scheduler
        start_scheduler()
    except Exception as e:
        logger.error(f"Error starting scheduler: {e}", exc_info=True)
        
    yield
    
    # Shutdown actions
    logger.info("Shutting down AI Personal Finance Coach application...")
    try:
        stop_scheduler()
    except Exception as e:
        logger.error(f"Error stopping scheduler: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Full-stack AI Personal Finance Coach backend. Plaid integration, AI categorization, budgeting, and automated reporting.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Policy configuration
# Adjust origins for production deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router)
app.include_router(plaid_routes.router)
app.include_router(webhooks.router)
app.include_router(transactions.router)
app.include_router(budgets.router)
app.include_router(coach.router)

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "app_name": settings.PROJECT_NAME,
        "message": "AI Personal Finance Coach API is active. Connect via endpoints."
    }
