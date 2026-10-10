"""Refresh a static snapshot; preserve the previous board on an upstream outage."""
from pathlib import Path
import argparse
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.prices.nabzesh import fetch_snapshot


def refresh(output):
    output = Path(output)
    snapshot = fetch_snapshot()
    if not snapshot["rows"]:
        print("Nabzesh unavailable; preserving existing market snapshot.")
        return False
    # Partial quote outages preserve their last records with an explicit stale
    # flag. Do not let missing history from an older run masquerade as current.
    if output.exists():
        try:
            previous = json.loads(output.read_text(encoding="utf-8"))
            seen = {(r["ticker"], r["quote"]) for r in snapshot["rows"]}
            for old in previous.get("rows", []):
                if (old["ticker"], old["quote"]) not in seen:
                    old.update(is_stale=True, preserved=True)
                    snapshot["rows"].append(old)
        except (ValueError, KeyError, TypeError):
            pass
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, allow_nan=False,
                                    separators=(",", ":")), encoding="utf-8")
    temporary.replace(output)
    print(f"Saved {len(snapshot['rows'])} market rows; {len(snapshot['errors'])} unavailable fields.")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    refresh(args.output)
