#!/usr/bin/env python3
"""Browser test of the site dashboard with a fake GitHub API (nothing leaves this machine).

Usage:  python3 admin/tests/ui_test.py            (uses admin/lib.js if it exists, else the stand-in)
        DASH_LIB=mock python3 admin/tests/ui_test.py   (force the stand-in admin/tests/mock_lib.js)
        DASH_LIB=real python3 admin/tests/ui_test.py   (force the real library)
Needs: pip install playwright; Chrome at /usr/bin/google-chrome (or set CHROME).
"""
import functools
import http.server
import json
import mimetypes
import os
import pathlib
import sys
import threading
from urllib.parse import urlparse, unquote

from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[2]
SHOTS = ROOT / "admin" / "tests" / "shots"
GOOD = "github_pat_TESTTOKEN_do_not_leak_1234567890"
BAD = "github_pat_WRONG"
REPO = "/repos/DrOmaia/DrOmaia.github.io"
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
mode = os.environ.get("DASH_LIB", "auto")
USE_MOCK = mode == "mock" or (mode == "auto" and not (ROOT / "admin" / "lib.js").exists())
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, accept, x-github-api-version",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
}
CROSSREF = {
    "status": "ok",
    "message": {
        "DOI": "10.1234/test.2026.1", "type": "journal-article",
        "title": ["A Test Article About Dashboards"], "container-title": ["Journal of Tests"],
        "volume": "7", "issue": "2", "page": "10-20",
        "issued": {"date-parts": [[2026, 11, 2]]},
        "author": [{"given": "Omaia", "family": "Al-Omari"}, {"given": "Test", "family": "Author"}],
    },
}


class FakeGitHub:
    """Serves the repository files from disk and records what the dashboard writes."""

    def __init__(self):
        self.first = "a" * 40
        self.head = self.first
        self.commits = {self.first: {"message": "Site update by hand", "tree": "tree-initial", "parents": []}}
        self.trees, self.new_commits, self.patches, self.calls = [], [], [], []

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

        if req.method == "GET" and sub == "/git/ref/heads/main":
            return send(200, {"ref": "refs/heads/main", "object": {"sha": self.head, "type": "commit"}})
        if req.method == "GET" and sub.startswith("/contents/"):
            f = ROOT / sub[len("/contents/"):]
            if "raw" not in req.headers.get("accept", "") or "ref=" not in url.query or not f.is_file():
                return send(404, {"message": "Not Found"})
            return send(200, raw=f.read_bytes())
        if req.method == "GET" and sub.startswith("/git/commits/"):
            sha = sub.rsplit("/", 1)[1]
            c = self.commits.get(sha)
            if not c:
                return send(404, {"message": "Not Found"})
            return send(200, {"sha": sha, "message": c["message"], "tree": {"sha": c["tree"]}, "parents": [{"sha": p} for p in c["parents"]]})
        if req.method == "GET" and sub == "/commits/main":
            c = self.commits[self.head]
            return send(200, {"sha": self.head, "commit": {"message": c["message"], "committer": {"date": "2026-11-21T06:00:00Z"}}})
        if req.method == "POST" and sub == "/git/trees":
            self.trees.append(body)
            return send(201, {"sha": "tree-%d" % len(self.trees)})
        if req.method == "POST" and sub == "/git/commits":
            sha = ("c%d" % (len(self.new_commits) + 1)).ljust(40, "0")
            self.new_commits.append(body)
            self.commits[sha] = {"message": body["message"], "tree": body["tree"], "parents": body["parents"]}
            return send(201, {"sha": sha})
        if req.method == "PATCH" and sub == "/git/refs/heads/main":
            self.patches.append(body)
            if self.commits.get(body["sha"], {}).get("parents") != [self.head]:
                return send(422, {"message": "Update is not a fast forward"})
            self.head = body["sha"]
            return send(200, {"object": {"sha": self.head}})
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


def run(browser, base, width, height, shots):
    gh = FakeGitHub()
    ctx = browser.new_context(viewport={"width": width, "height": height}, locale="ar-SA")
    page = ctx.new_page()
    errors, urls, logs = [], [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: logs.append(m.text))
    page.on("request", lambda r: urls.append(r.url))
    ctx.route("https://api.github.com/**", gh.handle)
    ctx.route("https://api.crossref.org/**", lambda r: r.fulfill(status=200, headers={**CORS, "Content-Type": "application/json"}, body=json.dumps(CROSSREF)))
    ctx.route("https://dromaia.github.io/**", live_site)
    ctx.route("https://fonts.googleapis.com/**", lambda r: r.fulfill(status=200, headers={"Content-Type": "text/css"}, body=""))
    ctx.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    if USE_MOCK:
        ctx.route("**/admin/lib.js*", lambda r: r.fulfill(status=200, headers={"Content-Type": "text/javascript; charset=utf-8"}, body=(ROOT / "admin/tests/mock_lib.js").read_bytes()))
    tag = "%d" % width

    def no_hscroll(where):
        over = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        assert over <= 0, "horizontal scroll at %s (%dpx, width %d)" % (where, over, width)

    def shot(name):
        if shots:
            page.screenshot(path=str(SHOTS / ("%s_%s.png" % (tag, name))), full_page=True)

    def tab(name):
        page.click('.tab[data-tab="%s"]' % name)
        expect(page.locator('.tab[data-tab="%s"]' % name)).to_have_attribute("aria-selected", "true")

    def badge(n):
        expect(page.locator("#badge")).to_have_text("تعديلات غير منشورة: %d" % n)

    # --- sign in: wrong token, then the good one
    page.goto(base + "/admin/")
    expect(page.locator("#token")).to_be_visible()
    assert page.locator('meta[name="robots"]').get_attribute("content").startswith("noindex")
    no_hscroll("sign-in"); shot("0_signin")
    page.click("#signBtn")
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
    assert page.locator(".tab").count() == 6
    is_mock = page.evaluate("!!window.DashLib.MOCK")
    n_works = page.evaluate("window.DashLib.read ? document.querySelectorAll('#workList .item').length : 0")
    assert n_works >= 40
    expect(page.locator("#badge")).to_be_hidden()
    no_hscroll("works"); shot("1_works")
    # nothing edited yet: nothing to publish
    tab("publish")
    expect(page.locator("#noChanges")).to_be_visible()
    expect(page.locator("#publishBtn")).to_be_disabled()
    assert page.locator("#fileList").count() == 0
    tab("works")

    # --- add a work with DOI autofill
    page.click("#addWork")
    expect(page.locator("#workForm h2")).to_contain_text("P41")
    page.click("#doiBtn")
    expect(page.locator("#doiNote")).to_contain_text("اكتب رقم DOI")
    page.fill("#doiLookup", "https://doi.org/10.1234/test.2026.1")
    page.click("#doiBtn")
    expect(page.locator("#doiNote")).to_contain_text("جُلبت البيانات")
    expect(page.locator("#fTitle")).to_have_value("A Test Article About Dashboards")
    expect(page.locator("#fYear")).to_have_value("2026")
    assert "10.1234/test.2026.1" in page.input_value("#fDoi")
    assert page.input_value("#fReference").strip() != ""
    if is_mock:  # the stand-in insists on a contribution: the error list must show and nothing is saved
        page.click("#saveWork")
        expect(page.locator("#formErrors")).to_contain_text("المساهمة")
    page.fill("#fMethods", "playwright, fake API")
    page.fill("#fContribution", "Al-Omari and Author (2026) test that the dashboard publishes a new work.")
    no_hscroll("work form"); shot("1b_work_form")
    page.click("#saveWork")
    expect(page.locator("#workForm")).to_have_count(0)
    first = page.locator("#workList .item").first
    expect(first).to_have_attribute("data-id", "P41")
    expect(first).to_contain_text("A Test Article About Dashboards")
    badge(1)
    page.fill("#workSearch", "dashboards")
    expect(page.locator("#workList .item")).to_have_count(1)
    page.fill("#workSearch", "")
    # delete asks again in place; cancel keeps the work
    page.click('#workList .item[data-id="P01"] button:has-text("حذف")')
    expect(page.locator('[data-yes="del-P01"]')).to_be_visible()
    page.click('#workList .item[data-id="P01"] button:has-text("إلغاء")')
    expect(page.locator('#workList .item[data-id="P01"]')).to_have_count(1)

    # --- numbers and news
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
    page.click('[data-news="0"] button[aria-label="تحريك للأسفل"]')
    expect(page.locator('[data-news="1"] [data-k="ar"]')).to_have_value("سطر اختبار للوحة")
    badge(3)
    no_hscroll("numbers"); shot("2_numbers")

    # --- roles
    tab("roles")
    before_roles = page.locator("#roleList .item").count()
    page.click("#addRole")
    page.fill('[data-role="0"] [data-k="org"]', "TEST ORG")
    page.fill('[data-role="0"] [data-k="en"]', "Test role")
    page.fill('[data-role="0"] [data-k="ar"]', "دور اختباري")
    expect(page.locator("#roleList .item")).to_have_count(before_roles + 1)
    badge(4)
    no_hscroll("roles"); shot("3_roles")

    # --- texts
    tab("texts")
    assert page.locator("#textList .item").count() <= 30
    first_text = page.locator('#textList .item [data-k="ar"]').first
    old_ar = first_text.input_value()
    first_text.fill(old_ar + " (تجربة)")
    page.fill("#textSearch", "zzzz-no-such-text")
    expect(page.locator("#textList .item")).to_have_count(0)
    page.fill("#textSearch", "تجربة")
    expect(page.locator("#textList .item")).to_have_count(1)
    badge(5)
    no_hscroll("texts"); shot("4_texts")

    # --- look: change the Arabic font
    tab("look")
    target = page.evaluate("(() => { const cur = document.querySelector('input[name=font-ar]:checked').value; return window.DashLib.FONTS.ar.map(f => f.name).find(n => n !== cur); })()")
    page.check('label[data-font="%s"] input[name="font-ar"]' % target)
    expect(page.locator('label[data-font="%s"]' % target)).to_have_class("font on")
    assert page.locator("link[data-preview-font]").count() >= 4
    badge(6)
    no_hscroll("look"); shot("5_look")

    # --- the draft survives a reload
    page.wait_for_timeout(450)
    page.reload()
    expect(page.locator("#draftGate")).to_contain_text("مسودة غير منشورة")
    assert page.locator(".tabs").count() == 0
    shot("6_draft")
    page.click("#draftKeep")
    badge(6)
    expect(page.locator('#workList .item[data-id="P41"]')).to_have_count(1)

    # --- publish tab: summary, files, preview
    tab("publish")
    expect(page.locator("#summary li").first).to_be_visible()
    files = page.locator("#fileList li").all_text_contents()
    for needed in ("index.html", "ar/index.html", "research-data.js"):
        assert needed in files, "%s missing from the changed files %r" % (needed, files)
    srcdoc = page.locator("#preview").get_attribute("srcdoc")
    assert len(srcdoc) > 5000 and '<base href="https://dromaia.github.io/ar/">' in srcdoc and 'dir="rtl"' in srcdoc
    assert page.locator("#preview").get_attribute("sandbox") == ""
    assert "سطر اختبار للوحة" in srcdoc
    page.wait_for_timeout(600)
    no_hscroll("publish"); shot("7_publish")
    page.click('.seg [data-pv="en"]')
    srcdoc = page.locator("#preview").get_attribute("srcdoc")
    assert '<base href="https://dromaia.github.io/">' in srcdoc and "Dashboard test line &lt;b&gt;&amp;&lt;/b&gt;" in srcdoc, "user text must be escaped in the page"
    page.click('.seg [data-pv="publications.html"]')
    assert "publicationList" in page.locator("#preview").get_attribute("srcdoc")
    expect(page.locator("#lastInfo")).to_contain_text("Site update by hand")
    expect(page.locator("#undoOff")).to_be_visible()

    # --- someone else changed the site: nothing is published, reload is offered
    gh.move_head("b" * 40)
    page.click("#publishBtn")
    page.click("#publishYes")
    expect(page.locator("#pubMsg")).to_contain_text("تغيّر الموقع منذ فتحت اللوحة")
    expect(page.locator("#staleReload")).to_be_visible()
    assert gh.trees == [] and gh.new_commits == [] and gh.patches == []
    gh.head = gh.first  # put the site back as it was

    # --- publish
    page.click("#publishBtn")
    page.click("#publishYes")
    expect(page.locator("#pubMsg")).to_contain_text("تم النشر")
    assert len(gh.trees) == 1 and len(gh.new_commits) == 1 and len(gh.patches) == 1
    tree = gh.trees[0]
    assert tree["base_tree"] == "tree-initial"
    assert sorted(e["path"] for e in tree["tree"]) == sorted(files), "tree paths differ from the file list"
    assert all(e["mode"] == "100644" and e["type"] == "blob" and isinstance(e["content"], str) and e["content"] for e in tree["tree"])
    commit = gh.new_commits[0]
    assert commit["message"].startswith("Dashboard: ") and commit["parents"] == [gh.first] and commit["tree"] == "tree-1"
    assert "publications +1" in commit["message"] and "fonts" in commit["message"], commit["message"]
    assert gh.patches[0] == {"sha": gh.head, "force": False}
    expect(page.locator("#badge")).to_be_hidden()
    assert page.evaluate("localStorage.getItem('dash.draft')") is None
    expect(page.locator("#publishBtn")).to_be_disabled()
    expect(page.locator("#noChanges")).to_be_visible()
    shot("8_published")

    # --- undo the last publish
    expect(page.locator("#lastInfo")).to_contain_text("Dashboard:")
    page.click('button:has-text("تراجع عن آخر نشر")')
    page.click('[data-yes="undo"]')
    expect(page.locator("#pubMsg")).to_contain_text("تم التراجع")
    undo = gh.new_commits[-1]
    assert undo["message"] == "Dashboard: تراجع عن آخر نشر" and undo["tree"] == "tree-initial" and len(gh.trees) == 1
    assert gh.commits[gh.head]["message"] == undo["message"]
    tab("works")
    expect(page.locator('#workList .item[data-id="P41"]')).to_have_count(0)

    # --- an old draft after the site changed cannot be continued
    tab("numbers")
    page.fill('[data-metric="0"] [data-k="value"]', "19+")
    page.wait_for_timeout(450)
    gh.move_head("d" * 40)
    page.click("#reloadBtn")
    expect(page.locator("#draftGate")).to_contain_text("تغيّر الموقع منذ آخر مسودة")
    page.click('#draftGate button:has-text("حذف المسودة")')
    page.click('[data-yes="dropDraft"]')
    expect(page.locator(".tabs")).to_be_visible()
    assert page.evaluate("localStorage.getItem('dash.draft')") is None
    expect(page.locator("#badge")).to_be_hidden()

    # --- reload keeps the session; sign out forgets the token
    page.reload()
    expect(page.locator(".tabs")).to_be_visible()
    page.click("#outBtn")
    expect(page.locator("#token")).to_be_visible()
    assert page.evaluate("[localStorage.getItem('dash.token'), sessionStorage.getItem('dash.token')]") == [None, None]

    # --- global checks
    assert not errors, "page errors: %r" % errors
    assert all(GOOD not in u and BAD not in u for u in urls), "token found in a request URL"
    assert all(GOOD not in t for t in logs), "token found in the console"
    hosts = {urlparse(u).netloc for u in urls if u.startswith("http")}
    allowed = {urlparse(base).netloc, "api.github.com", "api.crossref.org", "dromaia.github.io", "fonts.googleapis.com", "fonts.gstatic.com"}
    assert hosts <= allowed, "unexpected hosts: %r" % (hosts - allowed)
    csp = [t for t in logs if "Content Security Policy" in t]
    ctx.close()
    return {"width": width, "lib": "mock" if is_mock else "real", "requests": len(urls), "csp_reports": csp[:3]}


def narrow(browser, base):
    """360px: no page scrolls sideways."""
    gh = FakeGitHub()
    ctx = browser.new_context(viewport={"width": 360, "height": 740}, locale="ar-SA")
    page = ctx.new_page()
    ctx.route("https://api.github.com/**", gh.handle)
    ctx.route("https://dromaia.github.io/**", live_site)
    ctx.route("https://fonts.googleapis.com/**", lambda r: r.fulfill(status=200, headers={"Content-Type": "text/css"}, body=""))
    ctx.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    if USE_MOCK:
        ctx.route("**/admin/lib.js*", lambda r: r.fulfill(status=200, headers={"Content-Type": "text/javascript; charset=utf-8"}, body=(ROOT / "admin/tests/mock_lib.js").read_bytes()))
    page.goto(base + "/admin/")
    page.click(".steps summary")
    assert page.evaluate("document.documentElement.scrollWidth - window.innerWidth") <= 0, "sideways scroll on sign-in at 360"
    page.fill("#token", GOOD)
    page.click("#signBtn")
    expect(page.locator(".tabs")).to_be_visible()
    page.click("#addWork")
    for name in ("works", "numbers", "roles", "texts", "look", "publish"):
        page.click('.tab[data-tab="%s"]' % name)
        page.wait_for_timeout(150)
        over = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        assert over <= 0, "sideways scroll on %s at 360 (%dpx)" % (name, over)
        small = page.evaluate("[...document.querySelectorAll('button, input:not([type=checkbox]):not([type=radio]), select, textarea, summary')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5).map(e => e.tagName + ':' + (e.textContent || e.id).trim().slice(0, 20))")
        assert not small, "tap targets under 44px on %s: %r" % (name, small)
    ctx.close()


def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    httpd = serve()
    base = "http://127.0.0.1:%d" % httpd.server_address[1]
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        results = [run(browser, base, 390, 844, True), run(browser, base, 1280, 800, False)]
        narrow(browser, base)
        browser.close()
    httpd.shutdown()
    for r in results:
        print("ok", r)
    print("ui_test: all passed (%s library)" % ("stand-in" if USE_MOCK else "real"))


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print("FAILED:", e)
        sys.exit(1)
