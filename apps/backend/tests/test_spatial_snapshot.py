import os
import shutil
import tempfile

import duckdb
import h3
import pytest
from src.models import AircraftState
from src.spatial_snapshot import snapshot_to_parquet


def create_mock_aircraft(
    icao24: str,
    latitude: float,
    longitude: float,
    baro_altitude_ft: int | None,
    on_ground: bool = False,
) -> AircraftState:
    """Create a mock AircraftState for testing."""
    return AircraftState(
        icao24=icao24,
        callsign=f"TEST{icao24}",
        registration=f"G-{icao24}",
        aircraft_type="A320",
        category="Heavy",
        last_contact=0,
        latitude=latitude,
        longitude=longitude,
        baro_altitude_ft=baro_altitude_ft,
        geo_altitude_ft=baro_altitude_ft,
        ground_speed_kts=150.0,
        true_track=90.0,
        vertical_rate_fpm=-500,
        on_ground=on_ground,
        squawk=None,
        position_source="ADS-B",
        is_climbing=False,
        is_descending=True,
        destination="LHR",
    )


class TestSnapshotToParquet:
    """Tests for the snapshot_to_parquet function."""

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        """Create a temporary directory for test files and clean up after."""
        self.original_cwd = os.getcwd()
        self.temp_dir = tempfile.mkdtemp()
        os.chdir(self.temp_dir)
        yield
        os.chdir(self.original_cwd)
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _read_parquet(self):
        """Helper to read parquet using duckdb directly."""
        con = duckdb.connect()
        try:
            return con.sql("SELECT * FROM 'historical_heatmap.parquet'").fetchdf()
        finally:
            con.close()

    def test_snapshot_creates_parquet_file(self):
        """Test that snapshot_to_parquet creates a parquet file."""
        aircraft_list = [
            create_mock_aircraft("111111", 51.47, -0.50, 2000),
            create_mock_aircraft("222222", 51.48, -0.51, 3000),
        ]

        snapshot_to_parquet(aircraft_list)

        assert os.path.exists("historical_heatmap.parquet")

    def test_snapshot_appends_to_existing_file(self):
        """Test that subsequent snapshots append to the existing parquet file."""
        aircraft_list_1 = [
            create_mock_aircraft("111111", 51.47, -0.50, 2000),
        ]
        aircraft_list_2 = [
            create_mock_aircraft("222222", 51.48, -0.51, 3000),
        ]

        snapshot_to_parquet(aircraft_list_1)
        snapshot_to_parquet(aircraft_list_2)

        df = self._read_parquet()
        assert len(df) == 2

    def test_snapshot_aggregates_by_hexagon(self):
        """Test that aircraft in the same hexagon are aggregated."""
        lat, lon = 51.47, -0.50
        hex_id = h3.latlng_to_cell(lat, lon, 8)

        aircraft_list = [
            create_mock_aircraft("111111", lat, lon, 2000),
            create_mock_aircraft("222222", lat, lon, 4000),
        ]

        snapshot_to_parquet(aircraft_list)

        df = self._read_parquet()
        assert len(df) == 1
        assert df.iloc[0]["hex_id"] == hex_id
        assert df.iloc[0]["total_volume"] == 2
        assert df.iloc[0]["avg_altitude"] == 3000

    def test_snapshot_calculates_avg_altitude(self):
        """Test that average altitude is calculated correctly across snapshots."""
        lat, lon = 51.47, -0.50

        snapshot_to_parquet([create_mock_aircraft("111111", lat, lon, 1000)])
        snapshot_to_parquet([create_mock_aircraft("222222", lat, lon, 3000)])

        con = duckdb.connect()
        try:
            df = con.sql(
                "SELECT hex_id, SUM(total_volume) as total_volume, AVG(avg_altitude) as avg_altitude FROM 'historical_heatmap.parquet' GROUP BY hex_id"
            ).fetchdf()
        finally:
            con.close()

        row = df.iloc[0]
        assert row["total_volume"] == 2
        assert row["avg_altitude"] == 2000

    def test_snapshot_skips_on_ground_aircraft(self):
        """Test that aircraft on the ground are not included in snapshots."""
        aircraft_list = [
            create_mock_aircraft("111111", 51.47, -0.50, 0, on_ground=True),
            create_mock_aircraft("222222", 51.48, -0.51, 2000),
        ]

        snapshot_to_parquet(aircraft_list)

        df = self._read_parquet()
        assert len(df) == 1

    def test_snapshot_skips_missing_latitude(self):
        """Test that aircraft with missing latitude are not included."""
        aircraft = create_mock_aircraft("111111", 51.47, -0.50, 2000)
        aircraft.latitude = None

        snapshot_to_parquet([aircraft])

        assert not os.path.exists("historical_heatmap.parquet")

    def test_snapshot_skips_missing_longitude(self):
        """Test that aircraft with missing longitude are not included."""
        aircraft = create_mock_aircraft("111111", 51.47, -0.50, 2000)
        aircraft.longitude = None

        snapshot_to_parquet([aircraft])

        assert not os.path.exists("historical_heatmap.parquet")

    def test_snapshot_uses_resolution_8_h3(self):
        """Test that H3 resolution 8 is used for binning."""
        lat, lon = 51.47, -0.50
        expected_hex = h3.latlng_to_cell(lat, lon, 8)

        snapshot_to_parquet([create_mock_aircraft("111111", lat, lon, 2000)])

        df = self._read_parquet()
        assert df.iloc[0]["hex_id"] == expected_hex

    def test_snapshot_handles_null_altitude(self):
        """Test that null altitude falls back to 0."""
        lat, lon = 51.47, -0.50

        aircraft = create_mock_aircraft("111111", lat, lon, None)

        snapshot_to_parquet([aircraft])

        df = self._read_parquet()
        assert df.iloc[0]["avg_altitude"] == 0

    def test_snapshot_empty_list_does_nothing(self):
        """Test that empty aircraft list does not create a file."""
        snapshot_to_parquet([])

        assert not os.path.exists("historical_heatmap.parquet")

    def test_snapshot_all_on_ground_does_nothing(self):
        """Test that all on-ground aircraft result in no file."""
        aircraft_list = [
            create_mock_aircraft("111111", 51.47, -0.50, 0, on_ground=True),
            create_mock_aircraft("222222", 51.48, -0.51, 0, on_ground=True),
        ]

        snapshot_to_parquet(aircraft_list)

        assert not os.path.exists("historical_heatmap.parquet")

    def test_snapshot_multiple_hexagons(self):
        """Test that different hexagons are tracked separately."""
        aircraft_list = [
            create_mock_aircraft("111111", 51.47, -0.50, 2000),
            create_mock_aircraft("222222", 52.00, 0.50, 3000),
        ]

        snapshot_to_parquet(aircraft_list)

        df = self._read_parquet()
        assert len(df) == 2

    def test_snapshot_parquet_schema(self):
        """Test that the parquet file has the expected columns."""
        aircraft_list = [
            create_mock_aircraft("111111", 51.47, -0.50, 2000),
        ]

        snapshot_to_parquet(aircraft_list)

        df = self._read_parquet()
        assert list(df.columns) == ["hex_id", "total_volume", "avg_altitude"]
