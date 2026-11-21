/* Tests for admin/portfolio.js (the live research-portfolio page). Plain Node:  node admin/tests/portfolio.test.js
   Add --render to also render portfolio.html with Playwright (python3 + Chromium): PDFs (A4, Letter) and
   390px / 1280px screenshots go to admin/tests/shots/. Exit code 1 on failure. */
"use strict";
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const ROOT = path.resolve(__dirname, "..", "..");
const PF = require(path.join(ROOT, "admin", "portfolio.js"));
const html = fs.readFileSync(path.join(ROOT, "portfolio.html"), "utf8");

const sandbox = {};
new Function("window", fs.readFileSync(path.join(ROOT, "research-data.js"), "utf8"))(sandbox);
const DATA = sandbox.RESEARCH_PORTFOLIO;
const clone = (o) => JSON.parse(JSON.stringify(o));
const model = (extra) => Object.assign({ works: clone(DATA.works), meta: clone(DATA.meta), today: "2026-12-05" }, extra || {});

let failed = 0, total = 0;
function check(name, ok, detail) {
  total++;
  if (ok) console.log("ok   " + name);
  else { failed++; console.log("FAIL " + name + (detail ? "  -> " + detail : "")); }
}
const block = (h, n) => { const b = PF._findBlock(h, n); return b ? b.inner : null; };
const count = (s, re) => (s.match(re) || []).length;
const ids = (h) => (block(h, "works").match(/<article class="work" id="([^"]*)"/g) || []).map((x) => /id="([^"]*)"/.exec(x)[1]);

// 1. round trip
check("round trip: same string", PF.build(model(), html) === html);
const r0 = PF.buildDetailed(model(), html);
check("round trip: no warnings, nothing changed", !r0.warnings.length && !r0.changed.length, JSON.stringify(r0));
check("round trip without meta (cutoff kept from the page)", PF.build({ works: clone(DATA.works), today: "2027-03-01" }, html) === html);
check("round trip with ISO cutoff only", PF.build({ works: clone(DATA.works), cutoff: DATA.meta.verificationCutoff, today: "2027-03-01" }, html) === html);
check("read: trajectory has 4 lines", PF.read(html).trajectory.length === 4);
check("round trip with model.portfolio = read()", PF.build(model({ portfolio: PF.read(html) }), html) === html);

// 2. counts and themes
const works = DATA.works;
const types = (t) => works.filter((w) => w.type === t).length;
const stats = block(html, "stats");
check("stats: four numbers match", stats.includes("<b>" + works.length + "</b>verified works") &&
  stats.includes("<b>" + types("Journal article") + "</b>journal articles") &&
  stats.includes("<b>" + types("Conference paper") + "</b>conference papers") &&
  stats.includes("<b>" + types("Book chapter") + "</b>book chapters"));
const themeRows = (block(html, "themes").match(/<tr><td>(.*?)<\/td><td>(\d+)<\/td><\/tr>/g) || []).map((r) => /<td>(.*?)<\/td><td>(\d+)/.exec(r));
const want = {};
works.forEach((w) => { want[w.theme] = (want[w.theme] || 0) + 1; });
check("themes: rows and numbers match data", themeRows.length === Object.keys(want).length && themeRows.every((m) => want[m[1].replace(/&amp;/g, "&")] === +m[2]));
check("themes: most works first", themeRows.every((m, i) => i === 0 || +themeRows[i - 1][2] >= +m[2]));
check("works: one article per work, in id order", ids(html).length === works.length && ids(html).join() === works.map((w) => w.id).sort().join());
check("scope: count and cutoff filled in", block(html, "scope").includes("covering " + works.length + " works verified through " + DATA.meta.verificationCutoffDisplay + "."));
check("updated: cutoff shown", block(html, "updated").includes(DATA.meta.verificationCutoffDisplay));

// 3. add a work (id in the middle of the order), cutoff moves to today when the works change
const added = { id: "P05a", title: "A New Work", year: 2026, type: "Book chapter", theme: "Responsible AI, governance, and society",
  methods: ["m1", "m2"], contribution: "It did things.", reference: "Ref text (2026).", doi: "https://doi.org/10.1/x", verificationNote: null };
const m1 = model(); delete m1.meta; m1.works.push(added); // lib.read() gives no cutoff: the module uses today
const r1 = PF.buildDetailed(m1, html);
const order = ids(r1.html);
check("add: entry in id order", order.length === works.length + 1 && order.indexOf("P05a") === order.indexOf("P05") + 1, order.slice(3, 8).join());
check("add: numbers updated", block(r1.html, "stats").includes("<b>" + (works.length + 1) + "</b>verified works") &&
  block(r1.html, "stats").includes("<b>" + (types("Book chapter") + 1) + "</b>book chapters"));
check("add: scope sentence updated (count and date)", block(r1.html, "scope").includes("covering " + (works.length + 1) + " works verified through 5 December 2026"));
const themeAdd = /Responsible AI, governance, and society<\/td><td>(\d+)/.exec(block(r1.html, "themes"));
check("add: theme count +1", +themeAdd[1] === want["Responsible AI, governance, and society"] + 1);
check("add: changed blocks are the automatic ones", r1.changed.sort().join() === ["scope", "stats", "themes", "updated", "works"].sort().join(), r1.changed.join());
check("add: owner block untouched", block(r1.html, "trajectory") === block(html, "trajectory"));
check("add: text outside blocks untouched", r1.html.replace(/<!-- pf:(\w+) -->[\s\S]*?<!-- \/pf:\1 -->/g, "") === html.replace(/<!-- pf:(\w+) -->[\s\S]*?<!-- \/pf:\1 -->/g, ""));
check("add: build again is stable", PF.build(m1, r1.html) === r1.html);

// 4. delete a work
const m2 = model(); const gone = m2.works.splice(3, 1)[0];
const r2 = PF.buildDetailed(m2, html);
check("delete: entry removed, count down", !ids(r2.html).includes(gone.id) && ids(r2.html).length === works.length - 1 &&
  block(r2.html, "stats").includes("<b>" + (works.length - 1) + "</b>verified works"));
check("delete: explicit cutoff keeps the date", PF.buildDetailed(Object.assign(model(), { works: m2.works }), html).html.includes("verified through " + DATA.meta.verificationCutoffDisplay));

// 5. trajectory edit changes only its block
const r3 = PF.buildDetailed(model({ portfolio: { trajectory: ["First & <b>second</b>", "Third"] } }), html);
check("trajectory: only its block changed", r3.changed.join() === "trajectory");
check("trajectory: two lines, escaped", block(r3.html, "trajectory") === "<p>First &amp; &lt;b&gt;second&lt;/b&gt;</p>\n<p>Third</p>");
check("trajectory: read back", JSON.stringify(PF.read(r3.html).trajectory) === JSON.stringify(["First & <b>second</b>", "Third"]));
check("trajectory: outside blocks identical", r3.html.replace(/<!-- pf:trajectory -->[\s\S]*?<!-- \/pf:trajectory -->/, "") === html.replace(/<!-- pf:trajectory -->[\s\S]*?<!-- \/pf:trajectory -->/, ""));
check("trajectory: missing key keeps the page", PF.build(model({ portfolio: {} }), html) === html);

// 6. escaping
const m4 = model(); m4.works[0].title = 'A & B <script>alert("x")</script> "q"';
m4.works[0].contribution = "x < y & z > w"; m4.works[0].methods = ["a&b", "<i>"];
const r4 = PF.build(m4, html);
check("escape: no raw tags from data", !/<script>alert/.test(r4) && r4.includes("A &amp; B &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &quot;q&quot;"));
check("escape: contribution and methods", r4.includes("x &lt; y &amp; z &gt; w") && r4.includes("a&amp;b, &lt;i&gt;"));
check("escape: still one script element in page", count(r4, /<script>/g) === count(html, /<script>/g));

// 7. no DOI + verification note
const m5 = model(); m5.works.push({ id: "P99", title: "No DOI Work", year: 2020, type: "Journal article", theme: "Other theme",
  methods: [], contribution: "C.", reference: "R & R (2020).", doi: null, verificationNote: "Metadata caution: <check> volume." });
const art = (block(PF.build(m5, html), "works").match(/<article class="work" id="P99">.*<\/article>/) || [""])[0];
check("no DOI: no link, reference present", art.includes('<p class="ref"><b>Reference:</b> R &amp; R (2020).</p>'), art);
check("note: rendered and escaped", art.includes('<p class="note">Verification note: Metadata caution: &lt;check&gt; volume.</p>'));
check("empty methods: no Methods line", !art.includes("Methods:"));
check("new theme appears in table", block(PF.build(m5, html), "themes").includes("<td>Other theme</td><td>1</td>"));
const withDoi = (block(html, "works").match(/<article class="work" id="P02">.*<\/article>/) || [""])[0];
check("DOI: link rendered", /<a href="https:\/\/doi\.org\/10\.3844\/jcssp\.2014\.1865\.1873">https:\/\/doi\.org\/10\.3844\/jcssp\.2014\.1865\.1873<\/a>/.test(withDoi));
check("verification note rendered on the page for P01", /id="P01".*Verification note: No DOI is available/.test(block(html, "works")));

// 8. robustness
const noBlock = html.replace("<!-- pf:themes -->", "").replace("<!-- /pf:themes -->", "");
const r5 = PF.buildDetailed(m1, noBlock);
check("missing block: no throw, warning, rest updated", r5.warnings.some((w) => /pf:themes/.test(w)) && r5.changed.includes("works") && !r5.changed.includes("themes"));
check("missing works array: page unchanged + warning", (() => { const r = PF.buildDetailed({ today: "2026-01-01" }, html); return r.html === html && r.warnings.length > 0; })());
check("empty html: no throw", PF.buildDetailed(model(), "").warnings.length === 1);
check("null model: no throw", PF.build(null, html) === html);
check("no cutoff known and none on page: today is used", PF.build({ works: clone(DATA.works), today: "2026-12-05" }, html.replace(/verified through [^.<]*\./, "verified through .")).includes("verified through 5 December 2026"));

console.log((failed ? "FAILED " + failed + " of " : "all passed: ") + total);
if (failed) process.exit(1);

/* ---------- optional rendering ---------- */
if (process.argv.includes("--render")) {
  const shots = path.join(__dirname, "shots");
  fs.mkdirSync(shots, { recursive: true });
  const py = `
import sys, json
from playwright.sync_api import sync_playwright
root, shots = sys.argv[1], sys.argv[2]
out = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    for w, name in ((390, "portfolio-390.png"), (1280, "portfolio-1280.png")):
        pg = b.new_page(viewport={"width": w, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "ERR_" not in m.text and "Failed to load" not in m.text else None)
        pg.goto("file://" + root + "/portfolio.html")
        pg.wait_for_timeout(300)
        out["w%d" % w] = {"errors": errs, "overflow": pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")}
        pg.screenshot(path=shots + "/" + name, full_page=True)
        pg.screenshot(path=shots + "/" + name.replace(".png", "-top.png"))
        pg.close()
    pg = b.new_page()
    pg.goto("file://" + root + "/portfolio.html")
    pg.wait_for_timeout(300)
    for fmt in ("A4", "Letter"):
        pg.pdf(path=shots + "/portfolio-" + fmt + ".pdf", format=fmt, print_background=True, prefer_css_page_size=False)
    b.close()
print(json.dumps(out))
`;
  const res = cp.spawnSync("python3", ["-I", "-c", py, ROOT, shots], { encoding: "utf8" });
  if (res.status !== 0) { console.log("render failed:\n" + res.stderr); process.exit(1); }
  const info = JSON.parse(res.stdout.trim().split("\n").pop());
  let bad = false;
  for (const k of Object.keys(info)) {
    console.log(k + ": overflow " + info[k].overflow + "px, errors " + info[k].errors.length);
    if (info[k].overflow > 0 || info[k].errors.length) bad = true;
  }
  for (const fmt of ["A4", "Letter"]) {
    const buf = fs.readFileSync(path.join(shots, "portfolio-" + fmt + ".pdf")).toString("latin1");
    console.log(fmt + " pages: " + (buf.match(/\/Type\s*\/Page[^s]/g) || []).length);
  }
  if (bad) process.exit(1);
}
