/* Tests for admin/lib.js and for the run-time counts of research-assistant.js.
   Run from anywhere:  node admin/tests/lib.test.js      (plain Node, no packages; exit code 1 on failure)
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
const loadFiles = () => { const f = {}; L.FILES.forEach((p) => { f[p] = read(p); }); return f; };
const overlay = (files, out) => Object.assign({}, files, out.files);
const inner = (html, name) => I.findBlock(html, name).inner;
const cardsOf = (html) => I.splitCards(inner(html, "dash:cards"));
const ldOf = (html) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
const dataOf = (js) => JSON.parse(js.slice(js.indexOf("{"), js.lastIndexOf("}") + 1));
const sorted = (list) => list.slice().sort();

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
eq(L.FILES, ["index.html", "publications.html", "research-data.js", "data/metrics.json", "sitemap.xml"], "FILES");
eq(L.THEMES.length, 6, "six themes");
eq(L.TYPES.map((t) => t.en), ["Journal article", "Conference paper", "Book chapter"], "types");
eq(L.FONTS.ar.map((f) => f.name), ["Noto Naskh Arabic", "IBM Plex Sans Arabic", "Tajawal", "Cairo", "Noto Kufi Arabic", "Almarai", "Readex Pro", "Amiri"], "Arabic fonts");
eq(L.FONTS.en.map((f) => f.name), ["Manrope", "Inter", "IBM Plex Sans", "Source Sans 3"], "English fonts");
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
eq(model.fonts, { ar: "IBM Plex Sans Arabic", en: "Manrope" }, "fonts");
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
  m.fonts = { ar: "Tajawal", en: "Source Sans 3" };
  const out = L.build(files, m, { today: TODAY });
  eq(sorted(Object.keys(out.files)), ["ar/index.html", "ar/publications.html", "index.html", "publications.html"], "changed files");
  const expected = '\n    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&family=Tajawal:wght@400;500;700&display=swap">' +
    '\n    <style>:root{--font-en:"Source Sans 3";--font-ar:"Tajawal";}</style>\n    ';
  eq(inner(out.files["index.html"], "dash:fonts"), expected, "fonts block (index.html)");
  eq(inner(out.files["publications.html"], "dash:fonts"), expected, "fonts block (publications.html)");
  ok(out.files["ar/index.html"].indexOf('--font-ar:"Tajawal"') > 0 && out.files["ar/publications.html"].indexOf('--font-ar:"Tajawal"') > 0, "Arabic pages carry the fonts");
  eq(out.files["index.html"].replace(expected, ""), files["index.html"].replace(inner(files["index.html"], "dash:fonts"), ""), "nothing else changed in index.html");
  eq(L.read(overlay(files, out)).fonts, m.fonts, "fonts read back");
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

/* ------------------------------------------------------------------ */
console.log("\n" + (failed ? "FAILED" : "OK") + ": " + passed + " checks passed" + (failed ? ", " + failed + " failed" : ""));
process.exit(failed ? 1 : 0);
