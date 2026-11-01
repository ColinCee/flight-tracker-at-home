"""Tests for /heatmap/hourly."""

import os
from datetime import datetime, timedelta
from unittest.mock import patch

import duckdb
import h3
import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

HEX_A = h3.latlng_to_cell(51.47, -0.50, 8)
HEX_A2 = h3.latlng_to_cell(51.4705, -0.5005, 8)  # same resolution-7 parent as A
HEX_B = h3.latlng_to_cell(51.60, -0.10, 8)


def write_snapshots(rows: list[tuple[str, int, datetime]]):
    """rows: (hex_id, total_volume, snapshot_time), naive local time."""
    con = duckdb.connect()
    try:
        con.execute(
            "CREATE TABLE t (hex_id VARCHAR, total_volume BIGINT, avg_altitude DOUBLE, snapshot_time TIMESTAMP)"
        )
        con.executemany(
            "INSERT INTO t VALUES (?, ?, 5000, ?)",
            rows,
        )
        con.sql(f"COPY t TO '{os.environ['HEATMAP_DB_PATH']}' (FORMAT PARQUET)")
    finally:
        con.close()


@pytest.fixture(autouse=True)
def clear_cache(monkeypatch):
    monkeypatch.setattr("src.main._hourly_cache", None)


def this_hour() -> datetime:
    return datetime.now().replace(minute=0, second=0, microsecond=0)


def test_no_history_gives_24_empty_hours():
    data = client.get("/heatmap/hourly").json()
    assert data["resolution"] == 7
    assert data["cells"] == []
    assert len(data["hours"]) == 24
    assert all(h["snapshots"] == 0 and h["aircraft"] == 0 for h in data["hours"])
    # Oldest first, ending with the hour before the current one.
    last = datetime.fromisoformat(data["hours"][-1]["start"])
    assert last == (this_hour() - timedelta(hours=1)).astimezone()


def test_counts_land_in_their_hour_and_parent_cell():
    assert h3.cell_to_parent(HEX_A, 7) == h3.cell_to_parent(HEX_A2, 7)
    hour = this_hour() - timedelta(hours=3)  # index 21
    write_snapshots(
        [
            (HEX_A, 2, hour + timedelta(minutes=1)),
            (HEX_A2, 1, hour + timedelta(minutes=1)),
            (HEX_B, 1, hour + timedelta(minutes=1)),
            (HEX_A, 4, hour + timedelta(minutes=2)),
            # Outside the window: the current hour and older than 24 h.
            (HEX_A, 9, this_hour() + timedelta(seconds=1)),
            (HEX_A, 9, this_hour() - timedelta(hours=25)),
        ]
    )
    response = client.get("/heatmap/hourly")
    assert response.headers["cache-control"] == "public, max-age=60"
    data = response.json()

    cells = {c["hexId"]: c["counts"] for c in data["cells"]}
    parent_a = h3.cell_to_parent(HEX_A, 7)
    assert cells[parent_a][21] == 7
    assert sum(cells[parent_a]) == 7
    assert cells[h3.cell_to_parent(HEX_B, 7)][21] == 1

    h = data["hours"][21]
    assert h["snapshots"] == 2
    assert h["aircraft"] == 4.0  # 8 aircraft-minutes over 2 snapshots
    assert datetime.fromisoformat(h["start"]) == hour.astimezone()
    assert sum(x["snapshots"] for x in data["hours"]) == 2


def test_cached_until_file_changes():
    hour = this_hour() - timedelta(hours=1)
    write_snapshots([(HEX_A, 1, hour)])
    first = client.get("/heatmap/hourly").json()

    with patch("src.main.duckdb.connect", side_effect=AssertionError):
        assert client.get("/heatmap/hourly").json() == first

    write_snapshots([(HEX_A, 1, hour), (HEX_B, 1, hour)])
    assert len(client.get("/heatmap/hourly").json()["cells"]) == 2


def test_unreadable_file_gives_empty_answer_without_caching():
    with open(os.environ["HEATMAP_DB_PATH"], "w") as f:
        f.write("not parquet")
    response = client.get("/heatmap/hourly")
    assert response.status_code == 200
    assert response.json()["cells"] == []
    assert "cache-control" not in response.headers
