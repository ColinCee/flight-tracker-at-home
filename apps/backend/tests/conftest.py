import pytest


@pytest.fixture(autouse=True)
def isolated_heatmap_db(tmp_path, monkeypatch):
    """Ensure every test uses an isolated DuckDB parquet file."""
    db_path = tmp_path / "historical_heatmap.parquet"
    monkeypatch.setenv("HEATMAP_DB_PATH", str(db_path))
    # Also patch the imported constant in spatial_snapshot and main
    monkeypatch.setattr("src.spatial_snapshot.DB_PATH", str(db_path))
    monkeypatch.setattr("src.main.DB_PATH", str(db_path))

    # Expose the path to the test if it needs it (tests can use the env var or this file)
    return str(db_path)
