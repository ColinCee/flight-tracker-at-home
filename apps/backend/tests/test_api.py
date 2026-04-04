from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_aircraft_returns_mock_data():
    response = client.get("/aircraft")
    assert response.status_code == 200
    data = response.json()
    assert len(data["aircraft"]) > 0
    assert data["kpis"]["apiHealth"] == "green"
    assert data["kpis"]["trackedAircraft"] == len(data["aircraft"])
    # Verify at least one aircraft is approaching LHR
    assert any(a["isApproachingLhr"] for a in data["aircraft"])
