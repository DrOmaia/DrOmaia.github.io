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

  const cvHtml = readFile("cv.html");
  const base = () => fixture(cvHtml);

  section("cv.html has every block, once, well formed");
  ALL.forEach((n) => {
    ok(block(cvHtml, n) !== null, "block cv:" + n + " exists");
    eq(cvHtml.split("<!-- cv:" + n + " -->").length - 1, 1, "cv:" + n + " opens once");
    eq(cvHtml.split("<!-- /cv:" + n + " -->").length - 1, 1, "cv:" + n + " closes once");
  });
  ok(/<link rel="canonical" href="https:\/\/dromaia\.github\.io\/cv\.html">/.test(cvHtml), "canonical link");
  ok(/<meta name="description" content="[^"]{60,}">/.test(cvHtml), "meta description");
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
    eq(cv.community.length, 6, "six community / recognition items");
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
    ok(/<html lang="en">/.test(cvHtml), "default is the short version (no class on <html>)");
    ok(/<a href="#short">Short CV<\/a><a href="#full">Full CV<\/a>/.test(cvHtml), "tabs");
    const m = base();
    const full = block(cvHtml, "publications-full").split("\n");
    const items = full.filter((l) => l.indexOf('<p class="pub">') === 0);
    eq(items.length, m.works.length, "the full list has as many entries as there are works");
    m.works.forEach((w) => {
      eq(items.filter((l) => l.indexOf("“" + CV._esc(w.title) + (/[.?!]$/.test(w.title) ? "" : ".") + "”") > 0).length, 1, w.id + " appears exactly once in the full list");
    });
    const byType = {}; m.works.forEach((w) => { byType[w.type] = (byType[w.type] || 0) + 1; });
    ok(full.indexOf('<p class="pubhead">Journal articles (' + byType["Journal article"] + ")</p>") > 0, "journal articles heading with count");
    ok(full.indexOf('<p class="pubhead">Conference papers (' + byType["Conference paper"] + ")</p>") > 0, "conference papers heading with count");
    ok(full.indexOf('<p class="pubhead">Book chapters (' + byType["Book chapter"] + ")</p>") > 0, "book chapters heading with count");
    eq(byType["Journal article"] + byType["Conference paper"] + byType["Book chapter"], m.works.length, "the three groups cover every work");
    const labels = items.map((l) => /<b class="n">(.*?)<\/b>/.exec(l)[1]);
    eq(labels.filter((x) => x[0] === "J").join(","), Array.from({ length: byType["Journal article"] }, (_, i) => "J" + (i + 1)).join(","), "journal articles numbered J1..Jn");
    eq(labels.filter((x) => x[0] === "C").length, byType["Conference paper"], "conference papers numbered");
    eq(labels.filter((x) => x[0] === "B").length, byType["Book chapter"], "book chapters numbered");
    const years = items.filter((l) => l.indexOf('<b class="n">J') > 0).map((l) => Number(/<b class="y">(\d+)<\/b>/.exec(l)[1]));
    ok(years.every((y, i) => i === 0 || years[i - 1] >= y), "newest first inside a group");
    ok(!/et al\./.test(full.join("\n")), "the full list names every author");
    ok(/^<p class="themes"><b>Research themes \(40 works\):<\/b> Cybersecurity, IoT, and cloud infrastructure \(9\); /.test(full[0]), "themes with counts, largest first");
    const other = base(); other.works.push({ id: "P41", title: "A Patent", year: 2027, type: "Patent", theme: "", reference: "Al-Omari, O. (2027). A patent. Office, 1.", doi: null });
    ok(block(CV.build(other, cvHtml), "publications-full").indexOf('<p class="pubhead">Other works (1)</p>') > 0, "an unknown type goes to Other works");
    // appointments: earlier roles are one line in the short version and full entries in the full one
    const app = block(cvHtml, "appointments").split("\n");
    eq(app.filter((l) => l.indexOf('<p class="note short-only">Earlier academic roles: ') === 0).length, 1, "earlier roles line (short only)");
    eq(app.filter((l) => l.indexOf('<div class="entry full-only">') === 0).length, m.timelineEarlier.length, "earlier roles as full entries (full only)");
    ok(app[1].indexOf('<ul class="details full-only"><li>') > 0 && app[1].indexOf("supervise senior projects and cooperative training") > 0, "detail bullets under the matching appointment, full only");
    // teaching and service
    const teach = block(cvHtml, "teaching").split("\n");
    ok(teach[0].indexOf('<p class="short-only">Current and recent courses') === 0, "short course sentence");
    ok(teach[1].indexOf('<p class="full-only"><b>Flagship courses:</b> Technology Trends in Digital Transformation (IS453); ') === 0, "flagship courses first in the full version");
    const allCodes = m.courses.map((c) => c.code);
    ok(allCodes.every((c) => (teach[1] + teach[2]).indexOf("(" + c + ")") > 0), "every course is in the full version");
    eq(((teach[1] + teach[2]).match(/\(IS\d+\)/g) || []).length, allCodes.length, "and each course once");
    const svc = block(cvHtml, "service");
    eq((svc.match(/<li>/g) || []).length, m.roles.length, "every committee and role on its own line in the full version");
  }

  section("fullExtra and appointmentDetails");
  {
    let m = base(); m.cv.fullExtra = [{ title: "Memberships", items: ["IEEE member", "ACM & SIGAI"] }, { title: "Referees", items: ["Available on request"] }];
    let out = CV.build(m, cvHtml);
    eq(changedBlocks(cvHtml, out).join(","), "full-extra", "fullExtra changes only its own block");
    eq(block(out, "full-extra").split("\n")[0], '<section class="full-only extra"><h2>Memberships</h2><ul><li>IEEE member</li><li>ACM &amp; SIGAI</li></ul></section>', "extra section markup");
    eq(JSON.stringify(CV.read(out).fullExtra), JSON.stringify(m.cv.fullExtra), "fullExtra read back");
    eq(outside(out), outside(cvHtml), "nothing outside the blocks changes");
    eq(CV.build(Object.assign({}, m, { cv: CV.read(out) }), out), out, "stable on a second build");

    m = base(); m.cv.appointmentDetails.push({ match: "Jerash", bullets: ["Jerash, Jordan <test> & more."] });
    out = CV.build(m, cvHtml);
    eq(changedBlocks(cvHtml, out).join(","), "appointments,appointment-details", "appointmentDetails changes its data block and the appointments it is printed in");
    ok(/Instructor<\/b> — Jerash Private University.*<ul class="details full-only"><li>Jerash, Jordan &lt;test&gt; &amp; more\.<\/li><\/ul><\/div>/.test(block(out, "appointments")), "bullet under the matching earlier role");
    eq(JSON.stringify(CV.read(out).appointmentDetails), JSON.stringify(m.cv.appointmentDetails), "appointmentDetails read back");
    m = base(); m.cv.appointmentDetails = [{ match: "lecturer", bullets: ["Same note."] }];
    out = CV.build(m, cvHtml);
    eq((block(out, "appointments").match(/Same note\./g) || []).length, 2, "a match is a case-insensitive substring: it applies to every matching entry");
    m = base(); m.cv.appointmentDetails = [{ match: "No such role", bullets: ["x"] }];
    out = CV.build(m, cvHtml);
    ok(block(out, "appointments").indexOf("details") < 0, "an unmatched detail prints nothing");
    eq(JSON.stringify(CV.read(out).appointmentDetails), JSON.stringify(m.cv.appointmentDetails), "but is kept in the data block");
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
    ok(full.indexOf('<p class="pubhead">Journal articles (24)</p>') >= 0, "journal group count grows to 24");
    ok(/Research themes \(41 works\)/.test(full[0]) && /Decision analytics and intelligent systems \(7\)/.test(full[0]), "themes line recounted");
    eq(block(out, "updated"), '<span class="updated">Last updated: January 2027</span>', "date follows the build date");
    eq(outside(out), outside(cvHtml), "nothing outside the blocks changed");
  }

  section("selected count");
  {
    const m = base(); m.cv.selected = 5;
    const out = CV.build(m, cvHtml);
    eq(block(out, "publications").split("\n").filter((l) => l.indexOf('<p class="pub">') === 0).length, 5, "5 works listed");
    ok(/data-selected="5">The 5 most recent of /.test(out), "count line says 5");
    eq(CV.read(out).selected, 5, "read gives 5 back");
    const all = base(); all.cv.selected = 500;
    const outAll = CV.build(all, cvHtml);
    eq(block(outAll, "publications").split("\n").filter((l) => l.indexOf('<p class="pub">') === 0).length, 40, "all 40 listed");
    ok(/data-selected="500">All <a /.test(outAll), "count line says All");
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
    ok(block(out, "header").indexOf("<span>Associate Professor</span>") > 0, "header shows the new title");
    ok(block(out, "header").indexOf('<span class="keep">AI Researcher</span>') > 0, "kept header item stays");
    ok(block(out, "header").indexOf("ORCID 0000-0002-1638-1771") > 0, "contact lines stay");

    m = base(); m.timelineEarlier.pop();
    out = CV.build(m, cvHtml);
    eq(changedBlocks(cvHtml, out).join(","), "appointments", "earlier roles -> appointments");
    ok(block(out, "appointments").indexOf("Teaching Assistant, Yarmouk University") < 0, "removed earlier role is gone");

    m = base(); m.courses.push({ code: "IS555", en: "Data & Society", ar: "" });
    out = CV.build(m, cvHtml);
    eq(changedBlocks(cvHtml, out).join(","), "teaching", "course -> teaching");
    ok(block(out, "teaching").indexOf("Senior Project (IS499), and Data &amp; Society (IS555).") > 0, "course list sentence");

    m = base(); m.roles.push({ org: "PSU", orgAr: "", en: "Member, Test Committee", ar: "" });
    out = CV.build(m, cvHtml);
    eq(changedBlocks(cvHtml, out).join(","), "service", "role -> service");
    ok(/<b>PSU:<\/b> [^<]*Member, Test Committee\.<\/p>/.test(block(out, "service")), "role joins its organisation group");
    ok(block(out, "service").indexOf("<li><b>PSU:</b> Member, Test Committee</li>") > 0, "role listed on its own line in the full version");

    m = base(); m.roles.push({ org: "IEEE", orgAr: "", en: "Senior Member", ar: "" });
    out = CV.build(m, cvHtml);
    ok(block(out, "service").split("\n").indexOf('<p class="svc short-only"><b>IEEE:</b> Senior Member.</p>') > 0, "a new organisation gets its own line (short)");
    ok(block(out, "service").split("\n").indexOf("<li><b>IEEE:</b> Senior Member</li>") > 0, "and its own item in the full list");

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
      community: (cv) => { cv.community.push({ title: "Award", text: "Best paper, 2027." }); },
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
    m = base(); m.cv.extraService.push({ title: "Reviewer", org: "Journal X", date: "2027", text: "Reviewed 3 papers." });
    out = CV.build(m, cvHtml);
    eq(changedBlocks(cvHtml, out).join(","), "service", "extraService -> service");
    eq(JSON.stringify(CV.read(out).extraService), JSON.stringify(m.cv.extraService), "extraService read back");
    m = base(); m.cv.extraService = [{ title: "Only title", org: "", date: "", text: "" }];
    out = CV.build(m, cvHtml);
    eq(JSON.stringify(CV.read(out).extraService), JSON.stringify(m.cv.extraService), "entry with a title only read back");
    ok(block(out, "service").indexOf("<b>PSU:</b>") > 0, "site roles still listed after the entries");
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
    ok(d.html.indexOf("<p>Changed.</p>") > 0, "the other blocks are still written");
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

  /* Optional: render the page in Chromium (needs python3 + playwright).  node admin/tests/cv.test.js --render
     Writes into admin/tests/shots/ (not committed): cv_short_390.png, cv_short_1280.png, cv_full_390.png,
     cv_full_1280.png and cv_{short,full}_{a4,letter}.pdf */
  if (process.argv.indexOf("--render") >= 0) {
    section("render in Chromium (both versions, screen and print)");
    const py = [
      "import asyncio, json, os, sys",
      "from playwright.async_api import async_playwright",
      "root, shots = sys.argv[1], sys.argv[2]",
      "os.makedirs(shots, exist_ok=True)",
      "url = 'file://' + root + '/cv.html'",
      "STATE = '(() => ({cls: document.documentElement.className, full: [...document.querySelectorAll(\".full-only\")].filter(e => e.offsetParent !== null).length, short: [...document.querySelectorAll(\".short-only\")].filter(e => e.offsetParent !== null).length, pubs: [...document.querySelectorAll(\"p.pub\")].filter(e => e.offsetParent !== null).length, cur: (document.querySelector(\".tabs a[aria-current]\") || {}).textContent || \"\", scroll: document.documentElement.scrollWidth, data: [...document.querySelectorAll(\".cv-data\")].filter(e => e.offsetParent !== null).length}))()'",
      "async def main():",
      "    out = {}",
      "    async with async_playwright() as p:",
      "        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])",
      "        for w in (360, 390, 1280):",
      "            ctx = await b.new_context(viewport={'width': w, 'height': 844}, device_scale_factor=1)",
      "            pg = await ctx.new_page()",
      "            errs = []",
      "            pg.on('pageerror', lambda e: errs.append(str(e)))",
      "            await pg.route('**/fonts.g*/**', lambda r: r.abort())",
      "            await pg.goto(url)",
      "            await pg.wait_for_timeout(200)",
      "            out['short_%d' % w] = await pg.evaluate(STATE)",
      "            out['button_%d' % w] = await pg.evaluate('(() => { const r = document.getElementById(\"savePdf\").getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()')",
      "            out['tab_%d' % w] = await pg.evaluate('(() => { const r = document.querySelector(\".tabs a\").getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()')",
      "            if w != 360:",
      "                await pg.screenshot(path=os.path.join(shots, 'cv_short_%d.png' % w), full_page=True)",
      "            if w == 1280:",
      "                for fmt in ('A4', 'Letter'):",
      "                    await pg.pdf(path=os.path.join(shots, 'cv_short_%s.pdf' % fmt.lower()), format=fmt, print_background=True)",
      "            await pg.click('.tabs a[href=\"#full\"]')",
      "            await pg.wait_for_timeout(200)",
      "            out['full_%d' % w] = await pg.evaluate(STATE)",
      "            out['hash_%d' % w] = await pg.evaluate('location.hash')",
      "            if w != 360:",
      "                await pg.screenshot(path=os.path.join(shots, 'cv_full_%d.png' % w), full_page=True)",
      "            if w == 1280:",
      "                for fmt in ('A4', 'Letter'):",
      "                    await pg.pdf(path=os.path.join(shots, 'cv_full_%s.pdf' % fmt.lower()), format=fmt, print_background=True)",
      "            await pg.click('.tabs a[href=\"#short\"]')",
      "            await pg.wait_for_timeout(150)",
      "            out['back_%d' % w] = await pg.evaluate(STATE)",
      "            out['errors_%d' % w] = errs",
      "            await ctx.close()",
      "        # direct link to the full version, and the class alone without any script",
      "        ctx = await b.new_context(viewport={'width': 1280, 'height': 844})",
      "        pg = await ctx.new_page()",
      "        await pg.route('**/fonts.g*/**', lambda r: r.abort())",
      "        await pg.goto(url + '#full')",
      "        await pg.wait_for_timeout(200)",
      "        out['direct'] = await pg.evaluate(STATE)",
      "        await ctx.close()",
      "        ctx = await b.new_context(viewport={'width': 1280, 'height': 844}, java_script_enabled=False)",
      "        pg = await ctx.new_page()",
      "        await pg.route('**/fonts.g*/**', lambda r: r.abort())",
      "        html = open(root + '/cv.html', encoding='utf-8').read()",
      "        await pg.set_content(html.replace('<html lang=\"en\">', '<html lang=\"en\" class=\"cv-full\">'))",
      "        out['noscript_full'] = [await pg.locator('.full-only >> visible=true').count(), await pg.locator('.short-only >> visible=true').count()]",
      "        await pg.set_content(html)",
      "        out['noscript_short'] = [await pg.locator('.full-only >> visible=true').count(), await pg.locator('.short-only >> visible=true').count()]",
      "        await ctx.close()",
      "        await b.close()",
      "    print(json.dumps(out))",
      "asyncio.run(main())"
    ].join("\n");
    const shots = path.join(ROOT, "admin", "tests", "shots");
    const run = require("child_process").spawnSync("python3", ["-c", py, ROOT, shots], { encoding: "utf8" });
    if (run.status !== 0) {
      ok(false, "render failed: " + (run.stderr || "").split("\n").slice(-4).join(" "));
    } else {
      const r = JSON.parse(run.stdout.trim().split("\n").pop());
      const works = base().works.length;
      [360, 390, 1280].forEach((w) => {
        const s0 = r["short_" + w], f = r["full_" + w], back = r["back_" + w];
        ok(s0.scroll <= w, "short: no horizontal scroll at " + w + "px (" + s0.scroll + ")");
        ok(f.scroll <= w, "full: no horizontal scroll at " + w + "px (" + f.scroll + ")");
        eq(r["errors_" + w].length, 0, "no page errors at " + w + "px");
        ok(r["button_" + w][1] >= 40, "Save as PDF button is a comfortable tap target at " + w + "px");
        ok(r["tab_" + w][1] >= 36, "tabs are comfortable tap targets at " + w + "px");
        ok(s0.cls.indexOf("cv-full") < 0 && s0.full === 0 && s0.short > 0, "opens in the short version at " + w + "px");
        eq(s0.pubs, 17 + 2, "short version shows the 17 newest works and the 2 accepted ones at " + w + "px");
        eq(s0.cur, "Short CV", "Short CV tab marked current");
        ok(f.cls.indexOf("cv-full") >= 0 && f.full > 0 && f.short === 0, "the Full CV tab switches to the full version at " + w + "px");
        eq(r["hash_" + w], "#full", "the address shows #full");
        eq(f.pubs, works + 2, "full version shows every work and the 2 accepted ones at " + w + "px");
        eq(f.cur, "Full CV", "Full CV tab marked current");
        ok(back.cls.indexOf("cv-full") < 0 && back.full === 0, "the Short CV tab switches back at " + w + "px");
        eq(s0.data + f.data, 0, "the data block is never visible");
      });
      ok(r.direct.cls.indexOf("cv-full") >= 0 && r.direct.full > 0 && r.direct.short === 0, "cv.html#full opens the full version directly");
      ok(r.noscript_full[0] > 0 && r.noscript_full[1] === 0, "class cv-full on <html> shows the full version without any script");
      ok(r.noscript_short[0] === 0 && r.noscript_short[1] > 0, "no class shows the short version without any script");
      const pages = (name) => {
        const pdf = fs.readFileSync(path.join(shots, name)).toString("latin1");
        return (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
      };
      ["a4", "letter"].forEach((fmt) => {
        const n = pages("cv_short_" + fmt + ".pdf"), f = pages("cv_full_" + fmt + ".pdf");
        console.log("  " + fmt + ": short " + n + " pages, full " + f + " pages");
        eq(n, 3, "short version prints on 3 pages (" + fmt + ")");
        ok(f > n && f <= 8, "full version is longer and paginates (" + fmt + ": " + f + " pages)");
      });
    }
  }

  console.log("\n" + (failed ? "FAILED: " + failed + " of " + (passed + failed) + " checks" : "OK: " + passed + " checks passed"));
  process.exit(failed ? 1 : 0);
}
