"""Generate a snapshot of aircraft every 60 seconds. This data will be stored using duckdb in a parquet file.
It is used to represent the heatmap data for the frontend of where aircraft travel and altitude data.
Each write keeps rows from the previous calendar day onward, so the file holds 1-2 days.
"""

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
    """Append one snapshot. Raises duckdb.Error or OSError; the caller logs them."""
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

    # 3. Save to Parquet using DuckDB. Write a temp file and swap it in, so a
    # crash mid-write cannot corrupt the history and /heatmap never reads a
    # half-written file.
    tmp_path = f"{DB_PATH}.tmp"
    con = duckdb.connect()
    try:
        con.execute(
            "CREATE TABLE aggregated (hex_id VARCHAR, total_volume BIGINT, avg_altitude DOUBLE)"
        )
        con.executemany("INSERT INTO aggregated VALUES (?, ?, ?)", data_to_insert)

        new_rows = (
            "SELECT *, CURRENT_TIMESTAMP::TIMESTAMP AS snapshot_time FROM aggregated"
        )
        # DB_PATH is a controlled constant, so f-string interpolation is safe here
        if os.path.exists(DB_PATH):
            res = con.execute(f"DESCRIBE SELECT * FROM '{DB_PATH}' LIMIT 1")
            cols = [row[0] for row in res.fetchall()]
            # Files from before snapshot_time existed are dropped, not merged.
            if "snapshot_time" in cols:
                new_rows = f"""
                    SELECT * FROM '{DB_PATH}'
                    WHERE snapshot_time >= CURRENT_DATE - INTERVAL 1 DAY
                    UNION ALL
                    {new_rows}
                """
        con.sql(f"COPY ({new_rows}) TO '{tmp_path}' (FORMAT PARQUET)")
    finally:
        # Close before the swap: on Windows an open handle on DB_PATH makes
        # os.replace fail, which also happens (losing that minute) if a
        # /heatmap read is in progress. Linux, where it runs, is unaffected.
        con.close()
    os.replace(tmp_path, DB_PATH)
