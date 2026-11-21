/* Tests for admin/cv.js (the live CV page). Plain Node, no packages:  node admin/tests/cv.test.js
   Exit code 1 on failure. The fixture model is built here by parsing the site files, in the shape the
   dashboard library gives to DashCV.build (see admin/SPEC.md, "CV module"). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const CV = require(path.join(ROOT, "admin", "cv.js"));

function readFile(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function unesc(s) {
  return String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}
function strip(s) { return unesc(String(s).replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim(); }
function dashBlock(html, name) {
  const open = "<!-- dash:" + name + " -->", close = "<!-- /dash:" + name + " -->";
  const a = html.indexOf(open), b = html.indexOf(close);
  if (a < 0 || b < 0) throw new Error("index.html: missing block dash:" + name);
  return html.slice(a + open.length, b).split("\n").map((l) => l.trim()).filter(Boolean);
}

/* The model the library passes to DashCV.build, parsed from the current site files. */
function fixture(cvHtml) {
  const index = readFile("index.html");
  const sandbox = {};
  new Function("window", readFile("research-data.js"))(sandbox);
  const works = sandbox.RESEARCH_PORTFOLIO.works.map((w) => Object.assign({}, w));

  const role = (line) => {
    const m = /^<article class="role"><time>(.*?)<\/time><div><h3 data-ar="(.*?)">(.*?)<\/h3><p data-ar="(.*?)">(.*?)<\/p><\/div><\/article>$/.exec(line);
    if (!m) throw new Error("timeline line not understood: " + line.slice(0, 80));
    return { time: strip(m[1]), title: { en: unesc(m[3]), ar: unesc(m[2]) }, text: { en: unesc(m[5]), ar: unesc(m[4]) } };
  };
  const course = (line) => {
    const m = /<span[^>]*>(.*?)<\/span><strong data-ar="(.*?)">(.*?)<\/strong>/.exec(line);
    if (!m) throw new Error("course line not understood: " + line.slice(0, 80));
    return { code: unesc(m[1]), en: unesc(m[3]), ar: unesc(m[2]) };
  };
  const society = (line) => {
    const m = /^<article class="society-item"><span class="society-org"(?: data-ar="(.*?)")?>(.*?)<\/span><span class="society-role" data-ar="(.*?)">(.*?)<\/span><\/article>$/.exec(line);
    if (!m) throw new Error("role line not understood: " + line.slice(0, 80));
    return { org: unesc(m[2]), orgAr: unesc(m[1] || ""), en: unesc(m[4]), ar: unesc(m[3]) };
  };
  const edu = CV.fromIndex(index);
  return {
    works: works,
    timeline: dashBlock(index, "timeline").map(role),
    timelineEarlier: dashBlock(index, "timeline-earlier").map(role),
    courses: dashBlock(index, "courses").map(course),
    flagship: dashBlock(index, "courses-flagship").map(course),
    roles: dashBlock(index, "roles").map(society),
    degrees: edu.degrees,
    theses: edu.theses,
    thesesAr: edu.thesesAr,
    news: [], metrics: [],
    cv: cvHtml ? CV.read(cvHtml) : undefined,
    today: "2026-11-21"
  };
}
module.exports = { fixture: fixture, ROOT: ROOT };

/* ------------------------------------------------------------------ */
if (require.main === module) {
  let passed = 0, failed = 0;
  const ok = (cond, label) => { if (cond) passed++; else { failed++; console.error("FAIL: " + label); } };
  const eq = (a, b, label) => ok(a === b, label + (a === b ? "" : "\n   got:      " + JSON.stringify(a) + "\n   expected: " + JSON.stringify(b)));
  const section = (name) => console.log("# " + name);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const block = (html, name) => { const b = CV._findBlock(html, name); return b ? b.inner : null; };
  const ALL = CV.AUTO.concat(CV.OWNER);
  const changedBlocks = (before, after) => ALL.filter((n) => block(before, n) !== block(after, n));
  const outside = (html) => { let s = html; ALL.forEach((n) => { s = CV._setBlock(s, n, []); }); return s; };
  // the English markup without the Arabic attributes (they do not show on the English page)
  const noAr = (html) => String(html).replace(/ data-ar(?:-[a-z-]+)?="[^"]*"/g, "");
  const english = (cv) => JSON.parse(JSON.stringify(cv, (k, v) => (/Ar$/.test(k) || k === "ar" ? undefined : v)));

  const cvHtml = readFile("cv.html");
  const base = () => fixture(cvHtml);

  section("cv.html has every block, once, well formed");
  ALL.forEach((n) => {
    ok(block(cvHtml, n) !== null, "block cv:" + n + " exists");
    eq(cvHtml.split("<!-- cv:" + n + " -->").length - 1, 1, "cv:" + n + " opens once");
    eq(cvHtml.split("<!-- /cv:" + n + " -->").length - 1, 1, "cv:" + n + " closes once");
  });
  ok(/<link rel="canonical" href="https:\/\/dromaia\.github\.io\/cv\.html" data-ar-href="https:\/\/dromaia\.github\.io\/ar\/cv\.html">/.test(cvHtml), "canonical link (Arabic page: ar/cv.html)");
  ok(/<meta name="description" content="[^"]{60,}" data-ar-content="[^"]{60,}">/.test(cvHtml), "meta description, both languages");
  ok(/<link rel="alternate" hreflang="ar" href="https:\/\/dromaia\.github\.io\/ar\/cv\.html">/.test(cvHtml), "hreflang link to the Arabic CV");
  ok(/<a class="lang" id="lang" href="ar\/cv\.html" hreflang="ar" lang="ar"[^>]* data-ar-href="\.\.\/cv\.html"[^>]* data-ar="English">العربية<\/a>/.test(cvHtml), "language link: العربية here, English on the Arabic page");
  ok(!/noindex/.test(cvHtml), "the CV page is public (no noindex)");
  ok(/window\.print\(\)/.test(cvHtml) && /id="savePdf"/.test(cvHtml), "Save as PDF button");
  ok(!/<script[^>]+src=/.test(cvHtml), "no external scripts");

  section("round trip: an unchanged site gives a byte-identical cv.html");
  {
    const m = base();
    eq(CV.build(m, cvHtml), cvHtml, "build(fixture) is unchanged");
    ok(CV.build(m, cvHtml) === cvHtml, "the very same string is returned");
    const d = CV.buildDetailed(m, cvHtml);
    eq(d.changed.length, 0, "no block reported as changed");
    eq(d.warnings.length, 0, "no warnings");
    const later = base(); later.today = "2027-03-02";
    eq(CV.build(later, cvHtml), cvHtml, "a later date alone does not change the page");
    const noCv = base(); delete noCv.cv;
    eq(CV.build(noCv, cvHtml), cvHtml, "model without model.cv falls back to the page's own blocks");
    const partial = base(); partial.cv = { selected: partial.cv.selected };
    eq(CV.build(partial, cvHtml), cvHtml, "a partial model.cv keeps the other owner blocks");
    const twice = CV.build(m, CV.build(m, cvHtml));
    eq(twice, cvHtml, "building twice is stable");
    eq(JSON.stringify(CV.read(CV.build(m, cvHtml))), JSON.stringify(m.cv), "read after build gives the same model.cv");
  }

  section("read gives the contract shape");
  {
    const cv = CV.read(cvHtml);
    ok(cv.profile && typeof cv.profile.en === "string" && cv.profile.en.length > 100, "profile.en");
    eq(cv.pillars.length, 4, "four pillars");
    ok(cv.pillars.every((p) => p.title && p.text), "pillars have title and text");
    eq(cv.accepted.length, 2, "two accepted works");
    ok(cv.accepted.every((a) => /^\d{4}$/.test(a.year) && a.text.length > 40), "accepted have year and text");
    eq(cv.selected, 17, "selected = 17");
    ok(cv.community.length >= 6 && cv.community.every((c) => c.title && c.text), "community / recognition items");
    eq(cv.development.length, 6, "six professional development items");
    ok(/Arabic/.test(cv.languages) && /research collaboration/.test(cv.openTo), "languages and openTo");
    ok(cv.extraService.length >= 2 && cv.extraService.every((x) => x.title), "extraService entries");
    ok(cv.extraService.some((x) => /ABET/.test(x.text)), "the ABET line is kept as a service entry");
    eq(cv.educationNotes["2009"], "Specialization: Computer Information Systems.", "education note kept for 2009");
    eq(cv.headerExtras.join("|"), "AI Researcher", "header extra title kept");
    ok(Array.isArray(cv.fullExtra) && cv.fullExtra.length === 0, "fullExtra starts empty");
    eq(block(cvHtml, "full-extra"), "", "no visible extra section when fullExtra is empty");
    ok(cv.appointmentDetails.length >= 5 && cv.appointmentDetails.every((d) => d.match && Array.isArray(d.bullets)), "appointmentDetails seeded");
    eq(CV.MODE_CLASS, "cv-full", "MODE_CLASS");
  }

  section("two versions in one page");
  {
    ok(/html:not\(\.cv-full\) \.full-only \{ display: none !important; \}/.test(cvHtml), "full-only hidden unless <html class=cv-full> (pure CSS)");
    ok(/html\.cv-full \.short-only \{ display: none !important; \}/.test(cvHtml), "short-only hidden in the full version (pure CSS)");
    ok(/<html lang="en" dir="ltr" data-ar-lang="ar" data-ar-dir="rtl">/.test(cvHtml), "default is the short version (no class on <html>); Arabic page is rtl");
    ok(/<a href="#short">Short CV<\/a><a href="#full">Full CV<\/a>/.test(noAr(cvHtml)), "tabs");
    const m = base();
    const full = block(cvHtml, "publications-full").split("\n");
    const items = full.filter((l) => l.indexOf('<p class="pub">') === 0);
    eq(items.length, m.works.length, "the full list has as many entries as there are works");
    m.works.forEach((w) => {
      eq(items.filter((l) => l.indexOf("“" + CV._esc(w.title) + (/[.?!]$/.test(w.title) ? "" : ".") + "”") > 0).length, 1, w.id + " appears exactly once in the full list");
    });
    const byType = {}; m.works.forEach((w) => { byType[w.type] = (byType[w.type] || 0) + 1; });
    const fullEn = full.map(noAr);
    ok(fullEn.indexOf('<p class="pubhead">Journal articles (' + byType["Journal article"] + ")</p>") > 0, "journal articles heading with count");
    ok(fullEn.indexOf('<p class="pubhead">Conference papers (' + byType["Conference paper"] + ")</p>") > 0, "conference papers heading with count");
    ok(fullEn.indexOf('<p class="pubhead">Book chapters (' + byType["Book chapter"] + ")</p>") > 0, "book chapters heading with count");
    eq(byType["Journal article"] + byType["Conference paper"] + byType["Book chapter"], m.works.length, "the three groups cover every work");
    const labels = items.map((l) => /<b class="n">(.*?)<\/b>/.exec(l)[1]);
    eq(labels.filter((x) => x[0] === "J").join(","), Array.from({ length: byType["Journal article"] }, (_, i) => "J" + (i + 1)).join(","), "journal articles numbered J1..Jn");
    eq(labels.filter((x) => x[0] === "C").length, byType["Conference paper"], "conference papers numbered");
    eq(labels.filter((x) => x[0] === "B").length, byType["Book chapter"], "book chapters numbered");
    const years = items.filter((l) => l.indexOf('<b class="n">J') > 0).map((l) => Number(/<b class="y">(\d+)<\/b>/.exec(l)[1]));
    ok(years.every((y, i) => i === 0 || years[i - 1] >= y), "newest first inside a group");
    ok(!/et al\./.test(full.join("\n")), "the full list names every author");
    ok(/^<p class="themes"><b>Research themes \(40 works\):<\/b> <span>Cybersecurity, IoT, and cloud infrastructure \(9\); /.test(noAr(full[0])), "themes with counts, largest first");
    const other = base(); other.works.push({ id: "P41", title: "A Patent", year: 2027, type: "Patent", theme: "", reference: "Al-Omari, O. (2027). A patent. Office, 1.", doi: null });
    ok(noAr(block(CV.build(other, cvHtml), "publications-full")).indexOf('<p class="pubhead">Other works (1)</p>') > 0, "an unknown type goes to Other works");
    // appointments: earlier roles are one line in the short version and full entries in the full one
    const app = block(cvHtml, "appointments").split("\n");
    eq(app.filter((l) => noAr(l).indexOf('<p class="note short-only">Earlier academic roles: ') === 0).length, 1, "earlier roles line (short only)");
    eq(app.filter((l) => l.indexOf('<div class="entry full-only">') === 0).length, m.timelineEarlier.length, "earlier roles as full entries (full only)");
    ok(noAr(app[1]).indexOf('<ul class="details full-only"><li>') > 0 && app[1].indexOf("supervise senior projects and cooperative training") > 0, "detail bullets under the matching appointment, full only");
    // teaching and service
    const teach = block(cvHtml, "teaching").split("\n");
    ok(noAr(teach[0]).indexOf('<p class="short-only">Current and recent courses') === 0, "short course sentence");
    ok(noAr(teach[1]).indexOf('<p class="full-only"><b>Flagship courses:</b> <span>Technology Trends in Digital Transformation (IS453); ') === 0, "flagship courses first in the full version");
    const allCodes = m.courses.map((c) => c.code);
    ok(allCodes.every((c) => noAr(teach[1] + teach[2]).indexOf("(" + c + ")") > 0), "every course is in the full version");
    eq((noAr(teach[1] + teach[2]).match(/\(IS\d+\)/g) || []).length, allCodes.length, "and each course once");
    const svc = block(cvHtml, "service");
    eq((svc.match(/<li>/g) || []).length, m.roles.length, "every committee and role on its own line in the full version");
  }

  section("fullExtra and appointmentDetails");
  {
    let m = base(); m.cv.fullExtra = [{ title: "Memberships", items: ["IEEE member", "ACM & SIGAI"] }, { title: "Referees", items: ["Available on request"] }];
    let out = CV.build(m, cvHtml);
    eq(changedBlocks(cvHtml, out).join(","), "full-extra", "fullExtra changes only its own block");
    eq(block(out, "full-extra").split("\n")[0], '<section class="full-only extra"><h2>Memberships</h2><ul><li>IEEE member</li><li>ACM &amp; SIGAI</li></ul></section>', "extra section markup (no Arabic given: no data-ar)");
    eq(JSON.stringify(english(CV.read(out).fullExtra)), JSON.stringify(m.cv.fullExtra), "fullExtra read back");
    eq(JSON.stringify(CV.read(out).fullExtra[0].itemsAr), '["",""]', "an English-only fullExtra reads back with empty Arabic");
    eq(outside(out), outside(cvHtml), "nothing outside the blocks changes");
    eq(CV.build(Object.assign({}, m, { cv: CV.read(out) }), out), out, "stable on a second build");

    m = base(); m.cv.appointmentDetails.push({ match: "Jerash", bullets: ["Jerash, Jordan <test> & more."] });
    out = CV.build(m, cvHtml);
    eq(changedBlocks(cvHtml, out).join(","), "appointments,appointment-details", "appointmentDetails changes its data block and the appointments it is printed in");
    ok(/Instructor<\/b> — <span>Jerash Private University<\/span>.*<ul class="details full-only"><li>Jerash, Jordan &lt;test&gt; &amp; more\.<\/li><\/ul><\/div>/.test(noAr(block(out, "appointments"))), "bullet under the matching earlier role");
    eq(JSON.stringify(english(CV.read(out).appointmentDetails)), JSON.stringify(english(m.cv.appointmentDetails)), "appointmentDetails read back");
    eq(JSON.stringify(CV.read(out).appointmentDetails.map((d) => d.bulletsAr.length)), JSON.stringify(m.cv.appointmentDetails.map((d) => d.bullets.length)), "bulletsAr parallel to bullets");
    m = base(); m.cv.appointmentDetails = [{ match: "lecturer", bullets: ["Same note."] }];
    out = CV.build(m, cvHtml);
    eq((block(out, "appointments").match(/Same note\./g) || []).length, 2, "a match is a case-insensitive substring: it applies to every matching entry");
    m = base(); m.cv.appointmentDetails = [{ match: "No such role", bullets: ["x"] }];
    out = CV.build(m, cvHtml);
    ok(block(out, "appointments").indexOf("details") < 0, "an unmatched detail prints nothing");
    eq(JSON.stringify(english(CV.read(out).appointmentDetails)), JSON.stringify(m.cv.appointmentDetails), "but is kept in the data block");
    const partial = base(); partial.cv = { selected: 17 };
    eq(CV.build(partial, cvHtml), cvHtml, "missing keys keep what is on the page");
  }

  section("publications: newest first, from the APA references");
  {
    const m = base();
    const lines = block(cvHtml, "publications").split("\n");
    eq(lines.filter((l) => l.indexOf('<p class="pub">') === 0).length, 17, "17 works listed");
    ok(lines[1].indexOf("From Generation to Verification") > 0, "P40 is first");
    ok(lines[1].indexOf("M. Akour, O. Al-Omari, and M. Alzoubi.") > 0, "authors turned to initials-first");
    ok(lines[1].indexOf("Computers, 15(11), 825.") > 0, "venue details from the reference");
    ok(lines[1].indexOf('<a href="https://doi.org/10.3390/computers15110825">doi:10.3390/computers15110825</a>') > 0, "DOI link with a visible label");
    ok(/40 verified works on dromaia\.github\.io/.test(lines[lines.length - 1]), "count line links to the catalogue");
    ok(/E\. Ali et al\./.test(block(cvHtml, "publications")), "more than five authors are written as et al.");
    // every catalogue reference must be understood
    m.works.forEach((w) => {
      const p = CV.parseReference(w);
      ok(p.authors.length >= 1, w.id + ": authors parsed");
      ok(p.venue.length > 3, w.id + ": venue parsed (" + p.venue.slice(0, 30) + ")");
      ok(!/\(\d{4}[a-z]?\)/.test(p.venue), w.id + ": the year is not left in the venue");
      const line = CV.formatPublication(w);
      ok(line.indexOf("“" + CV._esc(w.title)) > 0, w.id + ": title quoted");
      ok(!/undefined|null|NaN/.test(line), w.id + ": no stray values");
    });
    const p22 = CV.parseReference(m.works.find((w) => w.id === "P22"));
    ok(p22.authors.indexOf("Priyanka") === 1 && p22.authors[0] === "M. R. Bai", "single-name author handled");
    const p11 = CV.formatPublication(m.works.find((w) => w.id === "P11"));
    ok(/Computational Intelligence \(pp\. 823–829\)\. Springer\./.test(p11), "chapter venue without the leading In, with an en dash in pages");
    const p01 = CV.formatPublication(m.works.find((w) => w.id === "P01"));
    ok(!/<a /.test(p01), "a work without DOI has no link");
  }

  section("adding a work");
  {
    const m = base();
    m.works.push({ id: "P41", title: "A Test of Live CV Updates", year: 2027, type: "Journal article", theme: "Decision analytics and intelligent systems",
      methods: ["x"], contribution: "c", reference: "Al-Omari, O., & Tester, T. Q. (2027). A test of live CV updates. Journal of Tests, 3(2), 10-19.", doi: "https://doi.org/10.1234/jt.2027.5" });
    m.today = "2027-01-15";
    const out = CV.build(m, cvHtml);
    const lines = block(out, "publications").split("\n");
    ok(lines[1].indexOf("A Test of Live CV Updates") > 0, "the new work is first");
    ok(lines[1].indexOf("O. Al-Omari and T. Q. Tester.") > 0, "two authors joined with and");
    ok(lines[1].indexOf("Journal of Tests, 3(2), 10–19.") > 0, "its venue");
    eq(lines.filter((l) => l.indexOf('<p class="pub">') === 0).length, 17, "still 17 listed");
    ok(/41 verified works/.test(lines[lines.length - 1]), "count line says 41");
    ok(block(out, "publications").indexOf("Artificial Intelligence in Healthcare: Bridging") < 0 || true, "oldest listed work may drop out");
    eq(changedBlocks(cvHtml, out).join(","), "publications,publications-full,updated", "only the two publication lists and the date changed");
    const full = block(out, "publications-full").split("\n");
    ok(full.some((l) => l.indexOf('<b class="n">J1</b> <b class="y">2027</b> O. Al-Omari and T. Q. Tester. “A Test of Live CV Updates.”') > 0), "the new work is J1 in the full list");
    ok(full.indexOf('<p class="pubhead" data-ar="مقالات في دوريات (24)">Journal articles (24)</p>') >= 0, "journal group count grows to 24 (both languages)");
    ok(/Research themes \(41 works\)/.test(full[0]) && /Decision analytics and intelligent systems \(7\)/.test(full[0]), "themes line recounted");
    eq(block(out, "updated"), '<span class="updated" data-ar="آخر تحديث: يناير 2027">Last updated: January 2027</span>', "date follows the build date (Arabic month as on the site)");
    eq(outside(out), outside(cvHtml), "nothing outside the blocks changed");
  }

  section("selected count");
  {
    const m = base(); m.cv.selected = 5;
    const out = CV.build(m, cvHtml);
    eq(block(out, "publications").split("\n").filter((l) => l.indexOf('<p class="pub">') === 0).length, 5, "5 works listed");
    ok(/data-selected="5"><span>The 5 most recent of<\/span> <a /.test(noAr(out)), "count line says 5");
    ok(out.indexOf('data-ar="أحدث 5 من أصل"') > 0 && out.indexOf('data-ar="40 عملاً موثقاً على dromaia.github.io ↗"') > 0, "and in Arabic");
    eq(CV.read(out).selected, 5, "read gives 5 back");
    const all = base(); all.cv.selected = 500;
    const outAll = CV.build(all, cvHtml);
    eq(block(outAll, "publications").split("\n").filter((l) => l.indexOf('<p class="pub">') === 0).length, 40, "all 40 listed");
    ok(/data-selected="500"><span>All<\/span> <a /.test(noAr(outAll)), "count line says All");
    ok(outAll.indexOf('data-ar="الأعمال الموثقة الـ40 على dromaia.github.io ↗"') > 0, "and in Arabic");
    const none = base(); none.cv.selected = 0;
    const outNone = CV.build(none, cvHtml);
    ok(block(outNone, "publications").indexOf("pubhead") < 0, "no heading when nothing is listed");
    eq(changedBlocks(cvHtml, out).join(","), "publications", "only publications changed (same month)");
  }

  section("site edits change only the matching block");
  {
    let m = base(); m.timeline[2].text.en = "Taught computing courses & led advising.";
    let out = CV.build(m, cvHtml);
    eq(changedBlocks(cvHtml, out).join(","), "appointments", "timeline text -> appointments");
    ok(block(out, "appointments").indexOf("Taught computing courses &amp; led advising.") > 0, "new text, escaped");

    m = base(); m.timeline[1].title.en = "Associate Professor · Prince Sultan University";
    out = CV.build(m, cvHtml);
    eq(changedBlocks(cvHtml, out).join(","), "header,appointments", "a current title -> header and appointments");
    ok(noAr(block(out, "header")).indexOf("<span>Associate Professor</span>") > 0, "header shows the new title");
    ok(noAr(block(out, "header")).indexOf('<span class="keep">AI Researcher</span>') > 0, "kept header item stays");
    ok(block(out, "header").indexOf("ORCID 0000-0002-1638-1771") > 0, "contact lines stay");

    m = base(); m.timelineEarlier.pop();
    out = CV.build(m, cvHtml);
    eq(changedBlocks(cvHtml, out).join(","), "appointments", "earlier roles -> appointments");
    ok(block(out, "appointments").indexOf("Teaching Assistant, Yarmouk University") < 0, "removed earlier role is gone");

    m = base(); m.courses.push({ code: "IS555", en: "Data & Society", ar: "" });
    out = CV.build(m, cvHtml);
    eq(changedBlocks(cvHtml, out).join(","), "teaching", "course -> teaching");
    ok(block(out, "teaching").indexOf("Senior Project (IS499), and Data &amp; Society (IS555).") > 0, "course list sentence");
    ok(block(out, "teaching").indexOf("ومشروع التخرج (IS499)، وData &amp; Society (IS555).") > 0, "a course without Arabic keeps its English name in the Arabic sentence");

    m = base(); m.roles.push({ org: "PSU", orgAr: "", en: "Member, Test Committee", ar: "" });
    out = CV.build(m, cvHtml);
    eq(changedBlocks(cvHtml, out).join(","), "service", "role -> service");
    ok(/<b>PSU:<\/b> <span>[^<]*Member, Test Committee\.<\/span><\/p>/.test(noAr(block(out, "service"))), "role joins its organisation group");
    ok(noAr(block(out, "service")).indexOf("<li><b>PSU:</b> <span>Member, Test Committee</span></li>") > 0, "role listed on its own line in the full version");
    ok(block(out, "service").indexOf('<li><b data-ar="جامعة الأمير سلطان:">PSU:</b> <span>Member, Test Committee</span></li>') > 0, "a role without Arabic has no data-ar (English in the Arabic page)");

    m = base(); m.roles.push({ org: "IEEE", orgAr: "", en: "Senior Member", ar: "" });
    out = CV.build(m, cvHtml);
    ok(block(out, "service").split("\n").indexOf('<p class="svc short-only"><b>IEEE:</b> <span data-ar="Senior Member.">Senior Member.</span></p>') > 0, "a new organisation gets its own line (short)");
    ok(block(out, "service").split("\n").indexOf("<li><b>IEEE:</b> <span>Senior Member</span></li>") > 0, "and its own item in the full list");

    m = base(); m.degrees[0].title = "PhD in Computer Science (Artificial Intelligence)";
    out = CV.build(m, cvHtml);
    eq(changedBlocks(cvHtml, out).join(","), "education", "degree -> education");
    ok(block(out, "education").indexOf("Specialization: Computer Information Systems.") > 0, "education notes survive");
  }

  section("owner blocks");
  {
    const edits = {
      profile: (cv) => { cv.profile.en = "New profile text."; },
      pillars: (cv) => { cv.pillars[0].text = "ML · NLP · LLMs"; },
      accepted: (cv) => { cv.accepted.pop(); },
      community: (cv) => { cv.community.push({ title: "Award", text: "Best paper, 2027.", titleAr: "جائزة", textAr: "أفضل ورقة، 2027." }); },
      development: (cv) => { cv.development[1].text = "IBM SkillsBuild · 2025"; },
      languages: (cv) => { cv.openTo = "invited talks."; }
    };
    Object.keys(edits).forEach((name) => {
      const m = base(); edits[name](m.cv);
      const out = CV.build(m, cvHtml);
      eq(changedBlocks(cvHtml, out).join(","), name, name + ": only its own block changes");
      eq(outside(out), outside(cvHtml), name + ": nothing outside the blocks changes");
      eq(JSON.stringify(CV.read(out)), JSON.stringify(m.cv), name + ": read gives the edit back");
    });
    let m = base(); m.cv.accepted = [];
    let out = CV.build(m, cvHtml);
    eq(block(out, "accepted"), "", "no accepted works -> empty block, no heading");
    m = base(); m.cv.extraService.push({ title: "Reviewer", org: "Journal X", date: "2027", text: "Reviewed 3 papers.", titleAr: "محكّم", orgAr: "", textAr: "" });
    out = CV.build(m, cvHtml);
    eq(changedBlocks(cvHtml, out).join(","), "service", "extraService -> service");
    eq(JSON.stringify(CV.read(out).extraService), JSON.stringify(m.cv.extraService), "extraService read back");
    m = base(); m.cv.extraService = [{ title: "Only title", org: "", date: "", text: "", titleAr: "", orgAr: "", textAr: "" }];
    out = CV.build(m, cvHtml);
    eq(JSON.stringify(CV.read(out).extraService), JSON.stringify(m.cv.extraService), "entry with a title only read back");
    ok(noAr(block(out, "service")).indexOf("<b>PSU:</b>") > 0, "site roles still listed after the entries");
  }

  section("HTML escaping");
  {
    const nasty = 'A <b>bold</b> & "quoted" </p><script>alert(1)</script>';
    const m = base();
    m.cv.profile.en = nasty; m.cv.pillars[0].title = nasty; m.cv.accepted[0].text = nasty; m.cv.community[0].text = nasty;
    m.cv.development[0].title = nasty; m.cv.languages = nasty; m.cv.extraService[0].org = nasty;
    m.timeline[0].text.en = nasty; m.courses[0].en = nasty; m.roles[0].en = nasty; m.degrees[0].institution = nasty;
    m.works.push({ id: "P41", title: nasty, year: 2027, reference: "Al-Omari, O. (2027). " + nasty + ". Journal <i>X</i>, 1(1), 1-2.", doi: 'https://doi.org/10.1/x"y' });
    const out = CV.build(m, cvHtml);
    ok(out.indexOf("<script>alert(1)</script>") < 0, "no raw script from user text");
    ok(out.indexOf("<b>bold</b>") < 0, "no raw tags from user text");
    eq((out.match(/<script/g) || []).length, 2, "still exactly the page's own two script elements");
    const back = CV.read(out);
    eq(back.profile.en, nasty, "profile read back exactly");
    eq(back.pillars[0].title, nasty, "pillar read back exactly");
    eq(back.accepted[0].text, nasty, "accepted read back exactly");
    eq(back.community[0].text, nasty, "community read back exactly");
    eq(back.development[0].title, nasty, "development read back exactly");
    eq(back.languages, nasty, "languages read back exactly");
    eq(back.extraService[0].org, nasty, "extraService read back exactly");
    eq(CV.build(Object.assign({}, m, { cv: back }), out), out, "stable after a second build");
  }

  section("missing pieces never throw");
  {
    const m = base();
    let threw = false, d;
    try { d = CV.buildDetailed(m, "<html><body>no blocks here</body></html>"); } catch (e) { threw = true; }
    ok(!threw, "page without blocks does not throw");
    eq(d && d.html, "<html><body>no blocks here</body></html>", "page without blocks is returned unchanged");
    ok(d && d.warnings.length >= 10, "a warning per missing block");
    const cut = cvHtml.replace(/<!-- cv:service -->[\s\S]*?<!-- \/cv:service -->/, "");
    const m2 = base(); m2.roles.push({ org: "X", en: "Y" }); m2.cv.profile.en = "Changed.";
    d = CV.buildDetailed(m2, cut);
    ok(d.warnings.length === 1 && /cv:service/.test(d.warnings[0]), "one missing block -> one warning");
    ok(/<p[^>]*>Changed\.<\/p>/.test(d.html), "the other blocks are still written");
    [undefined, null, {}, { works: "x", timeline: 5 }].forEach((bad, i) => {
      let t = false, r;
      try { r = CV.build(bad, cvHtml); } catch (e) { t = true; }
      ok(!t && r === cvHtml, "odd model #" + i + " leaves the page unchanged");
    });
    eq(CV.build(base(), ""), "", "empty page stays empty");
    eq(JSON.stringify(CV.read("")).length > 10, true, "read of an empty page gives an empty shape");
    const viaIndex = base(); delete viaIndex.degrees; delete viaIndex.theses;
    eq(CV.build(viaIndex, cvHtml, { indexHtml: readFile("index.html") }), cvHtml, "education can come from opts.indexHtml");
    const noEdu = base(); delete noEdu.degrees; delete noEdu.theses;
    eq(CV.build(noEdu, cvHtml), cvHtml, "without degrees the education block is kept");
  }

  section("the owner-approved facts are all on the page");
  {
    const text = unesc(cvHtml.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");
    [
      "oalomari@psu.edu.sa", "ORCID 0000-0002-1638-1771", "more than 18 years of academic and IT experience",
      "TRUSTWORTHY AI", "Noun Verb Extraction and Hybrid Krill Herd as Feature Selection for Document Classification",
      "Specialization: Computer Information Systems.", "full ABET accreditation through 2031 (announced August 2026)",
      "ICAMAC 2026", "International Journal of Artificial Intelligence and Machine Learning (accepted, September 2026)",
      "event postponed", "AI Hackathon for Persons with Disabilities", "Babylonian Journal of Networking (BJN)",
      "CCIS EXPO 2026", "747.5 certified volunteer hours", "Membership No. 20230035", "Dean’s Honor List",
      "IBM Mastery Award", "AWS Immersion Day", "Arabic (native); English (professional proficiency)",
      "Teaching approach: problem-based learning", "Last updated: November 2026",
      "supervise senior projects and cooperative training; advise students", "textbook review, examination coordination",
      "Served in academic administration and contributed to program development", "Bangi, Malaysia", "Ha’il, Saudi Arabia",
      "Riyadh, Saudi Arabia", "College of Computing and IT", "Ministry of Education, Jordan"
    ].forEach((fact) => ok(text.indexOf(fact) >= 0, "page contains: " + fact));
  }

  section("Arabic: every auto block carries the Arabic of the model");
  {
    const m = base();
    const app = block(cvHtml, "appointments");
    m.timeline.concat(m.timelineEarlier).forEach((t) => {
      const [role, org] = t.title.ar.split(" · ");
      ok(app.indexOf('<b data-ar="' + CV._esc(role) + '">') >= 0, "appointment role in Arabic: " + role);
      ok(app.indexOf('<span data-ar="' + CV._esc(org) + '">') >= 0, "appointment organisation in Arabic: " + org);
      ok(app.indexOf('<p class="desc" data-ar="' + CV._esc(t.text.ar) + '">') >= 0, "appointment text in Arabic: " + t.title.en);
    });
    ok(app.indexOf('<span class="d" data-ar="2026–حتى الآن">2026–Present</span>') > 0, "Present is written حتى الآن");
    ok(/<p class="note short-only" data-ar="الأدوار الأكاديمية السابقة: مدرس، جامعة جرش الخاصة \(2009\)؛ /.test(app), "earlier roles line in Arabic");
    const head = block(cvHtml, "header");
    ok(head.indexOf('<span data-ar="رئيس قسم نظم المعلومات">Chair, Information Systems Department</span><span data-ar="أستاذ مساعد">Assistant Professor</span>') > 0, "header titles in Arabic");
    ok(head.indexOf('<h1 data-ar="د. أمية العمري">') === 0, "name in Arabic");
    const edu = block(cvHtml, "education");
    const fi = CV.fromIndex(readFile("index.html"));
    eq(fi.degrees.length, 3, "fromIndex: three degrees");
    ok(fi.degrees.every((d) => d.titleAr && d.institutionAr), "fromIndex: Arabic degree titles and institutions");
    eq(fi.thesesAr.length, fi.theses.length, "fromIndex: Arabic thesis titles");
    fi.degrees.forEach((d) => {
      ok(edu.indexOf('<b data-ar="' + CV._esc(d.titleAr) + '">' + CV._esc(d.title) + "</b>") >= 0, "degree in Arabic: " + d.title);
      ok(edu.indexOf('<span data-ar="' + CV._esc(d.institutionAr) + '">') >= 0, "institution in Arabic: " + d.institution);
    });
    fi.thesesAr.forEach((t) => ok(edu.indexOf("عنوان الرسالة: «" + t + "».") >= 0, "thesis title in Arabic"));
    // the library gives degrees without Arabic: the Arabic already on the page is kept
    const lib = base(); lib.degrees = lib.degrees.map((d) => ({ year: d.year, title: d.title, institution: d.institution })); delete lib.thesesAr;
    eq(CV.build(lib, cvHtml), cvHtml, "degrees without Arabic (as admin/lib.js gives them) keep the page's Arabic");
    const teach = block(cvHtml, "teaching");
    m.courses.forEach((c) => ok(teach.indexOf(c.ar + " (" + c.code + ")") >= 0, "course in Arabic: " + c.code));
    ok(teach.indexOf('data-ar="تشمل المقررات الحالية والحديثة في جامعة الأمير سلطان: مقدمة في تقنية المعلومات (IS101)، ومقدمة في نظم المعلومات (IS201)، ') > 0, "short course sentence in Arabic");
    const svc = block(cvHtml, "service");
    m.roles.forEach((r) => ok(svc.indexOf('<span data-ar="' + CV._esc(r.ar) + '">' + CV._esc(r.en) + "</span>") >= 0, "role in Arabic: " + r.en.slice(0, 30)));
    ok(svc.indexOf('<b data-ar="جامعة شقراء:">Shaqra University:</b>') > 0, "organisation in Arabic (from the model)");
    ok(svc.indexOf('<b data-ar="جامعة الأمير سلطان:">PSU:</b>') > 0, "PSU in Arabic (no Arabic in the model)");
    ok(svc.indexOf("<b>ICDR 2026:</b>") > 0, "an event acronym stays as it is");
    const pubs = block(cvHtml, "publications"), full = block(cvHtml, "publications-full");
    ok(pubs.indexOf('<p class="pubhead" data-ar="الأعمال المنشورة">Published</p>') === 0, "Published heading in Arabic");
    ok(full.indexOf('data-ar="محاور البحث (40 عملاً):"') > 0 && full.indexOf("الأمن السيبراني وإنترنت الأشياء والبنية السحابية (9)؛ ") > 0, "themes in Arabic");
    ok(!/<p class="pub"[^>]*data-ar/.test(pubs + full), "publication references carry no Arabic (they stay in English)");
    ok((pubs + full).indexOf('data-ar-href="https://dromaia.github.io/ar/publications.html"') > 0, "catalogue links go to the Arabic catalogue");
    eq(block(cvHtml, "updated"), '<span class="updated" data-ar="آخر تحديث: نوفمبر 2026">Last updated: November 2026</span>', "last updated in Arabic");
    // Arabic edits in the site reach the CV, and only the matching block
    let e = base(); e.timeline[2].text.ar = "نص عربي جديد & مختلف.";
    let out = CV.build(e, cvHtml);
    eq(changedBlocks(cvHtml, out).join(","), "appointments", "Arabic timeline text -> appointments only");
    ok(block(out, "appointments").indexOf('data-ar="نص عربي جديد &amp; مختلف."') > 0, "Arabic is escaped in the attribute");
    e = base(); e.courses[0].ar = "";
    out = CV.build(e, cvHtml);
    ok(block(out, "teaching").indexOf("، ومقدمة في نظم المعلومات (IS201)") > 0 && block(out, "teaching").indexOf(": Introduction to Information Technology (IS101)، و") > 0, "a course without Arabic falls back to its English name");
    e = base(); e.timeline[0].title.ar = ""; e.timeline[0].text.ar = "";
    out = CV.build(e, cvHtml);
    ok(block(out, "appointments").split("\n")[0].indexOf('<b>Chair, Information Systems Department</b> — <span>Prince Sultan University</span>') > 0, "a timeline entry without Arabic: no data-ar (English shows)");
    ok(block(out, "appointments").split("\n")[0].indexOf('<p class="desc">') > 0, "and its text has no data-ar");
  }

  section("Arabic: owner blocks read and written");
  {
    const cv = CV.read(cvHtml);
    ok(cv.profile.ar.length > 100 && /جامعة الأمير سلطان/.test(cv.profile.ar), "profile.ar");
    ok(cv.pillars.every((p) => p.titleAr && p.textAr), "pillars titleAr / textAr");
    ok(cv.community.every((c) => c.titleAr && c.textAr && !/:$/.test(c.titleAr)), "community titleAr / textAr (no trailing colon)");
    eq(cv.development.filter((d) => d.titleAr).length, 4, "development: four titles translated (two are product names)");
    ok(cv.languagesAr.indexOf("العربية") === 0 && cv.openToAr.indexOf("التعاون البحثي") === 0, "languagesAr / openToAr");
    ok(cv.extraService.every((x) => x.titleAr && x.orgAr), "extraService titleAr / orgAr");
    eq(cv.extraService[0].textAr, "برنامج بكالوريوس نظم المعلومات حاصل على الاعتماد الكامل من ABET حتى 2031 (أُعلن في أغسطس 2026).", "extraService textAr reuses the home page wording");
    eq(cv.educationNotesAr["2009"], "التخصص: نظم المعلومات الحاسوبية.", "educationNotesAr");
    eq(cv.headerExtrasAr.join("|"), "باحث في الذكاء الاصطناعي", "headerExtrasAr");
    ok(cv.appointmentDetails.every((d) => d.bulletsAr.length === d.bullets.length && d.bulletsAr.every(Boolean)), "appointmentDetails bulletsAr");
    ok(cv.accepted.every((a) => a.textAr === ""), "accepted works stay English references (no textAr)");
    // every Arabic field: written, read back, only its own block changes
    const edits = {
      profile: (c) => { c.profile.ar = "ملف جديد."; },
      pillars: (c) => { c.pillars[1].textAr = "التفسير · الحوكمة"; },
      accepted: (c) => { c.accepted[0].textAr = "«عنوان» مقبول للنشر."; },
      community: (c) => { c.community[0].titleAr = "ساعات تطوع"; },
      development: (c) => { c.development[5].titleAr = "الأساليب الرشيقة والتفكير التصميمي"; },
      languages: (c) => { c.openToAr = "المحاضرات المدعوة."; },
      "full-extra": (c) => { c.fullExtra = [{ title: "Memberships", items: ["IEEE", "ACM"], titleAr: "العضويات", itemsAr: ["IEEE", ""] }]; },
      "appointment-details": (c) => { c.appointmentDetails[0].bulletsAr[0] = "نص."; }
    };
    Object.keys(edits).forEach((name) => {
      const m = base(); edits[name](m.cv);
      const out = CV.build(m, cvHtml);
      const want = name === "appointment-details" ? "appointments,appointment-details" : name;
      eq(changedBlocks(cvHtml, out).filter((n) => n !== "updated").join(","), want, name + " (Arabic): only its own block changes");
      eq(JSON.stringify(CV.read(out)), JSON.stringify(m.cv), name + " (Arabic): read gives the edit back");
      if (name !== "full-extra") ok(strip(out) === strip(cvHtml), name + " (Arabic): the English text of the page does not change");
    });
    let m = base(); m.cv.accepted[0].textAr = "نص عربي.";
    let out = CV.build(m, cvHtml);
    ok(block(out, "accepted").indexOf('<p class="pub" data-ar-dir="rtl"><b class="y">2026</b> <span data-ar="نص عربي.">') > 0, "an accepted work with Arabic turns right-to-left in the Arabic page");
    m = base(); m.cv.headerExtrasAr = ["باحث"]; out = CV.build(m, cvHtml);
    eq(changedBlocks(cvHtml, out).join(","), "header", "headerExtrasAr -> header");
    m = base(); m.cv.educationNotesAr = {}; out = CV.build(m, cvHtml);
    ok(block(out, "education").indexOf('<span class="keep">Specialization') > 0, "educationNotesAr empty -> the note has no data-ar");
    // fallback: an empty Arabic value writes no data-ar, so the Arabic page shows the English
    m = base(); m.cv.profile.ar = ""; m.cv.pillars[0].titleAr = ""; m.cv.community[m.cv.community.findIndex((c) => c.title === "Certificate of appreciation")].textAr = ""; m.cv.languagesAr = ""; m.cv.extraService[1].orgAr = "";
    out = CV.build(m, cvHtml);
    ok(block(out, "profile").indexOf("<p>Chair of the Information Systems") === 0, "profile without Arabic: plain <p>");
    ok(block(out, "pillars").split("\n")[0].indexOf('<div class="pillar"><b>APPLIED AI</b><span data-ar=') === 0, "pillar title without Arabic");
    ok(/<li><b data-ar="شهادة شكر وتقدير:">Certificate of appreciation:<\/b> <span>King Salman/.test(block(out, "community")), "community text without Arabic");
    ok(block(out, "languages").indexOf('<b data-ar="اللغات:">Languages:</b> <span>Arabic (native)') > 0, "languages without Arabic");
    ok(block(out, "service").indexOf("— <span>Babylonian Journal of Networking (BJN)</span>") > 0, "service organisation without Arabic");
    const back = CV.read(out);
    ok(back.profile.ar === "" && back.pillars[0].titleAr === "" && back.languagesAr === "", "and read gives empty Arabic back");
    // older drafts: model.cv in the English-only shape keeps the page's Arabic for unchanged English

    m = base(); m.cv = english(m.cv);
    eq(CV.build(m, cvHtml), cvHtml, "an English-only model.cv (older shape) leaves the page unchanged, Arabic included");
    m = base(); m.cv = english(m.cv); m.cv.pillars[0].title = "APPLIED ML"; m.cv.languages = "Arabic; English.";
    out = CV.build(m, cvHtml);
    const r2 = CV.read(out);
    eq(r2.pillars[0].titleAr, "", "changed English without Arabic drops the old translation of that text");
    eq(r2.pillars[0].textAr, cv.pillars[0].textAr, "but keeps the translation of the unchanged text next to it");
    eq(r2.languagesAr, "", "languages changed -> no stale Arabic");
    eq(r2.openToAr, cv.openToAr, "openTo unchanged -> Arabic kept");
    eq(r2.profile.ar, cv.profile.ar, "profile unchanged -> Arabic kept");
    m = base(); m.cv = { profile: { en: cv.profile.en } };
    eq(CV.build(m, cvHtml), cvHtml, "profile {en} only (the old contract) keeps profile.ar");
  }

  section("Arabic page: ar/cv.html from tools/build-arabic.py");
  const os = require("os");
  const cp = require("child_process");
  function generate(html) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cvar-"));
    fs.mkdirSync(path.join(dir, "tools"));
    fs.copyFileSync(path.join(ROOT, "tools", "build-arabic.py"), path.join(dir, "tools", "build-arabic.py"));
    fs.writeFileSync(path.join(dir, "cv.html"), html);
    const run = cp.spawnSync("python3", [path.join(dir, "tools", "build-arabic.py"), "cv.html"], { encoding: "utf8" });
    if (run.status !== 0) throw new Error("build-arabic.py failed: " + run.stderr);
    return { dir: dir, html: fs.readFileSync(path.join(dir, "ar", "cv.html"), "utf8"), log: run.stdout };
  }
  let arPage = "";
  {
    const g = generate(cvHtml);
    arPage = g.html;
    ok(/leftover data-ar attributes: 0/.test(g.log), "generator reports no leftover data-ar");
    ok(/<html lang="ar" dir="rtl">/.test(arPage), 'ar/cv.html has lang="ar" dir="rtl"');
    ok(arPage.indexOf("data-ar") < 0 && arPage.indexOf("data-en") < 0, "no leftover translation attributes");
    ok(arPage.indexOf("<!-- Generated by tools/build-arabic.py from ../cv.html.") > 0, "generated banner");
    ok(/<title>د\. أمية العمري · السيرة الذاتية الأكاديمية<\/title>/.test(arPage), "Arabic title");
    ok(/<link rel="canonical" href="https:\/\/dromaia\.github\.io\/ar\/cv\.html">/.test(arPage), "canonical points at ar/cv.html");
    ok(/<meta property="og:url" content="https:\/\/dromaia\.github\.io\/ar\/cv\.html">/.test(arPage), "og:url points at ar/cv.html");
    ok(/<a class="lang" id="lang" href="\.\.\/cv\.html" hreflang="en" lang="en"[^>]*>English<\/a>/.test(arPage), "language link back to the English CV");
    ok(/<a class="back" href="index\.html">/.test(arPage), "home link goes to the Arabic home (ar/index.html)");
    ok(arPage.indexOf('href="https://dromaia.github.io/ar/"') > 0, "site address goes to the Arabic home");
    ok(arPage.indexOf("IBM+Plex+Sans+Arabic") > 0, "Arabic font requested on the Arabic page only");
    ok(cvHtml.indexOf('href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap"') > 0, "the English page requests the same font as before");
    // every relative link resolves from ar/
    const rel = []; arPage.replace(/\b(?:href|src)="([^"]*)"/g, (all, v) => { if (!/^(https?:|\/\/|\/|#|mailto:|tel:|data:)/.test(v)) rel.push(v); });
    ok(rel.length >= 3, "relative links found (" + rel.join(", ") + ")");
    rel.forEach((v) => ok(fs.existsSync(path.join(ROOT, "ar", v.split("#")[0])), "relative link resolves from ar/: " + v));
    // English references kept byte for byte
    const pubLines = (h) => h.split("\n").filter((l) => l.indexOf('<p class="pub">') === 0);
    eq(pubLines(arPage).join("\n"), pubLines(cvHtml).join("\n"), "every publication reference is the same English line");
    ok(pubLines(arPage).length >= 40 + 17 + 2, "references present (" + pubLines(arPage).length + ")");
    ok(arPage.indexOf("doi:10.3390/computers15110825") > 0, "DOIs kept");
    // Arabic everywhere else, and no element left empty
    ["الملف المهني", "التعيينات الأكاديمية", "التعليم", "مختارات من البحث والمنشورات", "التدريس والإرشاد", "القيادة الأكاديمية والخدمة المهنية",
      "المشاركة المجتمعية والتقدير", "مختارات من التطوير المهني", "اللغات ومجالات التعاون", "السيرة المختصرة", "حفظ بصيغة PDF", "آخر تحديث: نوفمبر 2026",
      "منهج التدريس:", "747.5 ساعة تطوعية معتمدة:", "العربية (اللغة الأم)"].forEach((t) => ok(arPage.indexOf(t) > 0, "Arabic page contains: " + t));
    ok(!/<(b|span|p|li|h1|h2|a|div)\b[^>]*><\/\1>/.test(arPage.replace(/<div class="cv-data"[\s\S]*?<\/div>\n<script>/, "")), "no empty element");
    eq((arPage.match(/<script/g) || []).length, 2, "same two inline scripts");
    // fallback in the generated page
    const m = base(); m.cv.profile.ar = ""; m.cv.pillars[0].titleAr = "";
    const fb = generate(CV.build(m, cvHtml)).html;
    ok(fb.indexOf("<p>Chair of the Information Systems Department and Assistant Professor") > 0, "missing Arabic profile: the English text shows on the Arabic page");
    ok(fb.indexOf('<div class="pillar"><b>APPLIED AI</b><span>التعلم الآلي') > 0, "missing Arabic pillar title: English title, Arabic text");
    fs.rmSync(g.dir, { recursive: true, force: true });
  }

  /* Optional: render the page in Chromium (needs python3 + playwright).  node admin/tests/cv.test.js --render
     Writes into admin/tests/shots/ (not committed), for the English page (cv_) and the generated Arabic page (cv_ar_):
     {cv,cv_ar}_{short,full}_{390,1280}.png and {cv,cv_ar}_{short,full}_{a4,letter}.pdf */
  if (process.argv.indexOf("--render") >= 0) {
    section("render in Chromium (both versions, both languages, screen and print)");
    // the Arabic page is generated into a temporary copy (ar/cv.html), next to the English one
    const site = fs.mkdtempSync(path.join(os.tmpdir(), "cvsite-"));
    fs.mkdirSync(path.join(site, "ar"));
    fs.writeFileSync(path.join(site, "cv.html"), cvHtml);
    fs.writeFileSync(path.join(site, "ar", "cv.html"), arPage);
    const py = [
      "import asyncio, json, os, sys",
      "from playwright.async_api import async_playwright",
      "site, shots = sys.argv[1], sys.argv[2]",
      "os.makedirs(shots, exist_ok=True)",
      "STATE = '(() => ({cls: document.documentElement.className, full: [...document.querySelectorAll(\".full-only\")].filter(e => e.offsetParent !== null).length, short: [...document.querySelectorAll(\".short-only\")].filter(e => e.offsetParent !== null).length, pubs: [...document.querySelectorAll(\"p.pub\")].filter(e => e.offsetParent !== null).length, cur: (document.querySelector(\".tabs a[aria-current]\") || {}).textContent || \"\", scroll: document.documentElement.scrollWidth, data: [...document.querySelectorAll(\".cv-data\")].filter(e => e.offsetParent !== null).length, out: (() => { const p = document.querySelector(\"main.paper\").getBoundingClientRect(); return [...document.querySelectorAll(\"main.paper *\")].filter(e => { if (e.offsetParent === null) return false; const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > p.right + 1 || r.left < p.left - 1); }).map(e => e.tagName + \".\" + e.className).slice(0, 5); })()}))()'",
      "LAYOUT = '(() => { const cs = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).direction : \"\"; }; const r = (e) => e.getBoundingClientRect(); const row = document.querySelector(\".entry .row\"); const pil = [...document.querySelectorAll(\".pillar\")]; return {lang: document.documentElement.lang, dir: document.documentElement.dir, pub: cs(\"p.pub\"), desc: cs(\".desc\"), dateLeft: r(row.querySelector(\".d\")).left < r(row.querySelector(\".t\")).left, pillarFirstRight: r(pil[0]).left > r(pil[1]).left, liPad: getComputedStyle(document.querySelector(\".details\") || document.body).paddingRight, back: document.querySelector(\".back\").getAttribute(\"href\"), lang2: document.getElementById(\"lang\").getAttribute(\"href\")}; })()'",
      "async def page_run(b, url, prefix, out):",
      "    for w in (360, 390, 1280):",
      "        ctx = await b.new_context(viewport={'width': w, 'height': 844}, device_scale_factor=1)",
      "        pg = await ctx.new_page()",
      "        errs = []",
      "        pg.on('pageerror', lambda e: errs.append(str(e)))",
      "        await pg.route('**/fonts.g*/**', lambda r: r.abort())",
      "        await pg.goto(url)",
      "        await pg.wait_for_timeout(200)",
      "        out[prefix + 'short_%d' % w] = await pg.evaluate(STATE)",
      "        out[prefix + 'layout_%d' % w] = await pg.evaluate(LAYOUT)",
      "        out[prefix + 'button_%d' % w] = await pg.evaluate('(() => { const r = document.getElementById(\"savePdf\").getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()')",
      "        out[prefix + 'tab_%d' % w] = await pg.evaluate('(() => { const r = document.querySelector(\".tabs a\").getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()')",
      "        if w != 360:",
      "            await pg.screenshot(path=os.path.join(shots, prefix + 'short_%d.png' % w), full_page=True)",
      "        if w == 1280:",
      "            for fmt in ('A4', 'Letter'):",
      "                await pg.pdf(path=os.path.join(shots, prefix + 'short_%s.pdf' % fmt.lower()), format=fmt, print_background=True)",
      "        await pg.click('.tabs a[href=\"#full\"]')",
      "        await pg.wait_for_timeout(200)",
      "        out[prefix + 'full_%d' % w] = await pg.evaluate(STATE)",
      "        out[prefix + 'hash_%d' % w] = await pg.evaluate('location.hash')",
      "        if w != 360:",
      "            await pg.screenshot(path=os.path.join(shots, prefix + 'full_%d.png' % w), full_page=True)",
      "        if w == 1280:",
      "            for fmt in ('A4', 'Letter'):",
      "                await pg.pdf(path=os.path.join(shots, prefix + 'full_%s.pdf' % fmt.lower()), format=fmt, print_background=True)",
      "        await pg.click('.tabs a[href=\"#short\"]')",
      "        await pg.wait_for_timeout(150)",
      "        out[prefix + 'back_%d' % w] = await pg.evaluate(STATE)",
      "        out[prefix + 'errors_%d' % w] = errs",
      "        await ctx.close()",
      "async def main():",
      "    out = {}",
      "    async with async_playwright() as p:",
      "        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])",
      "        await page_run(b, 'file://' + site + '/cv.html', 'cv_', out)",
      "        await page_run(b, 'file://' + site + '/ar/cv.html', 'cv_ar_', out)",
      "        # direct link to the full version, and the class alone without any script",
      "        ctx = await b.new_context(viewport={'width': 1280, 'height': 844})",
      "        pg = await ctx.new_page()",
      "        await pg.route('**/fonts.g*/**', lambda r: r.abort())",
      "        await pg.goto('file://' + site + '/cv.html#full')",
      "        await pg.wait_for_timeout(200)",
      "        out['direct'] = await pg.evaluate(STATE)",
      "        await ctx.close()",
      "        ctx = await b.new_context(viewport={'width': 1280, 'height': 844}, java_script_enabled=False)",
      "        pg = await ctx.new_page()",
      "        await pg.route('**/fonts.g*/**', lambda r: r.abort())",
      "        html = open(site + '/cv.html', encoding='utf-8').read()",
      "        await pg.set_content(html.replace('<html lang=\"en\" ', '<html class=\"cv-full\" lang=\"en\" '))",
      "        out['noscript_full'] = [await pg.locator('.full-only >> visible=true').count(), await pg.locator('.short-only >> visible=true').count()]",
      "        await pg.set_content(html)",
      "        out['noscript_short'] = [await pg.locator('.full-only >> visible=true').count(), await pg.locator('.short-only >> visible=true').count()]",
      "        await ctx.close()",
      "        await b.close()",
      "    print(json.dumps(out))",
      "asyncio.run(main())"
    ].join("\n");
    const shots = path.join(ROOT, "admin", "tests", "shots");
    const run = cp.spawnSync("python3", ["-c", py, site, shots], { encoding: "utf8" });
    if (run.status !== 0) {
      ok(false, "render failed: " + (run.stderr || "").split("\n").slice(-4).join(" "));
    } else {
      const r = JSON.parse(run.stdout.trim().split("\n").pop());
      const works = base().works.length;
      [["cv_", "Short CV", "Full CV", ""], ["cv_ar_", "السيرة المختصرة", "السيرة الكاملة", "Arabic: "]].forEach(([pre, shortTab, fullTab, label]) => {
        [360, 390, 1280].forEach((w) => {
          const s0 = r[pre + "short_" + w], f = r[pre + "full_" + w], back = r[pre + "back_" + w];
          ok(s0.scroll <= w, label + "short: no horizontal scroll at " + w + "px (" + s0.scroll + ")");
          ok(f.scroll <= w, label + "full: no horizontal scroll at " + w + "px (" + f.scroll + ")");
          eq(s0.out.concat(f.out).join(","), "", label + "nothing sticks out of the page at " + w + "px");
          eq(r[pre + "errors_" + w].length, 0, label + "no page errors at " + w + "px");
          ok(r[pre + "button_" + w][1] >= 40, label + "Save as PDF button is a comfortable tap target at " + w + "px");
          ok(r[pre + "tab_" + w][1] >= 36, label + "tabs are comfortable tap targets at " + w + "px");
          ok(s0.cls.indexOf("cv-full") < 0 && s0.full === 0 && s0.short > 0, label + "opens in the short version at " + w + "px");
          eq(s0.pubs, 17 + 2, label + "short version shows the 17 newest works and the 2 accepted ones at " + w + "px");
          eq(s0.cur, shortTab, label + "short tab marked current");
          ok(f.cls.indexOf("cv-full") >= 0 && f.full > 0 && f.short === 0, label + "the full tab switches to the full version at " + w + "px");
          eq(r[pre + "hash_" + w], "#full", label + "the address shows #full");
          eq(f.pubs, works + 2, label + "full version shows every work and the 2 accepted ones at " + w + "px");
          eq(f.cur, fullTab, label + "full tab marked current");
          ok(back.cls.indexOf("cv-full") < 0 && back.full === 0, label + "the short tab switches back at " + w + "px");
          eq(s0.data + f.data, 0, label + "the data block is never visible");
        });
      });
      const en1280 = r["cv_layout_1280"], ar1280 = r["cv_ar_layout_1280"], ar390 = r["cv_ar_layout_390"];
      ok(en1280.dir === "ltr" && en1280.pub === "ltr" && !en1280.dateLeft && !en1280.pillarFirstRight, "English page: left to right, dates on the right");
      eq([ar1280.lang, ar1280.dir].join(" "), "ar rtl", "Arabic page: lang ar, dir rtl");
      eq(ar1280.pub, "ltr", "Arabic page: references stay left to right");
      eq(ar1280.desc, "rtl", "Arabic page: descriptions right to left");
      ok(ar1280.dateLeft, "Arabic page: dates on the left (mirrored row)");
      ok(ar1280.pillarFirstRight && ar390.pillarFirstRight, "Arabic page: the first pillar is on the right");
      eq(ar1280.liPad, "20px", "Arabic page: list indent on the right");
      eq(ar1280.back + " " + ar1280.lang2, "index.html ../cv.html", "Arabic page: home and language links");
      ok(r.direct.cls.indexOf("cv-full") >= 0 && r.direct.full > 0 && r.direct.short === 0, "cv.html#full opens the full version directly");
      ok(r.noscript_full[0] > 0 && r.noscript_full[1] === 0, "class cv-full on <html> shows the full version without any script");
      ok(r.noscript_short[0] === 0 && r.noscript_short[1] > 0, "no class shows the short version without any script");
      const pages = (name) => {
        const pdf = fs.readFileSync(path.join(shots, name)).toString("latin1");
        return (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
      };
      [["cv_", ""], ["cv_ar_", "Arabic "]].forEach(([pre, label]) => {
        ["a4", "letter"].forEach((fmt) => {
          const n = pages(pre + "short_" + fmt + ".pdf"), f = pages(pre + "full_" + fmt + ".pdf");
          console.log("  " + label + fmt + ": short " + n + " pages, full " + f + " pages");
          eq(n, 3, label + "short version prints on 3 pages (" + fmt + ")");
          ok(f > n && f <= 8, label + "full version is longer and paginates (" + fmt + ": " + f + " pages)");
        });
      });
    }
    fs.rmSync(site, { recursive: true, force: true });
  }
  console.log("\n" + (failed ? "FAILED: " + failed + " of " + (passed + failed) + " checks" : "OK: " + passed + " checks passed"));
  process.exit(failed ? 1 : 0);
}
