"""Authentication: email/password (opaque session tokens) + Emergent Google OAuth.

Both flows mint an opaque `session_token` stored server-side in `user_sessions`
and validated on every request via the `get_current_user` dependency.
"""
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import httpx
from fastapi import APIRouter, Header, HTTPException

from db import db
from models import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    SessionRequest,
    User,
    UserPublic,
    now_iso,
)

EMERGENT_SESSION_DATA_URL = (
    "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
)
SESSION_TTL_DAYS = 7

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------- helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


async def create_session(user_id: str, session_token: str | None = None) -> str:
    token = session_token or secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)
    await db.user_sessions.insert_one(
        {
            "session_token": token,
            "user_id": user_id,
            "created_at": now_iso(),
            "expires_at": expires_at,
        }
    )
    return token


async def get_current_user(authorization: str | None = Header(default=None)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session.get("expires_at")
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            await db.user_sessions.delete_one({"session_token": token})
            raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


# ---------- endpoints ----------
@auth_router.post("/register", response_model=AuthResponse)
async def register(payload: RegisterRequest):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=payload.email.lower(),
        name=payload.name or payload.email.split("@")[0],
        auth_provider="email",
    )
    doc = user.model_dump()
    doc["password_hash"] = hash_password(payload.password)
    await db.users.insert_one(doc)

    token = await create_session(user.user_id)
    return AuthResponse(session_token=token, user=UserPublic(**user.model_dump()))


@auth_router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    user_doc = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if not user_doc or not user_doc.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(payload.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = User(**{k: v for k, v in user_doc.items() if k != "password_hash"})
    token = await create_session(user.user_id)
    return AuthResponse(session_token=token, user=UserPublic(**user.model_dump()))


@auth_router.post("/session", response_model=AuthResponse)
async def google_session(payload: SessionRequest):
    """Exchange a one-time Emergent session_id for a stored session_token."""
    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.get(
            EMERGENT_SESSION_DATA_URL,
            headers={"X-Session-ID": payload.session_id},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    data = resp.json()
    email = (data.get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=401, detail="No email in session data")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user = User(**{k: v for k, v in existing.items() if k != "password_hash"})
    else:
        user = User(
            email=email,
            name=data.get("name") or email.split("@")[0],
            picture=data.get("picture") or "",
            auth_provider="google",
        )
        await db.users.insert_one(user.model_dump())

    token = await create_session(user.user_id, session_token=data.get("session_token"))
    return AuthResponse(session_token=token, user=UserPublic(**user.model_dump()))


@auth_router.get("/me", response_model=UserPublic)
async def me(authorization: str | None = Header(default=None)):
    user = await get_current_user(authorization)
    return UserPublic(**user.model_dump())


@auth_router.post("/logout")
async def logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"success": True}
