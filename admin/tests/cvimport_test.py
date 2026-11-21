#!/usr/bin/env python3
"""Browser test for admin/cvimport.js (CV import: PDF / DOCX -> text -> sections).

Run from the repository root:  python3 admin/tests/cvimport_test.py
Needs: playwright (python), Chrome/Chromium, python-docx. Fixtures are built here, in a temp folder;
the page under test is admin/tests/fixtures/cvimport.html, which loads only cvimport.js under the strict
Content-Security-Policy the dashboard needs (script-src 'self'; worker-src 'self'; connect-src 'self').
"""
import asyncio
import base64
import functools
import http.server
import io
import os
import pathlib
import shutil
import socketserver
import sys
import tempfile
import threading
import zipfile

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
CHROME = os.environ.get("CHROME") or shutil.which("google-chrome") or shutil.which("chromium") or "/usr/bin/google-chrome"
REAL_CV = ROOT / "Dr-Omaia-Al-Omari-Concise-Academic-CV.pdf"

AR_SENTENCE = "أستاذ مساعد في قسم نظم المعلومات بجامعة الأمير سلطان"
AR_HEADING = "الخبرات العملية"

checks = 0


def ok(cond, label):
    global checks
    checks += 1
    if not cond:
        print("FAIL:", label)
        raise SystemExit(1)


def in_order(text, parts):
    pos = 0
    for part in parts:
        found = text.find(part, pos)
        if found < 0:
            return False, part
        pos = found + len(part)
    return True, None


# ---------------------------------------------------------------- fixtures

def make_docx(stored=False):
    import docx  # python-docx

    d = docx.Document()
    d.add_heading("Dr. Test Person", 0)
    d.add_paragraph("test.person@example.org\tRiyadh, Saudi Arabia")
    d.add_heading("PROFESSIONAL SUMMARY", 1)
    d.add_paragraph("Researcher in applied AI & information systems with <angle> brackets and “quotes”.")
    d.add_heading("EDUCATION", 1)
    d.add_paragraph("PhD in Computer Science, Example University, 2021")
    d.add_heading("TRAINING AND CERTIFICATES", 1)
    d.add_paragraph("Course Design Institute", style="List Bullet")
    d.add_paragraph("AWS Immersion Day", style="List Bullet")
    table = d.add_table(rows=2, cols=3)
    for r, row in enumerate([["Course", "Provider", "Year"], ["Agile Meets Design Thinking", "Coursera", "2024"]]):
        for c, value in enumerate(row):
            table.cell(r, c).text = value
    d.add_heading("TECHNICAL SKILLS", 1)
    d.add_paragraph("Python")
    d.add_paragraph("Leadership")
    d.add_paragraph("Data analysis")
    d.add_heading(AR_HEADING, 1)
    d.add_paragraph(AR_SENTENCE)
    d.add_heading("LANGUAGES", 1)
    d.add_paragraph("Arabic (native); English (professional).")
    buf = io.BytesIO()
    d.save(buf)
    data = buf.getvalue()
    if not stored:
        return data
    # same archive, every entry stored without compression
    out = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(data)) as src, zipfile.ZipFile(out, "w", zipfile.ZIP_STORED) as dst:
        for info in src.infolist():
            dst.writestr(info.filename, src.read(info.filename), compress_type=zipfile.ZIP_STORED)
    return out.getvalue()


PDF_HTML = """<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page { size: A4; margin: 30mm 20mm; }
body { font-family: "DejaVu Sans", Arial, sans-serif; font-size: 11pt; line-height: 1.5; }
h2 { font-size: 14pt; margin: 14pt 0 6pt; }
.row { display: flex; justify-content: space-between; }
.break { break-before: page; }
p.ar { direction: rtl; text-align: right; }
</style></head><body>
<h1>Dr. Fixture Person</h1>
<p>fixture.person@example.org</p>
<h2>PROFESSIONAL PROFILE</h2>
<p>Alpha sentence about the profile of the candidate.</p>
<h2>ACADEMIC APPOINTMENTS</h2>
<div class="row"><b>Assistant Professor, Example University</b><span>2024–Present</span></div>
<ul><li>Bravo bullet about teaching duties.</li><li>Charlie bullet about supervision.</li></ul>
<h2 class="break">MEMBERSHIPS</h2>
<p>Delta society member since 2020.</p>
<h2 dir="rtl" style="text-align:right">%(ar_heading)s</h2>
<p class="ar">%(ar_sentence)s</p>
<h2>AWARDS AND HONOURS</h2>
<p>Echo award for best paper, 2023.</p>
</body></html>""" % {"ar_heading": AR_HEADING, "ar_sentence": AR_SENTENCE}

SCAN_HTML = """<!DOCTYPE html><html><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700"><rect width="500" height="700" fill="#eee"/>
<rect x="40" y="60" width="300" height="12" fill="#555"/><rect x="40" y="90" width="380" height="12" fill="#555"/></svg>
</body></html>"""


async def make_pdfs(browser, tmp):
    page = await browser.new_page()
    await page.set_content(PDF_HTML)
    text_pdf = await page.pdf(
        format="A4", print_background=True, display_header_footer=True,
        header_template='<div style="font-size:8px;width:100%;text-align:right;padding-right:20mm">FIXTURE CURRICULUM VITAE | TEST EDITION</div>',
        footer_template='<div style="font-size:8px;width:100%;text-align:center">Dr. Fixture Person | CV | <span class="pageNumber"></span></div>',
        margin={"top": "30mm", "bottom": "30mm", "left": "20mm", "right": "20mm"},
    )
    await page.set_content(SCAN_HTML)
    scan_pdf = await page.pdf(format="A4", print_background=True)
    await page.close()
    (tmp / "fixture.pdf").write_bytes(text_pdf)
    (tmp / "scan.pdf").write_bytes(scan_pdf)
    return text_pdf, scan_pdf


# ------------------------------------------------------------------ server

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(Quiet, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


EXTRACT_JS = """async ([b64, name]) => {
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  try {
    const res = await DashImport.extract(bytes.buffer, name);
    const parts = DashImport.split(res.text);
    return { res, sections: parts.sections, removed: parts.removed,
             guesses: parts.sections.map(s => DashImport.guess(s)), suggests: parts.sections.map(s => DashImport.suggest(s)) };
  } catch (e) { return { error: e.code || String(e) }; }
}"""


async def extract(page, data, name):
    return await page.evaluate(EXTRACT_JS, [base64.b64encode(data).decode(), name])


def titles(result):
    return [s["title"] for s in result["sections"]]


def section(result, title):
    for s in result["sections"]:
        if s["title"].lower() == title.lower():
            return s
    return None


async def main():
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="cvimport_"))
    httpd, port = serve()
    base = f"http://127.0.0.1:{port}"
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        text_pdf, scan_pdf = await make_pdfs(browser, tmp)

        ctx = await browser.new_context()
        page = await ctx.new_page()
        errors, csp, requests = [], [], []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: csp.append(m.text) if "Content Security Policy" in m.text or "Refused to" in m.text else None)
        page.on("request", lambda r: requests.append(r.url))
        ctx.on("request", lambda r: requests.append(r.url))  # worker requests too
        await page.add_init_script("""window.__csp = [];
          document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));""")
        await page.goto(f"{base}/admin/tests/fixtures/cvimport.html")
        ok(await page.evaluate("typeof DashImport === 'object' && typeof DashImport.extract === 'function'"), "module loads under the strict CSP")
        ok(await page.evaluate("typeof window.pdfjsLib === 'undefined'"), "pdf.js is not loaded until a PDF is read")

        # ---------------------------------------------------------- DOCX
        for stored in (False, True):
            label = "docx stored" if stored else "docx deflated"
            r = await extract(page, make_docx(stored), "my cv.docx")
            ok("error" not in r, f"{label}: no error ({r.get('error')})")
            ok(r["res"]["kind"] == "docx" and r["res"]["warnings"] == [], f"{label}: kind and no warnings")
            text = r["res"]["text"]
            good, missing = in_order(text, [
                "Dr. Test Person", "test.person@example.org Riyadh, Saudi Arabia", "PROFESSIONAL SUMMARY",
                "Researcher in applied AI & information systems with <angle> brackets and “quotes”.",
                "EDUCATION", "PhD in Computer Science, Example University, 2021", "TRAINING AND CERTIFICATES",
                "Course Design Institute\nAWS Immersion Day", "Course | Provider | Year",
                "Agile Meets Design Thinking | Coursera | 2024", "TECHNICAL SKILLS", "Python\nLeadership\nData analysis",
                AR_HEADING, AR_SENTENCE, "LANGUAGES", "Arabic (native); English (professional).",
            ])
            ok(good, f"{label}: text in order (missing: {missing})")
            ok("\t" not in text and "\f" not in text, f"{label}: tabs became spaces")
            ok(titles(r) == ["Header", "PROFESSIONAL SUMMARY", "EDUCATION", "TRAINING AND CERTIFICATES", "TECHNICAL SKILLS", AR_HEADING, "LANGUAGES"],
               f"{label}: sections {titles(r)}")
            ok(section(r, "TECHNICAL SKILLS")["lines"] == ["Python", "Leadership", "Data analysis"], f"{label}: 'Leadership' stays a list entry")
            ok(section(r, "TRAINING AND CERTIFICATES")["lines"] == ["Course Design Institute", "AWS Immersion Day", "Course | Provider | Year", "Agile Meets Design Thinking | Coursera | 2024"],
               f"{label}: list items and table rows")
            ok(section(r, AR_HEADING)["lines"] == [AR_SENTENCE], f"{label}: Arabic section")
            ok(r["guesses"] == ["other", "profile", "education", "training", "skills", "experience", "languages"], f"{label}: guesses {r['guesses']}")
            ok(r["suggests"] == ["skip", "add", "skip", "add", "add", "skip", "add"], f"{label}: suggestions {r['suggests']}")
            ok(r["removed"] == [], f"{label}: nothing removed")

        # --------------------------------------------------- fixture PDF
        r = await extract(page, text_pdf, "fixture.pdf")
        ok("error" not in r, f"pdf: no error ({r.get('error')})")
        ok(r["res"]["kind"] == "pdf" and r["res"]["pages"] == 2, f"pdf: kind and two pages ({r['res'].get('pages')})")
        ok(r["res"]["warnings"] == [], f"pdf: no warnings ({r['res']['warnings']})")
        text = r["res"]["text"]
        ok(text.count("\f") == 1, "pdf: one page break")
        good, missing = in_order(text, [
            "Dr. Fixture Person", "fixture.person@example.org", "PROFESSIONAL PROFILE", "Alpha sentence about the profile of the candidate.",
            "ACADEMIC APPOINTMENTS", "Assistant Professor, Example University", "2024–Present", "Bravo bullet about teaching duties.",
            "Charlie bullet about supervision.", "\f", "MEMBERSHIPS", "Delta society member since 2020.", AR_HEADING, AR_SENTENCE,
            "AWARDS AND HONOURS", "Echo award for best paper, 2023.",
        ])
        ok(good, f"pdf: text in order (missing: {missing!r})\n{text}")
        ok(titles(r) == ["Header", "PROFESSIONAL PROFILE", "ACADEMIC APPOINTMENTS", "MEMBERSHIPS", AR_HEADING, "AWARDS AND HONOURS"], f"pdf: sections {titles(r)}")
        ok(section(r, "ACADEMIC APPOINTMENTS")["lines"][1:] == ["Bravo bullet about teaching duties.", "Charlie bullet about supervision."], "pdf: bullets cleaned")
        first = section(r, "ACADEMIC APPOINTMENTS")["lines"][0]
        ok(first.startswith("Assistant Professor, Example University") and first.endswith("2024–Present"), f"pdf: title and date on one line ({first!r})")
        ok(section(r, AR_HEADING)["lines"] == [AR_SENTENCE], f"pdf: Arabic line readable ({section(r, AR_HEADING)['lines']})")
        joined = "\n".join(l for s in r["sections"] for l in s["lines"])
        ok("FIXTURE CURRICULUM VITAE" not in joined and "| CV |" not in joined, "pdf: running header and footer removed from sections")
        ok(len(r["removed"]) == 4 and sum("FIXTURE CURRICULUM VITAE" in x for x in r["removed"]) == 2, f"pdf: removed lines reported ({r['removed']})")
        ok(r["guesses"] == ["other", "profile", "experience", "memberships", "experience", "awards"], f"pdf: guesses {r['guesses']}")
        ok(r["suggests"] == ["skip", "add", "skip", "add", "skip", "add"], f"pdf: suggestions {r['suggests']}")
        ok(await page.evaluate("!!(window.pdfjsLib && pdfjsLib.version === DashImport.PDFJS_VERSION)"), "pdf.js loaded on demand, vendored version")

        # ------------------------------------------------------ real CV
        r = await extract(page, REAL_CV.read_bytes(), REAL_CV.name)
        ok("error" not in r, f"real cv: no error ({r.get('error')})")
        ok(r["res"]["pages"] == 3 and r["res"]["warnings"] == [], f"real cv: three pages, no warnings ({r['res'].get('pages')}, {r['res']['warnings']})")
        want = ["Header", "PROFESSIONAL PROFILE", "ACADEMIC APPOINTMENTS", "EDUCATION", "SELECTED RESEARCH & PUBLICATIONS", "TEACHING & MENTORSHIP",
                "ACADEMIC LEADERSHIP & PROFESSIONAL SERVICE", "COMMUNITY ENGAGEMENT & RECOGNITION", "SELECTED PROFESSIONAL DEVELOPMENT", "LANGUAGES & AVAILABILITY"]
        ok(titles(r) == want, f"real cv: sections {titles(r)}")
        ok(r["guesses"] == ["other", "profile", "experience", "education", "publications", "teaching", "service", "service", "training", "languages"],
           f"real cv: guesses {r['guesses']}")
        ok(r["suggests"] == ["skip", "add", "skip", "skip", "skip", "skip", "add", "add", "add", "add"], f"real cv: suggestions {r['suggests']}")
        joined = "\n".join(l for s in r["sections"] for l in s["lines"])
        ok("ACADEMIC CURRICULUM VITAE" not in joined, "real cv: running header removed")
        ok("Academic CV |" not in joined, "real cv: page footer removed")
        ok(sum("ACADEMIC CURRICULUM VITAE" in x for x in r["removed"]) == 3 and sum("Academic CV" in x for x in r["removed"]) == 3,
           f"real cv: removed lines reported ({r['removed']})")
        header = section(r, "Header")["lines"]
        ok(header and header[0] == "DR. OMAIA AL-OMARI", f"real cv: header starts with the name ({header[:2]})")
        prof = " ".join(section(r, "PROFESSIONAL PROFILE")["lines"])
        ok("Chair of the Information Systems Department and Assistant Professor at Prince Sultan University" in prof, "real cv: profile text")
        pubs = " ".join(section(r, "SELECTED RESEARCH & PUBLICATIONS")["lines"])
        ok("Verification-Guided" in pubs and "Sparrow Search Optimization" in pubs and "Academic Research International" in pubs, "real cv: publications text")
        appts = section(r, "ACADEMIC APPOINTMENTS")["lines"]
        ok(any(l.endswith("cooperative training; advise students.") for l in appts), f"real cv: a wrapped line is re-attached ({appts[3:5]})")
        ok(any(l.endswith("examination coordination, and college-wide academic initiatives.") for l in appts), "real cv: wrapped line after a hyphenated word")
        community = section(r, "COMMUNITY ENGAGEMENT & RECOGNITION")["lines"]
        ok(any(l.startswith("747.5 certified volunteer hours") for l in community), f"real cv: bullet cleaned ({community[:1]})")
        every = " ".join(l for s in r["sections"] for l in s["lines"]) + " " + " ".join(titles(r))
        for phrase in ["Universiti Kebangsaan", "Noun Verb Extraction", "IS453", "Babylonian Journal of Networking", "Practicing Quality Ambassador", "Agile Meets Design Thinking", "Arabic (native)"]:
            ok(phrase in every, f"real cv: nothing dropped ({phrase})")

        # ------------------------------------------------- scanned PDF
        r = await extract(page, scan_pdf, "scan.pdf")
        ok("error" not in r and r["res"]["text"] == "" and r["res"]["warnings"] == ["no-text"], f"scan: empty text with no-text warning ({r})")
        ok(r["sections"] == [{"title": "Header", "lines": []}], "scan: one empty section")

        # ------------------------------------------------------ errors
        r = await extract(page, b"MZ" + b"\0" * 100, "setup.exe")
        ok(r.get("error") == "type", f"exe refused ({r})")
        r = await extract(page, b"just some text", "notes.txt")
        ok(r.get("error") == "type", f"txt refused ({r})")
        r = await extract(page, make_docx(), "archive.zip")
        ok(r.get("error") == "type", f"zip with another extension refused ({r})")
        r = await extract(page, b"%PDF-1.7\nnot really a pdf", "broken.pdf")
        ok(r.get("error") == "read", f"broken pdf reported ({r})")
        r = await extract(page, b"PK\x03\x04" + b"\0" * 200, "broken.docx")
        ok(r.get("error") == "read", f"broken docx reported ({r})")
        big = await page.evaluate("""async () => { try { await DashImport.extract(new ArrayBuffer(DashImport.MAX_BYTES + 1), 'big.pdf'); return 'no error'; }
                                     catch (e) { return e.code; } }""")
        ok(big == "too-large", f"too large refused ({big})")

        # ------------------------------------------- text-only helpers
        plain = await page.evaluate("""() => {
          const t = ['Jane Roe', 'jane@example.org', 'Education', 'BSc, 2010', 'Skills', 'Research', 'Teaching', 'Writing', 'Awards', '• Best poster 2019', 'Page 1'].join('\\n');
          const parts = DashImport.split(t);
          return { titles: parts.sections.map(s => s.title), skills: parts.sections.find(s => s.title === 'Skills').lines, removed: parts.removed,
                   awards: parts.sections.find(s => s.title === 'Awards').lines,
                   g: [DashImport.guess({title: 'Header', lines: ['x']}), DashImport.guess({title: 'المهارات', lines: []}), DashImport.guess({title: 'الدورات التدريبية', lines: []}),
                       DashImport.guess({title: 'Something', lines: ['“A long quoted title of a paper here.” 2021. doi:10.1000/x1', '“Another long quoted title of a paper.” 2022. doi:10.1000/x2']})] };
        }""")
        ok(plain["titles"] == ["Header", "Education", "Skills", "Awards"], f"title-case headings ({plain['titles']})")
        ok(plain["skills"] == ["Research", "Teaching", "Writing"], f"ambiguous words inside a list stay entries ({plain['skills']})")
        ok(plain["awards"] == ["Best poster 2019"] and plain["removed"] == ["Page 1"], f"bullet cleaned, page number removed ({plain})")
        ok(plain["g"] == ["other", "skills", "training", "publications"], f"guess helpers ({plain['g']})")

        # ------------------------------------------------------ hygiene
        violations = await page.evaluate("window.__csp")
        ok(violations == [] and csp == [], f"no CSP violations ({violations} {csp})")
        ok(errors == [], f"no page errors ({errors})")
        foreign = sorted({u for u in requests if not u.startswith(base) and not u.startswith("data:") and not u.startswith("blob:")})
        ok(foreign == [], f"only same-origin requests ({foreign})")
        loaded = sorted({u.split("?")[0].replace(base, "") for u in requests})
        ok("/admin/vendor/pdfjs/pdf.min.js" in loaded and "/admin/vendor/pdfjs/pdf.worker.min.js" in loaded, f"pdf.js and its worker came from the vendor folder ({loaded})")
        await browser.close()
    httpd.shutdown()
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"cvimport_test: all passed ({checks} checks)")


if __name__ == "__main__":
    asyncio.run(main())
