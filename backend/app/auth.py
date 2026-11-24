"""Authentication module: Google OAuth ID token verification and JWT sessions."""
import os
import time
import logging
from pathlib import Path
from typing import Optional

import jwt
from dotenv import load_dotenv
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from fastapi import Depends, Header, HTTPException

from . import database as db

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)
load_dotenv()

log = logging.getLogger("analyzer.auth")

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_SECONDS = 7 * 24 * 3600  # 7 days


def get_jwt_secret() -> str:
    return os.getenv("JWT_SECRET", "truthlens-default-secret-key-change-in-env")


def get_google_client_id() -> Optional[str]:
    return os.getenv("GOOGLE_CLIENT_ID")


def verify_google_token(token: str) -> dict:
    """
    Verifies the Google ID token using Google's public certificates.
    Returns: dict with sub, email, name, picture.
    """
    client_id = get_google_client_id()
    if not client_id:
        raise HTTPException(500, "Google Client ID is not configured on the server.")

    try:
        request = google_requests.Request()
        idinfo = id_token.verify_oauth2_token(token, request, client_id)

        # Validate issuer
        if idinfo.get("iss") not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Invalid issuer.")

        return {
            "sub": idinfo["sub"],
            "email": idinfo.get("email"),
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
        }
    except ValueError as e:
        log.warning(f"Google ID token verification failed: {e}")
        raise HTTPException(401, "Invalid Google credential.")
    except Exception as e:
        log.exception(f"Unexpected error during token verification: {e}")
        raise HTTPException(401, "Google authentication failed. Please try again.")


def create_session_token(user_id: int) -> str:
    """Create a signed JWT session token for the user."""
    payload = {
        "user_id": user_id,
        "exp": int(time.time()) + JWT_EXPIRATION_SECONDS,
        "iat": int(time.time()),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_session_token(token: str) -> Optional[int]:
    """Decode a JWT session token and return user_id if valid."""
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        return payload.get("user_id")
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """
    FastAPI dependency: extracts the current user if a valid Bearer token is provided.
    Returns None if no token or invalid token, allowing anonymous access.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ", 1)[1].strip()
    user_id = decode_session_token(token)
    if not user_id:
        return None

    return db.get_user_by_id(user_id)


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    FastAPI dependency: requires a valid logged-in user.
    """
    user = get_optional_user(authorization)
    if not user:
        raise HTTPException(401, "Authentication required. Please sign in.")
    return user
