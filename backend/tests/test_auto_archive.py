"""
Tests for the Auto-Pulizia Schede feature (iteration_2).

Covers:
- POST /api/schede/auto-archive (auth, 60-day threshold, idempotency, response shape)
- GET /api/schede?archived=false|true|all (filters + legacy docs)
- PUT /api/schede/{code}/archive toggles + timestamp + auth
- Public GET /api/schede/{code} 404 when archived
- Auth requirement on the two host-only endpoints

Old schede are inserted directly via pymongo (same MONGO_URL / DB_NAME
as the backend) so the checkin timestamp / created_at can be back-dated.
All test data is prefixed TEST_AA_ and cleaned up in teardown.
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient

# Load backend + frontend envs
load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
HOST_PASSWORD = "gymhost2026"

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def host_headers(http):
    r = http.post(f"{API}/host/verify", json={"password": HOST_PASSWORD})
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


def _mk_scheda_doc(code, name, client_name, created_at, archived=False):
    now = datetime.now(timezone.utc)
    return {
        "id": str(uuid.uuid4()),
        "code": code,
        "name": name,
        "client_name": client_name,
        "sessions": [],
        "paid_month": None,
        "archived": archived,
        "archived_at": None,
        "created_at": created_at,
        "updated_at": now,
    }


@pytest.fixture(scope="module")
def seeded(mongo):
    """
    Seed 4 schede:
      OLD_NO_CI      – created 120 days ago, no check-ins        → must auto-archive
      OLD_STALE_CI   – has a check-in 90 days ago                → must auto-archive
      FRESH_CI       – has a check-in 5 days ago                 → must NOT archive
      LEGACY_NO_FLD  – created 10 days ago, NO `archived` field  → must NOT archive
    """
    now = datetime.now(timezone.utc)
    codes = {
        "old_no_ci":    f"TAA{uuid.uuid4().hex[:3].upper()}",
        "old_stale":    f"TAA{uuid.uuid4().hex[:3].upper()}",
        "fresh":        f"TAA{uuid.uuid4().hex[:3].upper()}",
        "legacy":       f"TAA{uuid.uuid4().hex[:3].upper()}",
    }
    # Insert schede
    mongo.schede.insert_one(_mk_scheda_doc(codes["old_no_ci"], "TEST_AA_OldNoCI",
                                           "TEST_AA_Client1",
                                           created_at=now - timedelta(days=120)))
    mongo.schede.insert_one(_mk_scheda_doc(codes["old_stale"], "TEST_AA_OldStaleCI",
                                           "TEST_AA_Client2",
                                           created_at=now - timedelta(days=200)))
    mongo.schede.insert_one(_mk_scheda_doc(codes["fresh"], "TEST_AA_FreshCI",
                                           "TEST_AA_Client3",
                                           created_at=now - timedelta(days=200)))
    # Legacy document: no `archived` field at all
    legacy_doc = _mk_scheda_doc(codes["legacy"], "TEST_AA_Legacy",
                                "TEST_AA_Client4",
                                created_at=now - timedelta(days=10))
    legacy_doc.pop("archived", None)
    legacy_doc.pop("archived_at", None)
    mongo.schede.insert_one(legacy_doc)

    # Check-ins
    mongo.checkins.insert_one({
        "id": str(uuid.uuid4()),
        "code": codes["old_stale"],
        "session_id": None, "session_name": None,
        "timestamp": now - timedelta(days=90),
    })
    mongo.checkins.insert_one({
        "id": str(uuid.uuid4()),
        "code": codes["fresh"],
        "session_id": None, "session_name": None,
        "timestamp": now - timedelta(days=5),
    })

    yield codes

    # Cleanup
    all_codes = list(codes.values())
    mongo.schede.delete_many({"code": {"$in": all_codes}})
    mongo.checkins.delete_many({"code": {"$in": all_codes}})


# ---------- Auth requirement ----------
class TestAuthRequired:
    def test_auto_archive_requires_auth(self, http):
        r = http.post(f"{API}/schede/auto-archive", json={"days": 60})
        assert r.status_code == 401

    def test_archive_toggle_requires_auth(self, http, seeded):
        r = http.put(f"{API}/schede/{seeded['fresh']}/archive",
                     json={"archived": True})
        assert r.status_code == 401

    def test_list_schede_requires_auth(self, http):
        r = http.get(f"{API}/schede", params={"archived": "true"})
        assert r.status_code == 401


# ---------- Auto-archive core ----------
class TestAutoArchive:
    def test_auto_archive_60d_behaviour(self, http, host_headers, seeded, mongo):
        r = http.post(f"{API}/schede/auto-archive",
                      json={"days": 60}, headers=host_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(data.keys()) >= {"archived_codes", "count", "days"}
        assert data["days"] == 60
        assert isinstance(data["archived_codes"], list)
        assert isinstance(data["count"], int)
        assert data["count"] == len(data["archived_codes"])

        archived = set(data["archived_codes"])
        # Must include the two stale test schede
        assert seeded["old_no_ci"] in archived, \
            f"OLD_NO_CI ({seeded['old_no_ci']}) should have been archived"
        assert seeded["old_stale"] in archived, \
            f"OLD_STALE ({seeded['old_stale']}) should have been archived"
        # Must NOT include fresh nor legacy-recent
        assert seeded["fresh"] not in archived, \
            "FRESH_CI must not be archived (checkin 5 days ago)"
        assert seeded["legacy"] not in archived, \
            "LEGACY_NO_FLD created 10 days ago must not be archived"

        # DB state matches
        for c in (seeded["old_no_ci"], seeded["old_stale"]):
            d = mongo.schede.find_one({"code": c})
            assert d["archived"] is True
            assert d["archived_at"] is not None
        assert mongo.schede.find_one({"code": seeded["fresh"]}).get("archived") in (False, None)

    def test_auto_archive_idempotent(self, http, host_headers, seeded):
        # Second call must archive 0 (all already archived)
        r = http.post(f"{API}/schede/auto-archive",
                      json={"days": 60}, headers=host_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 0
        assert data["archived_codes"] == []

    def test_auto_archive_days_clamped_upper(self, http, host_headers):
        # Upper-bound clamp: values > 365 must be clamped to 365
        r = http.post(f"{API}/schede/auto-archive",
                      json={"days": 5000}, headers=host_headers)
        assert r.status_code == 200
        assert r.json()["days"] == 365

    def test_auto_archive_zero_defaults_to_60(self, http, host_headers):
        # NOTE: server uses `int(payload.days or 60)` so days=0 (falsy) becomes 60,
        # not clamped to 1. Behaviour is safe (no archive drift) but the code's
        # min=1 clamp is unreachable via `days=0`. Documented for main agent.
        r = http.post(f"{API}/schede/auto-archive",
                      json={"days": 0}, headers=host_headers)
        assert r.status_code == 200
        assert r.json()["days"] == 60


# ---------- Listing filters ----------
class TestSchedeListing:
    def test_list_archived_true_contains_seeded(self, http, host_headers, seeded):
        r = http.get(f"{API}/schede",
                     params={"archived": "true"}, headers=host_headers)
        assert r.status_code == 200
        codes = {x["code"] for x in r.json()}
        assert seeded["old_no_ci"] in codes
        assert seeded["old_stale"] in codes
        assert seeded["fresh"] not in codes
        assert seeded["legacy"] not in codes

    def test_list_archived_false_default_excludes_archived(self, http, host_headers, seeded):
        # Default (no param)
        r = http.get(f"{API}/schede", headers=host_headers)
        assert r.status_code == 200
        codes = {x["code"] for x in r.json()}
        assert seeded["old_no_ci"] not in codes
        assert seeded["old_stale"] not in codes
        assert seeded["fresh"] in codes
        # Legacy doc (missing `archived` field) MUST be treated as active
        assert seeded["legacy"] in codes, \
            "Legacy doc without `archived` field must be listed as active"

    def test_list_archived_all_returns_both(self, http, host_headers, seeded):
        r = http.get(f"{API}/schede",
                     params={"archived": "all"}, headers=host_headers)
        assert r.status_code == 200
        codes = {x["code"] for x in r.json()}
        for k in ("old_no_ci", "old_stale", "fresh", "legacy"):
            assert seeded[k] in codes


# ---------- Public GET blocks archived ----------
class TestPublicGetArchived:
    def test_public_get_archived_returns_404(self, http, seeded):
        # No auth (public client endpoint)
        r = http.get(f"{API}/schede/{seeded['old_no_ci']}")
        assert r.status_code == 404, \
            f"Archived scheda must be invisible to client (got {r.status_code})"

    def test_public_get_active_ok(self, http, seeded):
        r = http.get(f"{API}/schede/{seeded['fresh']}")
        assert r.status_code == 200
        assert r.json()["code"] == seeded["fresh"]

    def test_public_get_legacy_ok(self, http, seeded):
        # Legacy doc missing `archived` field must still be readable
        r = http.get(f"{API}/schede/{seeded['legacy']}")
        assert r.status_code == 200
        assert r.json()["code"] == seeded["legacy"]


# ---------- PUT archive toggle ----------
class TestArchiveToggle:
    def test_toggle_archive_true_then_false(self, http, host_headers, seeded, mongo):
        code = seeded["fresh"]
        # Archive it
        r = http.put(f"{API}/schede/{code}/archive",
                     json={"archived": True}, headers=host_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["code"] == code
        assert body["archived"] is True
        assert body.get("archived_at")
        # Public GET now 404
        assert http.get(f"{API}/schede/{code}").status_code == 404
        # DB state
        assert mongo.schede.find_one({"code": code})["archived"] is True

        # Restore
        r = http.put(f"{API}/schede/{code}/archive",
                     json={"archived": False}, headers=host_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["archived"] is False
        assert body["archived_at"] is None
        # Public GET works again
        assert http.get(f"{API}/schede/{code}").status_code == 200

    def test_toggle_archive_unknown_code_404(self, http, host_headers):
        r = http.put(f"{API}/schede/999999/archive",
                     json={"archived": True}, headers=host_headers)
        assert r.status_code == 404
