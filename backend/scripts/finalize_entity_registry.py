#!/usr/bin/env python3
"""Apply durable entity overrides and emit QA diagnostics for Pendar."""
from __future__ import annotations

import argparse
import difflib
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any


PERSIAN_TRANSLATE = str.maketrans({
    "ي": "ی", "ى": "ی", "ك": "ک", "ۀ": "ه", "ة": "ه",
    "\u200c": " ", "\u200f": "", "\u200e": "", "ـ": "",
})


def norm(value: Any) -> str:
    s = str(value or "").translate(PERSIAN_TRANSLATE).lower().strip()
    s = re.sub(r"[«»“”\"'‘’()\[\]{}،,:;؛!?؟/\\|+_=*~^%$#@]+", " ", s)
    return " ".join(s.split())


def read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return default


def uniq(seq: list[Any]) -> list[Any]:
    out = []
    seen = set()
    for item in seq:
        key = json.dumps(item, ensure_ascii=False, sort_keys=True) if isinstance(item, (dict, list)) else str(item)
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def pair_key(a: str, b: str) -> tuple[str, str]:
    return tuple(sorted((str(a), str(b))))


def resolve(mapping: dict[str, str], entity_id: str) -> str:
    seen = set()
    cur = entity_id
    while cur in mapping:
        if cur in seen:
            raise ValueError(f"merge cycle detected at {cur}")
        seen.add(cur)
        cur = mapping[cur]
    return cur


def merge_entity(dst: dict, src: dict) -> None:
    if norm(dst.get("name_fa")) != norm(src.get("name_fa")):
        dst.setdefault("aliases", []).append(src.get("name_fa"))
    dst["aliases"] = uniq([x for x in dst.get("aliases", []) + src.get("aliases", []) if x])
    dst["roles"] = uniq([x for x in dst.get("roles", []) + src.get("roles", []) if x])
    dst["refs"] = uniq(dst.get("refs", []) + src.get("refs", []))
    routes = dict(src.get("routes", {}))
    routes.update(dst.get("routes", {}))
    dst["routes"] = routes
    meta = dict(src.get("meta", {}))
    meta.update(dst.get("meta", {}))
    dst["meta"] = meta


def rebuild_alias_index(entities: list[dict]) -> tuple[dict, list[dict]]:
    owners: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    labels: dict[tuple[str, str], str] = {}
    for ent in entities:
        typ = str(ent.get("type") or "")
        for raw in [ent.get("name_fa"), *ent.get("aliases", [])]:
            n = norm(raw)
            if not n:
                continue
            owners[typ][n].add(ent["id"])
            labels[(typ, n)] = str(raw)
    index: dict[str, dict[str, str]] = {}
    ambiguous = []
    for typ, rows in owners.items():
        index[typ] = {}
        for n, ids in rows.items():
            if len(ids) == 1:
                index[typ][n] = next(iter(ids))
            else:
                ambiguous.append({
                    "type": typ,
                    "alias": labels.get((typ, n), n),
                    "entity_ids": sorted(ids),
                })
    ambiguous.sort(key=lambda x: (x["type"], norm(x["alias"])))
    return index, ambiguous


def duplicate_candidates(entities: list[dict], keep: set[tuple[str, str]], limit: int = 250) -> list[dict]:
    by_type: dict[str, list[dict]] = defaultdict(list)
    for ent in entities:
        if ent.get("type") in {"person", "organization", "source", "publisher", "book", "movie"}:
            by_type[ent["type"]].append(ent)

    pairs = set()
    out = []
    thresholds = {"person": .86, "organization": .88, "source": .86, "publisher": .87, "book": .92, "movie": .92}
    for typ, rows in by_type.items():
        buckets: dict[str, list[dict]] = defaultdict(list)
        for ent in rows:
            n = norm(ent.get("name_fa"))
            if not n:
                continue
            compact = n.replace(" ", "")
            last = n.split()[-1] if n.split() else n
            keys = {f"p:{compact[:3]}", f"l:{last[:4]}"}
            for key in keys:
                if len(key) >= 4:
                    buckets[key].append(ent)
        for bucket in buckets.values():
            if len(bucket) < 2 or len(bucket) > 80:
                continue
            for i in range(len(bucket)):
                for j in range(i + 1, len(bucket)):
                    a, b = bucket[i], bucket[j]
                    pk = pair_key(a["id"], b["id"])
                    if pk in pairs or pk in keep:
                        continue
                    pairs.add(pk)
                    na, nb = norm(a.get("name_fa")), norm(b.get("name_fa"))
                    if not na or not nb or na == nb:
                        score = 1.0
                    else:
                        score = difflib.SequenceMatcher(None, na, nb).ratio()
                    if score < thresholds.get(typ, .9):
                        continue
                    reason = "same_normalized_name" if na == nb else "similar_name"
                    out.append({
                        "type": typ,
                        "a": a["id"],
                        "b": b["id"],
                        "a_name": a.get("name_fa"),
                        "b_name": b.get("name_fa"),
                        "score": round(score, 3),
                        "reason": reason,
                    })
    out.sort(key=lambda x: (-x["score"], x["type"], norm(x["a_name"])))
    return out[:limit]


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--registry", required=True, type=Path)
    p.add_argument("--overrides", required=True, type=Path)
    p.add_argument("--qa-output", required=True, type=Path)
    args = p.parse_args()

    registry = read_json(args.registry, {})
    overrides = read_json(args.overrides, {})
    errors: list[str] = []

    if not isinstance(registry, dict) or not isinstance(registry.get("entities"), list):
        raise SystemExit("invalid entity registry")
    if not isinstance(overrides, dict):
        raise SystemExit("invalid entity overrides")
    if int(overrides.get("version") or 0) != 1:
        errors.append("entity-overrides.json version must be 1")

    entities = [dict(x) for x in registry.get("entities", []) if isinstance(x, dict) and x.get("id")]
    by_id = {x["id"]: x for x in entities}
    mapping: dict[str, str] = {}

    for row in overrides.get("merges", []):
        if not isinstance(row, dict):
            errors.append("merge override must be an object")
            continue
        src, dst = str(row.get("from") or ""), str(row.get("into") or "")
        if not src or not dst or src == dst:
            errors.append(f"invalid merge {src!r} -> {dst!r}")
            continue
        if src not in by_id or dst not in by_id:
            errors.append(f"merge references missing entity: {src} -> {dst}")
            continue
        if by_id[src].get("type") != by_id[dst].get("type"):
            errors.append(f"cannot merge different entity types: {src} -> {dst}")
            continue
        mapping[src] = dst

    # Validate cycles before applying.
    for src in list(mapping):
        try:
            resolve(mapping, src)
        except ValueError as exc:
            errors.append(str(exc))

    if not errors:
        for src in list(mapping):
            if src not in by_id:
                continue
            dst_id = resolve(mapping, src)
            if dst_id == src or dst_id not in by_id:
                continue
            merge_entity(by_id[dst_id], by_id[src])
        merged_ids = set(mapping)
        entities = [x for x in entities if x["id"] not in merged_ids]
        by_id = {x["id"]: x for x in entities}

    for row in overrides.get("aliases", []):
        if not isinstance(row, dict):
            errors.append("alias override must be an object")
            continue
        eid, alias = str(row.get("entity") or ""), str(row.get("alias") or "").strip()
        eid = resolve(mapping, eid) if eid else eid
        if eid not in by_id or not norm(alias):
            errors.append(f"invalid alias override for {eid!r}")
            continue
        ent = by_id[eid]
        if all(norm(x) != norm(alias) for x in [ent.get("name_fa"), *ent.get("aliases", [])]):
            ent.setdefault("aliases", []).append(alias)

    for row in overrides.get("canonical_names", []):
        if not isinstance(row, dict):
            errors.append("canonical_names override must be an object")
            continue
        eid, name = str(row.get("entity") or ""), str(row.get("name_fa") or "").strip()
        eid = resolve(mapping, eid) if eid else eid
        if eid not in by_id or not norm(name):
            errors.append(f"invalid canonical name override for {eid!r}")
            continue
        ent = by_id[eid]
        old = str(ent.get("name_fa") or "").strip()
        if old and norm(old) != norm(name):
            ent.setdefault("aliases", []).append(old)
        ent["name_fa"] = name
        ent["aliases"] = uniq([x for x in ent.get("aliases", []) if norm(x) != norm(name)])

    rewritten = []
    edge_seen = set()
    for edge in registry.get("edges", []):
        if not isinstance(edge, dict):
            continue
        src = resolve(mapping, str(edge.get("from") or ""))
        dst = resolve(mapping, str(edge.get("to") or ""))
        rel = str(edge.get("rel") or "")
        if not src or not dst or src == dst:
            continue
        row = dict(edge)
        row["from"], row["to"] = src, dst
        key = json.dumps(row, ensure_ascii=False, sort_keys=True)
        if key not in edge_seen:
            edge_seen.add(key)
            rewritten.append(row)

    entity_ids = {x["id"] for x in entities}
    broken_edges = [x for x in rewritten if x.get("from") not in entity_ids or x.get("to") not in entity_ids]
    rewritten = [x for x in rewritten if x not in broken_edges]

    alias_index, ambiguous = rebuild_alias_index(entities)

    unresolved_conflicts = []
    for conflict in registry.get("conflicts", []):
        if not isinstance(conflict, dict):
            continue
        ids = [resolve(mapping, str(x)) for x in conflict.get("entity_ids", [])]
        ids = sorted(set(x for x in ids if x in entity_ids))
        if len(ids) > 1:
            row = dict(conflict)
            row["entity_ids"] = ids
            unresolved_conflicts.append(row)

    keep = set()
    for row in overrides.get("keep_separate", []):
        if isinstance(row, list) and len(row) == 2:
            a, b = resolve(mapping, str(row[0])), resolve(mapping, str(row[1]))
            if a in entity_ids and b in entity_ids and a != b:
                keep.add(pair_key(a, b))
        else:
            errors.append("keep_separate rows must be two-item arrays")

    degree = defaultdict(int)
    for edge in rewritten:
        degree[edge["from"]] += 1
        degree[edge["to"]] += 1

    orphans = [
        {"id": x["id"], "type": x.get("type"), "name_fa": x.get("name_fa")}
        for x in entities if degree[x["id"]] == 0
    ]
    no_routes = [
        {"id": x["id"], "type": x.get("type"), "name_fa": x.get("name_fa")}
        for x in entities if not x.get("routes")
    ]
    candidates = duplicate_candidates(entities, keep)

    registry["entities"] = sorted(entities, key=lambda x: (str(x.get("type")), norm(x.get("name_fa"))))
    registry["edges"] = sorted(rewritten, key=lambda x: (x.get("from", ""), x.get("rel", ""), x.get("to", "")))
    registry["alias_index"] = alias_index
    registry["ambiguous_aliases"] = ambiguous
    registry["conflicts"] = unresolved_conflicts
    counts = defaultdict(int)
    for ent in entities:
        counts[str(ent.get("type"))] += 1
    counts["total"] = len(entities)
    registry["counts"] = dict(counts)
    registry["overrides_applied"] = {
        "merges": len(overrides.get("merges", [])),
        "keep_separate": len(overrides.get("keep_separate", [])),
        "aliases": len(overrides.get("aliases", [])),
        "canonical_names": len(overrides.get("canonical_names", [])),
    }

    qa = {
        "version": 1,
        "generated_from_registry_version": registry.get("version"),
        "stats": {
            "entities": len(entities),
            "edges": len(rewritten),
            "duplicate_candidates": len(candidates),
            "ambiguous_aliases": len(ambiguous),
            "orphans": len(orphans),
            "no_routes": len(no_routes),
            "broken_edges": len(broken_edges),
            "invalid_overrides": len(errors),
            "unresolved_conflicts": len(unresolved_conflicts),
        },
        "duplicate_candidates": candidates,
        "ambiguous_aliases": ambiguous[:250],
        "orphans": orphans[:500],
        "no_routes": no_routes[:500],
        "broken_edges": broken_edges[:250],
        "invalid_overrides": errors,
        "unresolved_conflicts": unresolved_conflicts[:250],
        "applied_overrides": registry["overrides_applied"],
        "override_schema": {
            "version": 1,
            "merges": [{"from": "person:duplicate", "into": "person:canonical"}],
            "keep_separate": [["book:a", "book:b"]],
            "aliases": [{"entity": "person:canonical", "alias": "نام دیگر"}],
            "canonical_names": [{"entity": "person:canonical", "name_fa": "نام مرجع"}],
        },
    }

    args.registry.write_text(json.dumps(registry, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    args.qa_output.parent.mkdir(parents=True, exist_ok=True)
    args.qa_output.write_text(json.dumps(qa, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(
        "entity QA: "
        f"entities={qa['stats']['entities']}, edges={qa['stats']['edges']}, "
        f"duplicates={qa['stats']['duplicate_candidates']}, ambiguous={qa['stats']['ambiguous_aliases']}, "
        f"orphans={qa['stats']['orphans']}, broken_edges={qa['stats']['broken_edges']}, "
        f"invalid_overrides={qa['stats']['invalid_overrides']}"
    )
    if errors or broken_edges:
        for err in errors:
            print(f"::error::{err}")
        if broken_edges:
            print(f"::error::{len(broken_edges)} broken entity graph edges")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
