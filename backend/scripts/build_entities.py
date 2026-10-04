"""Build Pendar's canonical cross-vertical entity registry.

The existing data/entities.json is intentionally left alone: the news/trends UI
still uses it as a compact index of entities found in the current story feed.
This script builds data/entity-registry.json as the durable knowledge-graph
identity layer across figures, books, press, movies and Pendar knowledge data.

Matching is conservative: records merge only on an exact normalized primary name
or alias. Stable upstream slugs/handles are retained as route references, while
one canonical Pendar entity id is selected per identity.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SUPPORTED_TYPES = [
    "person", "organization", "source", "publisher",
    "book", "movie", "topic", "place",
]

PERSIAN_TRANSLATE = str.maketrans({
    "ي": "ی", "ى": "ی", "ك": "ک", "ۀ": "ه", "ة": "ه",
    "\u200c": " ", "\u200f": "", "\u200e": "", "ـ": "",
})


def norm(value: Any) -> str:
    s = str(value or "").translate(PERSIAN_TRANSLATE).lower().strip()
    s = re.sub(r"[«»“”\"'‘’()\[\]{}،,:;؛!?؟/\\|+_=*~^%$#@]+", " ", s)
    return " ".join(s.split())


def safe_key(value: Any) -> str:
    s = norm(value)
    s = re.sub(r"[^\w\-\u0600-\u06ff]+", "-", s, flags=re.UNICODE)
    s = re.sub(r"-+", "-", s).strip("-")
    return s[:100]


def hash_key(value: Any) -> str:
    return hashlib.sha1(norm(value).encode("utf-8")).hexdigest()[:12]


def read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return default


def as_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def aliases_from(value: Any) -> list[str]:
    if isinstance(value, list):
        rows = value
    elif isinstance(value, str):
        rows = re.split(r"[؛;|]", value)
    else:
        rows = []
    out = []
    seen = set()
    for row in rows:
        s = str(row or "").strip()
        n = norm(s)
        if s and n and n not in seen:
            seen.add(n)
            out.append(s)
    return out


class Registry:
    def __init__(self) -> None:
        self.entities: dict[str, dict] = {}
        self.alias_index: dict[str, dict[str, str]] = {t: {} for t in SUPPORTED_TYPES}
        self.edges: list[dict] = []
        self._edge_keys: set[tuple] = set()
        self.conflicts: list[dict] = []
        self.ambiguous_aliases: list[dict] = []
        self._blocked_aliases: dict[str, set[str]] = {t: set() for t in SUPPORTED_TYPES}

    def _new_id(self, kind: str, preferred: str | None, name: str) -> str:
        base = safe_key(preferred) if preferred else ""
        if not base:
            base = hash_key(name)
        candidate = f"{kind}:{base}"
        if candidate not in self.entities:
            return candidate
        if norm(self.entities[candidate].get("name_fa")) == norm(name):
            return candidate
        return f"{kind}:{base}-{hash_key(name)[:6]}"

    def _candidate(self, kind: str, names: list[str]) -> str | None:
        found = {
            self.alias_index[kind].get(norm(x))
            for x in names if norm(x)
        }
        found.discard(None)
        if len(found) == 1:
            return next(iter(found))
        if len(found) > 1:
            self.conflicts.append({
                "type": kind,
                "reason": "aliases_resolve_to_multiple_entities",
                "names": names,
                "entity_ids": sorted(found),
            })
        return None

    def add(
        self,
        kind: str,
        name: str,
        *,
        preferred: str | None = None,
        aliases: list[str] | None = None,
        roles: list[str] | None = None,
        ref: dict | None = None,
        route: tuple[str, str] | None = None,
        meta: dict | None = None,
        merge_by_alias: bool = True,
    ) -> str | None:
        if kind not in self.alias_index:
            return None
        name = str(name or "").strip()
        if not norm(name):
            return None
        alias_rows = aliases_from(aliases or [])
        names = [name] + alias_rows
        preferred_id = f"{kind}:{safe_key(preferred)}" if preferred and safe_key(preferred) else None
        eid = self._candidate(kind, names) if merge_by_alias else None
        if eid is None:
            if preferred_id and preferred_id in self.entities:
                eid = preferred_id
            else:
                eid = self._new_id(kind, preferred, name)
        ent = self.entities.setdefault(eid, {
            "id": eid,
            "type": kind,
            "name_fa": name,
            "aliases": [],
            "roles": [],
            "refs": [],
            "routes": {},
            "meta": {},
        })

        # Prefer a Persian-script primary label over a Latin-only one.
        old_name = str(ent.get("name_fa") or "")
        if not re.search(r"[\u0600-\u06ff]", old_name) and re.search(r"[\u0600-\u06ff]", name):
            if old_name and norm(old_name) != norm(name):
                ent["aliases"].append(old_name)
            ent["name_fa"] = name

        for alias in [name] + alias_rows:
            n = norm(alias)
            if not n:
                continue
            if n in self._blocked_aliases[kind]:
                continue
            owner = self.alias_index[kind].get(n)
            if owner and owner != eid:
                if not merge_by_alias:
                    self.alias_index[kind].pop(n, None)
                    self._blocked_aliases[kind].add(n)
                    self.ambiguous_aliases.append({
                        "type": kind,
                        "alias": alias,
                        "entity_ids": sorted({owner, eid}),
                    })
                else:
                    self.conflicts.append({
                        "type": kind,
                        "reason": "alias_collision",
                        "alias": alias,
                        "entity_ids": sorted({owner, eid}),
                    })
                continue
            self.alias_index[kind][n] = eid
            if norm(alias) != norm(ent["name_fa"]) and all(norm(x) != n for x in ent["aliases"]):
                ent["aliases"].append(alias)

        for role in roles or []:
            role = str(role or "").strip()
            if role and role not in ent["roles"]:
                ent["roles"].append(role)
        if ref and ref not in ent["refs"]:
            ent["refs"].append(ref)
        if route:
            key, value = route
            if value and key not in ent["routes"]:
                ent["routes"][key] = value
        if meta:
            for key, value in meta.items():
                if value not in (None, "", [], {}) and key not in ent["meta"]:
                    ent["meta"][key] = value
        return eid

    def edge(self, src: str | None, rel: str, dst: str | None, **meta: Any) -> None:
        if not src or not dst or src == dst:
            return
        clean = {k: v for k, v in meta.items() if v not in (None, "", [], {})}
        key = (src, rel, dst, json.dumps(clean, ensure_ascii=False, sort_keys=True))
        if key in self._edge_keys:
            return
        self._edge_keys.add(key)
        row = {"from": src, "rel": rel, "to": dst}
        if clean:
            row["meta"] = clean
        self.edges.append(row)


def add_current_figures(reg: Registry, data: dict) -> None:
    for row in as_list(data.get("figures") if isinstance(data, dict) else []):
        handle = str(row.get("handle") or "").strip()
        name = row.get("name_fa") or handle
        roles = ["figure"]
        if row.get("role_fa"):
            roles.append(str(row["role_fa"]))
        aliases = aliases_from(row.get("aliases"))
        eid = reg.add(
            "person", name, preferred=handle or None, aliases=aliases, roles=roles,
            ref={"dataset": "figures", "key": handle or name},
            route=("figure", handle) if handle else None,
            meta={
                "role_fa": row.get("role_fa"),
                "field_fa": row.get("field_fa"),
                "avatar": row.get("avatar"),
                "statement_count": row.get("count"),
            },
        )
        # Social/channel identifiers can be useful aliases for resolution but
        # should not replace the human-readable name.
        if eid and handle:
            reg.entities[eid]["meta"].setdefault("handle", handle)


def add_knowledge_people(reg: Registry, rows: list[dict], dataset: str, route_key: str) -> None:
    for row in rows:
        rid = str(row.get("id") or "").strip()
        name = row.get("title") or row.get("name_fa") or rid
        roles = ["knowledge_person"]
        if row.get("field"):
            roles.append(str(row["field"]))
        aliases = aliases_from(row.get("aliases"))
        eid = reg.add(
            "person", name, preferred=rid or None, aliases=aliases, roles=roles,
            ref={"dataset": dataset, "key": rid or name},
            route=(route_key, rid) if rid else None,
            meta={
                "summary": row.get("summary"),
                "place": row.get("place"),
                "life": row.get("life"),
                "image": (row.get("image") or {}).get("path") if isinstance(row.get("image"), dict) else None,
            },
        )
        for topic in as_list(row.get("topicIds")):
            tid = reg.add("topic", str(topic), preferred=str(topic), ref={"dataset": dataset, "key": str(topic)})
            reg.edge(eid, "related_topic", tid)


def add_topics(reg: Registry, data_dir: Path) -> None:
    for row in as_list(read_json(data_dir / "topics.json", [])):
        reg.add(
            "topic", row.get("name_fa") or row.get("slug") or row.get("id"),
            preferred=row.get("slug") or row.get("id"),
            aliases=[row.get("name_en")] if row.get("name_en") else [],
            ref={"dataset": "topics", "key": row.get("slug") or row.get("id")},
            route=("topic", row.get("slug")) if row.get("slug") else None,
        )
    for row in as_list(read_json(data_dir / "pendar-topics.json", [])):
        rid = row.get("id") or row.get("slug")
        reg.add(
            "topic", row.get("title") or row.get("name_fa") or rid,
            preferred=rid,
            aliases=aliases_from(row.get("aliases")),
            ref={"dataset": "pendar-topics", "key": rid},
            route=("knowledge_topic", rid) if rid else None,
            meta={"summary": row.get("summary")},
        )


def add_organizations(reg: Registry, data_dir: Path) -> None:
    for row in as_list(read_json(data_dir / "pendar-organizations.json", [])):
        rid = row.get("id") or row.get("slug")
        oid = reg.add(
            "organization", row.get("title") or row.get("name_fa") or rid,
            preferred=rid,
            aliases=aliases_from(row.get("aliases")),
            roles=[row.get("category") or row.get("kind") or "organization"],
            ref={"dataset": "pendar-organizations", "key": rid},
            route=("knowledge_organization", rid) if rid else None,
            meta={"summary": row.get("summary"), "place": row.get("place")},
        )
        for topic in as_list(row.get("topicIds")):
            tid = reg.add("topic", str(topic), preferred=str(topic), ref={"dataset": "pendar-organizations", "key": str(topic)})
            reg.edge(oid, "related_topic", tid)


def add_books(reg: Registry, data: dict) -> None:
    people_by_slug: dict[str, str] = {}
    for person in as_list(data.get("people") if isinstance(data, dict) else []):
        slug = str(person.get("slug") or "").strip()
        eid = reg.add(
            "person", person.get("name_fa") or slug, preferred=slug or None,
            roles=["book_person"] + [str(x) for x in as_list(person.get("roles_fa"))],
            ref={"dataset": "books.people", "key": slug or person.get("name_fa")},
            route=("book_person", slug) if slug else None,
            meta={"book_count": len(as_list(person.get("book_slugs")))},
        )
        if slug and eid:
            people_by_slug[slug] = eid

    publishers: dict[str, str] = {}
    for pub in as_list(data.get("publishers") if isinstance(data, dict) else []):
        slug = str(pub.get("slug") or "").strip()
        eid = reg.add(
            "publisher", pub.get("name_fa") or slug, preferred=slug or None,
            roles=["publisher"],
            ref={"dataset": "books.publishers", "key": slug or pub.get("name_fa")},
            route=("publisher", slug) if slug else None,
            meta={"book_count": len(as_list(pub.get("book_slugs")))},
        )
        if slug and eid:
            publishers[slug] = eid

    for book in as_list(data.get("books") if isinstance(data, dict) else []):
        slug = str(book.get("slug") or "").strip()
        bid = reg.add(
            "book", book.get("title_fa") or book.get("original_title") or slug,
            preferred=slug or None,
            aliases=aliases_from(book.get("aliases")) + ([book.get("original_title")] if book.get("original_title") else []),
            roles=[book.get("record_type") or "book"],
            ref={"dataset": "books", "key": slug or book.get("title_fa")},
            route=("book", slug) if slug else None,
            meta={
                "category_fa": book.get("category_fa"),
                "language": book.get("language"),
                "cover_url": book.get("cover_url"),
                "mention_count": book.get("mention_count"),
            },
            merge_by_alias=False,
        )
        for creator in as_list(book.get("creators")):
            pslug = str(creator.get("slug") or "").strip()
            pid = people_by_slug.get(pslug)
            if not pid:
                pid = reg.add(
                    "person", creator.get("name_fa") or pslug, preferred=pslug or None,
                    roles=["book_person", str(creator.get("role_fa") or "creator")],
                    ref={"dataset": "books.creator", "key": pslug or creator.get("name_fa")},
                    route=("book_person", pslug) if pslug else None,
                )
            reg.edge(bid, "created_by", pid, role_fa=creator.get("role_fa"))

        pub_rows = []
        if isinstance(book.get("publisher"), dict):
            pub_rows.append(book["publisher"])
        for edition in as_list(book.get("editions")):
            if isinstance(edition, dict) and isinstance(edition.get("publisher"), dict):
                pub_rows.append(edition["publisher"])
        for pub in pub_rows:
            pslug = str(pub.get("slug") or "").strip()
            pid = publishers.get(pslug)
            if not pid:
                pid = reg.add(
                    "publisher", pub.get("name_fa") or pslug, preferred=pslug or None,
                    roles=["publisher"], ref={"dataset": "books.publisher", "key": pslug or pub.get("name_fa")},
                    route=("publisher", pslug) if pslug else None,
                )
            reg.edge(bid, "published_by", pid)

        for topic in as_list(book.get("topic_ids")):
            tid = reg.add("topic", str(topic), preferred=str(topic), ref={"dataset": "books.topic", "key": str(topic)})
            reg.edge(bid, "about_topic", tid)


def split_director_names(value: Any) -> list[str]:
    if isinstance(value, dict):
        value = value.get("name_fa") or value.get("name_en") or ""
    s = str(value or "").strip()
    if not s:
        return []
    if " و " in s:
        parts = [x.strip() for x in s.split(" و ") if len(x.strip()) > 2]
        if 1 < len(parts) <= 4:
            return parts
    return [s]


def add_movies(reg: Registry, data: dict) -> None:
    for movie in as_list(data.get("movies") if isinstance(data, dict) else []):
        slug = str(movie.get("slug") or "").strip()
        mid = reg.add(
            "movie", movie.get("title_fa") or movie.get("original_title") or slug,
            preferred=slug or None,
            aliases=aliases_from(movie.get("aliases")) + ([movie.get("original_title")] if movie.get("original_title") else []),
            roles=[movie.get("type") or "movie"],
            ref={"dataset": "movies", "key": slug or movie.get("title_fa")},
            route=("movie", slug) if slug else None,
            meta={
                "year": movie.get("year"),
                "country_fa": movie.get("country_fa"),
                "poster_url": movie.get("poster_url"),
                "mention_count": movie.get("mention_count"),
            },
            merge_by_alias=False,
        )
        for name in split_director_names(movie.get("director")):
            pid = reg.add(
                "person", name, roles=["director"],
                ref={"dataset": "movies.director", "key": name},
            )
            reg.edge(mid, "directed_by", pid)
        for name in as_list(movie.get("cast")):
            pid = reg.add(
                "person", str(name), roles=["actor"],
                ref={"dataset": "movies.cast", "key": str(name)},
            )
            reg.edge(mid, "cast_member", pid)


def add_press_sources(reg: Registry, data_dir: Path) -> None:
    rows = as_list(read_json(data_dir / "press-directory.json", []))
    health = as_list(read_json(data_dir / "press-registry-health.json", []))
    by_name: dict[str, dict] = {}
    for row in rows + health:
        name = row.get("source_name") or row.get("name_fa") or row.get("name")
        if not name:
            continue
        key = norm(name)
        merged = by_name.setdefault(key, {"source_name": name})
        for k, v in row.items():
            if v not in (None, "", [], {}) and k not in merged:
                merged[k] = v
    for row in by_name.values():
        name = row["source_name"]
        reg.add(
            "source", name, preferred=row.get("slug") or f"src-{hash_key(name)}",
            aliases=aliases_from(row.get("aliases")),
            roles=["press_source"],
            ref={"dataset": "press-directory", "key": name},
            route=("press_source", name),
            meta={
                "count": row.get("count"),
                "latest_at": row.get("latest_at"),
                "state": row.get("state"),
                "method": row.get("method"),
            },
        )


def compact(reg: Registry) -> dict:
    # Drop empty containers to keep the public artifact reasonably small.
    entities = []
    for ent in reg.entities.values():
        row = dict(ent)
        for key in ("aliases", "roles", "refs"):
            if not row.get(key):
                row.pop(key, None)
            else:
                row[key] = sorted(
                    row[key],
                    key=lambda x: json.dumps(x, ensure_ascii=False, sort_keys=True) if isinstance(x, dict) else str(x),
                )
        if not row.get("routes"):
            row.pop("routes", None)
        if not row.get("meta"):
            row.pop("meta", None)
        entities.append(row)
    entities.sort(key=lambda x: (SUPPORTED_TYPES.index(x["type"]), norm(x.get("name_fa"))))

    counts = {t: 0 for t in SUPPORTED_TYPES}
    for row in entities:
        counts[row["type"]] += 1
    counts["total"] = len(entities)

    alias_index = {
        t: dict(sorted(rows.items()))
        for t, rows in reg.alias_index.items()
        if rows
    }
    return {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "supported_types": SUPPORTED_TYPES,
        "counts": counts,
        "entities": entities,
        "edges": sorted(reg.edges, key=lambda x: (x["from"], x["rel"], x["to"])),
        "alias_index": alias_index,
        "conflicts": reg.conflicts,
        "ambiguous_aliases": reg.ambiguous_aliases,
    }


def build(data_dir: Path) -> dict:
    reg = Registry()
    add_current_figures(reg, read_json(data_dir / "figures.json", {}))
    add_knowledge_people(reg, as_list(read_json(data_dir / "pendar-people.json", [])), "pendar-people", "knowledge_person")
    add_knowledge_people(reg, as_list(read_json(data_dir / "pendar-figures.json", [])), "pendar-figures", "knowledge_figure")
    add_topics(reg, data_dir)
    add_organizations(reg, data_dir)
    add_books(reg, read_json(data_dir / "books.json", {}))
    add_movies(reg, read_json(data_dir / "movies.json", {}))
    add_press_sources(reg, data_dir)
    return compact(reg)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--data-dir", type=Path, default=Path("public/data"))
    p.add_argument("--output", type=Path)
    args = p.parse_args()
    out = args.output or (args.data_dir / "entity-registry.json")
    result = build(args.data_dir)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    c = result["counts"]
    print(
        "entity registry: "
        + ", ".join(f"{k}={v}" for k, v in c.items())
        + f", edges={len(result['edges'])}, conflicts={len(result['conflicts'])}"
        + f", ambiguous_aliases={len(result['ambiguous_aliases'])}"
    )
    if c["person"] < 1 or c["book"] < 1 or c["source"] < 1:
        raise SystemExit("entity registry is unexpectedly sparse")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
