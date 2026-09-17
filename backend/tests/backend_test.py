"""GymCode backend API tests."""
import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created_scheda(api_client):
    payload = {
        "name": "TEST_Scheda",
        "client_name": "TEST_Client",
        "sessions": [
            {"name": "Giorno A - Push", "exercises": [
                {"name": "Panca Piana", "sets": 4, "reps": "8-10", "weight": "60kg", "rest_seconds": 90, "notes": ""}
            ]}
        ],
    }
    r = api_client.post(f"{API}/schede", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    yield data
    api_client.delete(f"{API}/schede/{data['code']}")


# --- Root
def test_root(api_client):
    r = api_client.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("message") == "GymCode API"


# --- Schede CRUD
class TestSchede:
    def test_create_scheda_unique_6digit(self, created_scheda):
        assert "code" in created_scheda
        assert len(created_scheda["code"]) == 6
        assert created_scheda["code"].isdigit()
        assert created_scheda["name"] == "TEST_Scheda"
        assert created_scheda["client_name"] == "TEST_Client"
        assert len(created_scheda["sessions"]) == 1

    def test_list_schede(self, api_client, created_scheda):
        r = api_client.get(f"{API}/schede")
        assert r.status_code == 200
        codes = [s["code"] for s in r.json()]
        assert created_scheda["code"] in codes

    def test_get_scheda_by_code(self, api_client, created_scheda):
        r = api_client.get(f"{API}/schede/{created_scheda['code']}")
        assert r.status_code == 200
        assert r.json()["code"] == created_scheda["code"]

    def test_get_scheda_404(self, api_client):
        r = api_client.get(f"{API}/schede/000000")
        assert r.status_code == 404

    def test_update_scheda(self, api_client, created_scheda):
        r = api_client.put(f"{API}/schede/{created_scheda['code']}",
                           json={"name": "TEST_Updated", "client_name": "TEST_Client2"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Updated"
        # verify persistence
        r2 = api_client.get(f"{API}/schede/{created_scheda['code']}")
        assert r2.json()["client_name"] == "TEST_Client2"

    def test_update_scheda_404(self, api_client):
        r = api_client.put(f"{API}/schede/999999", json={"name": "X"})
        assert r.status_code == 404


# --- Checkins
class TestCheckins:
    def test_checkin_invalid_code_returns_404(self, api_client):
        r = api_client.post(f"{API}/checkins", json={"code": "000000"})
        assert r.status_code == 404

    def test_create_checkin_valid(self, api_client, created_scheda):
        r = api_client.post(f"{API}/checkins", json={
            "code": created_scheda["code"], "session_name": "Giorno A - Push"
        })
        assert r.status_code == 200
        d = r.json()
        assert d["code"] == created_scheda["code"]
        assert "timestamp" in d and "id" in d

    def test_checkin_stats_structure(self, api_client, created_scheda):
        r = api_client.get(f"{API}/checkins/{created_scheda['code']}/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ("week", "month", "year", "total", "weekly_history"):
            assert k in d
        assert d["total"] >= 1
        assert d["week"] >= 1
        assert isinstance(d["weekly_history"], list)
        assert len(d["weekly_history"]) == 12


# --- Exercises
class TestExercises:
    def test_seed_exercises(self, api_client):
        r = api_client.get(f"{API}/exercises")
        assert r.status_code == 200
        exs = r.json()
        assert len(exs) >= 15
        names = [e["name"] for e in exs]
        assert "Squat" in names
        assert "Panca Piana" in names

    def test_create_and_delete_exercise(self, api_client):
        r = api_client.post(f"{API}/exercises", json={
            "name": "TEST_Ex", "muscle_group": "TEST", "description": "TEST desc"
        })
        assert r.status_code == 200
        ex = r.json()
        eid = ex["id"]

        # verify shows up
        rl = api_client.get(f"{API}/exercises")
        assert eid in [e["id"] for e in rl.json()]

        # delete
        rd = api_client.delete(f"{API}/exercises/{eid}")
        assert rd.status_code == 200

        # verify gone
        rl2 = api_client.get(f"{API}/exercises")
        assert eid not in [e["id"] for e in rl2.json()]

    def test_delete_exercise_404(self, api_client):
        r = api_client.delete(f"{API}/exercises/does-not-exist")
        assert r.status_code == 404


# --- Cleanup: delete scheda (also removes checkins)
class TestSchedaDelete:
    def test_delete_scheda_and_checkins(self, api_client):
        # create fresh one to fully test delete flow
        r = api_client.post(f"{API}/schede", json={
            "name": "TEST_ToDelete", "client_name": "TEST_C", "sessions": []
        })
        code = r.json()["code"]
        api_client.post(f"{API}/checkins", json={"code": code})

        rd = api_client.delete(f"{API}/schede/{code}")
        assert rd.status_code == 200

        r404 = api_client.get(f"{API}/schede/{code}")
        assert r404.status_code == 404

        # stats endpoint still returns zeros
        rs = api_client.get(f"{API}/checkins/{code}/stats")
        assert rs.status_code == 200
        assert rs.json()["total"] == 0

    def test_delete_scheda_404(self, api_client):
        r = api_client.delete(f"{API}/schede/999999")
        assert r.status_code == 404
