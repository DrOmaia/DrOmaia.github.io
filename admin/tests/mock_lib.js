/* TEST STAND-IN for admin/lib.js and admin/cv.js (version 2 shapes of SPEC.md, deliberately simple logic).
   Used only by admin/tests/ui_test.py (routed in place of lib.js); never loaded by index.html. */
(function (root) {
  "use strict";
  var FILES = ["index.html", "publications.html", "research-data.js", "data/metrics.json", "sitemap.xml", "cv.html"];
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
    ar: [{ name: "IBM Plex Sans Arabic", weights: [400, 600, 700] }, { name: "Noto Naskh Arabic", weights: [400, 700] }, { name: "Tajawal", weights: [400, 500, 700] }, { name: "Cairo", weights: [400, 600, 700] }],
    en: [{ name: "Manrope", weights: [400, 600, 700, 800] }, { name: "Inter", weights: [400, 600, 700, 800] }],
    head: [{ name: "Georgia", weights: [400, 700], system: true }, { name: "Merriweather", weights: [400, 700] }]
  };
  var PALETTES = [
    { id: "default", ar: "الهادئ الدافئ", en: "Warm calm",
      light: { bg: "#f6f3ec", surface: "#fffdf8", surface2: "#eeeae0", text: "#22303b", muted: "#5f6c76", line: "#d9d3c5", accent: "#7a5a12", link: "#2c6aa6", green: "#1f7a63" },
      dark: { bg: "#111a24", surface: "#18232f", surface2: "#1f2c3a", text: "#dfe5ea", muted: "#9cafc1", line: "#2b3947", accent: "#d8b45b", link: "#68a9ff", green: "#64d5b3" } },
    { id: "olive", ar: "زيتي", en: "Olive",
      light: { bg: "#f4f5ee", surface: "#fdfdf8", surface2: "#e9ebdd", text: "#26302a", muted: "#5d6a60", line: "#d3d8c6", accent: "#55692b", link: "#2f6f6a", green: "#3d7a4f" },
      dark: { bg: "#12190f", surface: "#1a2317", surface2: "#222d1e", text: "#e1e8dc", muted: "#a3b39c", line: "#2e3a29", accent: "#b9cf7a", link: "#7fd0c8", green: "#84d79a" } },
    { id: "slate", ar: "أزرق رمادي", en: "Slate blue",
      light: { bg: "#f1f4f7", surface: "#ffffff", surface2: "#e4eaf0", text: "#1f2c3a", muted: "#566575", line: "#cfd8e1", accent: "#3b5b7a", link: "#235a9e", green: "#1f7a63" },
      dark: { bg: "#0f1620", surface: "#172231", surface2: "#1e2c3f", text: "#dde6ef", muted: "#9cafc1", line: "#2a3a4d", accent: "#9dc0e6", link: "#7fb4ff", green: "#64d5b3" } }
  ];
  var lang = "ar";
  function msg(ar, en) { return lang === "en" ? en : ar; }

  function unesc(s) { return String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function block(html, name) {
    var a = "<!-- dash:" + name + " -->", b = "<!-- /dash:" + name + " -->";
    var i = html.indexOf(a), j = html.indexOf(b);
    if (i < 0 || j < 0) throw new Error("missing block " + name);
    return { start: i + a.length, end: j, text: html.slice(i + a.length, j) };
  }
  function setBlock(html, name, text) { var b = block(html, name); return html.slice(0, b.start) + text + html.slice(b.end); }
  function data(text) { return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); }
  function bareDoi(v) { return String(v || "").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "").toLowerCase(); }
  function hexOk(v) { return /^#[0-9a-f]{6}$/i.test(String(v || "")); }
  function contrast(a, b) {
    function lum(h) {
      var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(h || ""));
      if (!m) return 0;
      var c = [m[1], m[2], m[3]].map(function (x) { var v = parseInt(x, 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }
    var x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function pick(p) { return { bg: p.bg, surface: p.surface, text: p.text, accent: p.accent, link: p.link }; }

  /* ---------- stand-in CV module ---------- */
  var CV_DEFAULT = {
    profile: { en: "Chair of the Information Systems Department and Assistant Professor at Prince Sultan University." },
    pillars: [{ title: "APPLIED AI", text: "Machine Learning · NLP" }, { title: "TRUSTWORTHY AI", text: "XAI · Ethics · Governance" }],
    accepted: [{ year: "2026", text: "Accepted test paper. ICAMAC 2026." }],
    selected: 17,
    community: [{ title: "747.5 certified volunteer hours", text: "Saudi National Volunteer Work Platform." }],
    development: [{ title: "Artificial Intelligence Analyst", text: "IBM Mastery Award" }],
    languages: "Arabic (native); English (professional proficiency).",
    openTo: "research collaboration, academic leadership opportunities, and responsible AI initiatives.",
    extraService: [{ title: "Track Chair (appointed)", org: "ICEGOV 2026", date: "2026", text: "Event postponed." }]
  };
  var DashCV = {
    MOCK: true,
    read: function (html) {
      var m = /<!--mock-cv:([\s\S]*?)-->/.exec(String(html || ""));
      if (m) { try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { /* fall through */ } }
      return JSON.parse(JSON.stringify(CV_DEFAULT));
    },
    build: function (model, html) {
      var cv = model.cv || CV_DEFAULT;
      if (JSON.stringify(cv) === JSON.stringify(DashCV.read(html)) && html) return html;
      var li = function (list, f) { return (list || []).map(function (x) { return "<li>" + f(x) + "</li>"; }).join(""); };
      return "<!DOCTYPE html>\n<html lang=\"en\" dir=\"ltr\"><head><meta charset=\"utf-8\"><title>Dr. Omaia Al-Omari - Academic CV</title>" +
        "<!--mock-cv:" + encodeURIComponent(JSON.stringify(cv)) + "--><style>.full-only{display:none}.cv-full .full-only{display:block}</style></head><body>" +
        "<h1>DR. OMAIA AL-OMARI</h1><h2>PROFESSIONAL PROFILE</h2><p id=\"cvProfile\">" + esc((cv.profile || {}).en) + "</p>" +
        "<h2>ACCEPTED / IN PRESS</h2><ul>" + li(cv.accepted, function (x) { return esc(x.year) + " " + esc(x.text); }) + "</ul>" +
        "<h2>SERVICE</h2><ul>" + li((model.roles || []).slice(0, 3), function (x) { return esc(x.org) + " — " + esc(x.en); }) +
        li(cv.extraService, function (x) { return esc(x.title) + " — " + esc(x.org) + " " + esc(x.date) + " " + esc(x.text); }) + "</ul>" +
        "<h2>PUBLICATIONS</h2><ul>" + li((model.works || []).slice(-(cv.selected || 17)).reverse(), function (w) { return esc(w.reference); }) + "</ul>" +
        "<div class=\"full-only\" id=\"cvFull\">" +
        (cv.fullExtra || []).map(function (x) { return "<h2>" + esc(x.title) + "</h2><ul>" + li(x.items, esc) + "</ul>"; }).join("") +
        (cv.appointmentDetails || []).map(function (x) { return "<h3>" + esc(x.match) + "</h3><ul>" + li(x.bullets, esc) + "</ul>"; }).join("") + "</div>" +
        "<p>" + esc(cv.languages) + " " + esc(cv.openTo) + "</p><button type=\"button\">Save as PDF</button></body></html>\n";
    }
  };

  /* ---------- read ---------- */
  function readSections(idx) {
    var out = [], re = /<!-- dash:section (\S+) -->([\s\S]*?)<!-- \/dash:section \1 -->/g, m;
    while ((m = re.exec(idx))) {
      var body = m[2], custom = /^custom-/.test(m[1]), s;
      var mock = /<!--mock-section:([\s\S]*?)-->/.exec(body);
      if (custom && mock) { s = JSON.parse(decodeURIComponent(mock[1])); s.id = m[1]; s.custom = true; }
      else {
        var h = /<h2 data-ar="([^"]*)">([^<]*)<\/h2>/.exec(body) || [];
        s = { id: m[1], title: { en: unesc(h[2] || m[1]), ar: unesc(h[1] || m[1]) }, custom: false };
      }
      s.hidden = /<section\b[^>]*\shidden\b/.test(body);
      out.push(s);
    }
    return out;
  }
  function readNav(idx) {
    var out = [], re = /<a data-ar="([^"]*)" href="([^"]*)"( hidden)?>([^<]*)<\/a>/g, m, t = block(idx, "nav").text;
    while ((m = re.exec(t))) out.push({ href: m[2], en: unesc(m[4]), ar: unesc(m[1]), hidden: !!m[3] });
    return out;
  }
  function readCourses(idx, name, cls) {
    var out = [], re = new RegExp('<article class="' + cls + '"><span[^>]*>([^<]*)</span><strong data-ar="([^"]*)">([^<]*)</strong></article>', "g"), m, t = block(idx, name).text;
    while ((m = re.exec(t))) out.push({ code: unesc(m[1]), en: unesc(m[3]), ar: unesc(m[2]) });
    return out;
  }
  function readTimeline(idx, name) {
    var out = [], re = /<article class="role"><time>([\s\S]*?)<\/time><div><h3 data-ar="([^"]*)">([^<]*)<\/h3><p data-ar="([^"]*)">([^<]*)<\/p><\/div><\/article>/g, m, t = block(idx, name).text;
    while ((m = re.exec(t))) out.push({ time: unesc(m[1].replace(/<[^>]+>/g, "")), title: { en: unesc(m[3]), ar: unesc(m[2]) }, text: { en: unesc(m[5]), ar: unesc(m[4]) } });
    return out;
  }
  function readTheme(idx) {
    var t = block(idx, "theme").text, m = /\/\*mock-theme:([\s\S]*?)\*\//.exec(t);
    if (m) { try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { /* default below */ } }
    return { palette: "default", light: pick(PALETTES[0].light), dark: pick(PALETTES[0].dark) };
  }

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
    var fm = /--font-en:"([^"]*)";--font-ar:"([^"]*)";(?:--font-head-en:"([^"]*)";)?/.exec(block(idx, "fonts").text);
    var texts = []; re = /<(h2|h3|p|summary)\sdata-ar="([^"<>]*)">([^<]*)<\/\1>/g;
    ["index.html", "publications.html"].forEach(function (page) {
      var n = 0, mm; re.lastIndex = 0;
      while ((mm = re.exec(files[page])) && n < 60) { texts.push({ id: page + "#" + n, page: page, en: unesc(mm[3]), ar: unesc(mm[2]) }); n++; }
    });
    var citations = {};
    try { (JSON.parse(files["data/metrics.json"]).per_work || []).forEach(function (r) { if (r.doi && typeof r.crossref === "number") citations[String(r.doi).toLowerCase()] = r.crossref; }); } catch (e) { /* none */ }
    var pv = /PhotoDrOmaia\.webp\?v=(\d+)/.exec(idx);
    return {
      works: works, metrics: metrics, news: news, roles: roles, texts: texts,
      fonts: { ar: fm[2], en: fm[1], head: fm[3] || "Georgia" }, theme: readTheme(idx),
      sections: readSections(idx), nav: readNav(idx),
      flagship: readCourses(idx, "courses-flagship", "flagship-course"), courses: readCourses(idx, "courses", "course-item"),
      timeline: readTimeline(idx, "timeline"), timelineEarlier: readTimeline(idx, "timeline-earlier"),
      photoVersion: pv ? pv[1] : "", citations: citations, cv: DashCV.read(files["cv.html"]), warnings: []
    };
  }

  /* ---------- build ---------- */
  function themeCss(t) {
    if (!t || t.palette === "default") return "\n    <style></style>\n    ";
    var p = PALETTES.filter(function (x) { return x.id === t.palette; })[0];
    var l = t.palette === "custom" ? t.light : pick(p.light), d = t.palette === "custom" ? t.dark : pick(p.dark);
    var vars = function (c) { return "--bg:" + c.bg + ";--surface:" + c.surface + ";--text:" + c.text + ";--gold:" + c.accent + ";--accent:" + c.accent + ";--blue:" + c.link + ";"; };
    return "\n    <style>/*mock-theme:" + encodeURIComponent(JSON.stringify(t)) + '*/html:root[data-theme="light"]{' + vars(l) + '}html:root[data-theme="dark"]{' + vars(d) + "}</style>\n    ";
  }
  function fontLink(f) {
    var fam = [f.en, f.ar, f.head].filter(function (n, i, a) { return n && a.indexOf(n) === i && n !== "Georgia"; }).map(function (n) { return "family=" + n.replace(/ /g, "+") + ":wght@400;700"; }).join("&");
    return '\n    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?' + fam + '&display=swap">\n    <style>:root{--font-en:"' + f.en + '";--font-ar:"' + f.ar + '";--font-head-en:"' + f.head + '";}</style>\n    ';
  }
  function customSection(s) {
    return '<section id="' + esc(s.id) + '"' + (s.hidden ? " hidden" : "") + "><!--mock-section:" + encodeURIComponent(JSON.stringify(s)) + '-->\n<div class="wrap">\n<div class="section-head"><div><span class="kicker" data-ar="' +
      esc((s.kicker || {}).ar) + '">' + esc((s.kicker || {}).en) + '</span><h2 data-ar="' + esc(s.title.ar) + '">' + esc(s.title.en) + '</h2></div>\n<p data-ar="' + esc((s.intro || {}).ar) + '">' + esc((s.intro || {}).en) + '</p></div>\n<div class="grid3">\n' +
      (s.cards || []).map(function (c) { return '<article class="card"><h3 data-ar="' + esc(c.title.ar) + '">' + esc(c.title.en) + '</h3><p data-ar="' + esc(c.text.ar) + '">' + esc(c.text.en) + "</p>" + (c.link ? '<a href="' + esc(c.link) + '">↗</a>' : "") + "</article>"; }).join("\n") +
      "\n</div>\n</div>\n</section>";
  }
  function applySections(idx, sections) {
    var re = /<!-- dash:section (\S+) -->\n([\s\S]*?)\n<!-- \/dash:section \1 -->\n/g, m, blocks = {}, first = -1, last = -1;
    while ((m = re.exec(idx))) { blocks[m[1]] = m[2]; if (first < 0) first = m.index; last = m.index + m[0].length; }
    var out = sections.map(function (s) {
      var body = s.custom ? customSection(s) : (blocks[s.id] || "").replace(/<section\b([^>]*?)\shidden\b/, "<section$1");
      if (!s.custom && s.hidden) body = body.replace(/<section\b/, "<section hidden");
      return "<!-- dash:section " + s.id + " -->\n" + body + "\n<!-- /dash:section " + s.id + " -->\n";
    }).join("");
    return idx.slice(0, first) + out + idx.slice(last);
  }
  function syncNav(model) {
    var nav = (model.nav || []).map(function (n) { return { href: n.href, en: n.en, ar: n.ar, hidden: !!n.hidden }; });
    var byId = {};
    (model.sections || []).forEach(function (s) { byId["#" + s.id] = s; });
    nav = nav.filter(function (n) { return !/^#custom-/.test(n.href) || byId[n.href]; });
    nav.forEach(function (n) { var s = byId[n.href]; if (s) { n.hidden = !!s.hidden; if (s.custom) { n.en = s.title.en; n.ar = s.title.ar; } } });
    (model.sections || []).forEach(function (s) {
      if (s.custom && !nav.some(function (n) { return n.href === "#" + s.id; })) nav.push({ href: "#" + s.id, en: s.title.en, ar: s.title.ar, hidden: !!s.hidden });
    });
    return nav;
  }

  function build(files, model, opts) {
    var base = read(files), outFiles = {}, summary = [], idx = files["index.html"], pub = files["publications.html"];
    var diff = function (k) { return JSON.stringify(base[k]) !== JSON.stringify(model[k]); };
    var say = function (ar, en) { summary.push(msg(ar, en)); };
    if (diff("works")) {
      var d = data(files["research-data.js"]); d.works = model.works; d.meta.total = model.works.length; d.meta.verificationCutoff = (opts && opts.today) || "";
      outFiles["research-data.js"] = "window.RESEARCH_PORTFOLIO=" + JSON.stringify(d) + ";";
      pub = pub.replace(/(<strong data-count="works">)\d+/, "$1" + model.works.length);
      say("الأبحاث: العدد الآن " + model.works.length + ".", "Publications: " + model.works.length + " now.");
    }
    if (diff("metrics") || diff("works")) {
      idx = setBlock(idx, "metrics", "\n" + model.metrics.map(function (t) {
        var v = esc(t.auto ? model.works.length : t.value), body = "<strong>" + v + '</strong><span data-ar="' + esc(t.ar) + '">' + esc(t.en) + "</span>";
        return t.href ? '  <a class="metric" href="' + t.href + '">' + body + "</a>" : '  <div class="metric">' + body + "</div>";
      }).join("\n") + "\n");
      if (diff("metrics")) say("الأرقام: حُدّثت.", "Numbers updated.");
    }
    if (diff("news")) {
      idx = setBlock(idx, "news", "\n" + model.news.map(function (n) { return '<li><time datetime="' + esc(n.year) + '">' + esc(n.year) + '</time> — <span data-ar="' + esc(n.ar) + '">' + esc(n.en) + "</span></li>"; }).join("\n") + "\n");
      say("المستجدات: " + model.news.length + " أسطر.", "News: " + model.news.length + " lines.");
    }
    if (diff("roles")) {
      idx = setBlock(idx, "roles", "\n" + model.roles.map(function (r) {
        return '<article class="society-item"><span class="society-org"' + (r.orgAr ? ' data-ar="' + esc(r.orgAr) + '"' : "") + ">" + esc(r.org) + '</span><span class="society-role" data-ar="' + esc(r.ar) + '">' + esc(r.en) + "</span></article>";
      }).join("\n") + "\n");
      say("اللجان والأدوار: " + model.roles.length + ".", "Committees and roles: " + model.roles.length + ".");
    }
    [["flagship", "courses-flagship", "flagship-course", "<span>"], ["courses", "courses", "course-item", '<span class="course-code">']].forEach(function (c) {
      if (!diff(c[0])) return;
      idx = setBlock(idx, c[1], "\n" + model[c[0]].map(function (x) { return '<article class="' + c[2] + '">' + c[3] + esc(x.code) + '</span><strong data-ar="' + esc(x.ar) + '">' + esc(x.en) + "</strong></article>"; }).join("\n") + "\n");
      say("المقررات: " + model[c[0]].length + ".", "Courses: " + model[c[0]].length + ".");
    });
    [["timeline", "timeline"], ["timelineEarlier", "timeline-earlier"]].forEach(function (c) {
      if (!diff(c[0])) return;
      idx = setBlock(idx, c[1], "\n" + model[c[0]].map(function (x) { return '<article class="role"><time>' + esc(x.time) + '</time><div><h3 data-ar="' + esc(x.title.ar) + '">' + esc(x.title.en) + '</h3><p data-ar="' + esc(x.text.ar) + '">' + esc(x.text.en) + "</p></div></article>"; }).join("\n") + "\n");
      say("المسيرة: " + model[c[0]].length + ".", "Career: " + model[c[0]].length + ".");
    });
    if (diff("sections") || diff("nav")) {
      idx = applySections(idx, model.sections);
      idx = setBlock(idx, "nav", "\n" + syncNav(model).map(function (n) { return '<a data-ar="' + esc(n.ar) + '" href="' + esc(n.href) + '"' + (n.hidden ? " hidden" : "") + ">" + esc(n.en) + "</a>"; }).join("\n") + "\n");
      say("الأقسام: " + model.sections.length + ".", "Sections: " + model.sections.length + ".");
    }
    if (diff("fonts")) {
      idx = setBlock(idx, "fonts", fontLink(model.fonts)); pub = setBlock(pub, "fonts", fontLink(model.fonts));
      say("الخطوط: " + model.fonts.ar + " / " + model.fonts.en + " / " + model.fonts.head + ".", "Fonts: " + model.fonts.ar + " / " + model.fonts.en + " / " + model.fonts.head + ".");
    }
    if (diff("theme")) {
      idx = setBlock(idx, "theme", themeCss(model.theme)); pub = setBlock(pub, "theme", themeCss(model.theme));
      say("الألوان: " + model.theme.palette + ".", "Colours: " + model.theme.palette + ".");
    }
    if (diff("photoVersion") && model.photoVersion) {
      idx = idx.replace(/PhotoDrOmaia\.webp(\?v=\d+)?"/g, 'PhotoDrOmaia.webp?v=' + model.photoVersion + '"');
      say("الصورة الشخصية: نسخة جديدة.", "Portrait: new version.");
    }
    if (diff("texts")) {
      var n = 0;
      model.texts.forEach(function (t, i) {
        var o = base.texts[i]; if (!o || (o.en === t.en && o.ar === t.ar)) return;
        var from = 'data-ar="' + esc(o.ar) + '">' + esc(o.en) + "<", to = 'data-ar="' + esc(t.ar) + '">' + esc(t.en) + "<";
        if (t.page === "index.html") idx = idx.replace(from, to); else pub = pub.replace(from, to);
        n++;
      });
      say("النصوص: " + n + ".", "Texts: " + n + ".");
    }
    if (diff("citations")) {
      var mj = JSON.parse(files["data/metrics.json"]), touched = 0;
      (mj.per_work || []).forEach(function (r) { var k = String(r.doi || "").toLowerCase(); if (k && typeof model.citations[k] === "number" && model.citations[k] !== r.crossref) { r.crossref = model.citations[k]; touched++; } });
      mj.mock_citations = model.citations;
      outFiles["data/metrics.json"] = JSON.stringify(mj, null, 1) + "\n";
      say("الاستشهادات: حُدّثت.", "Citations updated.");
    }
    if (diff("cv") || diff("works") || diff("roles")) {
      var cv = DashCV.build(model, files["cv.html"]);
      if (cv !== files["cv.html"]) { outFiles["cv.html"] = cv; if (diff("cv")) say("السيرة: حُدّثت.", "CV updated."); }
    }
    if (idx !== files["index.html"]) { outFiles["index.html"] = idx; outFiles["ar/index.html"] = buildArabic("index.html", idx); }
    if (pub !== files["publications.html"]) { outFiles["publications.html"] = pub; outFiles["ar/publications.html"] = buildArabic("publications.html", pub); }
    var warnings = diff("works") ? [msg("(نسخة اختبار) لم تُحدَّث بطاقات الأبحاث.", "(test stand-in) publication cards were not updated.")] : [];
    return { files: outFiles, warnings: Object.keys(outFiles).length ? warnings : [], summary: summary };
  }

  function validate(model) {
    var errs = [];
    (model.works || []).forEach(function (w) {
      if (!w.title) errs.push(w.id + msg(": العنوان ناقص.", ": the title is missing."));
      if (!w.contribution) errs.push(w.id + msg(": اكتب المساهمة.", ": write the contribution."));
    });
    ["light", "dark"].forEach(function (k) {
      if (model.theme && model.theme.palette === "custom") Object.keys(model.theme[k] || {}).forEach(function (c) { if (!hexOk(model.theme[k][c])) errs.push(msg("لون غير صحيح: ", "Bad colour: ") + c); });
    });
    return errs;
  }
  function nextId(works) {
    var max = 0; (works || []).forEach(function (w) { var n = parseInt(String(w.id).replace(/\D/g, ""), 10); if (n > max) max = n; });
    return "P" + String(max + 1).padStart(2, "0");
  }
  function fromCrossref(m) {
    var year = (((m.issued || {})["date-parts"] || [[]])[0] || [])[0];
    var authors = (m.author || []).map(function (a) { return a.family + ", " + String(a.given || "").charAt(0) + "."; }).join(", ");
    var title = (m.title || [""])[0], venue = (m["container-title"] || [""])[0];
    return { title: title, year: year, type: m.type === "proceedings-article" ? "Conference paper" : m.type === "book-chapter" ? "Book chapter" : "Journal article",
      reference: authors + " (" + year + "). " + title + ". " + venue + ".", doi: m.DOI ? "https://doi.org/" + m.DOI : "" };
  }
  function buildArabic(page, html) {
    var out = html.replace(/<([a-zA-Z][a-zA-Z0-9]*)((?:\s[^>]*?)?)\sdata-ar="([^"]*)"([^>]*)>([\s\S]*?)<\/\1\s*>/g, function (m, tag, before, ar, after) { return "<" + tag + before + after + ">" + ar + "</" + tag + ">"; });
    out = out.replace('<html lang="en" dir="ltr"', '<html lang="ar" dir="rtl"');
    return out.replace(/\b(href|src)="([^"]*)"/g, function (m, attr, v) {
      if (/^(https?:|\/\/|\/|#|mailto:|tel:|data:|javascript:)/.test(v) || /\.html($|[#?])/.test(v) || v === "") return m;
      return attr + '="../' + v + '"';
    });
  }
  function parseAchievements(text) {
    var src = String(text || "").replace(/\r/g, ""), items = [];
    var head = src.split(/\n(?=ASK ME\b)/)[0].split(/\n(?=NUMBERS\b)/)[0];
    head.split(/\n(?=ITEM\s+\d+)/).forEach(function (chunk) {
      var m = /^ITEM\s+(\d+)/.exec(chunk.trim());
      if (!m) return;
      var f = function (label) { var r = new RegExp("^" + label + ":\\s*(.*)$", "mi").exec(chunk); return r ? r[1].trim() : ""; };
      var date = f("Date"), y = /(19|20)\d{2}/.exec(date), link = f("Public link");
      items.push({ n: parseInt(m[1], 10), category: f("Category"), titleEn: f("Title \\(English\\)"), titleAr: f("Title \\(Arabic\\)"), organisation: f("Organisation"),
        role: f("My role"), date: date, year: y ? y[0] : "", link: /^https?:\/\//i.test(link) ? link : "", suggest: f("Suggest"), why: f("Why") });
    });
    var list = function (name, stop) {
      var r = new RegExp("\\n" + name + "\\s*\\n([\\s\\S]*?)(?=\\n(?:" + stop + ")\\b|\\nTotal items|$)").exec("\n" + src);
      return r ? r[1].split("\n").map(function (l) { return l.replace(/^\s*[-•]\s*/, "").trim(); }).filter(Boolean) : [];
    };
    items.askMe = list("ASK ME", "NUMBERS");
    items.numbers = list("NUMBERS", "ASK ME");
    return items;
  }

  var api = {
    MOCK: true, FILES: FILES, THEMES: THEMES, TYPES: TYPES, FONTS: FONTS, PALETTES: PALETTES,
    setLang: function (l) { lang = l === "en" ? "en" : "ar"; }, contrast: contrast,
    read: read, build: build, validate: validate, nextId: nextId, fromCrossref: fromCrossref, buildArabic: buildArabic,
    parseAchievements: parseAchievements, normalizeDoi: function (v) { return "https://doi.org/" + bareDoi(v); }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.DashLib = api;
  root.DashCV = DashCV;
})(typeof window !== "undefined" ? window : globalThis);

/*IMPORT-STANDIN-START*/
/* TEST STAND-IN for admin/cvimport.js (window.DashImport). The test serves only this block in place of
   cvimport.js when the real file does not exist. It reads the text of a DOCX saved without compression. */
(function (root) {
  "use strict";
  if (root.DashImport) return;
  var KINDS = [["publications", /publication|research/i], ["education", /education/i], ["experience", /experience|appointment|employment/i], ["teaching", /teaching|course/i],
    ["training", /training|certificate/i], ["skills", /skill/i], ["memberships", /member/i], ["awards", /award|honou?r/i], ["service", /service|committee/i],
    ["languages", /language/i], ["profile", /profile|summary|objective/i]];
  root.DashImport = {
    MOCK: true,
    extract: function (buffer, name) {
      return new Promise(function (resolve, reject) {
        var kind = /\.pdf$/i.test(name) ? "pdf" : /\.docx$/i.test(name) ? "docx" : "";
        var fail = function (code) { var e = new Error(code); e.code = code; reject(e); };
        if (!kind) return fail("type");
        if (buffer.byteLength > 300000) return fail("too-large");
        var raw = new TextDecoder("utf-8").decode(new Uint8Array(buffer));
        if (kind === "pdf") return resolve({ kind: kind, text: "", pages: 1, warnings: raw.indexOf("/Font") < 0 ? ["no-text"] : [] });
        var out = [], re = /<w:p[ >][\s\S]*?<\/w:p>/g, m;
        while ((m = re.exec(raw))) out.push((m[0].match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map(function (x) { return x.replace(/<[^>]+>/g, ""); }).join(""));
        resolve({ kind: kind, text: out.join("\n").replace(/&amp;/g, "&"), pages: 1, warnings: [] });
      });
    },
    sections: function (text) {
      var out = [], cur = null;
      String(text || "").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean).forEach(function (l) {
        if (/^[A-Z][A-Z &/-]{3,}$/.test(l)) { cur = { title: l, lines: [] }; out.push(cur); }
        else if (cur) cur.lines.push(l);
      });
      return out;
    },
    guess: function (section) {
      var t = String((section || {}).title || "");
      for (var i = 0; i < KINDS.length; i++) if (KINDS[i][1].test(t)) return KINDS[i][0];
      return "other";
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
/*IMPORT-STANDIN-END*/
