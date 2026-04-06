import os

import duckdb
import h3
import pandas as pd


def snapshot_to_parquet(aircraft_list):
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

    df = pd.DataFrame(binned_data)

    # 2. Aggregate the data (Group by Hexagon)
    aggregated = (  # noqa: F841
        df.groupby("hex_id")
        .agg(total_volume=("count", "sum"), avg_altitude=("altitude", "mean"))
        .reset_index()
    )

    # 3. Save to Parquet using DuckDB
    file_path = "historical_heatmap.parquet"

    if os.path.exists(file_path):
        # Merge existing data with new snapshot
        duckdb.sql(f"""
            COPY (
                SELECT * FROM '{file_path}'
                UNION ALL
                SELECT * FROM aggregated
            ) TO '{file_path}' (FORMAT PARQUET)
        """)
    else:
        # Create the file for the first time
        duckdb.sql(f"COPY aggregated TO '{file_path}' (FORMAT PARQUET)")
