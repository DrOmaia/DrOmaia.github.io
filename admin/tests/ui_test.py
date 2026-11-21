#!/usr/bin/env python3
"""Browser test of the site dashboard (version 2) with a fake GitHub API (nothing leaves this machine).

Usage:  python3 admin/tests/ui_test.py                 real modules when they are version 2, else the stand-ins
        DASH_LIB=mock python3 admin/tests/ui_test.py   force the stand-in admin/tests/mock_lib.js (library + CV module)
        DASH_LIB=real python3 admin/tests/ui_test.py   force admin/lib.js + admin/cv.js
        DASH_IMPORT=mock|real                          same choice for admin/cvimport.js (default: real if the file exists)
Needs: pip install playwright pillow; Chrome at /usr/bin/google-chrome (or set CHROME); node (to probe lib.js).
"""
import base64
import functools
import http.server
import io
import json
import mimetypes
import os
import pathlib
import re
import subprocess
import sys
import threading
import zipfile
from urllib.parse import urlparse, unquote

from PIL import Image
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[2]
SHOTS = ROOT / "admin" / "tests" / "shots"
GOOD = "github_pat_TESTTOKEN_do_not_leak_1234567890"
BAD = "github_pat_WRONG"
REPO = "/repos/DrOmaia/DrOmaia.github.io"
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
# A made-up result in the exact format of the owner's ChatGPT achievements prompt (no real data in the repository).
SAMPLE_TEXT = """Review period: 1 June-21 November 2026
Sources: Connected mailbox, attachments, and department notes.
Duplicate check: Based on the website entries you supplied.

ITEM 1
Category: Conferences and academic service
Title (English): Technical Program Committee Member, TESTCONF 2027
Title (Arabic): عضو اللجنة الفنية لمؤتمر الاختبار 2027
Organisation: TESTCONF 2027 Organizing Committee, hosted by Example University
My role: Technical Program Committee member
Date: 19 November 2026 (appointment confirmed)
Evidence: TESTCONF 2027 Organizing Committee | "Invitation-TPC Member" | confirmation reply, 19 November 2026
Public link: https://example.org/testconf
Confidence: High
Suggest: CV
Why: The organizer acknowledged the acceptance.

ITEM 2
Category: Recognition
Title (English): Certificate of Appreciation for Judging the Sample Hackathon 2026
Title (Arabic): شهادة شكر وتقدير عن تحكيم هاكاثون الاختبار 2026
Organisation: Example Research Center
My role: Judging panel member and certificate recipient
Date: 27 October 2026 (certificate received)
Evidence: Example Research Center | "Certificate of Appreciation" | 27 October 2026
Public link: none
Confidence: High
Suggest: Both
Why: Add the certificate to the existing judging entry.

ITEM 3
Category: Leadership and accreditation
Title (English): Sample Program Granted Full Accreditation Through 2031
Title (Arabic): حصول البرنامج التجريبي على الاعتماد الكامل حتى عام 2031
Organisation: Example University, College of Computing
My role: Department chair at the time of the announcement
Date: 30 August 2026
Evidence: Dean's Office | "Celebrating Full Accreditation" | 30 August 2026
Public link: none
Confidence: High
Suggest: CV
Why: A confirmed program milestone.

ITEM 4
Category: Research - published journal article
Title (English): A Sample Study of Dashboards in Academic Websites
Title (Arabic): دراسة تجريبية عن لوحات التحكم في المواقع الأكاديمية
Organisation: Journal of Samples, 17(4)
My role: Co-author
Date: July 2026
Evidence: Journal of Samples Editorial Office | "Your manuscript is published" | 31 July 2026
Public link: https://example.org/issue/108
Confidence: High
Suggest: CV
Why: The journal confirmed publication.

ITEM 5
Category: Research - published journal article
Title (English): Another Sample Article with a DOI
Title (Arabic): مقالة تجريبية أخرى لها معرف رقمي
Organisation: Sample Modelling Journal, 17(1), article 2640021
My role: Co-author
Date: July 2026 (publication notice)
Evidence: Sample Publishing | "Vol: 17 Iss: 01" | 6 July 2026
Public link: https://doi.org/10.9999/sample.2026.1
Confidence: High
Suggest: CV
Why: The publisher supplied the DOI.

ITEM 6
Category: Research - accepted conference paper
Title (English): An Accepted Sample Conference Paper
Title (Arabic): ورقة مؤتمر تجريبية مقبولة
Organisation: SAMPLECONF 2026, hosted by Example Institute
My role: Co-author of a paper accepted for oral presentation
Date: 15 October 2026 (date of the acceptance email)
Evidence: SAMPLECONF 2026 Organizing Committee | "Paper Acceptance" | 15 October 2026
Public link: none
Confidence: High
Suggest: CV
Why: The committee confirmed acceptance.

ITEM 7
Category: Research - accepted journal manuscript
Title (English): An Accepted Sample Journal Manuscript
Title (Arabic): مخطوطة تجريبية مقبولة في دورية
Organisation: International Journal of Samples
My role: Co-author
Date: 26 September 2026
Evidence: Editorial Office | "Acceptance of Manuscript" | 26 September 2026
Public link: none
Confidence: High
Suggest: CV
Why: The letter confirms acceptance.

ITEM 8
Category: Professional development
Title (English): Certificate of Attendance, Sample Research Seminar
Title (Arabic): شهادة حضور ندوة البحث التجريبية
Organisation: Example University, College of Computing
My role: Attendee and certificate recipient
Date: 26 October 2026
Evidence: College | "Your certificate of attendance" | 26 October 2026
Public link: none
Confidence: High
Suggest: CV
Why: Attendance documented with a named certificate.

ASK ME
- Was the nominated sample project publicly showcased?
- Has the sample review received final approval?
- Does the conference entry describe an appointment or a delivered event?
- Was a corrected certificate issued?

NUMBERS
- 3 sample project examinations coordinated. Source: email threads, November 2026.
- A weekly citation figure of 14 was reported in one email.
- Full accreditation through 2031 for the sample program.
- No newer verified figures surfaced for cumulative citations.

Total items: 8
"""
# The owner's real pasted result, used for one extra count check only when it is present on this machine.
REAL_SAMPLE = pathlib.Path("/mnt/user-data/uploads/9306ccf5-attachment.txt")
AR = re.compile(r"[؀-ۿ]")


def lib_is_v2():
    if not (ROOT / "admin/lib.js").exists() or not (ROOT / "admin/cv.js").exists():
        return False
    probe = "const L=require('./admin/lib.js');process.exit(L&&L.PALETTES&&L.parseAchievements&&L.setLang&&L.FILES.includes('cv.html')?0:1)"
    try:
        return subprocess.run(["node", "-e", probe], cwd=str(ROOT), capture_output=True, timeout=60).returncode == 0
    except Exception:
        return False


mode = os.environ.get("DASH_LIB", "auto")
USE_MOCK = mode == "mock" or (mode == "auto" and not lib_is_v2())
imode = os.environ.get("DASH_IMPORT", "auto")
MOCK_IMPORT = imode == "mock" or (imode == "auto" and not (ROOT / "admin/cvimport.js").exists())
MOCK_JS = (ROOT / "admin/tests/mock_lib.js").read_text(encoding="utf-8")
IMPORT_STANDIN = MOCK_JS[MOCK_JS.index("/*IMPORT-STANDIN-START*/"):MOCK_JS.index("/*IMPORT-STANDIN-END*/")]
JS = {"Content-Type": "text/javascript; charset=utf-8"}
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, accept, x-github-api-version",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
}
NEW_DOI = "10.1234/test.2026.1"
CROSSREF = {
    "DOI": NEW_DOI, "type": "journal-article", "is-referenced-by-count": 3,
    "title": ["A Test Article About Dashboards"], "container-title": ["Journal of Tests"],
    "volume": "7", "issue": "2", "page": "10-20",
    "issued": {"date-parts": [[2026, 11, 2]]},
    "author": [{"given": "Omaia", "family": "Al-Omari"}, {"given": "Test", "family": "Author"}],
}
DATA = json.loads(re.search(r"\{.*\}", (ROOT / "research-data.js").read_text(encoding="utf-8"), re.S).group(0))
DOIS = []
for _w in DATA["works"]:
    _d = re.sub(r"^https?://(dx\.)?doi\.org/", "", (_w.get("doi") or "").strip(), flags=re.I).lower()
    if _d and _d not in DOIS:
        DOIS.append(_d)
FAIL_DOI = DOIS[0]


def crossref(route):
    doi = unquote(urlparse(route.request.url).path).split("/works/", 1)[-1].lower()
    head = {**CORS, "Content-Type": "application/json"}
    if doi == NEW_DOI:
        return route.fulfill(status=200, headers=head, body=json.dumps({"status": "ok", "message": CROSSREF}))
    if doi == FAIL_DOI:
        return route.fulfill(status=500, headers=head, body="{}")
    route.fulfill(status=200, headers=head, body=json.dumps({"status": "ok", "message": {"DOI": doi, "is-referenced-by-count": 7}}))


def png_bytes(w=900, h=600):
    img = Image.new("RGB", (w, h))
    img.putdata([(x * 255 // w, y * 255 // h, 120) for y in range(h) for x in range(w)])
    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()


def pdf_bytes(with_text=True):
    """A small valid one-page PDF; without text it has no font and no text layer (like a scan)."""
    content = b"BT /F1 18 Tf 40 700 Td (TRAINING AND CERTIFICATES) Tj ET" if with_text else b""
    font = b"/Font << /F1 5 0 R >>" if with_text else b""
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << " + font + b" >> >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
    ]
    if with_text:
        objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    out, offsets = b"%PDF-1.4\n", []
    for i, body in enumerate(objs, 1):
        offsets.append(len(out))
        out += str(i).encode() + b" 0 obj\n" + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 " + str(len(objs) + 1).encode() + b"\n0000000000 65535 f \n"
    for off in offsets:
        out += ("%010d 00000 n \n" % off).encode()
    out += b"trailer\n<< /Size " + str(len(objs) + 1).encode() + b" /Root 1 0 R >>\nstartxref\n" + str(xref).encode() + b"\n%%EOF\n"
    return out


def docx_bytes():
    paras = ["TRAINING AND CERTIFICATES", "IBM Artificial Intelligence Analyst, Mastery Award", "Course Design Institute, Coursera, 2024",
             "MEMBERSHIPS", "IEEE Member", "PUBLICATIONS", "A paper that the site already lists (2026)"]
    doc = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
           '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
           + "".join("<w:p><w:r><w:t>%s</w:t></w:r></w:p>" % p for p in paras) + "</w:body></w:document>")
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_STORED) as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
                   '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr("word/document.xml", doc)
    return out.getvalue()


PNG, PDF_TEXT, PDF_SCAN, DOCX = png_bytes(), pdf_bytes(True), pdf_bytes(False), docx_bytes()
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


class FakeGitHub:
    """Serves the repository files from disk and records what the dashboard writes."""

    def __init__(self):
        self.first = "a" * 40
        self.head = self.first
        self.commits = {self.first: {"message": "Site update by hand", "tree": "tree-initial", "parents": []}}
        self.trees, self.new_commits, self.patches, self.calls, self.blobs = [], [], [], [], []
        self.tree_paths = {}
        self.files_dir = {"old-certificate.pdf": 20480}
        self.tag_objects, self.tag_refs, self.deleted_tags = {}, {}, []

    def move_head(self, sha, message="Someone else changed the site"):
        self.commits[sha] = {"message": message, "tree": "tree-" + sha[:6], "parents": [self.head]}
        self.head = sha

    def handle(self, route):
        req = route.request
        url = urlparse(req.url)
        path = unquote(url.path)
        self.calls.append((req.method, req.url))

        def send(status, body=None, raw=None):
            headers = dict(CORS)
            if status == 204:
                return route.fulfill(status=204, headers=headers)
            if raw is not None:
                headers["Content-Type"] = "text/plain; charset=utf-8"
                route.fulfill(status=status, headers=headers, body=raw)
            else:
                headers["Content-Type"] = "application/json; charset=utf-8"
                route.fulfill(status=status, headers=headers, body=json.dumps(body if body is not None else {}))

        if req.method == "OPTIONS":
            return route.fulfill(status=204, headers=CORS)
        if req.headers.get("authorization") != "Bearer " + GOOD:
            return send(401, {"message": "Bad credentials"})
        if req.headers.get("x-github-api-version") != "2022-11-28":
            return send(400, {"message": "missing api version header"})
        if not path.startswith(REPO):
            return send(404, {"message": "Not Found"})
        sub = path[len(REPO):]
        body = json.loads(req.post_data) if req.post_data else None
        m = req.method

        if m == "GET" and sub == "/git/ref/heads/main":
            return send(200, {"ref": "refs/heads/main", "object": {"sha": self.head, "type": "commit"}})
        if m == "GET" and sub.startswith("/contents/"):
            rel = sub[len("/contents/"):]
            if "ref=" not in url.query:
                return send(404, {"message": "Not Found"})
            if rel == "files":
                return send(200, [{"name": n, "path": "files/" + n, "size": s, "type": "file"} for n, s in sorted(self.files_dir.items())])
            f = ROOT / rel
            if rel in getattr(self, "missing", ()):
                return send(404, {"message": "Not Found"})
            if "raw" not in req.headers.get("accept", "") or not f.is_file():
                return send(404, {"message": "Not Found"})
            return send(200, raw=f.read_bytes())
        if m == "GET" and sub.startswith("/git/commits/"):
            sha = sub.rsplit("/", 1)[1]
            c = self.commits.get(sha)
            if not c:
                return send(404, {"message": "Not Found"})
            return send(200, {"sha": sha, "message": c["message"], "tree": {"sha": c["tree"]}, "parents": [{"sha": p} for p in c["parents"]]})
        if m == "GET" and sub == "/commits/main":
            c = self.commits[self.head]
            return send(200, {"sha": self.head, "commit": {"message": c["message"], "committer": {"date": "2026-11-21T06:00:00Z"}}})
        if m == "POST" and sub == "/git/blobs":
            assert body["encoding"] == "base64"
            self.blobs.append(body["content"])
            return send(201, {"sha": "blob-%d" % len(self.blobs)})
        if m == "POST" and sub == "/git/trees":
            self.trees.append(body)
            sha = "tree-%d" % len(self.trees)
            self.tree_paths[sha] = [e["path"] for e in body["tree"]]
            return send(201, {"sha": sha})
        if m == "POST" and sub == "/git/commits":
            sha = ("c%d" % (len(self.new_commits) + 1)).ljust(40, "0")
            self.new_commits.append(body)
            self.commits[sha] = {"message": body["message"], "tree": body["tree"], "parents": body["parents"]}
            return send(201, {"sha": sha})
        if m == "PATCH" and sub == "/git/refs/heads/main":
            self.patches.append(body)
            if self.commits.get(body["sha"], {}).get("parents") != [self.head]:
                return send(422, {"message": "Update is not a fast forward"})
            self.head = body["sha"]
            for p in self.tree_paths.get(self.commits[self.head]["tree"], []):
                if p.startswith("files/"):
                    self.files_dir[p[len("files/"):]] = 1234
            return send(200, {"object": {"sha": self.head}})
        # --- approved versions (annotated tags)
        if m == "GET" and sub.startswith("/git/matching-refs/tags/"):
            prefix = sub[len("/git/matching-refs/tags/"):]
            return send(200, [{"ref": "refs/tags/" + t, "object": {"sha": o, "type": "tag"}} for t, o in sorted(self.tag_refs.items()) if t.startswith(prefix)])
        if m == "POST" and sub == "/git/tags":
            sha = "tagobj-%d" % (len(self.tag_objects) + 1)
            self.tag_objects[sha] = body
            return send(201, {"sha": sha, "tag": body["tag"]})
        if m == "POST" and sub == "/git/refs":
            tag = body["ref"][len("refs/tags/"):]
            if not body["ref"].startswith("refs/tags/") or tag in self.tag_refs or body["sha"] not in self.tag_objects:
                return send(422, {"message": "Reference already exists"})
            self.tag_refs[tag] = body["sha"]
            return send(201, {"ref": body["ref"], "object": {"sha": body["sha"], "type": "tag"}})
        if m == "GET" and sub.startswith("/git/tags/"):
            t = self.tag_objects.get(sub.rsplit("/", 1)[1])
            if not t:
                return send(404, {"message": "Not Found"})
            return send(200, {"tag": t["tag"], "message": t["message"], "object": {"sha": t["object"], "type": "commit"}})
        if m == "GET" and sub.startswith("/git/ref/tags/"):
            tag = sub[len("/git/ref/tags/"):]
            if tag not in self.tag_refs:
                return send(404, {"message": "Not Found"})
            return send(200, {"ref": "refs/tags/" + tag, "object": {"sha": self.tag_refs[tag], "type": "tag"}})
        if m == "DELETE" and sub.startswith("/git/refs/tags/"):
            tag = sub[len("/git/refs/tags/"):]
            if tag not in self.tag_refs:
                return send(422, {"message": "Reference does not exist"})
            del self.tag_refs[tag]
            self.deleted_tags.append(tag)
            return send(204)
        return send(404, {"message": "Not Found"})


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    handler = functools.partial(Quiet, directory=str(ROOT))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def live_site(route):
    """The preview iframe asks the live site for css/images: answer from this checkout."""
    f = ROOT / unquote(urlparse(route.request.url).path).lstrip("/")
    if f.is_dir():
        f = f / "index.html"
    if not f.is_file():
        return route.fulfill(status=404, body="")
    route.fulfill(status=200, body=f.read_bytes(), headers={"Content-Type": mimetypes.guess_type(str(f))[0] or "application/octet-stream", "Access-Control-Allow-Origin": "*"})


def new_context(browser, width, height, gh):
    ctx = browser.new_context(viewport={"width": width, "height": height}, locale="ar-SA")
    ctx.grant_permissions(["clipboard-read", "clipboard-write"])
    ctx.route("https://api.github.com/**", gh.handle)
    ctx.route("https://api.crossref.org/**", crossref)
    ctx.route("https://dromaia.github.io/**", live_site)
    ctx.route("https://fonts.googleapis.com/**", lambda r: r.fulfill(status=200, headers={"Content-Type": "text/css"}, body=""))
    ctx.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    if USE_MOCK:
        ctx.route("**/admin/lib.js*", lambda r: r.fulfill(status=200, headers=JS, body=MOCK_JS))
        ctx.route("**/admin/cv.js*", lambda r: r.fulfill(status=200, headers=JS, body="/* stand-in CV module is inside mock_lib.js */"))
        ctx.route("**/admin/portfolio.js*", lambda r: r.fulfill(status=200, headers=JS, body="/* stand-in portfolio module is inside mock_lib.js */"))
    if MOCK_IMPORT:
        ctx.route("**/admin/cvimport.js*", lambda r: r.fulfill(status=200, headers=JS, body=IMPORT_STANDIN))
    return ctx


# Interface text of the other language left on the screen (site content and the language buttons are exempt).
LEFT_ARABIC = """() => {
  const out = [], w = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const p = n.parentElement;
    if (!p || p.closest('[data-content], .seg.lang, textarea, option') || !p.offsetParent) continue;
    if (/[\\u0600-\\u06FF]/.test(n.nodeValue)) out.push(n.nodeValue.trim().slice(0, 40));
  }
  document.querySelectorAll('#app option').forEach(o => { if (/[\\u0600-\\u06FF]/.test(o.textContent) && !o.closest('[data-k=match],[data-k=appt]')) out.push('option:' + o.textContent.slice(0, 30)); });
  document.querySelectorAll('#app [placeholder], #app [aria-label], #app [title]').forEach(e => {
    for (const a of ['placeholder', 'aria-label', 'title']) { const v = e.getAttribute(a) || ''; if (/[\\u0600-\\u06FF]/.test(v) && !e.closest('.seg.lang')) out.push(a + ':' + v.slice(0, 30)); }
  });
  return out;
}"""
LEFT_ENGLISH = """() => {
  const out = [], ok = /^[\\s\\d↑↓＋+✓·:()\\-–—.#/]*$/;
  document.querySelectorAll('#app .tab, #app h1, #app h2, #app h3, #app .btn, #app .f-l, #app summary, #app .seg button').forEach(e => {
    if (e.closest('[data-content], .seg.lang') || e.hasAttribute('data-content') || !e.offsetParent) return;
    const t = e.textContent.trim();
    if (!t || ok.test(t) || /[\\u0600-\\u06FF]/.test(t)) return;
    out.push(e.tagName + ':' + t.slice(0, 40));
  });
  return out;
}"""
TABS = ["works", "numbers", "sections", "texts", "look", "cv", "import", "files", "ai", "publish"]


def sign_in(page, base, remember=False):
    page.goto(base + "/admin/")
    expect(page.locator("#token")).to_be_visible()
    page.fill("#token", GOOD)
    if remember:
        page.check("#remember")
    page.click("#signBtn")
    expect(page.locator(".tabs")).to_be_visible()


def run(browser, base, width, height, shots):
    gh = FakeGitHub()
    ctx = new_context(browser, width, height, gh)
    page = ctx.new_page()
    errors, urls, logs = [], [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: logs.append(m.text))
    page.on("request", lambda r: urls.append(r.url))
    tag = "%d" % width

    def no_hscroll(where):
        over = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        assert over <= 0, "horizontal scroll at %s (%dpx, width %d)" % (where, over, width)

    def shot(name):
        if shots:
            page.screenshot(path=str(SHOTS / ("%s_ar_%s.png" % (tag, name))), full_page=True)

    def tab(name):
        page.click('.tab[data-tab="%s"]' % name)
        expect(page.locator('.tab[data-tab="%s"]' % name)).to_have_attribute("aria-selected", "true")

    def badge(n):
        expect(page.locator("#badge")).to_have_text("تعديلات غير منشورة: %d" % n)

    def arabic_ok(where):
        left = page.evaluate(LEFT_ENGLISH)
        assert not left, "English interface text in the Arabic dashboard at %s: %r" % (where, left)

    def open_fold(key):
        loc = page.locator('details[data-editor="%s"]' % key)
        if loc.get_attribute("open") is None:
            loc.locator("> summary").click()
        expect(loc).to_have_attribute("open", "")
        return loc

    def choose(selector, name, mime, data):
        page.set_input_files(selector, {"name": name, "mimeType": mime, "buffer": data})

    # ---------- sign in: language switch on the sign-in screen, wrong token, then the good one
    page.goto(base + "/admin/")
    expect(page.locator("#token")).to_be_visible()
    assert page.locator('meta[name="robots"]').get_attribute("content").startswith("noindex")
    keys = page.evaluate("window.DashUI.keys")
    assert sorted(keys["ar"]) == sorted(keys["en"]) and len(keys["ar"]) > 300, "the two dictionaries differ"
    assert page.evaluate("[document.documentElement.lang, document.documentElement.dir]") == ["ar", "rtl"]
    page.click(".steps summary")
    arabic_ok("sign-in"); no_hscroll("sign-in"); shot("00_signin")
    page.click('[data-lang="en"]')
    expect(page.locator("#signBtn")).to_have_text("Sign in")
    assert page.evaluate("[document.documentElement.lang, document.documentElement.dir, localStorage.getItem('dash.lang')]") == ["en", "ltr", "en"]
    assert not page.evaluate(LEFT_ARABIC), "Arabic left on the English sign-in screen: %r" % page.evaluate(LEFT_ARABIC)
    page.click("#signBtn")
    expect(page.locator("#signErr")).to_contain_text("Paste the token")
    page.click('[data-lang="ar"]')
    expect(page.locator("#signErr")).to_contain_text("الصق المفتاح")
    page.fill("#token", BAD)
    page.click("#signBtn")
    expect(page.locator("#signErr")).to_contain_text("المفتاح غير صحيح")
    assert BAD not in page.locator("#signErr").inner_text()
    remember = width < 700
    page.fill("#token", GOOD)
    if remember:
        page.check("#remember")
    page.click("#signBtn")
    expect(page.locator(".tabs")).to_be_visible()
    stored = page.evaluate("[localStorage.getItem('dash.token'), sessionStorage.getItem('dash.token')]")
    assert stored == ([GOOD, None] if remember else [None, GOOD]), "token stored in the wrong place"
    assert [t.get_attribute("data-tab") for t in page.locator(".tab").all()] == TABS
    is_mock = page.evaluate("!!window.DashLib.MOCK")
    assert is_mock == USE_MOCK
    import_mock = page.evaluate("!!(window.DashImport && window.DashImport.MOCK)")
    n_works = page.locator("#workList .item").count()
    assert n_works >= 40
    expect(page.locator("#badge")).to_be_hidden()
    arabic_ok("works"); no_hscroll("works"); shot("01_works")
    tab("publish")
    expect(page.locator("#noChanges")).to_be_visible()
    expect(page.locator("#publishBtn")).to_be_disabled()
    assert page.locator("#fileList").count() == 0

    # ---------- approved versions: save the untouched site, marker on the current one
    expect(page.locator("#verNone")).to_be_visible()
    page.click("#verSave")
    expect(page.locator("#verMsg")).to_contain_text("اكتب اسمًا")
    page.fill("#verName", "النسخة الأولى")
    page.click("#verSave")
    expect(page.locator("#verMsg")).to_contain_text("حُفظت النسخة")
    expect(page.locator("#verList .item")).to_have_count(1)
    first_tag = page.locator("#verList .item").first.get_attribute("data-tag")
    assert re.fullmatch(r"stable-\d{8}-\d{6}", first_tag), first_tag
    saved = gh.tag_objects[gh.tag_refs[first_tag]]
    assert saved == {"tag": first_tag, "message": "النسخة الأولى", "object": gh.first, "type": "commit"}, saved
    ver = page.locator('#verList .item[data-tag="%s"]' % first_tag)
    expect(ver).to_have_attribute("data-current", "1")
    expect(ver).to_contain_text("النسخة الأولى")
    expect(ver).to_contain_text(gh.first[:7])
    assert ver.locator('[data-ask^="ver-restore"]').count() == 0, "the current version must not offer restore"
    tab("works")

    # ---------- works: DOI autofill, add, citations
    page.click("#addWork")
    expect(page.locator("#workForm h2")).to_contain_text("P41")
    page.click("#doiBtn")
    expect(page.locator("#doiNote")).to_contain_text("اكتب رقم DOI")
    page.fill("#doiLookup", "https://doi.org/" + NEW_DOI)
    page.click("#doiBtn")
    expect(page.locator("#doiNote")).to_contain_text("جُلبت البيانات")
    expect(page.locator("#fTitle")).to_have_value("A Test Article About Dashboards")
    expect(page.locator("#fYear")).to_have_value("2026")
    assert NEW_DOI in page.input_value("#fDoi")
    assert page.input_value("#fReference").strip() != ""
    if is_mock:
        page.click("#saveWork")
        expect(page.locator("#formErrors")).to_contain_text("المساهمة")
    page.fill("#fMethods", "playwright, fake API")
    page.fill("#fContribution", "Al-Omari and Author (2026) test that the dashboard publishes a new work.")
    no_hscroll("work form"); shot("01b_work_form")
    page.click("#saveWork")
    expect(page.locator("#workForm")).to_have_count(0)
    first = page.locator("#workList .item").first
    expect(first).to_have_attribute("data-id", "P41")
    badge(1)
    page.fill("#workSearch", "dashboards")
    expect(page.locator("#workList .item")).to_have_count(1)
    page.fill("#workSearch", "")
    page.click('#workList .item[data-id="P01"] [data-ask="del-P01"]')
    expect(page.locator('[data-yes="del-P01"]')).to_be_visible()
    page.click('[data-no="del-P01"]')
    expect(page.locator('#workList .item[data-id="P01"]')).to_have_count(1)
    page.click("#citesBtn")
    expect(page.locator("#citesNote")).to_contain_text("مجموع الاستشهادات", timeout=30000)
    note = page.locator("#citesNote").inner_text()
    assert "تعذّر 1" in note, note
    wanted = len(DOIS) + 1
    assert ("قُرئ %d " % (wanted - 1)) in note, (note, wanted)
    new_total = int(re.search(r"←\s*(\d+)", note).group(1))
    assert new_total == 7 * (len(DOIS) - 1) + 3, note
    badge(2)
    shot("01c_citations")

    # ---------- numbers and news
    tab("numbers")
    page.fill('[data-metric="1"] [data-k="value"]', "600+")
    auto = page.locator('[data-metric="3"] [data-k="value"]')
    expect(auto).to_have_value(str(n_works + 1))
    assert auto.get_attribute("readonly") is not None
    before_news = page.locator("#newsList .item").count()
    page.click("#addNews")
    expect(page.locator("#newsList .item")).to_have_count(before_news + 1)
    page.fill('[data-news="0"] [data-k="en"]', "Dashboard test line <b>&</b>")
    page.fill('[data-news="0"] [data-k="ar"]', "سطر اختبار للوحة")
    page.click('[data-news="0"] [data-move="down"]')
    expect(page.locator('[data-news="1"] [data-k="ar"]')).to_have_value("سطر اختبار للوحة")
    badge(4)
    arabic_ok("numbers"); no_hscroll("numbers"); shot("02_numbers")

    # ---------- sections: hide, custom section, lists
    tab("sections")
    ids = [e.get_attribute("data-sec") for e in page.locator("#secList > .item").all()]
    assert ids == ["leadership", "research", "teaching", "experience", "contact"], ids
    page.click('[data-sec-toggle="research"]')
    expect(page.locator('#secList .item[data-sec="research"] .tag')).to_have_text("مخفي")
    page.click("#addSection")
    ids = [e.get_attribute("data-sec") for e in page.locator("#secList > .item").all()]
    assert ids == ["leadership", "research", "teaching", "experience", "custom-1", "contact"], ids
    sec = page.locator('#secList .item[data-sec="custom-1"]')
    sec.locator('[data-k="kicker.en"]').first.fill("Recognition")
    sec.locator('[data-k="kicker.ar"]').first.fill("التقدير")
    sec.locator('[data-k="title.en"]').first.fill("Awards and grants")
    sec.locator('[data-k="title.ar"]').first.fill("الجوائز والمنح")
    sec.locator('[data-k="intro.en"]').first.fill("Selected recognition.")
    sec.locator('[data-k="intro.ar"]').first.fill("تقدير مختار.")
    page.click('[data-add-card="custom-1"]')
    card = sec.locator('[data-card="0"]')
    card.locator('[data-k="title.en"]').fill("Test award <2026>")
    card.locator('[data-k="title.ar"]').fill("جائزة اختبار")
    card.locator('[data-k="text.en"]').fill("Given for testing.")
    card.locator('[data-k="text.ar"]').fill("مُنحت للاختبار.")
    card.locator('[data-k="link"]').fill("https://example.org/award")
    sec.locator('> .row [data-move="up"]').click()
    ids = [e.get_attribute("data-sec") for e in page.locator("#secList > .item").all()]
    assert ids.index("custom-1") == 3, ids
    expect(page.locator('#secList .item[data-sec="custom-1"] .sec-t')).to_have_text("الجوائز والمنح")
    assert page.locator('#secList .item[data-sec="leadership"] [data-ask^="sec-"]').count() == 0, "built-in sections cannot be deleted"
    assert page.evaluate("document.querySelectorAll('#secList .item[data-sec=\"custom-1\"] [data-ask=\"sec-custom-1\"]').length") == 1
    badge(5)
    fold = open_fold("flagship")
    n_flag = fold.locator(".item").count()
    page.click("#add-flagship")
    item = page.locator('[data-list="flagship"][data-i="%d"]' % n_flag)
    item.locator('[data-k="code"]').fill("IS999")
    item.locator('[data-k="en"]').fill("Dashboard Studies")
    item.locator('[data-k="ar"]').fill("دراسات اللوحة")
    badge(6)
    fold = open_fold("timeline")
    assert fold.locator(".item").count() >= 5
    first_time = page.locator('[data-list="timeline"][data-i="0"] [data-k="time"]').input_value()
    assert first_time.strip() != ""
    fold = open_fold("roles")
    before_roles = fold.locator(".item").count()
    page.click("#add-roles")
    r0 = page.locator('[data-list="roles"][data-i="0"]')
    r0.locator('[data-k="org"]').fill("TEST ORG")
    r0.locator('[data-k="en"]').fill("Test role")
    r0.locator('[data-k="ar"]').fill("دور اختباري")
    expect(page.locator('[data-list="roles"]')).to_have_count(before_roles + 1)
    badge(7)
    for k in ("courses", "timelineEarlier"):
        open_fold(k)
    arabic_ok("sections"); no_hscroll("sections"); shot("03_sections")

    # ---------- texts
    tab("texts")
    assert page.locator("#textList .item").count() <= 30
    first_text = page.locator('#textList .item [data-k="ar"]').first
    first_text.fill(first_text.input_value() + " (تجربة)")
    page.fill("#textSearch", "zzzz-no-such-text")
    expect(page.locator("#textList .item")).to_have_count(0)
    page.fill("#textSearch", "تجربة")
    expect(page.locator("#textList .item")).to_have_count(1)
    badge(8)
    arabic_ok("texts"); no_hscroll("texts"); shot("04_texts")

    # ---------- look: fonts, palette, custom colours, portrait
    tab("look")
    assert page.locator("link[data-preview-font]").count() >= 3, "Arabic sample fonts are loaded when the group is open"
    target = page.evaluate("(() => { const cur = document.querySelector('input[name=font-ar]:checked').value; return window.DashLib.FONTS.ar.map(f => f.name).find(n => n !== cur); })()")
    page.check('label[data-font="%s"] input[name="font-ar"]' % target)
    expect(page.locator('details[data-editor="ar"] label[data-font="%s"]' % target)).to_have_class("font on")
    badge(9)
    head_before = page.locator("link[data-preview-font]").count()
    open_fold("head")
    head_target = page.evaluate("(() => { const cur = document.querySelector('input[name=font-head]:checked').value; return window.DashLib.FONTS.head.map(f => f.name).find(n => n !== cur); })()")
    page.check('label[data-font="%s"] input[name="font-head"]' % head_target)
    assert page.locator("link[data-preview-font]").count() >= head_before
    assert page.evaluate("[...document.querySelectorAll('link[data-preview-font]')].every(l => !(window.DashLib.FONTS.head.concat(window.DashLib.FONTS.ar, window.DashLib.FONTS.en).find(f => f.name === l.dataset.previewFont) || {}).system)"), "system fonts are not requested"
    pal = page.evaluate("window.DashLib.PALETTES.map(p => p.id)")
    assert pal[0] == "default" and len(pal) >= 3, pal
    assert page.locator(".pal").count() == len(pal) + 1
    page.check('label[data-palette="%s"] input' % pal[1])
    expect(page.locator('label[data-palette="%s"]' % pal[1])).to_have_class("pal on")
    badge(10)
    assert page.locator('[data-mode="light"]').count() == 0
    page.check('label[data-palette="custom"] input')
    expect(page.locator('[data-mode="light"]')).to_be_visible()
    expect(page.locator('[data-mode="dark"] h3').first).to_have_text("داكن")
    start_bg = page.input_value('[data-color="light.bg"]')
    assert re.fullmatch(r"#[0-9a-f]{6}", start_bg), start_bg
    expect(page.locator('#contrast-light [data-ct="textBg"]')).to_have_attribute("data-ok", "1")
    page.fill('[data-color="light.text"]', "#f4f4f4")
    expect(page.locator('#contrast-light [data-ct="textBg"]')).to_have_attribute("data-ok", "0")
    expect(page.locator('#contrast-light [data-ct="textBg"]')).to_contain_text("أقل من 4.5")
    shot("05b_contrast")
    page.fill('[data-color="light.text"]', "#12")
    expect(page.locator('[data-mode="light"] .bad-t').nth(2)).to_be_visible()
    page.fill('[data-color="light.text"]', "#14202a")
    expect(page.locator('#contrast-light [data-ct="textBg"]')).to_have_attribute("data-ok", "1")
    assert page.input_value('[data-colorpick="light.text"]') == "#14202a"
    page.fill('[data-color="light.accent"]', "#6b4a0c")
    choose("#photoInput", "notes.txt", "text/plain", b"hello")
    expect(page.locator("#photoErr")).to_contain_text("JPG")
    choose("#photoInput", "me.png", "image/png", PNG)
    expect(page.locator("#photoUse")).to_be_visible(timeout=20000)
    assert page.locator("#photoNew").get_attribute("src").startswith("data:image/webp;base64,")
    page.click("#photoUse")
    expect(page.locator("#photoPending")).to_be_visible()
    badge(11)
    arabic_ok("look"); no_hscroll("look"); shot("05_look")

    # ---------- cv: owner blocks, full-only sections, appointment details, preview, file import
    tab("cv")
    expect(page.locator("#cvProfile")).to_be_visible()
    page.fill("#cvProfile", page.input_value("#cvProfile") + " Dashboard-edited profile sentence.")
    open_fold("cv-accepted")
    n_acc = page.locator('[data-list="cv-accepted"]').count()
    page.click("#add-cv-accepted")
    acc = page.locator('[data-list="cv-accepted"][data-i="%d"]' % n_acc)
    acc.locator('[data-k="text"]').fill("An accepted test paper. Journal of Tests.")
    fold = open_fold("cv-fullExtra")
    n_full = fold.locator(".item").count()
    page.click("#add-cv-fullExtra")
    fe = page.locator('[data-list="cv-fullExtra"][data-i="%d"]' % n_full)
    fe.locator('[data-k="title"]').fill("Memberships")
    fe.locator('[data-k="items"]').fill("IEEE Member\n\n ACM Member ")
    fold = open_fold("cv-appointmentDetails")
    n_ap = fold.locator(".item").count()
    page.click("#add-cv-appointmentDetails")
    ap = page.locator('[data-list="cv-appointmentDetails"][data-i="%d"]' % n_ap)
    options = ap.locator('select[data-k="match"] option').all_text_contents()
    assert len(options) >= 8 and any("Chair" in o for o in options), options
    ap.locator('select[data-k="match"]').select_option(index=1)
    ap.locator('[data-k="bullets"]').fill("Led the dashboard test.\nSecond bullet.")
    badge(12)
    assert [x.get_attribute("data-link") for x in page.locator("#cvLinks .linkrow").all()] == ["short", "full"]
    assert page.locator('#cvLinks [data-link="full"] a').get_attribute("href") == "https://dromaia.github.io/cv.html#full"
    page.click('#cvLinks [data-link="full"] [data-copy]')
    expect(page.locator('#cvLinks [data-link="full"] [data-copy]')).to_have_text("نُسخ ✓")
    assert page.evaluate("navigator.clipboard.readText()") == "https://dromaia.github.io/cv.html#full"
    page.click("#cvPreviewBtn")
    expect(page.locator("#cvPreview")).to_be_visible()
    doc = page.locator("#cvPreview").get_attribute("srcdoc")
    assert "Dashboard-edited profile sentence." in doc and '<base href="https://dromaia.github.io/">' in doc, "the CV preview shows the built page"
    assert page.locator("#cvPreview").get_attribute("sandbox") == ""
    mode_class = page.evaluate("(window.DashCV && window.DashCV.MODE_CLASS) || 'cv-full'")
    assert not re.search(r'<html\b[^>]*class="[^"]*\b%s\b' % re.escape(mode_class), doc), "short is the default"
    page.click('[data-cvmode="full"]')
    doc = page.locator("#cvPreview").get_attribute("srcdoc")
    assert re.search(r'<html\b[^>]*class="[^"]*\b%s\b' % re.escape(mode_class), doc), "the full switch adds the page's mode class"
    assert "IEEE Member" in doc and "Led the dashboard test." in doc
    shot("06b_cv_preview")
    page.click("#cvPreviewBtn")
    # import a CV file
    open_fold("cv-import")
    expect(page.locator("#cviPrivacy")).to_contain_text("لا يُرفع")
    choose("#cviInput", "cv.txt", "text/plain", b"plain text")
    expect(page.locator("#cviErr")).to_contain_text("PDF")
    choose("#cviInput", "scan.pdf", "application/pdf", PDF_SCAN)
    expect(page.locator("#cviNoText")).to_contain_text("DOCX", timeout=30000)
    assert page.locator("#cviList").count() == 0, "a scanned PDF offers no sections"
    choose("#cviInput", "My CV.docx", DOCX_MIME, DOCX)
    expect(page.locator("#cviList .item").first).to_be_visible(timeout=30000)
    cards = page.locator("#cviList .item")
    assert cards.count() >= 2
    kinds = [c.get_attribute("data-kind") for c in cards.all()]
    acts = [c.locator('select[data-k="action"]').input_value() for c in cards.all()]
    for kind, act in zip(kinds, acts):
        if kind in ("publications", "education", "profile", "languages", "experience", "teaching", "service"):
            assert act == "skip", "what the site already covers is skipped by default: %r" % ((kind, act),)
    assert "full" in acts, (kinds, acts)
    i_full = acts.index("full")
    cards.nth(i_full).locator('[data-k="title"]').fill("Training and certificates")
    other = [i for i in range(len(acts)) if i != i_full][0]
    cards.nth(other).locator('select[data-k="action"]').select_option("appt")
    expect(cards.nth(other).locator('select[data-k="appt"]')).to_be_visible()
    lines_other = [l for l in cards.nth(other).locator('[data-k="text"]').input_value().splitlines() if l.strip()]
    for i in range(len(acts)):
        if i not in (i_full, other):
            cards.nth(i).locator('select[data-k="action"]').select_option("skip")
    page.click("#cviApply")
    expect(page.locator("#cviMsg")).to_contain_text("أُضيف 2")
    expect(cards.nth(i_full).locator('[data-done]')).to_be_visible()
    assert cards.nth(i_full).locator('[data-k="title"]').is_disabled()
    page.click("#cviApply")
    expect(page.locator("#cviMsg")).to_contain_text("لم تختر")
    expect(page.locator('[data-list="cv-fullExtra"]')).to_have_count(n_full + 2)
    assert page.locator('[data-list="cv-fullExtra"][data-i="%d"] [data-k="title"]' % (n_full + 1)).input_value() == "Training and certificates"
    arabic_ok("cv"); no_hscroll("cv"); shot("06_cv")

    # ---------- import the ChatGPT result
    tab("import")
    page.click("#impGo")
    expect(page.locator("#impNone")).to_be_visible()
    if REAL_SAMPLE.exists():
        page.fill("#impText", REAL_SAMPLE.read_text(encoding="utf-8"))
        page.click("#impGo")
        expect(page.locator("#impList .imp-item")).to_have_count(8)
        expect(page.locator("#impAsk li")).to_have_count(4)
        expect(page.locator("#impNumbers li")).to_have_count(4)
        page.click("#impClear")
        expect(page.locator("#impList")).to_have_count(0)
    page.fill("#impText", SAMPLE_TEXT)
    page.click("#impGo")
    expect(page.locator("#impList .imp-item")).to_have_count(8)
    expect(page.locator("#impAsk li")).to_have_count(4)
    expect(page.locator("#impNumbers li")).to_have_count(4)
    one = page.locator('.imp-item[data-n="1"]')
    expect(one).to_contain_text("Technical Program Committee Member, TESTCONF 2027")
    expect(one).to_contain_text("عضو اللجنة الفنية")
    expect(one).to_contain_text("Example University")
    one.locator('[data-imp="news"]').click()
    expect(page.locator('.imp-item[data-n="1"] [data-done="news"]')).to_be_visible()
    assert page.locator('.imp-item[data-n="1"] [data-imp="news"]').count() == 0, "an accepted action cannot be used twice"
    page.locator('.imp-item[data-n="3"] [data-imp="role"]').click()
    page.locator('.imp-item[data-n="3"] [data-imp="cv"]').click()
    page.locator('.imp-item[data-n="8"] [data-imp="skip"]').click()
    expect(page.locator('.imp-item[data-n="8"]')).to_contain_text("تم تجاهل")
    arabic_ok("import"); no_hscroll("import"); shot("07_import")
    tab("numbers")
    expect(page.locator('[data-news="0"] [data-k="en"]')).to_have_value("Technical Program Committee Member, TESTCONF 2027")
    expect(page.locator('[data-news="0"] [data-k="ar"]')).to_have_value("عضو اللجنة الفنية لمؤتمر الاختبار 2027")
    expect(page.locator('[data-news="0"] [data-k="year"]')).to_have_value("2026")
    tab("sections")
    expect(page.locator('[data-list="roles"][data-i="0"] [data-k="en"]')).to_have_value("Sample Program Granted Full Accreditation Through 2031")
    tab("cv")
    open_fold("cv-extraService")
    expect(page.locator('[data-list="cv-extraService"][data-i="0"] [data-k="title"]')).to_have_value("Sample Program Granted Full Accreditation Through 2031")

    # ---------- files
    tab("files")
    expect(page.locator('#publishedFiles li[data-path="files/old-certificate.pdf"]')).to_be_visible()
    page.click('#publishedFiles li[data-path="files/old-certificate.pdf"] [data-copy]')
    assert page.evaluate("navigator.clipboard.readText()") == "https://dromaia.github.io/files/old-certificate.pdf"
    page.set_input_files("#fileInput", [
        {"name": "تقرير Report 2026 (final).pdf", "mimeType": "application/pdf", "buffer": PDF_TEXT},
        {"name": "setup.exe", "mimeType": "application/x-msdownload", "buffer": b"MZ\x90\x00"},
        {"name": "fake.pdf", "mimeType": "application/pdf", "buffer": b"this is not a pdf at all"},
        {"name": "chart.png", "mimeType": "image/png", "buffer": PNG},
    ])
    expect(page.locator("#pendingFiles li")).to_have_count(2)
    paths = sorted(e.get_attribute("data-path") for e in page.locator("#pendingFiles li").all())
    assert paths == ["files/Report-2026-final.pdf", "files/chart.png"], paths
    errs = page.locator("#fileErr li").all_text_contents()
    assert len(errs) == 2 and any("setup.exe" in e for e in errs) and any("fake.pdf" in e for e in errs), errs
    page.click('[data-remove="files/chart.png"]')
    expect(page.locator("#pendingFiles li")).to_have_count(1)
    badge(13)
    arabic_ok("files"); no_hscroll("files"); shot("08_files")

    # ---------- AI helper
    tab("ai")
    expect(page.locator("#guideText")).to_be_visible()
    guide = (ROOT / "admin/ai-guide.md").read_text(encoding="utf-8")
    assert page.input_value("#guideText") == guide
    assert page.locator("#guideText").get_attribute("readonly") is not None
    page.click("#guideCopy")
    expect(page.locator("#guideCopy")).to_have_text("نُسخ ✓")
    assert page.evaluate("navigator.clipboard.readText()").replace("\r\n", "\n") == guide
    arabic_ok("ai"); no_hscroll("ai"); shot("09_ai")

    # ---------- the draft survives a reload, and says which files to choose again
    page.wait_for_timeout(450)
    page.reload()
    expect(page.locator("#draftGate")).to_contain_text("مسودة غير منشورة")
    assert page.locator(".tabs").count() == 0
    draft = page.evaluate("JSON.parse(localStorage.getItem('dash.draft'))")
    assert sorted(draft["pendingNames"]) == ["PhotoDrOmaia.webp", "files/Report-2026-final.pdf"], draft["pendingNames"]
    assert "base64" not in json.dumps(draft) and len(json.dumps(draft)) < 2_000_000, "binary files must not be stored in the draft"
    shot("10_draft")
    page.click("#draftKeep")
    expect(page.locator("#restoreNote")).to_contain_text("PhotoDrOmaia.webp")
    expect(page.locator("#restoreNote")).to_contain_text("files/Report-2026-final.pdf")
    expect(page.locator("#restoreNote")).to_contain_text("اختر هذه الملفات من جديد")
    badge(11)  # the two binary changes are gone until he chooses the files again
    expect(page.locator('#workList .item[data-id="P41"]')).to_have_count(1)
    page.click("#restoreOk")
    tab("import")
    expect(page.locator('.imp-item[data-n="1"] [data-done="news"]')).to_be_visible()
    tab("look")
    choose("#photoInput", "me.png", "image/png", PNG)
    page.click("#photoUse")
    expect(page.locator("#photoPending")).to_be_visible()
    tab("files")
    choose("#fileInput", "تقرير Report 2026 (final).pdf", "application/pdf", PDF_TEXT)
    expect(page.locator("#pendingFiles li")).to_have_count(1)
    badge(13)

    # ---------- publish tab: summary, files, binaries, preview
    tab("publish")
    expect(page.locator("#summary li").first).to_be_visible()
    files = page.locator("#fileList li").all_text_contents()
    for needed in ("index.html", "ar/index.html", "research-data.js", "cv.html"):
        assert needed in files, "%s missing from the changed files %r" % (needed, files)
    bins = sorted(e.get_attribute("data-path") for e in page.locator("#binList li").all())
    assert bins == ["PhotoDrOmaia.webp", "files/Report-2026-final.pdf"], bins
    expect(page.locator('#binList li[data-path="PhotoDrOmaia.webp"]')).to_contain_text("KB")
    srcdoc = page.locator("#preview").get_attribute("srcdoc")
    assert len(srcdoc) > 5000 and '<base href="https://dromaia.github.io/ar/">' in srcdoc and 'dir="rtl"' in srcdoc
    assert page.locator("#preview").get_attribute("sandbox") == ""
    assert "سطر اختبار للوحة" in srcdoc and "الجوائز والمنح" in srcdoc
    page.wait_for_timeout(600)
    arabic_ok("publish"); no_hscroll("publish"); shot("11_publish")
    page.click('.seg [data-pv="en"]')
    srcdoc = page.locator("#preview").get_attribute("srcdoc")
    assert '<base href="https://dromaia.github.io/">' in srcdoc and "Dashboard test line &lt;b&gt;&amp;&lt;/b&gt;" in srcdoc, "user text must be escaped in the page"
    assert "Awards and grants" in srcdoc and "Test award &lt;2026&gt;" in srcdoc and "custom-1" in srcdoc, "the custom section is in the page"
    assert re.search(r'<section\b(?=[^>]*\bid="research")(?=[^>]*\shidden\b)', srcdoc), "the hidden section carries the hidden attribute"
    assert "Dashboard Studies" in srcdoc and "IS999" in srcdoc
    page.click('.seg [data-pv="publications.html"]')
    assert "publicationList" in page.locator("#preview").get_attribute("srcdoc")
    page.click('.seg [data-pv="cv.html"]')
    srcdoc = page.locator("#preview").get_attribute("srcdoc")
    assert "Dashboard-edited profile sentence." in srcdoc and "Training and certificates" in srcdoc
    assert page.locator('.seg [data-pv="ar"]').count() == 0 and page.locator('[data-cvmode="short"]').count() == 1
    page.click('.seg [data-pv="index.html"]')
    expect(page.locator("#lastInfo")).to_contain_text("Site update by hand")
    expect(page.locator("#undoOff")).to_be_visible()
    # a version cannot be saved while edits are unpublished
    page.fill("#verName", "قبل النشر")
    page.click("#verSave")
    expect(page.locator("#verMsg")).to_contain_text("انشرها أولًا")
    assert len(gh.tag_refs) == 1

    # ---------- someone else changed the site: nothing is published, reload is offered
    gh.move_head("b" * 40)
    page.click("#publishBtn")
    page.click("#publishYes")
    expect(page.locator("#pubMsg")).to_contain_text("تغيّر الموقع منذ فتحت اللوحة")
    expect(page.locator("#staleReload")).to_be_visible()
    assert gh.trees == [] and gh.new_commits == [] and gh.patches == [] and gh.blobs == []
    gh.head = gh.first

    # ---------- publish: text files and binary files in one commit
    page.click("#publishBtn")
    page.click("#publishYes")
    expect(page.locator("#pubMsg")).to_contain_text("تم النشر")
    assert len(gh.trees) == 1 and len(gh.new_commits) == 1 and len(gh.patches) == 1 and len(gh.blobs) == 2
    tree = gh.trees[0]
    assert tree["base_tree"] == "tree-initial"
    by_path = {e["path"]: e for e in tree["tree"]}
    assert sorted(by_path) == sorted(files + bins), "tree paths differ from the lists on the page"
    for p, e in by_path.items():
        assert e["mode"] == "100644" and e["type"] == "blob"
        if p in bins:
            assert e.get("sha", "").startswith("blob-") and "content" not in e, "binary files go through the blob API"
        else:
            assert isinstance(e.get("content"), str) and e["content"] and "sha" not in e
    photo = base64.b64decode(gh.blobs[int(by_path["PhotoDrOmaia.webp"]["sha"].split("-")[1]) - 1])
    img = Image.open(io.BytesIO(photo))
    assert img.format == "WEBP" and img.size == (1127, 1396), (img.format, img.size)
    assert base64.b64decode(gh.blobs[int(by_path["files/Report-2026-final.pdf"]["sha"].split("-")[1]) - 1]) == PDF_TEXT
    index_html = by_path["index.html"]["content"]
    assert re.search(r"PhotoDrOmaia\.webp\?v=\d{12}", index_html), "the portrait gets a new version tag"
    commit = gh.new_commits[0]
    assert commit["message"].startswith("Dashboard: ") and commit["parents"] == [gh.first] and commit["tree"] == "tree-1"
    for word in ("publications +1", "fonts", "colours", "sections", "courses", "citations", "cv", "portrait", "files +1"):
        assert word in commit["message"], (word, commit["message"])
    assert gh.patches[0] == {"sha": gh.head, "force": False}
    expect(page.locator("#badge")).to_be_hidden()
    assert page.evaluate("localStorage.getItem('dash.draft')") is None
    expect(page.locator("#publishBtn")).to_be_disabled()
    expect(page.locator("#noChanges")).to_be_visible()
    assert page.locator("#binList").count() == 0
    shot("12_published")
    tab("files")
    fresh = page.locator('#publishedFiles li[data-path="files/Report-2026-final.pdf"]')
    expect(fresh).to_contain_text("https://dromaia.github.io/files/Report-2026-final.pdf")
    expect(fresh.locator(".tag")).to_have_text("نُشر الآن")
    assert page.locator("#pendingFiles").count() == 0

    # ---------- approved versions: restore the first one (stale head first), then delete it from the list
    tab("publish")
    ver = page.locator('#verList .item[data-tag="%s"]' % first_tag)
    expect(ver).to_have_attribute("data-current", "0")
    tab("numbers")
    page.fill('[data-metric="0"] [data-k="value"]', "21+")
    badge(1)
    page.wait_for_timeout(350)
    tab("publish")
    gh.move_head("e" * 40)
    ver.locator('[data-ask="ver-restore-%s"]' % first_tag).click()
    expect(ver.locator(".confirm-note")).to_contain_text("تُحذف تعديلاتك غير المنشورة")
    before = len(gh.new_commits)
    ver.locator('[data-yes="ver-restore-%s"]' % first_tag).click()
    expect(page.locator("#verMsg")).to_contain_text("تغيّر الموقع منذ فتحت اللوحة")
    expect(page.locator("#verStaleReload")).to_be_visible()
    assert len(gh.new_commits) == before and len(gh.patches) == 1, "a stale restore writes nothing"
    assert page.evaluate("localStorage.getItem('dash.draft')") is not None
    gh.head = ("c1").ljust(40, "0")
    ver = page.locator('#verList .item[data-tag="%s"]' % first_tag)
    ver.locator('[data-ask="ver-restore-%s"]' % first_tag).click()
    ver.locator('[data-yes="ver-restore-%s"]' % first_tag).click()
    expect(page.locator("#verMsg")).to_contain_text("تم استرجاع النسخة")
    assert len(gh.new_commits) == before + 1 and len(gh.trees) == 1, "a restore is exactly one commit and no new tree"
    restored = gh.new_commits[-1]
    assert restored == {"message": "Dashboard: restore approved version – النسخة الأولى", "tree": "tree-initial", "parents": [("c1").ljust(40, "0")]}, restored
    assert gh.commits[gh.head]["message"] == restored["message"]
    assert page.evaluate("localStorage.getItem('dash.draft')") is None
    expect(page.locator("#badge")).to_be_hidden()
    expect(page.locator('#verList .item[data-tag="%s"]' % first_tag)).to_have_attribute("data-current", "1")
    expect(page.locator("#lastInfo")).to_contain_text("Dashboard: restore approved version")
    assert page.locator('[data-ask="undo"]').count() == 1, "undo is offered after a restore"
    tab("works")
    expect(page.locator('#workList .item[data-id="P41"]')).to_have_count(0)
    tab("publish")
    shot("13_versions")
    ver = page.locator('#verList .item[data-tag="%s"]' % first_tag)
    ver.locator('[data-ask="ver-del-%s"]' % first_tag).click()
    expect(ver.locator(".confirm-note")).to_contain_text("الموقع لا يتغير")
    commits_before = len(gh.new_commits)
    ver.locator('[data-yes="ver-del-%s"]' % first_tag).click()
    expect(page.locator("#verMsg")).to_contain_text("حُذفت النسخة من القائمة")
    expect(page.locator("#verNone")).to_be_visible()
    assert gh.deleted_tags == [first_tag] and len(gh.new_commits) == commits_before and gh.tag_refs == {}

    # ---------- undo the last dashboard change (here: the restore)
    page.click('[data-ask="undo"]')
    page.click('[data-yes="undo"]')
    expect(page.locator("#pubMsg")).to_contain_text("تم التراجع")
    undo = gh.new_commits[-1]
    assert undo["message"] == "Dashboard: تراجع عن آخر نشر" and undo["tree"] == "tree-1" and len(gh.trees) == 1
    assert gh.commits[gh.head]["message"] == undo["message"]

    # ---------- an old draft after the site changed cannot be continued
    tab("numbers")
    page.fill('[data-metric="0"] [data-k="value"]', "19+")
    page.wait_for_timeout(450)
    gh.move_head("d" * 40)
    page.click("#reloadBtn")
    expect(page.locator("#draftGate")).to_contain_text("تغيّر الموقع منذ آخر مسودة")
    page.click('#draftGate [data-ask="dropDraft"]')
    page.click('[data-yes="dropDraft"]')
    expect(page.locator(".tabs")).to_be_visible()
    assert page.evaluate("localStorage.getItem('dash.draft')") is None
    expect(page.locator("#badge")).to_be_hidden()

    # ---------- reload keeps the session; sign out forgets the token
    page.reload()
    expect(page.locator(".tabs")).to_be_visible()
    page.click("#outBtn")
    expect(page.locator("#token")).to_be_visible()
    assert page.evaluate("[localStorage.getItem('dash.token'), sessionStorage.getItem('dash.token')]") == [None, None]

    # ---------- global checks
    assert not errors, "page errors: %r" % errors
    assert all(GOOD not in u and BAD not in u for u in urls), "token found in a request URL"
    assert all(GOOD not in t for t in logs), "token found in the console"
    hosts = {urlparse(u).netloc for u in urls if u.startswith("http")}
    allowed = {urlparse(base).netloc, "api.github.com", "api.crossref.org", "dromaia.github.io", "fonts.googleapis.com", "fonts.gstatic.com"}
    assert hosts <= allowed, "unexpected hosts: %r" % (hosts - allowed)
    csp = [t for t in logs if "Content Security Policy" in t or "Content-Security-Policy" in t]
    assert not csp, "Content-Security-Policy violations: %r" % csp[:4]
    crossref_calls = sum(1 for u in urls if "api.crossref.org" in u)
    assert crossref_calls == 2 + len(DOIS) + 1 - 1 or crossref_calls >= len(DOIS), crossref_calls
    ctx.close()
    return {"width": width, "lib": "mock" if is_mock else "real", "import": "mock" if import_mock else "real", "requests": len(urls)}


def english(browser, base, shots):
    """The whole dashboard in English: no Arabic interface text, direction flipped, choice remembered."""
    gh = FakeGitHub()
    ctx = new_context(browser, 390, 844, gh)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/admin/")
    page.click('[data-lang="en"]')
    page.click(".steps summary")
    assert not page.evaluate(LEFT_ARABIC)
    if shots:
        page.screenshot(path=str(SHOTS / "390_en_00_signin.png"), full_page=True)
    page.reload()
    expect(page.locator("#signBtn")).to_have_text("Sign in")
    page.fill("#token", BAD)
    page.click("#signBtn")
    expect(page.locator("#signErr")).to_contain_text("The token is wrong")
    page.fill("#token", GOOD)
    page.click("#signBtn")
    expect(page.locator(".tabs")).to_be_visible()
    assert page.evaluate("[document.documentElement.lang, document.documentElement.dir]") == ["en", "ltr"]

    def check(name, n):
        page.wait_for_timeout(120)
        left = page.evaluate(LEFT_ARABIC)
        assert not left, "Arabic interface text in the English dashboard at %s: %r" % (name, left)
        over = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        assert over <= 0, "horizontal scroll at English %s (%dpx)" % (name, over)
        if shots:
            page.screenshot(path=str(SHOTS / ("390_en_%02d_%s.png" % (n, name))), full_page=True)

    for n, name in enumerate(TABS, 1):
        page.click('.tab[data-tab="%s"]' % name)
        if name == "works":
            page.click("#addWork")
            expect(page.locator("#workForm h2")).to_contain_text("New publication (P41)")
            page.click("#saveWork")
            expect(page.locator("#formErrors")).to_contain_text("Write the title")
            page.click("#cancelWork")
        if name == "sections":
            page.click("#addSection")
            for k in ("flagship", "roles"):
                page.locator('details[data-editor="%s"] > summary' % k).click()
            expect(page.locator("#badge")).to_have_text("Unpublished changes: 1")
        if name == "look":
            page.check('label[data-palette="custom"] input')
            page.fill('[data-color="light.text"]', "#eeeeee")
            expect(page.locator('#contrast-light [data-ct="textBg"]')).to_contain_text("under 4.5")
            expect(page.locator('[data-mode="dark"] h3').first).to_have_text("Dark")
        if name == "cv":
            for k in ("cv-import", "cv-accepted", "cv-fullExtra", "cv-appointmentDetails"):
                page.locator('details[data-editor="%s"] > summary' % k).click()
            page.click("#add-cv-appointmentDetails")
            page.click("#cvPreviewBtn")
            expect(page.locator('[data-cvmode="full"]')).to_have_text("Full")
        if name == "import":
            page.fill("#impText", SAMPLE_TEXT)
            page.click("#impGo")
            expect(page.locator("#impList .imp-item")).to_have_count(8)
            expect(page.locator('.imp-item[data-n="1"] [data-imp="news"]')).to_have_text("Add as a news line")
        if name == "files":
            expect(page.locator("#publishedFiles li")).to_have_count(1)
        if name == "ai":
            expect(page.locator("#guideCopy")).to_have_text("Copy the prompt")
        if name == "publish":
            expect(page.locator("#summary li").first).to_be_visible()
            expect(page.locator("#publishBtn")).to_have_text("Publish to the site")
            expect(page.locator("#verSave")).to_have_text("Save the current site as an approved version")
            page.click("#verSave")
            expect(page.locator("#verMsg")).to_contain_text("Publish them first")
            page.wait_for_timeout(400)
        check(name, n)
    summary = page.locator("#summary li").all_text_contents()
    assert summary and not any(AR.search(s) for s in summary), "the library answers in English after setLang('en'): %r" % summary
    page.click('[data-lang="ar"]')
    expect(page.locator("#publishBtn")).to_have_text("انشر على الموقع")
    summary = page.locator("#summary li").all_text_contents()
    assert summary and all(AR.search(s) for s in summary), "and in Arabic again: %r" % summary
    assert not errors, "page errors: %r" % errors
    ctx.close()


def narrow(browser, base):
    """360px: no page scrolls sideways, tap targets stay large, the tab strip scrolls inside itself."""
    gh = FakeGitHub()
    ctx = new_context(browser, 360, 740, gh)
    page = ctx.new_page()
    page.goto(base + "/admin/")
    page.click(".steps summary")
    assert page.evaluate("document.documentElement.scrollWidth - window.innerWidth") <= 0, "sideways scroll on sign-in at 360"
    page.fill("#token", GOOD)
    page.click("#signBtn")
    expect(page.locator(".tabs")).to_be_visible()
    strip = page.evaluate("(() => { const s = document.querySelector('.tabs'); return [s.scrollWidth, s.clientWidth]; })()")
    assert strip[0] > strip[1], "the tab strip must scroll inside itself on a phone"
    page.click("#addWork")
    for lang in ("ar", "en"):
        page.click('[data-lang="%s"]' % lang)
        for name in TABS:
            page.click('.tab[data-tab="%s"]' % name)
            page.wait_for_timeout(120)
            vis = page.evaluate("(() => { const s = document.querySelector('.tabs').getBoundingClientRect(), t = document.querySelector('.tab[aria-selected=true]').getBoundingClientRect(); return t.left >= s.left - 1 && t.right <= s.right + 1; })()")
            assert vis, "the active tab %s is not kept in view (%s)" % (name, lang)
            if name == "sections":
                if page.locator('#secList .item[data-sec="custom-1"]').count() == 0:
                    page.click("#addSection")
                    page.click('[data-add-card="custom-1"]')
                for k in ("flagship", "timeline", "roles"):
                    if page.locator('details[data-editor="%s"]' % k).get_attribute("open") is None:
                        page.locator('details[data-editor="%s"] > summary' % k).click()
            if name == "look" and page.locator('[data-mode="light"]').count() == 0:
                page.check('label[data-palette="custom"] input')
            if name == "cv":
                for k in ("cv-import", "cv-fullExtra", "cv-appointmentDetails", "cv-pillars"):
                    if page.locator('details[data-editor="%s"]' % k).get_attribute("open") is None:
                        page.locator('details[data-editor="%s"] > summary' % k).click()
            if name == "import" and page.locator("#impList").count() == 0:
                page.fill("#impText", SAMPLE_TEXT)
                page.click("#impGo")
            if name == "publish":
                page.wait_for_timeout(300)
            over = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            assert over <= 0, "sideways scroll on %s at 360 in %s (%dpx)" % (name, lang, over)
            small = page.evaluate("[...document.querySelectorAll('button, label.btn, input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea, summary')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5).map(e => e.tagName + ':' + (e.textContent || e.id || e.type).trim().slice(0, 20))")
            assert not small, "tap targets under 44px on %s (%s): %r" % (name, lang, small)
    ctx.close()


def v3(browser, base, shots):
    """Version 3: leadership / contact / degree editors, the portfolio editor, Arabic CV fields, optional page modules."""
    gh = FakeGitHub()
    ctx = new_context(browser, 390, 844, gh)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    sign_in(page, base)

    def tab(name):
        page.click('.tab[data-tab="%s"]' % name)
        expect(page.locator('.tab[data-tab="%s"]' % name)).to_have_attribute("aria-selected", "true")

    def open_fold(key):
        loc = page.locator('details[data-editor="%s"]' % key)
        if loc.get_attribute("open") is None:
            loc.locator("> summary").click()
        expect(loc).to_have_attribute("open", "")
        return loc

    def no_hscroll(where):
        over = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        assert over <= 0, "horizontal scroll at %s (%dpx)" % (where, over)

    def item(key, i):
        return page.locator('#list-%s article[data-i="%d"]' % (key, i))

    info = page.evaluate("({pf: !!(window.DashPortfolio), cvAr: !!(window.DashCV && window.DashCV.ARABIC === true), pages: Object.keys((window.DashLib || {}).PAGES || {}), optional: (window.DashLib || {}).OPTIONAL_FILES || []})")
    assert "cv.html" in info["pages"] and "portfolio.html" in info["optional"], info

    # ---------- sections tab: the six new lists
    tab("sections")
    for key in ["leadBullets", "leadCards", "contacts", "contactLinks", "degreeCards", "thesisItems"]:
        expect(page.locator('details[data-editor="%s"]' % key)).to_have_count(1)
    open_fold("leadBullets")
    n0 = page.locator("#list-leadBullets article").count()
    assert n0 == 5, n0
    page.click("#add-leadBullets")
    item("leadBullets", n0).locator('[data-k="en"]').fill('New bullet <b> & "more"')
    item("leadBullets", n0).locator('[data-k="ar"]').fill("نقطة جديدة")
    open_fold("leadCards")
    expect(page.locator("#list-leadCards [data-locked]")).to_have_count(1)
    rich = page.locator("#list-leadCards article", has=page.locator("[data-locked]"))
    expect(rich.locator("input, textarea")).to_have_count(0)
    expect(rich.locator("[data-locked]")).to_contain_text("البابلية")
    rich.locator('[data-move="up"]').click()          # the rich card moves to the top and keeps its markup
    expect(item("leadCards", 0).locator("[data-locked]")).to_have_count(1)
    page.click("#add-leadCards")
    last = page.locator("#list-leadCards article").count() - 1
    item("leadCards", last).locator('[data-k="tag.en"]').fill("New tag")
    item("leadCards", last).locator('[data-k="title.en"]').fill("A plain test card")
    item("leadCards", last).locator('[data-k="title.ar"]').fill("بطاقة اختبار")
    item("leadCards", last).locator('[data-k="text.en"]').fill("Card text here.")
    open_fold("contacts")
    expect(item("contacts", 2).locator('[data-k="phone"]')).to_be_checked()
    expect(item("contacts", 0).locator('[data-k="phone"]')).not_to_be_checked()
    item("contacts", 2).locator('[data-k="value"]').fill("+966 50 000 0000")
    item("contacts", 2).locator('[data-k="href"]').fill("tel:+966500000000")
    open_fold("contactLinks")
    page.click("#add-contactLinks")
    last = page.locator("#list-contactLinks article").count() - 1
    item("contactLinks", last).locator('[data-k="en"]').fill("Scholar profile ↗")
    item("contactLinks", last).locator('[data-k="href"]').fill("https://scholar.google.com/citations?user=TJnHJX8AAAAJ")
    open_fold("degreeCards")
    expect(page.locator("#list-degreeCards article")).to_have_count(3)
    item("degreeCards", 1).locator('[data-k="link.en"]').fill("University page ↗")
    item("degreeCards", 1).locator('[data-k="link.href"]').fill("https://www.yu.edu.jo/")
    open_fold("thesisItems")
    item("thesisItems", 1).locator('[data-k="text.en"]').fill("Evaluation of Stemming (edited)")
    no_hscroll("sections lists (v3)")
    left = page.evaluate(LEFT_ENGLISH)
    assert not left, "English interface text in the Arabic sections tab: %r" % left
    if shots:
        page.screenshot(path=str(SHOTS / "390_ar_14_v3_lists.png"), full_page=True)
    # a bad link is reported by validate and blocks publishing
    if not USE_MOCK:  # the stand-in library does not validate links
        item("contactLinks", last).locator('[data-k="href"]').fill("javascript:alert(1)")
        tab("publish")
        expect(page.locator("#publishBtn")).to_be_disabled()
        tab("sections")
        open_fold("contactLinks")
        item("contactLinks", last).locator('[data-k="href"]').fill("https://scholar.google.com/citations?user=TJnHJX8AAAAJ")

    # ---------- CV tab: Arabic fields only when the CV module carries Arabic; portfolio editor when the module is there
    tab("cv")
    has_ar = page.locator("#cvProfileAr").count() == 1
    expected_ar = page.evaluate("""(() => { const cv = window.__dashState ? null : null; return !!(window.DashCV && window.DashCV.ARABIC === true); })()""")
    if expected_ar:
        assert has_ar, "the CV module says it carries Arabic but the Arabic fields are hidden"
    if has_ar:
        page.fill("#cvProfileAr", "نبذة عربية تجريبية للوحة.")
        expect(page.locator("#cvLanguagesAr")).to_have_count(1)
    has_pf = page.locator("#pfBox").count() == 1
    assert has_pf == bool(info["pf"]), "portfolio editor shown=%s, module present=%s" % (has_pf, info["pf"])
    if has_pf:
        open_fold("pf-trajectory")
        lines0 = page.locator("#list-pf-trajectory article").count()
        assert lines0 >= 1
        page.click("#add-pf-trajectory")
        page.locator('#list-pf-trajectory article[data-i="%d"] [data-k="line"]' % lines0).fill("2027: a test line & <more>.")
        page.click("#pfPreviewBtn")
        doc = page.locator("#pfPreview").get_attribute("srcdoc")
        assert doc and "2027: a test line &amp; &lt;more&gt;." in doc and '<base href="https://dromaia.github.io/">' in doc, "portfolio preview does not show the edit"
        expect(page.locator('[data-link="portfolio"] a')).to_have_attribute("href", "https://dromaia.github.io/portfolio.html")
    no_hscroll("cv tab (v3)")
    left = page.evaluate(LEFT_ENGLISH)
    assert not left, "English interface text in the Arabic CV tab: %r" % left
    if shots:
        page.screenshot(path=str(SHOTS / "390_ar_15_v3_cv.png"), full_page=True)

    # ---------- publish tab: files, previews, one commit
    tab("publish")
    expect(page.locator("#summary li").first).to_be_visible()
    expect(page.locator("#publishBtn")).to_be_enabled()
    if has_pf:
        page.click('[data-pv="portfolio.html"]')
        doc = page.locator("#preview").get_attribute("srcdoc")
        assert doc and "2027: a test line" in doc
    page.click('[data-pv="cv.html"]')
    cv_doc = page.locator("#preview").get_attribute("srcdoc") or ""
    assert cv_doc, "CV preview is empty"
    if page.locator('[data-cvlang="ar"]').count():
        page.click('[data-cvlang="ar"]')
        ar_doc = page.locator("#preview").get_attribute("srcdoc") or ""
        assert ar_doc and ar_doc != cv_doc and '<base href="https://dromaia.github.io/ar/">' in ar_doc and " data-ar=" not in ar_doc, "Arabic CV preview is not the Arabic page"
        page.click('[data-cvlang="en"]')
    page.click('[data-pv="index.html"]')
    page.click("#publishBtn")
    page.click("#publishYes")
    expect(page.locator("#pubMsg")).to_contain_text("تم النشر")
    assert len(gh.trees) == 1 and len(gh.new_commits) == 1, (len(gh.trees), len(gh.new_commits))
    entries = {e["path"]: e.get("content", "") for e in gh.trees[0]["tree"]}
    assert "index.html" in entries and "ar/index.html" in entries, sorted(entries)
    if has_pf:
        assert "portfolio.html" in entries and "2027: a test line &amp; &lt;more&gt;." in entries["portfolio.html"], sorted(entries)
    if has_ar:
        assert "cv.html" in entries, sorted(entries)
        if " data-ar=" in entries["cv.html"]:
            assert "ar/cv.html" in entries and " data-ar=" not in entries["ar/cv.html"], sorted(entries)
    idx = entries["index.html"]
    assert 'New bullet &lt;b&gt; &amp; "more"</li>' in idx or "New bullet &lt;b&gt; &amp; &quot;more&quot;</li>" in idx, "new bullet missing or not escaped"
    assert "<b> &" not in idx
    cards = idx[idx.index("<!-- dash:lead-cards -->"):idx.index("<!-- /dash:lead-cards -->")].strip().split("\n")[1:]
    assert len(cards) == 4 and "Babylonian Journal of Networking" in cards[0] and 'class="verified"' in cards[0], "the rich card lost its place or markup"
    assert "A plain test card" in cards[3] and "Card text here." in cards[3]
    assert 'href="tel:+966500000000"' in idx and "+966 50 000 0000" in idx
    assert 'href="https://scholar.google.com/citations?user=TJnHJX8AAAAJ" rel="noopener" target="_blank">Scholar profile ↗</a>' in idx
    assert 'href="https://www.yu.edu.jo/" rel="noopener" target="_blank">University page ↗</a>' in idx
    assert "Evaluation of Stemming (edited)" in idx
    assert "نقطة جديدة" in entries["ar/index.html"] and "بطاقة اختبار" in entries["ar/index.html"]
    assert gh.new_commits[0]["message"].startswith("Dashboard:")
    for word in ["leadership", "contact", "education"]:
        assert word in gh.new_commits[0]["message"], gh.new_commits[0]["message"]

    # ---------- English: the new editors carry no Arabic interface text
    page.click('[data-lang="en"]')
    tab("sections")
    for key in ["leadBullets", "leadCards", "contacts", "contactLinks", "degreeCards", "thesisItems"]:
        open_fold(key)
    left = [x for x in page.evaluate(LEFT_ARABIC) if x]
    assert not left, "Arabic interface text in the English sections tab: %r" % left
    tab("cv")
    if has_pf:
        open_fold("pf-trajectory")
    left = [x for x in page.evaluate(LEFT_ARABIC) if x]
    assert not left, "Arabic interface text in the English CV tab: %r" % left
    no_hscroll("english v3")
    if shots:
        page.screenshot(path=str(SHOTS / "390_en_11_v3_cv.png"), full_page=True)
    assert not errors, errors
    ctx.close()
    return {"portfolio": bool(has_pf), "arabic_cv_fields": bool(has_ar)}


def optional_files(browser, base):
    """portfolio.html and cv.html may be missing on main: sign-in still works and their editors are hidden."""
    gh = FakeGitHub()
    gh.missing = {"portfolio.html", "cv.html"}
    ctx = new_context(browser, 390, 844, gh)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    sign_in(page, base)
    page.click('.tab[data-tab="cv"]')
    expect(page.locator("#pfBox")).to_have_count(0)
    page.click('.tab[data-tab="publish"]')
    expect(page.locator('[data-pv="portfolio.html"]')).to_have_count(0)
    expect(page.locator("#publishBtn")).to_be_disabled()
    assert not errors, errors
    ctx.close()


def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    httpd = serve()
    base = "http://127.0.0.1:%d" % httpd.server_address[1]
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        results = [run(browser, base, 390, 844, True), run(browser, base, 1280, 800, False)]
        english(browser, base, True)
        narrow(browser, base)
        v3info = v3(browser, base, True)
        optional_files(browser, base)
        browser.close()
    httpd.shutdown()
    for r in results:
        print("ok", r)
    print("v3 ok", v3info)
    print("ui_test: all passed (library: %s, CV import: %s)" % ("stand-in" if USE_MOCK else "real", "stand-in" if MOCK_IMPORT else "real"))


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print("FAILED:", e)
        sys.exit(1)
