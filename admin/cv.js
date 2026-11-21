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

   DashCV.read(cvHtml)                 -> model.cv
   DashCV.build(model, cvHtml, opts)   -> new cv.html text (the same string when nothing changed)
   DashCV.buildDetailed(...)           -> { html, warnings: [string], changed: [block names] }
   DashCV.fromIndex(indexHtml)         -> { degrees: [{year,title,institution}], theses: [text] }
   DashCV.MODE_CLASS                   -> "cv-full": put it on <html> to show the full version (no script needed)
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DashCV = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var AUTO = ["header", "appointments", "education", "publications", "publications-full", "teaching", "service", "updated"];
  var OWNER = ["profile", "pillars", "accepted", "community", "development", "languages", "full-extra", "appointment-details"];
  var TYPE_GROUPS = [["Journal article", "Journal articles", "J"], ["Conference paper", "Conference papers", "C"], ["Book chapter", "Book chapters", "B"]];
  var CATALOGUE = "https://dromaia.github.io/publications.html";
  var DEFAULT_SELECTED = 17;
  var MAX_AUTHORS = 5; // more than this is written "First et al."
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
    "October", "November", "December"];

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
  function stripTags(html) {
    return clean(unesc(String(html || "").replace(/<[^>]*>/g, "")));
  }

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
  function splitTitle(title) {
    var text = en(title);
    var at = text.indexOf(" · ");
    if (at < 0) return { role: text, org: "" };
    return { role: text.slice(0, at).trim(), org: text.slice(at + 3).trim() };
  }
  function joinList(items) {
    if (items.length <= 1) return items.join("");
    if (items.length === 2) return items[0] + " and " + items[1];
    return items.slice(0, -1).join(", ") + ", and " + items[items.length - 1];
  }
  function sentence(text) {
    var value = clean(text);
    if (!value) return "";
    return /[.!?…]["”’)]?$/.test(value) ? value : value + ".";
  }

  /* ---------- entry line shared by appointments, education and service ---------- */
  function entryLine(cls, title, org, date, detailHtml, detailClass, tailHtml) {
    var line = '<div class="' + cls + '"><div class="row"><span class="t"><b>' + esc(title) + "</b>" +
      (org ? " — " + esc(org) : "") + "</span>" + (date ? '<span class="d">' + esc(date) + "</span>" : "") + "</div>";
    if (detailHtml) line += '<p class="' + (detailClass || "desc") + '">' + detailHtml + "</p>";
    return line + (tailHtml || "") + "</div>";
  }
  var EXTRA_RE = /^<div class="entry x"><div class="row"><span class="t"><b>(.*?)<\/b>(?: — (.*?))?<\/span>(?:<span class="d">(.*?)<\/span>)?<\/div>(?:<p class="desc">(.*?)<\/p>)?<\/div>$/;

  /* ---------- read ---------- */
  function read(cvHtml) {
    var html = String(cvHtml || "");
    var cv = {
      profile: { en: "" }, pillars: [], accepted: [], selected: DEFAULT_SELECTED, community: [], development: [],
      languages: "", openTo: "", extraService: [], educationNotes: {}, headerExtras: [],
      fullExtra: [], appointmentDetails: []
    };
    var m;

    var profile = blockLines(html, "profile").join(" ");
    m = /<p[^>]*>([\s\S]*?)<\/p>/.exec(profile);
    cv.profile.en = m ? stripTags(m[1]) : "";

    blockLines(html, "pillars").forEach(function (line) {
      var hit = /^<div class="pillar"><b>(.*?)<\/b><span>(.*?)<\/span><\/div>$/.exec(line);
      if (hit) cv.pillars.push({ title: unesc(hit[1]), text: unesc(hit[2]) });
    });

    blockLines(html, "accepted").forEach(function (line) {
      var hit = /^<p class="pub"><b class="y">(.*?)<\/b> (.*?)<\/p>$/.exec(line);
      if (hit) cv.accepted.push({ year: unesc(hit[1]), text: unesc(hit[2]) });
    });

    var pubs = findBlock(html, "publications");
    m = pubs && /data-selected="(\d+)"/.exec(pubs.inner);
    if (m) cv.selected = parseInt(m[1], 10);

    blockLines(html, "community").forEach(function (line) {
      var hit = /^<li><b>(.*?):<\/b> (.*?)<\/li>$/.exec(line) || /^<li><b>(.*?)<\/b>()<\/li>$/.exec(line);
      if (hit) cv.community.push({ title: unesc(hit[1]), text: unesc(hit[2]) });
    });

    blockLines(html, "development").forEach(function (line) {
      var hit = /^<div class="pd-item"><b>(.*?)<\/b><span>(.*?)<\/span><\/div>$/.exec(line);
      if (hit) cv.development.push({ title: unesc(hit[1]), text: unesc(hit[2]) });
    });

    blockLines(html, "languages").forEach(function (line) {
      var a = /^<p class="langs"><b>Languages:<\/b> (.*?)<\/p>$/.exec(line);
      var b = /^<p class="open"><b>Open to:<\/b> (.*?)<\/p>$/.exec(line);
      if (a) cv.languages = unesc(a[1]);
      if (b) cv.openTo = unesc(b[1]);
    });

    blockLines(html, "service").forEach(function (line) {
      var hit = EXTRA_RE.exec(line);
      if (hit) {
        cv.extraService.push({
          title: unesc(hit[1]), org: unesc(hit[2] || ""), date: unesc(hit[3] || ""), text: unesc(hit[4] || "")
        });
      }
    });

    blockLines(html, "education").forEach(function (line) {
      var year = /<span class="d">(.*?)<\/span>/.exec(line);
      var keep = /<span class="keep">(.*?)<\/span>/.exec(line);
      if (year && keep) cv.educationNotes[unesc(year[1])] = unesc(keep[1]);
    });

    blockLines(html, "full-extra").forEach(function (line) {
      var hit = /^<section class="full-only extra"><h2>(.*?)<\/h2><ul>(.*?)<\/ul><\/section>$/.exec(line);
      if (!hit) return;
      var items = [], re = /<li>(.*?)<\/li>/g, li;
      while ((li = re.exec(hit[2]))) items.push(unesc(li[1]));
      cv.fullExtra.push({ title: unesc(hit[1]), items: items });
    });

    blockLines(html, "appointment-details").forEach(function (line) {
      var hit = /^<div data-match="(.*?)">(.*?)<\/div>$/.exec(line);
      if (!hit) return;
      var bullets = [], re = /<span>(.*?)<\/span>/g, sp;
      while ((sp = re.exec(hit[2]))) bullets.push(unesc(sp[1]));
      cv.appointmentDetails.push({ match: unesc(hit[1]), bullets: bullets });
    });

    blockLines(html, "header").forEach(function (line) {
      if (line.indexOf('<p class="sub">') !== 0) return;
      var re = /<span class="keep">(.*?)<\/span>/g, hit;
      while ((hit = re.exec(line))) cv.headerExtras.push(unesc(hit[1]));
    });

    return cv;
  }

  /* ---------- owner blocks ---------- */
  function ownerLines(name, cv) {
    switch (name) {
      case "profile":
        return en(cv.profile) ? ["<p>" + esc(en(cv.profile)) + "</p>"] : [];
      case "pillars":
        return list(cv.pillars).map(function (p) {
          return '<div class="pillar"><b>' + esc(clean(p.title)) + "</b><span>" + esc(clean(p.text)) + "</span></div>";
        });
      case "accepted":
        var items = list(cv.accepted).filter(function (a) { return clean(a.text); }).map(function (a) {
          return '<p class="pub"><b class="y">' + esc(clean(a.year)) + "</b> " + esc(clean(a.text)) + "</p>";
        });
        return items.length ? ['<p class="pubhead">Accepted / in press</p>'].concat(items) : [];
      case "community":
        return list(cv.community).filter(function (c) { return clean(c.title) || clean(c.text); }).map(function (c) {
          var title = clean(c.title).replace(/:$/, "");
          return clean(c.text) ? "<li><b>" + esc(title) + ":</b> " + esc(clean(c.text)) + "</li>" : "<li><b>" + esc(title) + "</b></li>";
        });
      case "development":
        return list(cv.development).filter(function (d) { return clean(d.title); }).map(function (d) {
          return '<div class="pd-item"><b>' + esc(clean(d.title)) + "</b><span>" + esc(clean(d.text)) + "</span></div>";
        });
      case "languages":
        var out = [];
        if (clean(cv.languages)) out.push('<p class="langs"><b>Languages:</b> ' + esc(clean(cv.languages)) + "</p>");
        if (clean(cv.openTo)) out.push('<p class="open"><b>Open to:</b> ' + esc(clean(cv.openTo)) + "</p>");
        return out;
      case "full-extra":
        return list(cv.fullExtra).filter(function (x) { return x && clean(x.title); }).map(function (x) {
          return '<section class="full-only extra"><h2>' + esc(clean(x.title)) + "</h2><ul>" +
            list(x.items).map(clean).filter(Boolean).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></section>";
        });
      case "appointment-details":
        return list(cv.appointmentDetails).filter(function (x) { return x && clean(x.match); }).map(function (x) {
          return '<div data-match="' + esc(clean(x.match)) + '">' +
            list(x.bullets).map(clean).filter(Boolean).map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</div>";
        });
    }
    return [];
  }
  function list(value) { return Array.isArray(value) ? value : []; }

  /* ---------- auto blocks ---------- */
  function headerLines(model, cv, existing) {
    var titles = list(model.timeline).filter(function (t) { return /present/i.test(en(t.time)); })
      .map(function (t) { return splitTitle(t.title).role; }).filter(Boolean);
    var spans = titles.map(function (t) { return "<span>" + esc(t) + "</span>"; })
      .concat(list(cv.headerExtras).filter(clean).map(function (t) { return '<span class="keep">' + esc(clean(t)) + "</span>"; }));
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
      if (needle && hay.indexOf(needle) >= 0) list(d.bullets).map(clean).filter(Boolean).forEach(function (b) { bullets.push(b); });
    });
    if (!bullets.length) return "";
    return '<ul class="details full-only">' + bullets.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul>";
  }
  function appointmentLines(model, cv) {
    function entry(cls) {
      return function (t) {
        var parts = splitTitle(t.title);
        return entryLine(cls, parts.role, parts.org, dash(en(t.time)), esc(en(t.text)), "desc", detailBullets(t.title, cv));
      };
    }
    var lines = list(model.timeline).map(entry("entry"));
    var earlier = list(model.timelineEarlier).map(function (t) {
      var parts = splitTitle(t.title);
      return parts.role + (parts.org ? ", " + parts.org : "") + " (" + dash(en(t.time)) + ")";
    });
    // short version: one line; full version: proper entries
    if (earlier.length) lines.push('<p class="note short-only">Earlier academic roles: ' + esc(earlier.join("; ")) + ".</p>");
    return lines.concat(list(model.timelineEarlier).map(entry("entry full-only")));
  }

  function educationLines(degrees, theses, cv) {
    var notes = cv.educationNotes || {};
    return list(degrees).map(function (d, i) {
      var year = clean(d.year);
      var thesis = clean(d.thesis != null ? d.thesis : list(theses)[i]);
      var bits = [];
      if (clean(notes[year])) bits.push('<span class="keep">' + esc(clean(notes[year])) + "</span>");
      if (thesis) bits.push("Thesis: “" + esc(sentence(thesis)) + "”");
      return entryLine("entry", clean(d.title), clean(d.institution), year, bits.join(" "), "it");
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
      lines.push('<p class="themes"><b>Research themes (' + total + " works):</b> " +
        esc(themes.map(function (t) { return t + " (" + count[t] + ")"; }).join("; ")) + ".</p>");
    }
    var groups = TYPE_GROUPS.map(function (g) { return { type: g[0], title: g[1], prefix: g[2], works: [] }; });
    var other = { type: "", title: "Other works", prefix: "O", works: [] };
    works.forEach(function (w) {
      var hit = groups.filter(function (g) { return g.type.toLowerCase() === clean(w.type).toLowerCase(); })[0];
      (hit || other).works.push(w);
    });
    groups.concat([other]).forEach(function (g) {
      if (!g.works.length) return;
      lines.push('<p class="pubhead">' + esc(g.title) + " (" + g.works.length + ")</p>");
      g.works.forEach(function (w, i) { lines.push(formatPublication(w, { allAuthors: true, label: g.prefix + (i + 1) })); });
    });
    lines.push('<p class="note">Methods, contributions and citation counts for all ' + total + ' works: <a href="' + CATALOGUE +
      '">dromaia.github.io/publications.html ↗</a></p>');
    return lines;
  }
  function publicationLines(model, cv) {
    var works = newestFirst(model.works);
    var total = works.length;
    var selected = Math.max(0, Math.min(Number(cv.selected) >= 0 && cv.selected !== "" && cv.selected != null ? Number(cv.selected) : DEFAULT_SELECTED, total));
    var shown = works.slice(0, selected);
    var lines = [];
    if (shown.length) lines.push('<p class="pubhead">Published</p>');
    shown.forEach(function (w) { lines.push(formatPublication(w)); });
    var stored = Number(cv.selected) >= 0 && cv.selected !== "" && cv.selected != null ? Math.floor(Number(cv.selected)) : DEFAULT_SELECTED;
    var lead = selected >= total ? "All " : "The " + selected + " most recent of ";
    lines.push('<p class="note" data-selected="' + stored + '">' + lead + '<a href="' + CATALOGUE + '">' + total +
      " verified works on dromaia.github.io ↗</a></p>");
    return lines;
  }

  function teachingLines(model, existing) {
    var lead = "Current and recent courses at Prince Sultan University include ";
    var m = /^<p class="short-only">(.*? include )/.exec(existing[0] || "");
    if (m) lead = unesc(m[1]);
    function label(c) { return en(c.en != null ? c.en : c.title) + (clean(c.code) ? " (" + clean(c.code) + ")" : ""); }
    var courses = list(model.courses), flagship = list(model.flagship);
    var names = courses.map(label).filter(Boolean);
    if (!names.length && !flagship.length) return [];
    var lines = names.length ? ['<p class="short-only">' + esc(lead + joinList(names)) + ".</p>"] : [];
    // full version: flagship courses first, then every other course
    var seen = {}, first = [], rest = [];
    flagship.forEach(function (c) { var k = clean(c.code) || label(c); if (!seen[k] && label(c)) { seen[k] = true; first.push(label(c)); } });
    courses.forEach(function (c) { var k = clean(c.code) || label(c); if (!seen[k] && label(c)) { seen[k] = true; rest.push(label(c)); } });
    if (first.length) lines.push('<p class="full-only"><b>Flagship courses:</b> ' + esc(first.join("; ")) + ".</p>");
    if (rest.length) lines.push('<p class="full-only"><b>' + (first.length ? "Other recent courses" : "Recent courses") + ":</b> " + esc(rest.join("; ")) + ".</p>");
    return lines;
  }

  function serviceLines(model, cv) {
    var lines = list(cv.extraService).filter(function (x) { return clean(x.title); }).map(function (x) {
      return entryLine("entry x", clean(x.title), clean(x.org), clean(x.date), esc(clean(x.text)));
    });
    var groups = [], byOrg = {};
    list(model.roles).forEach(function (r) {
      var org = clean(r.org), role = en(r.en != null ? r.en : r.role);
      if (!role) return;
      if (!byOrg.hasOwnProperty(org)) { byOrg[org] = []; groups.push(org); }
      byOrg[org].push(role.replace(/[.;]+$/, ""));
    });
    groups.forEach(function (org) {
      lines.push('<p class="svc short-only">' + (org ? "<b>" + esc(org) + ":</b> " : "") + esc(byOrg[org].join("; ")) + ".</p>");
    });
    // full version: every committee and role on its own line
    var all = [];
    groups.forEach(function (org) {
      byOrg[org].forEach(function (role) { all.push("<li>" + (org ? "<b>" + esc(org) + ":</b> " : "") + esc(role) + "</li>"); });
    });
    if (all.length) lines = lines.concat(['<ul class="rolelist full-only">'], all, ["</ul>"]);
    return lines;
  }

  function updatedLines(today, existing) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(today || ""));
    if (!m || !MONTHS[parseInt(m[2], 10) - 1]) return existing;
    return ['<span class="updated">Last updated: ' + MONTHS[parseInt(m[2], 10) - 1] + " " + m[1] + "</span>"];
  }

  function fromIndex(indexHtml) {
    var html = String(indexHtml || "");
    var degrees = [], theses = [];
    var re = /<article class="degree-card">([\s\S]*?)<\/article>/g, m;
    while ((m = re.exec(html))) {
      var year = /<span class="degree-year">([\s\S]*?)<\/span>/.exec(m[1]);
      var title = /<h3[^>]*>([\s\S]*?)<\/h3>/.exec(m[1]);
      var inst = /<div class="degree-institution"[^>]*>([\s\S]*?)<\/div>/.exec(m[1]);
      degrees.push({ year: year ? stripTags(year[1]) : "", title: title ? stripTags(title[1]) : "", institution: inst ? stripTags(inst[1]) : "" });
    }
    var rt = /<div class="degree-detail">[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/g;
    while ((m = rt.exec(html))) theses.push(stripTags(m[1]));
    return { degrees: degrees, theses: theses };
  }

  /* ---------- build ---------- */
  function buildDetailed(model, cvHtml, opts) {
    var html = String(cvHtml || "");
    var warnings = [], changed = [];
    model = model || {};
    opts = opts || {};
    if (!html) return { html: html, warnings: ["cv.html is empty"], changed: [] };

    var current = read(html);
    var cv = {};
    Object.keys(current).forEach(function (key) { cv[key] = current[key]; });
    if (model.cv && typeof model.cv === "object") {
      Object.keys(model.cv).forEach(function (key) { if (model.cv[key] !== undefined && model.cv[key] !== null) cv[key] = model.cv[key]; });
    }

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
    var degrees = model.degrees, theses = model.theses;
    if (!Array.isArray(degrees) && opts.indexHtml) {
      var parsed = fromIndex(opts.indexHtml);
      degrees = parsed.degrees; theses = parsed.theses;
    }
    if (Array.isArray(degrees)) put("education", educationLines(degrees, theses, cv));
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
