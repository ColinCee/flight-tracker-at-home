import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent
OUTPUT_PATH = BACKEND_ROOT.parents[1] / "apps/frontend/openapi.json"


def main() -> None:
    sys.path.insert(0, str(BACKEND_ROOT))

    from src.main import app

    OUTPUT_PATH.write_text(json.dumps(app.openapi(), indent=2) + "\n")


if __name__ == "__main__":
    main()
