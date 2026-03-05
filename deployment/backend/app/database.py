import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ==========================================
# 1. DATABASE CONFIGURATION
# ==========================================
# We now rely on the single DATABASE_URL variable.
# This allows us to switch between SQLite and PostgreSQL easily via the .env file.

# Default to SQLite if no variable is found
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./malaria.db")

print(f"🔌 Connecting to Database: {SQLALCHEMY_DATABASE_URL}")

# ==========================================
# 2. ENGINE SETUP (Hybrid Support)
# ==========================================
connect_args = {}

# SQLite requires specific arguments to work with FastAPI (multi-threading)
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    connect_args = {"check_same_thread": False}

try:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args=connect_args
    )
except Exception as e:
    print(f"❌ Database Connection Failed: {e}")
    raise e

# ==========================================
# 3. SESSION FACTORY
# ==========================================
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ==========================================
# 4. ORM BASE
# ==========================================
Base = declarative_base()

# ==========================================
# 5. DEPENDENCY INJECTION
# ==========================================
def get_db():
    """
    Creates a secure database session for the API request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
