from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.config import settings

Base = declarative_base()


def _build_engine():
    db_url = settings.DATABASE_URL
    engine_kwargs = {"echo": settings.DATABASE_ECHO, "pool_pre_ping": True}

    if db_url.startswith("postgres"):
        try:
            import psycopg2  # noqa: F401
        except Exception as exc:  # pragma: no cover - environment-specific
            print(f"PostgreSQL driver unavailable, falling back to SQLite. Details: {exc}")
            db_url = "sqlite:///./niyamcheck.db"

    return create_engine(db_url, **engine_kwargs)


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Create all registered database tables if they do not already exist."""
    Base.metadata.create_all(bind=engine)
