import os

import duckdb
import h3
from src.models import AircraftState

# Base directory for the backend app
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.environ.get(
    "HEATMAP_DB_PATH", os.path.join(BASE_DIR, "historical_heatmap.parquet")
)


def snapshot_to_parquet(aircraft_list: list[AircraftState]):
    try:
        # 1. Convert raw telemetry to Hex Bins
        binned_data = []
        for ac in aircraft_list:
            if ac.latitude and ac.longitude and not ac.on_ground:
                # Get the H3 index for this Lat/Lon at Resolution 8
                hex_id = h3.latlng_to_cell(ac.latitude, ac.longitude, 8)

                binned_data.append(
                    {
                        "hex_id": hex_id,
                        "altitude": ac.baro_altitude_ft or 0,  # Fallback to 0 if None
                        "count": 1,
                    }
                )

        # Safety check: Do nothing if no valid aircraft were found
        if not binned_data:
            return

        # 2. Aggregate the data (Group by Hexagon)
        # Pure Python aggregation to avoid pandas dependency
        aggregated_dict = {}
        for bin in binned_data:
            h = bin["hex_id"]
            if h not in aggregated_dict:
                aggregated_dict[h] = {"count": 0, "sum_alt": 0}
            aggregated_dict[h]["count"] += bin["count"]
            aggregated_dict[h]["sum_alt"] += bin["altitude"]

        data_to_insert = [
            (h, stats["count"], stats["sum_alt"] / stats["count"])
            for h, stats in aggregated_dict.items()
        ]

        # 3. Save to Parquet using DuckDB
        con = duckdb.connect()
        try:
            con.execute(
                "CREATE TABLE aggregated (hex_id VARCHAR, total_volume BIGINT, avg_altitude DOUBLE)"
            )
            con.executemany("INSERT INTO aggregated VALUES (?, ?, ?)", data_to_insert)

            if os.path.exists(DB_PATH):
                # Merge existing data with new snapshot
                # DB_PATH is a controlled constant, so f-string interpolation is safe here
                con.sql(f"""
                    COPY (
                        SELECT * FROM '{DB_PATH}'
                        UNION ALL
                        SELECT * FROM aggregated
                    ) TO '{DB_PATH}' (FORMAT PARQUET)
                """)
            else:
                # Create the file for the first time
                con.sql(f"COPY aggregated TO '{DB_PATH}' (FORMAT PARQUET)")
        finally:
            con.close()

    except (ValueError, KeyError) as e:
        # Handles cases where aircraft data might have missing expected keys or malformed values
        print(f"Data transformation error: {e}")
    except duckdb.Error as e:
        print(f"Database error writing to Parquet: {e}")
