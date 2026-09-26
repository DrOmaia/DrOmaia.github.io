#!/usr/bin/env python3
"""Refresh publication metrics from open scholarly APIs and write them into the site.

What it does (weekly, from .github/workflows/refresh-metrics.yml, or by hand):
  1. Reads the verified works from research-data.js (the curated catalogue is the source of truth).
  2. For every DOI asks Crossref (is-referenced-by-count) and OpenAlex (cited_by_count).
  3. Reads the author's public ORCID record and lists DOIs that are NOT yet in the catalogue
     ("new on ORCID, pending verification") — nothing is added to the catalogue automatically.
  4. Writes data/metrics.json and injects the numbers into index.html / publications.html:
       <strong data-metric="citations">…</strong>, data-metric="hindex", data-metric="works",
       data-metric="updated", the block between <!-- metrics:latest --> … <!-- /metrics:latest -->,
       and <span class="pub-cites" data-doi="…">…</span> on the publication cards.
     Run tools/build-arabic.py afterwards so the Arabic pages pick the same values up.

Only the Python standard library is used. A source that fails is skipped and the previous
values from data/metrics.json are kept, so a bad week never breaks the site.

Usage:  python3 tools/refresh_metrics.py            (fetch + write + inject)
        python3 tools/refresh_metrics.py --inject   (no network: re-inject data/metrics.json)
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_JS = ROOT / "research-data.js"
OUT = ROOT / "data" / "metrics.json"
INDEX = ROOT / "index.html"
PUBS = ROOT / "publications.html"

ORCID = "0000-0002-1638-1771"
MAILTO = "oalomari@psu.edu.sa"  # polite-pool contact for Crossref / OpenAlex
UA = f"dromaia-site-metrics/1.0 (https://dromaia.github.io; mailto:{MAILTO})"
PAUSE = 0.25  # seconds between requests
LATEST_COUNT = 3
NEW_COUNT = 2

MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


# ----------------------------------------------------------------------------- helpers
def get_json(url: str, headers: dict | None = None, retries: int = 3):
    """GET a JSON document; None on 404 or persistent failure. Backs off on 429/5xx."""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json", **(headers or {})})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as err:
            if err.code == 404:
                return None
            if err.code in (429, 500, 502, 503, 504):
                time.sleep(3 * (attempt + 1))
                continue
            return None
        except Exception:  # network hiccup, timeout, bad JSON
            time.sleep(2 * (attempt + 1))
    return None


def load_works() -> list[dict]:
    text = DATA_JS.read_text(encoding="utf-8")
    payload = text[text.index("{"):].rstrip().rstrip(";")
    return json.loads(payload)["works"]


DOI_RE = re.compile(r"10\.\d{4,9}/[^\s\"<>]+", re.I)


def doi_of(work: dict) -> str | None:
    match = DOI_RE.search(work.get("doi") or "")
    return match.group(0).rstrip(".") .lower() if match else None


def h_index(counts: list[int]) -> int:
    ordered = sorted(counts, reverse=True)
    h = 0
    for rank, cites in enumerate(ordered, start=1):
        if cites >= rank:
            h = rank
        else:
            break
    return h


def ar_citations(n: int) -> str:
    if n == 0:
        return "لا استشهادات بعد"
    if n == 1:
        return "استشهاد واحد"
    if n == 2:
        return "استشهادان"
    if 3 <= n <= 10:
        return f"{n} استشهادات"
    return f"{n} استشهاداً"


def esc(text: str) -> str:
    return (text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


# ----------------------------------------------------------------------------- sources
def crossref(doi: str):
    data = get_json(f"https://api.crossref.org/works/{urllib.parse.quote(doi, safe='')}?mailto={MAILTO}")
    if not data:
        return None
    msg = data.get("message", {})
    parts = ((msg.get("issued") or {}).get("date-parts") or [[None]])[0]
    return {
        "cited": msg.get("is-referenced-by-count"),
        "venue": (msg.get("container-title") or [None])[0],
        "date": "-".join(f"{p:02d}" if i else str(p) for i, p in enumerate(parts) if p is not None) or None,
    }


def openalex(doi: str):
    url = (f"https://api.openalex.org/works/https://doi.org/{doi}?mailto={MAILTO}"
           "&select=id,doi,publication_year,publication_date,cited_by_count")
    data = get_json(url)
    if not data:
        return None
    return {"cited": data.get("cited_by_count"), "date": data.get("publication_date"), "year": data.get("publication_year")}


def orcid_works() -> list[dict]:
    data = get_json(f"https://pub.orcid.org/v3.0/{ORCID}/works", headers={"Accept": "application/json"})
    if not data:
        return []
    found = []
    for group in data.get("group", []):
        summary = (group.get("work-summary") or [{}])[0]
        title = (((summary.get("title") or {}).get("title") or {}).get("value")) or ""
        year = ((summary.get("publication-date") or {}).get("year") or {}).get("value")
        doi = None
        for ext in ((group.get("external-ids") or {}).get("external-id") or []):
            if (ext.get("external-id-type") or "").lower() == "doi":
                doi = (ext.get("external-id-value") or "").strip().lower()
                break
        found.append({"title": title.strip(), "year": year, "doi": doi})
    return found


# ----------------------------------------------------------------------------- build metrics
def build_metrics(previous: dict | None) -> dict:
    works = load_works()
    prev_by_id = {w["id"]: w for w in (previous or {}).get("per_work", [])}
    per_work, cr_ok, oa_ok = [], 0, 0

    for work in works:
        doi = doi_of(work)
        row = {"id": work["id"], "title": work["title"], "year": work["year"], "doi": doi,
               "crossref": None, "openalex": None, "date": None, "venue": None}
        if doi:
            cr = crossref(doi)
            time.sleep(PAUSE)
            oa = openalex(doi)
            time.sleep(PAUSE)
            if cr:
                cr_ok += 1
                row["crossref"] = cr["cited"]
                row["venue"] = cr["venue"]
                row["date"] = cr["date"]
            if oa:
                oa_ok += 1
                row["openalex"] = oa["cited"]
                row["date"] = oa["date"] or row["date"]
        # keep last known values when a source failed this week
        old = prev_by_id.get(work["id"], {})
        for key in ("crossref", "openalex", "date", "venue"):
            if row[key] is None and old.get(key) is not None:
                row[key] = old[key]
        per_work.append(row)

    oa_counts = [r["openalex"] for r in per_work if isinstance(r["openalex"], int)]
    cr_counts = [r["crossref"] for r in per_work if isinstance(r["crossref"], int)]

    verified_dois = {r["doi"] for r in per_work if r["doi"]}
    orcid_list = orcid_works()
    new_on_orcid = [w for w in orcid_list if w["doi"] and w["doi"] not in verified_dois]
    new_on_orcid.sort(key=lambda w: (w["year"] or "0"), reverse=True)
    if not orcid_list and previous:
        new_on_orcid = previous.get("orcid_new", [])

    def sort_key(row):
        return (row["date"] or f"{row['year']}-00-00", row["id"])

    latest = sorted(per_work, key=sort_key, reverse=True)[:LATEST_COUNT]

    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    return {
        "checked": now.isoformat().replace("+00:00", "Z"),
        "works_verified": len(works),
        "openalex": {"cited_by_total": sum(oa_counts) if oa_counts else None,
                     "h_index": h_index(oa_counts) if oa_counts else None,
                     "matched": len(oa_counts)},
        "crossref": {"cited_by_total": sum(cr_counts) if cr_counts else None,
                     "h_index": h_index(cr_counts) if cr_counts else None,
                     "matched": len(cr_counts)},
        "latest": [{"id": r["id"], "title": r["title"], "year": r["year"], "doi": r["doi"], "venue": r["venue"]} for r in latest],
        "orcid_new": new_on_orcid[:NEW_COUNT],
        "per_work": per_work,
    }


# ----------------------------------------------------------------------------- inject into HTML
def replace_metric(html: str, name: str, value: str) -> str:
    pattern = re.compile(r'(<strong[^>]*data-metric="' + name + r'"[^>]*>)[^<]*(</strong>)')
    return pattern.sub(lambda m: f"{m.group(1)}{value}{m.group(2)}", html)


def replace_updated(html: str, checked: str) -> str:
    """Set the text and the data-ar of the element carrying data-metric="updated" (any attribute order)."""
    if not checked:
        return html  # initial placeholder has no successful refresh date yet
    day = dt.datetime.fromisoformat(checked.replace("Z", "+00:00"))
    en = f"Updated {day.day} {MONTHS_EN[day.month - 1]} {day.year}"
    ar = f"آخر تحديث {day.day} {MONTHS_AR[day.month - 1]} {day.year}"
    tag = re.compile(r'<span\b[^>]*data-metric="updated"[^>]*>')
    match = tag.search(html)
    if not match:
        return html
    opening = match.group(0)
    if 'data-ar="' in opening:
        opening = re.sub(r'data-ar="[^"]*"', f'data-ar="{ar}"', opening, count=1)
    else:
        opening = opening[:-1] + f' data-ar="{ar}">'
    rest = html[match.end():]
    rest = re.sub(r'^[^<]*(</span>)', lambda m: f"{en}{m.group(1)}", rest, count=1)
    return html[:match.start()] + opening + rest


def latest_markup(metrics: dict) -> str:
    items = []
    for w in metrics.get("latest", []):
        title = esc(w["title"])
        link = f'<a href="https://doi.org/{esc(w["doi"])}" target="_blank" rel="noopener">{title}</a>' if w.get("doi") else title
        venue = f' <span class="latest-venue" lang="en">{esc(w["venue"])}</span>' if w.get("venue") else ""
        items.append(f'<li><time datetime="{w["year"]}">{w["year"]}</time> <span class="latest-title" lang="en" dir="ltr">{link}</span>{venue}</li>')
    for w in metrics.get("orcid_new", []):
        title = esc(w["title"])
        link = f'<a href="https://doi.org/{esc(w["doi"])}" target="_blank" rel="noopener">{title}</a>'
        year = esc(str(w.get("year") or ""))
        items.append(f'<li><time datetime="{year}">{year}</time> <span class="latest-title" lang="en" dir="ltr">{link}</span> '
                     f'<span class="latest-new" data-ar="جديد على ORCID · بانتظار التحقق">New on ORCID · pending verification</span></li>')
    return "\n".join(items)


def inject(metrics: dict) -> None:
    oa, cr = metrics["openalex"], metrics["crossref"]
    citations = oa["cited_by_total"] if oa["cited_by_total"] is not None else cr["cited_by_total"]
    hidx = oa["h_index"] if oa["h_index"] is not None else cr["h_index"]

    html = INDEX.read_text(encoding="utf-8")
    if citations is not None:
        html = replace_metric(html, "citations", f"{citations:,}")
    if hidx is not None:
        html = replace_metric(html, "hindex", str(hidx))
    html = replace_metric(html, "works", str(metrics["works_verified"]))
    html = replace_updated(html, metrics["checked"])
    block = re.compile(r"(<!-- metrics:latest -->).*?(<!-- /metrics:latest -->)", re.S)
    if block.search(html):
        html = block.sub(lambda m: f"{m.group(1)}\n{latest_markup(metrics)}\n{m.group(2)}", html)
    INDEX.write_text(html, encoding="utf-8")

    if PUBS.exists():
        pubs = PUBS.read_text(encoding="utf-8")
        by_doi = {r["doi"]: r for r in metrics["per_work"] if r["doi"]}

        def fill(m):
            row = by_doi.get(m.group(2).lower())
            n = None if not row else (row["crossref"] if row["crossref"] is not None else row["openalex"])
            if n is None:
                return m.group(0)
            source = "Crossref" if row["crossref"] is not None else "OpenAlex"
            return f'{m.group(1)}{m.group(2)}" data-ar="{ar_citations(n)} · {source}">Cited by {n:,} · {source}</span>'

        pubs = re.sub(r'(<span class="pub-cites" data-doi=")([^"]+)"(?: data-ar="[^"]*")?>[^<]*</span>', fill, pubs)
        PUBS.write_text(pubs, encoding="utf-8")


# ----------------------------------------------------------------------------- main
def main(argv: list[str]) -> int:
    previous = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else None
    if "--inject" in argv:
        if not previous:
            print("data/metrics.json not found; nothing to inject")
            return 1
        metrics = previous
    else:
        metrics = build_metrics(previous)
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(metrics, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    inject(metrics)
    oa, cr = metrics["openalex"], metrics["crossref"]
    print(f"works {metrics['works_verified']} · OpenAlex {oa['cited_by_total']} citations, h {oa['h_index']} ({oa['matched']} matched)"
          f" · Crossref {cr['cited_by_total']} citations ({cr['matched']} matched) · new on ORCID {len(metrics['orcid_new'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
