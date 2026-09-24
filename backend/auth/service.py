from sqlalchemy.orm import Session

from backend.auth.models import User, UserRole
from backend.auth.schemas import RegisterRequest
from backend.auth.security import hash_password, verify_password


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, data: RegisterRequest) -> User:
    existing_user = get_user_by_email(db, data.email)

    if existing_user:
        raise ValueError("A user with this email already exists.")

    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        role=UserRole.CONSUMER,
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """Authenticate a user using email and password."""
    user = get_user_by_email(db, email)

    if not user:
        return None

    if not user.is_active:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user