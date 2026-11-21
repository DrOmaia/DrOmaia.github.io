#!/usr/bin/env python3
"""Rebuild Dr-Omaia-Al-Omari-Verified-Research-Portfolio-2011-2026.pdf from research-data.js.

Usage:  python3 tools/build-portfolio.py        (needs: pip install playwright, and Chrome/Chromium)
The catalogue in research-data.js is the source of truth; nothing is fetched from the network.
"""
import asyncio, collections, html, json, os, pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "Dr-Omaia-Al-Omari-Verified-Research-Portfolio-2011-2026.pdf"
THEME_ORDER = ["Cybersecurity, IoT, and cloud infrastructure", "NLP, education, and knowledge systems",
               "Healthcare and clinical decision support", "Decision analytics and intelligent systems",
               "Computer vision and environmental intelligence", "Responsible AI, governance, and society"]
TRAJECTORY = [
    "2011-2020: Classical Arabic NLP, feature engineering, statistical comparison, and connected educational systems.",
    "2023-2024: Applied classification, multimodal attention, blockchain, reinforcement learning, and optimization.",
    "2025: Deep learning across clinical AI, environmental intelligence, cybersecurity, governance, and decision support.",
    "2026: Real-time detection, hybrid neural architectures, on-demand explainable AI, deep feature fusion for medical "
    "imaging, and agentic and verification-guided AI for software engineering.",
]
e = html.escape


def load():
    text = (ROOT / "research-data.js").read_text(encoding="utf-8")
    return json.loads(text[text.index("{"):text.rindex("}") + 1])


def build_html(data):
    works, meta = data["works"], data["meta"]
    types = collections.Counter(w["type"] for w in works)
    themes = collections.Counter(w["theme"] for w in works)
    cutoff = meta["verificationCutoffDisplay"]
    order = sorted(themes, key=lambda t: (-themes[t], THEME_ORDER.index(t) if t in THEME_ORDER else 99))
    rows = "".join(f"<tr><td>{e(t)}</td><td>{themes[t]}</td></tr>" for t in order)
    cards = []
    for w in works:
        doi = f' <a href="{e(w["doi"])}">{e(w["doi"])}</a>' if w.get("doi") else ""
        note = f'<p class="note">Verification note: {e(w["verificationNote"])}</p>' if w.get("verificationNote") else ""
        cards.append(f'<article><h3>{e(w["id"])}. {e(w["title"])}</h3>'
                     f'<p class="meta">{w["year"]} | {e(w["type"])} | {e(w["theme"])}</p>'
                     f'<p>Methods: {e(", ".join(w["methods"]))}</p><p>{e(w["contribution"])}</p>'
                     f'<p class="ref">Reference: {e(w["reference"])}{doi}</p>{note}</article>')
    years = f'{min(w["year"] for w in works)}-{max(w["year"] for w in works)}'
    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Dr. Omaia Al-Omari - Verified Research Portfolio {years}</title>
<meta name="author" content="Dr. Omaia Al-Omari">
<meta name="description" content="A website reference portfolio of {len(works)} verified works">
<style>
@page {{ size: A4; margin: 18mm 17mm 20mm; }}
body {{ font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif; color: #24303c; font-size: 8.6pt; line-height: 1.45; margin: 0; }}
.kicker {{ color: #0b7a5c; font-weight: 700; font-size: 7pt; letter-spacing: .04em; margin: 22pt 0 4pt; }}
h1 {{ font-size: 25pt; color: #12283a; margin: 0 0 8pt; }}
.lead {{ font-size: 11pt; color: #5a6b7b; margin: 0 0 14pt; }}
.stats {{ display: grid; grid-template-columns: repeat(4, 1fr); border: .6pt solid #cfd9e2; background: #f7fafc; }}
.stats div {{ text-align: center; padding: 8pt 4pt; border-left: .6pt solid #cfd9e2; color: #5a6b7b; font-size: 7.6pt; }}
.stats div:first-child {{ border-left: 0; }} .stats b {{ display: block; font-size: 9.5pt; color: #24303c; font-weight: 400; }}
h2 {{ font-size: 17pt; color: #12283a; margin: 22pt 0 9pt; }}
p {{ margin: 0 0 5pt; }}
.warn, .note {{ color: #a05a00; font-size: 7.6pt; }}
table {{ width: 100%; border-collapse: collapse; }}
th, td {{ border: .6pt solid #cfd9e2; padding: 6pt 7pt; text-align: left; }}
th {{ background: #e9f4f0; color: #0b7a5c; font-size: 7.8pt; }} td:last-child, th:last-child {{ width: 50pt; }}
.works {{ break-before: page; }} .works h2 {{ margin-top: 0; }}
article {{ break-inside: avoid; margin: 0 0 17pt; }}
h3 {{ font-size: 11pt; color: #12283a; margin: 0 0 3pt; line-height: 1.3; }}
.meta {{ color: #0b7a5c; font-weight: 700; font-size: 7.6pt; }}
.ref {{ color: #5a6b7b; font-size: 7.8pt; padding-left: 14pt; text-indent: -14pt; }}
a {{ color: #0b7a5c; text-decoration: none; }}
</style></head><body>
<p class="kicker">VERIFIED RESEARCH PORTFOLIO</p>
<h1>Dr. Omaia Al-Omari</h1>
<p class="lead">Evolution of cross-domain applied artificial intelligence research, {years}</p>
<div class="stats"><div><b>{len(works)}</b>verified works</div><div><b>{types["Journal article"]}</b>journal articles</div>
<div><b>{types["Conference paper"]}</b>conference papers</div><div><b>{types["Book chapter"]}</b>book chapters</div></div>
<h2>Status and scope</h2>
<p>This downloadable portfolio is a curated website reference edition covering {len(works)} works verified through
{e(cutoff)}. It is not a peer-reviewed article, an accepted manuscript, or evidence that the underlying synthesis has
been published. Publication titles, years, output types, concise contributions, methods, references, DOI links, and
known metadata cautions are provided for transparent academic review.</p>
<p class="warn">The complete source Word manuscript is intentionally not distributed through the website.</p>
<h2>Portfolio themes</h2>
<table><tr><th>Primary theme</th><th>Works</th></tr>{rows}</table>
<h2>Methodological trajectory</h2>
{"".join(f"<p>{e(t)}</p>" for t in TRAJECTORY)}
<section class="works"><h2>Annotated works</h2>
<p class="lead">Records are presented chronologically. Official titles and matching APA-style references are retained in English.</p>
{"".join(cards)}</section></body></html>""", cutoff


async def render(page_html, cutoff):
    from playwright.async_api import async_playwright
    tmp = ROOT / "tools" / "_portfolio.html"
    tmp.write_text(page_html, encoding="utf-8")
    chrome = os.environ.get("CHROME") or shutil.which("google-chrome") or shutil.which("chromium")
    footer = (f'<div style="width:100%;margin:0 17mm;padding-top:4pt;border-top:.6pt solid #cfd9e2;font-size:7pt;'
              f'color:#5a6b7b;font-family:DejaVu Sans,Arial,sans-serif;display:flex;justify-content:space-between">'
              f'<span>Verification cutoff: {e(cutoff)}</span><span>Page <span class="pageNumber"></span></span></div>')
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(executable_path=chrome, args=["--no-sandbox"]) if chrome else await p.chromium.launch()
            page = await browser.new_page()
            await page.goto(tmp.as_uri())
            await page.pdf(path=str(OUT), format="A4", print_background=True, display_header_footer=True,
                           header_template="<span></span>", footer_template=footer, prefer_css_page_size=True)
            await browser.close()
    finally:
        tmp.unlink(missing_ok=True)


if __name__ == "__main__":
    doc, cut = build_html(load())
    asyncio.run(render(doc, cut))
    print(f"{OUT.name} written ({OUT.stat().st_size // 1024} KB)")
