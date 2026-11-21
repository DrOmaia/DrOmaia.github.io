/* TEST STAND-IN for admin/lib.js. Same API shapes as SPEC.md, deliberately simple logic.
   Used only by admin/tests/ui_test.py (routed in place of lib.js); never loaded by index.html. */
(function (root) {
  "use strict";
  var FILES = ["index.html", "publications.html", "research-data.js", "data/metrics.json", "sitemap.xml"];
  var THEMES = [
    { en: "Cybersecurity, IoT, and cloud infrastructure", ar: "الأمن السيبراني وإنترنت الأشياء والسحابة" },
    { en: "NLP, education, and knowledge systems", ar: "معالجة اللغة والتعليم ونظم المعرفة" },
    { en: "Healthcare and clinical decision support", ar: "الرعاية الصحية ودعم القرار السريري" },
    { en: "Decision analytics and intelligent systems", ar: "تحليلات القرار والأنظمة الذكية" },
    { en: "Computer vision and environmental intelligence", ar: "الرؤية الحاسوبية والذكاء البيئي" },
    { en: "Responsible AI, governance, and society", ar: "الذكاء الاصطناعي المسؤول والحوكمة والمجتمع" }
  ];
  var TYPES = [{ en: "Journal article", ar: "مقالة في دورية" }, { en: "Conference paper", ar: "ورقة مؤتمر" }, { en: "Book chapter", ar: "فصل في كتاب" }];
  var FONTS = {
    ar: [{ name: "IBM Plex Sans Arabic", weights: "400;600;700" }, { name: "Noto Naskh Arabic", weights: "400;700" }, { name: "Tajawal", weights: "400;500;700" }, { name: "Cairo", weights: "400;600;700" }],
    en: [{ name: "Manrope", weights: "400;600;700;800" }, { name: "Inter", weights: "400;600;700;800" }]
  };
  function unesc(s) { return String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&"); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function block(html, name) {
    var a = "<!-- dash:" + name + " -->", b = "<!-- /dash:" + name + " -->";
    var i = html.indexOf(a), j = html.indexOf(b);
    if (i < 0 || j < 0) throw new Error("missing block " + name);
    return { start: i + a.length, end: j, text: html.slice(i + a.length, j) };
  }
  function setBlock(html, name, text) { var b = block(html, name); return html.slice(0, b.start) + text + html.slice(b.end); }
  function data(text) { return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); }

  function read(files) {
    var idx = files["index.html"], m, out;
    var works = data(files["research-data.js"]).works;
    var metrics = [], re = /<(div|a) class="metric"(?: href="([^"]*)")?><strong>([^<]*)<\/strong><span data-ar="([^"]*)">([^<]*)<\/span>/g;
    out = block(idx, "metrics").text;
    while ((m = re.exec(out))) metrics.push({ value: unesc(m[3]), en: unesc(m[5]), ar: unesc(m[4]), href: m[2] || null, auto: m[2] ? "works" : null });
    var news = []; re = /<li><time datetime="(\d+)">\d+<\/time> — <span data-ar="([^"]*)">([^<]*)<\/span><\/li>/g;
    out = block(idx, "news").text;
    while ((m = re.exec(out))) news.push({ year: m[1], en: unesc(m[3]), ar: unesc(m[2]) });
    var roles = []; re = /<span class="society-org"(?: data-ar="([^"]*)")?>([^<]*)<\/span><span class="society-role" data-ar="([^"]*)">([^<]*)<\/span>/g;
    out = block(idx, "roles").text;
    while ((m = re.exec(out))) roles.push({ org: unesc(m[2]), orgAr: m[1] ? unesc(m[1]) : "", en: unesc(m[4]), ar: unesc(m[3]) });
    var fm = /--font-en:"([^"]*)";--font-ar:"([^"]*)"/.exec(block(idx, "fonts").text);
    var texts = []; re = /<(h2|h3|p|summary)\sdata-ar="([^"<>]*)">([^<]*)<\/\1>/g;
    ["index.html", "publications.html"].forEach(function (page) {
      var n = 0, mm; re.lastIndex = 0;
      while ((mm = re.exec(files[page])) && n < 60) { texts.push({ id: page + "#" + n, page: page, en: unesc(mm[3]), ar: unesc(mm[2]) }); n++; }
    });
    return { works: works, metrics: metrics, news: news, roles: roles, fonts: { ar: fm[2], en: fm[1] }, texts: texts };
  }

  function build(files, model, opts) {
    var base = read(files), outFiles = {}, summary = [], idx = files["index.html"], pub = files["publications.html"];
    var diff = function (k) { return JSON.stringify(base[k]) !== JSON.stringify(model[k]); };
    if (diff("works")) {
      var d = data(files["research-data.js"]); d.works = model.works; d.meta.total = model.works.length; d.meta.verificationCutoff = (opts && opts.today) || "";
      outFiles["research-data.js"] = "window.RESEARCH_PORTFOLIO=" + JSON.stringify(d) + ";";
      pub = pub.replace(/(<strong data-count="works">)\d+/, "$1" + model.works.length);
      summary.push("الأبحاث: العدد الآن " + model.works.length + ".");
    }
    if (diff("metrics") || diff("works")) {
      idx = setBlock(idx, "metrics", "\n" + model.metrics.map(function (t) {
        var v = esc(t.auto ? model.works.length : t.value), body = "<strong>" + v + '</strong><span data-ar="' + esc(t.ar) + '">' + esc(t.en) + "</span>";
        return t.href ? '  <a class="metric" href="' + t.href + '">' + body + "</a>" : '  <div class="metric">' + body + "</div>";
      }).join("\n") + "\n");
      if (diff("metrics")) summary.push("الأرقام: حُدّثت.");
    }
    if (diff("news")) {
      idx = setBlock(idx, "news", "\n" + model.news.map(function (n) { return '<li><time datetime="' + esc(n.year) + '">' + esc(n.year) + '</time> — <span data-ar="' + esc(n.ar) + '">' + esc(n.en) + "</span></li>"; }).join("\n") + "\n");
      summary.push("المستجدات: " + model.news.length + " أسطر.");
    }
    if (diff("roles")) {
      idx = setBlock(idx, "roles", "\n" + model.roles.map(function (r) {
        return '<article class="society-item"><span class="society-org"' + (r.orgAr ? ' data-ar="' + esc(r.orgAr) + '"' : "") + ">" + esc(r.org) + '</span><span class="society-role" data-ar="' + esc(r.ar) + '">' + esc(r.en) + "</span></article>";
      }).join("\n") + "\n");
      summary.push("اللجان والأدوار: " + model.roles.length + ".");
    }
    if (diff("fonts")) {
      var fb = '\n    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=' + model.fonts.en.replace(/ /g, "+") + ":wght@400;700&family=" + model.fonts.ar.replace(/ /g, "+") + ':wght@400;700&display=swap">\n    <style>:root{--font-en:"' + model.fonts.en + '";--font-ar:"' + model.fonts.ar + '";}</style>\n    ';
      idx = setBlock(idx, "fonts", fb); pub = setBlock(pub, "fonts", fb);
      summary.push("الخطوط: " + model.fonts.ar + " / " + model.fonts.en + ".");
    }
    if (diff("texts")) {
      var n = 0;
      model.texts.forEach(function (t, i) {
        var o = base.texts[i]; if (!o || (o.en === t.en && o.ar === t.ar)) return;
        var from = 'data-ar="' + esc(o.ar) + '">' + esc(o.en) + "<", to = 'data-ar="' + esc(t.ar) + '">' + esc(t.en) + "<";
        if (t.page === "index.html") idx = idx.replace(from, to); else pub = pub.replace(from, to);
        n++;
      });
      summary.push("النصوص: " + n + ".");
    }
    if (idx !== files["index.html"]) { outFiles["index.html"] = idx; outFiles["ar/index.html"] = buildArabic("index.html", idx); }
    if (pub !== files["publications.html"]) { outFiles["publications.html"] = pub; outFiles["ar/publications.html"] = buildArabic("publications.html", pub); }
    var warnings = diff("works") ? ["(نسخة اختبار) لم تُحدَّث بطاقات الأبحاث."] : [];
    return { files: outFiles, warnings: Object.keys(outFiles).length ? warnings : [], summary: summary };
  }

  function validate(model) {
    var errs = [];
    (model.works || []).forEach(function (w) {
      if (!w.title) errs.push(w.id + ": العنوان ناقص.");
      if (!w.contribution) errs.push(w.id + ": اكتب المساهمة.");
    });
    return errs;
  }
  function nextId(works) {
    var max = 0; (works || []).forEach(function (w) { var n = parseInt(String(w.id).replace(/\D/g, ""), 10); if (n > max) max = n; });
    return "P" + String(max + 1).padStart(2, "0");
  }
  function fromCrossref(msg) {
    var year = (((msg.issued || {})["date-parts"] || [[]])[0] || [])[0];
    var authors = (msg.author || []).map(function (a) { return a.family + ", " + String(a.given || "").charAt(0) + "."; }).join(", ");
    var title = (msg.title || [""])[0], venue = (msg["container-title"] || [""])[0];
    return { title: title, year: year, type: msg.type === "proceedings-article" ? "Conference paper" : msg.type === "book-chapter" ? "Book chapter" : "Journal article",
      reference: authors + " (" + year + "). " + title + ". " + venue + ".", doi: msg.DOI ? "https://doi.org/" + msg.DOI : "" };
  }
  function buildArabic(page, html) {
    var out = html.replace(/<([a-zA-Z][a-zA-Z0-9]*)((?:\s[^>]*?)?)\sdata-ar="([^"]*)"([^>]*)>([\s\S]*?)<\/\1\s*>/g, function (m, tag, before, ar, after) { return "<" + tag + before + after + ">" + ar + "</" + tag + ">"; });
    out = out.replace('<html lang="en" dir="ltr"', '<html lang="ar" dir="rtl"');
    return out.replace(/\b(href|src)="([^"]*)"/g, function (m, attr, v) {
      if (/^(https?:|\/\/|\/|#|mailto:|tel:|data:|javascript:)/.test(v) || /\.html($|[#?])/.test(v) || v === "") return m;
      return attr + '="../' + v + '"';
    });
  }

  var api = { MOCK: true, FILES: FILES, THEMES: THEMES, TYPES: TYPES, FONTS: FONTS, read: read, build: build, validate: validate, nextId: nextId, fromCrossref: fromCrossref, buildArabic: buildArabic };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.DashLib = api;
})(typeof window !== "undefined" ? window : globalThis);
