/* Site dashboard library (admin/lib.js).
   Pure functions: no DOM, no network. Browser: window.DashLib. Node: module.exports.
   Contract: admin/SPEC.md. Tests: node admin/tests/lib.test.js */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DashLib = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ------------------------------------------------------------------ constants */
  var FILES = ["index.html", "publications.html", "research-data.js", "data/metrics.json", "sitemap.xml", "cv.html"];
  var PAGES = {
    "index.html": { out: "ar/index.html", en: "https://dromaia.github.io/", ar: "https://dromaia.github.io/ar/" },
    "publications.html": {
      out: "ar/publications.html",
      en: "https://dromaia.github.io/publications.html",
      ar: "https://dromaia.github.io/ar/publications.html",
    },
  };
  var THEMES = [
    { en: "Cybersecurity, IoT, and cloud infrastructure", ar: "الأمن السيبراني وإنترنت الأشياء والبنية السحابية" },
    { en: "NLP, education, and knowledge systems", ar: "معالجة اللغة الطبيعية والتعليم ونظم المعرفة" },
    { en: "Healthcare and clinical decision support", ar: "الرعاية الصحية ودعم القرار السريري" },
    { en: "Decision analytics and intelligent systems", ar: "تحليلات القرار والأنظمة الذكية" },
    { en: "Computer vision and environmental intelligence", ar: "الرؤية الحاسوبية والذكاء البيئي" },
    { en: "Responsible AI, governance, and society", ar: "الذكاء الاصطناعي المسؤول والحوكمة والمجتمع" },
  ];
  var TYPES = [
    { en: "Journal article", ar: "مقالة في دورية", count: "journal" },
    { en: "Conference paper", ar: "ورقة مؤتمر", count: "conference" },
    { en: "Book chapter", ar: "فصل في كتاب", count: "chapter" },
  ];
  /* Google Fonts families. Only weights that each family really has are listed: one wrong weight makes the whole
     stylesheet request fail. "system" fonts are never requested from Google Fonts. */
  var FONTS = {
    ar: [
      { name: "Noto Naskh Arabic", weights: [400, 700] },
      { name: "IBM Plex Sans Arabic", weights: [400, 600, 700] },
      { name: "Tajawal", weights: [400, 500, 700] },
      { name: "Cairo", weights: [400, 600, 700] },
      { name: "Noto Kufi Arabic", weights: [400, 600, 700] },
      { name: "Almarai", weights: [400, 700] },
      { name: "Readex Pro", weights: [400, 600, 700] },
      { name: "Amiri", weights: [400, 700] },
      { name: "Noto Sans Arabic", weights: [400, 600, 700] },
      { name: "Rubik", weights: [400, 600, 700] },
      { name: "Changa", weights: [400, 600, 700] },
      { name: "El Messiri", weights: [400, 600, 700] },
      { name: "Markazi Text", weights: [400, 600, 700] },
      { name: "Scheherazade New", weights: [400, 700] },
      { name: "Harmattan", weights: [400, 700] },
      { name: "Vazirmatn", weights: [400, 600, 700] },
      { name: "Mada", weights: [400, 600, 700] },
      { name: "Baloo Bhaijaan 2", weights: [400, 600, 700] },
      { name: "Lateef", weights: [400, 700] },
      { name: "Reem Kufi", weights: [400, 700] },
    ],
    en: [
      { name: "Manrope", weights: [400, 600, 700, 800] },
      { name: "Inter", weights: [400, 600, 700, 800] },
      { name: "IBM Plex Sans", weights: [400, 600, 700] },
      { name: "Source Sans 3", weights: [400, 600, 700] },
      { name: "Poppins", weights: [400, 600, 700] },
      { name: "Roboto", weights: [400, 500, 700] },
      { name: "Open Sans", weights: [400, 600, 700] },
      { name: "Lato", weights: [400, 700] },
      { name: "Montserrat", weights: [400, 600, 700] },
      { name: "Nunito", weights: [400, 600, 700] },
      { name: "DM Sans", weights: [400, 500, 700] },
      { name: "Work Sans", weights: [400, 600, 700] },
      { name: "Noto Sans", weights: [400, 600, 700] },
    ],
    /* English headings. "body" = the same font as the English body text. */
    head: [
      { name: "Georgia", weights: [400, 700], system: true },
      { name: "Playfair Display", weights: [400, 700] },
      { name: "Merriweather", weights: [400, 700] },
      { name: "Lora", weights: [400, 700] },
      { name: "Source Serif 4", weights: [400, 700] },
      { name: "body", weights: [], system: true, same: true, label: { ar: "مثل خط النص", en: "Same as body text" } },
    ],
  };
  var DEFAULT_FONTS = { ar: "IBM Plex Sans Arabic", en: "Manrope", head: "Georgia" };

  /* Colour palettes. "default" is what the site's own CSS gives (an empty dash:theme block).
     Each mode: bg, surface, surface2, text, muted, line, accent, link, green. */
  var PALETTES = [
    { id: "default", ar: "رملي دافئ (الأساسي)", en: "Warm sand (default)",
      light: { bg: "#f6f3ec", surface: "#fffdf8", surface2: "#eeeae0", text: "#22303b", muted: "#5f6c76", line: "rgba(60, 50, 30, 0.13)", accent: "#7a5a12", link: "#2c6aa6", green: "#1f7a63" },
      dark: { bg: "#111a24", surface: "#18232f", surface2: "#122234", text: "#dfe5ea", muted: "#9cafc1", line: "rgba(255, 255, 255, 0.1)", accent: "#d8b45b", link: "#68a9ff", green: "#64d5b3" } },
    { id: "sage", ar: "أخضر زيتي", en: "Sage green",
      light: { bg: "#f3f5f0", surface: "#fcfdfa", surface2: "#e6ebe1", text: "#233029", muted: "#5a685f", line: "rgba(40, 60, 45, 0.14)", accent: "#4a6534", link: "#2a6a6e", green: "#2c7455" },
      dark: { bg: "#121a17", surface: "#1a2420", surface2: "#17221d", text: "#dfe7e2", muted: "#9fb1a8", line: "rgba(255, 255, 255, 0.1)", accent: "#a9c48a", link: "#7fc7c9", green: "#6fd3a8" } },
    { id: "slate", ar: "أزرق رمادي", en: "Slate blue",
      light: { bg: "#f2f4f7", surface: "#fcfdfe", surface2: "#e6eaf0", text: "#212c3a", muted: "#586576", line: "rgba(30, 45, 70, 0.13)", accent: "#3d5a80", link: "#2a66a3", green: "#1f7a63" },
      dark: { bg: "#10161f", surface: "#18202b", surface2: "#141d29", text: "#dfe5ec", muted: "#9aabbd", line: "rgba(255, 255, 255, 0.1)", accent: "#9db8dc", link: "#7db4f5", green: "#64d5b3" } },
    { id: "rose", ar: "وردي ترابي", en: "Dusty rose",
      light: { bg: "#f7f2f0", surface: "#fffcfb", surface2: "#efe5e1", text: "#33272a", muted: "#6b5b5e", line: "rgba(70, 40, 40, 0.13)", accent: "#8a4a52", link: "#35638f", green: "#2c7455" },
      dark: { bg: "#1b1416", surface: "#251c1f", surface2: "#21181b", text: "#ece2e3", muted: "#b7a5a8", line: "rgba(255, 255, 255, 0.1)", accent: "#e0a6ad", link: "#9ec3ee", green: "#7fd1ae" } },
    { id: "ink", ar: "حبري محايد", en: "Neutral ink",
      light: { bg: "#f5f5f3", surface: "#ffffff", surface2: "#e9e9e5", text: "#1f2428", muted: "#596066", line: "rgba(20, 20, 20, 0.12)", accent: "#2f3b45", link: "#2c5f9e", green: "#1f7a63" },
      dark: { bg: "#121416", surface: "#1b1e21", surface2: "#171a1d", text: "#e6e8ea", muted: "#a3abb2", line: "rgba(255, 255, 255, 0.1)", accent: "#c9d2da", link: "#8ab8f0", green: "#64d5b3" } },
    { id: "teal", ar: "فيروزي هادئ", en: "Calm teal",
      light: { bg: "#f1f6f5", surface: "#fbfefd", surface2: "#e2eeec", text: "#1f2f30", muted: "#536667", line: "rgba(20, 60, 60, 0.13)", accent: "#1f6b6b", link: "#2a5f9a", green: "#1f7a63" },
      dark: { bg: "#0f191a", surface: "#172425", surface2: "#132021", text: "#dde9e8", muted: "#9bb3b2", line: "rgba(255, 255, 255, 0.1)", accent: "#7fcfc9", link: "#86b9f2", green: "#6fd3a8" } },
  ];
  var CUSTOM_KEYS = ["bg", "surface", "text", "accent", "link"];
  var BUILTIN_SECTIONS = ["leadership", "research", "teaching", "experience", "contact"];

  /* language of the messages (warnings, summary, validate) */
  var LANG = "ar";
  function setLang(lang) { LANG = lang === "en" ? "en" : "ar"; return LANG; }
  function tr(ar, en) { return LANG === "en" ? en : ar; }
  function missingMarker(name, page, effect) {
    return tr("العلامة " + name + " غير موجودة في " + page + (effect ? "، " + effect : "") + ".",
      "The marker " + name + " is missing in " + page + (effect ? ", " + effect : "") + ".");
  }
  var MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  var WORK_KEYS = ["id", "title", "year", "type", "theme", "methods", "contribution", "reference", "doi", "verificationNote"];
  var LATEST_COUNT = 3;
  var NOTE_NO_DOI = { en: "No DOI is available in the verified record.", ar: "لا يتوفر رقم DOI في السجل الموثق." };

  /* ------------------------------------------------------------------ small helpers */
  function escText(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escAttr(value) {
    return escText(value).replace(/"/g, "&quot;");
  }
  /* the publication cards were generated with Python's html.escape(): quotes and apostrophes are escaped everywhere */
  function escCard(value) {
    return escAttr(value).replace(/'/g, "&#x27;");
  }
  var NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  function unesc(value) {
    return String(value == null ? "" : value).replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, function (all, code) {
      if (code.charAt(0) === "#") {
        var n = code.charAt(1) === "x" || code.charAt(1) === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : all;
      }
      return Object.prototype.hasOwnProperty.call(NAMED, code) ? NAMED[code] : all;
    });
  }
  function reEsc(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function str(value) {
    return value == null ? "" : String(value).trim();
  }
  function idNumber(id) {
    var m = /^P(\d+)$/.exec(String(id || ""));
    return m ? parseInt(m[1], 10) : NaN;
  }
  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }
  function dateEn(iso) {
    var p = iso.split("-");
    return parseInt(p[2], 10) + " " + MONTHS_EN[parseInt(p[1], 10) - 1] + " " + p[0];
  }
  function dateAr(iso) {
    var p = iso.split("-");
    return parseInt(p[2], 10) + " " + MONTHS_AR[parseInt(p[1], 10) - 1] + " " + p[0];
  }

  /* marker blocks: <!-- NAME --> inner <!-- /NAME --> */
  function findBlock(html, name) {
    var open = "<!-- " + name + " -->";
    var close = "<!-- /" + name + " -->";
    var a = html.indexOf(open);
    if (a < 0) return null;
    var b = html.indexOf(close, a + open.length);
    if (b < 0) return null;
    return { start: a, innerStart: a + open.length, innerEnd: b, end: b + close.length, inner: html.slice(a + open.length, b) };
  }
  function setBlock(html, name, inner) {
    var block = findBlock(html, name);
    return block ? html.slice(0, block.innerStart) + inner + html.slice(block.innerEnd) : html;
  }
  function blockLines(html, name) {
    var block = findBlock(html, name);
    if (!block) return null;
    return block.inner.split("\n").filter(function (line) { return line.trim() !== ""; });
  }

  /* ------------------------------------------------------------------ Arabic pages (port of tools/build-arabic.py) */
  var TEXT_RE = /<([a-zA-Z][a-zA-Z0-9]*)((?:\s[^>]*?)?)\sdata-ar="([^"]*)"([^>]*)>([\s\S]*?)<\/\1\s*>/g;
  var TAG_RE = /<([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?>/g;
  var AR_ATTR_RE = /\sdata-ar-([a-zA-Z-]+)="([^"]*)"/g;
  var STRIP_RE = /\sdata-(?:ar|en)(?:-[a-zA-Z-]+)?="[^"]*"/g;
  var URL_RE = /\b(href|src)="([^"]*)"/g;
  var SKIP_PREFIXES = ["http://", "https://", "//", "/", "#", "mailto:", "tel:", "data:", "javascript:"];

  function buildArabic(page, source) {
    var spec = PAGES[page];
    if (!spec) throw new Error("buildArabic: unknown page " + page);
    // 1. element text
    var out = source.replace(TEXT_RE, function (all, tag, before, arabic, after) {
      return "<" + tag + before + ' data-ar="' + arabic + '"' + after + ">" + arabic + "</" + tag + ">";
    });
    // 2. attributes
    out = out.replace(TAG_RE, function (all, tag, attrsIn) {
      var attrs = attrsIn || "";
      var pairs = [];
      var m;
      AR_ATTR_RE.lastIndex = 0;
      while ((m = AR_ATTR_RE.exec(attrs))) pairs.push([m[1], m[2]]);
      if (!pairs.length) return all;
      pairs.forEach(function (pair) {
        var existing = new RegExp("(\\s" + reEsc(pair[0]) + '=")[^"]*(")');
        if (existing.test(attrs)) {
          attrs = attrs.replace(existing, function (x, a, b) { return a + pair[1] + b; });
        } else {
          attrs = attrs + " " + pair[0] + '="' + pair[1] + '"';
        }
      });
      return "<" + tag + attrs + ">";
    });
    // 3. strip translation attributes
    out = out.replace(STRIP_RE, "");
    // 4. relative urls (the Arabic pages live one folder down)
    out = out.replace(URL_RE, function (all, attr, value) {
      var skip = value === "" || /\.html$/.test(value) || value.indexOf(".html#") >= 0 || value.indexOf(".html?") >= 0 ||
        SKIP_PREFIXES.some(function (p) { return value.indexOf(p) === 0; });
      return skip ? all : attr + '="../' + value + '"';
    });
    // 5. structured data
    var forms = ['"url": "' + spec.en + '"', '"url":"' + spec.en + '"'];
    for (var i = 0; i < forms.length; i++) {
      var at = out.indexOf(forms[i]);
      if (at >= 0) {
        out = out.slice(0, at) + forms[i].replace(spec.en, function () { return spec.ar; }) + out.slice(at + forms[i].length);
        break;
      }
    }
    out = out.split('"inLanguage": "en"').join('"inLanguage": "ar"').split('"inLanguage":"en"').join('"inLanguage":"ar"');
    // 6. banner
    var banner = "<!-- Generated by tools/build-arabic.py from ../" + page + ". Edit the English file and rebuild; do not edit this file by hand. -->\n";
    var doctype = "<!DOCTYPE html>\n";
    var d = out.indexOf(doctype);
    if (d >= 0) out = out.slice(0, d) + doctype + banner + out.slice(d + doctype.length);
    return out;
  }

  /* ------------------------------------------------------------------ research-data.js */
  function parseData(text) {
    var a = text.indexOf("{");
    var b = text.lastIndexOf("}") + 1;
    if (a < 0 || b <= a) throw new Error("research-data.js: no JSON object found");
    var data = JSON.parse(text.slice(a, b));
    return { prefix: text.slice(0, a), suffix: text.slice(b), data: data };
  }
  function serializeData(parsed, data) {
    return parsed.prefix + JSON.stringify(data) + parsed.suffix;
  }

  function normalizeDoi(value) {
    var v = str(value);
    if (!v) return null;
    var bare = v.replace(/^doi:\s*/i, "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
    if (/^10\.\d{4,9}\/\S+$/.test(bare)) return "https://doi.org/" + bare;
    return v; // another address (for example a publisher PDF); kept as it is
  }
  function doiBare(url) {
    var m = /^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i.exec(url || "");
    return m ? m[1] : null;
  }
  function doiKey(url) {
    var m = /10\.\d{4,9}\/[^\s"<>]+/i.exec(url || "");
    return m ? m[0].replace(/\.+$/, "").toLowerCase() : null;
  }

  function normalizeWork(work) {
    var w = {};
    w.id = str(work.id);
    w.title = str(work.title);
    var year = parseInt(work.year, 10);
    w.year = isFinite(year) ? year : work.year;
    w.type = str(work.type);
    w.theme = str(work.theme);
    w.methods = (Array.isArray(work.methods) ? work.methods : String(work.methods || "").split(/[,،\n]/))
      .map(str).filter(function (m) { return m !== ""; });
    w.contribution = str(work.contribution);
    w.reference = str(work.reference);
    w.doi = normalizeDoi(work.doi);
    w.verificationNote = str(work.verificationNote) || null;
    Object.keys(work).forEach(function (key) {
      if (WORK_KEYS.indexOf(key) >= 0) return;
      var value = work[key];
      if (value == null || value === "") return;
      w[key] = typeof value === "string" ? value.trim() : value;
    });
    return w;
  }
  function sortWorks(works) {
    return works.slice().sort(function (a, b) {
      var x = idNumber(a.id), y = idNumber(b.id);
      if (isNaN(x) || isNaN(y)) return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
      return x - y;
    });
  }
  function nextId(works) {
    var max = 0;
    (works || []).forEach(function (w) {
      var n = idNumber(w.id);
      if (!isNaN(n) && n > max) max = n;
    });
    var next = String(max + 1);
    return "P" + (next.length < 2 ? "0" + next : next);
  }
  function counts(works) {
    var c = { works: works.length, journal: 0, conference: 0, chapter: 0, themes: {}, years: [] };
    var seen = {};
    works.forEach(function (w) {
      TYPES.forEach(function (t) { if (w.type === t.en) c[t.count] += 1; });
      c.themes[w.theme] = (c.themes[w.theme] || 0) + 1;
      if (!seen[w.year]) { seen[w.year] = true; c.years.push(w.year); }
    });
    c.years.sort(function (a, b) { return b - a; });
    c.firstYear = c.years.length ? c.years[c.years.length - 1] : null;
    c.lastYear = c.years.length ? c.years[0] : null;
    return c;
  }

  /* ------------------------------------------------------------------ publication cards */
  function themeAr(name) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].en === name) return THEMES[i].ar;
    return name;
  }
  function typeAr(name) {
    for (var i = 0; i < TYPES.length; i++) if (TYPES[i].en === name) return TYPES[i].ar;
    return name;
  }
  function arCitations(n) {
    if (n === 0) return "لا استشهادات بعد";
    if (n === 1) return "استشهاد واحد";
    if (n === 2) return "استشهادان";
    if (n >= 3 && n <= 10) return n + " استشهادات";
    return n + " استشهاداً";
  }
  function thousands(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function citeSpan(work, metricsByDoi) {
    var bare = doiBare(work.doi);
    if (!bare) return null;
    var row = metricsByDoi ? metricsByDoi[bare.toLowerCase()] : null;
    if (!row) {
      return '<span class="pub-cites" data-doi="' + escCard(bare) + '" data-ar="' + arCitations(0) + ' · Crossref">Cited by 0 · Crossref</span>';
    }
    var n = row.crossref != null ? row.crossref : row.openalex;
    if (n == null) return '<span class="pub-cites" data-doi="' + escCard(bare) + '"></span>';
    var source = row.crossref != null ? "Crossref" : "OpenAlex";
    return '<span class="pub-cites" data-doi="' + escCard(bare) + '" data-ar="' + arCitations(n) + " · " + source + '">Cited by ' +
      thousands(n) + " · " + source + "</span>";
  }
  function noteLine(note, noteAr) {
    var arabic = noteAr != null ? noteAr : (note === NOTE_NO_DOI.en ? NOTE_NO_DOI.ar : null);
    return '                <p class="verification-note"><strong data-en="Verification note:" data-ar="ملاحظة تحقق:">Verification note:</strong> ' +
      '<span data-en="' + escCard(note) + '"' + (arabic != null ? ' data-ar="' + escCard(arabic) + '"' : "") + ">" + escCard(note) + "</span></p>";
  }
  function searchText(work) {
    return [work.id, work.title, work.theme, work.methods.join(" "), work.contribution, work.reference].join(" ");
  }
  /* The canonical card (the layout of the older, hand-checked cards). options:
     metricsByDoi, noteHtml (a ready verification-note line, or "" for none), noteAr {english: arabic}. */
  function cardHtml(work, options) {
    var o = options || {};
    var lines = [];
    var p = "            ";
    lines.push("          <article");
    lines.push(p + 'id="' + escCard(String(work.id).toLowerCase()) + '"');
    lines.push(p + 'class="publication-card"');
    lines.push(p + 'data-id="' + escCard(work.id) + '"');
    lines.push(p + 'data-year="' + escCard(work.year) + '"');
    lines.push(p + 'data-type="' + escCard(work.type) + '"');
    lines.push(p + 'data-theme="' + escCard(work.theme) + '"');
    lines.push(p + 'data-search="' + escCard(searchText(work)) + '"');
    lines.push("          >");
    lines.push(p + '<div class="pub-index">');
    lines.push(p + "  <strong>" + escCard(work.id) + "</strong>");
    lines.push(p + '  <time datetime="' + escCard(work.year) + '">' + escCard(work.year) + "</time>");
    lines.push(p + '  <span data-en="' + escCard(work.type) + '" data-ar="' + escCard(typeAr(work.type)) + '">' + escCard(work.type) + "</span>");
    var cite = citeSpan(work, o.metricsByDoi);
    if (cite) lines.push(p + "  " + cite);
    lines.push(p + "</div>");
    lines.push(p + "<div>");
    lines.push(p + "  <h3>" + escCard(work.title) + "</h3>");
    lines.push(p + '  <p class="pub-theme" data-en="' + escCard(work.theme) + '" data-ar="' + escCard(themeAr(work.theme)) + '">' + escCard(work.theme) + "</p>");
    lines.push(p + '  <p class="pub-contribution">' + escCard(work.contribution) + "</p>");
    lines.push(p + '  <div class="method-list" role="group" aria-label="Methods" data-ar-aria-label="المنهجيات">' +
      work.methods.map(function (m) { return "<span>" + escCard(m) + "</span>"; }).join("") + "</div>");
    lines.push(p + '  <div class="apa-reference">');
    lines.push(p + "    <p");
    lines.push(p + '      class="apa-label"');
    lines.push(p + '      data-en="APA 7 reference"');
    lines.push(p + '      data-ar="المرجع وفق APA 7"');
    lines.push(p + "    >APA 7 reference</p>");
    lines.push(p + '    <p class="reference">' + escCard(work.reference) + "</p>");
    var note;
    if (o.noteHtml != null) note = o.noteHtml;
    else if (work.verificationNote) note = noteLine(work.verificationNote, o.noteAr ? o.noteAr[work.verificationNote] : null);
    else note = "";
    lines.push(note);
    lines.push(p + "  </div>");
    lines.push(p + '  <div class="pub-actions">');
    if (!work.doi) {
      lines.push(p + '    <span class="verification-note" data-en="No DOI in the verified record" data-ar="لا يوجد DOI في السجل الموثق">No DOI in the verified record</span>');
    } else if (doiBare(work.doi)) {
      lines.push(p + '    <a href="' + escCard(work.doi) + '" target="_blank" rel="noopener" data-en="View DOI ↗" data-ar="عرض DOI ↗">View DOI ↗</a>');
    } else if (/\.pdf(?:$|[?#])/i.test(work.doi)) {
      lines.push(p + '    <a href="' + escCard(work.doi) + '" target="_blank" rel="noopener" data-en="View publisher PDF ↗" data-ar="عرض ملف الناشر ↗">View publisher PDF ↗</a>');
    } else {
      lines.push(p + '    <a href="' + escCard(work.doi) + '" target="_blank" rel="noopener" data-en="View publication ↗" data-ar="عرض البحث ↗">View publication ↗</a>');
    }
    lines.push(p + "    <button");
    lines.push(p + '      class="copy-reference"');
    lines.push(p + '      type="button"');
    lines.push(p + '      data-reference="' + escCard(work.reference) + '"');
    lines.push(p + '      data-en="Copy APA reference" data-ar="نسخ مرجع APA"');
    lines.push(p + "    >Copy APA reference</button>");
    lines.push(p + "  </div>");
    lines.push(p + "</div>");
    lines.push("          </article>");
    return lines.join("\n");
  }
  /* Split the cards block into the existing cards, keyed by id (markup kept verbatim, trailing blank lines removed). */
  function splitCards(inner) {
    var parts = inner.split(/(?=^[ \t]*<article\b)/m);
    var map = {};
    var order = [];
    parts.forEach(function (part) {
      var m = /data-id="([^"]+)"/.exec(part);
      if (!m || !/^[ \t]*<article\b/.test(part)) return;
      var id = unesc(m[1]);
      map[id] = part.replace(/\s+$/, "");
      order.push(id);
    });
    return { map: map, order: order };
  }
  function existingNoteLine(card) {
    var m = /^[ \t]*<p class="verification-note">.*<\/p>[ \t]*$/m.exec(card || "");
    return m ? m[0] : null;
  }
  function harvestNotes(cardsInner) {
    var map = {};
    var re = /<p class="verification-note">[\s\S]*?<span data-en="([^"]*)" data-ar="([^"]*)">/g;
    var m;
    while ((m = re.exec(cardsInner))) map[unesc(m[1])] = unesc(m[2]);
    return map;
  }

  /* ------------------------------------------------------------------ small blocks: parse and render */
  var METRIC_RE = /^\s*<(div|a) class="metric"(?: href="([^"]*)")?><strong>([^<]*)<\/strong><span(?: data-ar="([^"]*)")?>([^<]*)<\/span><\/\1>\s*$/;
  function parseMetrics(lines, problems) {
    var items = [];
    (lines || []).forEach(function (line) {
      var m = METRIC_RE.exec(line);
      if (!m) { if (problems) problems.push(tr("سطر غير مفهوم في قسم الأرقام؛ سيُحذف إذا عدّلت هذا القسم.", "A line in the numbers block could not be read; it will be dropped if you edit that block.")); return; }
      var href = m[2] != null ? unesc(m[2]) : null;
      items.push({ value: unesc(m[3]), en: unesc(m[5]), ar: m[4] != null ? unesc(m[4]) : "", href: href, auto: href === "publications.html" ? "works" : null });
    });
    return items;
  }
  function renderMetrics(items, worksCount) {
    return "\n" + (items || []).map(function (it) {
      var value = it.auto === "works" && worksCount != null ? String(worksCount) : str(it.value);
      var span = "<span" + (str(it.ar) ? ' data-ar="' + escAttr(str(it.ar)) + '"' : "") + ">" + escText(str(it.en)) + "</span>";
      var body = "<strong>" + escText(value) + "</strong>" + span;
      return str(it.href) ? '  <a class="metric" href="' + escAttr(str(it.href)) + '">' + body + "</a>" : '  <div class="metric">' + body + "</div>";
    }).join("\n") + "\n";
  }

  var NEWS_RE = /^\s*<li><time datetime="([^"]*)">([^<]*)<\/time> — <span(?: data-ar="([^"]*)")?>([^<]*)<\/span><\/li>\s*$/;
  function parseNews(lines, problems) {
    var items = [];
    (lines || []).forEach(function (line) {
      var m = NEWS_RE.exec(line);
      if (!m) { if (problems) problems.push(tr("سطر غير مفهوم في قسم المستجدات؛ سيُحذف إذا عدّلت هذا القسم.", "A line in the news block could not be read; it will be dropped if you edit that block.")); return; }
      items.push({ year: unesc(m[2]), en: unesc(m[4]), ar: m[3] != null ? unesc(m[3]) : "" });
    });
    return items;
  }
  function renderNews(items) {
    return "\n" + (items || []).map(function (it) {
      var year = str(it.year);
      return '<li><time datetime="' + escAttr(year) + '">' + escText(year) + "</time> — <span" +
        (str(it.ar) ? ' data-ar="' + escAttr(str(it.ar)) + '"' : "") + ">" + escText(str(it.en)) + "</span></li>";
    }).join("\n") + "\n";
  }

  var ROLE_RE = /^\s*<article class="society-item"><span class="society-org"(?: data-ar="([^"]*)")?>([^<]*)<\/span><span class="society-role"(?: data-ar="([^"]*)")?>([^<]*)<\/span><\/article>\s*$/;
  function parseRoles(lines, problems) {
    var items = [];
    (lines || []).forEach(function (line) {
      var m = ROLE_RE.exec(line);
      if (!m) { if (problems) problems.push(tr("سطر غير مفهوم في قسم اللجان والأدوار؛ سيُحذف إذا عدّلت هذا القسم.", "A line in the committees and roles block could not be read; it will be dropped if you edit that block.")); return; }
      items.push({ org: unesc(m[2]), orgAr: m[1] != null ? unesc(m[1]) : "", en: unesc(m[4]), ar: m[3] != null ? unesc(m[3]) : "" });
    });
    return items;
  }
  function renderRoles(items) {
    return "\n" + (items || []).map(function (it) {
      return '<article class="society-item"><span class="society-org"' + (str(it.orgAr) ? ' data-ar="' + escAttr(str(it.orgAr)) + '"' : "") + ">" +
        escText(str(it.org)) + '</span><span class="society-role"' + (str(it.ar) ? ' data-ar="' + escAttr(str(it.ar)) + '"' : "") + ">" +
        escText(str(it.en)) + "</span></article>";
    }).join("\n") + "\n";
  }

  /* ------------------------------------------------------------------ fonts block */
  function fontSpec(kind, name) {
    var list = FONTS[kind] || [];
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
    return { name: name, weights: [400, 700] };
  }
  function inFontList(kind, name) {
    return (FONTS[kind] || []).some(function (f) { return f.name === name; });
  }
  function parseFonts(html) {
    var block = findBlock(html || "", "dash:fonts");
    if (!block) return null;
    var en = /--font-en:\s*"([^"]*)"/.exec(block.inner);
    var ar = /--font-ar:\s*"([^"]*)"/.exec(block.inner);
    var head = /--font-head-en:\s*"([^"]*)"/.exec(block.inner);
    if (!en || !ar) return null;
    var headName = head ? head[1] : DEFAULT_FONTS.head;
    if (headName === en[1] && !inFontList("head", headName)) headName = "body";
    return { ar: ar[1], en: en[1], head: headName };
  }
  function fullFonts(fonts, fallback) {
    var f = fonts || {}, d = fallback || DEFAULT_FONTS;
    return { ar: str(f.ar) || d.ar, en: str(f.en) || d.en, head: str(f.head) || d.head || DEFAULT_FONTS.head };
  }
  function renderFonts(fonts) {
    function family(kind, name) {
      return "family=" + name.replace(/ /g, "+") + ":wght@" + fontSpec(kind, name).weights.join(";");
    }
    var f = fullFonts(fonts);
    var families = [];
    if (!fontSpec("en", f.en).system) families.push(family("en", f.en));
    if (!fontSpec("ar", f.ar).system) families.push(family("ar", f.ar));
    var headSpec = fontSpec("head", f.head);
    var headCss = headSpec.same ? f.en : f.head;
    if (!headSpec.system) families.push(family("head", f.head));
    var link = families.length ? '\n    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?' + families.join("&") + '&display=swap">' : "";
    return link + '\n    <style>:root{--font-en:"' + f.en + '";--font-ar:"' + f.ar + '";--font-head-en:"' + headCss + '";}</style>\n    ';
  }

  /* ------------------------------------------------------------------ colours and the theme block */
  function hexNorm(value) {
    var v = str(value).toLowerCase();
    var m = /^#?([0-9a-f]{3})$/.exec(v);
    if (m) return "#" + m[1].charAt(0) + m[1].charAt(0) + m[1].charAt(1) + m[1].charAt(1) + m[1].charAt(2) + m[1].charAt(2);
    m = /^#?([0-9a-f]{6})$/.exec(v);
    return m ? "#" + m[1] : null;
  }
  function rgbOf(hex) {
    var h = hexNorm(hex);
    if (!h) return null;
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function luminance(hex) {
    var c = rgbOf(hex);
    if (!c) return NaN;
    var l = c.map(function (v) {
      var x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  }
  /* WCAG contrast ratio of two colours (1 to 21). */
  function contrast(a, b) {
    var x = luminance(a), y = luminance(b);
    if (isNaN(x) || isNaN(y)) return NaN;
    var hi = Math.max(x, y), lo = Math.min(x, y);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  }
  function mixHex(a, b, t) {
    var x = rgbOf(a), y = rgbOf(b);
    if (!x || !y) return hexNorm(a) || hexNorm(b);
    return "#" + [0, 1, 2].map(function (i) {
      var v = Math.round(x[i] + (y[i] - x[i]) * t).toString(16);
      return v.length < 2 ? "0" + v : v;
    }).join("");
  }
  function rgbaOf(hex, alpha) {
    var c = rgbOf(hex);
    return "rgba(" + c[0] + ", " + c[1] + ", " + c[2] + ", " + alpha + ")";
  }
  function paletteById(id) {
    for (var i = 0; i < PALETTES.length; i++) if (PALETTES[i].id === id) return PALETTES[i];
    return null;
  }
  function customOf(values, mode) {
    var base = PALETTES[0][mode], out = {};
    CUSTOM_KEYS.forEach(function (k) { out[k] = hexNorm(values && values[k]) || base[k]; });
    return out;
  }
  function hasColours(values) {
    return !!values && CUSTOM_KEYS.some(function (k) { return hexNorm(values[k]); });
  }
  /* the owner's five colours -> the nine values a mode needs */
  function deriveMode(values, mode) {
    var c = customOf(values, mode);
    return {
      bg: c.bg, surface: c.surface, surface2: mixHex(c.bg, c.text, mode === "dark" ? 0.06 : 0.07), text: c.text,
      muted: mixHex(c.text, c.bg, 0.32), line: rgbaOf(c.text, mode === "dark" ? 0.1 : 0.13),
      accent: c.accent, link: c.link, green: PALETTES[0][mode].green,
    };
  }
  function accentText(accent) {
    return contrast(accent, "#ffffff") >= contrast(accent, "#10151a") ? "#ffffff" : "#10151a";
  }
  /* one rule that serves both pages: index.html names and publications.css names */
  function modeCss(mode, v) {
    return 'html:root[data-theme="' + mode + '"]{--bg:' + v.bg + ";--surface:" + v.surface + ";--surface2:" + v.surface2 + ";--surface-2:" + v.surface2 +
      ";--text:" + v.text + ";--muted:" + v.muted + ";--line:" + v.line + ";--gold:" + v.accent + ";--accent:" + v.accent + ";--accent-strong:" + v.accent +
      ";--amber:" + v.accent + ";--accent-text:" + accentText(v.accent) + ";--blue:" + v.link + ";--green:" + v.green + ";}";
  }
  function fiveOf(full) {
    var out = {};
    CUSTOM_KEYS.forEach(function (k) { out[k] = full[k]; });
    return out;
  }
  function fullTheme(theme) {
    var t = theme || {};
    var id = str(t.palette) || "default";
    if (id !== "custom") {
      var p = paletteById(id) || PALETTES[0];
      return { palette: p.id, light: fiveOf(p.light), dark: fiveOf(p.dark) };
    }
    var dark = customOf(t.dark, "dark");
    // a dark set equal to the site's own dark colours counts as "not given": no dark rule is written for it
    var given = hasColours(t.dark) && JSON.stringify(dark) !== JSON.stringify(fiveOf(PALETTES[0].dark));
    return { palette: "custom", light: customOf(t.light, "light"), dark: dark, _dark: given };
  }
  function renderTheme(theme) {
    var t = fullTheme(theme);
    if (t.palette === "default") return "\n    <style></style>\n    ";
    var css;
    if (t.palette === "custom") {
      var meta = { palette: "custom", light: t.light };
      if (t._dark) meta.dark = t.dark;
      css = "/*dash-theme:" + JSON.stringify(meta) + "*/" + modeCss("light", deriveMode(t.light, "light")) +
        (t._dark ? modeCss("dark", deriveMode(t.dark, "dark")) : "");
    } else {
      var p = paletteById(t.palette);
      css = '/*dash-theme:{"palette":"' + p.id + '"}*/' + modeCss("light", p.light) + modeCss("dark", p.dark);
    }
    return "\n    <style>" + css + "</style>\n    ";
  }
  function parseTheme(html) {
    var block = findBlock(html || "", "dash:theme");
    if (!block) return null;
    var m = /\/\*dash-theme:(\{[\s\S]*?\})\*\//.exec(block.inner);
    var meta = null;
    if (m) { try { meta = JSON.parse(m[1]); } catch (e) { meta = null; } }
    var t = fullTheme(meta || { palette: "default" });
    var out = { palette: t.palette, light: t.light, dark: t.dark };
    if (t.palette === "custom" && !t._dark) out.dark = fiveOf(PALETTES[0].dark);
    return out;
  }
  function themeWarnings(theme) {
    var t = fullTheme(theme), list = [];
    if (t.palette === "default") return list;
    var modes = [["light", tr("الوضع الفاتح", "light mode"), "#ffffff"]];
    if (t.palette !== "custom" || t._dark) modes.push(["dark", tr("الوضع الداكن", "dark mode"), "#10151a"]);
    modes.forEach(function (mode) {
      var v = t.palette === "custom" ? deriveMode(t[mode[0]], mode[0]) : paletteById(t.palette)[mode[0]];
      var pairs = [
        [v.text, v.bg, tr("لون النص على الخلفية", "text on the background")],
        [v.accent, v.bg, tr("اللون المميّز على الخلفية", "accent colour on the background")],
        [v.link, v.bg, tr("لون الروابط على الخلفية", "link colour on the background")],
        [mode[2], v.accent, tr("نص الأزرار على اللون المميّز", "button text on the accent colour")],
      ];
      pairs.forEach(function (pair) {
        var ratio = contrast(pair[0], pair[1]);
        if (ratio < 4.5) {
          list.push(tr("تباين ضعيف في " + mode[1] + ": " + pair[2] + " (" + ratio + " من 4.5 المطلوبة)، وقد تصعب القراءة.",
            "Low contrast in " + mode[1] + ": " + pair[2] + " (" + ratio + ", 4.5 needed); it may be hard to read."));
        }
      });
    });
    return list;
  }

  /* ------------------------------------------------------------------ lists: courses and the career timeline */
  var FLAGSHIP_RE = /^\s*<article class="flagship-course"><span>([^<]*)<\/span><strong(?: data-ar="([^"]*)")?>([^<]*)<\/strong><\/article>\s*$/;
  var COURSE_RE = /^\s*<article class="course-item"><span class="course-code">([^<]*)<\/span><strong(?: data-ar="([^"]*)")?>([^<]*)<\/strong><\/article>\s*$/;
  function parseCourses(lines, re, problems, label) {
    var items = [];
    (lines || []).forEach(function (line) {
      var m = re.exec(line);
      if (!m) { if (problems) problems.push(unreadLine(label)); return; }
      items.push({ code: unesc(m[1]), en: unesc(m[3]), ar: m[2] != null ? unesc(m[2]) : "" });
    });
    return items;
  }
  function renderCourses(items, flagship) {
    return "\n" + (items || []).map(function (it) {
      var name = "<strong" + (str(it.ar) ? ' data-ar="' + escAttr(str(it.ar)) + '"' : "") + ">" + escText(str(it.en)) + "</strong>";
      return flagship
        ? '<article class="flagship-course"><span>' + escText(str(it.code)) + "</span>" + name + "</article>"
        : '<article class="course-item"><span class="course-code">' + escText(str(it.code)) + "</span>" + name + "</article>";
    }).join("\n") + "\n";
  }
  var TIMELINE_RE = /^\s*<article class="role"><time>(.*?)<\/time><div><h3(?: data-ar="([^"]*)")?>([^<]*)<\/h3><p(?: data-ar="([^"]*)")?>([^<]*)<\/p><\/div><\/article>\s*$/;
  var PRESENT_SPAN = '<span data-ar="حتى الآن">Present</span>';
  function parseTimeline(lines, problems, label) {
    var items = [];
    (lines || []).forEach(function (line) {
      var m = TIMELINE_RE.exec(line);
      var time = m ? m[1].split(PRESENT_SPAN).join("Present") : "";
      if (!m || /</.test(time)) { if (problems) problems.push(unreadLine(label)); return; }
      items.push({
        time: unesc(time),
        title: { en: unesc(m[3]), ar: m[2] != null ? unesc(m[2]) : "" },
        text: { en: unesc(m[5]), ar: m[4] != null ? unesc(m[4]) : "" },
      });
    });
    return items;
  }
  function pair(value) {
    if (value && typeof value === "object") return { en: str(value.en), ar: str(value.ar) };
    return { en: str(value), ar: "" };
  }
  function renderTimeline(items) {
    return "\n" + (items || []).map(function (it) {
      var title = pair(it.title), text = pair(it.text);
      var time = escText(str(it.time)).replace(/Present$/, PRESENT_SPAN);
      return '<article class="role"><time>' + time + "</time><div><h3" + (title.ar ? ' data-ar="' + escAttr(title.ar) + '"' : "") + ">" + escText(title.en) +
        "</h3><p" + (text.ar ? ' data-ar="' + escAttr(text.ar) + '"' : "") + ">" + escText(text.en) + "</p></div></article>";
    }).join("\n") + "\n";
  }
  function unreadLine(label) {
    return tr("سطر غير مفهوم في قسم " + label.ar + "؛ سيُحذف إذا عدّلت هذا القسم.",
      "A line in the " + label.en + " block could not be read; it will be dropped if you edit that block.");
  }
  var LISTS = [
    { key: "flagship", block: "dash:courses-flagship", label: { ar: "المقررات الرئيسية", en: "flagship courses" },
      parse: function (lines, problems) { return parseCourses(lines, FLAGSHIP_RE, problems, this.label); },
      render: function (items) { return renderCourses(items, true); } },
    { key: "courses", block: "dash:courses", label: { ar: "المقررات", en: "courses" },
      parse: function (lines, problems) { return parseCourses(lines, COURSE_RE, problems, this.label); },
      render: function (items) { return renderCourses(items, false); } },
    { key: "timeline", block: "dash:timeline", label: { ar: "المسيرة المهنية", en: "career timeline" },
      parse: function (lines, problems) { return parseTimeline(lines, problems, this.label); },
      render: function (items) { return renderTimeline(items); } },
    { key: "timelineEarlier", block: "dash:timeline-earlier", label: { ar: "الأدوار السابقة", en: "earlier roles" },
      parse: function (lines, problems) { return parseTimeline(lines, problems, this.label); },
      render: function (items) { return renderTimeline(items); } },
  ];

  /* degrees and thesis titles (read only; used by the CV page) */
  function parseDegrees(html) {
    var list = [], re = /<article class="degree-card">([\s\S]*?)<\/article>/g, m;
    while ((m = re.exec(html || ""))) {
      var year = /class="degree-year">([^<]*)</.exec(m[1]);
      var title = /<h3[^>]*>([^<]*)<\/h3>/.exec(m[1]);
      var inst = /class="degree-institution"[^>]*>([^<]*)</.exec(m[1]);
      list.push({ year: year ? unesc(year[1]).trim() : "", title: title ? unesc(title[1]).trim() : "", institution: inst ? unesc(inst[1]).trim() : "" });
    }
    return list;
  }
  function parseTheses(html) {
    var list = [], re = /<div class="degree-detail"><small[^>]*>[^<]*<\/small><p[^>]*>([^<]*)<\/p><\/div>/g, m;
    while ((m = re.exec(html || ""))) list.push(unesc(m[1]).trim());
    return list;
  }

  /* ------------------------------------------------------------------ portrait */
  var PHOTO_FILE = "PhotoDrOmaia.webp";
  var PHOTO_TAG_RE = /<(?:img\b[^>]*\bid="portraitImage"[^>]*|link\b[^>]*\brel="preload"[^>]*)>/g;
  function readPhotoVersion(html) {
    var img = /<img\b[^>]*\bid="portraitImage"[^>]*>/.exec(html || "");
    var m = img ? /PhotoDrOmaia\.webp\?v=([0-9A-Za-z]+)"/.exec(img[0]) : null;
    return m ? m[1] : "";
  }
  function applyPhotoVersion(html, version) {
    var v = str(version).replace(/[^0-9A-Za-z]/g, "");
    return html.replace(PHOTO_TAG_RE, function (tag) {
      if (tag.indexOf(PHOTO_FILE) < 0) return tag;
      return tag.replace(/PhotoDrOmaia\.webp(?:\?v=[0-9A-Za-z]*)?(?=")/g, PHOTO_FILE + (v ? "?v=" + v : ""));
    });
  }

  /* ------------------------------------------------------------------ navigation and sections */
  var NAV_RE = /^\s*<a(?: data-ar="([^"]*)")? href="([^"]*)"( hidden)?>([^<]*)<\/a>\s*$/;
  function parseNavLines(lines, problems) {
    var items = [];
    (lines || []).forEach(function (line) {
      var m = NAV_RE.exec(line);
      if (!m) { if (problems) problems.push(unreadLine({ ar: "روابط التنقل", en: "navigation links" })); return; }
      items.push({ href: unesc(m[2]), en: unesc(m[4]), ar: m[1] != null ? unesc(m[1]) : "", hidden: !!m[3] });
    });
    return items;
  }
  function renderNav(items) {
    return "\n" + (items || []).map(function (it) {
      return "<a" + (str(it.ar) ? ' data-ar="' + escAttr(str(it.ar)) + '"' : "") + ' href="' + escAttr(str(it.href)) + '"' + (it.hidden ? " hidden" : "") + ">" +
        escText(str(it.en)) + "</a>";
    }).join("\n") + "\n";
  }
  /* The same links for another page (publications.html): section links become index.html#id; a link the page already has
     keeps its other attributes (the active Publications link). */
  function renderPageNav(items, currentInner) {
    var extra = {};
    String(currentInner || "").split("\n").forEach(function (line) {
      var m = /^\s*<a\b([^>]*)>[^<]*<\/a>\s*$/.exec(line);
      if (!m) return;
      var href = /\shref="([^"]*)"/.exec(m[1]);
      if (!href) return;
      extra[unesc(href[1])] = m[1].replace(/\s(?:data-ar|href)="[^"]*"/g, "").replace(/\shidden(?=\s|$)/g, "");
    });
    return "\n" + (items || []).map(function (it) {
      var href = str(it.href).charAt(0) === "#" ? "index.html" + str(it.href) : str(it.href);
      return "<a" + (extra[href] || "") + (str(it.ar) ? ' data-ar="' + escAttr(str(it.ar)) + '"' : "") + ' href="' + escAttr(href) + '"' + (it.hidden ? " hidden" : "") + ">" +
        escText(str(it.en)) + "</a>";
    }).join("\n") + "\n";
  }
  /* every <!-- dash:section ID --> … <!-- /dash:section ID --> unit, in page order */
  function sectionUnits(html) {
    var units = [], re = /<!-- dash:section ([a-z0-9-]+) -->/g, m;
    while ((m = re.exec(html || ""))) {
      var close = "<!-- /dash:section " + m[1] + " -->";
      var end = html.indexOf(close, m.index);
      if (end < 0) continue;
      units.push({ id: m[1], start: m.index, end: end + close.length, text: html.slice(m.index, end + close.length) });
      re.lastIndex = end + close.length;
    }
    return units;
  }
  var SECTION_TAG_RE = /<section\b[^>]*>/;
  function sectionHidden(unitText) {
    var tag = SECTION_TAG_RE.exec(unitText || "");
    return !!tag && /\shidden(?=[\s>=])/.test(tag[0]);
  }
  function setSectionHidden(unitText, hidden) {
    return unitText.replace(SECTION_TAG_RE, function (tag) {
      var bare = tag.replace(/\shidden(?:="[^"]*")?(?=[\s>])/g, "");
      return hidden ? bare.replace(/>$/, " hidden>") : bare;
    });
  }
  function attrPair(en, ar) {
    return (ar ? ' data-ar="' + escAttr(ar) + '"' : "") + ">" + escText(en);
  }
  function safeLink(value) {
    var v = str(value);
    if (!v) return "";
    if (/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(v)) return v;
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return ""; // any other scheme (javascript:, data: …) is refused
    return v;
  }
  function renderCustomSection(sec) {
    var kicker = pair(sec.kicker), title = pair(sec.title), intro = pair(sec.intro);
    var lines = [];
    lines.push("<!-- dash:section " + sec.id + " -->");
    lines.push('<section id="' + sec.id + '" class="custom-section"' + (sec.hidden ? " hidden" : "") + ">");
    lines.push('<div class="wrap">');
    lines.push('<div class="section-head"><div>' + (kicker.en || kicker.ar ? '<span class="kicker"' + attrPair(kicker.en, kicker.ar) + "</span>" : "") +
      "<h2" + attrPair(title.en, title.ar) + "</h2></div>" + (intro.en || intro.ar ? "" : "</div>"));
    if (intro.en || intro.ar) lines.push("<p" + attrPair(intro.en, intro.ar) + "</p></div>");
    lines.push('<div class="grid3">');
    (sec.cards || []).forEach(function (card) {
      var ct = pair(card.title), cx = pair(card.text), link = safeLink(card.link);
      lines.push('<article class="card"><h3' + attrPair(ct.en, ct.ar) + "</h3>" + (cx.en || cx.ar ? "<p" + attrPair(cx.en, cx.ar) + "</p>" : "") +
        (link ? '<a class="featured-link" data-ar="المزيد ↗" href="' + escAttr(link) + '"' + (/^https?:/i.test(link) ? ' target="_blank" rel="noopener"' : "") + ">More ↗</a>" : "") +
        "</article>");
    });
    lines.push("</div>");
    lines.push("</div>");
    lines.push("</section>");
    lines.push("<!-- /dash:section " + sec.id + " -->");
    return lines.join("\n");
  }
  var CUSTOM_HEAD_RE = /^<div class="section-head"><div>(?:<span class="kicker"(?: data-ar="([^"]*)")?>([^<]*)<\/span>)?<h2(?: data-ar="([^"]*)")?>([^<]*)<\/h2><\/div>(<\/div>)?$/;
  var CUSTOM_INTRO_RE = /^<p(?: data-ar="([^"]*)")?>([^<]*)<\/p><\/div>$/;
  var CUSTOM_CARD_RE = /^<article class="card"><h3(?: data-ar="([^"]*)")?>([^<]*)<\/h3>(?:<p(?: data-ar="([^"]*)")?>([^<]*)<\/p>)?(?:<a class="featured-link" data-ar="[^"]*" href="([^"]*)"[^>]*>[^<]*<\/a>)?<\/article>$/;
  function parseCustomSection(unit) {
    var lines = unit.text.split("\n");
    if (lines.length < 9 || !/^<section id="[a-z0-9-]+" class="custom-section"( hidden)?>$/.test(lines[1]) || lines[2] !== '<div class="wrap">') return null;
    var head = CUSTOM_HEAD_RE.exec(lines[3]);
    if (!head) return null;
    var at = 4, intro = { en: "", ar: "" };
    if (!head[5]) {
      var im = CUSTOM_INTRO_RE.exec(lines[at]);
      if (!im) return null;
      intro = { en: unesc(im[2]), ar: im[1] != null ? unesc(im[1]) : "" };
      at += 1;
    }
    if (lines[at] !== '<div class="grid3">') return null;
    at += 1;
    var cards = [];
    for (; at < lines.length && lines[at] !== "</div>"; at++) {
      var cm = CUSTOM_CARD_RE.exec(lines[at]);
      if (!cm) return null;
      cards.push({ title: { en: unesc(cm[2]), ar: cm[1] != null ? unesc(cm[1]) : "" },
        text: { en: cm[4] != null ? unesc(cm[4]) : "", ar: cm[3] != null ? unesc(cm[3]) : "" }, link: cm[5] != null ? unesc(cm[5]) : "" });
    }
    return {
      kicker: { en: head[2] != null ? unesc(head[2]) : "", ar: head[1] != null ? unesc(head[1]) : "" },
      title: { en: unesc(head[4]), ar: head[3] != null ? unesc(head[3]) : "" },
      intro: intro, cards: cards,
    };
  }
  function isCustomId(id) { return /^custom-\d+$/.test(String(id || "")); }
  function nextSectionId(sections, taken) {
    var max = 0;
    (sections || []).concat(taken || []).forEach(function (s) {
      var m = /^custom-(\d+)$/.exec(String((s && s.id) || s || ""));
      if (m && parseInt(m[1], 10) > max) max = parseInt(m[1], 10);
    });
    return "custom-" + (max + 1);
  }
  /* what the page says now: sections, and nav links (a link is "hidden" here only when it is hidden although its section shows) */
  function readSectionsNav(index, problems) {
    var units = sectionUnits(index);
    var rawNav = parseNavLines(blockLines(index, "dash:nav"), problems);
    var navBy = {};
    rawNav.forEach(function (it) { navBy[it.href] = it; });
    var hiddenBy = {};
    var sections = units.map(function (u) {
      var hidden = sectionHidden(u.text);
      hiddenBy["#" + u.id] = hidden;
      var custom = isCustomId(u.id) ? parseCustomSection(u) : null;
      if (isCustomId(u.id) && !custom && problems) {
        problems.push(tr("القسم " + u.id + " عُدّل يدوياً ولا يمكن قراءته كقسم خاص؛ سيبقى كما هو.",
          "Section " + u.id + " was edited by hand and cannot be read as a custom section; it is kept as it is."));
      }
      var link = navBy["#" + u.id];
      var sec = { id: u.id, title: { en: "", ar: "" }, hidden: hidden, custom: !!custom };
      if (custom) {
        sec.title = custom.title; sec.kicker = custom.kicker; sec.intro = custom.intro; sec.cards = custom.cards;
      } else if (link) {
        sec.title = { en: link.en, ar: link.ar };
      } else {
        var k = /<span class="kicker"(?: data-ar="([^"]*)")?>([^<]*)<\/span>/.exec(u.text);
        sec.title = k ? { en: unesc(k[2]), ar: k[1] != null ? unesc(k[1]) : "" } : { en: u.id, ar: "" };
      }
      return sec;
    });
    var nav = rawNav.map(function (it) {
      return { href: it.href, en: it.en, ar: it.ar, hidden: it.hidden && !hiddenBy[it.href] };
    });
    return { units: units, sections: sections, nav: nav, rawNav: rawNav };
  }
  /* the nav links that follow from the sections (order, hidden, custom links) and the owner's nav list (texts, extra links) */
  function composeNav(finalSections, navModel, origSections) {
    var navBy = {}, origBy = {};
    (navModel || []).forEach(function (it) { if (it && it.href != null) navBy[str(it.href)] = it; });
    (origSections || []).forEach(function (s) { origBy[s.id] = s; });
    var sectionHref = {};
    finalSections.forEach(function (s) { sectionHref["#" + s.id] = true; });
    var anchors = [];
    finalSections.forEach(function (sec) {
      var item = navBy["#" + sec.id];
      var title = pair(sec.title);
      var en, ar;
      if (sec.custom) { en = title.en; ar = title.ar; }
      else {
        if (!item) return; // a built-in section that never had a link
        var before = origBy[sec.id] ? pair(origBy[sec.id].title) : null;
        var retitled = before && title.en && (title.en !== before.en || title.ar !== before.ar);
        en = retitled ? title.en : str(item.en); ar = retitled ? title.ar : str(item.ar);
      }
      anchors.push({ href: "#" + sec.id, en: en, ar: ar, hidden: !!sec.hidden || !!(item && item.hidden) });
    });
    // links that are not sections (Publications…) keep their place: after the same number of section links as before
    var extras = [], seenAnchors = 0;
    (navModel || []).forEach(function (it) {
      if (!it || it.href == null) return;
      var href = str(it.href);
      if (sectionHref[href] || isCustomId(href.slice(1))) { if (sectionHref[href]) seenAnchors += 1; return; }
      extras.push({ after: seenAnchors, item: { href: href, en: str(it.en), ar: str(it.ar), hidden: !!it.hidden } });
    });
    var out = [], e = 0;
    for (var i = 0; i <= anchors.length; i++) {
      while (e < extras.length && extras[e].after <= i) { out.push(extras[e].item); e += 1; }
      if (i < anchors.length) out.push(anchors[i]);
    }
    while (e < extras.length) { out.push(extras[e].item); e += 1; }
    return out;
  }

  /* Apply model.sections / model.nav to index.html. Hidden = the hidden attribute; a built-in section is never deleted. */
  function applySections(index, model, warnings, summary, result) {
    var now = readSectionsNav(index);
    var hasNav = !!findBlock(index, "dash:nav");
    var saidBefore = summary.length;
    if (!now.units.length) {
      if (model.sections) warnings.push(missingMarker("dash:section", "index.html", tr("فلم تُحدَّث الأقسام", "so the sections were not updated")));
      return index;
    }
    var secModel = model.sections || now.sections;
    var navModel = model.nav || now.nav;
    var unitBy = {}, nowBy = {};
    now.units.forEach(function (u) { unitBy[u.id] = u; });
    now.sections.forEach(function (sec) { nowBy[sec.id] = sec; });
    var taken = now.units.map(function (u) { return u.id; });
    var finals = [], used = {};
    secModel.forEach(function (sec) {
      if (!sec) return;
      var id = str(sec.id);
      var custom = !!sec.custom || isCustomId(id);
      if (custom && id && unitBy[id] && !nowBy[id].custom) custom = false; // hand-edited custom section: kept as it is
      if (custom) {
        if (!isCustomId(id) || used[id]) { id = nextSectionId(finals, taken); taken.push(id); }
        used[id] = true;
        finals.push({ id: id, custom: true, hidden: !!sec.hidden, title: pair(sec.title), kicker: pair(sec.kicker), intro: pair(sec.intro), cards: sec.cards || [] });
        return;
      }
      if (!unitBy[id]) {
        warnings.push(tr("القسم «" + id + "» غير موجود في الصفحة الرئيسية، فتجاهلته.", "Section “" + id + "” is not on the home page, so it was ignored."));
        return;
      }
      if (used[id]) return;
      used[id] = true;
      finals.push({ id: id, custom: false, hidden: !!sec.hidden, title: sec.title });
    });
    // sections of the page that the model does not mention: built-in ones stay (at the end), custom ones are deleted
    now.units.forEach(function (u) {
      if (used[u.id] || nowBy[u.id].custom) return;
      used[u.id] = true;
      finals.push({ id: u.id, custom: false, hidden: nowBy[u.id].hidden, title: nowBy[u.id].title });
    });
    var texts = finals.map(function (sec) {
      return sec.custom ? renderCustomSection(sec) : setSectionHidden(unitBy[sec.id].text, sec.hidden);
    });
    // what changed, in words
    var label = function (sec) {
      var t = pair(sec.title);
      var before = nowBy[sec.id] ? pair(nowBy[sec.id].title) : { en: "", ar: "" };
      return tr(t.ar || before.ar || t.en || before.en || sec.id, t.en || before.en || sec.id);
    };
    var hiddenNow = [];
    finals.forEach(function (sec, i) {
      var before = nowBy[sec.id];
      if (!before) { summary.push(tr("أُضيف قسم جديد: ", "New section added: ") + label(sec)); return; }
      if (before.hidden !== sec.hidden) {
        summary.push((sec.hidden ? tr("أُخفي قسم: ", "Section hidden: ") : tr("أُظهر قسم: ", "Section shown: ")) + label(sec));
        if (sec.hidden) hiddenNow.push(sec);
      }
      if (sec.custom && setSectionHidden(texts[i], false) !== setSectionHidden(unitBy[sec.id].text, false)) summary.push(tr("عُدّل القسم: ", "Section edited: ") + label(sec));
    });
    now.sections.forEach(function (sec) {
      if (!used[sec.id]) summary.push(tr("حُذف القسم: ", "Section deleted: ") + label(sec));
    });
    var keptOrder = finals.filter(function (sec) { return nowBy[sec.id]; }).map(function (sec) { return sec.id; });
    var wasOrder = now.units.filter(function (u) { return used[u.id]; }).map(function (u) { return u.id; });
    if (keptOrder.join("|") !== wasOrder.join("|")) summary.push(tr("تغيّر ترتيب الأقسام.", "Section order changed."));
    // a newly hidden section that is still linked from elsewhere on the page
    hiddenNow.forEach(function (sec) {
      var u = unitBy[sec.id];
      var nav = findBlock(index, "dash:nav");
      var outside = index.slice(0, u.start) + index.slice(u.end);
      if (nav) outside = outside.replace(index.slice(nav.start, nav.end), "");
      if (outside.indexOf('href="#' + sec.id + '"') >= 0) {
        warnings.push(tr("القسم «" + label(sec) + "» مخفي، لكن ما زال في الصفحة رابط أو زر يشير إليه؛ عدّله من النصوص إن لزم.",
          "Section “" + label(sec) + "” is hidden, but a link or button on the page still points to it; change it if needed."));
      }
    });
    // write the sections
    var sameOrder = finals.length === now.units.length && finals.every(function (sec, i) { return sec.id === now.units[i].id; });
    if (sameOrder) {
      for (var i = now.units.length - 1; i >= 0; i--) {
        if (texts[i] !== now.units[i].text) index = index.slice(0, now.units[i].start) + texts[i] + index.slice(now.units[i].end);
      }
    } else {
      var tails = {};
      now.units.forEach(function (u, k) {
        if (k === now.units.length - 1) return;
        var gap = index.slice(u.end, now.units[k + 1].start);
        if (/\S/.test(gap)) tails[u.id] = gap; // anything written between two sections moves with the one before it
      });
      var body = finals.map(function (sec, k) { return texts[k] + (tails[sec.id] || ""); }).join("\n");
      index = index.slice(0, now.units[0].start) + body + index.slice(now.units[now.units.length - 1].end);
    }
    // navigation links
    if (result) result.nav = composeNav(finals, navModel, now.sections);
    if (hasNav) {
      var nextNav = renderNav(composeNav(finals, navModel, now.sections));
      if (nextNav !== renderNav(now.rawNav)) {
        index = setBlock(index, "dash:nav", nextNav);
        // said only when the links changed on their own (a section change already explains it)
        if (summary.length === saidBefore) summary.push(tr("حُدّثت روابط التنقل.", "Navigation links updated."));
      }
    } else if (model.nav) warnings.push(missingMarker("dash:nav", "index.html", tr("فلم تُحدَّث روابط التنقل", "so the navigation links were not updated")));
    return index;
  }

  /* ------------------------------------------------------------------ citations */
  function hIndex(countsList) {
    var ordered = countsList.slice().sort(function (a, b) { return b - a; });
    var h = 0;
    for (var i = 0; i < ordered.length; i++) { if (ordered[i] >= i + 1) h = i + 1; else break; }
    return h;
  }
  function shownCitations(row) {
    if (!row) return 0;
    if (typeof row.crossref === "number") return row.crossref;
    if (typeof row.openalex === "number") return row.openalex;
    return 0;
  }
  function readCitations(works, metrics) {
    var rows = {};
    ((metrics && metrics.per_work) || []).forEach(function (r) { if (r && r.doi) rows[String(r.doi).toLowerCase()] = r; });
    var out = {};
    (works || []).forEach(function (w) {
      var key = doiKey(normalizeDoi(w.doi));
      if (key) out[key] = shownCitations(rows[key]);
    });
    return out;
  }

  /* ------------------------------------------------------------------ the CV module (admin/cv.js), when it is there */
  var cvModule; // undefined = not looked up yet, null = not available
  function getCV() {
    var g = typeof self !== "undefined" ? self : typeof globalThis !== "undefined" ? globalThis : null;
    if (g && g.DashCV && typeof g.DashCV.build === "function") return g.DashCV;
    if (cvModule !== undefined) return cvModule;
    cvModule = null;
    if (typeof module === "object" && module.exports && typeof require === "function") {
      try {
        var loaded = require("./cv.js");
        if (loaded && typeof loaded.build === "function" && typeof loaded.read === "function") cvModule = loaded;
      } catch (e) { cvModule = null; }
    }
    return cvModule;
  }
  function setCV(mod) { cvModule = mod === undefined ? undefined : mod; }

  /* ------------------------------------------------------------------ the ChatGPT achievements list ("ITEM n" format) */
  var ACH_FIELDS = [
    ["category", /^category$/i], ["titleEn", /^title\s*\(\s*(english|en)\s*\)$/i], ["titleAr", /^title\s*\(\s*(arabic|ar)\s*\)$/i],
    ["organisation", /^organi[sz]ation$/i], ["role", /^(my\s+)?role$/i], ["date", /^date$/i], ["evidence", /^evidence$/i],
    ["link", /^public\s+link$/i], ["confidence", /^confidence$/i], ["suggest", /^suggest(ion)?$/i], ["why", /^why$/i],
  ];
  function parseAchievements(text) {
    var items = [], askMe = [], numbers = [], total = null;
    var current = null, lastKey = null, mode = "items";
    function clean(line) {
      return line.replace(/^\s*(?:[-*•]\s+|\d+[.)]\s+)?/, "").replace(/\*\*/g, "").replace(/^\x60+|\x60+$/g, "").trim();
    }
    String(text == null ? "" : text).replace(/\r/g, "").split("\n").forEach(function (raw) {
      var line = raw.replace(/\*\*/g, "").trim();
      if (!line || /^\x60{3}/.test(line)) { lastKey = null; return; }
      var m = /^#*\s*ITEM\s+(\d+)\s*:?\s*$/i.exec(line);
      if (m) {
        current = { n: parseInt(m[1], 10), category: "", titleEn: "", titleAr: "", organisation: "", role: "", date: "", year: null,
          evidence: "", link: null, confidence: "", suggest: "", why: "" };
        items.push(current); mode = "items"; lastKey = null;
        return;
      }
      if (/^#*\s*ASK\s+ME\s*:?\s*$/i.test(line)) { mode = "ask"; current = null; return; }
      if (/^#*\s*NUMBERS\s*:?\s*$/i.test(line)) { mode = "numbers"; current = null; return; }
      m = /^total\s+items\s*:\s*(\d+)/i.exec(line);
      if (m) { total = parseInt(m[1], 10); mode = "done"; current = null; return; }
      if (mode === "ask" || mode === "numbers") {
        var entry = clean(raw);
        if (!entry) return;
        var list = mode === "ask" ? askMe : numbers;
        if (/^\s*(?:[-*•]|\d+[.)])\s+/.test(raw) || !list.length) list.push(entry);
        else list[list.length - 1] += " " + entry;
        return;
      }
      if (mode !== "items" || !current) return;
      var f = /^(?:[-*•]\s+)?([^:：]{2,40})[:：]\s*(.*)$/.exec(line);
      var key = null;
      if (f) {
        var name = f[1].trim();
        for (var i = 0; i < ACH_FIELDS.length; i++) if (ACH_FIELDS[i][1].test(name)) { key = ACH_FIELDS[i][0]; break; }
      }
      if (key) { current[key] = f[2].trim(); lastKey = key; }
      else if (lastKey) current[lastKey] = (String(current[lastKey] || "") + " " + line).trim();
    });
    items.forEach(function (it) {
      var y = /\b(19|20)\d{2}\b/.exec(it.date || "");
      it.year = y ? parseInt(y[0], 10) : null;
      var link = str(it.link);
      var url = /https?:\/\/[^\s)>\]]+/.exec(link);
      it.link = url ? url[0].replace(/[.,;]+$/, "") : null;
      var s = str(it.suggest).toLowerCase();
      it.suggestKind = /both/.test(s) ? "both" : /skip|none/.test(s) ? "skip" : /web\s*site|site/.test(s) ? "website" : /cv/.test(s) ? "cv" : "";
    });
    var result = items.slice();
    result.items = items;
    result.askMe = askMe;
    result.numbers = numbers;
    result.total = total;
    return result;
  }

  function renderYears(years) {
    return "\n" + years.map(function (y) { return '<option value="' + y + '">' + y + "</option>"; }).join("\n") + "\n";
  }

  var THEME_LI_RE = /^(\s*<li><a data-ar="[^"]*? · )(\d+)([^"]*" href="publications\.html\?theme=)([^"]*)(">[^<]*? · )(\d+)([^<]*<\/a><\/li>\s*)$/;
  function renderThemes(inner, themeCounts) {
    return inner.split("\n").map(function (line) {
      var m = THEME_LI_RE.exec(line);
      if (!m) return line;
      var name;
      try { name = decodeURIComponent(m[4]); } catch (e) { return line; }
      var n = themeCounts[name] || 0;
      return m[1] + n + m[3] + m[4] + m[5] + n + m[7];
    }).join("\n");
  }

  function venueFromReference(work) {
    var ref = str(work.reference);
    var title = str(work.title).toLowerCase();
    var after = ref.replace(/^[\s\S]*?\(\d{4}[a-z]?\)\.\s*/, "");
    var lower = after.toLowerCase();
    var at = title ? lower.indexOf(title) : -1;
    if (at >= 0) after = after.slice(at + title.length);
    else after = after.replace(/^[^.]*\.\s*/, "");
    after = after.replace(/^[\s.:]+/, "");
    // subtitle after the title, when the reference carries one the title does not
    if (at >= 0 && /^[A-Za-z]/.test(after) === false) after = after.replace(/^[^.]*\.\s*/, "");
    var m = /^In\s+(.+?)\s*\(pp\./.exec(after) || /^In\s+(.+?)\./.exec(after);
    if (m) return m[1].trim();
    m = /^(.+?)(?:,\s*\d|\.\s*$|\.\s*https?:)/.exec(after);
    return m ? m[1].trim() : "";
  }
  function latestList(works, metrics) {
    var prev = {};
    ((metrics && metrics.latest) || []).forEach(function (e) { prev[e.id] = e; });
    var rows = {};
    ((metrics && metrics.per_work) || []).forEach(function (r) { rows[r.id] = r; });
    return works.slice().sort(function (a, b) {
      if (a.year !== b.year) return b.year - a.year;
      return idNumber(b.id) - idNumber(a.id);
    }).slice(0, LATEST_COUNT).map(function (w) {
      var venue = str(w.venue) || (prev[w.id] && prev[w.id].venue) || (rows[w.id] && rows[w.id].venue) || venueFromReference(w) || null;
      return { id: w.id, title: w.title, year: w.year, doi: doiKey(w.doi), venue: venue };
    });
  }
  function latestMarkup(latest, orcidNew) {
    var items = [];
    (latest || []).forEach(function (w) {
      var title = escAttr(w.title);
      var link = w.doi ? '<a href="https://doi.org/' + escAttr(w.doi) + '" target="_blank" rel="noopener">' + title + "</a>" : title;
      var venue = w.venue ? ' <span class="latest-venue" lang="en">' + escAttr(w.venue) + "</span>" : "";
      items.push('<li><time datetime="' + w.year + '">' + w.year + '</time> <span class="latest-title" lang="en" dir="ltr">' + link + "</span>" + venue + "</li>");
    });
    (orcidNew || []).forEach(function (w) {
      var year = escAttr(String(w.year || ""));
      items.push('<li><time datetime="' + year + '">' + year + '</time> <span class="latest-title" lang="en" dir="ltr"><a href="https://doi.org/' +
        escAttr(w.doi) + '" target="_blank" rel="noopener">' + escAttr(w.title) + '</a></span> ' +
        '<span class="latest-new" data-ar="جديد على ORCID · بانتظار التحقق">New on ORCID · pending verification</span></li>');
    });
    return "\n" + items.join("\n") + "\n";
  }

  /* ------------------------------------------------------------------ free texts (elements with data-ar and text only) */
  var TEXT_ITEM_RE = /<([a-zA-Z][a-zA-Z0-9]*)((?:\s[^<>]*?)?)\sdata-ar="([^"]*)"([^<>]*)>([^<]*)<\/\1\s*>/g;
  function excludedRanges(html) {
    var ranges = [];
    var re = /<!-- ((?:dash:[a-z-]+)|metrics:latest) -->/g;
    var m;
    while ((m = re.exec(html))) {
      var close = "<!-- /" + m[1] + " -->";
      var end = html.indexOf(close, m.index);
      if (end < 0) continue;
      ranges.push([m.index, end + close.length]);
      re.lastIndex = end + close.length;
    }
    sectionUnits(html).forEach(function (u) { if (isCustomId(u.id)) ranges.push([u.start, u.end]); });
    var tags = /<(script|style)\b[\s\S]*?<\/\1\s*>/gi;
    while ((m = tags.exec(html))) ranges.push([m.index, m.index + m[0].length]);
    var cards = /<article\b[^>]*class="publication-card"[\s\S]*?<\/article>/g;
    while ((m = cards.exec(html))) ranges.push([m.index, m.index + m[0].length]);
    return ranges;
  }
  function listTexts(page, html) {
    var ranges = excludedRanges(html);
    var items = [];
    var m;
    TEXT_ITEM_RE.lastIndex = 0;
    while ((m = TEXT_ITEM_RE.exec(html))) {
      var start = m.index, end = m.index + m[0].length;
      var inside = ranges.some(function (r) { return start >= r[0] && start < r[1]; });
      if (inside) continue;
      if (m[5].trim() === "" && m[3].trim() === "") continue;
      items.push({
        id: page + "#" + items.length, page: page, tag: m[1].toLowerCase(), en: unesc(m[5]), ar: unesc(m[3]),
        _start: start, _end: end, _tag: m[1], _before: m[2], _after: m[4], _close: m[0].slice(m[0].lastIndexOf("</")),
      });
    }
    return items;
  }
  function applyTexts(page, html, modelTexts) {
    var originals = listTexts(page, html);
    var byId = {};
    (modelTexts || []).forEach(function (t) { if (t && t.page === page) byId[t.id] = t; });
    var edits = [];
    originals.forEach(function (o) {
      var t = byId[o.id];
      if (!t) return;
      var en = t.en == null ? o.en : String(t.en), ar = t.ar == null ? o.ar : String(t.ar);
      if (en === o.en && ar === o.ar) return;
      var enAttr = function (attrs) {
        return attrs.replace(/(\sdata-en=")[^"]*(")/, function (x, a, b) { return a + escAttr(en) + b; });
      };
      var text = "<" + o._tag + enAttr(o._before) + ' data-ar="' + escAttr(ar) + '"' + enAttr(o._after) + ">" + escText(en) + o._close;
      edits.push({ start: o._start, end: o._end, text: text });
    });
    edits.sort(function (a, b) { return b.start - a.start; });
    edits.forEach(function (e) { html = html.slice(0, e.start) + e.text + html.slice(e.end); });
    return { html: html, count: edits.length };
  }

  /* ------------------------------------------------------------------ count and date phrases */
  // Each rule: [label shown in a warning, regular expression, replacement builder]. Numbers are matched with \d+ so a page
  // that is out of step with the catalogue is repaired as well.
  function countRules(page, c) {
    var n = String(c.works);
    var range = function (all, a, b) { return n + a + c.firstYear + b + c.lastYear; };
    var one = function (all, a, b) { return a + n + (typeof b === "string" ? b : ""); };
    if (page === "index.html") {
      return [
        ["six themes and N peer-reviewed works", /(six themes and )\d+( peer-reviewed works)/g, one],
        ["ستة موضوعات وN عملاً محكّماً", /(موضوعات و)\d+( عملاً محكّماً)/g, one],
        ["Explore all N verified works", /(Explore all )\d+( verified works)/g, one],
        ["استعراض الأعمال الموثقة الـN", /(الأعمال الموثقة الـ)\d+/g, one],
      ];
    }
    return [
      ["Search and explore N verified works", /(Search and explore )\d+( verified works)/g, one],
      ["ابحث واستعرض N عملاً موثقاً", /(ابحث واستعرض )\d+( عملاً موثقاً)/g, one],
      ["A searchable portfolio of N verified works", /(A searchable portfolio of )\d+( verified works)/g, one],
      ["محفظة قابلة للبحث تضم N عملاً موثقاً", /(محفظة قابلة للبحث تضم )\d+( عملاً موثقاً)/g, one],
      ["N peer-reviewed works, YYYY–YYYY", /\d+( peer-reviewed works, )\d{4}(–)\d{4}/g, range],
      ["N عملاً محكّماً، YYYY–YYYY", /\d+( عملاً محكّماً، )\d{4}(–)\d{4}/g, range],
      ["Answers from the N works only", /(Answers from the )\d+( works only)/g, one],
      ["إجابات من الأعمال الـN فقط", /(إجابات من الأعمال الـ)\d+( فقط)/g, one],
      ["All N verified works", /(All )\d+( verified works)/g, one],
      ["جميع الأعمال الموثقة وعددها N", /(جميع الأعمال الموثقة وعددها )\d+/g, one],
      ["N of N results", /\d+( of )\d+( results)/g, function (all, a, b) { return n + a + n + b; }],
      ["N نتيجة من N", /\d+( نتيجة من )\d+/g, function (all, a) { return n + a + n; }],
    ];
  }
  function cutoffRules(iso) {
    var en = dateEn(iso), ar = dateAr(iso);
    var enDate = "\\d{1,2} [A-Za-z]+ \\d{4}", arDate = "\\d{1,2} [^\\s\"<،.]+ \\d{4}";
    return [
      ["with a verification cutoff of DATE", new RegExp("(with a verification cutoff of )" + enDate, "g"), function (all, a) { return a + en; }],
      ["records through DATE", new RegExp("(records through )" + enDate, "g"), function (all, a) { return a + en; }],
      ["وCrossref حتى DATE", new RegExp("(Crossref حتى )" + arDate, "g"), function (all, a) { return a + ar; }],
      ["Verification cutoff: DATE", new RegExp("(Verification cutoff: )" + enDate, "g"), function (all, a) { return a + en; }],
      ["تاريخ التحقق: DATE", new RegExp("(تاريخ التحقق: )" + arDate, "g"), function (all, a) { return a + ar; }],
    ];
  }
  function applyRules(page, html, rules, warnings) {
    rules.forEach(function (rule) {
      var found = false;
      html = html.replace(rule[1], function () {
        found = true;
        return rule[2].apply(null, arguments);
      });
      if (!found) warnings.push(tr("لم أجد العبارة «" + rule[0] + "» في " + page + "، فلم تُحدَّث.", "The phrase “" + rule[0] + "” was not found in " + page + ", so it was not updated."));
    });
    return html;
  }
  function touchUpdated(html, iso) {
    var p = iso.split("-");
    var en = MONTHS_EN[parseInt(p[1], 10) - 1] + " " + p[0], ar = MONTHS_AR[parseInt(p[1], 10) - 1] + " " + p[0];
    html = html.replace(/(Profile last updated: )[A-Za-z]+ \d{4}/g, function (all, a) { return a + en; });
    html = html.replace(/(آخر تحديث للملف: )[^\s"<]+ \d{4}/g, function (all, a) { return a + ar; });
    return html;
  }
  function touchDateModified(html, iso) {
    var done = false;
    return html.replace(/("dateModified":\s*")\d{4}-\d{2}-\d{2}(")/, function (all, a, b) {
      if (done) return all;
      done = true;
      return a + iso + b;
    });
  }
  function touchSitemap(xml, locs, iso) {
    locs.forEach(function (loc) {
      var re = new RegExp("(<loc>" + reEsc(loc) + "</loc>\\s*<lastmod>)[^<]*(</lastmod>)");
      xml = xml.replace(re, function (all, a, b) { return a + iso + b; });
    });
    return xml;
  }

  /* JSON-LD list in publications.html */
  var LD_RE = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/;
  function ldItem(work, position, template) {
    var author = template && template.item && template.item.author ? template.item.author : {
      "@type": "Person", name: "Omaia Al-Omari",
      sameAs: ["https://scholar.google.com/citations?user=TJnHJX8AAAAJ", "https://orcid.org/0000-0002-1638-1771"],
    };
    return {
      "@type": "ListItem", position: position,
      item: {
        "@type": "ScholarlyArticle", name: work.title, datePublished: String(work.year),
        url: work.doi || "https://dromaia.github.io/publications.html#" + String(work.id).toLowerCase(),
        author: clone(author),
      },
    };
  }

  /* ------------------------------------------------------------------ read */
  function readInternal(files) {
    var problems = [];
    var index = files["index.html"] || "";
    var pubs = files["publications.html"] || "";
    var works = [];
    var parsed = null;
    if (files["research-data.js"]) {
      try {
        parsed = parseData(files["research-data.js"]);
        works = (parsed.data.works || []).map(function (w) { return clone(w); });
      } catch (e) {
        problems.push(tr("تعذّرت قراءة ملف الأبحاث research-data.js.", "The publications file research-data.js could not be read."));
      }
    } else problems.push(tr("ملف الأبحاث research-data.js غير موجود.", "The publications file research-data.js is missing."));
    ["dash:fonts", "dash:theme", "dash:metrics", "dash:news", "dash:roles", "dash:themes", "dash:nav", "dash:courses-flagship", "dash:courses",
      "dash:timeline", "dash:timeline-earlier", "metrics:latest"].forEach(function (name) {
      if (index && !findBlock(index, name)) problems.push(missingMarker(name, "index.html"));
    });
    ["dash:fonts", "dash:theme", "dash:cards", "dash:years"].forEach(function (name) {
      if (pubs && !findBlock(pubs, name)) problems.push(missingMarker(name, "publications.html"));
    });
    var metrics = parseMetrics(blockLines(index, "dash:metrics"), problems);
    var news = parseNews(blockLines(index, "dash:news"), problems);
    var roles = parseRoles(blockLines(index, "dash:roles"), problems);
    var fonts = parseFonts(index) || parseFonts(pubs) || clone(DEFAULT_FONTS);
    var theme = parseTheme(index) || parseTheme(pubs) || fullTheme(null);
    delete theme._dark;
    var lists = {};
    LISTS.forEach(function (list) { lists[list.key] = list.parse(blockLines(index, list.block), problems); });
    var sn = readSectionsNav(index, problems);
    if (index && !sn.units.length) problems.push(missingMarker("dash:section", "index.html"));
    var metricsJson = null;
    if (typeof files["data/metrics.json"] === "string") { try { metricsJson = JSON.parse(files["data/metrics.json"]); } catch (e) { metricsJson = null; } }
    var cv = null, cvMod = getCV();
    if (cvMod && typeof files["cv.html"] === "string") {
      try { cv = cvMod.read(files["cv.html"]); }
      catch (e) { problems.push(tr("تعذّرت قراءة صفحة السيرة cv.html.", "The CV page cv.html could not be read.")); }
    }
    var texts = listTexts("index.html", index).concat(listTexts("publications.html", pubs));
    return {
      works: works, metrics: metrics, news: news, roles: roles, fonts: fonts, theme: theme, lists: lists, sections: sn.sections, nav: sn.nav,
      units: sn.units, photoVersion: readPhotoVersion(index), citations: readCitations(works, metricsJson), degrees: parseDegrees(index),
      theses: parseTheses(index), cv: cv, texts: texts, problems: problems, parsed: parsed,
    };
  }
  function read(files) {
    var r = readInternal(files || {});
    var model = {
      works: r.works,
      metrics: r.metrics,
      news: r.news,
      roles: r.roles,
      fonts: r.fonts,
      theme: r.theme,
      sections: r.sections,
      nav: r.nav,
      flagship: r.lists.flagship,
      courses: r.lists.courses,
      timeline: r.lists.timeline,
      timelineEarlier: r.lists.timelineEarlier,
      photoVersion: r.photoVersion,
      citations: r.citations,
      degrees: r.degrees,
      theses: r.theses,
      texts: r.texts.map(function (t) { return { id: t.id, page: t.page, tag: t.tag, en: t.en, ar: t.ar }; }),
      warnings: r.problems,
    };
    if (r.cv) model.cv = r.cv;
    return model;
  }

  /* ------------------------------------------------------------------ validate */
  function validate(model) {
    var errors = [];
    var m = model || {};
    var seen = {};
    (m.works || []).forEach(function (w, i) {
      var label = tr("البحث ", "Work ") + (str(w.id) || tr("رقم ", "no. ") + (i + 1));
      if (!/^P\d{2,}$/.test(str(w.id))) errors.push(label + tr(": المعرّف يجب أن يكون مثل P41.", ": the id must look like P41."));
      else if (seen[w.id]) errors.push(label + tr(": المعرّف مكرر.", ": the id is used twice."));
      seen[w.id] = true;
      if (!str(w.title)) errors.push(label + tr(": العنوان مطلوب.", ": the title is required."));
      var year = parseInt(w.year, 10);
      if (!/^\d{4}$/.test(str(w.year)) || year < 1990 || year > 2100) errors.push(label + tr(": السنة يجب أن تكون أربعة أرقام.", ": the year must be four digits."));
      if (!TYPES.some(function (t) { return t.en === w.type; })) errors.push(label + tr(": اختر نوع العمل.", ": choose the type of work."));
      if (!THEMES.some(function (t) { return t.en === w.theme; })) errors.push(label + tr(": اختر الموضوع البحثي.", ": choose the research theme."));
      var methods = Array.isArray(w.methods) ? w.methods.filter(function (x) { return str(x); }) : [];
      if (!methods.length) errors.push(label + tr(": أضف منهجية واحدة على الأقل.", ": add at least one method."));
      if (!str(w.contribution)) errors.push(label + tr(": وصف المساهمة مطلوب.", ": the contribution text is required."));
      if (!str(w.reference)) errors.push(label + tr(": مرجع APA مطلوب.", ": the APA reference is required."));
      var doi = str(w.doi);
      if (doi && !/^https?:\/\/\S+$/.test(normalizeDoi(doi) || "")) errors.push(label + tr(": رقم DOI أو الرابط غير صحيح.", ": the DOI or link is not valid."));
    });
    (m.metrics || []).forEach(function (it, i) {
      if (it.auto !== "works" && !str(it.value)) errors.push(tr("الأرقام (", "Numbers (") + (i + 1) + tr("): القيمة مطلوبة.", "): the value is required."));
      if (!str(it.en)) errors.push(tr("الأرقام (", "Numbers (") + (i + 1) + tr("): الاسم بالإنجليزية مطلوب.", "): the English label is required."));
    });
    (m.news || []).forEach(function (it, i) {
      if (!/^\d{4}$/.test(str(it.year))) errors.push(tr("المستجدات (", "News (") + (i + 1) + tr("): السنة يجب أن تكون أربعة أرقام.", "): the year must be four digits."));
      if (!str(it.en)) errors.push(tr("المستجدات (", "News (") + (i + 1) + tr("): النص بالإنجليزية مطلوب.", "): the English text is required."));
    });
    (m.roles || []).forEach(function (it, i) {
      if (!str(it.org)) errors.push(tr("اللجان والأدوار (", "Committees and roles (") + (i + 1) + tr("): اسم الجهة مطلوب.", "): the organisation is required."));
      if (!str(it.en)) errors.push(tr("اللجان والأدوار (", "Committees and roles (") + (i + 1) + tr("): الدور بالإنجليزية مطلوب.", "): the English role is required."));
    });
    if (m.fonts) {
      if (!inFontList("ar", m.fonts.ar)) errors.push(tr("الخط العربي غير موجود في القائمة.", "The Arabic font is not in the list."));
      if (!inFontList("en", m.fonts.en)) errors.push(tr("الخط الإنجليزي غير موجود في القائمة.", "The English font is not in the list."));
      if (m.fonts.head != null && str(m.fonts.head) !== "" && !inFontList("head", m.fonts.head)) {
        errors.push(tr("خط العناوين غير موجود في القائمة.", "The heading font is not in the list."));
      }
    }
    if (m.theme) {
      var palette = str(m.theme.palette) || "default";
      if (palette !== "custom" && !paletteById(palette)) errors.push(tr("باقة الألوان غير موجودة في القائمة.", "The colour palette is not in the list."));
      if (palette === "custom") {
        [["light", tr("الوضع الفاتح", "light mode")], ["dark", tr("الوضع الداكن", "dark mode")]].forEach(function (mode) {
          var values = m.theme[mode[0]] || {};
          CUSTOM_KEYS.forEach(function (k) {
            if (values[k] != null && str(values[k]) !== "" && !hexNorm(values[k])) {
              errors.push(tr("الألوان (" + mode[1] + "): اللون «" + values[k] + "» غير صحيح؛ اكتبه مثل #7a5a12.",
                "Colours (" + mode[1] + "): “" + values[k] + "” is not a valid colour; write it like #7a5a12."));
            }
          });
        });
      }
    }
    var seenSection = {};
    (m.sections || []).forEach(function (sec, i) {
      var name = tr("الأقسام (", "Sections (") + (i + 1) + ")";
      var id = str(sec && sec.id);
      if (id) {
        if (seenSection[id]) errors.push(name + tr(": القسم مكرر.", ": the section is listed twice."));
        seenSection[id] = true;
      }
      var custom = !!(sec && (sec.custom || isCustomId(id)));
      if (!custom) {
        if (BUILTIN_SECTIONS.indexOf(id) < 0 && !id) errors.push(name + tr(": قسم غير معروف.", ": unknown section."));
        return;
      }
      if (id && !isCustomId(id)) errors.push(name + tr(": معرّف القسم الخاص يجب أن يكون مثل custom-1.", ": a custom section id must look like custom-1."));
      if (!pair(sec.title).en) errors.push(name + tr(": عنوان القسم بالإنجليزية مطلوب.", ": the English title is required."));
      (sec.cards || []).forEach(function (card, j) {
        if (!pair(card.title).en) errors.push(name + tr("، البطاقة " + (j + 1) + ": العنوان بالإنجليزية مطلوب.", ", card " + (j + 1) + ": the English title is required."));
        if (str(card.link) && !safeLink(card.link)) errors.push(name + tr("، البطاقة " + (j + 1) + ": الرابط غير صحيح.", ", card " + (j + 1) + ": the link is not valid."));
        if (/[\s"<>]/.test(str(card.link))) errors.push(name + tr("، البطاقة " + (j + 1) + ": الرابط يحتوي مسافة أو رمزاً غير مسموح.", ", card " + (j + 1) + ": the link has a space or a character that is not allowed."));
      });
    });
    (m.nav || []).forEach(function (it, i) {
      var name = tr("روابط التنقل (", "Navigation (") + (i + 1) + ")";
      if (!str(it.href)) errors.push(name + tr(": الرابط مطلوب.", ": the link is required."));
      else if (!safeLink(it.href) || /[\s"<>]/.test(str(it.href))) errors.push(name + tr(": الرابط غير صحيح.", ": the link is not valid."));
      if (!str(it.en) && !isCustomId(str(it.href).slice(1))) errors.push(name + tr(": النص بالإنجليزية مطلوب.", ": the English text is required."));
    });
    [["flagship", tr("المقررات الرئيسية", "Flagship courses")], ["courses", tr("المقررات", "Courses")]].forEach(function (list) {
      (m[list[0]] || []).forEach(function (it, i) {
        if (!str(it.code)) errors.push(list[1] + " (" + (i + 1) + ")" + tr(": رمز المقرر مطلوب.", ": the course code is required."));
        if (!str(it.en)) errors.push(list[1] + " (" + (i + 1) + ")" + tr(": اسم المقرر بالإنجليزية مطلوب.", ": the English course name is required."));
      });
    });
    [["timeline", tr("المسيرة المهنية", "Career timeline")], ["timelineEarlier", tr("الأدوار السابقة", "Earlier roles")]].forEach(function (list) {
      (m[list[0]] || []).forEach(function (it, i) {
        if (!str(it.time)) errors.push(list[1] + " (" + (i + 1) + ")" + tr(": الفترة الزمنية مطلوبة.", ": the period is required."));
        else if (/[<>]/.test(str(it.time))) errors.push(list[1] + " (" + (i + 1) + ")" + tr(": الفترة الزمنية تحتوي رمزاً غير مسموح.", ": the period has a character that is not allowed."));
        if (!pair(it.title).en) errors.push(list[1] + " (" + (i + 1) + ")" + tr(": المسمى بالإنجليزية مطلوب.", ": the English title is required."));
      });
    });
    if (m.photoVersion != null && str(m.photoVersion) !== "" && !/^[0-9A-Za-z]{1,20}$/.test(str(m.photoVersion))) {
      errors.push(tr("رقم نسخة الصورة غير صحيح.", "The portrait version is not valid."));
    }
    if (m.citations && typeof m.citations === "object") {
      Object.keys(m.citations).forEach(function (key) {
        var n = m.citations[key];
        if (n == null || n === "") return;
        if (typeof n !== "number" || !isFinite(n) || n < 0 || Math.floor(n) !== n) {
          errors.push(tr("الاستشهادات: القيمة غير صحيحة للبحث " + key + ".", "Citations: the value for " + key + " is not valid."));
        }
      });
    }
    (m.texts || []).forEach(function (t) {
      if (t && t.en != null && !str(t.en) && str(t.ar)) errors.push(tr("النصوص: النص الإنجليزي لا يمكن أن يكون فارغاً (", "Texts: the English text cannot be empty (") + t.id + ").");
    });
    return errors;
  }

  /* ------------------------------------------------------------------ build */
  function build(files, model, options) {
    files = files || {};
    model = model || {};
    var today = (options && options.today) || todayIso();
    var warnings = [];
    var summary = [];
    var orig = readInternal(files);
    var out = {};

    var index = files["index.html"];
    var pubs = files["publications.html"];
    var hasIndex = typeof index === "string", hasPubs = typeof pubs === "string";

    /* --- works: what changed */
    var origWorks = sortWorks(orig.works.map(normalizeWork));
    var newWorks = sortWorks((model.works || orig.works).map(normalizeWork));
    var origById = {}, newById = {};
    origWorks.forEach(function (w) { origById[w.id] = w; });
    newWorks.forEach(function (w) { newById[w.id] = w; });
    var added = [], changed = [], removed = [];
    newWorks.forEach(function (w) {
      if (!origById[w.id]) added.push(w);
      else if (JSON.stringify(origById[w.id]) !== JSON.stringify(w)) changed.push(w);
    });
    origWorks.forEach(function (w) { if (!newById[w.id]) removed.push(w); });
    var worksChanged = added.length + changed.length + removed.length > 0;
    var c = counts(newWorks);
    var origCount = origWorks.length;
    added.forEach(function (w) { summary.push(tr("أُضيف بحث ", "Added work ") + w.id + ": " + w.title); });
    changed.forEach(function (w) { summary.push(tr("عُدّل بحث ", "Edited work ") + w.id + ": " + w.title); });
    removed.forEach(function (w) { summary.push(tr("حُذف بحث ", "Deleted work ") + w.id + ": " + w.title); });

    /* --- metrics.json */
    var metrics = null, metricsText = files["data/metrics.json"];
    if (typeof metricsText === "string") {
      try { metrics = JSON.parse(metricsText); } catch (e) { warnings.push(tr("تعذّرت قراءة data/metrics.json، فلن تُحدَّث قائمة أحدث المنشورات فيه.", "data/metrics.json could not be read, so its latest-works list will not be updated.")); }
    } else if (worksChanged) warnings.push(tr("ملف data/metrics.json غير موجود، فلن تُحدَّث قائمة أحدث المنشورات فيه.", "data/metrics.json is missing, so its latest-works list will not be updated."));
    var metricsByDoi = {};
    ((metrics && metrics.per_work) || []).forEach(function (r) { if (r.doi) metricsByDoi[String(r.doi).toLowerCase()] = r; });

    /* --- citations: numbers the owner refreshed (model.citations: doi -> count) */
    var citeChanged = {}, citeCount = 0, citeNoFile = false;
    if (model.citations && typeof model.citations === "object") {
      var workByDoi = {};
      newWorks.forEach(function (w) { var k = doiKey(w.doi); if (k) workByDoi[k] = w; });
      Object.keys(model.citations).forEach(function (rawKey) {
        var n = model.citations[rawKey];
        if (typeof n !== "number" || !isFinite(n) || n < 0 || Math.floor(n) !== n) return;
        var key = doiKey(normalizeDoi(rawKey)) || String(rawKey).toLowerCase();
        var work = workByDoi[key];
        if (!work) return; // a number for a work that is no longer in the catalogue
        var row = metricsByDoi[key];
        if (n === shownCitations(row) && (row || n === 0)) return;
        if (!metrics) { citeNoFile = true; return; }
        if (!row) {
          row = { id: work.id, title: work.title, year: work.year, doi: key, crossref: null, openalex: null, date: null, venue: null };
          if (!Array.isArray(metrics.per_work)) metrics.per_work = [];
          metrics.per_work.push(row);
          metricsByDoi[key] = row;
        }
        row.crossref = n;
        citeChanged[key] = true;
        citeCount += 1;
      });
      if (citeNoFile) warnings.push(tr("ملف data/metrics.json غير موجود أو غير مقروء، فلم تُحفظ أعداد الاستشهادات.", "data/metrics.json is missing or unreadable, so the citation numbers were not saved."));
      if (citeCount) {
        var crossrefCounts = metrics.per_work.filter(function (r) { return r && typeof r.crossref === "number"; }).map(function (r) { return r.crossref; });
        var totals = metrics.crossref && typeof metrics.crossref === "object" ? metrics.crossref : (metrics.crossref = {});
        totals.cited_by_total = crossrefCounts.reduce(function (a, b) { return a + b; }, 0);
        totals.h_index = hIndex(crossrefCounts);
        totals.matched = crossrefCounts.length;
        metrics.checked = (options && options.now) || today + "T00:00:00Z";
        summary.push(tr(citeCount === 1 ? "حُدّث عدد الاستشهادات لبحث واحد." : "حُدّثت أعداد الاستشهادات لـ " + citeCount + " بحثاً.",
          citeCount === 1 ? "Citation count updated for one work." : "Citation counts updated for " + citeCount + " works."));
      }
    }

    /* --- free texts (applied first, by position, so nothing else has moved yet) */
    var textEdits = 0;
    if (hasIndex) { var ti = applyTexts("index.html", index, model.texts); index = ti.html; textEdits += ti.count; }
    if (hasPubs) { var tp = applyTexts("publications.html", pubs, model.texts); pubs = tp.html; textEdits += tp.count; }
    if (textEdits) summary.push(textEdits === 1 ? tr("عُدّل نص واحد.", "One text edited.") : tr("عُدّلت " + textEdits + " نصوص.", textEdits + " texts edited."));

    /* --- fonts (each page compared with its own block) */
    var fontsChanged = false;
    var fontsWanted = null;
    function applyFonts(html, page) {
      if (!model.fonts) return html;
      var current = parseFonts(html);
      if (!current) { warnings.push(missingMarker("dash:fonts", page, tr("فلم يتغير الخط فيها", "so its fonts were not changed"))); return html; }
      var wanted = fullFonts(model.fonts, current);
      var next = renderFonts(wanted);
      if (next === renderFonts(current)) return html;
      fontsChanged = true;
      fontsWanted = wanted;
      return setBlock(html, "dash:fonts", next);
    }
    if (hasIndex) index = applyFonts(index, "index.html");
    if (hasPubs) pubs = applyFonts(pubs, "publications.html");
    if (fontsChanged) {
      var headSpec = fontSpec("head", fontsWanted.head);
      var headName = headSpec.label ? tr(headSpec.label.ar, headSpec.label.en) : fontsWanted.head;
      summary.push(tr("تغيّر الخط: العربي «" + fontsWanted.ar + "»، الإنجليزي «" + fontsWanted.en + "»، العناوين «" + headName + "».",
        "Fonts changed: Arabic “" + fontsWanted.ar + "”, English “" + fontsWanted.en + "”, headings “" + headName + "”."));
    }

    /* --- colours (the same block text on both pages) */
    var themeChanged = false;
    function applyTheme(html, page) {
      if (!model.theme) return html;
      if (!findBlock(html, "dash:theme")) { warnings.push(missingMarker("dash:theme", page, tr("فلم تتغير الألوان فيها", "so its colours were not changed"))); return html; }
      var next = renderTheme(model.theme);
      if (next === renderTheme(parseTheme(html))) return html;
      themeChanged = true;
      return setBlock(html, "dash:theme", next);
    }
    if (hasIndex) index = applyTheme(index, "index.html");
    if (hasPubs) pubs = applyTheme(pubs, "publications.html");
    if (themeChanged) {
      var themeNow = fullTheme(model.theme);
      var paletteNow = paletteById(themeNow.palette);
      summary.push(themeNow.palette === "custom" ? tr("تغيّرت الألوان: ألوان خاصة.", "Colours changed: custom colours.")
        : tr("تغيّرت الألوان: باقة «" + paletteNow.ar + "».", "Colours changed: palette “" + paletteNow.en + "”."));
      themeWarnings(model.theme).forEach(function (w) { warnings.push(w); });
    }

    /* --- portrait version */
    if (hasIndex && model.photoVersion != null) {
      var photoVersion = str(model.photoVersion).replace(/[^0-9A-Za-z]/g, "");
      if (photoVersion !== readPhotoVersion(index)) {
        var withPhoto = applyPhotoVersion(index, photoVersion);
        if (withPhoto !== index) { index = withPhoto; summary.push(tr("تغيّرت الصورة الشخصية.", "Portrait changed.")); }
        else warnings.push(tr("لم أجد الصورة الشخصية في index.html، فلم يُحدَّث رقم نسختها.", "The portrait was not found in index.html, so its version was not updated."));
      }
    }

    var sectionsResult = { nav: null };
    /* --- index.html blocks */
    if (hasIndex) {
      var block;
      // tiles
      block = findBlock(index, "dash:metrics");
      if (block) {
        var origTiles = parseMetrics(blockLines(index, "dash:metrics"));
        var tiles = model.metrics || origTiles;
        var nextTiles = renderMetrics(tiles, c.works);
        if (nextTiles !== renderMetrics(origTiles, null)) {
          index = setBlock(index, "dash:metrics", nextTiles);
          var signature = function (list) {
            return JSON.stringify(list.map(function (t) { return [t.auto === "works" ? "" : str(t.value), str(t.en), str(t.ar), str(t.href)]; }));
          };
          if (signature(tiles) !== signature(origTiles)) summary.push(tr("حُدّثت الأرقام في الصفحة الرئيسية.", "Home-page numbers updated."));
        }
      } else if (model.metrics) warnings.push(missingMarker("dash:metrics", "index.html", tr("فلم تُحدَّث الأرقام", "so the numbers were not updated")));
      // news
      block = findBlock(index, "dash:news");
      if (block && model.news) {
        var nextNews = renderNews(model.news);
        if (nextNews !== renderNews(parseNews(blockLines(index, "dash:news")))) {
          index = setBlock(index, "dash:news", nextNews);
          summary.push(tr("حُدّثت المستجدات.", "News lines updated."));
        }
      } else if (model.news && !block) warnings.push(missingMarker("dash:news", "index.html", tr("فلم تُحدَّث المستجدات", "so the news lines were not updated")));
      // roles
      block = findBlock(index, "dash:roles");
      if (block && model.roles) {
        var nextRoles = renderRoles(model.roles);
        if (nextRoles !== renderRoles(parseRoles(blockLines(index, "dash:roles")))) {
          index = setBlock(index, "dash:roles", nextRoles);
          summary.push(tr("حُدّثت اللجان والأدوار.", "Committees and roles updated."));
        }
      } else if (model.roles && !block) warnings.push(missingMarker("dash:roles", "index.html", tr("فلم تُحدَّث اللجان والأدوار", "so the committees and roles were not updated")));
      // theme strip numbers
      block = findBlock(index, "dash:themes");
      if (block) {
        var nextThemes = renderThemes(block.inner, c.themes);
        if (nextThemes !== block.inner) index = setBlock(index, "dash:themes", nextThemes);
      } else if (worksChanged) warnings.push(missingMarker("dash:themes", "index.html", tr("فلم تُحدَّث أعداد الموضوعات", "so the theme counts were not updated")));
      // latest publications
      var latest = latestList(newWorks, metrics);
      var sameLatest = metrics && JSON.stringify((metrics.latest || []).map(function (e) { return [e.id, e.title, e.year, e.doi]; })) ===
        JSON.stringify(latest.map(function (e) { return [e.id, e.title, e.year, e.doi]; }));
      if (metrics ? !sameLatest : worksChanged) {
        if (findBlock(index, "metrics:latest")) index = setBlock(index, "metrics:latest", latestMarkup(latest, metrics ? metrics.orcid_new : []));
        else warnings.push(missingMarker("metrics:latest", "index.html", tr("فلم تُحدَّث قائمة أحدث المنشورات", "so the latest-works list was not updated")));
        if (metrics) metrics.latest = latest;
      }
      if (metrics && metrics.works_verified !== c.works) metrics.works_verified = c.works;
      // count phrases
      index = applyRules("index.html", index, countRules("index.html", c), warnings);
      // lists: courses and the career timeline
      LISTS.forEach(function (list) {
        var items = model[list.key];
        if (!items) return;
        if (!findBlock(index, list.block)) {
          warnings.push(missingMarker(list.block, "index.html", tr("فلم يُحدَّث قسم " + list.label.ar, "so the " + list.label.en + " were not updated")));
          return;
        }
        var nextList = list.render(items);
        if (nextList !== list.render(list.parse(blockLines(index, list.block)))) {
          index = setBlock(index, list.block, nextList);
          summary.push(tr("حُدّث قسم " + list.label.ar + ".", "Updated: " + list.label.en + "."));
        }
      });
      // sections (show / hide / order / custom) and the navigation links that follow them
      index = applySections(index, model, warnings, summary, sectionsResult);
    }

    /* --- publications.html */
    if (hasPubs && sectionsResult.nav && findBlock(pubs, "dash:nav")) {
      // optional: when the catalogue page carries a dash:nav block too, its links follow the home page (as index.html#id)
      var pubsNavNow = findBlock(pubs, "dash:nav").inner;
      var pubsNavNext = renderPageNav(sectionsResult.nav, pubsNavNow);
      if (pubsNavNext !== pubsNavNow) pubs = setBlock(pubs, "dash:nav", pubsNavNext);
    }
    if (hasPubs) {
      var cardsBlock = findBlock(pubs, "dash:cards");
      if (worksChanged) {
        if (cardsBlock) {
          var existing = splitCards(cardsBlock.inner);
          var notesAr = harvestNotes(cardsBlock.inner);
          var cards = newWorks.slice().reverse().map(function (w) {
            var before = origById[w.id];
            var old = existing.map[w.id];
            if (before && old && JSON.stringify(before) === JSON.stringify(w)) return old; // untouched work: keep its card as it is
            var opts = { metricsByDoi: metricsByDoi, noteAr: notesAr };
            if (before && old && before.verificationNote === w.verificationNote) opts.noteHtml = existingNoteLine(old) || "";
            return cardHtml(w, opts);
          });
          pubs = setBlock(pubs, "dash:cards", "\n\n" + cards.join("\n\n") + "\n");
        } else warnings.push(missingMarker("dash:cards", "publications.html", tr("فلم تُحدَّث بطاقات الأبحاث", "so the publication cards were not updated")));
        // JSON-LD list
        var ld = LD_RE.exec(pubs);
        var ldDone = false;
        if (ld) {
          try {
            var doc = JSON.parse(ld[2]);
            if (doc.mainEntity && Array.isArray(doc.mainEntity.itemListElement)) {
              var oldItems = doc.mainEntity.itemListElement;
              var aligned = oldItems.length === origWorks.length;
              var template = oldItems[0] || null;
              var oldByIdItem = {};
              if (aligned) origWorks.forEach(function (w, i) { oldByIdItem[w.id] = oldItems[i]; });
              doc.mainEntity.itemListElement = newWorks.map(function (w, i) {
                var before = origById[w.id];
                var keep = oldByIdItem[w.id];
                if (keep && before && before.title === w.title && before.year === w.year && before.doi === w.doi) {
                  var copy = clone(keep);
                  copy.position = i + 1;
                  return copy;
                }
                return ldItem(w, i + 1, template);
              });
              doc.mainEntity.numberOfItems = newWorks.length;
              // "<" is written as \u003c so that no title can close the <script> element
              pubs = pubs.slice(0, ld.index) + ld[1] + JSON.stringify(doc).replace(/</g, "\\u003c") + ld[3] + pubs.slice(ld.index + ld[0].length);
              ldDone = true;
            }
          } catch (e) { /* reported below */ }
        }
        if (!ldDone) warnings.push(tr("تعذّر تحديث بيانات محركات البحث (JSON-LD) في publications.html.", "The search-engine data (JSON-LD) in publications.html could not be updated."));
        // cutoff date
        pubs = applyRules("publications.html", pubs, cutoffRules(today), warnings);
      }
      // citation numbers on the cards (cards kept as they are included)
      if (citeCount) {
        var citeBlock = findBlock(pubs, "dash:cards");
        if (citeBlock) {
          var patched = citeBlock.inner.replace(/<span class="pub-cites" data-doi="([^"]*)"[^>]*>[^<]*<\/span>/g, function (all, d) {
            var row = metricsByDoi[unesc(d).toLowerCase()];
            if (!row || !citeChanged[unesc(d).toLowerCase()]) return all;
            return '<span class="pub-cites" data-doi="' + d + '" data-ar="' + arCitations(row.crossref) + ' · Crossref">Cited by ' + thousands(row.crossref) + " · Crossref</span>";
          });
          if (patched !== citeBlock.inner) pubs = setBlock(pubs, "dash:cards", patched);
        } else if (!worksChanged) warnings.push(missingMarker("dash:cards", "publications.html", tr("فلم تُحدَّث أعداد الاستشهادات على البطاقات", "so the citation numbers on the cards were not updated")));
      }
      // year options
      var yearsBlock = findBlock(pubs, "dash:years");
      if (yearsBlock) {
        var nextYears = renderYears(c.years);
        var currentYears = (yearsBlock.inner.match(/<option value="(\d{4})">/g) || []).map(function (x) { return parseInt(/\d{4}/.exec(x)[0], 10); });
        if (nextYears !== renderYears(currentYears)) pubs = setBlock(pubs, "dash:years", nextYears);
      } else if (worksChanged) warnings.push(missingMarker("dash:years", "publications.html", tr("فلم تُحدَّث قائمة السنوات", "so the year list was not updated")));
      // data-count numbers
      ["works", "journal", "conference", "chapter"].forEach(function (key) {
        var re = new RegExp('(<strong data-count="' + key + '">)\\d+(</strong>)', "g");
        var found = false;
        pubs = pubs.replace(re, function (all, a, b) { found = true; return a + c[key] + b; });
        if (!found) warnings.push(tr('لم أجد العدد data-count="' + key + '" في publications.html، فلم يُحدَّث.', 'The number data-count="' + key + '" was not found in publications.html, so it was not updated.'));
      });
      // count phrases
      pubs = applyRules("publications.html", pubs, countRules("publications.html", c), warnings);
    }

    if (worksChanged && origCount !== c.works) summary.push(tr("عدد الأعمال الموثقة: " + origCount + " ← " + c.works + ".", "Verified works: " + origCount + " → " + c.works + "."));

    /* --- dates follow a change of the works (SPEC: profile month, JSON-LD dateModified, sitemap) */
    if (worksChanged) {
      if (hasIndex) { index = touchUpdated(index, today); index = touchDateModified(index, today); }
      if (hasPubs) pubs = touchDateModified(pubs, today);
    }
    var indexChanged = hasIndex && index !== files["index.html"];
    var pubsChanged = hasPubs && pubs !== files["publications.html"];

    /* --- research-data.js */
    if (worksChanged && orig.parsed) {
      var data = orig.parsed.data;
      data.works = newWorks;
      data.meta = data.meta || {};
      data.meta.total = newWorks.length;
      data.meta.verificationCutoff = today;
      data.meta.verificationCutoffDisplay = dateEn(today);
      var dataText = serializeData(orig.parsed, data);
      if (dataText !== files["research-data.js"]) out["research-data.js"] = dataText;
      summary.push(tr("تاريخ التحقق: " + dateAr(today) + ".", "Verification cutoff: " + dateEn(today) + "."));
    }

    /* --- metrics.json */
    if (metrics) {
      var nextMetrics = JSON.stringify(metrics, null, 1) + (/\n$/.test(metricsText) ? "\n" : "");
      if (JSON.stringify(JSON.parse(metricsText)) !== JSON.stringify(metrics)) out["data/metrics.json"] = nextMetrics;
    }

    /* --- pages, Arabic pages, sitemap */
    var locs = [];
    if (indexChanged) {
      out["index.html"] = index;
      out["ar/index.html"] = buildArabic("index.html", index);
      locs.push(PAGES["index.html"].en, PAGES["index.html"].ar);
    }
    if (pubsChanged) {
      out["publications.html"] = pubs;
      out["ar/publications.html"] = buildArabic("publications.html", pubs);
      locs.push(PAGES["publications.html"].en, PAGES["publications.html"].ar);
    }
    if (worksChanged && locs.length && typeof files["sitemap.xml"] === "string") {
      var sitemap = touchSitemap(files["sitemap.xml"], locs, today);
      if (sitemap !== files["sitemap.xml"]) out["sitemap.xml"] = sitemap;
    }
    /* --- cv.html: rebuilt by the CV module from what the site will say after this build */
    var cvMod = getCV();
    if (cvMod && typeof files["cv.html"] === "string") {
      try {
        var merged = {};
        Object.keys(files).forEach(function (path) { merged[path] = files[path]; });
        Object.keys(out).forEach(function (path) { merged[path] = out[path]; });
        var effective = read(merged);
        effective.cv = model.cv || orig.cv || effective.cv;
        effective.today = today;
        var nextCv = cvMod.build(effective, files["cv.html"], { today: today, lang: LANG });
        if (typeof nextCv === "string" && nextCv !== files["cv.html"]) {
          out["cv.html"] = nextCv;
          summary.push(tr("حُدّثت صفحة السيرة الذاتية.", "CV page updated."));
        }
      } catch (e) {
        warnings.push(tr("تعذّر تحديث صفحة السيرة cv.html، فبقيت كما هي.", "The CV page cv.html could not be updated, so it was left as it is."));
      }
    }
    // drop generated files that equal what the caller already has
    Object.keys(out).forEach(function (path) { if (files[path] === out[path]) delete out[path]; });
    if (!summary.length && Object.keys(out).length) summary.push(tr("حُدّثت الأعداد والتواريخ لتطابق فهرس الأبحاث.", "Counts and dates updated to match the catalogue."));

    return { files: out, warnings: warnings, summary: summary };
  }

  /* ------------------------------------------------------------------ Crossref */
  var KEEP_WORDS = ["Arabic", "English", "Saudi", "Arabia", "Quranic", "Quran", "Parkinson", "Parkinson's", "Kolmogorov", "Arnold",
    "Kolmogorov-Arnold", "Bayes", "Markov", "Gaussian", "Internet", "Things", "COVID-19", "Riyadh", "Islamic", "Agile", "Python", "Java"];
  function keepPiece(piece, hyphenated) {
    if (KEEP_WORDS.indexOf(piece) >= 0) return true;
    if (/\d/.test(piece)) return true;                 // YOLOv8, COVID-19, 5G
    if (/^[A-Z]{2,}s?$/.test(piece)) return true;       // LLM, CNN, LSTMs
    if (/[a-z][A-Z]/.test(piece)) return true;          // MuSeRAN, IoT
    if (hyphenated && /^[A-Z]$/.test(piece)) return true; // K-means, X-ray
    return false;
  }
  /* APA sentence case: lower-case words, keeping acronyms, mixed-case names and a short list of proper nouns. */
  function sentenceCase(title) {
    var startOfSentence = true;
    return title.split(/(\s+)/).map(function (token) {
      if (/^\s+$/.test(token) || token === "") return token;
      var lead = /^[("'“‘\[]*/.exec(token)[0];
      var trail = /[)"'”’\],.;:!?]*$/.exec(token.slice(lead.length))[0];
      var core = token.slice(lead.length, token.length - trail.length);
      var result;
      if (KEEP_WORDS.indexOf(core) >= 0) result = core;
      else {
        var pieces = core.split("-");
        result = pieces.map(function (piece, i) {
          if (keepPiece(piece, pieces.length > 1)) return piece;
          var lower = piece.toLowerCase();
          return startOfSentence && i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
        }).join("-");
      }
      startOfSentence = /[:?!]$/.test(token) || /^[—–-]$/.test(token);
      return lead + result + trail;
    }).join("");
  }
  function initials(given) {
    return String(given || "").trim().split(/\s+/).filter(Boolean).map(function (part) {
      return part.split("-").filter(Boolean).map(function (piece) { return piece.charAt(0).toUpperCase() + "."; }).join("-");
    }).join(" ");
  }
  function apaAuthors(authors) {
    var names = (authors || []).map(function (a) {
      if (a.family) return a.family + (a.given ? ", " + initials(a.given) : "");
      return a.name || "";
    }).filter(Boolean);
    if (!names.length) return "";
    if (names.length === 1) return names[0];
    if (names.length === 2) return names[0] + ", & " + names[1];
    if (names.length > 20) return names.slice(0, 19).join(", ") + ", ... " + names[names.length - 1];
    return names.slice(0, -1).join(", ") + ", & " + names[names.length - 1];
  }
  function plain(text) {
    return unesc(String(text == null ? "" : text).replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
  }
  function fromCrossref(message) {
    var msg = message && message.message && !message.title ? message.message : message || {};
    var title = plain((msg.title || [""])[0]);
    var subtitle = plain((msg.subtitle || [""])[0]);
    if (subtitle && title.toLowerCase().indexOf(subtitle.toLowerCase()) < 0) title = title + ": " + subtitle;
    var parts = null;
    ["issued", "published", "published-print", "published-online", "created"].some(function (key) {
      var p = msg[key] && msg[key]["date-parts"] && msg[key]["date-parts"][0];
      if (p && p[0]) { parts = p; return true; }
      return false;
    });
    var year = parts ? parts[0] : null;
    var kind = String(msg.type || "");
    var type = kind === "proceedings-article" ? "Conference paper"
      : kind === "book-chapter" || kind === "book-section" || kind === "book-part" ? "Book chapter"
      : kind === "journal-article" ? "Journal article" : "";
    var containers = (msg["container-title"] || []).map(plain).filter(Boolean);
    var venue = containers[0] || "";
    var authors = apaAuthors(msg.author);
    var pages = String(msg.page || "").trim();
    var article = String(msg["article-number"] || "").trim();
    var doi = msg.DOI ? "https://doi.org/" + String(msg.DOI).trim() : null;
    var head = (authors ? authors + " " : "") + "(" + (year || "n.d.") + "). " + sentenceCase(title) + (/[.?!]$/.test(title) ? "" : ".");
    var reference;
    if (type === "Conference paper" || type === "Book chapter") {
      reference = head + (venue ? " In " + venue + (pages ? " (pp. " + pages + ")" : "") + "." : "") + (msg.publisher ? " " + plain(msg.publisher) + "." : "");
    } else {
      var tail = venue;
      if (msg.volume) tail += (tail ? ", " : "") + msg.volume + (msg.issue ? "(" + msg.issue + ")" : "");
      if (pages || article) tail += (tail ? ", " : "") + (pages || article);
      reference = head + (tail ? " " + tail + "." : "");
    }
    return { title: title, year: year, type: type, reference: reference, doi: doi, venue: venue };
  }

  /* ------------------------------------------------------------------ public API */
  return {
    FILES: FILES,
    THEMES: THEMES.map(function (t) { return { en: t.en, ar: t.ar }; }),
    TYPES: TYPES.map(function (t) { return { en: t.en, ar: t.ar }; }),
    FONTS: FONTS,
    PALETTES: PALETTES,
    setLang: setLang,
    contrast: contrast,
    themeWarnings: themeWarnings,
    nextSectionId: nextSectionId,
    parseAchievements: parseAchievements,
    read: read,
    build: build,
    validate: validate,
    nextId: nextId,
    fromCrossref: fromCrossref,
    buildArabic: buildArabic,
    // helpers (also used by the tests)
    normalizeDoi: normalizeDoi,
    counts: counts,
    _internal: {
      setCV: setCV, getCV: getCV, renderTheme: renderTheme, parseTheme: parseTheme, deriveMode: deriveMode, modeCss: modeCss, hexNorm: hexNorm,
      LISTS: LISTS, renderNav: renderNav, renderPageNav: renderPageNav, parseNavLines: parseNavLines, sectionUnits: sectionUnits, renderCustomSection: renderCustomSection,
      parseCustomSection: parseCustomSection, readSectionsNav: readSectionsNav, composeNav: composeNav, readPhotoVersion: readPhotoVersion,
      applyPhotoVersion: applyPhotoVersion, readCitations: readCitations, parseDegrees: parseDegrees, parseTheses: parseTheses, blockLines: blockLines,
      cardHtml: cardHtml, splitCards: splitCards, harvestNotes: harvestNotes, findBlock: findBlock,
      parseMetrics: parseMetrics, renderMetrics: renderMetrics, parseNews: parseNews, renderNews: renderNews,
      parseRoles: parseRoles, renderRoles: renderRoles, parseFonts: parseFonts, renderFonts: renderFonts,
      renderYears: renderYears, renderThemes: renderThemes, latestList: latestList, latestMarkup: latestMarkup,
      listTexts: listTexts, normalizeWork: normalizeWork, sortWorks: sortWorks, venueFromReference: venueFromReference,
      sentenceCase: sentenceCase, escText: escText, escAttr: escAttr, unesc: unesc, dateEn: dateEn, dateAr: dateAr,
      blockLines: blockLines,
    },
  };
});
