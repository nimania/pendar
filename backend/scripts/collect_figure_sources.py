"""Refresh configured figure feeds without running the general news pipeline."""
from sqlalchemy import select

from app.db.session import SessionLocal
from app.figures import FIGURE_REGION
from app.figure_posts import classify_figure_posts
from app.ingestion.service import ingest_source
from app.models.source import Source


def collect():
    with SessionLocal() as db:
        sources = db.execute(select(Source).where(
            Source.enabled.is_(True), Source.region == FIGURE_REGION
        )).scalars().all()
        results = [ingest_source(db, source) for source in sources]
        report = {
            "sources": len(sources),
            "fetched": sum(row.fetched for row in results),
            "new": sum(row.new for row in results),
            "errors": sum(row.errors for row in results),
            "classification": classify_figure_posts(db),
        }
        print("Independent figure feeds:", report, flush=True)
        if sources and all(row.status == "error" for row in results):
            raise RuntimeError("All configured figure feeds failed; preserve prior published data")
        return report


if __name__ == "__main__":
    collect()
