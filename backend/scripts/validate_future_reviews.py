#!/usr/bin/env python3
"""Validate public evidence ledger and preserve append-only revisions."""
import json, pathlib, sys
AXES=set("authority executive justice mahestan security economy watch assembly".split())
STATUSES=set("unreviewed under_review corroborated disputed rejected".split())
def validate(new, old=None):
    assert isinstance(new,dict) and new.get("schema")==1
    records=new.get("records")
    assert isinstance(records,list) and len(records)<=10000
    keys=set()
    previous={(r["story_id"],r["axis"]):r for r in old.get("records",[])} if old else {}
    for r in records:
        assert isinstance(r,dict)
        assert all(k in r for k in ("story_id","axis","status","claim","primary_sources","independent_sources","contradicting_evidence","reviewer","reviewed_at","rationale","revision","history"))
        key=(r["story_id"],r["axis"])
        assert key not in keys and r["axis"] in AXES and r["status"] in STATUSES
        keys.add(key)
        assert isinstance(r["story_id"],str) and 8<=len(r["story_id"])<=100
        assert r["revision"]>=1 and isinstance(r["revision"],int)
        assert isinstance(r["claim"],str) and len(r["claim"].strip())>=12
        assert isinstance(r["rationale"],str) and len(r["rationale"].strip())>=20
        assert isinstance(r["history"],list)
        assert all(isinstance(x,str) and x.startswith(("https://","http://")) for f in ("primary_sources","independent_sources") for x in r[f])
        if r["status"]=="corroborated":
            assert len(set(r["primary_sources"]+r["independent_sources"]))>=2, "corroborated needs 2 source URLs"
        if key in previous:
            p=previous[key]
            if r!=p:
                assert r["revision"]>p["revision"], "revision must increase"
                assert len(r["history"])>len(p["history"]), "history must grow"
                assert r["history"][:len(p["history"])]==p["history"], "existing history cannot change"
                assert any(h.get("at")==p["reviewed_at"] and h.get("status")==p["status"] for h in r["history"][len(p["history"]):]), "previous version must be retained"
    if old:
        assert set(previous)<=keys, "published reviews cannot silently disappear"
    return len(records)
if __name__=="__main__":
    new=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    old=json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")) if len(sys.argv)>2 else None
    try:
        print("Validated records:",validate(new,old))
    except (AssertionError,KeyError,TypeError,ValueError) as e:
        print("Evidence ledger invalid:",e,file=sys.stderr)
        sys.exit(1)
