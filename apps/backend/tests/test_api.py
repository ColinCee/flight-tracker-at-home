from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_aircraft_returns_empty_stub():
    response = client.get("/aircraft")
    assert response.status_code == 200
    data = response.json()
    assert data["aircraft"] == []
    assert data["kpis"]["apiHealth"] == "green"
