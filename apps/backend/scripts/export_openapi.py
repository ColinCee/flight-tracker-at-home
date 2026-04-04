import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
OUTPUT_PATH = ROOT / "apps/frontend/openapi.json"
BACKEND_ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    sys.path.insert(0, str(BACKEND_ROOT))

    from src.main import app

    OUTPUT_PATH.write_text(json.dumps(app.openapi(), indent=2) + "\n")


if __name__ == "__main__":
    main()
