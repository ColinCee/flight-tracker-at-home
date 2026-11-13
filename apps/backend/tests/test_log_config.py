"""Every line the server writes is one JSON object with its level (src/log_config.json): the homelab's
log store reads `level`, `logger` and `msg`, and its eBPF tracer adds the request's `trace_id` to it."""

import json
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).parent.parent

# uvicorn applies its own config first, then this one, as the server does on start.
LOG = """
import logging
from uvicorn.config import Config
Config("src.main:app", log_config="src/log_config.json")
logging.getLogger("uvicorn.access").info(
    '%s - "%s %s HTTP/%s" %d', "10.0.0.1:5000", "GET", "/aircraft", "1.1", 200
)
logging.getLogger("uvicorn.error").info("Application startup complete.")
logging.getLogger("src.cache").warning("Airplanes.live fetch failed")
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
    assert [(line["level"], line["logger"]) for line in lines] == [
        ("INFO", "uvicorn.access"),
        ("INFO", "uvicorn.error"),
        ("WARNING", "src.cache"),
    ]
    assert lines[0]["msg"] == '10.0.0.1:5000 - "GET /aircraft HTTP/1.1" 200'
    assert all("time" in line for line in lines)
