"""Every line the server writes is one JSON object with its level (src/log_config.json): the homelab's
log store reads `level`, `logger` and `msg`, and its eBPF tracer adds the request's `trace_id` to it."""

import json
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).parent.parent

# A fresh process, configured as `uvicorn --log-config` configures the server.
LOG = """
import logging
from uvicorn.config import Config
Config("src.main:app", log_config="src/log_config.json")
logging.getLogger("uvicorn.access").info(
    '%s - "%s %s HTTP/%s" %d', "10.0.0.1:5000", "GET", "/aircraft", "1.1", 200
)
logging.getLogger("uvicorn.error").info(
    "Started server process [%d]", 7, extra={"color_message": "\\x1b[36m%d\\x1b[0m"}
)
logging.getLogger("src.cache").warning("Airplanes.live fetch failed")
logging.getLogger("httpx").info("HTTP Request: GET https://example.test")
try:
    1 / 0
except ZeroDivisionError:
    logging.getLogger("src.main").exception("Unexpected error in ETL pipeline")
"""


def test_uvicorn_and_app_lines_are_json_with_their_level() -> None:
    run = subprocess.run(
        [sys.executable, "-c", LOG],
        cwd=BACKEND,
        capture_output=True,
        text=True,
        check=True,
        timeout=60,
    )
    assert run.stderr == ""
    lines = [json.loads(line) for line in run.stdout.splitlines()]
    # httpx's line per upstream call is left out.
    assert [(line["level"], line["logger"]) for line in lines] == [
        ("INFO", "uvicorn.access"),
        ("INFO", "uvicorn.error"),
        ("WARNING", "src.cache"),
        ("ERROR", "src.main"),
    ]
    assert lines[0]["msg"] == '10.0.0.1:5000 - "GET /aircraft HTTP/1.1" 200'
    assert "color_message" not in lines[1]
    assert "ZeroDivisionError" in lines[3]["exc_info"]
    assert all("time" in line for line in lines)
