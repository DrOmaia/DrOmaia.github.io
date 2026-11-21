/* Read an existing CV (PDF or DOCX) in the browser and split it into sections (window.DashImport).
   Nothing is uploaded: the file is read from memory. DOCX is unzipped and parsed here; PDF text comes from
   Mozilla pdf.js, vendored in admin/vendor/pdfjs/ and loaded on demand from the same origin.

   DashImport.extract(arrayBuffer, fileName) -> Promise<{kind:'pdf'|'docx', text, pages?, warnings:[code]}>
       text: one line per paragraph / visual line; pages are separated by a form feed ("\f").
       warnings: 'no-text' (scanned PDF, text is ''), 'few-text' (very little text found).
       Throws Error with .code: 'too-large' | 'type' | 'read' | 'password' | 'unsupported'.
   DashImport.split(text)    -> {sections:[{title, lines:[text]}], removed:[text]}   (removed = running headers/footers, page numbers)
   DashImport.sections(text) -> the sections array of split(text)
   DashImport.guess(section) -> 'publications'|'education'|'experience'|'teaching'|'training'|'skills'|'memberships'|
                                'awards'|'service'|'languages'|'profile'|'other'
   DashImport.suggest(section) -> 'skip' (the site already covers it) | 'add'
*/
(function (root) {
  "use strict";

  var MAX_BYTES = 15 * 1024 * 1024;
  var PDFJS_VERSION = "3.11.174";
  var HEADER_TITLE = "Header";

  /* Where this script lives, so the vendored pdf.js is found whatever page loads us. */
  var SELF_URL = (function () {
    try {
      var cur = root.document && root.document.currentScript;
      if (cur && cur.src) return cur.src;
    } catch (e) { /* ignore */ }
    return (root.location && root.location.href) || "";
  })();

  function fail(code, message) {
    var err = new Error(message || code);
    err.code = code;
    return err;
  }

  function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (data && data.buffer instanceof ArrayBuffer) return new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength);
    throw fail("type");
  }

  function kindOf(bytes, fileName) {
    var name = String(fileName || "").toLowerCase();
    var isPdf = bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
    var isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05);
    if (isPdf) return "pdf";
    if (isZip && (/\.docx$/.test(name) || !/\.[a-z0-9]+$/.test(name))) return "docx";
    if (/\.pdf$/.test(name) && !isZip) {
      // some PDFs carry a few junk bytes before the header
      var head = "";
      for (var i = 0; i < Math.min(bytes.length, 1024); i++) head += String.fromCharCode(bytes[i]);
      if (head.indexOf("%PDF") >= 0) return "pdf";
    }
    return null;
  }

  /* ------------------------------------------------------------------ DOCX */

  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  /* Central directory of a zip: {name: {method, compSize, size, offset}}. */
  function zipEntries(b) {
    var eocd = -1;
    var stop = Math.max(0, b.length - 65557);
    for (var i = b.length - 22; i >= stop; i--) {
      if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) { eocd = i; break; }
    }
    if (eocd < 0) throw fail("read");
    var count = u16(b, eocd + 10);
    var pos = u32(b, eocd + 16);
    var entries = {};
    var dec = new TextDecoder("utf-8");
    for (var n = 0; n < count; n++) {
      if (pos + 46 > b.length || u32(b, pos) !== 0x02014b50) throw fail("read");
      var method = u16(b, pos + 10);
      var compSize = u32(b, pos + 20);
      var size = u32(b, pos + 24);
      var nameLen = u16(b, pos + 28), extraLen = u16(b, pos + 30), commentLen = u16(b, pos + 32);
      var offset = u32(b, pos + 42);
      var name = dec.decode(b.subarray(pos + 46, pos + 46 + nameLen));
      entries[name] = { method: method, compSize: compSize, size: size, offset: offset };
      pos += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  async function zipRead(b, entry) {
    var o = entry.offset;
    if (o + 30 > b.length || u32(b, o) !== 0x04034b50) throw fail("read");
    var start = o + 30 + u16(b, o + 26) + u16(b, o + 28);
    var data = b.subarray(start, start + entry.compSize);
    if (entry.method === 0) return data;
    if (entry.method !== 8) throw fail("unsupported");
    if (typeof root.DecompressionStream !== "function") throw fail("unsupported");
    var stream = new Blob([data]).stream().pipeThrough(new root.DecompressionStream("deflate-raw"));
    var buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  function childElements(node) {
    var out = [];
    for (var c = node.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) out.push(c);
    return out;
  }

  /* Text of one paragraph (or any inline container); line breaks inside it become "\n". */
  function runText(node) {
    var out = "";
    (function walk(n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType !== 1) continue;
        var name = c.localName;
        if (name === "t") out += c.textContent;
        else if (name === "tab" || name === "ptab") out += " ";
        else if (name === "br" || name === "cr") out += "\n";
        else if (name === "noBreakHyphen") out += "-";
        else if (name === "softHyphen") out += "";
        else if (name === "Fallback" || name === "delText" || name === "del" || name === "instrText" || name === "pPr" || name === "rPr") continue;
        else walk(c);
      }
    })(node);
    return out;
  }

  function cellText(tc) {
    var parts = [];
    (function walk(n) {
      childElements(n).forEach(function (c) {
        var name = c.localName;
        if (name === "p") { var t = runText(c).replace(/\s*\n\s*/g, " ").trim(); if (t) parts.push(t); }
        else if (name === "tbl") blockLines(c).forEach(function (l) { if (l.trim()) parts.push(l.trim()); });
        else if (name === "sdt" || name === "sdtContent" || name === "customXml" || name === "smartTag") walk(c);
      });
    })(tc);
    return parts.join(" ");
  }

  /* Lines of a block container (body, table, content control). */
  function blockLines(container) {
    var lines = [];
    childElements(container).forEach(function (c) {
      var name = c.localName;
      if (name === "p") {
        runText(c).split("\n").forEach(function (l) { lines.push(l); });
      } else if (name === "tbl") {
        childElements(c).forEach(function (tr) {
          if (tr.localName !== "tr") { if (tr.localName === "sdt") blockLines(tr).forEach(function (l) { lines.push(l); }); return; }
          var cells = [];
          (function rowWalk(n) {
            childElements(n).forEach(function (tc) {
              if (tc.localName === "tc") cells.push(cellText(tc));
              else if (tc.localName === "sdt" || tc.localName === "sdtContent") rowWalk(tc);
            });
          })(tr);
          // merged cells repeat nothing; drop empty cells at the ends only
          while (cells.length && !cells[cells.length - 1]) cells.pop();
          var line = cells.join(" | ").replace(/^(\s*\|\s*)+/, "");
          if (line.trim()) lines.push(line);
        });
      } else if (name === "sdt" || name === "sdtContent" || name === "customXml" || name === "smartTag") {
        blockLines(c).forEach(function (l) { lines.push(l); });
      }
    });
    return lines;
  }

  async function readDocx(bytes) {
    var entries = zipEntries(bytes);
    var entry = entries["word/document.xml"];
    if (!entry) throw fail("read");
    var xml = new TextDecoder("utf-8").decode(await zipRead(bytes, entry));
    var doc = new root.DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw fail("read");
    var body = null;
    var all = doc.documentElement ? childElements(doc.documentElement) : [];
    for (var i = 0; i < all.length; i++) if (all[i].localName === "body") body = all[i];
    if (!body) throw fail("read");
    var lines = blockLines(body).map(function (l) { return l.replace(/[ \t ]+/g, " ").trim(); });
    return squeeze(lines).join("\n");
  }

  /* Drop leading/trailing empty lines and runs of empty lines. */
  function squeeze(lines) {
    var out = [];
    lines.forEach(function (l) {
      if (!l) { if (out.length && out[out.length - 1] !== "") out.push(""); }
      else out.push(l);
    });
    while (out.length && out[out.length - 1] === "") out.pop();
    while (out.length && out[0] === "") out.shift();
    return out;
  }

  /* ------------------------------------------------------------------- PDF */

  var pdfjsPromise = null;

  function loadPdfjs() {
    if (root.pdfjsLib && root.pdfjsLib.getDocument) return Promise.resolve(root.pdfjsLib);
    if (pdfjsPromise) return pdfjsPromise;
    pdfjsPromise = new Promise(function (resolve, reject) {
      var base = new URL("vendor/pdfjs/", SELF_URL).href;
      var s = root.document.createElement("script");
      s.src = base + "pdf.min.js?v=" + PDFJS_VERSION;
      s.async = true;
      s.onload = function () {
        var lib = root.pdfjsLib;
        if (!lib || !lib.getDocument) { pdfjsPromise = null; reject(fail("unsupported")); return; }
        lib.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.js?v=" + PDFJS_VERSION;
        resolve(lib);
      };
      s.onerror = function () { pdfjsPromise = null; reject(fail("unsupported")); };
      root.document.head.appendChild(s);
    });
    return pdfjsPromise;
  }

  var RTL_RE = /[֐-ࣿיִ-﷿ﹰ-ﻼ]/;
  var RTL_G = /[֐-ࣿיִ-﷿ﹰ-ﻼ]/g;
  var LTR_G = /[A-Za-zÀ-ɏ]/g;

  /* PDFs often store Arabic as presentation forms (and Latin as ligatures): map them back to ordinary letters. */
  function plainForms(text) {
    return text.replace(/[ﬀ-ﬆﭐ-﷿ﹰ-ﻼ]+/g, function (run) {
      return typeof run.normalize === "function" ? run.normalize("NFKC") : run;
    });
  }

  /* Turn the positioned text items of one page into lines, top to bottom, in reading order. */
  function pageLines(items) {
    var marks = [];
    items.forEach(function (it) {
      if (!it || typeof it.str !== "string" || !it.transform) return;
      if (it.str === "" && !it.hasEOL) return;
      var h = Math.abs(it.height) || Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 10;
      marks.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: Math.abs(it.width) || 0, h: h, rtl: it.dir === "rtl" || RTL_RE.test(it.str) });
    });
    if (!marks.length) return [];
    // group by baseline
    marks.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
    var rows = [];
    marks.forEach(function (m) {
      var row = rows.length ? rows[rows.length - 1] : null;
      if (row && Math.abs(row.y - m.y) <= Math.max(2, Math.min(row.h, m.h) * 0.45)) {
        row.items.push(m);
        if (m.str.trim()) row.h = Math.max(row.h, m.h);
      } else {
        rows.push({ y: m.y, h: m.h, items: [m] });
      }
    });
    return rows.map(function (row) {
      var text = row.items.map(function (m) { return m.str; }).join("");
      var rtlChars = (text.match(RTL_G) || []).length, ltrChars = (text.match(LTR_G) || []).length;
      var rtl = rtlChars > ltrChars;
      var list = row.items.slice().sort(function (a, b) { return rtl ? (b.x + b.w) - (a.x + a.w) : a.x - b.x; });
      var out = "";
      var prev = null;
      list.forEach(function (m) {
        if (prev) {
          var gap = rtl ? prev.x - (m.x + m.w) : m.x - (prev.x + prev.w);
          var size = Math.max(4, Math.min(prev.h, m.h));
          var touching = /\s$/.test(out) || /^\s/.test(m.str);
          if (gap > size * 2.5) out = out.replace(/\s+$/, "") + "   ";
          else if (gap > size * 0.18 && !touching) out += " ";
        }
        out += m.str;
        if (m.str.trim() || !prev) prev = m; else prev = { x: m.x, w: m.w, h: prev.h };
      });
      return plainForms(out).replace(/ /g, " ").replace(/[ \t]+$/g, "").replace(/^[ \t]+/g, "");
    }).filter(function (l) { return l.length > 0; });
  }

  /* A PDF gives visual lines. Re-attach a wrapped line to the one before it, but only in the clear case:
     the line before is close to full width, does not end a sentence, and this one starts with a small letter. */
  function joinWrapped(lines) {
    var widest = 0;
    lines.forEach(function (l) { if (l.length > widest) widest = l.length; });
    var out = [];
    lines.forEach(function (line) {
      var prev = out.length ? out[out.length - 1] : null;
      if (prev !== null && prev.length >= widest * 0.6 && prev.length >= 40 && !/[.!?:;؟]["”’)]?$/.test(prev) &&
          /^[a-z]/.test(line) && !/ {3}/.test(prev.slice(-12))) {
        out[out.length - 1] = /[A-Za-z]-$/.test(prev) && !/\s-$/.test(prev) ? prev + line : prev + " " + line;
      } else {
        out.push(line);
      }
    });
    return out;
  }

  async function readPdf(bytes) {
    var lib = await loadPdfjs();
    var copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    var task = lib.getDocument({
      data: copy,
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      useWorkerFetch: false,
      stopAtErrors: false
    });
    var doc;
    try {
      doc = await task.promise;
    } catch (e) {
      var name = (e && e.name) || "";
      throw fail(name === "PasswordException" ? "password" : "read");
    }
    var pages = [];
    try {
      for (var p = 1; p <= doc.numPages; p++) {
        var page = await doc.getPage(p);
        var content = await page.getTextContent();
        pages.push(joinWrapped(pageLines(content.items)).join("\n"));
        if (page.cleanup) page.cleanup();
      }
    } catch (e2) {
      throw fail("read");
    } finally {
      try { await task.destroy(); } catch (e3) { /* ignore */ }
    }
    return { pages: pages, count: pages.length };
  }

  /* --------------------------------------------------------------- extract */

  async function extract(data, fileName) {
    var bytes = toBytes(data);
    if (bytes.length > MAX_BYTES) throw fail("too-large");
    var kind = kindOf(bytes, fileName);
    if (!kind) throw fail("type");
    var warnings = [];
    if (kind === "docx") {
      var text = await readDocx(bytes);
      if (!text.replace(/\s/g, "")) { warnings.push("no-text"); text = ""; }
      return { kind: "docx", text: text, warnings: warnings };
    }
    var res = await readPdf(bytes);
    var joined = res.pages.join("\f");
    var letters = joined.replace(/[\s\f]/g, "").length;
    if (letters < 20) return { kind: "pdf", text: "", pages: res.count, warnings: ["no-text"] };
    if (letters < 40 * res.count) warnings.push("few-text");
    return { kind: "pdf", text: joined, pages: res.count, warnings: warnings };
  }

  /* -------------------------------------------------------------- sections */

  /* Words that make a line a section heading when the whole line is made of them. */
  var CORE = {
    profile: "profile", summary: "profile", objective: "profile", about: "profile", overview: "profile", biography: "profile", bio: "profile", statement: "profile",
    education: "education", qualifications: "education", qualification: "education", degrees: "education",
    experience: "experience", employment: "experience", appointments: "experience", appointment: "experience", career: "experience", positions: "experience", history: "experience", work: "experience",
    publications: "publications", publication: "publications", research: "publications", papers: "publications", articles: "publications", journal: "publications", journals: "publications", conference: "publications", conferences: "publications", books: "publications", chapters: "publications",
    teaching: "teaching", courses: "teaching", taught: "teaching", mentorship: "teaching", supervision: "teaching", mentoring: "teaching",
    training: "training", certificates: "training", certifications: "training", certification: "training", certificate: "training", development: "training", workshops: "training", licenses: "training",
    skills: "skills", competencies: "skills", tools: "skills", technologies: "skills", expertise: "skills",
    memberships: "memberships", membership: "memberships", affiliations: "memberships", societies: "memberships",
    awards: "awards", honours: "awards", honors: "awards", recognition: "awards", grants: "awards", scholarships: "awards", fellowships: "awards", prizes: "awards", achievements: "awards", accomplishments: "awards",
    service: "service", committees: "service", committee: "service", leadership: "service", administrative: "service", administration: "service", community: "service", engagement: "service", volunteer: "service", volunteering: "service", editorial: "service", reviewing: "service", activities: "service",
    languages: "languages", language: "languages", availability: "languages",
    references: "other", referees: "other", interests: "other", projects: "other", presentations: "other", talks: "other", contact: "other", personal: "other", information: "other", details: "other", hobbies: "other"
  };
  var FILLER = {
    selected: 1, professional: 1, academic: 1, and: 1, of: 1, the: 1, in: 1, other: 1, additional: 1, key: 1, core: 1, main: 1,
    recent: 1, technical: 1, university: 1, scientific: 1, scholarly: 1, relevant: 1, invited: 1, peer: 1, reviewed: 1, refereed: 1,
    current: 1, previous: 1, major: 1, my: 1, data: 1, summary: 0
  };
  /* single words that are also ordinary list entries; accepted as headings only when the document's headings look like them */
  var AMBIGUOUS = { leadership: 1, research: 1, teaching: 1, training: 1, service: 1, community: 1, projects: 1, activities: 1, work: 1, development: 1, administration: 1, mentoring: 1, supervision: 1, tools: 1, technologies: 1, information: 1, details: 1, history: 1, language: 1, journal: 1, conference: 1, certificate: 1, committee: 1 };

  var AR_CORE = {
    "نبذة": "profile", "الملخص": "profile", "ملخص": "profile", "الهدف": "profile", "التعريف": "profile", "مقدمة": "profile",
    "التعليم": "education", "المؤهلات": "education", "المؤهل": "education", "الدرجات": "education", "التحصيل": "education",
    "الخبرات": "experience", "الخبرة": "experience", "الوظائف": "experience", "المناصب": "experience", "التدرج": "experience", "السجل": "experience",
    "المنشورات": "publications", "الأبحاث": "publications", "البحوث": "publications", "النشر": "publications", "الإنتاج": "publications", "المؤلفات": "publications", "الأوراق": "publications", "الكتب": "publications",
    "التدريس": "teaching", "المقررات": "teaching", "الإشراف": "teaching", "المواد": "teaching",
    "الدورات": "training", "الشهادات": "training", "التدريب": "training", "التطوير": "training", "ورش": "training", "البرامج": "training",
    "المهارات": "skills", "الكفاءات": "skills", "القدرات": "skills",
    "العضويات": "memberships", "العضوية": "memberships", "الانتماءات": "memberships",
    "الجوائز": "awards", "التكريم": "awards", "التقدير": "awards", "المنح": "awards", "الإنجازات": "awards", "الأوسمة": "awards",
    "اللجان": "service", "الخدمة": "service", "خدمة": "service", "القيادة": "service", "المهام": "service", "التطوع": "service", "التطوعية": "service", "الأنشطة": "service", "المشاركات": "service", "التحكيم": "service", "الأعمال": "service",
    "اللغات": "languages", "اللغة": "languages",
    "المراجع": "other", "المعرفون": "other", "الاهتمامات": "other", "المشاريع": "other", "المؤتمرات": "other", "الندوات": "other", "بيانات": "other", "البيانات": "other", "معلومات": "other", "المعلومات": "other"
  };
  var AR_FILLER = {
    "و": 1, "في": 1, "من": 1, "على": 1, "عن": 1, "العلمية": 1, "العلمي": 1, "الأكاديمية": 1, "الأكاديمي": 1, "العملية": 1, "العملي": 1,
    "المهنية": 1, "المهني": 1, "الوظيفية": 1, "الوظيفي": 1, "الشخصية": 1, "الشخصي": 1, "التدريبية": 1, "التقنية": 1, "الفنية": 1,
    "البحثية": 1, "البحثي": 1, "الإدارية": 1, "الإداري": 1, "المجتمع": 1, "المجتمعية": 1, "الجامعة": 1, "الجامعية": 1, "العمل": 1, "الدراسية": 1,
    "الاتصال": 1, "التواصل": 1, "المنشورة": 1, "المحكمة": 1, "المختارة": 1, "مختارة": 1, "الأخرى": 1, "أخرى": 1, "الذاتية": 0, "الحاسب": 1, "الآلي": 1, "العامة": 1
  };

  function stripDecor(line) {
    return String(line || "")
      .replace(/[‎‏‪-‮⁦-⁩]/g, "")
      .replace(/^[\s\-–—_=*#•·▪■□●○◦‣➢➤►▶✓✔❖◆◇»›>|]+/, "")
      .replace(/[\s\-–—_=*#•·:：|]+$/, "")
      .trim();
  }

  /* Arabic word without diacritics and tatweel. */
  function arNorm(w) {
    return w.replace(/[ً-ٰٟـ]/g, "");
  }

  /* -> {cat, caps, title, single, ambiguous} when the line can be a heading, else null */
  function headingCandidate(raw) {
    var line = stripDecor(raw);
    if (!line || line.length > 64) return null;
    if (/[.!?؟]$/.test(line) || /\d{4}/.test(line) || /@|https?:|www\./i.test(line)) return null;
    var isAr = RTL_RE.test(line);
    var tokens = line.split(/[\s\/,،&+\-–—:()]+/).filter(Boolean);
    if (!tokens.length || tokens.length > 8) return null;
    var cat = null, real = 0;
    if (isAr) {
      for (var i = 0; i < tokens.length; i++) {
        var w = arNorm(tokens[i]);
        var hit = null;
        var forms = [w, w.replace(/^و(?=.{3,})/, ""), w.replace(/^وال/, "ال")];
        for (var f = 0; f < forms.length && !hit; f++) {
          var cand = forms[f];
          if (AR_CORE[cand]) hit = AR_CORE[cand];
          else if (AR_FILLER[cand]) hit = "-";
          else {
            // tolerate hamza spelling differences
            for (var key in AR_CORE) if (key.replace(/[أإآ]/g, "ا") === cand.replace(/[أإآ]/g, "ا")) { hit = AR_CORE[key]; break; }
            if (!hit) for (var key2 in AR_FILLER) if (AR_FILLER[key2] && key2.replace(/[أإآ]/g, "ا") === cand.replace(/[أإآ]/g, "ا")) { hit = "-"; break; }
          }
        }
        if (!hit) return null;
        if (hit !== "-") { real++; if (!cat) cat = hit; }
      }
      if (!real) return null;
      return { cat: cat, caps: false, titleCase: false, arabic: true, single: tokens.length === 1, ambiguous: false, text: line };
    }
    var words = [];
    for (var j = 0; j < tokens.length; j++) {
      var t = tokens[j].toLowerCase().replace(/[^a-z']/g, "");
      if (!t) continue;
      if (CORE[t]) { real++; if (!cat) cat = CORE[t]; words.push(tokens[j]); }
      else if (FILLER[t]) words.push(tokens[j]);
      else return null;
    }
    if (!real) return null;
    var letters = line.replace(/[^A-Za-z]/g, "");
    var caps = letters.length > 1 && letters === letters.toUpperCase();
    var small = { and: 1, of: 1, the: 1, in: 1 };
    var titleCase = words.every(function (w2) { return small[w2.toLowerCase()] || /^[A-Z]/.test(w2); });
    var lower = words.length === 1 ? words[0].toLowerCase().replace(/[^a-z]/g, "") : "";
    return { cat: cat, caps: caps, titleCase: titleCase, arabic: false, single: words.length === 1, ambiguous: !!AMBIGUOUS[lower], text: line };
  }

  var BULLET_RE = /^\s*(?:[•·▪■□●○◦‣➢➤►▶✓✔❖◆◇»›*]|[-–—](?=\s)|o(?=\s{1,3}\S))\s*/;

  function cleanLine(line) {
    return String(line || "")
      .replace(/[‎‏‪-‮⁦-⁩]/g, "")
      .replace(/ /g, " ")
      .replace(BULLET_RE, "")
      .replace(/[ \t]{4,}/g, "   ")
      .trim();
  }

  var PAGE_NUM_RE = /^(?:[-–—\s]*)(?:page|صفحة|ص)?\s*\.?\s*[0-9٠-٩]{1,3}\s*(?:(?:of|\/|من)\s*[0-9٠-٩]{1,3})?(?:[-–—\s]*)$/i;

  function digitless(line) {
    return line.replace(/[0-9٠-٩]+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
  }

  /* Remove running headers/footers and page numbers. pages: array of arrays of lines. */
  function stripRunning(pages) {
    var removed = [];
    var n = pages.length;
    if (n < 2) {
      // a lone page number at the very end of a single page
      if (n === 1 && pages[0].length && PAGE_NUM_RE.test(pages[0][pages[0].length - 1].trim())) removed.push(pages[0].pop());
      return removed;
    }
    var EDGE = 3;
    var seen = {};
    pages.forEach(function (lines, p) {
      var idx = {};
      for (var i = 0; i < lines.length; i++) {
        if (i >= EDGE && i < lines.length - EDGE) continue;
        var raw = lines[i].trim();
        if (!raw || raw.length > 90) continue;
        var key = digitless(raw);
        if (!key || idx[key]) continue;
        idx[key] = 1;
        (seen[key] = seen[key] || []).push(p);
      }
    });
    var need = Math.max(2, Math.ceil(n * 0.6));
    var running = {};
    Object.keys(seen).forEach(function (key) { if (seen[key].length >= need) running[key] = 1; });
    pages.forEach(function (lines) {
      for (var i = lines.length - 1; i >= 0; i--) {
        var edge = i < EDGE || i >= lines.length - EDGE;
        if (!edge) continue;
        var raw = lines[i].trim();
        if (!raw) continue;
        if (running[digitless(raw)] || (PAGE_NUM_RE.test(raw) && (i === 0 || i === lines.length - 1))) {
          removed.push(raw);
          lines.splice(i, 1);
        }
      }
    });
    return removed;
  }

  /* Is the nearest non-empty line in that direction a short plain entry (not a heading candidate)? */
  function shortEntry(lines, cands, i, step) {
    while (i >= 0 && i < lines.length && !lines[i].trim()) i += step;
    if (i < 0 || i >= lines.length) return false;
    if (cands[i]) return false;
    return cleanLine(lines[i]).split(/\s+/).length <= 3;
  }

  function prevIsCandidate(lines, cands, i) {
    i--;
    while (i >= 0 && !lines[i].trim()) i--;
    return i >= 0 && !!cands[i];
  }

  function split(text) {
    var pages = String(text || "").replace(/\r\n?/g, "\n").split("\f").map(function (page) {
      return page.split("\n").map(function (l) { return l.replace(/\s+$/, ""); });
    });
    var removed = stripRunning(pages);
    var lines = [];
    pages.forEach(function (page) { page.forEach(function (l) { lines.push(l); }); });

    // candidates and the document's heading style
    var cands = lines.map(function (l) { return l.trim() ? headingCandidate(l) : null; });
    var strong = cands.filter(function (c) { return c && !c.arabic && !(c.single && c.ambiguous); });
    var capsCount = strong.filter(function (c) { return c.caps; }).length;
    var capsStyle = strong.length >= 2 && capsCount / strong.length >= 0.6;

    var sections = [];
    var current = { title: HEADER_TITLE, lines: [] };
    sections.push(current);
    for (var i = 0; i < lines.length; i++) {
      var c = cands[i];
      var ok = false;
      if (c) {
        if (c.arabic) ok = true;
        else if (capsStyle) ok = c.caps;
        else ok = c.caps || (c.titleCase && !(c.single && c.ambiguous && strong.length < 2));
        // a bulleted line is a list entry, not a heading
        if (ok && BULLET_RE.test(lines[i]) && !c.caps) ok = false;
        // "Leadership", "Research"… between other short entries is a list item (e.g. a skills list)
        // and a heading never follows another heading directly
        if (ok && c.single && c.ambiguous && !c.caps &&
            (prevIsCandidate(lines, cands, i) || (shortEntry(lines, cands, i - 1, -1) && shortEntry(lines, cands, i + 1, 1)))) ok = false;
      }
      if (ok) {
        current = { title: c.text.replace(/\s+/g, " "), lines: [] };
        sections.push(current);
        continue;
      }
      var cleaned = cleanLine(lines[i]);
      if (cleaned) current.lines.push(cleaned);
    }
    // an empty Header section is noise; any other empty section is kept (its heading is information)
    if (!sections[0].lines.length && sections.length > 1) sections.shift();
    return { sections: sections, removed: removed.reverse() };
  }

  function sections(text) { return split(text).sections; }

  /* ----------------------------------------------------------------- guess */

  var GUESS_SKIP_WORDS = { selected: 1, professional: 1, academic: 1, and: 1, of: 1, the: 1, in: 1, other: 1, additional: 1, key: 1, core: 1, main: 1, recent: 1, technical: 0 };

  function guess(section) {
    var title = stripDecor(section && section.title);
    var lines = (section && section.lines) || [];
    if (title && title !== HEADER_TITLE) {
      var isAr = RTL_RE.test(title);
      var tokens = title.split(/[\s\/,،&+\-–—:()]+/).filter(Boolean);
      // two-word titles whose meaning differs from their first keyword
      var low = title.toLowerCase();
      if (/professional development|continuing education|training/.test(low)) return "training";
      if (/research interests?/.test(low)) return "other";
      if (/technical skills|computer skills|language skills/.test(low)) return /language skills/.test(low) ? "languages" : "skills";
      for (var i = 0; i < tokens.length; i++) {
        if (isAr) {
          var w = arNorm(tokens[i]);
          var forms = [w, w.replace(/^و(?=.{3,})/, ""), w.replace(/^وال/, "ال")];
          for (var f = 0; f < forms.length; f++) {
            for (var key in AR_CORE) {
              if (key.replace(/[أإآ]/g, "ا") === forms[f].replace(/[أإآ]/g, "ا")) return AR_CORE[key];
            }
          }
        } else {
          var t = tokens[i].toLowerCase().replace(/[^a-z']/g, "");
          if (GUESS_SKIP_WORDS[t]) continue;
          if (CORE[t]) return CORE[t];
        }
      }
    }
    // no usable title: look at the content
    var body = lines.join("\n");
    if (!body.trim()) return "other";
    var dois = (body.match(/doi\.org|doi:\s*10\.|\b10\.\d{4,9}\//gi) || []).length;
    var quoted = (body.match(/[“"][^”"]{15,}[”"]/g) || []).length;
    var years = (body.match(/\b(?:19|20)\d{2}\b/g) || []).length;
    if (dois >= 2 || (quoted >= 3 && years >= 3)) return "publications";
    if (/\b(ph\.?d|m\.?sc|b\.?sc|bachelor|master|doctor of|دكتوراه|ماجستير|بكالوريوس)\b/i.test(body) && lines.length <= 12) return "education";
    if (title === HEADER_TITLE) return "other";
    return "other";
  }

  /* What the dashboard should pre-select: the site already holds these, so importing them again would duplicate. */
  var COVERED = ["publications", "education", "experience", "teaching"];

  function suggest(section) {
    var kind = guess(section);
    if (COVERED.indexOf(kind) >= 0) return "skip";
    if (section && section.title === HEADER_TITLE) return "skip";
    if (!section || !section.lines || !section.lines.length) return "skip";
    return "add";
  }

  root.DashImport = {
    MAX_BYTES: MAX_BYTES,
    PDFJS_VERSION: PDFJS_VERSION,
    HEADER_TITLE: HEADER_TITLE,
    COVERED: COVERED,
    extract: extract,
    split: split,
    sections: sections,
    guess: guess,
    suggest: suggest
  };
})(typeof window !== "undefined" ? window : this);
