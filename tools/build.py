#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Scan date folders and write assets/bundle.js plus a small manifest.

Run from the repository root or from anywhere:

    python3 tools/build.py

The generated bundle inlines all objects, slot leads and entries so
index.html can be opened as a local file (file://) without a web server.
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SLOT_RE = re.compile(r"^\d{2}:\d{2}$")
REQUIRED_ENTRY_FIELDS = (
    "slot",
    "important",
    "headline",
    "x_circulation",
    "public_record",
    "sources",
    "still_unseen",
    "important_points",
)
SHANGHAI = timezone(timedelta(hours=8), name="Asia/Shanghai")


def fail(message: str) -> None:
    print(f"build error: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"invalid JSON in {path}: {exc}")


def slot_rank(slot: str) -> tuple[int, int]:
    hour, minute = slot.split(":")
    return int(hour), int(minute)


def main() -> None:
    objects_path = ROOT / "objects.json"
    if not objects_path.exists():
        fail("missing objects.json")
    objects = load_json(objects_path)
    if not isinstance(objects, list) or not objects:
        fail("objects.json must be a non-empty list")

    object_ids = []
    seen_ids = set()
    for item in objects:
        if not isinstance(item, dict) or "id" not in item:
            fail("each object in objects.json needs an id")
        oid = item["id"]
        if oid in seen_ids:
            fail(f"duplicate object id: {oid}")
        seen_ids.add(oid)
        object_ids.append(oid)
        for key in ("title_zh", "category", "status", "summary"):
            if key not in item:
                fail(f"object {oid} missing field {key}")
        if item["status"] not in ("active", "retired"):
            fail(f"object {oid} has invalid status {item['status']!r}")

    date_dirs = sorted(
        path for path in ROOT.iterdir() if path.is_dir() and DATE_RE.match(path.name)
    )
    if not date_dirs:
        fail("no YYYY-MM-DD date folders found")

    days = []
    files_by_object = defaultdict(list)
    warnings = []

    for date_dir in date_dirs:
        date = date_dir.name
        meta_path = date_dir / "_meta.json"
        if meta_path.exists():
            meta = load_json(meta_path)
        else:
            meta = {"date": date, "timezone": "Asia/Shanghai", "slots": []}
            warnings.append(f"{date}: missing _meta.json")
        if meta.get("date") and meta["date"] != date:
            fail(f"{meta_path} date {meta['date']} does not match folder {date}")
        slots = meta.get("slots") or []
        for slot_info in slots:
            if not SLOT_RE.match(str(slot_info.get("slot", ""))):
                fail(f"{meta_path} has invalid slot: {slot_info!r}")

        files = {}
        for path in sorted(date_dir.glob("*.json")):
            if path.name.startswith("_"):
                continue
            data = load_json(path)
            oid = data.get("id")
            if oid != path.stem:
                fail(f"{path} id {oid!r} does not match filename")
            if oid not in seen_ids:
                fail(f"{path} object id {oid} is not in objects.json")
            if data.get("date") != date:
                fail(f"{path} date {data.get('date')!r} does not match folder {date}")
            if data.get("timezone") != "Asia/Shanghai":
                fail(f"{path} timezone must be Asia/Shanghai")
            entries = data.get("entries")
            if not isinstance(entries, list) or not entries:
                fail(f"{path} must have a non-empty entries array")
            for index, entry in enumerate(entries):
                missing = [key for key in REQUIRED_ENTRY_FIELDS if key not in entry]
                if missing:
                    fail(f"{path} entries[{index}] missing {missing}")
                if not SLOT_RE.match(str(entry["slot"])):
                    fail(f"{path} entries[{index}] has invalid slot")
                if not isinstance(entry["important"], bool):
                    fail(f"{path} entries[{index}] important must be boolean")
                if not isinstance(entry["x_circulation"], str):
                    fail(f"{path} entries[{index}] x_circulation must be a string")
                for list_field in ("sources", "still_unseen", "important_points"):
                    if not isinstance(entry[list_field], list) or any(
                        not isinstance(item, str) for item in entry[list_field]
                    ):
                        fail(f"{path} entries[{index}] {list_field} must be an array of strings")
            files[oid] = data
            files_by_object[oid].append((date, data))

        days.append(
            {
                "date": date,
                "timezone": meta.get("timezone", "Asia/Shanghai"),
                "slots": slots,
                "files": files,
            }
        )

    missing_objects = [oid for oid in object_ids if oid not in files_by_object]
    if missing_objects:
        fail(
            "these objects in objects.json have no date files: "
            + ", ".join(missing_objects)
        )

    # Guard against reprinting an entire previous day's body on the next day.
    for oid, dated_files in files_by_object.items():
        dated_files.sort(key=lambda item: item[0])
        for index in range(1, len(dated_files)):
            prev_date, prev_data = dated_files[index - 1]
            curr_date, curr_data = dated_files[index]
            prev_texts = [
                entry["public_record"].strip()
                for entry in prev_data["entries"]
                if entry.get("public_record", "").strip()
            ]
            for entry in curr_data["entries"]:
                current = entry["public_record"].strip()
                for previous in prev_texts:
                    if len(previous) >= 400 and previous in current:
                        fail(
                            f"{curr_date}/{oid}.json looks like a full reprint of "
                            f"{prev_date} public_record in slot {entry['slot']}"
                        )

    generated_at = datetime.now(SHANGHAI).strftime("%Y-%m-%d %H:%M:%S")
    payload = {
        "generated_at": generated_at,
        "timezone": "Asia/Shanghai",
        "objects": objects,
        "days": days,
    }

    ASSETS.mkdir(parents=True, exist_ok=True)
    bundle_path = ASSETS / "bundle.js"
    serialized = json.dumps(payload, ensure_ascii=False, indent=2)
    bundle_path.write_text(
        "/* Generated by tools/build.py — do not edit by hand. */\n"
        "window.THEME_BRIEF_DATA = "
        + serialized
        + ";\n",
        encoding="utf-8",
    )

    manifest = {
        "generated_at": generated_at,
        "timezone": "Asia/Shanghai",
        "dates": [day["date"] for day in days],
        "slots": [
            {"date": day["date"], "slot": slot["slot"], "title": slot.get("title", "")}
            for day in days
            for slot in day["slots"]
        ],
        "objects": [
            {
                "id": item["id"],
                "title_zh": item["title_zh"],
                "category": item["category"],
                "status": item["status"],
                "dates": [date for date, _ in files_by_object[item["id"]]],
            }
            for item in objects
        ],
        "file_count": sum(len(day["files"]) for day in days),
        "bundle": "assets/bundle.js",
    }
    manifest_path = ASSETS / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"wrote {bundle_path.relative_to(ROOT)}")
    print(f"wrote {manifest_path.relative_to(ROOT)}")
    print(f"dates: {', '.join(manifest['dates'])}")
    print(f"objects: {len(objects)}")
    print(f"files: {manifest['file_count']}")
    for warning in warnings:
        print(f"warning: {warning}")


if __name__ == "__main__":
    main()
