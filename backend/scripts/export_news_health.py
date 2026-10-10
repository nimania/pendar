"""Export measurable AI/news health for the Pendar system dashboard."""
import json
import os
import sqlite3
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

db_path = Path(os.environ.get("NEWS_DB_PATH", "backend/build.db"))
output = Path(os.environ.get("NEWS_HEALTH_OUT", "backend/public/data/news-health.json"))
now = datetime.now(timezone.utc)
since = (now - timedelta(hours=24)).replace(tzinfo=None).isoformat()
report = {"generated_at": now.isoformat(), "window_hours": 24, "status": "unknown",
          "ai": {"success": 0, "provider_errors": 0, "validation_errors": 0,
                 "quota_errors": 0, "models": {}, "latest_success": None},
          "news": {"published_24h": 0, "latest_published": None},
          "note": "Counts describe recorded AI calls, not API billing usage."}
if db_path.is_file():
    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    try:
        rows = con.execute(
            "SELECT status, model, message, created_at FROM usage_logs "
            "WHERE stage='synthesis' AND created_at >= ?", (since,)
        ).fetchall()
        models = Counter()
        for row in rows:
            status = row["status"]
            if status == "ok":
                report["ai"]["success"] += 1
                models[row["model"] or "unknown"] += 1
                t = str(row["created_at"] or "")
                if t and (report["ai"]["latest_success"] is None or t > report["ai"]["latest_success"]):
                    report["ai"]["latest_success"] = t
            elif status == "provider_error":
                report["ai"]["provider_errors"] += 1
                msg = str(row["message"] or "").lower()
                if any(word in msg for word in ("429", "resource_exhausted", "quota", "rate limit")):
                    report["ai"]["quota_errors"] += 1
            elif status == "validation_error":
                report["ai"]["validation_errors"] += 1
        report["ai"]["models"] = dict(models)
        row = con.execute(
            "SELECT COUNT(*) AS n, MAX(published_at) AS latest FROM stories "
            "WHERE status='published' AND published_at >= ?", (since,)
        ).fetchone()
        report["news"]["published_24h"] = row["n"]
        report["news"]["latest_published"] = row["latest"]
        report["status"] = "warning" if report["ai"]["quota_errors"] else "ok"
    except sqlite3.Error as exc:
        report["status"] = "unknown"
        report["note"] = "Metrics unavailable: " + str(exc)[:120]
    finally:
        con.close()
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print("News health:", report["status"], report["ai"], report["news"])
