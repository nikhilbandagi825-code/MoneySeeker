"""Shared fixtures for MoneySeeker backend tests."""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to reading frontend .env directly if env var not set at runtime
    try:
        with open("/app/frontend/.env") as fp:
            for line in fp:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    break
    except Exception:
        pass

API = f"{BASE_URL}/api"

TEST_USER_EMAIL = "tester@moneyseeker.dev"
TEST_USER_PASSWORD = "Test@1234"


@pytest.fixture(scope="session")
def api_base():
    return API


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(session):
    """Login with the seeded tester user; skip suite if unavailable."""
    r = session.post(
        f"{API}/auth/login",
        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
    )
    if r.status_code != 200:
        pytest.skip(f"Test user login failed: {r.status_code} {r.text}")
    return r.json()["session_token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


@pytest.fixture
def unique_email():
    return f"test_{uuid.uuid4().hex[:10]}@moneyseeker.dev"
