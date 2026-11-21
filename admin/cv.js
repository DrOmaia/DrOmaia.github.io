/* Live CV page (cv.html) for the site dashboard: window.DashCV in the browser, module.exports in Node.
   No DOM, no network, no dependencies. See admin/SPEC.md, "Version 2 -> CV module".

   cv.html holds <!-- cv:NAME --> ... <!-- /cv:NAME --> blocks, one item per line:
     auto blocks   header, appointments, education, publications, publications-full, teaching, service, updated
                   (rebuilt from the site model on every build)
     owner blocks  profile, pillars, accepted, community, development, languages, full-extra,
                   appointment-details (edited in the dashboard, kept as they are otherwise)
   Everything outside the blocks is static and is never touched.

   One page, two versions: <html class="cv-short"> (default, about three printed pages) or "cv-full"
   (everything). Elements with class "full-only" show only in the full version, "short-only" only in the
   short one; the tabs in the top bar and the URL hash (#full / #short) switch between them.

   Two languages, like the rest of the site: cv.html is English and every translatable element carries its
   Arabic in data-ar="..." (attributes in data-ar-<attr>="..."); tools/build-arabic.py turns it into ar/cv.html.
   Owner texts: a field `x` keeps its English and has an optional Arabic sibling `xAr` (profile: {en, ar}).
   No Arabic = no data-ar attribute, so the Arabic page shows the English text. A model.cv without the Arabic
   keys (older drafts) keeps the Arabic already on the page for every text whose English did not change.

   DashCV.read(cvHtml)                 -> model.cv
   DashCV.build(model, cvHtml, opts)   -> new cv.html text (the same string when nothing changed)
   DashCV.buildDetailed(...)           -> { html, warnings: [string], changed: [block names] }
   DashCV.fromIndex(indexHtml)         -> { degrees: [{year,title,institution,titleAr,institutionAr}], theses: [text], thesesAr: [text] }
   DashCV.MODE_CLASS                   -> "cv-full": put it on <html> to show the full version (no script needed)
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DashCV = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var AUTO = ["header", "appointments", "education", "publications", "publications-full", "teaching", "service", "updated"];
  var OWNER = ["profile", "pillars", "accepted", "community", "development", "languages", "full-extra", "appointment-details"];
  var TYPE_GROUPS = [
    ["Journal article", "Journal articles", "J", "مقالات في دوريات"],
    ["Conference paper", "Conference papers", "C", "أوراق في مؤتمرات"],
    ["Book chapter", "Book chapters", "B", "فصول في كتب"]
  ];
  var CATALOGUE = "https://dromaia.github.io/publications.html";
  var CATALOGUE_AR = "https://dromaia.github.io/ar/publications.html";
  var DEFAULT_SELECTED = 17;
  var MAX_AUTHORS = 5; // more than this is written "First et al."
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
    "October", "November", "December"];
  // the same Arabic month names as admin/lib.js (MONTHS_AR)
  var MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  var PRESENT_AR = "حتى الآن";
  // the six research themes in Arabic, as in admin/lib.js (THEMES)
  var THEME_AR = {
    "Cybersecurity, IoT, and cloud infrastructure": "الأمن السيبراني وإنترنت الأشياء والبنية السحابية",
    "NLP, education, and knowledge systems": "معالجة اللغة الطبيعية والتعليم ونظم المعرفة",
    "Healthcare and clinical decision support": "الرعاية الصحية ودعم القرار السريري",
    "Decision analytics and intelligent systems": "تحليلات القرار والأنظمة الذكية",
    "Computer vision and environmental intelligence": "الرؤية الحاسوبية والذكاء البيئي",
    "Responsible AI, governance, and society": "الذكاء الاصطناعي المسؤول والحوكمة والمجتمع"
  };
  // organisation names the site writes without Arabic (index.html roles)
  var ORG_AR = { "PSU": "جامعة الأمير سلطان" };
  // Arabic counting of "work": 1, 2, 3-10, 11-99, 100/101/102...
  var WORKS_AR = { one: "عمل واحد", two: "عملان", few: "أعمال", many: "عملاً", hundred: "عمل" };
  var VERIFIED_WORKS_AR = { one: "عمل واحد موثق", two: "عملين موثقين", few: "أعمال موثقة", many: "عملاً موثقاً", hundred: "عمل موثق" };
  var T = {
    accepted: "مقبولة للنشر / قيد الطبع",
    published: "الأعمال المنشورة",
    languages: "اللغات:",
    openTo: "منفتح على:",
    earlier: "الأدوار الأكاديمية السابقة: ",
    thesis: "عنوان الرسالة: ",
    themes: "محاور البحث",
    other: "أعمال أخرى",
    courseLead: "تشمل المقررات الحالية والحديثة في جامعة الأمير سلطان: ",
    flagship: "المقررات الرئيسية:",
    otherCourses: "مقررات حديثة أخرى:",
    recentCourses: "مقررات حديثة:",
    updated: "آخر تحديث: "
  };

  /* ---------- small helpers ---------- */
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function unesc(value) {
    return String(value == null ? "" : value)
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  }
  function clean(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }
  function en(value) {
    if (value && typeof value === "object") return clean(value.en);
    return clean(value);
  }
  function arOf(value) {
    if (value && typeof value === "object") return clean(value.ar);
    return "";
  }
  function stripTags(html) {
    return clean(unesc(String(html || "").replace(/<[^>]*>/g, "")));
  }
  /* ' data-ar="…"' when there is Arabic, nothing otherwise (the Arabic page then shows the English) */
  function arA(text) {
    var value = clean(text);
    return value ? ' data-ar="' + esc(value) + '"' : "";
  }
  function list(value) { return Array.isArray(value) ? value : []; }
  function dict() { return Object.create(null); }

  function findBlock(html, name) {
    var open = "<!-- cv:" + name + " -->";
    var close = "<!-- /cv:" + name + " -->";
    var a = html.indexOf(open);
    if (a < 0) return null;
    var b = html.indexOf(close, a + open.length);
    if (b < 0) return null;
    var inner = html.slice(a + open.length, b);
    return { start: a + open.length, end: b, inner: inner.replace(/^\n/, "").replace(/\n$/, "") };
  }
  function blockLines(html, name) {
    var block = findBlock(html, name);
    if (!block || !block.inner) return [];
    return block.inner.split("\n").map(function (line) { return line.trim(); }).filter(Boolean);
  }
  function setBlock(html, name, lines) {
    var block = findBlock(html, name);
    if (!block) return html;
    var inner = lines.length ? "\n" + lines.join("\n") + "\n" : "\n";
    return html.slice(0, block.start) + inner + html.slice(block.end);
  }

  function dash(value) {
    // "2026 — Present" / "2014 - 2024" -> "2026–Present"
    return clean(value).replace(/\s*[—–]\s*/g, "–").replace(/(\d)\s*-\s*(\d|[A-Za-z])/g, "$1–$2");
  }
  function dateAr(value) {
    var text = clean(value).replace(/Present/g, PRESENT_AR);
    return text === clean(value) ? "" : text;
  }
  function splitAt(text) {
    var at = text.indexOf(" · ");
    if (at < 0) return { role: text, org: "" };
    return { role: text.slice(0, at).trim(), org: text.slice(at + 3).trim() };
  }
  /* "Role · Organisation" in both languages; Arabic parts are "" when missing */
  function splitTitle(title) {
    var e = splitAt(en(title)), a = splitAt(arOf(title));
    return { role: e.role, org: e.org, roleAr: a.role, orgAr: a.org };
  }
  function joinList(items) {
    if (items.length <= 1) return items.join("");
    if (items.length === 2) return items[0] + " and " + items[1];
    return items.slice(0, -1).join(", ") + ", and " + items[items.length - 1];
  }
  function joinAr(items) {
    // "أ، وب، وج"
    return items.length ? items[0] + items.slice(1).map(function (x) { return "، و" + x; }).join("") : "";
  }
  function sentence(text) {
    var value = clean(text);
    if (!value) return "";
    return /[.!?…]["”’)]?$/.test(value) ? value : value + ".";
  }
  function sentenceAr(text) {
    var value = clean(text);
    if (!value) return "";
    return /[.!?؟…]["”’)»]?$/.test(value) ? value : value + ".";
  }
  function countAr(n, forms) {
    n = Number(n) || 0;
    if (n === 1) return forms.one;
    if (n === 2) return forms.two;
    var r = n % 100;
    if (r >= 3 && r <= 10) return n + " " + forms.few;
    if (r >= 11) return n + " " + forms.many;
    return n + " " + forms.hundred;
  }

  /* ---------- entry line shared by appointments, education and service ---------- */
  function entryLine(cls, title, titleAr, org, orgAr, date, detailHtml, tailHtml) {
    var line = '<div class="' + cls + '"><div class="row"><span class="t"><b' + arA(titleAr) + ">" + esc(title) + "</b>" +
      (org ? " — <span" + arA(orgAr) + ">" + esc(org) + "</span>" : "") + "</span>" +
      (date ? '<span class="d"' + arA(dateAr(date)) + ">" + esc(date) + "</span>" : "") + "</div>";
    return line + (detailHtml || "") + (tailHtml || "") + "</div>";
  }
  function para(cls, text, textAr) {
    return '<p class="' + cls + '"' + arA(textAr) + ">" + esc(text) + "</p>";
  }
  var A = '(?: data-ar="([^"]*)")?'; // optional Arabic attribute in the read patterns
  var EXTRA_RE = new RegExp('^<div class="entry x"><div class="row"><span class="t"><b' + A + '>(.*?)</b>(?: — (?:<span' + A + '>(.*?)</span>|(.*?)))?</span>' +
    '(?:<span class="d"(?: data-ar="[^"]*")?>(.*?)</span>)?</div>(?:<p class="desc"' + A + '>(.*?)</p>)?</div>$');
  var PAIR_RE = new RegExp("^<b" + A + ">(.*?)</b><span" + A + ">(.*?)</span>$");

  /* ---------- read ---------- */
  function read(cvHtml) {
    var html = String(cvHtml || "");
    var cv = {
      profile: { en: "", ar: "" }, pillars: [], accepted: [], selected: DEFAULT_SELECTED, community: [], development: [],
      languages: "", languagesAr: "", openTo: "", openToAr: "", extraService: [], educationNotes: {}, educationNotesAr: {},
      headerExtras: [], headerExtrasAr: [], fullExtra: [], appointmentDetails: []
    };
    var m;

    var profile = blockLines(html, "profile").join(" ");
    m = new RegExp("<p" + A + ">([\\s\\S]*?)</p>").exec(profile);
    cv.profile.en = m ? stripTags(m[2]) : "";
    cv.profile.ar = m ? unesc(m[1] || "") : "";

    function pair(line, prefix) {
      if (line.indexOf(prefix) !== 0 || line.slice(-6) !== "</div>") return null;
      var hit = PAIR_RE.exec(line.slice(prefix.length, -6));
      return hit ? { title: unesc(hit[2]), text: unesc(hit[4]), titleAr: unesc(hit[1] || ""), textAr: unesc(hit[3] || "") } : null;
    }
    blockLines(html, "pillars").forEach(function (line) {
      var hit = pair(line, '<div class="pillar">');
      if (hit) cv.pillars.push(hit);
    });

    var acceptedRe = new RegExp('^<p class="pub"(?: data-ar-dir="rtl")?><b class="y">(.*?)</b> (?:<span data-ar="([^"]*)">(.*?)</span>|(.*?))</p>$');
    blockLines(html, "accepted").forEach(function (line) {
      var hit = acceptedRe.exec(line);
      if (hit) cv.accepted.push({ year: unesc(hit[1]), text: unesc(hit[3] != null ? hit[3] : hit[4]), textAr: unesc(hit[2] || "") });
    });

    var pubs = findBlock(html, "publications");
    m = pubs && /data-selected="(\d+)"/.exec(pubs.inner);
    if (m) cv.selected = parseInt(m[1], 10);

    var commRe = new RegExp("^<li><b" + A + ">(.*?):</b> (?:<span" + A + ">(.*?)</span>|(.*?))</li>$");
    var commTitleRe = new RegExp("^<li><b" + A + ">(.*?)</b></li>$");
    blockLines(html, "community").forEach(function (line) {
      var hit = commRe.exec(line);
      if (hit) {
        cv.community.push({ title: unesc(hit[2]), text: unesc(hit[4] != null ? hit[4] : hit[5]), titleAr: unesc(hit[1] || "").replace(/:$/, ""), textAr: unesc(hit[3] || "") });
        return;
      }
      hit = commTitleRe.exec(line);
      if (hit) cv.community.push({ title: unesc(hit[2]), text: "", titleAr: unesc(hit[1] || ""), textAr: "" });
    });

    blockLines(html, "development").forEach(function (line) {
      var hit = pair(line, '<div class="pd-item">');
      if (hit) cv.development.push(hit);
    });

    var langRe = function (cls, label) {
      return new RegExp('^<p class="' + cls + '"><b(?: data-ar="[^"]*")?>' + label + ":</b> (?:<span" + A + ">(.*?)</span>|(.*?))</p>$");
    };
    var langsRe = langRe("langs", "Languages"), openRe = langRe("open", "Open to");
    blockLines(html, "languages").forEach(function (line) {
      var a = langsRe.exec(line), b = openRe.exec(line);
      if (a) { cv.languages = unesc(a[2] != null ? a[2] : a[3]); cv.languagesAr = unesc(a[1] || ""); }
      if (b) { cv.openTo = unesc(b[2] != null ? b[2] : b[3]); cv.openToAr = unesc(b[1] || ""); }
    });

    blockLines(html, "service").forEach(function (line) {
      var hit = EXTRA_RE.exec(line);
      if (hit) {
        cv.extraService.push({
          title: unesc(hit[2]), org: unesc(hit[4] != null ? hit[4] : hit[5] || ""), date: unesc(hit[6] || ""), text: unesc(hit[8] || ""),
          titleAr: unesc(hit[1] || ""), orgAr: unesc(hit[3] || ""), textAr: unesc(hit[7] || "")
        });
      }
    });

    var keepRe = new RegExp('<span class="keep"' + A + ">(.*?)</span>");
    blockLines(html, "education").forEach(function (line) {
      var year = /<span class="d"[^>]*>(.*?)<\/span>/.exec(line);
      var keep = keepRe.exec(line);
      if (year && keep) {
        cv.educationNotes[unesc(year[1])] = unesc(keep[2]);
        if (keep[1]) cv.educationNotesAr[unesc(year[1])] = unesc(keep[1]);
      }
    });

    var extraRe = new RegExp('^<section class="full-only extra"><h2' + A + ">(.*?)</h2><ul>(.*?)</ul></section>$");
    blockLines(html, "full-extra").forEach(function (line) {
      var hit = extraRe.exec(line);
      if (!hit) return;
      var items = [], itemsAr = [], re = new RegExp("<li" + A + ">(.*?)</li>", "g"), li;
      while ((li = re.exec(hit[3]))) { items.push(unesc(li[2])); itemsAr.push(unesc(li[1] || "")); }
      cv.fullExtra.push({ title: unesc(hit[2]), items: items, titleAr: unesc(hit[1] || ""), itemsAr: itemsAr });
    });

    blockLines(html, "appointment-details").forEach(function (line) {
      var hit = /^<div data-match="(.*?)">(.*?)<\/div>$/.exec(line);
      if (!hit) return;
      var bullets = [], bulletsAr = [], re = new RegExp("<span" + A + ">(.*?)</span>", "g"), sp;
      while ((sp = re.exec(hit[2]))) { bullets.push(unesc(sp[2])); bulletsAr.push(unesc(sp[1] || "")); }
      cv.appointmentDetails.push({ match: unesc(hit[1]), bullets: bullets, bulletsAr: bulletsAr });
    });

    blockLines(html, "header").forEach(function (line) {
      if (line.indexOf('<p class="sub">') !== 0) return;
      var re = new RegExp('<span class="keep"' + A + ">(.*?)</span>", "g"), hit;
      while ((hit = re.exec(line))) { cv.headerExtras.push(unesc(hit[2])); cv.headerExtrasAr.push(unesc(hit[1] || "")); }
    });

    return cv;
  }

  /* ---------- merging model.cv over the page: Arabic of unchanged English is kept when a key is absent ---------- */
  function arMap(items, enKey, arKey) {
    var map = dict();
    list(items).forEach(function (it) {
      if (it && clean(it[arKey]) && !(clean(it[enKey]) in map)) map[clean(it[enKey])] = it[arKey];
    });
    return map;
  }
  function arListMap(items, enKey, arKey) {
    var map = dict();
    list(items).forEach(function (it) {
      if (!it) return;
      list(it[enKey]).forEach(function (e, i) {
        var a = list(it[arKey])[i];
        if (clean(a) && !(clean(e) in map)) map[clean(e)] = a;
      });
    });
    return map;
  }
  function withAr(items, old, pairs, listPair) {
    var maps = pairs.map(function (p) { return arMap(old, p[0], p[1]); });
    var lmap = listPair ? arListMap(old, listPair[0], listPair[1]) : null;
    return list(items).map(function (item) {
      if (!item || typeof item !== "object") return item;
      var out = {};
      Object.keys(item).forEach(function (k) { out[k] = item[k]; });
      pairs.forEach(function (p, i) { if (out[p[1]] === undefined) out[p[1]] = maps[i][clean(out[p[0]])] || ""; });
      if (listPair && out[listPair[1]] === undefined) {
        out[listPair[1]] = list(out[listPair[0]]).map(function (e) { return lmap[clean(e)] || ""; });
      }
      return out;
    });
  }
  function mergeCv(current, given) {
    var cv = {};
    Object.keys(current).forEach(function (key) { cv[key] = current[key]; });
    if (!given || typeof given !== "object") return cv;
    Object.keys(given).forEach(function (key) { if (given[key] !== undefined && given[key] !== null) cv[key] = given[key]; });
    var g = function (key) { return given[key] !== undefined && given[key] !== null; };
    if (g("profile")) {
      var p = typeof given.profile === "string" ? { en: given.profile } : given.profile;
      if (p.ar === undefined) p = { en: p.en, ar: en(p) === en(current.profile) ? current.profile.ar : "" };
      cv.profile = p;
    }
    [["languages", "languagesAr"], ["openTo", "openToAr"]].forEach(function (k) {
      if (g(k[0]) && given[k[1]] === undefined) cv[k[1]] = clean(given[k[0]]) === clean(current[k[0]]) ? current[k[1]] : "";
    });
    if (g("pillars")) cv.pillars = withAr(given.pillars, current.pillars, [["title", "titleAr"], ["text", "textAr"]]);
    if (g("community")) cv.community = withAr(given.community, current.community, [["title", "titleAr"], ["text", "textAr"]]);
    if (g("development")) cv.development = withAr(given.development, current.development, [["title", "titleAr"], ["text", "textAr"]]);
    if (g("accepted")) cv.accepted = withAr(given.accepted, current.accepted, [["text", "textAr"]]);
    if (g("extraService")) cv.extraService = withAr(given.extraService, current.extraService, [["title", "titleAr"], ["org", "orgAr"], ["text", "textAr"]]);
    if (g("fullExtra")) cv.fullExtra = withAr(given.fullExtra, current.fullExtra, [["title", "titleAr"]], ["items", "itemsAr"]);
    if (g("appointmentDetails")) cv.appointmentDetails = withAr(given.appointmentDetails, current.appointmentDetails, [], ["bullets", "bulletsAr"]);
    if (g("headerExtras") && given.headerExtrasAr === undefined) {
      var hm = arListMap([current], "headerExtras", "headerExtrasAr");
      cv.headerExtrasAr = list(given.headerExtras).map(function (e) { return hm[clean(e)] || ""; });
    }
    if (g("educationNotes") && given.educationNotesAr === undefined) {
      var notesAr = {};
      Object.keys(given.educationNotes).forEach(function (year) {
        var old = (current.educationNotes || {})[year];
        if (old != null && clean(old) === clean(given.educationNotes[year]) && (current.educationNotesAr || {})[year]) notesAr[year] = current.educationNotesAr[year];
      });
      cv.educationNotesAr = notesAr;
    }
    return cv;
  }

  /* ---------- owner blocks ---------- */
  function pairLine(cls, title, titleAr, text, textAr) {
    return '<div class="' + cls + '"><b' + arA(titleAr) + ">" + esc(clean(title)) + "</b><span" + arA(textAr) + ">" + esc(clean(text)) + "</span></div>";
  }
  function ownerLines(name, cv) {
    switch (name) {
      case "profile":
        return en(cv.profile) ? ["<p" + arA(arOf(cv.profile)) + ">" + esc(en(cv.profile)) + "</p>"] : [];
      case "pillars":
        return list(cv.pillars).map(function (p) { return pairLine("pillar", p.title, p.titleAr, p.text, p.textAr); });
      case "accepted":
        var items = list(cv.accepted).filter(function (a) { return clean(a.text); }).map(function (a) {
          var head = '<b class="y">' + esc(clean(a.year)) + "</b> ";
          // an Arabic text makes the line right-to-left in the Arabic page; otherwise it stays an English reference
          return clean(a.textAr) ? '<p class="pub" data-ar-dir="rtl">' + head + '<span data-ar="' + esc(clean(a.textAr)) + '">' + esc(clean(a.text)) + "</span></p>"
            : '<p class="pub">' + head + esc(clean(a.text)) + "</p>";
        });
        return items.length ? ['<p class="pubhead" data-ar="' + T.accepted + '">Accepted / in press</p>'].concat(items) : [];
      case "community":
        return list(cv.community).filter(function (c) { return clean(c.title) || clean(c.text); }).map(function (c) {
          var title = clean(c.title).replace(/:$/, ""), titleAr = clean(c.titleAr).replace(/:$/, "");
          return clean(c.text) ? "<li><b" + arA(titleAr && titleAr + ":") + ">" + esc(title) + ":</b> <span" + arA(c.textAr) + ">" + esc(clean(c.text)) + "</span></li>"
            : "<li><b" + arA(titleAr) + ">" + esc(title) + "</b></li>";
        });
      case "development":
        return list(cv.development).filter(function (d) { return clean(d.title); }).map(function (d) {
          return pairLine("pd-item", d.title, d.titleAr, d.text, d.textAr);
        });
      case "languages":
        var out = [];
        if (clean(cv.languages)) out.push('<p class="langs"><b data-ar="' + T.languages + '">Languages:</b> <span' + arA(cv.languagesAr) + ">" + esc(clean(cv.languages)) + "</span></p>");
        if (clean(cv.openTo)) out.push('<p class="open"><b data-ar="' + T.openTo + '">Open to:</b> <span' + arA(cv.openToAr) + ">" + esc(clean(cv.openTo)) + "</span></p>");
        return out;
      case "full-extra":
        return list(cv.fullExtra).filter(function (x) { return x && clean(x.title); }).map(function (x) {
          var itemsAr = list(x.itemsAr);
          return '<section class="full-only extra"><h2' + arA(x.titleAr) + ">" + esc(clean(x.title)) + "</h2><ul>" +
            list(x.items).map(function (t, i) { return { en: clean(t), ar: itemsAr[i] }; }).filter(function (t) { return t.en; })
              .map(function (t) { return "<li" + arA(t.ar) + ">" + esc(t.en) + "</li>"; }).join("") + "</ul></section>";
        });
      case "appointment-details":
        return list(cv.appointmentDetails).filter(function (x) { return x && clean(x.match); }).map(function (x) {
          var bulletsAr = list(x.bulletsAr);
          return '<div data-match="' + esc(clean(x.match)) + '">' +
            list(x.bullets).map(function (t, i) { return { en: clean(t), ar: bulletsAr[i] }; }).filter(function (t) { return t.en; })
              .map(function (t) { return "<span" + arA(t.ar) + ">" + esc(t.en) + "</span>"; }).join("") + "</div>";
        });
    }
    return [];
  }

  /* ---------- auto blocks ---------- */
  function headerLines(model, cv, existing) {
    var titles = list(model.timeline).filter(function (t) { return /present/i.test(en(t.time)); })
      .map(function (t) { return splitTitle(t.title); }).filter(function (p) { return p.role; });
    var extrasAr = list(cv.headerExtrasAr);
    var spans = titles.map(function (p) { return "<span" + arA(p.roleAr) + ">" + esc(p.role) + "</span>"; })
      .concat(list(cv.headerExtras).map(function (t, i) { return { en: clean(t), ar: extrasAr[i] }; }).filter(function (t) { return t.en; })
        .map(function (t) { return '<span class="keep"' + arA(t.ar) + ">" + esc(t.en) + "</span>"; }));
    var sub = '<p class="sub">' + spans.join("") + "</p>";
    var replaced = false;
    var lines = existing.map(function (line) {
      if (line.indexOf('<p class="sub">') === 0) { replaced = true; return sub; }
      return line;
    });
    if (!replaced) lines.splice(Math.min(1, lines.length), 0, sub);
    return lines;
  }

  /* Bullets of the full version: every detail whose `match` is a substring of the entry's English title. */
  function detailBullets(title, cv) {
    var hay = en(title).toLowerCase(), bullets = [];
    list(cv.appointmentDetails).forEach(function (d) {
      var needle = clean(d && d.match).toLowerCase();
      if (!needle || hay.indexOf(needle) < 0) return;
      var ar = list(d.bulletsAr);
      list(d.bullets).forEach(function (b, i) { if (clean(b)) bullets.push({ en: clean(b), ar: ar[i] }); });
    });
    if (!bullets.length) return "";
    return '<ul class="details full-only">' + bullets.map(function (b) { return "<li" + arA(b.ar) + ">" + esc(b.en) + "</li>"; }).join("") + "</ul>";
  }
  function appointmentLines(model, cv) {
    function entry(cls) {
      return function (t) {
        var p = splitTitle(t.title);
        return entryLine(cls, p.role, p.roleAr, p.org, p.orgAr, dash(en(t.time)), en(t.text) ? para("desc", en(t.text), arOf(t.text)) : "", detailBullets(t.title, cv));
      };
    }
    var lines = list(model.timeline).map(entry("entry"));
    var earlier = [], earlierAr = [];
    list(model.timelineEarlier).forEach(function (t) {
      var p = splitTitle(t.title), date = dash(en(t.time));
      earlier.push(p.role + (p.org ? ", " + p.org : "") + " (" + date + ")");
      earlierAr.push((p.roleAr || p.role) + (p.org ? "، " + (p.orgAr || p.org) : "") + " (" + (dateAr(date) || date) + ")");
    });
    // short version: one line; full version: proper entries
    if (earlier.length) {
      lines.push('<p class="note short-only"' + arA(T.earlier + earlierAr.join("؛ ") + ".") + ">Earlier academic roles: " + esc(earlier.join("; ")) + ".</p>");
    }
    return lines.concat(list(model.timelineEarlier).map(entry("entry full-only")));
  }

  /* Arabic already on the page, by English text: keeps the Arabic of degrees when the model has none */
  function leafArabic(html) {
    var map = dict(), re = /<(b|span)\b[^>]*?\sdata-ar="([^"]*)"[^>]*>([^<]*)<\/\1>/g, m;
    while ((m = re.exec(html || ""))) if (!(clean(unesc(m[3])) in map)) map[clean(unesc(m[3]))] = unesc(m[2]);
    return map;
  }
  function educationLines(degrees, theses, thesesAr, cv, existingHtml) {
    var notes = cv.educationNotes || {}, notesAr = cv.educationNotesAr || {};
    var memo = leafArabic(existingHtml);
    return list(degrees).map(function (d, i) {
      var year = clean(d.year), title = clean(d.title), inst = clean(d.institution);
      var thesis = clean(d.thesis != null ? d.thesis : list(theses)[i]);
      var thesisAr = clean(d.thesisAr != null ? d.thesisAr : list(thesesAr)[i]);
      var bits = [];
      if (clean(notes[year])) bits.push('<span class="keep"' + arA(notesAr[year]) + ">" + esc(clean(notes[year])) + "</span>");
      if (thesis) {
        var th = "Thesis: “" + sentence(thesis) + "”";
        bits.push("<span" + arA(thesisAr ? T.thesis + "«" + thesisAr.replace(/\.$/, "") + "»." : memo[th]) + ">" + esc(th) + "</span>");
      }
      return entryLine("entry", title, clean(d.titleAr) || memo[title] || "", inst, clean(d.institutionAr) || memo[inst] || "", year,
        bits.length ? '<p class="it">' + bits.join(" ") + "</p>" : "");
    });
  }

  /* APA reference -> CV-style pieces */
  function parseAuthors(text) {
    var tokens = String(text || "").split(",").map(function (t) { return t.replace(/^\s*&\s*/, "").trim(); }).filter(Boolean);
    var authors = [];
    tokens.forEach(function (token) {
      var isInitials = /^(?:[A-Z]\.[\s-]?)+$/.test(token);
      if (isInitials && authors.length && !authors[authors.length - 1].initials) {
        authors[authors.length - 1].initials = token.replace(/\s+/g, " ");
      } else {
        // "A & B" inside one token (two authors without initials)
        token.split(/\s*&\s*/).filter(Boolean).forEach(function (name) { authors.push({ last: name, initials: "" }); });
      }
    });
    return authors.map(function (a) { return a.initials ? a.initials + " " + a.last : a.last; });
  }
  function parseReference(work) {
    var ref = clean(work && work.reference);
    var title = clean(work && work.title);
    var m = /^(.*?)\s*\((\d{4})[a-z]?(?:,[^)]*)?\)\.\s*/.exec(ref);
    if (!m) return { authors: [], venue: "" };
    var authors = parseAuthors(m[1]);
    var rest = ref.slice(m[0].length);
    var venue;
    if (title && rest.toLowerCase().indexOf(title.toLowerCase()) === 0) {
      rest = rest.slice(title.length);
      if (/^[.?!]\s*/.test(rest)) venue = rest.replace(/^[.?!]\s*/, "");
      else { var cut = rest.indexOf(". "); venue = cut < 0 ? "" : rest.slice(cut + 2); }
    } else if (rest.indexOf(". In ") >= 0) {
      venue = rest.slice(rest.indexOf(". In ") + 2);
    } else {
      var stop = rest.search(/[.?!] /);
      venue = stop < 0 ? "" : rest.slice(stop + 2);
    }
    venue = clean(venue).replace(/^In\s+/, "").replace(/(\d)-(\d)/g, "$1–$2");
    return { authors: authors, venue: venue };
  }
  function doiOf(work) {
    var m = /10\.\d{4,9}\/[^\s"<>]+/.exec(String((work && work.doi) || ""));
    return m ? m[0].replace(/[.,;]+$/, "") : "";
  }
  function formatPublication(work, opts) {
    opts = opts || {};
    var parsed = parseReference(work);
    var authors = !opts.allAuthors && parsed.authors.length > MAX_AUTHORS ? parsed.authors[0] + " et al." : joinList(parsed.authors);
    var title = clean(work.title);
    var quoted = "“" + title + (/[.?!]$/.test(title) ? "" : ".") + "”";
    var line = '<p class="pub">' + (opts.label ? '<b class="n">' + esc(opts.label) + "</b> " : "") + '<b class="y">' + esc(work.year) + "</b> ";
    if (authors) line += esc(/\.$/.test(authors) ? authors : authors + ".") + " ";
    line += esc(quoted);
    if (parsed.venue) line += " " + esc(sentence(parsed.venue));
    var doi = doiOf(work);
    if (doi) line += ' <a href="https://doi.org/' + esc(doi) + '">doi:' + esc(doi) + "</a>";
    return line + "</p>";
  }
  function idNumber(work) {
    var m = /(\d+)/.exec(String((work && work.id) || ""));
    return m ? parseInt(m[1], 10) : 0;
  }
  function newestFirst(works) {
    return list(works).slice().sort(function (a, b) {
      return (Number(b.year) || 0) - (Number(a.year) || 0) || idNumber(b) - idNumber(a);
    });
  }
  function catalogueLink(textEn, textAr) {
    return '<a href="' + CATALOGUE + '" data-ar-href="' + CATALOGUE_AR + '" data-ar="' + esc(textAr) + '">' + esc(textEn) + "</a>";
  }
  /* Full version: every work once, grouped by type with counts, newest first, numbered (J1, C1, B1...). */
  function publicationFullLines(model) {
    var works = newestFirst(model.works), total = works.length, lines = [];
    if (!total) return lines;
    var themes = [], count = {};
    works.forEach(function (w) {
      var theme = clean(w.theme);
      if (!theme) return;
      if (!count.hasOwnProperty(theme)) { count[theme] = 0; themes.push(theme); }
      count[theme]++;
    });
    themes.sort(function (a, b) { return count[b] - count[a] || (a < b ? -1 : a > b ? 1 : 0); });
    if (themes.length) {
      lines.push('<p class="themes"><b data-ar="' + esc(T.themes + " (" + countAr(total, WORKS_AR) + "):") + '">Research themes (' + total + " works):</b> " +
        "<span" + arA(themes.map(function (t) { return (THEME_AR[t] || t) + " (" + count[t] + ")"; }).join("؛ ") + ".") + ">" +
        esc(themes.map(function (t) { return t + " (" + count[t] + ")"; }).join("; ")) + ".</span></p>");
    }
    var groups = TYPE_GROUPS.map(function (g) { return { type: g[0], title: g[1], prefix: g[2], ar: g[3], works: [] }; });
    var other = { type: "", title: "Other works", prefix: "O", ar: T.other, works: [] };
    works.forEach(function (w) {
      var hit = groups.filter(function (g) { return g.type.toLowerCase() === clean(w.type).toLowerCase(); })[0];
      (hit || other).works.push(w);
    });
    groups.concat([other]).forEach(function (g) {
      if (!g.works.length) return;
      lines.push('<p class="pubhead" data-ar="' + esc(g.ar + " (" + g.works.length + ")") + '">' + esc(g.title) + " (" + g.works.length + ")</p>");
      g.works.forEach(function (w, i) { lines.push(formatPublication(w, { allAuthors: true, label: g.prefix + (i + 1) })); });
    });
    lines.push('<p class="note"><span data-ar="' + esc("المنهجيات والإسهامات وأعداد الاستشهادات لجميع الأعمال الـ" + total + ":") + '">Methods, contributions and citation counts for all ' + total +
      " works:</span> " + catalogueLink("dromaia.github.io/publications.html ↗", "dromaia.github.io/ar/publications.html ↗") + "</p>");
    return lines;
  }
  function publicationLines(model, cv) {
    var works = newestFirst(model.works);
    var total = works.length;
    var selected = Math.max(0, Math.min(Number(cv.selected) >= 0 && cv.selected !== "" && cv.selected != null ? Number(cv.selected) : DEFAULT_SELECTED, total));
    var shown = works.slice(0, selected);
    var lines = [];
    if (shown.length) lines.push('<p class="pubhead" data-ar="' + T.published + '">Published</p>');
    shown.forEach(function (w) { lines.push(formatPublication(w)); });
    var stored = Number(cv.selected) >= 0 && cv.selected !== "" && cv.selected != null ? Math.floor(Number(cv.selected)) : DEFAULT_SELECTED;
    var all = selected >= total;
    var lead = all ? "All" : "The " + selected + " most recent of";
    var leadAr = all ? "جميع" : "أحدث " + selected + " من أصل";
    var link = all ? "الأعمال الموثقة الـ" + total + " على dromaia.github.io ↗" : countAr(total, VERIFIED_WORKS_AR) + " على dromaia.github.io ↗";
    lines.push('<p class="note" data-selected="' + stored + '"><span data-ar="' + esc(leadAr) + '">' + lead + "</span> " +
      catalogueLink(total + " verified works on dromaia.github.io ↗", link) + "</p>");
    return lines;
  }

  function teachingLines(model, existing) {
    var lead = "Current and recent courses at Prince Sultan University include ", leadAr = T.courseLead;
    var m = /^<p class="short-only"(?: data-ar="([^"]*)")?>(.*? include )/.exec(existing[0] || "");
    if (m) {
      lead = unesc(m[2]);
      var cut = m[1] ? unesc(m[1]).indexOf(": ") : -1;
      if (cut > 0) leadAr = unesc(m[1]).slice(0, cut + 2);
    }
    function name(c) { return en(c.en != null ? c.en : c.title); }
    function code(c) { return clean(c.code) ? " (" + clean(c.code) + ")" : ""; }
    function label(c) { return name(c) + code(c); }
    function labelAr(c) { return (clean(c.ar) || name(c)) + code(c); }
    var courses = list(model.courses), flagship = list(model.flagship);
    var named = courses.filter(function (c) { return label(c); });
    if (!named.length && !flagship.length) return [];
    var lines = named.length ? [para("short-only", lead + joinList(named.map(label)) + ".", leadAr + joinAr(named.map(labelAr)) + ".")] : [];
    // full version: flagship courses first, then every other course
    var seen = {}, first = [], rest = [];
    flagship.forEach(function (c) { var k = clean(c.code) || label(c); if (!seen[k] && label(c)) { seen[k] = true; first.push(c); } });
    courses.forEach(function (c) { var k = clean(c.code) || label(c); if (!seen[k] && label(c)) { seen[k] = true; rest.push(c); } });
    function line(titleEn, titleAr, items) {
      return '<p class="full-only"><b data-ar="' + titleAr + '">' + titleEn + ":</b> <span" + arA(items.map(labelAr).join("؛ ") + ".") + ">" +
        esc(items.map(label).join("; ")) + ".</span></p>";
    }
    if (first.length) lines.push(line("Flagship courses", T.flagship, first));
    if (rest.length) lines.push(first.length ? line("Other recent courses", T.otherCourses, rest) : line("Recent courses", T.recentCourses, rest));
    return lines;
  }

  function serviceLines(model, cv) {
    var lines = list(cv.extraService).filter(function (x) { return clean(x.title); }).map(function (x) {
      return entryLine("entry x", clean(x.title), x.titleAr, clean(x.org), x.orgAr, clean(x.date),
        clean(x.text) ? para("desc", clean(x.text), x.textAr) : "");
    });
    var groups = [], byOrg = {}, orgAr = {};
    list(model.roles).forEach(function (r) {
      var org = clean(r.org), role = en(r.en != null ? r.en : r.role);
      if (!role) return;
      if (!byOrg.hasOwnProperty(org)) { byOrg[org] = []; groups.push(org); orgAr[org] = clean(r.orgAr) || ORG_AR[org] || ""; }
      byOrg[org].push({ en: role.replace(/[.;]+$/, ""), ar: clean(r.ar).replace(/[.;؛]+$/, "") });
    });
    function orgLabel(org) { return org ? "<b" + arA(orgAr[org] && orgAr[org] + ":") + ">" + esc(org) + ":</b> " : ""; }
    groups.forEach(function (org) {
      var roles = byOrg[org];
      lines.push('<p class="svc short-only">' + orgLabel(org) + "<span" +
        arA(roles.map(function (r) { return r.ar || r.en; }).join("؛ ") + ".") + ">" + esc(roles.map(function (r) { return r.en; }).join("; ")) + ".</span></p>");
    });
    // full version: every committee and role on its own line
    var all = [];
    groups.forEach(function (org) {
      byOrg[org].forEach(function (role) { all.push("<li>" + orgLabel(org) + "<span" + arA(role.ar) + ">" + esc(role.en) + "</span></li>"); });
    });
    if (all.length) lines = lines.concat(['<ul class="rolelist full-only">'], all, ["</ul>"]);
    return lines;
  }

  function updatedLines(today, existing) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(today || ""));
    var i = m ? parseInt(m[2], 10) - 1 : -1;
    if (!m || !MONTHS[i]) return existing;
    return ['<span class="updated" data-ar="' + T.updated + MONTHS_AR[i] + " " + m[1] + '">Last updated: ' + MONTHS[i] + " " + m[1] + "</span>"];
  }

  function attrAr(tagHtml) {
    var m = /\sdata-ar="([^"]*)"/.exec(tagHtml || "");
    return m ? clean(unesc(m[1])) : "";
  }
  function fromIndex(indexHtml) {
    var html = String(indexHtml || "");
    var degrees = [], theses = [], thesesAr = [];
    var re = /<article class="degree-card">([\s\S]*?)<\/article>/g, m;
    while ((m = re.exec(html))) {
      var year = /<span class="degree-year">([\s\S]*?)<\/span>/.exec(m[1]);
      var title = /<h3([^>]*)>([\s\S]*?)<\/h3>/.exec(m[1]);
      var inst = /<div class="degree-institution"([^>]*)>([\s\S]*?)<\/div>/.exec(m[1]);
      degrees.push({
        year: year ? stripTags(year[1]) : "", title: title ? stripTags(title[2]) : "", institution: inst ? stripTags(inst[2]) : "",
        titleAr: title ? attrAr(title[1]) : "", institutionAr: inst ? attrAr(inst[1]) : ""
      });
    }
    var rt = /<div class="degree-detail">[\s\S]*?<p([^>]*)>([\s\S]*?)<\/p>/g;
    while ((m = rt.exec(html))) { theses.push(stripTags(m[2])); thesesAr.push(attrAr(m[1])); }
    return { degrees: degrees, theses: theses, thesesAr: thesesAr };
  }

  /* ---------- build ---------- */
  function buildDetailed(model, cvHtml, opts) {
    var html = String(cvHtml || "");
    var warnings = [], changed = [];
    model = model || {};
    opts = opts || {};
    if (!html) return { html: html, warnings: ["cv.html is empty"], changed: [] };

    var cv = mergeCv(read(html), model.cv);

    var out = html;
    function put(name, lines) {
      if (!findBlock(out, name)) { warnings.push("cv.html: block cv:" + name + " is missing"); return; }
      var next = setBlock(out, name, lines);
      if (next !== out) { changed.push(name); out = next; }
    }

    OWNER.forEach(function (name) { put(name, ownerLines(name, cv)); });

    if (Array.isArray(model.timeline)) {
      put("header", headerLines(model, cv, blockLines(out, "header")));
      put("appointments", appointmentLines(model, cv));
    }
    var degrees = model.degrees, theses = model.theses, thesesAr = model.thesesAr;
    if (!Array.isArray(degrees) && opts.indexHtml) {
      var parsed = fromIndex(opts.indexHtml);
      degrees = parsed.degrees; theses = parsed.theses; thesesAr = parsed.thesesAr;
    }
    if (Array.isArray(degrees)) {
      var edu = findBlock(out, "education");
      put("education", educationLines(degrees, theses, thesesAr, cv, edu ? edu.inner : ""));
    }
    if (Array.isArray(model.works)) {
      put("publications", publicationLines(model, cv));
      put("publications-full", publicationFullLines(model));
    }
    if (Array.isArray(model.courses)) put("teaching", teachingLines(model, blockLines(out, "teaching")));
    if (Array.isArray(model.roles)) put("service", serviceLines(model, cv));

    // The date moves only together with a real change, so an unchanged site round-trips in any month.
    if (out !== html) {
      var today = model.today || opts.today;
      if (today) put("updated", updatedLines(today, blockLines(out, "updated")));
    }
    return { html: out === html ? html : out, warnings: warnings, changed: changed };
  }
  function build(model, cvHtml, opts) {
    return buildDetailed(model, cvHtml, opts).html;
  }

  return {
    AUTO: AUTO, OWNER: OWNER, DEFAULT_SELECTED: DEFAULT_SELECTED, MODE_CLASS: "cv-full",
    read: read, build: build, buildDetailed: buildDetailed, fromIndex: fromIndex,
    formatPublication: formatPublication, parseReference: parseReference,
    _findBlock: findBlock, _setBlock: setBlock, _esc: esc, _unesc: unesc
  };
});
