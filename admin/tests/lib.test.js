/* Tests for admin/lib.js and for the run-time counts of research-assistant.js.
   Run from anywhere:  node admin/tests/lib.test.js      (plain Node, no packages; exit code 1 on failure)
   DASH_CV=off node admin/tests/lib.test.js   runs the CV-module section as if admin/cv.js were not there.
   The tests read the real site files of this repository and never write to them. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const L = require(path.join(ROOT, "admin", "lib.js"));
const I = L._internal;
// The CV page is another module (admin/cv.js). Everything below runs with it switched off, so the results do not
// depend on it; the section "CV module" then tests the wiring with a stand-in and, when admin/cv.js and cv.html
// exist, with the real module.
I.setCV(null);
// The same holds for the portfolio page module (admin/portfolio.js): off here, tested in "v3: page modules".
I.setPortfolio(null);

let failed = 0, passed = 0, current = "";
function section(name) { current = name; console.log("\n# " + name); }
function ok(condition, message) {
  if (condition) { passed += 1; return true; }
  failed += 1;
  console.log("  FAIL [" + current + "] " + message);
  return false;
}
function eq(actual, expected, message) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed += 1; return true; }
  failed += 1;
  console.log("  FAIL [" + current + "] " + message + "\n     got:      " + String(a).slice(0, 400) + "\n     expected: " + String(b).slice(0, 400));
  return false;
}
function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i += 1;
  return "at " + i + ": " + JSON.stringify(a.slice(Math.max(0, i - 60), i + 80)) + " <> " + JSON.stringify(b.slice(Math.max(0, i - 60), i + 80));
}
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
// cv.html is written by the CV agent; the library must work with and without it
const loadFiles = () => { const f = {}; L.FILES.forEach((p) => { if (fs.existsSync(path.join(ROOT, p))) f[p] = read(p); }); return f; };
const overlay = (files, out) => Object.assign({}, files, out.files);
const inner = (html, name) => I.findBlock(html, name).inner;
const cardsOf = (html) => I.splitCards(inner(html, "dash:cards"));
const ldOf = (html) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
const dataOf = (js) => JSON.parse(js.slice(js.indexOf("{"), js.lastIndexOf("}") + 1));
const sorted = (list) => list.slice().sort();
// tools/build-arabic.py may also list cv.html (the Arabic CV): give the temp copy that page too, so the script can run
const PY_LISTS_CV = /["']cv\.html["']/.test(fs.readFileSync(path.join(ROOT, "tools", "build-arabic.py"), "utf8"));
function pythonNeeds(tmp, cvHtml) {
  if (!PY_LISTS_CV) return;
  const cv = typeof cvHtml === "string" ? cvHtml : (fs.existsSync(path.join(ROOT, "cv.html")) ? read("cv.html") : "<!DOCTYPE html>\n<html lang=\"en\"><head></head><body></body></html>\n");
  fs.writeFileSync(path.join(tmp, "cv.html"), cv);
}

const files = loadFiles();
const TODAY = "2027-01-05";
const NEW_WORK = {
  id: "P41",
  title: "Trustworthy Agents for Clinical Triage: A Verification-First Study",
  year: 2027,
  type: "Journal article",
  theme: "Healthcare and clinical decision support",
  methods: ["agentic AI", "clinical triage", "verification"],
  contribution: "Al-Omari (2027) evaluates verification-first agent workflows for clinical triage and reports where checks reduce unsafe recommendations.",
  reference: "Al-Omari, O. (2027). Trustworthy agents for clinical triage: A verification-first study. Journal of Clinical AI, 3(1), 1-12.",
  doi: "10.1234/jcai.2027.001",
  verificationNote: "",
  venue: "Journal of Clinical AI",
};

/* ------------------------------------------------------------------ */
section("API shape");
eq(L.FILES, ["index.html", "publications.html", "research-data.js", "data/metrics.json", "sitemap.xml", "cv.html", "portfolio.html"], "FILES");
eq(L.OPTIONAL_FILES, ["cv.html", "portfolio.html"], "files that may be missing on main");
eq(L.THEMES.length, 6, "six themes");
eq(L.TYPES.map((t) => t.en), ["Journal article", "Conference paper", "Book chapter"], "types");
eq(L.FONTS.ar.slice(0, 8).map((f) => f.name), ["Noto Naskh Arabic", "IBM Plex Sans Arabic", "Tajawal", "Cairo", "Noto Kufi Arabic", "Almarai", "Readex Pro", "Amiri"], "the first eight Arabic fonts are the version 1 ones");
eq(L.FONTS.en.slice(0, 4).map((f) => f.name), ["Manrope", "Inter", "IBM Plex Sans", "Source Sans 3"], "the first four English fonts are the version 1 ones");
eq(L.FONTS.ar[2].weights, [400, 500, 700], "Tajawal weights");
["read", "build", "validate", "nextId", "fromCrossref", "buildArabic"].forEach((fn) => ok(typeof L[fn] === "function", fn + " is a function"));
{
  // in a browser (no module, a global "self") the library registers itself as DashLib
  const sandbox = { self: {} };
  vm.createContext(sandbox);
  vm.runInContext(read("admin/lib.js"), sandbox);
  ok(sandbox.self.DashLib && typeof sandbox.self.DashLib.build === "function", "window.DashLib in the browser");
  ok(!/\?\.|\?\?|\.\.\.[a-zA-Z{[]|=>|`|\bconst\b|\blet\b/.test(read("admin/lib.js").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""')), "library sticks to old-browser-safe syntax");
}

/* ------------------------------------------------------------------ */
section("Arabic pages are byte-identical to tools/build-arabic.py");
["index.html", "publications.html"].forEach((page) => {
  const js = L.buildArabic(page, files[page]);
  const py = read("ar/" + page);
  ok(js === py, "ar/" + page + " differs " + (js === py ? "" : firstDiff(js, py)));
});
let threw = false;
try { L.buildArabic("other.html", "x"); } catch (e) { threw = true; }
ok(threw, "unknown page throws");

/* ------------------------------------------------------------------ */
section("read()");
const model = L.read(files);
const data0 = dataOf(files["research-data.js"]);
eq(model.works.length, data0.works.length, "all works read");
eq(model.works[0], data0.works[0], "work objects as stored");
eq(model.warnings, [], "no warnings for the current site");
eq(model.metrics.length, 4, "four tiles");
eq(model.metrics[3], { value: String(data0.works.length), en: "Verified works", ar: "عملاً موثقاً", href: "publications.html", auto: "works" }, "works tile is automatic");
eq(model.metrics[0].auto, null, "other tiles are manual");
ok(model.news.length >= 3 && /^\d{4}$/.test(model.news[0].year) && model.news[0].en && model.news[0].ar, "news items");
ok(model.roles.some((r) => r.org === "Shaqra University" && r.orgAr === "جامعة شقراء"), "role with an Arabic organisation name");
ok(model.roles.some((r) => r.org === "PSU" && r.orgAr === ""), "role without an Arabic organisation name");
eq(model.fonts, { ar: "IBM Plex Sans Arabic", en: "Manrope", head: "Georgia" }, "fonts");
ok(model.texts.length > 100, "free texts listed (" + model.texts.length + ")");
ok(model.texts.every((t) => t.id && (t.page === "index.html" || t.page === "publications.html")), "texts have id and page");
eq(new Set(model.texts.map((t) => t.id)).size, model.texts.length, "text ids are unique");
ok(model.texts.some((t) => t.en === "Dr. Omaia Al-Omari | AI & Information Systems"), "entities are unescaped on read");
const blockTexts = model.texts.filter((t) => model.news.some((n) => n.en === t.en) || model.roles.some((r) => r.en === t.en) || t.en === "Years of experience");
eq(blockTexts.length, 0, "texts inside dashboard blocks are not listed twice");
ok(!model.texts.some((t) => t.en === "APA 7 reference" || t.en === "Copy APA reference" || t.en === "View DOI ↗"), "texts inside publication cards are excluded");
eq(L.read({}).works, [], "read({}) does not throw");
ok(L.read({}).warnings.length > 0, "read({}) reports what is missing");

/* ------------------------------------------------------------------ */
section("round trip: an unchanged model changes nothing");
[TODAY, "2026-11-21", "2030-12-31"].forEach((day) => {
  const out = L.build(files, L.read(files), { today: day });
  eq(Object.keys(out.files), [], "no files for today=" + day);
  eq(out.warnings, [], "no warnings for today=" + day);
  eq(out.summary, [], "empty summary for today=" + day);
});
eq(Object.keys(L.build(files, JSON.parse(JSON.stringify(model)), { today: TODAY }).files), [], "a JSON copy of the model also changes nothing");
eq(Object.keys(L.build(files, {}, { today: TODAY }).files), [], "an empty model changes nothing");

section("every block is reproduced exactly by its renderer");
{
  const idx = files["index.html"], pubs = files["publications.html"];
  const c = L.counts(model.works);
  const metrics = JSON.parse(files["data/metrics.json"]);
  ok(I.renderMetrics(I.parseMetrics(I.blockLines(idx, "dash:metrics")), null) === inner(idx, "dash:metrics"), "tiles");
  ok(I.renderMetrics(model.metrics, c.works) === inner(idx, "dash:metrics"), "tiles with the automatic count");
  ok(I.renderNews(model.news) === inner(idx, "dash:news"), "news");
  ok(I.renderRoles(model.roles) === inner(idx, "dash:roles"), "roles");
  ok(I.renderFonts(model.fonts) === inner(idx, "dash:fonts"), "fonts (index.html)");
  ok(I.renderFonts(model.fonts) === inner(pubs, "dash:fonts"), "fonts (publications.html)");
  ok(I.renderYears(c.years) === inner(pubs, "dash:years"), "year options");
  ok(I.renderThemes(inner(idx, "dash:themes"), c.themes) === inner(idx, "dash:themes"), "theme strip");
  ok(I.latestMarkup(I.latestList(model.works.map(I.normalizeWork), metrics), metrics.orcid_new) === inner(idx, "metrics:latest"), "latest publications");
  const parsed = files["research-data.js"];
  ok(parsed.slice(0, parsed.indexOf("{")) + JSON.stringify(data0) + parsed.slice(parsed.lastIndexOf("}") + 1) === parsed, "research-data.js serialisation");
  ok(JSON.stringify(metrics, null, 1) + "\n" === files["data/metrics.json"], "metrics.json serialisation");
  ok(JSON.stringify(ldOf(pubs)) === /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(pubs)[1], "JSON-LD serialisation");

  // Cards. The canonical generator reproduces the hand-checked cards byte for byte. The known exceptions keep their
  // existing markup when untouched (build never regenerates an unchanged work):
  //   P38, P39, P40: written later in a compact layout (single-line <p>/<button>, no Arabic aria-label);
  //   P25, P39, P40: have a verification note in the data that the card deliberately does not show;
  //   P05: its note was reworded by hand in the page and carries an Arabic translation that is not in the data.
  const byDoi = {};
  metrics.per_work.forEach((r) => { if (r.doi) byDoi[r.doi.toLowerCase()] = r; });
  const existing = cardsOf(pubs), notes = I.harvestNotes(inner(pubs, "dash:cards"));
  const different = model.works.map(I.normalizeWork).filter((w) => I.cardHtml(w, { metricsByDoi: byDoi, noteAr: notes }) !== existing.map[w.id]).map((w) => w.id);
  eq(different, ["P05", "P25", "P38", "P39", "P40"], "cards the canonical generator does not reproduce exactly");
  eq(existing.order, model.works.map((w) => w.id).reverse(), "cards are in descending id order");
}

/* ------------------------------------------------------------------ */
section("adding a work");
const withNew = JSON.parse(JSON.stringify(model));
withNew.works.push(Object.assign({}, NEW_WORK, { id: L.nextId(model.works) }));
eq(L.nextId(model.works), "P41", "nextId");
eq(L.validate(withNew), [], "the new work is valid");
const added = L.build(files, withNew, { today: TODAY });
const N = model.works.length;
{
  eq(sorted(Object.keys(added.files)), sorted(["index.html", "ar/index.html", "publications.html", "ar/publications.html", "research-data.js", "data/metrics.json", "sitemap.xml"]), "changed files");
  eq(added.warnings, [], "no warnings");
  ok(added.summary.some((s) => s.indexOf("P41") >= 0) && added.summary.some((s) => s.indexOf(N + " ← " + (N + 1)) >= 0), "summary names the new work and the new total");
  const pubs = added.files["publications.html"], idx = added.files["index.html"];
  const before = cardsOf(files["publications.html"]), after = cardsOf(pubs);
  eq(after.order.length, N + 1, "N+1 cards");
  eq((pubs.match(/class="publication-card"/g) || []).length, N + 1, "N+1 card elements");
  eq(after.order[0], "P41", "the new card comes first");
  ok(before.order.every((id) => after.map[id] === before.map[id]), "existing cards keep their markup");
  const card = after.map.P41;
  ok(card.indexOf('id="p41"') > 0 && card.indexOf('data-year="2027"') > 0 && card.indexOf('data-theme="Healthcare and clinical decision support"') > 0, "card attributes");
  ok(card.indexOf('<a href="https://doi.org/10.1234/jcai.2027.001" target="_blank" rel="noopener" data-en="View DOI ↗" data-ar="عرض DOI ↗">View DOI ↗</a>') > 0, "bare DOI is normalised to a doi.org link");
  ok(card.indexOf('<span class="pub-cites" data-doi="10.1234/jcai.2027.001" data-ar="لا استشهادات بعد · Crossref">Cited by 0 · Crossref</span>') > 0, "a DOI without a metric shows Cited by 0 · Crossref");
  ok(card.indexOf("<span>agentic AI</span><span>clinical triage</span><span>verification</span>") > 0, "methods");
  ok(card.indexOf('data-ar="الرعاية الصحية ودعم القرار السريري"') > 0 && card.indexOf('data-ar="مقالة في دورية"') > 0, "Arabic theme and type labels");
  ok(card.indexOf("verification-note") < 0, "no note when the note is empty");
  ok(pubs.indexOf('<strong data-count="works">' + (N + 1) + "</strong>") > 0, "data-count works");
  const c0 = L.counts(model.works);
  ok(pubs.indexOf('<strong data-count="journal">' + (c0.journal + 1) + "</strong>") > 0, "data-count journal");
  ok(pubs.indexOf('<strong data-count="conference">' + c0.conference + "</strong>") > 0, "data-count conference unchanged");
  ok(inner(pubs, "dash:years").indexOf('\n<option value="2027">2027</option>\n<option value="2026">2026</option>') === 0, "year option 2027 first");
  const ld = ldOf(pubs);
  eq(ld.mainEntity.numberOfItems, N + 1, "JSON-LD numberOfItems");
  eq(ld.mainEntity.itemListElement.length, N + 1, "JSON-LD list length");
  const last = ld.mainEntity.itemListElement[N];
  eq([last.position, last.item.name, last.item.datePublished, last.item.url], [N + 1, NEW_WORK.title, "2027", "https://doi.org/10.1234/jcai.2027.001"], "JSON-LD item of the new work");
  eq(ld.mainEntity.itemListElement.slice(0, N), ldOf(files["publications.html"]).mainEntity.itemListElement, "other JSON-LD items unchanged");
  eq(ld.dateModified, TODAY, "JSON-LD dateModified");
  ok(ld.description.indexOf((N + 1) + " verified works") > 0 && ld.description.indexOf("5 January 2027") > 0, "JSON-LD description count and cutoff");
  [
    "Search and explore " + (N + 1) + " verified works", "ابحث واستعرض " + (N + 1) + " عملاً موثقاً", "محفظة قابلة للبحث تضم " + (N + 1) + " عملاً موثقاً",
    (N + 1) + " peer-reviewed works, 2011–2027.", (N + 1) + " عملاً محكّماً، 2011–2027.", "Answers from the " + (N + 1) + " works only",
    "إجابات من الأعمال الـ" + (N + 1) + " فقط", "All " + (N + 1) + " verified works", "جميع الأعمال الموثقة وعددها " + (N + 1),
    (N + 1) + " of " + (N + 1) + " results", (N + 1) + " نتيجة من " + (N + 1), "records through 5 January 2027.", "Crossref حتى 5 يناير 2027،",
    "Verification cutoff: 5 January 2027", "تاريخ التحقق: 5 يناير 2027",
  ].forEach((phrase) => ok(pubs.indexOf(phrase) >= 0, "publications.html has: " + phrase));
  ok(!new RegExp("(?:explore|portfolio of|All|the|وعددها|تضم|الـ) ?" + N + " ").test(pubs.replace(/<!-- dash:cards -->[\s\S]*<!-- \/dash:cards -->/, "")), "no stale count phrase left in publications.html");
  ok(pubs.indexOf("21 November 2026") < 0 && pubs.indexOf("21 نوفمبر 2026") < 0, "no stale cutoff date left");
  ok(added.files["ar/publications.html"] === L.buildArabic("publications.html", pubs), "ar/publications.html matches buildArabic of the new page");
  ok(added.files["ar/index.html"] === L.buildArabic("index.html", idx), "ar/index.html matches buildArabic of the new page");
  // index.html
  ok(idx.indexOf('<a class="metric" href="publications.html"><strong>' + (N + 1) + "</strong>") > 0, "works tile follows the count");
  ["six themes and " + (N + 1) + " peer-reviewed works", "موضوعات و" + (N + 1) + " عملاً محكّماً", "Explore all " + (N + 1) + " verified works", "الأعمال الموثقة الـ" + (N + 1) + '"',
    "Profile last updated: January 2027", "آخر تحديث للملف: يناير 2027", '"dateModified": "2027-01-05"',
  ].forEach((phrase) => ok(idx.indexOf(phrase) >= 0, "index.html has: " + phrase));
  const healthBefore = c0.themes["Healthcare and clinical decision support"];
  ok(inner(idx, "dash:themes").indexOf("الرعاية الصحية ودعم القرار السريري · " + (healthBefore + 1) + '"') > 0 && inner(idx, "dash:themes").indexOf("Healthcare &amp; clinical decision support · " + (healthBefore + 1) + "<") > 0, "theme strip count");
  const latest = inner(idx, "metrics:latest").split("\n").filter(Boolean);
  eq(latest.length, 3, "three latest works");
  eq(latest[0], '<li><time datetime="2027">2027</time> <span class="latest-title" lang="en" dir="ltr"><a href="https://doi.org/10.1234/jcai.2027.001" target="_blank" rel="noopener">' + NEW_WORK.title + '</a></span> <span class="latest-venue" lang="en">Journal of Clinical AI</span></li>', "latest block starts with the new work");
  ok(latest.every((l) => l.indexOf("Agentic Artificial Intelligence in Software Engineering") < 0) && inner(files["index.html"], "metrics:latest").indexOf("Agentic Artificial Intelligence in Software Engineering") > 0, "the oldest of the three dropped out of the latest block");
  // data
  const data = dataOf(added.files["research-data.js"]);
  eq([data.meta.total, data.meta.verificationCutoff, data.meta.verificationCutoffDisplay, data.works.length], [N + 1, TODAY, "5 January 2027", N + 1], "research-data.js meta");
  eq(data.works.slice(0, N), data0.works, "existing works are stored unchanged");
  eq(data.works[N].doi, "https://doi.org/10.1234/jcai.2027.001", "DOI stored as a doi.org link");
  eq(data.works[N].verificationNote, null, "empty note stored as null");
  eq(Object.keys(data.works[N]).slice(0, 10), Object.keys(data0.works[0]), "key order of a new work");
  ok(added.files["research-data.js"].indexOf("window.RESEARCH_PORTFOLIO={") === 0 && /};$/.test(added.files["research-data.js"]), "research-data.js wrapper kept");
  const metrics = JSON.parse(added.files["data/metrics.json"]);
  eq([metrics.works_verified, metrics.latest.length, metrics.latest[0].id, metrics.latest[0].doi, metrics.latest[0].venue], [N + 1, 3, "P41", "10.1234/jcai.2027.001", "Journal of Clinical AI"], "metrics.json latest");
  ok(added.files["data/metrics.json"] === JSON.stringify(metrics, null, 1) + "\n", "metrics.json keeps its formatting");
  eq(metrics.per_work, JSON.parse(files["data/metrics.json"]).per_work, "per_work is left to tools/refresh_metrics.py");
  eq((added.files["sitemap.xml"].match(/<lastmod>2027-01-05<\/lastmod>/g) || []).length, 4, "sitemap lastmod");
  // the result is stable: reading it back and building again changes nothing
  const next = overlay(files, added);
  const again = L.build(next, L.read(next), { today: "2027-02-01" });
  eq(Object.keys(again.files), [], "building again from the result changes nothing");
  eq(L.read(next).works.length, N + 1, "the result reads back with N+1 works");
}

section("Python and JavaScript generators agree on a modified site");
{
  let python = true;
  try { execFileSync("python3", ["--version"], { stdio: "ignore" }); } catch (e) { python = false; }
  if (!python) console.log("  (python3 not available: skipped)");
  else {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dash-"));
    fs.mkdirSync(path.join(tmp, "tools"));
    fs.copyFileSync(path.join(ROOT, "tools", "build-arabic.py"), path.join(tmp, "tools", "build-arabic.py"));
    fs.writeFileSync(path.join(tmp, "index.html"), added.files["index.html"]);
    fs.writeFileSync(path.join(tmp, "publications.html"), added.files["publications.html"]);
    pythonNeeds(tmp);
    execFileSync("python3", [path.join(tmp, "tools", "build-arabic.py")], { stdio: "ignore" });
    ["index.html", "publications.html"].forEach((page) => {
      const py = fs.readFileSync(path.join(tmp, "ar", page), "utf8");
      ok(py === added.files["ar/" + page], "ar/" + page + " (python) equals the JavaScript output");
    });
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ */
section("deleting a work");
{
  const m = JSON.parse(JSON.stringify(model));
  const gone = m.works.find((w) => w.id === "P10");
  m.works = m.works.filter((w) => w.id !== "P10");
  const out = L.build(files, m, { today: TODAY });
  eq(sorted(Object.keys(out.files)), sorted(["index.html", "ar/index.html", "publications.html", "ar/publications.html", "research-data.js", "data/metrics.json", "sitemap.xml"]), "changed files");
  eq(out.warnings, [], "no warnings");
  const pubs = out.files["publications.html"], after = cardsOf(pubs), before = cardsOf(files["publications.html"]);
  eq(after.order.length, N - 1, "N-1 cards");
  ok(!after.map.P10 && pubs.indexOf(gone.title) < 0, "the card and its JSON-LD item are gone");
  ok(after.order.every((id) => after.map[id] === before.map[id]), "the other cards keep their markup");
  eq(ldOf(pubs).mainEntity.itemListElement.map((x) => x.position), Array.from({ length: N - 1 }, (x, i) => i + 1), "JSON-LD positions renumbered");
  ok(pubs.indexOf('<strong data-count="works">' + (N - 1) + "</strong>") > 0 && pubs.indexOf((N - 1) + " of " + (N - 1) + " results") > 0, "counts");
  eq(dataOf(out.files["research-data.js"]).works.map((w) => w.id).indexOf("P10"), -1, "removed from research-data.js");
  eq(dataOf(out.files["research-data.js"]).meta.total, N - 1, "meta.total");
  const theme = gone.theme, n0 = L.counts(model.works).themes[theme];
  ok(new RegExp(" · " + (n0 - 1) + '[^"]*" href="publications\\.html\\?theme=' + encodeURIComponent(theme).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(inner(out.files["index.html"], "dash:themes")), "theme strip count went down");
  ok(out.summary.some((s) => s.indexOf("حُذف بحث P10") === 0), "summary");
  eq(L.nextId(m.works), "P41", "ids are not reused after a delete in the middle");
  // deleting the only work of a year removes the year option
  const m2 = JSON.parse(JSON.stringify(model));
  m2.works = m2.works.filter((w) => w.year !== 2011);
  const out2 = L.build(files, m2, { today: TODAY });
  ok(inner(out2.files["publications.html"], "dash:years").indexOf("2011") < 0, "year option removed with its last work");
  ok(out2.files["publications.html"].indexOf("peer-reviewed works, 2014–2026.") > 0, "year range follows the works");
}

section("editing a work");
{
  const m = JSON.parse(JSON.stringify(model));
  const w25 = m.works.find((w) => w.id === "P25");
  w25.contribution = w25.contribution + " Updated.";
  const w01 = m.works.find((w) => w.id === "P01");
  w01.title = "Evaluating the Effect of Stemming in Clustering of Arabic Documents (Revisited)";
  const out = L.build(files, m, { today: TODAY });
  const before = cardsOf(files["publications.html"]), after = cardsOf(out.files["publications.html"]);
  eq(after.order, before.order, "same cards, same order");
  eq(after.order.filter((id) => after.map[id] !== before.map[id]), ["P25", "P01"], "only the edited cards were regenerated");
  ok(after.map.P25.indexOf(" Updated.</p>") > 0 && after.map.P25.indexOf("verification-note") < 0, "P25: new text, and still no visible note (the note did not change)");
  ok(after.map.P25.indexOf('data-ar="23 استشهاداً · Crossref">Cited by 23 · Crossref</span>') > 0, "P25: citation count from data/metrics.json");
  ok(after.map.P01.indexOf("<h3>Evaluating the Effect of Stemming in Clustering of Arabic Documents (Revisited)</h3>") > 0, "P01: new title");
  ok(after.map.P01.indexOf('data-ar="لا يتوفر رقم DOI في السجل الموثق."') > 0 && after.map.P01.indexOf('data-en="No DOI in the verified record"') > 0, "P01: Arabic note and no-DOI label kept");
  ok(after.map.P01.indexOf("pub-cites") < 0, "P01: no citation element without a DOI");
  eq(ldOf(out.files["publications.html"]).mainEntity.itemListElement[0].item.name, w01.title, "JSON-LD name follows the title");
  eq(ldOf(out.files["publications.html"]).mainEntity.itemListElement[0].item.url, "https://dromaia.github.io/publications.html#p01", "JSON-LD url of a work without DOI");
  eq(Object.keys(out.files).indexOf("data/metrics.json"), -1, "metrics.json untouched when the latest works did not change");
  // a new note on an existing work is shown, with a translation when the page already knows the sentence
  const m3 = JSON.parse(JSON.stringify(model));
  m3.works.find((w) => w.id === "P10").verificationNote = "Checked against the publisher page.";
  const c10 = cardsOf(L.build(files, m3, { today: TODAY }).files["publications.html"]).map.P10;
  ok(c10.indexOf('<span data-en="Checked against the publisher page.">Checked against the publisher page.</span></p>') > 0, "a new note is shown");
  ok(c10.indexOf('<span class="pub-cites" data-doi="10.31838/jcr.07.18.264"></span>') > 0, "a DOI known to the metrics file without a count keeps an empty citation element");
  // a link that is not a DOI
  const m4 = JSON.parse(JSON.stringify(model));
  const w38 = m4.works.find((w) => w.id === "P38");
  w38.doi = "https://example.org/paper.pdf";
  const c38 = cardsOf(L.build(files, m4, { today: TODAY }).files["publications.html"]).map.P38;
  ok(c38.indexOf('data-en="View publisher PDF ↗"') > 0 && c38.indexOf("pub-cites") < 0, "a PDF address gets the publisher label and no citation element");
}

/* ------------------------------------------------------------------ */
section("news, roles and tiles change only the home page");
{
  const m = JSON.parse(JSON.stringify(model));
  m.news.unshift({ year: "2027", en: 'Keynote at "AI & Society" <Riyadh>', ar: "كلمة رئيسية في «الذكاء والمجتمع»" });
  m.news.pop();
  m.roles.push({ org: "KSU", orgAr: "جامعة الملك سعود", en: "External examiner", ar: "ممتحن خارجي" });
  m.roles.push({ org: "IEEE", orgAr: "", en: "Senior Member", ar: "" });
  m.metrics[1].value = "650+";
  m.metrics.splice(3, 0, { value: "12", en: "Courses taught", ar: "مقرراً", href: null });
  const out = L.build(files, m, { today: TODAY });
  eq(sorted(Object.keys(out.files)), ["ar/index.html", "index.html"], "changed files");
  eq(out.warnings, [], "no warnings");
  eq(out.summary.length, 3, "three summary lines");
  const idx = out.files["index.html"];
  const news = inner(idx, "dash:news").split("\n").filter(Boolean);
  eq(news.length, model.news.length, "news count");
  eq(news[0], '<li><time datetime="2027">2027</time> — <span data-ar="كلمة رئيسية في «الذكاء والمجتمع»">Keynote at "AI &amp; Society" &lt;Riyadh&gt;</span></li>', "news line, escaped");
  const roles = inner(idx, "dash:roles").split("\n").filter(Boolean);
  eq(roles[roles.length - 2], '<article class="society-item"><span class="society-org" data-ar="جامعة الملك سعود">KSU</span><span class="society-role" data-ar="ممتحن خارجي">External examiner</span></article>', "role with Arabic");
  eq(roles[roles.length - 1], '<article class="society-item"><span class="society-org">IEEE</span><span class="society-role">Senior Member</span></article>', "role without Arabic");
  const tiles = inner(idx, "dash:metrics").split("\n").filter(Boolean);
  eq(tiles.length, 5, "five tiles");
  eq(tiles[1], '  <div class="metric"><strong>650+</strong><span data-ar="استشهاد · Google Scholar">Citations · Google Scholar</span></div>', "edited tile");
  eq(tiles[3], '  <div class="metric"><strong>12</strong><span data-ar="مقرراً">Courses taught</span></div>', "new tile");
  eq(tiles[4], '  <a class="metric" href="publications.html"><strong>' + N + '</strong><span data-ar="عملاً موثقاً">Verified works</span></a>', "works tile untouched");
  ok(idx.indexOf("Profile last updated: November 2026") > 0, "the profile month does not move without a change of works");
  ok(out.files["ar/index.html"] === L.buildArabic("index.html", idx), "Arabic page rebuilt");
  ok(out.files["ar/index.html"].indexOf("كلمة رئيسية في «الذكاء والمجتمع»</span>") > 0 && out.files["ar/index.html"].indexOf("ممتحن خارجي</span>") > 0, "Arabic page shows the Arabic texts");
  const back = L.read(overlay(files, out));
  eq(back.news[0], m.news[0], "news reads back");
  eq(back.roles.slice(-2), m.roles.slice(-2), "roles read back");
  eq(back.metrics.map((t) => t.value), ["18+", "650+", "14", "12", String(N)], "tiles read back");
  eq(Object.keys(L.build(overlay(files, out), back, { today: TODAY }).files), [], "stable after reading back");
  // the automatic tile ignores a typed value
  const m2 = JSON.parse(JSON.stringify(model));
  m2.metrics[3].value = "999";
  eq(Object.keys(L.build(files, m2, { today: TODAY }).files), [], "the works tile cannot be set by hand");
}

section("fonts change both pages");
{
  const m = JSON.parse(JSON.stringify(model));
  m.fonts = { ar: "Tajawal", en: "Source Sans 3" }; // a version 1 draft: no heading font, the current one is kept
  const out = L.build(files, m, { today: TODAY });
  eq(sorted(Object.keys(out.files)), ["ar/index.html", "ar/publications.html", "index.html", "publications.html"], "changed files");
  const expected = '\n    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&family=Tajawal:wght@400;500;700&display=swap">' +
    '\n    <style>:root{--font-en:"Source Sans 3";--font-ar:"Tajawal";--font-head-en:"Georgia";}</style>\n    ';
  eq(inner(out.files["index.html"], "dash:fonts"), expected, "fonts block (index.html)");
  eq(inner(out.files["publications.html"], "dash:fonts"), expected, "fonts block (publications.html)");
  ok(out.files["ar/index.html"].indexOf('--font-ar:"Tajawal"') > 0 && out.files["ar/publications.html"].indexOf('--font-ar:"Tajawal"') > 0, "Arabic pages carry the fonts");
  eq(out.files["index.html"].replace(expected, ""), files["index.html"].replace(inner(files["index.html"], "dash:fonts"), ""), "nothing else changed in index.html");
  eq(L.read(overlay(files, out)).fonts, { ar: "Tajawal", en: "Source Sans 3", head: "Georgia" }, "fonts read back");
  ok(out.summary.length === 1 && out.summary[0].indexOf("Tajawal") > 0, "summary");
  eq(L.validate(Object.assign({}, m, { fonts: { ar: "Comic Sans", en: "Manrope" } })).length, 1, "an unknown font is rejected");
}

section("free texts are edited in place");
{
  const m = JSON.parse(JSON.stringify(model));
  const skip = m.texts.find((t) => t.page === "index.html" && t.en === "Skip to content");
  skip.en = 'Jump to "content" & <more>';
  skip.ar = "انتقل إلى المحتوى";
  const out = L.build(files, m, { today: TODAY });
  eq(sorted(Object.keys(out.files)), ["ar/index.html", "index.html"], "changed files");
  const idx = out.files["index.html"];
  ok(idx.indexOf('data-ar="انتقل إلى المحتوى"') > 0 && idx.indexOf('>Jump to "content" &amp; &lt;more&gt;</a>') > 0, "text and data-ar replaced, escaped");
  eq(idx.length - files["index.html"].length, ('Jump to "content" &amp; &lt;more&gt;'.length - "Skip to content".length) + ("انتقل إلى المحتوى".length - "تجاوز إلى المحتوى".length), "nothing else changed");
  ok(out.files["ar/index.html"].indexOf(">انتقل إلى المحتوى</a>") > 0, "Arabic page shows the new Arabic text");
  eq(L.read(overlay(files, out)).texts.find((t) => t.id === skip.id).en, skip.en, "reads back unescaped");
  eq(out.summary, ["عُدّل نص واحد."], "summary");
  // an element that also carries data-en keeps it in step
  const m2 = JSON.parse(JSON.stringify(model));
  const heading = m2.texts.find((t) => t.page === "publications.html" && t.en === "No matching works");
  ok(Boolean(heading), "a publications.html text with data-en exists");
  heading.en = "Nothing found";
  heading.ar = "لا نتائج";
  const out2 = L.build(files, m2, { today: TODAY });
  eq(sorted(Object.keys(out2.files)), ["ar/publications.html", "publications.html"], "changed files (publications.html)");
  ok(out2.files["publications.html"].indexOf('<h3 data-en="Nothing found" data-ar="لا نتائج">Nothing found</h3>') > 0, "data-en, data-ar and text replaced together");
  // several edits on one page, including the first and a late one
  const m3 = JSON.parse(JSON.stringify(model));
  const mine = m3.texts.filter((t) => t.page === "index.html");
  mine[0].ar = "عنوان جديد";
  mine[mine.length - 1].en = "Last text edited";
  const out3 = L.build(files, m3, { today: TODAY });
  const back = L.read(overlay(files, out3)).texts.filter((t) => t.page === "index.html");
  eq([back.length, back[0].ar, back[back.length - 1].en], [mine.length, "عنوان جديد", "Last text edited"], "two edits applied by position");
  eq(out3.summary, ["عُدّلت 2 نصوص."], "summary for two edits");
}

/* ------------------------------------------------------------------ */
section("HTML escaping of a work");
{
  const m = JSON.parse(JSON.stringify(model));
  const nasty = Object.assign({}, NEW_WORK, {
    title: 'R&D of "Smart" <Agents>: It\'s </script><script>alert(1)</script> Time',
    methods: ["A&B", "<x>"],
    contribution: 'Shows that 1 < 2 & "quotes" survive.',
    reference: 'Al-Omari, O. (2027). R&D of "smart" <agents>. Journal, 1(1).',
    verificationNote: 'Note with <b>tags</b> & "quotes".',
  });
  m.works.push(nasty);
  const out = L.build(files, m, { today: TODAY });
  eq(out.warnings, [], "no warnings");
  const pubs = out.files["publications.html"], card = cardsOf(pubs).map.P41;
  ok(card.indexOf("<h3>R&amp;D of &quot;Smart&quot; &lt;Agents&gt;: It&#x27;s &lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt; Time</h3>") > 0, "title escaped in the heading");
  ok(card.indexOf("<script") < 0 && card.indexOf("<b>") < 0 && card.indexOf("<x>") < 0, "no raw tag from the data");
  ok(card.indexOf("<span>A&amp;B</span><span>&lt;x&gt;</span>") > 0, "methods escaped");
  ok(card.indexOf('data-reference="Al-Omari, O. (2027). R&amp;D of &quot;smart&quot; &lt;agents&gt;. Journal, 1(1)."') > 0, "reference escaped in the attribute");
  ok(/data-search="[^"]*R&amp;D of &quot;Smart&quot; &lt;Agents&gt;[^"]*"\n/.test(card), "data-search stays one attribute");
  ok(card.indexOf("Note with &lt;b&gt;tags&lt;/b&gt; &amp; &quot;quotes&quot;.</span></p>") > 0, "note escaped");
  eq((pubs.match(/<script/g) || []).length, (files["publications.html"].match(/<script/g) || []).length, "no new script element in the page");
  eq(ldOf(pubs).mainEntity.itemListElement[N].item.name, nasty.title, "JSON-LD holds the raw title");
  ok(/<script type="application\/ld\+json">[^<]*<\/script>/.test(pubs), "JSON-LD contains no '<' (written as \\u003c)");
  eq(dataOf(out.files["research-data.js"]).works[N].title, nasty.title, "research-data.js holds the raw title");
  const latest = inner(out.files["index.html"], "metrics:latest");
  ok(latest.indexOf("R&amp;D of &quot;Smart&quot; &lt;Agents&gt;") > 0 && latest.indexOf("<script") < 0, "latest block escaped");
  eq((out.files["ar/publications.html"].match(/class="publication-card"/g) || []).length, N + 1, "Arabic page still has N+1 cards");
  eq(L.read(overlay(files, out)).works[N].title, nasty.title, "reads back");
  eq(Object.keys(L.build(overlay(files, out), L.read(overlay(files, out)), { today: TODAY }).files), [], "stable after reading back");
}

/* ------------------------------------------------------------------ */
section("validate()");
{
  eq(L.validate(model), [], "the current site is valid");
  const bad = JSON.parse(JSON.stringify(model));
  bad.works.push({ id: "P40", title: "", year: "20x7", type: "Poster", theme: "Other", methods: [], contribution: "", reference: "", doi: "not a doi" });
  bad.news.push({ year: "27", en: "", ar: "" });
  bad.roles.push({ org: "", orgAr: "", en: "", ar: "" });
  bad.metrics.push({ value: "", en: "", ar: "" });
  const errors = L.validate(bad);
  eq(errors.length, 15, "fifteen errors: " + errors.join(" | "));
  ok(errors.every((e) => /[؀-ۿ]/.test(e)), "errors are in Arabic");
  ok(errors.some((e) => e.indexOf("مكرر") > 0), "duplicate id reported");
  eq(L.validate({ works: [Object.assign({}, NEW_WORK, { id: "41" })] }).length, 1, "bad id format");
  eq(L.validate({ works: [Object.assign({}, NEW_WORK, { doi: "https://doi.org/10.1234/x" })] }), [], "doi.org link accepted");
  eq(L.validate({ works: [Object.assign({}, NEW_WORK, { doi: "" })] }), [], "empty DOI accepted");
  eq(L.validate({}), [], "empty model");
  eq(L.normalizeDoi("doi:10.1000/ABC.1"), "https://doi.org/10.1000/ABC.1", "normalizeDoi: doi: prefix");
  eq(L.normalizeDoi("http://dx.doi.org/10.1000/abc"), "https://doi.org/10.1000/abc", "normalizeDoi: dx.doi.org");
  eq(L.normalizeDoi("  "), null, "normalizeDoi: empty");
  eq(L.nextId([]), "P01", "nextId on an empty list");
  eq(L.nextId([{ id: "P09" }, { id: "P120" }]), "P121", "nextId past 99");
}

section("fromCrossref()");
{
  const journal = {
    DOI: "10.3390/computers15110825", type: "journal-article",
    title: ["From Generation to Verification: A Reproducible Empirical Study of Verification-Guided LLM Workflows for Software Engineering"],
    "container-title": ["Computers"], volume: "15", issue: "11", "article-number": "825",
    issued: { "date-parts": [[2026, 11, 12]] },
    author: [{ given: "Mohammed", family: "Akour" }, { given: "Omaia", family: "Al-Omari" }, { given: "Mohammad", family: "Alzoubi" }],
  };
  const w = L.fromCrossref(journal);
  eq(w.title, journal.title[0], "title");
  eq([w.year, w.type, w.doi, w.venue], [2026, "Journal article", "https://doi.org/10.3390/computers15110825", "Computers"], "year, type, doi, venue");
  eq(w.reference, "Akour, M., Al-Omari, O., & Alzoubi, M. (2026). From generation to verification: A reproducible empirical study of verification-guided LLM workflows for software engineering. Computers, 15(11), 825.", "APA reference (journal)");
  eq(L.fromCrossref({ status: "ok", message: journal }).reference, w.reference, "the whole Crossref response is accepted too");
  const conf = L.fromCrossref({
    DOI: "10.1109/DASA63652.2024.10836479", type: "proceedings-article", publisher: "IEEE", page: "1-5",
    title: ["MuSeRAN: Multimodal Sentiment Analysis with Recurrent Attention Networks"],
    "container-title": ["2024 International Conference on Decision Aid Sciences and Applications (DASA)"],
    published: { "date-parts": [[2024, 12, 11]] },
    author: [{ given: "Omaia", family: "Al-Omari" }, { given: "Asem", family: "Omari" }],
  });
  eq(conf.type, "Conference paper", "conference type");
  eq(conf.reference, "Al-Omari, O., & Omari, A. (2024). MuSeRAN: Multimodal sentiment analysis with recurrent attention networks. In 2024 International Conference on Decision Aid Sciences and Applications (DASA) (pp. 1-5). IEEE.", "APA reference (conference)");
  const chapter = L.fromCrossref({ DOI: "10.1007/978-3-031-87778-0_7", type: "book-chapter", publisher: "Springer", page: "74-84",
    title: ["Applying <i>Artificial Intelligence</i> Techniques on Cyber Attacks Dataset &amp; More"], "container-title": ["Lecture Notes on Data Engineering and Communications Technologies", "Book"],
    issued: { "date-parts": [[2025]] }, author: [{ given: "Jean-Paul Marie", family: "Dupont" }, { name: "PSU Lab" }] });
  eq(chapter.type, "Book chapter", "chapter type");
  eq(chapter.title, "Applying Artificial Intelligence Techniques on Cyber Attacks Dataset & More", "tags and entities removed from the title");
  ok(chapter.reference.indexOf("Dupont, J.-P. M., & PSU Lab (2025).") === 0, "hyphenated initials and an organisation author: " + chapter.reference);
  const empty = L.fromCrossref({});
  eq([empty.title, empty.year, empty.type, empty.doi], ["", null, "", null], "an empty record gives empty fields");
  const built = L.build(files, Object.assign(JSON.parse(JSON.stringify(model)), { works: model.works.concat([Object.assign({ id: "P41", theme: L.THEMES[0].en, methods: ["m"], contribution: "c" }, w)]) }), { today: TODAY });
  eq(built.warnings, [], "a Crossref work can be added directly");
}

/* ------------------------------------------------------------------ */
section("repairs and missing pieces");
{
  // a page that is out of step with the catalogue is repaired by the next build, even with an unchanged model
  const stale = Object.assign({}, files);
  stale["index.html"] = files["index.html"].replace("Explore all " + N + " verified works", "Explore all 37 verified works")
    .replace('href="publications.html"><strong>' + N + "</strong>", 'href="publications.html"><strong>37</strong>');
  stale["publications.html"] = files["publications.html"].replace('<strong data-count="journal">', '<strong data-count="journal">1');
  const out = L.build(stale, L.read(stale), { today: TODAY });
  eq(sorted(Object.keys(out.files)), ["ar/index.html", "ar/publications.html", "index.html", "publications.html"], "stale counts repaired");
  ok(out.files["index.html"] === files["index.html"] && out.files["publications.html"] === files["publications.html"], "repaired pages equal the correct pages");
  ok(out.summary.length === 1, "a summary line explains the repair");
  // missing markers and phrases give Arabic warnings, never an exception
  const broken = Object.assign({}, files);
  broken["index.html"] = files["index.html"].replace("<!-- dash:news -->", "").replace("Explore all " + N + " verified works", "Explore everything");
  broken["publications.html"] = files["publications.html"].replace("<!-- dash:years -->", "").replace('data-count="chapter"', 'data-x="chapter"');
  delete broken["sitemap.xml"];
  delete broken["data/metrics.json"];
  const m = L.read(broken);
  ok(m.warnings.length >= 2 && m.warnings.every((w) => /[؀-ۿ]/.test(w)), "read() warns about missing markers");
  m.works.push(Object.assign({}, NEW_WORK));
  m.news.push({ year: "2027", en: "x", ar: "" });
  let result = null;
  try { result = L.build(broken, m, { today: TODAY }); } catch (e) { result = null; console.log("    threw: " + e.message); }
  ok(result !== null, "build() does not throw on a damaged site");
  if (result) {
    ok(result.warnings.length >= 4 && result.warnings.every((w) => /[؀-ۿ]/.test(w)), "Arabic warnings: " + result.warnings.length);
    ok(result.warnings.some((w) => w.indexOf("Explore all N verified works") > 0), "missing phrase reported");
    ok(result.warnings.some((w) => w.indexOf("dash:news") > 0) && result.warnings.some((w) => w.indexOf("dash:years") > 0), "missing markers reported");
    eq((result.files["publications.html"].match(/class="publication-card"/g) || []).length, N + 1, "the rest of the change is still made");
    ok(!("sitemap.xml" in result.files) && !("data/metrics.json" in result.files), "absent files are not invented");
  }
  // only some of the files
  const only = L.build({ "index.html": files["index.html"] }, { fonts: { ar: "Cairo", en: "Inter" } }, { today: TODAY });
  eq(sorted(Object.keys(only.files)), ["ar/index.html", "index.html"], "works with a subset of the files");
}

/* ------------------------------------------------------------------ */
section("research-assistant.js computes its numbers from the catalogue");
{
  // A very small recording DOM: enough for the script to build its panel and answer a question.
  function makeDom(lang) {
    const listeners = {};
    function element(tag) {
      const el = {
        tag, children: [], attributes: {}, listeners: {}, hidden: false, textContent: "", className: "", value: "",
        setAttribute(k, v) { this.attributes[k] = v; },
        append(...nodes) { nodes.forEach((n) => this.children.push(n)); },
        addEventListener(name, fn) { this.listeners[name] = fn; },
        focus() {},
        _cache: {},
        querySelector(sel) { if (!this._cache[sel]) this._cache[sel] = element(sel); return this._cache[sel]; },
        get childElementCount() { return this.children.length; },
        get scrollHeight() { return 0; },
        set innerHTML(v) { this._html = v; },
      };
      return el;
    }
    const body = element("body");
    const document = {
      documentElement: { lang },
      body,
      createElement: element,
      createTextNode: (text) => ({ textContent: text }),
      querySelectorAll: () => [],
      addEventListener(name, fn) { listeners[name] = fn; },
    };
    const window = { setTimeout() {} };
    return { document, window, body };
  }
  function allText(node) {
    return [node.textContent || ""].concat((node.children || []).map(allText)).join(" ");
  }
  function run(dataJs, lang, question) {
    const dom = makeDom(lang);
    const sandbox = { window: dom.window, document: dom.document, MutationObserver: function () { this.observe = () => {}; }, console };
    sandbox.window.document = dom.document;
    vm.createContext(sandbox);
    vm.runInContext(dataJs, sandbox);
    vm.runInContext(read("research-assistant.js"), sandbox);
    const panel = dom.body.children[1];
    const header = panel.querySelector(".assistant-header small").textContent;
    const form = panel.querySelector(".assistant-form");
    const input = form.querySelector("input");
    dom.body.children[0].listeners.click(); // open: prints the welcome message
    input.value = question;
    form.listeners.submit({ preventDefault() {} });
    const messages = panel.querySelector(".assistant-messages");
    return { header, text: allText(messages), html: panel._html };
  }
  const en = run(files["research-data.js"], "en", "How many works are there?");
  eq(en.header, "Grounded in 40 verified works · cutoff 21 November 2026", "header (English, current data)");
  ok(en.text.indexOf("Ask about the 40 verified works, six research themes") >= 0, "welcome (English)");
  ok(en.text.indexOf("The portfolio contains 40 verified works: 23 journal articles, 13 conference papers, and 4 book chapters. Twenty-eight works appeared during 2024-2026, including 17 in 2025.") >= 0, "totals sentence keeps its wording (English)");
  ok(en.text.indexOf("Source: verified portfolio corpus, cutoff 21 November 2026.") >= 0, "source line (English)");
  ok(en.text.indexOf("2026 publications") >= 0, "quick prompt names the latest year (English)");
  const ar = run(files["research-data.js"], "ar", "كم عدد الأعمال؟");
  eq(ar.header, "موثق في 40 عملاً · تاريخ القطع 21 نوفمبر 2026", "header (Arabic, current data)");
  ok(ar.text.indexOf("اسأل عن الأعمال الموثقة الـ40، أو الموضوعات البحثية الستة") >= 0, "welcome (Arabic)");
  ok(ar.text.indexOf("تضم المحفظة 40 عملاً موثقاً: 23 مقالة دورية، و13 ورقة مؤتمر، و4 فصول كتب. نُشر 28 عملاً خلال 2024-2026، منها 17 عملاً في 2025.") >= 0, "totals sentence keeps its wording (Arabic)");
  ok(ar.text.indexOf("المصدر: محفظة الأعمال الموثقة، تاريخ القطع 21 نوفمبر 2026.") >= 0, "source line (Arabic)");
  ok(!/\b40\b|21 November 2026|21 نوفمبر 2026|Twenty-eight/.test(read("research-assistant.js")), "no hard-coded count or cutoff left in the script");
  // with the catalogue produced by the dashboard after adding a 2027 journal article
  const next = added.files["research-data.js"];
  const en2 = run(next, "en", "total count");
  eq(en2.header, "Grounded in 41 verified works · cutoff 5 January 2027", "header follows the new catalogue");
  ok(en2.text.indexOf("The portfolio contains 41 verified works: 24 journal articles, 13 conference papers, and 4 book chapters. Twenty-eight works appeared during 2024-2026, including 17 in 2025.") >= 0, "totals follow the new catalogue");
  const ar2 = run(next, "ar", "كم عدد الأعمال؟");
  eq(ar2.header, "موثق في 41 عملاً · تاريخ القطع 5 يناير 2027", "Arabic header follows the new catalogue");
  ok(en2.text.indexOf("2027 publications") >= 0 && ar2.text.indexOf("منشورات 2027") >= 0, "quick prompt follows the latest year");
  const y = run(next, "en", "2027 publications");
  ok(y.text.indexOf("I found 1 matching work.") >= 0 && y.text.indexOf("P41 · " + NEW_WORK.title) >= 0, "a new year is recognised in questions");
  const none = run(next, "en", "zzzzqqq");
  ok(none.text.indexOf("I could not find a reliable match in the 41-work corpus.") >= 0, "no-match sentence follows the count");
  ok(en.html.indexOf("<small></small>") > 0, "the panel template carries no number");
}

/* ================================================================== version 2 */
const copy = (value) => JSON.parse(JSON.stringify(value));
const changed = (out) => sorted(Object.keys(out.files));
const HOME_ONLY = ["ar/index.html", "index.html"];
const BOTH_PAGES = ["ar/index.html", "ar/publications.html", "index.html", "publications.html"];
const noArabic = (list) => list.every((line) => !/[؀-ۿ]/.test(line.replace(/«[^»]*»|“[^”]*”/g, "")));
function pythonArabic(index, pubs) {
  // run tools/build-arabic.py on a temporary copy (never on the repository) and return its two pages, or null without python3
  try { execFileSync("python3", ["--version"], { stdio: "ignore" }); } catch (e) { return null; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dash2-"));
  fs.mkdirSync(path.join(tmp, "tools"));
  fs.copyFileSync(path.join(ROOT, "tools", "build-arabic.py"), path.join(tmp, "tools", "build-arabic.py"));
  fs.writeFileSync(path.join(tmp, "index.html"), index);
  fs.writeFileSync(path.join(tmp, "publications.html"), pubs);
  pythonNeeds(tmp);
  execFileSync("python3", [path.join(tmp, "tools", "build-arabic.py")], { stdio: "ignore" });
  const res = { index: fs.readFileSync(path.join(tmp, "ar", "index.html"), "utf8"), pubs: fs.readFileSync(path.join(tmp, "ar", "publications.html"), "utf8") };
  fs.rmSync(tmp, { recursive: true, force: true });
  return res;
}

section("v2: API shape");
ok(L.FONTS.ar.length >= 16, "at least 16 Arabic fonts (" + L.FONTS.ar.length + ")");
ok(L.FONTS.en.length >= 12, "at least 12 English fonts (" + L.FONTS.en.length + ")");
eq(L.FONTS.head.map((f) => f.name), ["Georgia", "Playfair Display", "Merriweather", "Lora", "Source Serif 4", "body"], "heading fonts");
ok(L.FONTS.head[0].system === true && L.FONTS.head[5].system === true && L.FONTS.head[5].same === true && L.FONTS.head[5].label.ar && L.FONTS.head[5].label.en, "Georgia and 'same as body' are system entries");
["ar", "en", "head"].forEach((kind) => {
  const names = L.FONTS[kind].map((f) => f.name);
  eq(new Set(names).size, names.length, "font names are unique (" + kind + ")");
  ok(L.FONTS[kind].every((f) => Array.isArray(f.weights) && (f.system || (f.weights.length > 0 && f.weights.every((w) => w >= 100 && w <= 900 && w % 100 === 0)))), "weights are listed (" + kind + ")");
  ok(L.FONTS[kind].every((f) => /^[A-Za-z0-9 ]+$/.test(f.name)), "plain family names (" + kind + ")");
});
eq(L.PALETTES.map((p) => p.id), ["default", "sage", "slate", "rose", "ink", "teal"], "six palettes");
ok(L.PALETTES.every((p) => p.ar && p.en && ["light", "dark"].every((m) => ["bg", "surface", "surface2", "text", "muted", "line", "accent", "link", "green"].every((k) => typeof p[m][k] === "string" && p[m][k]))), "each palette has every colour for both modes");
["setLang", "contrast", "parseAchievements", "themeWarnings", "nextSectionId"].forEach((fn) => ok(typeof L[fn] === "function", fn + " is a function"));
eq(Object.keys(model).filter((k) => ["theme", "sections", "nav", "flagship", "courses", "timeline", "timelineEarlier", "photoVersion", "citations", "degrees", "theses"].indexOf(k) >= 0).length, 11, "read() returns the version 2 parts");
eq(L.validate(model), [], "the model read from the site is valid");
ok(!("cv" in model), "no model.cv while the CV module is off");

section("v2: fonts with a heading font");
{
  const m = copy(model);
  m.fonts = { ar: "Cairo", en: "Poppins", head: "Playfair Display" };
  const out = L.build(files, m, { today: TODAY });
  eq(changed(out), BOTH_PAGES, "changed files");
  const expected = '\n    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Cairo:wght@400;600;700&family=Playfair+Display:wght@400;700&display=swap">' +
    '\n    <style>:root{--font-en:"Poppins";--font-ar:"Cairo";--font-head-en:"Playfair Display";}</style>\n    ';
  eq(inner(out.files["index.html"], "dash:fonts"), expected, "fonts block (index.html)");
  eq(inner(out.files["publications.html"], "dash:fonts"), expected, "fonts block (publications.html)");
  eq(L.read(overlay(files, out)).fonts, m.fonts, "fonts read back");
  ok(out.summary.length === 1 && out.summary[0].indexOf("Playfair Display") > 0 && out.summary[0].indexOf("Cairo") > 0, "summary names the three fonts");
  eq(changed(L.build(overlay(files, out), L.read(overlay(files, out)), { today: TODAY })), [], "stable after reading back");
  // same as the body text: the variable carries the English font and nothing extra is requested
  const m2 = copy(model);
  m2.fonts = { ar: "Vazirmatn", en: "DM Sans", head: "body" };
  const out2 = L.build(files, m2, { today: TODAY });
  eq(inner(out2.files["index.html"], "dash:fonts"), '\n    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Vazirmatn:wght@400;600;700&display=swap">' +
    '\n    <style>:root{--font-en:"DM Sans";--font-ar:"Vazirmatn";--font-head-en:"DM Sans";}</style>\n    ', "'same as body' block");
  eq(L.read(overlay(files, out2)).fonts, m2.fonts, "'same as body' reads back as body");
  ok(out2.summary[0].indexOf("مثل خط النص") > 0, "summary names 'same as body'");
  // Georgia is a system font: it is never requested
  ok(inner(files["index.html"], "dash:fonts").indexOf("Georgia:") < 0 && I.renderFonts({ ar: "Amiri", en: "Lato", head: "Georgia" }).indexOf("family=Georgia") < 0, "system fonts are not requested from Google Fonts");
  eq(I.renderFonts({ ar: "Amiri", en: "Lato", head: "Georgia" }).indexOf("family=Lato:wght@400;700&family=Amiri:wght@400;700&display=swap") > 0, true, "weights follow each family");
  eq(L.validate(Object.assign({}, m, { fonts: { ar: "Cairo", en: "Poppins", head: "Papyrus" } })).length, 1, "an unknown heading font is rejected");
  eq(L.validate(Object.assign({}, m, { fonts: { ar: "Cairo", en: "Poppins" } })), [], "a draft without a heading font is still valid");
  L.FONTS.ar.concat(L.FONTS.en).forEach((f) => {
    const kind = L.FONTS.ar.indexOf(f) >= 0 ? "ar" : "en";
    const block = I.renderFonts(kind === "ar" ? { ar: f.name, en: "Manrope", head: "Georgia" } : { ar: "Cairo", en: f.name, head: "Georgia" });
    ok(block.indexOf("family=" + f.name.replace(/ /g, "+") + ":wght@" + f.weights.join(";")) > 0, "link for " + f.name);
  });
}

section("v2: colours");
{
  eq(L.contrast("#000000", "#ffffff"), 21, "contrast black on white");
  eq(L.contrast("#fff", "#FFFFFF"), 1, "contrast of equal colours, short and long hex");
  ok(Math.abs(L.contrast("#777777", "#ffffff") - 4.48) < 0.01, "contrast of #777 on white");
  ok(isNaN(L.contrast("red", "#fff")), "contrast of an invalid colour is NaN");
  eq(model.theme, { palette: "default", light: { bg: "#f6f3ec", surface: "#fffdf8", text: "#22303b", accent: "#7a5a12", link: "#2c6aa6" },
    dark: { bg: "#111a24", surface: "#18232f", text: "#dfe5ea", accent: "#d8b45b", link: "#68a9ff" } }, "default theme read from the empty block");
  ["index.html", "publications.html"].forEach((page) => ok(I.renderTheme(I.parseTheme(files[page])) === inner(files[page], "dash:theme"), "theme block reproduced (" + page + ")"));
  L.PALETTES.forEach((p) => {
    eq(L.themeWarnings({ palette: p.id }), [], "palette " + p.id + " has no contrast warning");
    ["light", "dark"].forEach((mode) => ok(L.contrast(p[mode].text, p[mode].bg) >= 7 && L.contrast(p[mode].accent, p[mode].bg) >= 4.5 && L.contrast(p[mode].link, p[mode].bg) >= 4.5 && L.contrast(p[mode].muted, p[mode].bg) >= 4.5, "palette " + p.id + " is readable in " + mode + " mode"));
  });
  // a preset palette
  const m = copy(model);
  m.theme = { palette: "sage" };
  const out = L.build(files, m, { today: TODAY });
  eq(changed(out), BOTH_PAGES, "a palette changes both pages");
  eq(out.warnings, [], "no warnings");
  ok(out.summary.length === 1 && out.summary[0].indexOf("أخضر زيتي") > 0, "summary names the palette");
  const block = inner(out.files["index.html"], "dash:theme");
  eq(inner(out.files["publications.html"], "dash:theme"), block, "the same block text on both pages");
  const sage = L.PALETTES[1];
  ok(block.indexOf('\n    <style>/*dash-theme:{"palette":"sage"}*/html:root[data-theme="light"]{--bg:' + sage.light.bg + ";--surface:" + sage.light.surface + ";--surface2:" + sage.light.surface2 + ";--surface-2:" + sage.light.surface2 + ";--text:" + sage.light.text) === 0, "light rule starts the block, with both surface names");
  ok(block.indexOf("--gold:" + sage.light.accent + ";--accent:" + sage.light.accent + ";--accent-strong:" + sage.light.accent + ";--amber:" + sage.light.accent + ";--accent-text:#ffffff;--blue:" + sage.light.link + ";--green:" + sage.light.green + ";}") > 0, "accent under every name the two pages use");
  ok(block.indexOf('html:root[data-theme="dark"]{--bg:' + sage.dark.bg) > 0 && block.indexOf("--accent-text:#10151a;") > 0, "dark rule with dark text on the accent");
  ok(/<\/style>\n    $/.test(block) && (block.match(/<style>/g) || []).length === 1, "one <style> element");
  eq(out.files["index.html"].replace(block, ""), files["index.html"].replace(inner(files["index.html"], "dash:theme"), ""), "nothing else changed in index.html");
  eq(out.files["publications.html"].replace(block, ""), files["publications.html"].replace(inner(files["publications.html"], "dash:theme"), ""), "nothing else changed in publications.html");
  ok(out.files["ar/index.html"].indexOf(block) > 0 && out.files["ar/publications.html"].indexOf(block) > 0, "Arabic pages carry the block");
  const back = L.read(overlay(files, out));
  eq(back.theme, { palette: "sage", light: { bg: sage.light.bg, surface: sage.light.surface, text: sage.light.text, accent: sage.light.accent, link: sage.light.link },
    dark: { bg: sage.dark.bg, surface: sage.dark.surface, text: sage.dark.text, accent: sage.dark.accent, link: sage.dark.link } }, "palette reads back with its five main colours");
  eq(changed(L.build(overlay(files, out), back, { today: TODAY })), [], "stable after reading back");
  const reset = L.build(overlay(files, out), Object.assign(copy(back), { theme: { palette: "default" } }), { today: TODAY });
  ok(reset.files["index.html"] === files["index.html"] && reset.files["publications.html"] === files["publications.html"], "back to the default palette restores the pages byte for byte");
  // custom colours, light only
  const c1 = copy(model);
  c1.theme = { palette: "custom", light: { bg: "#FFFFFF", surface: "#fff", text: "#222", accent: "#0A5C36", link: "#0b57d0" } };
  const outC = L.build(files, c1, { today: TODAY });
  const blockC = inner(outC.files["index.html"], "dash:theme");
  ok(blockC.indexOf('/*dash-theme:{"palette":"custom","light":{"bg":"#ffffff","surface":"#ffffff","text":"#222222","accent":"#0a5c36","link":"#0b57d0"}}*/') > 0, "custom colours are normalised and recorded");
  ok(blockC.indexOf('html:root[data-theme="light"]{--bg:#ffffff;--surface:#ffffff;--surface2:') > 0 && blockC.indexOf("--line:rgba(34, 34, 34, 0.13);") > 0 && /--muted:#[0-9a-f]{6};/.test(blockC), "the remaining variables are derived");
  ok(blockC.indexOf('data-theme="dark"') < 0, "no dark rule when no dark colours are given");
  eq(outC.warnings, [], "readable custom colours give no warning");
  ok(outC.summary[0].indexOf("ألوان خاصة") > 0, "summary says custom colours");
  const backC = L.read(overlay(files, outC));
  eq(backC.theme, { palette: "custom", light: { bg: "#ffffff", surface: "#ffffff", text: "#222222", accent: "#0a5c36", link: "#0b57d0" }, dark: model.theme.dark }, "custom theme reads back (dark = the site's own)");
  eq(changed(L.build(overlay(files, outC), backC, { today: TODAY })), [], "custom theme is stable after reading back");
  // custom colours for both modes
  const c2 = copy(model);
  c2.theme = { palette: "custom", light: c1.theme.light, dark: { bg: "#101010", surface: "#1a1a1a", text: "#eeeeee", accent: "#ffd166", link: "#8ecae6" } };
  const outD = L.build(files, c2, { today: TODAY });
  const blockD = inner(outD.files["publications.html"], "dash:theme");
  ok(blockD.indexOf('html:root[data-theme="dark"]{--bg:#101010;--surface:#1a1a1a;') > 0 && blockD.indexOf("--accent:#ffd166;") > 0 && blockD.indexOf("--line:rgba(238, 238, 238, 0.1);") > 0, "dark rule from the owner's dark colours");
  eq(L.read(overlay(files, outD)).theme.dark, c2.theme.dark, "dark colours read back");
  eq(changed(L.build(overlay(files, outD), L.read(overlay(files, outD)), { today: TODAY })), [], "stable after reading back (both modes)");
  // low contrast
  const c3 = copy(model);
  c3.theme = { palette: "custom", light: { bg: "#ffffff", surface: "#ffffff", text: "#9a9a9a", accent: "#f2c94c", link: "#0b57d0" } };
  const outL = L.build(files, c3, { today: TODAY });
  eq(outL.warnings.length, 3, "three contrast warnings: text, accent, button text");
  ok(outL.warnings.every((w) => w.indexOf("4.5") > 0 && w.indexOf("الوضع الفاتح") > 0), "warnings name the mode and the 4.5 threshold");
  eq(L.themeWarnings(c3.theme), outL.warnings, "themeWarnings gives the same list for a live preview");
  eq(changed(outL), BOTH_PAGES, "low contrast warns but still builds");
  // validation
  eq(L.validate(Object.assign(copy(model), { theme: { palette: "custom", light: { bg: "white", text: "#12" } } })).length, 2, "invalid colours are rejected");
  eq(L.validate(Object.assign(copy(model), { theme: { palette: "neon" } })).length, 1, "an unknown palette is rejected");
  eq(L.validate(Object.assign(copy(model), { theme: { palette: "custom", light: { bg: "#abc" }, dark: {} } })), [], "partial custom colours are valid");
  // a missing block is reported, never thrown
  const noBlock = Object.assign({}, files, { "publications.html": files["publications.html"].replace("<!-- dash:theme -->", "<!-- x -->") });
  const outN = L.build(noBlock, m, { today: TODAY });
  ok(outN.warnings.some((w) => w.indexOf("dash:theme") > 0 && w.indexOf("publications.html") > 0) && outN.files["index.html"] && !outN.files["publications.html"], "missing theme marker: warning, other page still updated");
}

section("v2: sections and navigation");
{
  const idx = files["index.html"];
  eq(model.sections.map((s) => s.id), ["leadership", "research", "teaching", "experience", "contact"], "sections in page order");
  ok(model.sections.every((s) => s.hidden === false && s.custom === false && s.title.en && s.title.ar), "built-in sections: shown, not custom, titled");
  eq(model.sections[3].title, { en: "Career", ar: "المسيرة" }, "a section's title is its navigation label");
  eq(model.nav.map((n) => n.href), ["#leadership", "#research", "publications.html", "#teaching", "#experience", "#contact"], "nav links");
  ok(I.renderNav(model.nav) === inner(idx, "dash:nav"), "nav block reproduced");
  ok(I.renderNav(I.composeNav(model.sections, model.nav, model.sections)) === inner(idx, "dash:nav"), "nav composed from the sections equals the block");
  const texts0 = model.texts.length;

  // hide
  const m = copy(model);
  m.sections[2].hidden = true; // teaching
  const out = L.build(files, m, { today: TODAY });
  eq(changed(out), BOTH_PAGES, "hiding a section changes the home page and the catalogue header");
  eq(out.warnings, [], "no warnings");
  const h = out.files["index.html"];
  ok(h.indexOf('<!-- dash:section teaching -->\n<section id="teaching" hidden>\n') > 0, "the section carries the hidden attribute");
  ok(inner(h, "dash:nav").indexOf('<a data-ar="التدريس" href="#teaching" hidden>Teaching</a>') > 0, "its link is hidden too");
  eq(h.replace('<section id="teaching" hidden>', '<section id="teaching">').replace('href="#teaching" hidden>', 'href="#teaching">'), idx, "nothing else changed: the section's markup is all there");
  ok(out.files["ar/index.html"].indexOf('<section id="teaching" hidden>') > 0 && out.files["ar/index.html"].indexOf('<a href="#teaching" hidden>التدريس</a>') > 0, "Arabic page hides both");
  ok(out.summary.some((s) => s.indexOf("أُخفي قسم") === 0 && s.indexOf("التدريس") > 0), "summary: section hidden");
  const backH = L.read(overlay(files, out));
  eq(backH.sections[2], { id: "teaching", title: { en: "Teaching", ar: "التدريس" }, hidden: true, custom: false }, "hidden section reads back");
  eq(backH.nav[3].hidden, false, "the link is not marked hidden on its own account");
  eq(backH.texts.length, texts0, "texts of a hidden section stay editable");
  eq(changed(L.build(overlay(files, out), backH, { today: TODAY })), [], "stable after reading back");
  const shown = copy(backH);
  shown.sections[2].hidden = false;
  const outS = L.build(overlay(files, out), shown, { today: TODAY });
  ok(outS.files["index.html"] === idx, "showing it again restores the page byte for byte");
  ok(outS.summary.some((s) => s.indexOf("أُظهر قسم") === 0), "summary: section shown");
  // a hidden section that the page still links to
  const mL = copy(model);
  mL.sections[0].hidden = true;
  const outLd = L.build(files, mL, { today: TODAY });
  ok(outLd.warnings.length === 1 && outLd.warnings[0].indexOf("القيادة") > 0, "warning: a button still points to the hidden section");

  // reorder
  const r = copy(model);
  r.sections = [r.sections[3], r.sections[1], r.sections[2], r.sections[4], r.sections[0]]; // experience, research, teaching, contact, leadership
  const outR = L.build(files, r, { today: TODAY });
  eq(changed(outR), BOTH_PAGES, "reordering changes the home page and the catalogue header");
  const ri = outR.files["index.html"];
  eq(I.sectionUnits(ri).map((u) => u.id), ["experience", "research", "teaching", "contact", "leadership"], "sections in the new order");
  const unitsBefore = {}, unitsAfter = {};
  I.sectionUnits(idx).forEach((u) => { unitsBefore[u.id] = u.text; });
  I.sectionUnits(ri).forEach((u) => { unitsAfter[u.id] = u.text; });
  ok(Object.keys(unitsBefore).length === 5 && Object.keys(unitsBefore).every((id) => unitsAfter[id] === unitsBefore[id]), "every section's markup is unchanged");
  eq(ri.length, idx.length, "the page has the same length");
  ok(ri.indexOf("</section><!-- dash:section experience -->\n<section id=\"experience\">") > 0 && ri.indexOf("<!-- /dash:section leadership -->\n</main>") > 0, "the block of sections sits where it was");
  eq(I.parseNavLines(I.blockLines(ri, "dash:nav")).map((n) => n.href), ["#experience", "#research", "publications.html", "#teaching", "#contact", "#leadership"], "nav follows the sections; Publications keeps its slot");
  ok(outR.summary.some((s) => s.indexOf("ترتيب الأقسام") > 0), "summary: order changed");
  const backR = L.read(overlay(files, outR));
  eq(backR.sections.map((s) => s.id), ["experience", "research", "teaching", "contact", "leadership"], "order reads back");
  eq(changed(L.build(overlay(files, outR), backR, { today: TODAY })), [], "stable after reading back");
  const restore = copy(backR);
  restore.sections = ["leadership", "research", "teaching", "experience", "contact"].map((id) => restore.sections.filter((s) => s.id === id)[0]);
  ok(L.build(overlay(files, outR), restore, { today: TODAY }).files["index.html"] === idx, "the original order restores the page byte for byte");
  const py = pythonArabic(ri, files["publications.html"]);
  if (py) ok(py.index === outR.files["ar/index.html"], "python builds the same Arabic page for the reordered site");

  // nav only
  const n = copy(model);
  n.nav[2].hidden = true;           // hide Publications
  n.nav[0].en = "Lead"; n.nav[0].ar = "قيادة";
  const outN = L.build(files, n, { today: TODAY });
  const navN = I.blockLines(outN.files["index.html"], "dash:nav");
  eq(navN[0], '<a data-ar="قيادة" href="#leadership">Lead</a>', "nav text edited");
  eq(navN[2], '<a data-ar="المنشورات" href="publications.html" hidden>Publications</a>', "a link hidden on its own");
  eq(I.sectionUnits(outN.files["index.html"]).map((u) => u.text).join(""), I.sectionUnits(idx).map((u) => u.text).join(""), "sections untouched");
  const backN = L.read(overlay(files, outN));
  ok(backN.nav[2].hidden === true && backN.sections[0].title.en === "Lead" && backN.sections[0].title.ar === "قيادة", "nav edits read back");
  eq(out.summary.length >= 1 && outN.summary, ["حُدّثت روابط التنقل."], "summary: navigation updated");
  // retitle a built-in section through its title
  const t = copy(model);
  t.sections[1].title = { en: "Studies", ar: "دراسات" };
  eq(I.blockLines(L.build(files, t, { today: TODAY }).files["index.html"], "dash:nav")[1], '<a data-ar="دراسات" href="#research">Studies</a>', "a section title edits its link");
  // a model that forgets a built-in section, or names an unknown one
  const f = copy(model);
  f.sections = f.sections.filter((s) => s.id !== "research").concat([{ id: "ghost", hidden: false }]);
  const outF = L.build(files, f, { today: TODAY });
  eq(I.sectionUnits(outF.files["index.html"]).map((u) => u.id), ["leadership", "teaching", "experience", "contact", "research"], "a built-in section missing from the model is kept (at the end)");
  ok(outF.files["index.html"].indexOf('<section id="research">') > 0 && outF.warnings.some((w) => w.indexOf("ghost") > 0), "nothing deleted; unknown id reported");
}

section("v2: the catalogue page's own navigation (optional dash:nav block)");
{
  const marked = files;
  ok(!!I.findBlock(files["publications.html"], "dash:nav"), "publications.html has its dash:nav block");
  // the same page without the block (as it was before): its header links are left alone
  const navLine = /(<nav aria-label="Primary navigation"[^>]*>)([\s\S]*?)(<\/nav>)/.exec(files["publications.html"]);
  const links = navLine[2].match(/<a [^>]*>[^<]*<\/a>/g);
  eq(links.length, 6, "(six links in its header)");
  const plain = Object.assign({}, files, { "publications.html": files["publications.html"].replace(navLine[0], navLine[1] + links.join("") + navLine[3]) });
  const mp = copy(L.read(plain));
  mp.sections[2].hidden = true;
  eq(changed(L.build(plain, mp, { today: TODAY })), HOME_ONLY, "without the block the catalogue page is not touched");
  eq(changed(L.build(marked, L.read(marked), { today: TODAY })), [], "with the block: an unchanged model changes nothing");
  const m2 = copy(L.read(marked));
  m2.sections[2].hidden = true;
  m2.sections.splice(1, 0, { custom: true, title: { en: "Awards", ar: "الجوائز" }, cards: [] });
  const out = L.build(marked, m2, { today: TODAY });
  eq(changed(out), BOTH_PAGES, "with the block: both pages follow");
  eq(I.blockLines(out.files["publications.html"], "dash:nav"), [
    '<a data-ar="القيادة" href="index.html#leadership">Leadership</a>',
    '<a data-ar="الجوائز" href="index.html#custom-1">Awards</a>',
    '<a aria-current="page" class="active" data-ar="المنشورات" href="publications.html">Publications</a>',
    '<a data-ar="البحث" href="index.html#research">Research</a>',
    '<a data-ar="التدريس" href="index.html#teaching" hidden>Teaching</a>',
    '<a data-ar="المسيرة" href="index.html#experience">Career</a>',
    '<a data-ar="تواصل" href="index.html#contact">Contact</a>',
  ], "catalogue links: index.html#id, the active link keeps its attributes");
  ok(out.files["ar/publications.html"].indexOf('<a href="index.html#custom-1">الجوائز</a>') > 0, "Arabic catalogue page follows");
  const site = overlay(marked, out);
  eq(changed(L.build(site, L.read(site), { today: TODAY })), [], "stable after reading back");
}

section("v2: custom sections");
{
  const idx = files["index.html"];
  const custom = {
    custom: true, hidden: false,
    title: { en: 'Awards & "Honours"', ar: "الجوائز" }, kicker: { en: "Recognition", ar: "تقدير" }, intro: { en: "Selected <awards>.", ar: "جوائز مختارة." },
    cards: [
      { title: { en: "Best Paper", ar: "أفضل ورقة" }, text: { en: "DASA 2025", ar: "" }, link: "https://example.org/a?b=1&c=2" },
      { title: { en: "Certificate", ar: "" }, text: { en: "", ar: "" }, link: "files/cert.pdf" },
      { title: { en: "Plain card", ar: "بطاقة" }, text: { en: "No link here", ar: "بلا رابط" }, link: "" },
    ],
  };
  const m = copy(model);
  m.sections.splice(2, 0, copy(custom)); // after research
  eq(L.validate(m), [], "valid model");
  const out = L.build(files, m, { today: TODAY });
  eq(changed(out), BOTH_PAGES, "a custom section changes the home page and the catalogue header");
  eq(out.warnings, [], "no warnings");
  const h = out.files["index.html"];
  const expected = [
    "<!-- dash:section custom-1 -->",
    '<section id="custom-1" class="custom-section">',
    '<div class="wrap">',
    '<div class="section-head"><div><span class="kicker" data-ar="تقدير">Recognition</span><h2 data-ar="الجوائز">Awards &amp; "Honours"</h2></div>',
    '<p data-ar="جوائز مختارة.">Selected &lt;awards&gt;.</p></div>',
    '<div class="grid3">',
    '<article class="card"><h3 data-ar="أفضل ورقة">Best Paper</h3><p>DASA 2025</p><a class="featured-link" data-ar="المزيد ↗" href="https://example.org/a?b=1&amp;c=2" target="_blank" rel="noopener">More ↗</a></article>',
    '<article class="card"><h3>Certificate</h3><a class="featured-link" data-ar="المزيد ↗" href="files/cert.pdf">More ↗</a></article>',
    '<article class="card"><h3 data-ar="بطاقة">Plain card</h3><p data-ar="بلا رابط">No link here</p></article>',
    "</div>", "</div>", "</section>", "<!-- /dash:section custom-1 -->",
  ].join("\n");
  eq(I.sectionUnits(h).map((u) => u.id), ["leadership", "research", "custom-1", "teaching", "experience", "contact"], "placed after research with the id custom-1");
  eq(I.sectionUnits(h)[2].text, expected, "custom section markup");
  ok(h.indexOf("<!-- /dash:section research -->\n<!-- dash:section custom-1 -->") > 0 && h.indexOf("<!-- /dash:section custom-1 -->\n<!-- dash:section teaching -->") > 0, "one line break between sections");
  eq(I.blockLines(h, "dash:nav")[3], '<a data-ar="الجوائز" href="#custom-1">Awards &amp; "Honours"</a>', "nav link added after Publications");
  eq(I.parseNavLines(I.blockLines(h, "dash:nav")).map((n) => n.href), ["#leadership", "#research", "publications.html", "#custom-1", "#teaching", "#experience", "#contact"], "nav order");
  const ar = out.files["ar/index.html"];
  ok(ar.indexOf('<h2>الجوائز</h2>') > 0 && ar.indexOf('<p>جوائز مختارة.</p>') > 0 && ar.indexOf('href="../files/cert.pdf">المزيد ↗</a>') > 0 && ar.indexOf('<a href="#custom-1">الجوائز</a>') > 0, "Arabic page: Arabic texts, relative link one folder up");
  ok(ar === L.buildArabic("index.html", h), "Arabic page rebuilt from the new page");
  const py = pythonArabic(h, files["publications.html"]);
  if (py) ok(py.index === ar, "python builds the same Arabic page");
  ok(out.summary.some((s) => s.indexOf("أُضيف قسم جديد") === 0 && s.indexOf("الجوائز") > 0), "summary: new section");
  const back = L.read(overlay(files, out));
  eq(back.sections[2], Object.assign({ id: "custom-1" }, { title: custom.title, hidden: false, custom: true, kicker: custom.kicker, intro: custom.intro, cards: custom.cards }), "custom section reads back");
  eq(back.nav[3], { href: "#custom-1", en: 'Awards & "Honours"', ar: "الجوائز", hidden: false }, "its nav link reads back");
  eq(back.texts.length, model.texts.length, "texts of a custom section are not listed as free texts");
  eq(back.warnings, [], "no read warnings");
  eq(changed(L.build(overlay(files, out), back, { today: TODAY })), [], "stable after reading back");
  // edit, hide, second section, delete
  const site1 = overlay(files, out);
  const e = copy(back);
  e.sections[2].cards[0].text.en = "DASA 2025, Bahrain";
  e.sections[2].hidden = true;
  e.sections.push({ custom: true, title: { en: "Projects", ar: "" }, cards: [] });
  const outE = L.build(site1, e, { today: TODAY });
  const he = outE.files["index.html"];
  ok(he.indexOf('<section id="custom-1" class="custom-section" hidden>') > 0 && he.indexOf("<p>DASA 2025, Bahrain</p>") > 0, "edited and hidden");
  ok(he.indexOf('<a data-ar="الجوائز" href="#custom-1" hidden>') > 0, "hidden custom section hides its link");
  eq(I.sectionUnits(he).map((u) => u.id).slice(-2), ["contact", "custom-2"], "the second custom section gets custom-2");
  ok(I.sectionUnits(he)[6].text.indexOf('<div class="section-head"><div><h2>Projects</h2></div></div>\n<div class="grid3">\n</div>') > 0, "a section with only a title");
  ok(outE.summary.some((s) => s.indexOf("عُدّل القسم") === 0) && outE.summary.some((s) => s.indexOf("أُخفي قسم") === 0) && outE.summary.some((s) => s.indexOf("أُضيف قسم جديد") === 0), "summary: edited, hidden, added");
  const backE = L.read(overlay(site1, outE));
  ok(backE.sections[2].hidden === true && backE.sections[2].cards[0].text.en === "DASA 2025, Bahrain" && backE.sections[6].id === "custom-2" && backE.sections[6].title.en === "Projects" && backE.sections[6].cards.length === 0, "reads back");
  eq(L.nextSectionId(backE.sections), "custom-3", "nextSectionId");
  eq(changed(L.build(overlay(site1, outE), backE, { today: TODAY })), [], "stable after reading back");
  const d = copy(backE);
  d.sections = d.sections.filter((s) => !s.custom);
  const outD = L.build(overlay(site1, outE), d, { today: TODAY });
  ok(outD.files["index.html"] === idx, "deleting the custom sections restores the page byte for byte");
  eq(outD.summary.filter((s) => s.indexOf("حُذف القسم") === 0).length, 2, "summary: two sections deleted");
  // links are checked
  const bad = copy(model);
  bad.sections.push({ custom: true, title: { en: "X", ar: "" }, cards: [{ title: { en: "Y", ar: "" }, text: { en: "", ar: "" }, link: "javascript:alert(1)" }, { title: { en: "", ar: "" }, link: "a b" }] });
  eq(L.validate(bad).length, 3, "validate: script link, missing card title, link with a space");
  ok(L.build(files, bad, { today: TODAY }).files["index.html"].indexOf("javascript:") < 0, "a script link is never written");
  eq(L.validate(Object.assign(copy(model), { sections: model.sections.concat([{ custom: true, title: { en: "", ar: "عنوان" }, cards: [] }]) })).length, 1, "validate: a custom section needs an English title");
  // a custom section someone edited by hand is kept as it is
  const hand = Object.assign({}, site1, { "index.html": h.replace('<div class="grid3">\n<article class="card"><h3 data-ar="أفضل ورقة">', '<div class="grid3">\n<p>hand-written</p>\n<article class="card"><h3 data-ar="أفضل ورقة">') });
  const backHand = L.read(hand);
  ok(backHand.sections[2].id === "custom-1" && backHand.sections[2].custom === false && backHand.warnings.length === 1, "hand-edited custom section: read as a plain section, with a warning");
  eq(changed(L.build(hand, backHand, { today: TODAY })), [], "and left untouched");
}

section("v2: lists (courses and career)");
{
  const idx = files["index.html"];
  I.LISTS.forEach((list) => ok(list.render(model[list.key], I.blockLines(idx, list.block)) === inner(idx, list.block), list.key + " block reproduced"));
  eq([model.flagship.length, model.courses.length, model.timeline.length, model.timelineEarlier.length], [4, 8, 5, 3], "items read");
  eq(model.flagship[0], { code: "IS453", en: "Technology Trends in Digital Transformation", ar: "اتجاهات التقنية في التحول الرقمي" }, "flagship course");
  eq(model.timeline[0].time, "2026 — Present", "the 'Present' span reads as plain text");
  eq(model.timeline[2].time, "2014 — 2024", "a closed period");
  ok(model.timeline[0].title.en.indexOf("Chair, Information Systems Department") === 0 && model.timeline[0].title.ar && model.timeline[0].text.en && model.timeline[0].text.ar, "timeline item texts");
  const m = copy(model);
  m.courses.push({ code: "IS555", en: "AI & Society", ar: "الذكاء والمجتمع" });
  m.flagship.unshift({ code: "IS555", en: "AI & Society", ar: "" });
  m.flagship.pop();
  m.timeline.unshift({ time: "2027 — Present", title: { en: "Dean <CCIS>", ar: "عميد الكلية" }, text: { en: 'Leads "CCIS".', ar: "يقود الكلية." } });
  m.timelineEarlier.push({ time: "2005", title: { en: "Intern", ar: "" }, text: { en: "", ar: "" } });
  eq(L.validate(m), [], "valid model");
  const out = L.build(files, m, { today: TODAY });
  eq(changed(out), HOME_ONLY, "lists change only the home page");
  eq(out.warnings, [], "no warnings");
  eq(out.summary.length, 4, "one summary line per list");
  const h = out.files["index.html"];
  eq(I.blockLines(h, "dash:courses").slice(-1)[0], '<article class="course-item"><span class="course-code">IS555</span><strong data-ar="الذكاء والمجتمع">AI &amp; Society</strong></article>', "course line");
  eq(I.blockLines(h, "dash:courses-flagship")[0], '<article class="flagship-course"><span>IS555</span><strong>AI &amp; Society</strong></article>', "flagship line without Arabic");
  eq(I.blockLines(h, "dash:courses-flagship").length, 4, "flagship count");
  eq(I.blockLines(h, "dash:timeline")[0], '<article class="role"><time>2027 — <span data-ar="حتى الآن">Present</span></time><div><h3 data-ar="عميد الكلية">Dean &lt;CCIS&gt;</h3><p data-ar="يقود الكلية.">Leads "CCIS".</p></div></article>', "timeline line with the Present span");
  eq(I.blockLines(h, "dash:timeline-earlier").slice(-1)[0], '<article class="role"><time>2005</time><div><h3>Intern</h3><p></p></div></article>', "earlier role with a plain year");
  ok(out.files["ar/index.html"].indexOf("<time>2027 — <span>حتى الآن</span></time><div><h3>عميد الكلية</h3><p>يقود الكلية.</p>") > 0, "Arabic page shows the Arabic texts");
  const back = L.read(overlay(files, out));
  eq([back.courses, back.flagship, back.timeline, back.timelineEarlier], [m.courses, m.flagship, m.timeline, m.timelineEarlier], "lists read back");
  eq(back.warnings, [], "no read warnings");
  eq(changed(L.build(overlay(files, out), back, { today: TODAY })), [], "stable after reading back");
  // only the four blocks moved
  let rest = h, base = idx;
  I.LISTS.forEach((list) => { rest = rest.replace(inner(h, list.block), ""); base = base.replace(inner(idx, list.block), ""); });
  eq(rest, base, "nothing else changed in index.html");
  const bad = copy(model);
  bad.courses.push({ code: "", en: "", ar: "" });
  bad.timeline.push({ time: "", title: { en: "", ar: "" }, text: { en: "", ar: "" } });
  bad.timelineEarlier.push({ time: "<b>", title: { en: "T", ar: "" } });
  eq(L.validate(bad).length, 5, "validate: code, name, period, title, forbidden character");
  const broken = Object.assign({}, files, { "index.html": idx.replace('<article class="course-item"><span class="course-code">IS101</span>', '<article class="course-item odd"><span class="course-code">IS101</span>') });
  eq(L.read(broken).warnings.length, 1, "an unreadable line is reported on read");
  eq(L.read(broken).courses.length, 7, "and skipped");
}

section("v2: portrait version");
{
  const idx = files["index.html"];
  eq(model.photoVersion, "", "no version yet");
  const m = copy(model);
  m.photoVersion = "202701051230";
  const out = L.build(files, m, { today: TODAY });
  eq(changed(out), HOME_ONLY, "changed files");
  const h = out.files["index.html"];
  ok(h.indexOf('<link rel="preload" href="PhotoDrOmaia.webp?v=202701051230" as="image" type="image/webp" fetchpriority="high" >') > 0, "preload link carries the version");
  ok(h.indexOf('id="portraitImage" src="PhotoDrOmaia.webp?v=202701051230" width="1127"/>') > 0, "portrait image carries the version");
  ok(h.indexOf('"image": "https://dromaia.github.io/PhotoDrOmaia.webp",') > 0, "the JSON-LD image address is left alone");
  eq(h.split("PhotoDrOmaia.webp?v=202701051230").join("PhotoDrOmaia.webp"), idx, "nothing else changed");
  ok(out.files["ar/index.html"].split('"../PhotoDrOmaia.webp?v=202701051230"').length === 3, "Arabic page: both addresses one folder up, with the version");
  eq(out.summary, ["تغيّرت الصورة الشخصية."], "summary");
  const back = L.read(overlay(files, out));
  eq(back.photoVersion, "202701051230", "version reads back");
  eq(changed(L.build(overlay(files, out), back, { today: TODAY })), [], "stable after reading back");
  const again = L.build(overlay(files, out), Object.assign(copy(back), { photoVersion: "202702020800" }), { today: TODAY });
  ok(again.files["index.html"].split("PhotoDrOmaia.webp?v=202702020800").length === 3 && again.files["index.html"].indexOf("202701051230") < 0, "a new upload replaces the version");
  ok(L.build(overlay(files, out), Object.assign(copy(back), { photoVersion: "" }), { today: TODAY }).files["index.html"] === idx, "an empty version restores the page");
  eq(L.validate(Object.assign(copy(model), { photoVersion: "2027-01?x" })).length, 1, "validate: version characters");
}

section("v2: citations");
{
  const pubs = files["publications.html"];
  const metrics0 = JSON.parse(files["data/metrics.json"]);
  const withDoi = model.works.filter((w) => /doi\.org\/10\./.test(w.doi || ""));
  eq(Object.keys(model.citations).length, withDoi.length, "one number per work that has a DOI");
  ok(Object.keys(model.citations).every((k) => k === k.toLowerCase() && /^10\./.test(k)), "keys are bare lower-case DOIs");
  eq(model.citations["10.62754/joe.v3i8.5781"], 23, "number from data/metrics.json");
  eq(model.citations["10.3390/computers15110825"], 0, "a work without a metrics row reads as 0");
  ok(!metrics0.per_work.some((r) => r.id === "P40"), "(P40 has no metrics row yet)");
  const m = copy(model);
  m.citations["10.62754/joe.v3i8.5781"] = 30;          // existing row
  m.citations["10.3390/computers15110825"] = 2;        // no row yet
  m.citations["10.1038/s41598-026-74375-w"] = 0;       // no row, still 0: nothing to do
  m.citations["https://doi.org/10.1142/S1756973726400214"] = 1; // a full address in another letter case
  const out = L.build(files, m, { today: TODAY });
  eq(changed(out), ["ar/publications.html", "data/metrics.json", "publications.html"], "changed files");
  eq(out.warnings, [], "no warnings");
  eq(out.summary, ["حُدّثت أعداد الاستشهادات لـ 3 بحثاً."], "summary");
  const before = cardsOf(pubs), after = cardsOf(out.files["publications.html"]);
  eq(after.order, before.order, "same cards, same order");
  ok(after.map.P25.indexOf('<span class="pub-cites" data-doi="10.62754/joe.v3i8.5781" data-ar="30 استشهاداً · Crossref">Cited by 30 · Crossref</span>') > 0, "P25 card (kept verbatim otherwise) shows 30");
  eq(after.map.P25.replace('data-ar="30 استشهاداً · Crossref">Cited by 30 ·', 'data-ar="23 استشهاداً · Crossref">Cited by 23 ·'), before.map.P25, "only the number moved on P25");
  ok(after.map.P40.indexOf('<span class="pub-cites" data-doi="10.3390/computers15110825" data-ar="استشهادان · Crossref">Cited by 2 · Crossref</span>') > 0, "P40 card shows 2 (Arabic dual)");
  ok(after.map.P37.indexOf('data-ar="استشهاد واحد · Crossref">Cited by 1 · Crossref</span>') > 0, "P37 card shows 1 (Arabic singular)");
  eq(after.order.filter((id) => after.map[id] !== before.map[id]), ["P40", "P37", "P25"], "no other card changed");
  ok(out.files["ar/publications.html"] === L.buildArabic("publications.html", out.files["publications.html"]) && out.files["ar/publications.html"].indexOf("30 استشهاداً · Crossref</span>") > 0, "Arabic page shows the Arabic form");
  const metrics1 = JSON.parse(out.files["data/metrics.json"]);
  eq(metrics1.per_work.filter((r) => r.id === "P25")[0].crossref, 30, "metrics.json: existing row updated");
  eq(metrics1.per_work.filter((r) => r.id === "P40")[0], { id: "P40", title: model.works.filter((w) => w.id === "P40")[0].title, year: 2026, doi: "10.3390/computers15110825", crossref: 2, openalex: null, date: null, venue: null }, "metrics.json: new row in the tool's shape");
  eq(metrics1.per_work.length, metrics0.per_work.length + 1, "one row added (nothing for the work that stays at 0)");
  eq(metrics1.crossref, { cited_by_total: metrics0.crossref.cited_by_total + 7 + 2 + 1, h_index: metrics1.crossref.h_index, matched: metrics0.crossref.matched + 1 }, "Crossref totals recomputed");
  ok(metrics1.crossref.h_index >= metrics0.crossref.h_index, "h-index recomputed");
  eq(metrics1.checked, TODAY + "T00:00:00Z", "checked date");
  eq([metrics1.latest, metrics1.works_verified, metrics1.openalex, metrics1.orcid_new], [metrics0.latest, metrics0.works_verified, metrics0.openalex, metrics0.orcid_new], "the rest of metrics.json is untouched");
  ok(/\n$/.test(out.files["data/metrics.json"]) && out.files["data/metrics.json"] === JSON.stringify(metrics1, null, 1) + "\n", "metrics.json keeps its formatting");
  const back = L.read(overlay(files, out));
  eq([back.citations["10.62754/joe.v3i8.5781"], back.citations["10.3390/computers15110825"], back.citations["10.1142/s1756973726400214"]], [30, 2, 1], "numbers read back");
  eq(changed(L.build(overlay(files, out), back, { today: TODAY })), [], "stable after reading back");
  // thousands separator, and a works change in the same build
  const big = copy(model);
  big.citations["10.62754/joe.v3i8.5781"] = 1234;
  big.works = big.works.concat([NEW_WORK]);
  const outB = L.build(files, big, { today: TODAY });
  const cardsB = cardsOf(outB.files["publications.html"]);
  ok(cardsB.map.P25.indexOf('data-ar="1234 استشهاداً · Crossref">Cited by 1,234 · Crossref</span>') > 0, "thousands separator, in a build that also adds a work");
  ok(cardsB.map.P41 && cardsB.map.P25.replace('data-ar="1234 استشهاداً · Crossref">Cited by 1,234 ·', 'data-ar="23 استشهاداً · Crossref">Cited by 23 ·') === before.map.P25, "the kept card is otherwise verbatim");
  // bad values and unknown works are ignored
  const odd = copy(model);
  odd.citations["10.62754/joe.v3i8.5781"] = "many";
  odd.citations["10.9999/not-in-the-catalogue"] = 5;
  eq(L.validate(odd).length, 1, "validate: a number is required");
  eq(changed(L.build(files, odd, { today: TODAY })), [], "bad values and unknown DOIs change nothing");
  // without metrics.json the numbers cannot be saved
  const noMetrics = Object.assign({}, files); delete noMetrics["data/metrics.json"];
  const outM = L.build(noMetrics, m, { today: TODAY });
  ok(changed(outM).length === 0 && outM.warnings.length === 1 && outM.warnings[0].indexOf("metrics.json") > 0, "no metrics.json: warning, nothing written");
}

section("v2: degrees and thesis titles (read only)");
eq(model.degrees, [
  { year: "2021", title: "PhD in Computer Science (AI)", institution: "The National University of Malaysia (UKM)" },
  { year: "2009", title: "MSc in IT and Computer Sciences", institution: "Yarmouk University · Jordan" },
  { year: "2006", title: "BSc in IT and Computer Sciences", institution: "Yarmouk University · Jordan" },
], "degrees");
eq(model.theses, ["Noun Verb Extraction and Hybrid Krill Herd as Feature Selection for Document Classification", "Evaluation of the Effect of Stemming on Clustering of Arabic Documents"], "thesis titles");
{
  const m = copy(model);
  m.degrees = []; m.theses = [];
  eq(changed(L.build(files, m, { today: TODAY })), [], "they are helpers: changing them in the model changes nothing");
}

section("v2: everything at once, and the Python generator");
{
  const m = copy(model);
  m.fonts = { ar: "Tajawal", en: "Inter", head: "Lora" };
  m.theme = { palette: "teal" };
  m.sections[1].hidden = true;
  m.sections = [m.sections[4], m.sections[0], m.sections[1], m.sections[2], m.sections[3]];
  m.sections.push({ custom: true, title: { en: "Awards", ar: "الجوائز" }, kicker: { en: "", ar: "" }, intro: { en: "", ar: "" }, cards: [{ title: { en: "A", ar: "أ" }, text: { en: "B", ar: "ب" }, link: "" }] });
  m.courses.push({ code: "IS600", en: "Seminar", ar: "حلقة بحث" });
  m.timeline[0].text.en = "Updated.";
  m.photoVersion = "202701050900";
  m.citations["10.62754/joe.v3i8.5781"] = 31;
  m.news.unshift({ year: "2027", en: "News", ar: "خبر" });
  m.texts[5].en = m.texts[5].en + " (edited)";
  m.works = m.works.concat([NEW_WORK]);
  eq(L.validate(m), [], "valid model");
  const out = L.build(files, m, { today: TODAY });
  eq(changed(out), ["ar/index.html", "ar/publications.html", "data/metrics.json", "index.html", "publications.html", "research-data.js", "sitemap.xml"], "changed files");
  eq(out.warnings, [], "no warnings");
  const site = overlay(files, out);
  const back = L.read(site);
  eq(back.warnings, [], "the result reads without warnings");
  eq([back.fonts, back.theme.palette, back.sections.map((s) => s.id + (s.hidden ? "*" : "")), back.photoVersion, back.citations["10.62754/joe.v3i8.5781"], back.works.length, back.news[0].en, back.courses.slice(-1)[0].code, back.timeline[0].text.en],
    [m.fonts, "teal", ["contact", "leadership", "research*", "teaching", "experience", "custom-1"], "202701050900", 31, N + 1, "News", "IS600", "Updated."], "every change reads back");
  eq(changed(L.build(site, back, { today: TODAY })), [], "stable after reading back");
  const py = pythonArabic(out.files["index.html"], out.files["publications.html"]);
  if (!py) console.log("  (python3 not available: skipped)");
  else {
    ok(py.index === out.files["ar/index.html"], "ar/index.html (python) equals the JavaScript output");
    ok(py.pubs === out.files["ar/publications.html"], "ar/publications.html (python) equals the JavaScript output");
  }
}

section("v2: messages in English and Arabic");
{
  const m = copy(model);
  m.works = m.works.concat([Object.assign({}, NEW_WORK, { title: "", type: "", theme: "", methods: [], contribution: "", reference: "", year: "20" })]);
  m.metrics[0].value = ""; m.news[0].year = "x"; m.roles[0].org = "";
  m.fonts = { ar: "Nope", en: "Nope", head: "Nope" };
  m.theme = { palette: "custom", light: { bg: "blue" } };
  m.sections.push({ custom: true, title: { en: "", ar: "" }, cards: [{ title: { en: "", ar: "" }, link: "javascript:x" }] });
  m.nav.push({ href: "", en: "", ar: "" });
  m.courses.push({ code: "", en: "" }); m.timeline.push({ time: "", title: { en: "", ar: "" } });
  m.photoVersion = "a b"; m.citations["10.62754/joe.v3i8.5781"] = -1;
  const arErrors = L.validate(m);
  ok(arErrors.length >= 20 && arErrors.every((e) => /[؀-ۿ]/.test(e)), "validate speaks Arabic by default (" + arErrors.length + " messages)");
  eq(L.setLang("en"), "en", "setLang('en')");
  const enErrors = L.validate(m);
  eq(enErrors.length, arErrors.length, "the same number of messages in English");
  ok(noArabic(enErrors), "validate messages are English");
  // build: summary and warnings
  const b = copy(model);
  b.works = b.works.concat([NEW_WORK]);
  b.works[0] = Object.assign({}, b.works[0], { contribution: b.works[0].contribution + " Edited." });
  b.works = b.works.filter((w) => w.id !== "P02");
  b.news.pop(); b.roles.pop(); b.metrics[0].value = "19+";
  b.fonts = { ar: "Cairo", en: "Inter", head: "body" };
  b.theme = { palette: "custom", light: { bg: "#ffffff", surface: "#ffffff", text: "#aaaaaa", accent: "#eeee00", link: "#99ccff" } };
  b.sections[0].hidden = true; b.sections[2].hidden = true;
  b.sections = [b.sections[1], b.sections[0], b.sections[2], b.sections[3], b.sections[4], { custom: true, title: { en: "Awards", ar: "الجوائز" }, cards: [] }, { id: "ghost" }];
  b.courses.pop(); b.flagship.pop(); b.timeline.pop(); b.timelineEarlier.pop();
  b.photoVersion = "1"; b.citations["10.62754/joe.v3i8.5781"] = 40; b.texts[3].ar = b.texts[3].ar + "!";
  const en = L.build(files, b, { today: TODAY });
  ok(en.summary.length >= 18 && noArabic(en.summary), "summary is English (" + en.summary.length + " lines)");
  ok(en.warnings.length >= 5 && noArabic(en.warnings), "warnings are English (" + en.warnings.length + " lines)");
  ok(en.summary.some((s) => s === "Section hidden: Leadership") && en.summary.some((s) => s === "New section added: Awards") && en.summary.some((s) => s === "Section order changed.") && en.summary.some((s) => s === "Added work P41: " + NEW_WORK.title) && en.summary.some((s) => s === "Portrait changed."), "English wording");
  const missing = L.build({ "index.html": "<html></html>", "publications.html": "<html></html>" }, { metrics: [], news: [], roles: [], fonts: b.fonts, theme: b.theme, sections: [], nav: [], courses: [], works: [NEW_WORK] }, { today: TODAY });
  ok(missing.warnings.length >= 8 && noArabic(missing.warnings), "missing markers are reported in English");
  ok(noArabic(L.read({}).warnings) && L.read({}).warnings.length > 0, "read warnings are English");
  eq(L.setLang("fr"), "ar", "an unknown language falls back to Arabic");
  const arBuild = L.build(files, b, { today: TODAY });
  eq([arBuild.summary.length, arBuild.warnings.length], [en.summary.length, en.warnings.length], "Arabic and English builds say the same number of things");
  ok(arBuild.summary.every((s) => /[؀-ۿ]/.test(s)) && arBuild.warnings.every((s) => /[؀-ۿ]/.test(s)), "and Arabic is back");
  eq(en.files, arBuild.files, "the language of the messages never changes the files");
}

section("v2: the ChatGPT achievements list");
{
  const SAMPLE = `Review period: 1 June–21 November 2026
Sources: Connected Gmail, relevant email attachments, and IS department notes.
Duplicate check: Based on the website entries you supplied. The two July publications below are verified, but the list does not identify all 40 existing entries.

ITEM 1
Category: Conferences and academic service
Title (English): Technical Program Committee Member, ICDSIC 2027
Title (Arabic): عضو اللجنة الفنية للمؤتمر الدولي الثالث للمجتمع الرقمي والحوسبة الذكية
Organisation: ICDSIC 2027 Organizing Committee, hosted by Chengyi College, Jimei University
My role: Technical Program Committee member
Date: 19 November 2026 (appointment confirmed)
Evidence: ICDSIC 2027 Organizing Committee (Guangzhou KEO) | “Invitation-TPC Member: The 3rd International Conference on Digital Society and Intelligent Computing (ICDSIC 2027)” | confirmation reply, 19 November 2026
Public link: https://www.icdsic.net/
Confidence: High
Suggest: CV
Why: The organizer acknowledged your acceptance and said it would add your profile to the conference website.

ITEM 2
Category: Recognition
Title (English): Certificate of Appreciation for Judging the AI Hackathon for People with Disabilities, ICDR 2026
Title (Arabic): شهادة شكر وتقدير عن تحكيم هاكاثون الذكاء الاصطناعي للأشخاص ذوي الإعاقة ضمن المؤتمر الدولي السابع للإعاقة والتأهيل
Organisation: King Salman Center for Disability Research
My role: Judging panel member and certificate recipient
Date: 27 October 2026 (certificate received)
Evidence: King Salman Center for Disability Research | “شهادة شكر وتقدير | Certificate of Appreciation” | 27 October 2026, with a certificate issued in your name
Public link: none
Confidence: High
Suggest: Both
Why: Add the certificate to the existing judging entry as new recognition from the organizer.

ITEM 3
Category: Leadership and accreditation
Title (English): BSc Information Systems Program Granted Full ABET Accreditation Through 2031
Title (Arabic): حصول برنامج بكالوريوس نظم المعلومات على الاعتماد الكامل من ABET حتى عام 2031
Organisation: Prince Sultan University, College of Computer and Information Sciences
My role: Chair, Information Systems Department, at the time of the announcement
Date: 30 August 2026
Evidence: PSU CCIS Dean’s Office | “Celebrating Full ABET Accreditation – CS & IS Programs” | 30 August 2026
Public link: none
Confidence: High
Suggest: CV
Why: This is a confirmed program milestone you can mention under your chair appointment as a team achievement.

ITEM 4
Category: Research — published journal article
Title (English): Agentic Artificial Intelligence in Software Engineering: Integration Points, Architectural Frameworks, Empirical Evaluation, and Governance
Title (Arabic): الذكاء الاصطناعي الوكيلي في هندسة البرمجيات: نقاط التكامل والأطر المعمارية والتقييم التجريبي والحوكمة
Organisation: International Journal of Technology, 17(4)
My role: Co-author
Date: July 2026
Evidence: International Journal of Technology Editorial Office | “[IJTech] Your manuscript is published at Volume 17 Issue 4, Jul 2026” | 31 July 2026
Public link: https://ijtech.eng.ui.ac.id/issue/108
Confidence: High
Suggest: CV
Why: The journal confirmed publication. Check for an existing entry before adding it.

ITEM 5
Category: Research — published journal article
Title (English): Phishing Detection Using CNN–RNN with Sparrow Search Optimization Algorithm
Title (Arabic): كشف التصيد الاحتيالي باستخدام شبكات CNN–RNN وخوارزمية تحسين البحث عن العصافير
Organisation: Journal of Multiscale Modelling, 17(1), article 2640021
My role: Co-author
Date: July 2026 (publication notice)
Evidence: World Scientific Publishing | “JMM Vol: 17 Iss: 01 pp(2640021) Phishing Detection Using CNN–RNN with Sparrow Search Optimization Algorithm” | 6 July 2026
Public link: https://doi.org/10.1142/S1756973726400214
Confidence: High
Suggest: CV
Why: The publisher supplied the DOI and issue details. Check for an existing entry before adding it.

ITEM 6
Category: Research — accepted conference paper
Title (English): Explainable AI-Based Classification of Environmental, Technical, and Cyber Anomalies in Solar PV Systems Under UAE Desert Conditions
Title (Arabic): تصنيف الحالات الشاذة البيئية والتقنية والسيبرانية في الأنظمة الكهروضوئية الشمسية في ظروف صحراء الإمارات باستخدام الذكاء الاصطناعي القابل للتفسير
Organisation: ICAMAC 2026, hosted by Rochester Institute of Technology Dubai
My role: Co-author of a paper accepted for oral presentation
Date: 15 October 2026 (Riyadh date of the acceptance email)
Evidence: ICAMAC 2026 Organizing Committee | “ICAMAC 2026 – Paper Acceptance, Registration and Camera-Ready Submission” | 15 October 2026, Riyadh time
Public link: none
Confidence: High
Suggest: CV
Why: The committee confirmed acceptance for oral presentation. Registration and presentation remain unverified.

ITEM 7
Category: Research — accepted journal manuscript
Title (English): Harnessing Artificial Intelligence and Emerging Technologies for Environmental Protection: Legal, Ethical, and Policy Perspectives
Title (Arabic): توظيف الذكاء الاصطناعي والتقنيات الناشئة لحماية البيئة: رؤى قانونية وأخلاقية وسياساتيّة
Organisation: International Journal of Artificial Intelligence and Machine Learning
My role: Co-author
Date: 26 September 2026
Evidence: International Journal of Artificial Intelligence and Machine Learning Editorial Office | “Acceptance of Manuscript: International Journal of Artificial Intelligence and Machine Learning” | 26 September 2026, with a formal acceptance letter
Public link: none
Confidence: High
Suggest: CV
Why: The letter confirms acceptance for publication. A publication date and DOI remain unverified.

ITEM 8
Category: Professional development
Title (English): Certificate of Attendance, CCIS Research and Innovation Seminar
Title (Arabic): شهادة حضور ندوة البحث والابتكار بكلية علوم الحاسب والمعلومات
Organisation: Prince Sultan University, College of Computer and Information Sciences
My role: Attendee and certificate recipient
Date: 26 October 2026
Evidence: PSU CCIS | “Your certificate of attendance - CCIS Research and Innovation Seminar” | 26 October 2026, with a personalized certificate
Public link: none
Confidence: High
Suggest: CV
Why: CCIS documented your attendance with a named certificate.

ASK ME
- Was your nominated senior project publicly showcased or awarded at CCIS EXPO 261 on 15 November? The 12 November email confirms your supervision and the nomination.
- Has the comprehensive IS program review received final approval, and may the milestone be shared publicly? The latest thread shows the external-review package was sent for review on 20 November.
- Does your ICEGOV 2026 entry describe a Track Chair appointment or a delivered event? UNU-EGOV confirmed on 25 August that the Riyadh event would not proceed on its original dates and thanked you for your programme contributions.
- Did Mesopotamian Academic Press issue a corrected Babylonian Journal of Networking certificate? The 3 September email confirmed the appointment, but its attachment bears a different recipient’s name.

NUMBERS
- 3 senior project examinations coordinated for CCIS EXPO 261. Source: PSU final-report and examiner email threads, 10–16 November 2026. One of those threads independently names you as supervisor through the selection results.
- ResearchGate reported 14 citations for the week in its 26 August 2026 email and 3 for the week in its 16 September 2026 email. These are weekly figures.
- Full ABET accreditation through 2031 for the BSc Information Systems program. Source: PSU CCIS Dean’s announcement, 30 August 2026.
- No newer verified figures surfaced for cumulative citations, h-index, total publications, or volunteer hours.

Total items: 8
`;
  const res = L.parseAchievements(SAMPLE);
  ok(Array.isArray(res) && res.items === res.items && res.length === 8 && res.items.length === 8, "eight items, as an array that also carries .items");
  eq(res.map((it) => it.n), [1, 2, 3, 4, 5, 6, 7, 8], "item numbers");
  eq(res[0], {
    n: 1, category: "Conferences and academic service", titleEn: "Technical Program Committee Member, ICDSIC 2027",
    titleAr: "عضو اللجنة الفنية للمؤتمر الدولي الثالث للمجتمع الرقمي والحوسبة الذكية",
    organisation: "ICDSIC 2027 Organizing Committee, hosted by Chengyi College, Jimei University", role: "Technical Program Committee member",
    date: "19 November 2026 (appointment confirmed)", year: 2026,
    evidence: "ICDSIC 2027 Organizing Committee (Guangzhou KEO) | “Invitation-TPC Member: The 3rd International Conference on Digital Society and Intelligent Computing (ICDSIC 2027)” | confirmation reply, 19 November 2026",
    link: "https://www.icdsic.net/", confidence: "High", suggest: "CV",
    why: "The organizer acknowledged your acceptance and said it would add your profile to the conference website.", suggestKind: "cv",
  }, "first item, every field");
  eq(res.map((it) => it.link), ["https://www.icdsic.net/", null, null, "https://ijtech.eng.ui.ac.id/issue/108", "https://doi.org/10.1142/S1756973726400214", null, null, null], "'none' links are null");
  eq(res.map((it) => it.suggestKind), ["cv", "both", "cv", "cv", "cv", "cv", "cv", "cv"], "suggestions");
  ok(res.every((it) => it.year === 2026 && it.titleEn && it.titleAr && it.category && it.organisation && it.role && it.why && it.evidence), "every item is complete");
  eq(res[3].titleEn, "Agentic Artificial Intelligence in Software Engineering: Integration Points, Architectural Frameworks, Empirical Evaluation, and Governance", "a title that contains a colon");
  eq(res[4].date, "July 2026 (publication notice)", "a date without a day");
  eq(res.askMe.length, 4, "four questions");
  ok(res.askMe[0].indexOf("Was your nominated senior project") === 0 && res.askMe[3].indexOf("Did Mesopotamian Academic Press") === 0, "questions without the bullet");
  eq(res.numbers.length, 4, "four numbers lines");
  ok(res.numbers[2].indexOf("Full ABET accreditation through 2031") === 0, "numbers text");
  eq(res.total, 8, "total");
  eq(JSON.parse(JSON.stringify(res)).length, 8, "the result serialises as the list of items");
  // looser formatting, as other tools write it
  const loose = L.parseAchievements("```\n**ITEM 3**\n- **Category:** Recognition\n- **Title (EN):** Best Reviewer\n- **Title (AR):** أفضل محكّم\n- **Organization:** IEEE\n- **Role:** Reviewer\n- **Date:** May 2025\n- **Public link:** (https://example.org/x).\n- **Suggestion:** Website\n- **Why:** It is public\n  and verified.\n\n## ASK ME\n1. First?\n2. Second?\n\n## NUMBERS:\n* 12 reviews\n```");
  eq([loose.length, loose[0].n, loose[0].category, loose[0].titleEn, loose[0].titleAr, loose[0].organisation, loose[0].role, loose[0].year, loose[0].link, loose[0].suggestKind, loose[0].why],
    [1, 3, "Recognition", "Best Reviewer", "أفضل محكّم", "IEEE", "Reviewer", 2025, "https://example.org/x", "website", "It is public and verified."], "markdown, American spelling, wrapped lines");
  eq([loose.askMe, loose.numbers, loose.total], [["First?", "Second?"], ["12 reviews"], null], "numbered and starred lists");
  const empty = L.parseAchievements("");
  eq([empty.length, empty.askMe, empty.numbers, empty.total], [0, [], [], null], "empty text");
  eq(L.parseAchievements(null).length, 0, "null does not throw");
  eq(L.parseAchievements("Hello, nothing to report.").length, 0, "text without items");
}

section("v2: CV module wiring");
{
  // 1. a stand-in module: records what it is given, writes a few facts into the page
  const calls = [];
  const stub = {
    read(html) { const m = /<!-- cv:profile -->([\s\S]*?)<!-- \/cv:profile -->/.exec(html); return { profile: { en: m ? m[1] : "" }, selected: 17 }; },
    build(m, html, options) {
      calls.push({ model: m, options });
      const facts = [m.works.length, m.courses.length, m.timeline.length, m.roles.length, m.degrees.length, m.theses.length, m.today].join("|");
      return html.replace(/<!-- cv:profile -->[\s\S]*?<!-- \/cv:profile -->/, "<!-- cv:profile -->" + m.cv.profile.en + "<!-- /cv:profile -->")
        .replace(/<!-- cv:auto -->[\s\S]*?<!-- \/cv:auto -->/, "<!-- cv:auto -->" + facts.replace(/\|[^|]*$/, "") + "<!-- /cv:auto -->");
    },
  };
  const cvPage = "<html><!-- cv:profile -->Profile text<!-- /cv:profile --><!-- cv:auto -->" + [N, 8, 5, model.roles.length, 3, 2].join("|") + "<!-- /cv:auto --></html>";
  const withCv = Object.assign({}, files, { "cv.html": cvPage });
  I.setCV(stub);
  const m0 = L.read(withCv);
  eq(m0.cv, { profile: { en: "Profile text" }, selected: 17 }, "read() adds model.cv from the module");
  const same = L.build(withCv, m0, { today: TODAY });
  eq(changed(same), [], "an unchanged model changes nothing, cv.html included");
  ok(calls.length === 1 && calls[0].model.today === TODAY && calls[0].options.today === TODAY, "the module is given the build date");
  ok(calls[0].model.works.length === N && calls[0].model.degrees.length === 3 && calls[0].model.sections.length === 5 && calls[0].model.cv.profile.en === "Profile text", "and the whole model");
  // a works change reaches the CV
  const m1 = copy(m0);
  m1.works = m1.works.concat([NEW_WORK]);
  m1.courses.push({ code: "IS700", en: "New course", ar: "" });
  m1.cv.profile.en = "New profile";
  const out = L.build(withCv, m1, { today: TODAY });
  ok(changed(out).indexOf("cv.html") >= 0, "cv.html is among the changed files");
  ok(out.files["cv.html"].indexOf("<!-- cv:profile -->New profile<!-- /cv:profile -->") > 0, "the owner's CV text is passed through");
  ok(out.files["cv.html"].indexOf("<!-- cv:auto -->" + [N + 1, 9, 5, model.roles.length, 3, 2].join("|") + "<!-- /cv:auto -->") > 0, "the CV is built from the site as it will be after this build");
  ok(out.summary.some((s) => s === "حُدّثت صفحة السيرة الذاتية."), "summary line");
  eq(calls[calls.length - 1].model.works[N].id, "P41", "works reach the module normalised and in order");
  // only the CV text changes
  const m2 = copy(m0);
  m2.cv.profile.en = "Only the CV";
  eq(changed(L.build(withCv, m2, { today: TODAY })), ["cv.html"], "a CV-only edit changes only cv.html");
  // a draft without model.cv keeps the page's own content
  const m3 = copy(m0); delete m3.cv;
  eq(changed(L.build(withCv, m3, { today: TODAY })), [], "a model without cv keeps the CV as it is");
  // no cv.html in the files: skipped
  const before = calls.length;
  const noCv = Object.assign({}, files); delete noCv["cv.html"];
  eq(changed(L.build(noCv, m1, { today: TODAY })).indexOf("cv.html"), -1, "no cv.html among the files: the module is not called");
  ok(!("cv" in L.read(noCv)), "and read() gives no model.cv");
  eq(calls.length, before, "(not called)");
  // a module that fails must not break the build
  I.setCV({ read() { throw new Error("boom"); }, build() { throw new Error("boom"); } });
  const r = L.read(withCv);
  ok(!("cv" in r) && r.warnings.length === 1 && r.warnings[0].indexOf("cv.html") > 0, "read: a failing module gives a warning, not an exception");
  const o = L.build(withCv, m1, { today: TODAY });
  ok(changed(o).indexOf("cv.html") < 0 && changed(o).indexOf("index.html") >= 0 && o.warnings.some((w) => w.indexOf("cv.html") > 0), "build: a failing module gives a warning; the rest is built");
  // in the browser the module is window.DashCV
  const sandbox = { self: { DashCV: stub } };
  vm.createContext(sandbox);
  vm.runInContext(read("admin/lib.js"), sandbox);
  eq(JSON.parse(JSON.stringify(sandbox.self.DashLib.read(withCv).cv)), { profile: { en: "Profile text" }, selected: 17 }, "browser: window.DashCV is used");
  // 2. the real module, when the CV agent's files are there
  I.setCV(undefined);
  // DASH_CV=off runs the "without" case even when the CV agent's files are present
  const off = process.env.DASH_CV === "off";
  const hasModule = !off && fs.existsSync(path.join(ROOT, "admin", "cv.js")), hasPage = fs.existsSync(path.join(ROOT, "cv.html"));
  if (off) I.setCV(null);
  if (!hasModule || !hasPage) {
    console.log("  CASE RUN: without the real CV module (admin/cv.js " + (hasModule ? "present" : "missing") + ", cv.html " + (hasPage ? "present" : "missing") + ")");
    eq(changed(L.build(files, L.read(files), { today: TODAY })), [], "round trip without the CV module");
    const bare = Object.assign({}, files); delete bare["cv.html"];
    eq(changed(L.build(bare, L.read(bare), { today: TODAY })), [], "round trip without cv.html among the files");
    ok(!("cv" in L.read(files)), "no model.cv without the module");
  } else if (!I.getCV()) {
    console.log("  CASE RUN: admin/cv.js is present but could not be loaded (the library skips it)");
    eq(changed(L.build(files, L.read(files), { today: TODAY })), [], "round trip with an unloadable CV module");
  } else {
    console.log("  CASE RUN: with the real CV module (admin/cv.js + cv.html)");
    const real = loadFiles();
    const rm = L.read(real);
    ok(rm.cv && typeof rm.cv === "object", "real module: read() returns model.cv");
    const rt = L.build(real, rm, { today: TODAY });
    eq(changed(rt), [], "real module: an unchanged model changes nothing");
    eq(rt.warnings, [], "real module: no warnings");
    const add = copy(rm);
    add.works = add.works.concat([NEW_WORK]);
    const ro = L.build(real, add, { today: TODAY });
    ok(typeof ro.files["cv.html"] === "string" && ro.files["cv.html"] !== real["cv.html"], "real module: a new work reaches cv.html");
    const site = overlay(real, ro);
    eq(changed(L.build(site, L.read(site), { today: TODAY })), [], "real module: stable after reading back");
  }
  I.setCV(null);
}

/* ------------------------------------------------------------------ */
section("v3: API shape");
eq(Object.keys(L.PAGES), ["index.html", "publications.html", "cv.html"], "pages with an Arabic twin");
eq(L.PAGES["cv.html"], { out: "ar/cv.html", en: "https://dromaia.github.io/cv.html", ar: "https://dromaia.github.io/ar/cv.html" }, "cv.html page spec");
eq(I.LISTS_V3.map((l) => [l.key, l.block]), [["leadBullets", "dash:lead-bullets"], ["leadCards", "dash:lead-cards"], ["contacts", "dash:contacts"],
  ["contactLinks", "dash:contact-links"], ["degreeCards", "dash:degrees"], ["thesisItems", "dash:theses"]], "version 3 lists and their markers");
ok(!/analytics|goatcounter/i.test(read("admin/lib.js").replace(/Decision analytics/g, "")) && !("analytics" in model), "no visitor-statistics code or model field");
["index.html", "publications.html"].forEach((page) => ok(files[page].indexOf("dash:analytics") < 0 && !/goatcounter|gc\.zgo\.at/i.test(files[page]), page + " carries no statistics block or script"));

section("v3: leadership, contact and degree lists");
{
  const idx = files["index.html"];
  eq(model.warnings, [], "no read warnings");
  eq([model.leadBullets.length, model.leadCards.length, model.contacts.length, model.contactLinks.length, model.degreeCards.length, model.thesisItems.length], [5, 3, 4, 3, 3, 2], "items read");
  eq(model.leadBullets[0], { en: "Academic leadership of the department within CCIS", ar: "القيادة الأكاديمية للقسم في كلية علوم الحاسب والمعلومات" }, "a bullet");
  eq(model.leadCards.map((c) => [c.rich, c.ref === undefined ? null : c.ref, c.titleClass || ""]), [[false, null, ""], [true, 1, ""], [false, null, "volunteer-highlight"]], "plain and rich cards");
  eq(model.leadCards[1].title.en, "Editorial Board, Babylonian Journal of Networking", "a rich card still shows its title");
  eq(model.leadCards[0].tag, { en: "Conference leadership", ar: "قيادة المؤتمرات" }, "a plain card's tag");
  // the page uses non-breaking spaces in these texts; they must survive as they are
  eq(model.contacts[2], { label: { en: "Mobile\u00a0·\u00a0KSA", ar: "الجوال · السعودية" }, value: "+966\u00a059\u00a0837\u00a07884", valueAr: "", hint: { en: "Tap\u00a0to\u00a0call", ar: "اضغط للاتصال" }, href: "tel:+966598377884", hrefAr: "", phone: true }, "a phone contact (non-breaking spaces kept)");
  ok(model.contacts[0].hrefAr.indexOf("mailto:oalomari@psu.edu.sa?subject=") === 0 && model.contacts[3].valueAr === "الملف المهني ↗", "Arabic link and Arabic value kept");
  eq(model.contactLinks.map((l) => [l.en, l.primary]), [["View Academic CV ↗", true], ["Official PSU profile ↗", false], ["ORCID ↗", false]], "contact buttons");
  eq(model.degreeCards.map((d) => [d.year, d.title.en, !!d.link]), [["2021", "PhD in Computer Science (AI)", true], ["2009", "MSc in IT and Computer Sciences", false], ["2006", "BSc in IT and Computer Sciences", false]], "degree cards");
  eq(model.degreeCards[0].link.href, "https://www.topuniversities.com/universities/universiti-kebangsaan-malaysia-ukm", "a degree's link");
  eq(model.thesisItems[1], { label: { en: "Thesis", ar: "عنوان الرسالة" }, text: { en: "Evaluation of the Effect of Stemming on Clustering of Arabic Documents", ar: "تقييم أثر التجذير في عنقدة الوثائق العربية" } }, "a thesis title");
  // the read-only fields the CV module uses keep their types
  eq(model.degrees.map((d) => [typeof d.year, typeof d.title, typeof d.institution]), [["string", "string", "string"], ["string", "string", "string"], ["string", "string", "string"]], "model.degrees keeps plain strings");
  eq(model.theses, model.thesisItems.map((t) => t.text.en), "model.theses keeps plain strings");
  // texts: a plain card is edited as a list item; a rich card keeps its texts in the texts list
  const en = model.texts.filter((t) => t.page === "index.html").map((t) => t.en);
  ok(en.indexOf("Conference leadership") < 0 && en.indexOf("700+ volunteer hours") < 0 && en.indexOf("Tap to call") < 0 && en.indexOf("PhD in Computer Science (AI)") < 0, "plain cards, contacts and degrees are not in the texts list");
  ok(en.indexOf("Editorial & reviewing") >= 0 && en.indexOf("2026–present. Reviewer for ") >= 0 && en.indexOf("Editorial team page ↗") >= 0, "the rich card's texts are in the texts list");

  // bullets
  const m = copy(model);
  m.leadBullets.push({ en: 'New <bullet> & "more"', ar: "نقطة <جديدة>" });
  let out = L.build(files, m, { today: TODAY });
  eq(changed(out), HOME_ONLY, "a bullet changes only the home page");
  eq(out.warnings, [], "no warnings");
  eq(out.summary, ["حُدّث قسم نقاط بطاقة القيادة."], "summary line");
  eq(I.blockLines(out.files["index.html"], "dash:lead-bullets")[5], '<li data-ar="نقطة &lt;جديدة&gt;">New &lt;bullet&gt; &amp; "more"</li>', "new bullet, escaped");
  ok(out.files["ar/index.html"].indexOf("<li>نقطة &lt;جديدة&gt;</li>") > 0, "Arabic page follows");
  eq(L.read(overlay(files, out)).leadBullets[5], { en: 'New <bullet> & "more"', ar: "نقطة <جديدة>" }, "and reads back");

  // cards: reorder with the rich card, edit a plain one, add one, and edit a text of the rich card in the same build
  const mc = copy(model);
  mc.leadCards = [mc.leadCards[1], mc.leadCards[2], mc.leadCards[0]];
  mc.leadCards[2].text.en = "Edited & plain.";
  mc.leadCards.push({ tag: { en: "New", ar: "جديد" }, title: { en: "Fourth card", ar: "" }, text: { en: "", ar: "" }, rich: false });
  const richText = mc.texts.filter((t) => t.en === "Editorial team page ↗")[0];
  richText.en = "Editorial team ↗";
  out = L.build(files, mc, { today: TODAY });
  eq(changed(out), HOME_ONLY, "cards change only the home page");
  const lines = I.blockLines(out.files["index.html"], "dash:lead-cards");
  const before = I.blockLines(idx, "dash:lead-cards");
  eq(lines.length, 4, "four cards");
  ok(lines[0] === before[1].replace("Editorial team page ↗", "Editorial team ↗"), "the rich card moved, kept its markup, and took the text edit");
  ok(lines[1] === before[2], "an untouched plain card is byte-identical (class on its title kept)");
  ok(lines[2].indexOf("<p data-ar=") > 0 && lines[2].indexOf(">Edited &amp; plain.</p></article>") > 0, "the edited plain card");
  eq(lines[3], '<article class="card"><span class="tag" data-ar="جديد">New</span><h3>Fourth card</h3><p></p></article>', "a new plain card");
  ok(out.summary.indexOf("حُدّث قسم بطاقات القيادة.") >= 0 && out.summary.indexOf("عُدّل نص واحد.") >= 0, "summary lines");
  const back = L.read(overlay(files, out));
  eq(back.leadCards.map((c) => [c.rich, c.title.en]), [[true, "Editorial Board, Babylonian Journal of Networking"], [false, "700+ volunteer hours"], [false, "CCIS EXPO 2026 · ICEGOV 2026"], [false, "Fourth card"]], "cards read back in the new order");
  eq(changed(L.build(overlay(files, out), back, { today: TODAY })), [], "stable after reading back");
  // deleting the rich card removes its line and nothing else
  const md = copy(model);
  md.leadCards.splice(1, 1);
  out = L.build(files, md, { today: TODAY });
  eq(I.blockLines(out.files["index.html"], "dash:lead-cards"), [before[0], before[2]], "deleting the rich card");

  // contacts and buttons
  const mk = copy(model);
  mk.contacts[2].value = "+966 50 000 0000"; mk.contacts[2].href = "tel:+966500000000";
  mk.contacts.push({ label: { en: "Scholar", ar: "" }, value: "Google Scholar ↗", valueAr: "", hint: { en: "Publications", ar: "المنشورات" }, href: "https://scholar.google.com/citations?user=TJnHJX8AAAAJ&hl=en", hrefAr: "", phone: false });
  mk.contactLinks.push({ en: "Portfolio ↗", ar: "ملف الأبحاث ↗", href: "portfolio.html", hrefAr: "../portfolio.html", primary: false });
  mk.contactLinks[0].primary = false;
  out = L.build(files, mk, { today: TODAY });
  eq(changed(out), HOME_ONLY, "contacts change only the home page");
  const cl = I.blockLines(out.files["index.html"], "dash:contacts");
  eq(cl.slice(0, 2).concat(cl[3]), I.blockLines(idx, "dash:contacts").filter((x, i) => i !== 2), "untouched contact lines are byte-identical");
  eq(cl[2], '<a class="contact-path phone" href="tel:+966500000000"><span class="contact-label" data-ar="الجوال · السعودية">Mobile\u00a0·\u00a0KSA</span><strong>+966 50 000 0000</strong><span data-ar="اضغط للاتصال">Tap\u00a0to\u00a0call</span></a>', "edited phone line");
  eq(cl[4], '<a class="contact-path" href="https://scholar.google.com/citations?user=TJnHJX8AAAAJ&amp;hl=en" rel="noopener" target="_blank"><span class="contact-label">Scholar</span><strong>Google Scholar ↗</strong><span data-ar="المنشورات">Publications</span></a>', "a web contact opens in a new tab; & escaped in the link");
  const bl = I.blockLines(out.files["index.html"], "dash:contact-links");
  eq(bl[0].indexOf('<a class="btn" data-ar='), 0, "primary flag removed");
  eq(bl[3], '<a class="btn" data-ar="ملف الأبحاث ↗" href="portfolio.html" data-ar-href="../portfolio.html" rel="noopener" target="_blank">Portfolio ↗</a>', "a new button with its Arabic link");
  ok(out.files["ar/index.html"].indexOf('<a class="btn" href="../portfolio.html" rel="noopener" target="_blank">ملف الأبحاث ↗</a>') > 0, "Arabic page uses the Arabic link");
  eq(changed(L.build(overlay(files, out), L.read(overlay(files, out)), { today: TODAY })), [], "stable after reading back");

  // degrees and theses
  const mg = copy(model);
  mg.degreeCards.unshift({ year: "2028", title: { en: "Postgraduate Certificate", ar: "شهادة دراسات عليا" }, institution: { en: "Test University", ar: "" }, link: { en: "Programme ↗", ar: "", href: "https://example.org/p" } });
  mg.degreeCards[1].link = null;
  mg.thesisItems.push({ label: { en: "Project", ar: "مشروع" }, text: { en: "A third title", ar: "" } });
  out = L.build(files, mg, { today: TODAY });
  eq(changed(out), HOME_ONLY, "degrees change only the home page (CV module off)");
  const dl = I.blockLines(out.files["index.html"], "dash:degrees");
  eq(dl[0], '<article class="degree-card"><div class="degree-top"><span class="degree-year">2028</span></div><h3 data-ar="شهادة دراسات عليا">Postgraduate Certificate</h3><div class="degree-institution">Test University</div><a class="ranking-link" href="https://example.org/p" rel="noopener" target="_blank">Programme ↗</a></article>', "a new degree card");
  ok(dl[1].indexOf("ranking-link") < 0 && dl[1].indexOf("PhD in Computer Science (AI)") > 0, "a degree's link removed");
  eq(dl.slice(2), I.blockLines(idx, "dash:degrees").slice(1), "untouched degree lines are byte-identical");
  eq(I.blockLines(out.files["index.html"], "dash:theses")[2], '<div class="degree-detail"><small data-ar="مشروع">Project</small><p>A third title</p></div>', "a new thesis line");
  const rg = L.read(overlay(files, out));
  eq([rg.degrees.length, rg.degrees[0].title, rg.theses.length, rg.theses[2]], [4, "Postgraduate Certificate", 3, "A third title"], "the read-only CV fields follow the cards");

  // validate
  const bad = copy(model);
  bad.leadBullets[0].en = "";
  bad.leadCards[0].title.en = "";
  bad.leadCards[1].title.en = ""; // rich: not checked
  bad.contacts[0].href = "javascript:alert(1)";
  bad.contacts[1].value = "";
  bad.contactLinks[1].href = "https://a b";
  bad.degreeCards[0].link.href = "";
  bad.degreeCards[1].title.en = "";
  bad.thesisItems[0].text.en = "";
  const errs = L.validate(bad);
  eq(errs.length, 8, "eight errors: " + JSON.stringify(errs));
  ok(errs.some((e) => e.indexOf("وسائل التواصل (1)") === 0 && e.indexOf("الرابط") > 0) && errs.some((e) => e.indexOf("الشهادات العلمية (1)") === 0), "errors name the list and the item");
  L.setLang("en");
  ok(L.validate(bad).some((e) => e === "contact paths (1): the link is not valid.") && !L.validate(bad).some((e) => /[؀-ۿ]/.test(e)), "English messages");
  L.setLang("ar");
  eq(L.validate(model), [], "the current site is valid");

  // an older page without the new markers: read warns, the other blocks still work
  const old = Object.assign({}, files, { "index.html": idx.replace("<!-- dash:lead-bullets -->", "").replace("<!-- /dash:lead-bullets -->", "") });
  const ro = L.read(old);
  ok(ro.warnings.length === 1 && ro.warnings[0].indexOf("dash:lead-bullets") >= 0 && ro.leadBullets.length === 0 && ro.contacts.length === 4, "a missing marker is one read warning");
  const mo = copy(ro); mo.leadBullets = [{ en: "x", ar: "" }]; mo.contacts[2].value = "+966 50 111 1111";
  const oo = L.build(old, mo, { today: TODAY });
  ok(oo.warnings.some((w) => w.indexOf("dash:lead-bullets") >= 0) && oo.files["index.html"].indexOf("+966 50 111 1111") > 0, "build warns for the missing block and updates the others");
}

section("v3: page modules (portfolio page, Arabic CV)");
{
  // --- portfolio: a stand-in module records what it is given
  const pfCalls = [];
  const pfStub = {
    read(html) { const m = /<!-- pf:t -->([\s\S]*?)<!-- \/pf:t -->/.exec(html); return { trajectory: m && m[1] ? m[1].split("|") : [] }; },
    buildDetailed(m, html) {
      pfCalls.push(m);
      const facts = [m.works.length, (m.meta || {}).total, (m.meta || {}).verificationCutoff].join(",");
      return { html: html.replace(/<!-- pf:t -->[\s\S]*?<!-- \/pf:t -->/, "<!-- pf:t -->" + m.portfolio.trajectory.join("|") + "<!-- /pf:t -->")
        .replace(/<!-- pf:a -->[\s\S]*?<!-- \/pf:a -->/, "<!-- pf:a -->" + facts + "<!-- /pf:a -->"), warnings: m.portfolio.trajectory.length ? [] : ["PF-WARNING"], changed: [] };
    },
    build(m, html) { return this.buildDetailed(m, html).html; },
  };
  const meta0 = dataOf(files["research-data.js"]).meta;
  const pfPage = "<html><!-- pf:t -->one|two<!-- /pf:t --><!-- pf:a -->" + [N, meta0.total, meta0.verificationCutoff].join(",") + "<!-- /pf:a --></html>";
  const withPf = Object.assign({}, files, { "portfolio.html": pfPage });
  I.setPortfolio(pfStub);
  const p0 = L.read(withPf);
  eq(p0.portfolio, { trajectory: ["one", "two"] }, "read() adds model.portfolio from the module");
  const same = L.build(withPf, p0, { today: TODAY });
  eq(changed(same), [], "an unchanged model changes nothing, portfolio.html included");
  ok(pfCalls.length === 1 && pfCalls[0].today === TODAY && pfCalls[0].meta.total === meta0.total && pfCalls[0].meta.verificationCutoff === meta0.verificationCutoff && pfCalls[0].cutoff === meta0.verificationCutoff,
    "the module is given today and the catalogue header (cutoff, total)");
  const p1 = copy(p0);
  p1.portfolio.trajectory.push("three");
  let out = L.build(withPf, p1, { today: TODAY });
  eq(changed(out), ["portfolio.html"], "an owner edit changes only portfolio.html");
  eq(out.summary, ["حُدّثت صفحة ملف الأبحاث."], "summary line");
  const p2 = copy(p0);
  p2.works = p2.works.concat([NEW_WORK]);
  out = L.build(withPf, p2, { today: TODAY });
  ok(out.files["portfolio.html"].indexOf("<!-- pf:a -->" + [N + 1, N + 1, TODAY].join(",") + "<!-- /pf:a -->") > 0, "a new work reaches the page with the header as it will be after the build");
  const p3 = copy(p0); p3.portfolio.trajectory = [];
  out = L.build(withPf, p3, { today: TODAY });
  ok(out.warnings.indexOf("PF-WARNING") >= 0, "the module's warnings are passed on");
  const p4 = copy(p0); delete p4.portfolio;
  eq(changed(L.build(withPf, p4, { today: TODAY })), [], "a model without portfolio keeps the page as it is");
  const callsBefore = pfCalls.length;
  const noPf = Object.assign({}, files, { "portfolio.html": "" });
  ok(!("portfolio" in L.read(noPf)) && changed(L.build(noPf, p2, { today: TODAY })).indexOf("portfolio.html") < 0 && pfCalls.length === callsBefore, "an empty or missing portfolio.html: the module is not called");
  const noFile = Object.assign({}, files); delete noFile["portfolio.html"];
  ok(!("portfolio" in L.read(noFile)) && changed(L.build(noFile, L.read(noFile), { today: TODAY })).length === 0, "no portfolio.html among the files: round trip still clean");
  I.setPortfolio({ read() { throw new Error("boom"); }, build() { throw new Error("boom"); } });
  const rf = L.read(withPf);
  ok(!("portfolio" in rf) && rf.warnings.some((w) => w.indexOf("portfolio.html") > 0), "read: a failing module gives a warning");
  const of = L.build(withPf, p2, { today: TODAY });
  ok(changed(of).indexOf("portfolio.html") < 0 && changed(of).indexOf("index.html") >= 0 && of.warnings.some((w) => w.indexOf("portfolio.html") > 0), "build: a failing module gives a warning; the rest is built");
  const sandbox = { self: { DashPortfolio: pfStub } };
  vm.createContext(sandbox);
  vm.runInContext(read("admin/lib.js"), sandbox);
  eq(JSON.parse(JSON.stringify(sandbox.self.DashLib.read(withPf).portfolio)), { trajectory: ["one", "two"] }, "browser: window.DashPortfolio is used");
  I.setPortfolio(null);

  // --- Arabic CV: ar/cv.html is an output of a cv.html that carries data-ar
  const arStub = {
    read(html) { const m = /<p id="p" data-ar="([^"]*)">([^<]*)<\/p>/.exec(html); return { profile: { en: m ? m[2] : "", ar: m ? m[1] : "" } }; },
    build(m, html) { return html.replace(/<p id="p" data-ar="[^"]*">[^<]*<\/p>/, '<p id="p" data-ar="' + m.cv.profile.ar + '">' + m.cv.profile.en + "</p>"); },
  };
  const cvPage = '<!DOCTYPE html>\n<html lang="en" dir="ltr" data-ar-lang="ar" data-ar-dir="rtl"><head><link rel="canonical" href="https://dromaia.github.io/cv.html" data-ar-href="https://dromaia.github.io/ar/cv.html">' +
    '<script type="application/ld+json">{"@type":"ProfilePage","inLanguage":"en","url":"https://dromaia.github.io/cv.html"}</script></head><body>' +
    '<a href="index.html" data-ar="الرئيسية">Home</a><img src="PhotoDrOmaia.webp" alt=""><p id="p" data-ar="نبذة">Profile</p></body></html>\n';
  const withCv = Object.assign({}, files, { "cv.html": cvPage });
  I.setCV(arStub);
  const c0 = L.read(withCv);
  eq(changed(L.build(withCv, c0, { today: TODAY })), [], "round trip: ar/cv.html is not produced when nothing changed");
  const c1 = copy(c0); c1.cv.profile.en = "New profile"; c1.cv.profile.ar = "نبذة جديدة";
  out = L.build(withCv, c1, { today: TODAY });
  eq(changed(out), ["ar/cv.html", "cv.html"], "a CV edit writes cv.html and its Arabic page");
  const arCv = out.files["ar/cv.html"];
  ok(arCv === L.buildArabic("cv.html", out.files["cv.html"]), "ar/cv.html is buildArabic of the new cv.html");
  ok(arCv.indexOf('<html lang="ar" dir="rtl">') > 0 && arCv.indexOf('<p id="p">نبذة جديدة</p>') > 0 && arCv.indexOf(" data-ar") < 0, "Arabic page: language, direction, Arabic text, no leftovers");
  ok(arCv.indexOf('href="https://dromaia.github.io/ar/cv.html"') > 0 && arCv.indexOf('"url":"https://dromaia.github.io/ar/cv.html"') > 0 && arCv.indexOf('"inLanguage":"ar"') > 0, "Arabic page: canonical and structured data");
  ok(arCv.indexOf('src="../PhotoDrOmaia.webp"') > 0 && arCv.indexOf('<a href="index.html">الرئيسية</a>') > 0, "Arabic page: asset paths move up, page links stay local");
  ok(arCv.indexOf("<!DOCTYPE html>\n<!-- Generated by tools/build-arabic.py from ../cv.html.") === 0, "Arabic page: banner");
  // the caller may supply ar/cv.html: then it is compared, and repaired when out of step
  const stale = Object.assign({}, withCv, { "ar/cv.html": "old" });
  eq(changed(L.build(stale, L.read(stale), { today: TODAY })), ["ar/cv.html"], "a supplied ar/cv.html that is out of step is rewritten");
  const fresh = Object.assign({}, withCv, { "ar/cv.html": L.buildArabic("cv.html", cvPage) });
  eq(changed(L.build(fresh, L.read(fresh), { today: TODAY })), [], "a supplied ar/cv.html that is current is left alone");
  // a CV without data-ar has no Arabic page
  const plainCv = Object.assign({}, files, { "cv.html": cvPage.replace(/ data-ar(-[a-z]+)?="[^"]*"/g, "") });
  I.setCV({ read() { return { n: 1 }; }, build(m, html) { return html.replace("Profile", "Profile " + m.cv.n); } });
  const pm = L.read(plainCv); pm.cv.n = 2;
  eq(changed(L.build(plainCv, pm, { today: TODAY })), ["cv.html"], "a CV without Arabic texts has no ar/cv.html");
  I.setCV(null);
  // the Python generator, once it lists cv.html, must give the same Arabic page
  let python = true;
  try { execFileSync("python3", ["--version"], { stdio: "ignore" }); } catch (e) { python = false; }
  if (!python || !PY_LISTS_CV) console.log("  CASE RUN: Python comparison of ar/cv.html skipped (" + (python ? "tools/build-arabic.py does not list cv.html yet" : "python3 not available") + ")");
  else {
    console.log("  CASE RUN: tools/build-arabic.py lists cv.html: comparing its ar/cv.html with the JavaScript output");
    const realCv = fs.existsSync(path.join(ROOT, "cv.html")) ? read("cv.html") : "";
    [["stand-in CV page", cvPage]].concat(/\sdata-ar="/.test(realCv) ? [["the repository's cv.html", realCv]] : []).forEach(([name, page]) => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dash-"));
      fs.mkdirSync(path.join(tmp, "tools"));
      fs.copyFileSync(path.join(ROOT, "tools", "build-arabic.py"), path.join(tmp, "tools", "build-arabic.py"));
      fs.writeFileSync(path.join(tmp, "index.html"), files["index.html"]);
      fs.writeFileSync(path.join(tmp, "publications.html"), files["publications.html"]);
      pythonNeeds(tmp, page);
      execFileSync("python3", [path.join(tmp, "tools", "build-arabic.py")], { stdio: "ignore" });
      const py = fs.readFileSync(path.join(tmp, "ar", "cv.html"), "utf8");
      ok(py === L.buildArabic("cv.html", page), "ar/cv.html (python) equals the JavaScript output: " + name + (py === L.buildArabic("cv.html", page) ? "" : " " + firstDiff(py, L.buildArabic("cv.html", page))));
      fs.rmSync(tmp, { recursive: true, force: true });
    });
  }

  // --- the real modules together, when their files are there
  I.setCV(undefined); I.setPortfolio(undefined);
  const off = process.env.DASH_CV === "off";
  if (off) { I.setCV(null); I.setPortfolio(null); }
  const hasPf = !off && !!I.getPortfolio() && fs.existsSync(path.join(ROOT, "portfolio.html"));
  const hasCv = !off && !!I.getCV() && fs.existsSync(path.join(ROOT, "cv.html"));
  console.log("  CASE RUN: real portfolio module " + (hasPf ? "present" : "absent") + ", real CV module " + (hasCv ? "present" : "absent") +
    (hasCv ? " (cv.html " + (/\sdata-ar="/.test(read("cv.html")) ? "carries" : "does not carry") + " Arabic texts)" : ""));
  const real = loadFiles();
  const rm = L.read(real);
  const rt = L.build(real, rm, { today: TODAY });
  eq(changed(rt), [], "real modules: an unchanged model changes nothing");
  eq(rt.warnings, [], "real modules: no warnings");
  if (hasPf) {
    ok(Array.isArray(rm.portfolio.trajectory) && rm.portfolio.trajectory.length > 0, "real portfolio module: read() returns the trajectory lines");
    const add = copy(rm);
    add.works = add.works.concat([NEW_WORK]);
    add.portfolio.trajectory.push("2027: a test line.");
    const ro = L.build(real, add, { today: TODAY });
    ok(typeof ro.files["portfolio.html"] === "string" && ro.files["portfolio.html"].indexOf("Trustworthy Agents for Clinical Triage") > 0 && ro.files["portfolio.html"].indexOf("2027: a test line.") > 0,
      "real portfolio module: a new work and an owner line reach portfolio.html");
    ok(ro.files["portfolio.html"].indexOf("5 January 2027") > 0, "real portfolio module: the new cutoff date is on the page");
    const site = overlay(real, ro);
    eq(changed(L.build(site, L.read(site), { today: TODAY })), [], "real portfolio module: stable after reading back");
    if (hasCv && /\sdata-ar="/.test(real["cv.html"])) ok(typeof ro.files["ar/cv.html"] === "string" && ro.files["ar/cv.html"] === L.buildArabic("cv.html", ro.files["cv.html"]), "real CV module: ar/cv.html follows cv.html");
  }
  I.setCV(null); I.setPortfolio(null);
}

/* ------------------------------------------------------------------ */
console.log("\n" + (failed ? "FAILED" : "OK") + ": " + passed + " checks passed" + (failed ? ", " + failed + " failed" : ""));
process.exit(failed ? 1 : 0);
