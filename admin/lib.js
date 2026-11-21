/* Site dashboard library (admin/lib.js).
   Pure functions: no DOM, no network. Browser: window.DashLib. Node: module.exports.
   Contract: admin/SPEC.md. Tests: node admin/tests/lib.test.js */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DashLib = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ------------------------------------------------------------------ constants */
  var FILES = ["index.html", "publications.html", "research-data.js", "data/metrics.json", "sitemap.xml"];
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
    ],
    en: [
      { name: "Manrope", weights: [400, 600, 700, 800] },
      { name: "Inter", weights: [400, 600, 700, 800] },
      { name: "IBM Plex Sans", weights: [400, 600, 700] },
      { name: "Source Sans 3", weights: [400, 600, 700] },
    ],
  };
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
      if (!m) { if (problems) problems.push("سطر غير مفهوم في قسم الأرقام؛ سيُحذف إذا عدّلت هذا القسم."); return; }
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
      if (!m) { if (problems) problems.push("سطر غير مفهوم في قسم المستجدات؛ سيُحذف إذا عدّلت هذا القسم."); return; }
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
      if (!m) { if (problems) problems.push("سطر غير مفهوم في قسم اللجان والأدوار؛ سيُحذف إذا عدّلت هذا القسم."); return; }
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

  function fontSpec(kind, name) {
    var list = FONTS[kind];
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
    return { name: name, weights: [400, 700] };
  }
  function parseFonts(html) {
    var block = findBlock(html || "", "dash:fonts");
    if (!block) return null;
    var en = /--font-en:\s*"([^"]*)"/.exec(block.inner);
    var ar = /--font-ar:\s*"([^"]*)"/.exec(block.inner);
    if (!en || !ar) return null;
    return { ar: ar[1], en: en[1] };
  }
  function renderFonts(fonts) {
    function family(kind, name) {
      return "family=" + name.replace(/ /g, "+") + ":wght@" + fontSpec(kind, name).weights.join(";");
    }
    var en = str(fonts.en), ar = str(fonts.ar);
    return '\n    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?' + family("en", en) + "&" + family("ar", ar) + '&display=swap">' +
      '\n    <style>:root{--font-en:"' + en + '";--font-ar:"' + ar + '";}</style>\n    ';
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
      if (!found) warnings.push("لم أجد العبارة «" + rule[0] + "» في " + page + "، فلم تُحدَّث.");
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
        problems.push("تعذّرت قراءة ملف الأبحاث research-data.js.");
      }
    } else problems.push("ملف الأبحاث research-data.js غير موجود.");
    ["dash:fonts", "dash:metrics", "dash:news", "dash:roles", "dash:themes", "metrics:latest"].forEach(function (name) {
      if (index && !findBlock(index, name)) problems.push("العلامة " + name + " غير موجودة في index.html.");
    });
    ["dash:fonts", "dash:cards", "dash:years"].forEach(function (name) {
      if (pubs && !findBlock(pubs, name)) problems.push("العلامة " + name + " غير موجودة في publications.html.");
    });
    var metrics = parseMetrics(blockLines(index, "dash:metrics"), problems);
    var news = parseNews(blockLines(index, "dash:news"), problems);
    var roles = parseRoles(blockLines(index, "dash:roles"), problems);
    var fonts = parseFonts(index) || parseFonts(pubs) || { ar: "IBM Plex Sans Arabic", en: "Manrope" };
    var texts = listTexts("index.html", index).concat(listTexts("publications.html", pubs));
    return { works: works, metrics: metrics, news: news, roles: roles, fonts: fonts, texts: texts, problems: problems, parsed: parsed };
  }
  function read(files) {
    var r = readInternal(files || {});
    return {
      works: r.works,
      metrics: r.metrics,
      news: r.news,
      roles: r.roles,
      fonts: r.fonts,
      texts: r.texts.map(function (t) { return { id: t.id, page: t.page, tag: t.tag, en: t.en, ar: t.ar }; }),
      warnings: r.problems,
    };
  }

  /* ------------------------------------------------------------------ validate */
  function validate(model) {
    var errors = [];
    var m = model || {};
    var seen = {};
    (m.works || []).forEach(function (w, i) {
      var label = "البحث " + (str(w.id) || "رقم " + (i + 1));
      if (!/^P\d{2,}$/.test(str(w.id))) errors.push(label + ": المعرّف يجب أن يكون مثل P41.");
      else if (seen[w.id]) errors.push(label + ": المعرّف مكرر.");
      seen[w.id] = true;
      if (!str(w.title)) errors.push(label + ": العنوان مطلوب.");
      var year = parseInt(w.year, 10);
      if (!/^\d{4}$/.test(str(w.year)) || year < 1990 || year > 2100) errors.push(label + ": السنة يجب أن تكون أربعة أرقام.");
      if (!TYPES.some(function (t) { return t.en === w.type; })) errors.push(label + ": اختر نوع العمل.");
      if (!THEMES.some(function (t) { return t.en === w.theme; })) errors.push(label + ": اختر الموضوع البحثي.");
      var methods = Array.isArray(w.methods) ? w.methods.filter(function (x) { return str(x); }) : [];
      if (!methods.length) errors.push(label + ": أضف منهجية واحدة على الأقل.");
      if (!str(w.contribution)) errors.push(label + ": وصف المساهمة مطلوب.");
      if (!str(w.reference)) errors.push(label + ": مرجع APA مطلوب.");
      var doi = str(w.doi);
      if (doi && !/^https?:\/\/\S+$/.test(normalizeDoi(doi) || "")) errors.push(label + ": رقم DOI أو الرابط غير صحيح.");
    });
    (m.metrics || []).forEach(function (it, i) {
      if (it.auto !== "works" && !str(it.value)) errors.push("الأرقام (" + (i + 1) + "): القيمة مطلوبة.");
      if (!str(it.en)) errors.push("الأرقام (" + (i + 1) + "): الاسم بالإنجليزية مطلوب.");
    });
    (m.news || []).forEach(function (it, i) {
      if (!/^\d{4}$/.test(str(it.year))) errors.push("المستجدات (" + (i + 1) + "): السنة يجب أن تكون أربعة أرقام.");
      if (!str(it.en)) errors.push("المستجدات (" + (i + 1) + "): النص بالإنجليزية مطلوب.");
    });
    (m.roles || []).forEach(function (it, i) {
      if (!str(it.org)) errors.push("اللجان والأدوار (" + (i + 1) + "): اسم الجهة مطلوب.");
      if (!str(it.en)) errors.push("اللجان والأدوار (" + (i + 1) + "): الدور بالإنجليزية مطلوب.");
    });
    if (m.fonts) {
      if (!FONTS.ar.some(function (f) { return f.name === m.fonts.ar; })) errors.push("الخط العربي غير موجود في القائمة.");
      if (!FONTS.en.some(function (f) { return f.name === m.fonts.en; })) errors.push("الخط الإنجليزي غير موجود في القائمة.");
    }
    (m.texts || []).forEach(function (t) {
      if (t && t.en != null && !str(t.en) && str(t.ar)) errors.push("النصوص: النص الإنجليزي لا يمكن أن يكون فارغاً (" + t.id + ").");
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
    added.forEach(function (w) { summary.push("أُضيف بحث " + w.id + ": " + w.title); });
    changed.forEach(function (w) { summary.push("عُدّل بحث " + w.id + ": " + w.title); });
    removed.forEach(function (w) { summary.push("حُذف بحث " + w.id + ": " + w.title); });

    /* --- metrics.json */
    var metrics = null, metricsText = files["data/metrics.json"];
    if (typeof metricsText === "string") {
      try { metrics = JSON.parse(metricsText); } catch (e) { warnings.push("تعذّرت قراءة data/metrics.json، فلن تُحدَّث قائمة أحدث المنشورات فيه."); }
    } else if (worksChanged) warnings.push("ملف data/metrics.json غير موجود، فلن تُحدَّث قائمة أحدث المنشورات فيه.");
    var metricsByDoi = {};
    ((metrics && metrics.per_work) || []).forEach(function (r) { if (r.doi) metricsByDoi[String(r.doi).toLowerCase()] = r; });

    /* --- free texts (applied first, by position, so nothing else has moved yet) */
    var textEdits = 0;
    if (hasIndex) { var ti = applyTexts("index.html", index, model.texts); index = ti.html; textEdits += ti.count; }
    if (hasPubs) { var tp = applyTexts("publications.html", pubs, model.texts); pubs = tp.html; textEdits += tp.count; }
    if (textEdits) summary.push(textEdits === 1 ? "عُدّل نص واحد." : "عُدّلت " + textEdits + " نصوص.");

    /* --- fonts (each page compared with its own block) */
    var fontsChanged = false;
    function applyFonts(html, page) {
      if (!model.fonts) return html;
      var current = parseFonts(html);
      if (!current) { warnings.push("العلامة dash:fonts غير موجودة في " + page + "، فلم يتغير الخط فيها."); return html; }
      var next = renderFonts(model.fonts);
      if (next === renderFonts(current)) return html;
      fontsChanged = true;
      return setBlock(html, "dash:fonts", next);
    }
    if (hasIndex) index = applyFonts(index, "index.html");
    if (hasPubs) pubs = applyFonts(pubs, "publications.html");
    if (fontsChanged) summary.push("تغيّر الخط: العربي «" + model.fonts.ar + "»، الإنجليزي «" + model.fonts.en + "».");

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
          if (signature(tiles) !== signature(origTiles)) summary.push("حُدّثت الأرقام في الصفحة الرئيسية.");
        }
      } else if (model.metrics) warnings.push("العلامة dash:metrics غير موجودة في index.html، فلم تُحدَّث الأرقام.");
      // news
      block = findBlock(index, "dash:news");
      if (block && model.news) {
        var nextNews = renderNews(model.news);
        if (nextNews !== renderNews(parseNews(blockLines(index, "dash:news")))) {
          index = setBlock(index, "dash:news", nextNews);
          summary.push("حُدّثت المستجدات.");
        }
      } else if (model.news && !block) warnings.push("العلامة dash:news غير موجودة في index.html، فلم تُحدَّث المستجدات.");
      // roles
      block = findBlock(index, "dash:roles");
      if (block && model.roles) {
        var nextRoles = renderRoles(model.roles);
        if (nextRoles !== renderRoles(parseRoles(blockLines(index, "dash:roles")))) {
          index = setBlock(index, "dash:roles", nextRoles);
          summary.push("حُدّثت اللجان والأدوار.");
        }
      } else if (model.roles && !block) warnings.push("العلامة dash:roles غير موجودة في index.html، فلم تُحدَّث اللجان والأدوار.");
      // theme strip numbers
      block = findBlock(index, "dash:themes");
      if (block) {
        var nextThemes = renderThemes(block.inner, c.themes);
        if (nextThemes !== block.inner) index = setBlock(index, "dash:themes", nextThemes);
      } else if (worksChanged) warnings.push("العلامة dash:themes غير موجودة في index.html، فلم تُحدَّث أعداد الموضوعات.");
      // latest publications
      var latest = latestList(newWorks, metrics);
      var sameLatest = metrics && JSON.stringify((metrics.latest || []).map(function (e) { return [e.id, e.title, e.year, e.doi]; })) ===
        JSON.stringify(latest.map(function (e) { return [e.id, e.title, e.year, e.doi]; }));
      if (metrics ? !sameLatest : worksChanged) {
        if (findBlock(index, "metrics:latest")) index = setBlock(index, "metrics:latest", latestMarkup(latest, metrics ? metrics.orcid_new : []));
        else warnings.push("العلامة metrics:latest غير موجودة في index.html، فلم تُحدَّث قائمة أحدث المنشورات.");
        if (metrics) metrics.latest = latest;
      }
      if (metrics && metrics.works_verified !== c.works) metrics.works_verified = c.works;
      // count phrases
      index = applyRules("index.html", index, countRules("index.html", c), warnings);
    }

    /* --- publications.html */
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
        } else warnings.push("العلامة dash:cards غير موجودة في publications.html، فلم تُحدَّث بطاقات الأبحاث.");
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
        if (!ldDone) warnings.push("تعذّر تحديث بيانات محركات البحث (JSON-LD) في publications.html.");
        // cutoff date
        pubs = applyRules("publications.html", pubs, cutoffRules(today), warnings);
      }
      // year options
      var yearsBlock = findBlock(pubs, "dash:years");
      if (yearsBlock) {
        var nextYears = renderYears(c.years);
        var currentYears = (yearsBlock.inner.match(/<option value="(\d{4})">/g) || []).map(function (x) { return parseInt(/\d{4}/.exec(x)[0], 10); });
        if (nextYears !== renderYears(currentYears)) pubs = setBlock(pubs, "dash:years", nextYears);
      } else if (worksChanged) warnings.push("العلامة dash:years غير موجودة في publications.html، فلم تُحدَّث قائمة السنوات.");
      // data-count numbers
      ["works", "journal", "conference", "chapter"].forEach(function (key) {
        var re = new RegExp('(<strong data-count="' + key + '">)\\d+(</strong>)', "g");
        var found = false;
        pubs = pubs.replace(re, function (all, a, b) { found = true; return a + c[key] + b; });
        if (!found) warnings.push('لم أجد العدد data-count="' + key + '" في publications.html، فلم يُحدَّث.');
      });
      // count phrases
      pubs = applyRules("publications.html", pubs, countRules("publications.html", c), warnings);
    }

    if (worksChanged && origCount !== c.works) summary.push("عدد الأعمال الموثقة: " + origCount + " ← " + c.works + ".");

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
      summary.push("تاريخ التحقق: " + dateAr(today) + ".");
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
    // drop generated files that equal what the caller already has
    Object.keys(out).forEach(function (path) { if (files[path] === out[path]) delete out[path]; });
    if (!summary.length && Object.keys(out).length) summary.push("حُدّثت الأعداد والتواريخ لتطابق فهرس الأبحاث.");

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
