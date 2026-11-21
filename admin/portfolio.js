/* Live research-portfolio page (portfolio.html) for the site dashboard: window.DashPortfolio in the browser,
   module.exports in Node. No DOM, no network, no dependencies. Same approach as admin/cv.js.

   portfolio.html holds <!-- pf:NAME --> ... <!-- /pf:NAME --> blocks, one item per line:
     auto blocks   stats, scope, themes, works, updated   (rebuilt from model.works on every build)
     owner block   trajectory                             (one <p> per line; edited by the owner, kept otherwise)
   Everything outside the blocks is static and is never touched.

   DashPortfolio.read(html)                 -> { trajectory: [text] }       (this is model.portfolio)
   DashPortfolio.build(model, html)         -> new html text (the very same string when nothing changed)
   DashPortfolio.buildDetailed(model, html) -> { html, warnings: [string], changed: [block names] }

   Model fields used: works (required), today ('YYYY-MM-DD'), portfolio ({trajectory}),
   and the verification cutoff from the first of: model.meta.verificationCutoffDisplay / verificationCutoff,
   model.cutoffDisplay, model.cutoff (ISO date). lib.read() does not return the cutoff, so when none is given the
   module keeps the date already on the page, and uses model.today when the works themselves changed
   (the dashboard sets the cutoff to "today" whenever works change, see lib.js).
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DashPortfolio = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var AUTO = ["stats", "scope", "themes", "works", "updated"];
  var OWNER = ["trajectory"];
  var THEME_ORDER = ["Cybersecurity, IoT, and cloud infrastructure", "NLP, education, and knowledge systems",
    "Healthcare and clinical decision support", "Decision analytics and intelligent systems",
    "Computer vision and environmental intelligence", "Responsible AI, governance, and society"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
    "October", "November", "December"];

  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function unesc(v) {
    return String(v == null ? "" : v).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  }
  function clean(v) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim(); }

  function findBlock(html, name) {
    var open = "<!-- pf:" + name + " -->", close = "<!-- /pf:" + name + " -->";
    var a = html.indexOf(open);
    if (a < 0) return null;
    var b = html.indexOf(close, a + open.length);
    if (b < 0) return null;
    return { start: a + open.length, end: b, inner: html.slice(a + open.length, b).replace(/^\n/, "").replace(/\n$/, "") };
  }
  function blockLines(html, name) {
    var b = findBlock(html, name);
    if (!b || !b.inner) return [];
    return b.inner.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
  }
  function setBlock(html, name, lines) {
    var b = findBlock(html, name);
    if (!b) return html;
    return html.slice(0, b.start) + (lines.length ? "\n" + lines.join("\n") + "\n" : "\n") + html.slice(b.end);
  }

  function dateEn(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m || +m[2] < 1 || +m[2] > 12) return "";
    return parseInt(m[3], 10) + " " + MONTHS[+m[2] - 1] + " " + m[1];
  }
  function naturalCompare(a, b) {
    var x = String(a), y = String(b);
    var nx = /\d+/.exec(x), ny = /\d+/.exec(y);
    var px = x.replace(/\d+.*/, ""), py = y.replace(/\d+.*/, "");
    if (nx && ny && px === py) { var d = parseInt(nx[0], 10) - parseInt(ny[0], 10); if (d) return d; }
    return x < y ? -1 : x > y ? 1 : 0;
  }

  /* ---------- read ---------- */
  function read(html) {
    html = String(html || "");
    var trajectory = [];
    blockLines(html, "trajectory").forEach(function (line) {
      var m = /^<p>([\s\S]*)<\/p>$/.exec(line);
      if (m) trajectory.push(unesc(m[1]));
    });
    return { trajectory: trajectory };
  }
  function readCutoff(html) {
    var m = /verified through ([^<]*?)\.\s*(?:It is not|<)/.exec(blockLines(html, "scope").join(" "));
    return m ? unesc(m[1]) : "";
  }

  /* ---------- renderers ---------- */
  function counts(works) {
    var c = { works: works.length, journal: 0, conference: 0, chapter: 0, themes: {}, min: null, max: null };
    works.forEach(function (w) {
      if (w.type === "Journal article") c.journal++;
      else if (w.type === "Conference paper") c.conference++;
      else if (w.type === "Book chapter") c.chapter++;
      c.themes[w.theme] = (c.themes[w.theme] || 0) + 1;
      var y = parseInt(w.year, 10);
      if (y) { if (c.min === null || y < c.min) c.min = y; if (c.max === null || y > c.max) c.max = y; }
    });
    return c;
  }
  function yearsText(c) {
    if (c.min === null) return "";
    return c.min === c.max ? String(c.min) : c.min + "-" + c.max;
  }
  function statsLines(c) {
    return ['<p class="lead">Evolution of cross-domain applied artificial intelligence research' + (yearsText(c) ? ", " + yearsText(c) : "") + "</p>",
      '<div class="stats">',
      "<div><b>" + c.works + "</b>verified works</div>",
      "<div><b>" + c.journal + "</b>journal articles</div>",
      "<div><b>" + c.conference + "</b>conference papers</div>",
      "<div><b>" + c.chapter + "</b>book chapters</div>",
      "</div>"];
  }
  function scopeLines(c, cutoff) {
    return ["<p>This portfolio is a curated website reference edition covering " + c.works + " works verified through " + esc(cutoff) +
      ". It is not a peer-reviewed article, an accepted manuscript, or evidence that the underlying synthesis has been published. " +
      "Publication titles, years, output types, concise contributions, methods, references, DOI links, and known metadata cautions are " +
      "provided for transparent academic review.</p>",
      '<p class="warn">The complete source Word manuscript is intentionally not distributed through the website.</p>'];
  }
  function themeLines(c) {
    var names = Object.keys(c.themes);
    names.sort(function (a, b) {
      if (c.themes[b] !== c.themes[a]) return c.themes[b] - c.themes[a];
      var ia = THEME_ORDER.indexOf(a), ib = THEME_ORDER.indexOf(b);
      ia = ia < 0 ? 99 : ia; ib = ib < 0 ? 99 : ib;
      return ia !== ib ? ia - ib : (a < b ? -1 : a > b ? 1 : 0);
    });
    return names.map(function (t) { return "<tr><td>" + esc(t) + "</td><td>" + c.themes[t] + "</td></tr>"; });
  }
  function doiHref(doi) {
    var d = clean(doi);
    return /^https?:\/\//i.test(d) ? d : "https://doi.org/" + d.replace(/^doi:\s*/i, "");
  }
  function workLine(w) {
    var methods = Array.isArray(w.methods) ? w.methods.map(clean).filter(Boolean).join(", ") : clean(w.methods);
    var doi = clean(w.doi) ? ' <a href="' + esc(doiHref(w.doi)) + '">' + esc(clean(w.doi)) + "</a>" : "";
    var note = clean(w.verificationNote) ? '<p class="note">Verification note: ' + esc(clean(w.verificationNote)) + "</p>" : "";
    return '<article class="work" id="' + esc(w.id) + '"><h3><span class="wid">' + esc(w.id) + ".</span> " + esc(clean(w.title)) + "</h3>" +
      '<p class="wmeta">' + esc(w.year) + " | " + esc(w.type) + " | " + esc(w.theme) + "</p>" +
      (methods ? "<p><b>Methods:</b> " + esc(methods) + "</p>" : "") +
      (clean(w.contribution) ? "<p>" + esc(clean(w.contribution)) + "</p>" : "") +
      '<p class="ref"><b>Reference:</b> ' + esc(clean(w.reference)) + doi + "</p>" + note + "</article>";
  }
  function worksLines(works) {
    return works.map(function (w, i) { return { w: w, i: i }; })
      .sort(function (a, b) { return naturalCompare(a.w.id, b.w.id) || a.i - b.i; })
      .map(function (x) { return workLine(x.w); });
  }
  function ownerLines(name, pf) {
    if (name === "trajectory") return (pf.trajectory || []).map(function (t) { return "<p>" + esc(clean(t)) + "</p>"; });
    return [];
  }

  /* ---------- build ---------- */
  function buildDetailed(model, html) {
    html = String(html || "");
    var warnings = [], changed = [];
    model = model || {};
    if (!html) return { html: html, warnings: ["portfolio.html is empty"], changed: [] };

    var pf = read(html);
    if (model.portfolio && typeof model.portfolio === "object" && Array.isArray(model.portfolio.trajectory)) pf.trajectory = model.portfolio.trajectory;

    var out = html;
    function put(name, lines) {
      if (!findBlock(out, name)) { warnings.push("portfolio.html: block pf:" + name + " is missing"); return; }
      var next = setBlock(out, name, lines);
      if (next !== out) { changed.push(name); out = next; }
    }

    OWNER.forEach(function (name) { put(name, ownerLines(name, pf)); });

    if (Array.isArray(model.works)) {
      var works = model.works;
      var c = counts(works);
      var worksNow = worksLines(works);
      // cutoff: explicit value, else the page's own, else today when the works changed
      var meta = model.meta || {};
      var cutoff = clean(meta.verificationCutoffDisplay) || dateEn(meta.verificationCutoff) || clean(model.cutoffDisplay) || dateEn(model.cutoff);
      var worksChanged = worksNow.join("\n") !== blockLines(out, "works").join("\n");
      if (!cutoff) {
        var onPage = readCutoff(out);
        cutoff = (worksChanged || !onPage) ? (dateEn(model.today) || onPage) : onPage;
      }
      if (!cutoff) warnings.push("portfolio.html: no verification cutoff date is known; the scope text was not updated");
      put("stats", statsLines(c));
      if (cutoff) {
        put("scope", scopeLines(c, cutoff));
        put("updated", ['<span class="updated">Verification cutoff: ' + esc(cutoff) + "</span>"]);
      }
      put("themes", themeLines(c));
      put("works", worksNow);
    } else {
      warnings.push("portfolio.html: the model has no works; the automatic blocks were left as they are");
    }
    return { html: out === html ? html : out, warnings: warnings, changed: changed };
  }
  function build(model, html) { return buildDetailed(model, html).html; }

  return { AUTO: AUTO, OWNER: OWNER, read: read, build: build, buildDetailed: buildDetailed, _findBlock: findBlock, _esc: esc };
});
