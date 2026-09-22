"""GymCode backend API tests — SEC-001 JWT auth + regression."""
import os
import time
import pytest
import requests
import jwt
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from pathlib import Path

# Load public backend URL and JWT_SECRET (needed to forge tokens for negative tests)
load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
HOST_PASSWORD = "gymhost2026"
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def host_token(api_client):
    """Fetch a valid host JWT once for the whole module."""
    r = api_client.post(f"{API}/host/verify", json={"password": HOST_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("verified") is True
    assert data.get("token_type") == "bearer"
    assert "access_token" in data and isinstance(data["access_token"], str)
    # 7 days in seconds
    assert data.get("expires_in") == 7 * 24 * 60 * 60
    return data["access_token"]


@pytest.fixture(scope="module")
def auth_headers(host_token):
    return {"Authorization": f"Bearer {host_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_scheda(api_client, auth_headers):
    payload = {
        "name": "TEST_Scheda",
        "client_name": "TEST_Client",
        "sessions": [
            {"name": "Giorno A - Push", "exercises": [
                {"name": "Panca Piana", "sets": 4, "reps": "8-10",
                 "weight": "60kg", "rest_seconds": 90, "notes": ""}
            ]}
        ],
    }
    r = api_client.post(f"{API}/schede", json=payload, headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    yield data
    api_client.delete(f"{API}/schede/{data['code']}", headers=auth_headers)


# ---------- Helpers ----------
def _forge(payload_overrides: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": "host",
        "role": "host",
        "iat": now,
        "exp": now + timedelta(days=1),
    }
    payload.update(payload_overrides)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


# ---------- Root ----------
def test_root(api_client):
    r = api_client.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("message") == "GymCode API"


# ---------- SEC-001: /host/verify ----------
class TestHostVerify:
    def test_verify_with_correct_password(self, host_token):
        # host_token fixture already asserted structure; ensure it parses
        payload = jwt.decode(host_token, JWT_SECRET, algorithms=[JWT_ALG])
        assert payload["sub"] == "host"
        assert payload["role"] == "host"
        assert "exp" in payload and "iat" in payload

    def test_verify_with_wrong_password_returns_401(self, api_client):
        r = api_client.post(f"{API}/host/verify",
                            json={"password": "definitely-wrong-xyz"})
        assert r.status_code == 401
        body = r.json()
        # no token must be leaked
        assert "access_token" not in body


# ---------- SEC-001: host-only endpoints WITHOUT auth ----------
class TestHostEndpointsRequireAuth:
    """Every host-only endpoint must return 401 without Authorization header."""

    def test_get_schede_no_auth(self, api_client):
        assert api_client.get(f"{API}/schede").status_code == 401

    def test_post_schede_no_auth(self, api_client):
        r = api_client.post(f"{API}/schede",
                            json={"name": "x", "client_name": "y", "sessions": []})
        assert r.status_code == 401

    def test_put_schede_no_auth(self, api_client):
        r = api_client.put(f"{API}/schede/000000", json={"name": "z"})
        assert r.status_code == 401

    def test_delete_schede_no_auth(self, api_client):
        assert api_client.delete(f"{API}/schede/000000").status_code == 401

    def test_put_schede_paid_no_auth(self, api_client):
        r = api_client.put(f"{API}/schede/000000/paid", json={"paid": True})
        assert r.status_code == 401

    def test_post_exercises_no_auth(self, api_client):
        r = api_client.post(f"{API}/exercises",
                            json={"name": "x", "muscle_group": "PETTO",
                                  "description": "d"})
        assert r.status_code == 401

    def test_delete_exercises_no_auth(self, api_client):
        assert api_client.delete(f"{API}/exercises/nope").status_code == 401

    def test_put_warmup_no_auth(self, api_client):
        r = api_client.put(f"{API}/warmup", json={"exercises": []})
        assert r.status_code == 401

    def test_delete_checkin_no_auth(self, api_client):
        assert api_client.delete(f"{API}/checkins/does-not-exist").status_code == 401


# ---------- SEC-001: host-only endpoints WITH valid bearer token ----------
class TestHostEndpointsWithValidToken:
    def test_list_schede_ok(self, api_client, auth_headers, created_scheda):
        r = api_client.get(f"{API}/schede", headers=auth_headers)
        assert r.status_code == 200
        codes = [s["code"] for s in r.json()]
        assert created_scheda["code"] in codes

    def test_update_scheda_ok(self, api_client, auth_headers, created_scheda):
        r = api_client.put(
            f"{API}/schede/{created_scheda['code']}",
            headers=auth_headers,
            json={"name": "TEST_Updated", "client_name": "TEST_Client2"},
        )
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Updated"
        # verify persistence via public endpoint (no auth needed)
        r2 = api_client.get(f"{API}/schede/{created_scheda['code']}")
        assert r2.json()["client_name"] == "TEST_Client2"

    def test_put_paid_ok(self, api_client, auth_headers, created_scheda):
        r = api_client.put(
            f"{API}/schede/{created_scheda['code']}/paid",
            headers=auth_headers,
            json={"paid": True},
        )
        assert r.status_code == 200
        assert r.json()["paid_month"] is not None
        # verify persisted
        r2 = api_client.get(f"{API}/schede/{created_scheda['code']}")
        assert r2.json()["paid_month"] is not None

    def test_create_delete_exercise_ok(self, api_client, auth_headers):
        r = api_client.post(f"{API}/exercises",
                            headers=auth_headers,
                            json={"name": "TEST_Ex", "muscle_group": "PETTO",
                                  "description": "TEST desc"})
        assert r.status_code == 200
        eid = r.json()["id"]
        rd = api_client.delete(f"{API}/exercises/{eid}", headers=auth_headers)
        assert rd.status_code == 200

    def test_put_warmup_ok(self, api_client, auth_headers):
        # Preserve current warmup, then re-put same list to ensure endpoint works
        cur = api_client.get(f"{API}/warmup").json()
        r = api_client.put(f"{API}/warmup",
                           headers=auth_headers,
                           json={"exercises": cur.get("exercises", [])})
        assert r.status_code == 200
        assert "exercises" in r.json()

    def test_delete_checkin_ok(self, api_client, auth_headers, created_scheda):
        # create checkin (public), then delete it (host-only)
        rc = api_client.post(f"{API}/checkins",
                             json={"code": created_scheda["code"],
                                   "session_name": "Giorno A - Push"})
        assert rc.status_code == 200
        cid = rc.json()["id"]
        rd = api_client.delete(f"{API}/checkins/{cid}", headers=auth_headers)
        assert rd.status_code == 200
        # verify gone
        rl = api_client.get(f"{API}/checkins/{created_scheda['code']}")
        assert cid not in [c["id"] for c in rl.json()]


# ---------- SEC-001: invalid / tampered / wrong-role tokens ----------
class TestInvalidTokens:
    def test_random_garbage_token(self, api_client):
        h = {"Authorization": "Bearer this.is.not.a.jwt",
             "Content-Type": "application/json"}
        assert api_client.get(f"{API}/schede", headers=h).status_code == 401

    def test_tampered_signature(self, api_client, host_token):
        tampered = host_token[:-4] + ("AAAA" if not host_token.endswith("AAAA") else "BBBB")
        h = {"Authorization": f"Bearer {tampered}",
             "Content-Type": "application/json"}
        assert api_client.get(f"{API}/schede", headers=h).status_code == 401

    def test_wrong_secret_signed_token(self, api_client):
        bad = jwt.encode(
            {"sub": "host", "role": "host",
             "iat": datetime.now(timezone.utc),
             "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            "wrong-secret-value-32bytes-min-x", algorithm=JWT_ALG,
        )
        h = {"Authorization": f"Bearer {bad}", "Content-Type": "application/json"}
        assert api_client.get(f"{API}/schede", headers=h).status_code == 401

    def test_expired_token(self, api_client):
        expired = _forge({
            "iat": datetime.now(timezone.utc) - timedelta(days=8),
            "exp": datetime.now(timezone.utc) - timedelta(days=1),
        })
        h = {"Authorization": f"Bearer {expired}", "Content-Type": "application/json"}
        assert api_client.get(f"{API}/schede", headers=h).status_code == 401

    def test_missing_role_claim(self, api_client):
        # Build a token WITHOUT the role claim — server requires it.
        now = datetime.now(timezone.utc)
        no_role = jwt.encode(
            {"sub": "host", "iat": now, "exp": now + timedelta(hours=1)},
            JWT_SECRET, algorithm=JWT_ALG,
        )
        h = {"Authorization": f"Bearer {no_role}", "Content-Type": "application/json"}
        assert api_client.get(f"{API}/schede", headers=h).status_code == 401

    def test_wrong_role_claim(self, api_client):
        wrong = _forge({"role": "admin"})
        h = {"Authorization": f"Bearer {wrong}", "Content-Type": "application/json"}
        assert api_client.get(f"{API}/schede", headers=h).status_code == 401

    def test_wrong_sub_claim(self, api_client):
        wrong = _forge({"sub": "someone_else"})
        h = {"Authorization": f"Bearer {wrong}", "Content-Type": "application/json"}
        assert api_client.get(f"{API}/schede", headers=h).status_code == 401

    def test_non_bearer_scheme(self, api_client):
        h = {"Authorization": "Basic dXNlcjpwYXNz",
             "Content-Type": "application/json"}
        assert api_client.get(f"{API}/schede", headers=h).status_code == 401


# ---------- SEC-001: PUBLIC endpoints must still work WITHOUT auth ----------
class TestPublicEndpointsNoAuth:
    def test_get_scheda_by_code(self, api_client, created_scheda):
        r = api_client.get(f"{API}/schede/{created_scheda['code']}")
        assert r.status_code == 200
        assert r.json()["code"] == created_scheda["code"]

    def test_post_checkin(self, api_client, created_scheda):
        r = api_client.post(f"{API}/checkins",
                            json={"code": created_scheda["code"],
                                  "session_name": "Giorno A - Push"})
        assert r.status_code == 200
        assert r.json()["code"] == created_scheda["code"]

    def test_get_checkins(self, api_client, created_scheda):
        r = api_client.get(f"{API}/checkins/{created_scheda['code']}")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_checkin_stats(self, api_client, created_scheda):
        r = api_client.get(f"{API}/checkins/{created_scheda['code']}/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ("week", "month", "year", "total", "weekly_history"):
            assert k in d

    def test_get_client_state(self, api_client, created_scheda):
        r = api_client.get(f"{API}/schede/{created_scheda['code']}/client-state")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_put_client_state(self, api_client, created_scheda):
        ex_id = created_scheda["sessions"][0]["exercises"][0]["id"]
        r = api_client.put(
            f"{API}/schede/{created_scheda['code']}/client-state/{ex_id}",
            json={"notes": "TEST note", "weight": "62.5kg", "reps": "8"},
        )
        assert r.status_code == 200
        assert r.json()["weight"] == "62.5kg"

    def test_get_client_state_history(self, api_client, created_scheda):
        ex_id = created_scheda["sessions"][0]["exercises"][0]["id"]
        r = api_client.get(
            f"{API}/schede/{created_scheda['code']}/client-state/{ex_id}/history"
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_warmup(self, api_client):
        r = api_client.get(f"{API}/warmup")
        assert r.status_code == 200
        assert "exercises" in r.json()

    def test_get_exercises(self, api_client):
        r = api_client.get(f"{API}/exercises")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 15

    def test_get_muscle_groups(self, api_client):
        r = api_client.get(f"{API}/muscle-groups")
        assert r.status_code == 200
        assert "groups" in r.json()


# ---------- Rate limit — MUST RUN LAST (consumes the 5-attempts window) ----------
class TestZRateLimit:
    """Uses 'Z' prefix to force alphabetical ordering after other tests.
    5 wrong attempts allowed per IP per minute; 6th returns 429."""

    def test_wrong_password_rate_limit_429(self, api_client):
        # Give server a fresh window: sleep a bit to reduce interference
        # (best effort — the window is 60s; other tests may have consumed some).
        # Wait full window to ensure clean slate.
        time.sleep(61)
        statuses = []
        for _ in range(5):
            r = api_client.post(f"{API}/host/verify",
                                json={"password": "wrong-pw"})
            statuses.append(r.status_code)
        # First 5 wrong attempts should all be 401
        assert all(s == 401 for s in statuses), f"expected 5x401, got {statuses}"
        # 6th within same window → 429
        r6 = api_client.post(f"{API}/host/verify",
                             json={"password": "wrong-pw"})
        assert r6.status_code == 429, (
            f"expected 429 on 6th attempt, got {r6.status_code}: {r6.text}")
