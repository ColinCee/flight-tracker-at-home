"""Integration tests for the heatmap endpoint and ETL pipeline."""

import os
import shutil
import tempfile
from unittest.mock import patch

import duckdb
import h3
import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)


class TestHeatmapEndpoint:
    """Tests for the /heatmap endpoint."""

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        """Create a temporary directory for test files and clean up after."""
        self.original_cwd = os.getcwd()
        self.temp_dir = tempfile.mkdtemp()
        os.chdir(self.temp_dir)
        yield
        os.chdir(self.original_cwd)
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _create_parquet_file(self, data: list[dict]):
        """Helper to create a parquet file with test data."""
        con = duckdb.connect()
        try:
            for i, row in enumerate(data):
                if i == 0:
                    con.sql(
                        f"CREATE TABLE test_data AS SELECT '{row['hex_id']}' as hex_id, {row['total_volume']} as total_volume, {row['avg_altitude']} as avg_altitude"
                    )
                else:
                    con.sql(
                        f"INSERT INTO test_data VALUES ('{row['hex_id']}', {row['total_volume']}, {row['avg_altitude']})"
                    )
            con.sql("COPY test_data TO 'historical_heatmap.parquet' (FORMAT PARQUET)")
        finally:
            con.close()

    def test_heatmap_returns_empty_list_when_no_file(self):
        """Test that /heatmap returns empty array when no parquet file exists."""
        response = client.get("/heatmap")
        assert response.status_code == 200
        assert response.json() == []

    def test_heatmap_returns_aggregated_data(self):
        """Test that /heatmap returns aggregated hexagon data from parquet."""
        lat, lon = 51.47, -0.50
        hex_id = h3.latlng_to_cell(lat, lon, 8)

        self._create_parquet_file(
            [{"hex_id": hex_id, "total_volume": 5, "avg_altitude": 3000}]
        )

        response = client.get("/heatmap")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["hex_id"] == hex_id
        assert data[0]["total_volume"] == 5
        assert data[0]["avg_altitude"] == 3000

    def test_heatmap_returns_snake_case(self):
        """Test that response uses snake_case field names (same as parquet)."""
        lat, lon = 51.47, -0.50
        hex_id = h3.latlng_to_cell(lat, lon, 8)

        self._create_parquet_file(
            [{"hex_id": hex_id, "total_volume": 1, "avg_altitude": 1000}]
        )

        response = client.get("/heatmap")
        data = response.json()

        assert len(data) > 0
        keys = set(data[0].keys())
        assert "hex_id" in keys
        assert "total_volume" in keys
        assert "avg_altitude" in keys
        assert "hexId" not in keys
        assert "totalVolume" not in keys

    def test_heatmap_returns_multiple_hexagons(self):
        """Test that multiple different hexagons are all returned."""
        hex1 = h3.latlng_to_cell(51.47, -0.50, 8)
        hex2 = h3.latlng_to_cell(52.00, 0.50, 8)

        self._create_parquet_file(
            [
                {"hex_id": hex1, "total_volume": 1, "avg_altitude": 2000},
                {"hex_id": hex2, "total_volume": 2, "avg_altitude": 3000},
            ]
        )

        response = client.get("/heatmap")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


class TestHeatmapEndpointEdgeCases:
    """Edge case tests for the /heatmap endpoint."""

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        """Create a temporary directory for test files and clean up after."""
        self.original_cwd = os.getcwd()
        self.temp_dir = tempfile.mkdtemp()
        os.chdir(self.temp_dir)
        yield
        os.chdir(self.original_cwd)
        shutil.rmtree(self.temp_dir, ignore_errors=True)


class TestETLPipeline:
    """Tests for the ETL pipeline integration."""

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        """Create a temporary directory for test files and clean up after."""
        self.original_cwd = os.getcwd()
        self.temp_dir = tempfile.mkdtemp()
        os.chdir(self.temp_dir)
        yield
        os.chdir(self.original_cwd)
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    @pytest.mark.asyncio
    @patch("src.airplanes_live.fetch_london_airspace")
    async def test_snapshot_captured_in_heatmap(self, mock_fetch):
        """Test that aircraft data captured by the cache appears in heatmap."""
        from src.spatial_snapshot import snapshot_to_parquet

        mock_fetch.return_value = [
            {
                "hex": "400a5b",
                "flight": "BAW123  ",
                "lat": 51.47,
                "lon": -0.50,
                "alt_baro": 2000,
                "gs": 150.0,
                "track": 90.0,
                "baro_rate": -500,
                "squawk": "1234",
                "type": "adsb_icao",
                "category": "A5",
            },
        ]

        from src.cache import airspace_cache

        airspace_cache.cached_response = None
        airspace_cache.last_update = 0.0

        state = await airspace_cache.get_state()

        assert len(state.aircraft) == 1
        assert state.aircraft[0].icao24 == "400a5b"

        aircraft_list = [state.aircraft[0].model_copy()]
        snapshot_to_parquet(aircraft_list)

        assert os.path.exists("historical_heatmap.parquet")

        con = duckdb.connect()
        try:
            df = con.sql("SELECT * FROM 'historical_heatmap.parquet'").fetchdf()
        finally:
            con.close()

        assert len(df) == 1
        assert df.iloc[0]["total_volume"] == 1


class TestSnapshotToParquetWithCache:
    """Tests for snapshot_to_parquet with real AircraftState objects."""

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        """Create a temporary directory for test files and clean up after."""
        self.original_cwd = os.getcwd()
        self.temp_dir = tempfile.mkdtemp()
        os.chdir(self.temp_dir)
        yield
        os.chdir(self.original_cwd)
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_snapshot_with_lhr_approach_aircraft(self):
        """Test snapshot with realistic LHR approach data."""
        from src.models import AircraftState
        from src.spatial_snapshot import snapshot_to_parquet

        aircraft = AircraftState(
            icao24="400a5b",
            callsign="BAW123",
            registration="G-EUAA",
            aircraft_type="A320",
            category="Heavy",
            latitude=51.47,
            longitude=-0.50,
            baro_altitude_ft=2000,
            geo_altitude_ft=2050,
            ground_speed_kts=140.0,
            true_track=92.0,
            vertical_rate_fpm=-700,
            on_ground=False,
            squawk=None,
            last_contact=0,
            position_source="ADS-B",
            is_climbing=False,
            is_descending=True,
            destination="LHR",
        )

        snapshot_to_parquet([aircraft])

        assert os.path.exists("historical_heatmap.parquet")

        con = duckdb.connect()
        try:
            df = con.sql("SELECT * FROM 'historical_heatmap.parquet'").fetchdf()
        finally:
            con.close()

        assert len(df) == 1
        assert df.iloc[0]["total_volume"] == 1
        assert df.iloc[0]["avg_altitude"] == 2000
