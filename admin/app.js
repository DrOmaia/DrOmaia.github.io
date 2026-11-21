/* Site dashboard interface. Arabic, phone first. Works only through DashLib (lib.js) and GH (github.js).
   Everything shown is built with DOM nodes and textContent; no HTML strings, no alert/confirm/prompt. */
(function () {
  "use strict";

  var L = window.DashLib, GH = window.GH;
  var TOKEN_KEY = "dash.token", DRAFT_KEY = "dash.draft";
  var SECTIONS = ["works", "metrics", "news", "roles", "texts", "fonts"];
  var SECTION_AR = { works: "الأبحاث", metrics: "الأرقام", news: "المستجدات", roles: "اللجان والأدوار", texts: "النصوص", fonts: "الخطوط" };
  var TABS = [
    ["works", "الأبحاث"], ["numbers", "الأرقام والمستجدات"], ["roles", "اللجان والأدوار"],
    ["texts", "النصوص"], ["look", "المظهر"], ["publish", "النشر"]
  ];
  var PAGE_AR = { "index.html": "الصفحة الرئيسية", "publications.html": "صفحة الأبحاث" };
  var SITE = "https://dromaia.github.io/";

  var app = document.getElementById("app");
  var S = { token: "", remember: false, files: null, head: "", base: null, model: null, baseJson: {}, tab: "works", out: null, ui: freshUi() };
  var saveTimer = 0;

  function freshUi() {
    return { q: "", form: null, confirm: "", tq: "", pv: { page: "index.html", lang: "ar" }, pub: null, last: null, lastState: "", busy: "", draft: null, signErr: "", fontsLoaded: false, doiBusy: false };
  }

  /* ---------- small helpers ---------- */
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else if (k === "value") n.value = v;
      else if (k === "checked" || k === "disabled" || k === "readOnly" || k === "hidden" || k === "open") n[k] = true;
      else n.setAttribute(k, v === true ? "" : String(v));
    });
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function store(kind) { try { return kind === "session" ? window.sessionStorage : window.localStorage; } catch (e) { return null; } }
  function sget(kind, key) { try { var s = store(kind); return s ? s.getItem(key) : null; } catch (e) { return null; } }
  function sset(kind, key, value) { try { var s = store(kind); if (s) s.setItem(key, value); return true; } catch (e) { return false; } }
  function sdel(kind, key) { try { var s = store(kind); if (s) s.removeItem(key); } catch (e) { /* ignore */ } }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function errText(e) {
    if (e && e.name === "GHError") return e.message;
    return "حدث خطأ غير متوقع: " + String((e && e.message) || e);
  }
  function btn(label, onclick, cls, extra) {
    var p = { type: "button", class: "btn " + (cls || ""), onclick: onclick, text: label };
    if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    return el("button", p);
  }
  /* A delete / publish button that asks again in place instead of a dialog. */
  function confirmBtn(key, label, yesLabel, onYes, cls, note) {
    if (S.ui.confirm !== key) return btn(label, function () { S.ui.confirm = key; render(); }, cls || "danger");
    return el("span", { class: "confirm", role: "group" }, [
      note ? el("span", { class: "confirm-note", text: note }) : null,
      btn(yesLabel, function () { S.ui.confirm = ""; onYes(); }, "danger solid", { "data-yes": key }),
      btn("إلغاء", function () { S.ui.confirm = ""; render(); }, "ghost")
    ]);
  }
  function field(label, control, hint) {
    return el("label", { class: "f" }, [el("span", { class: "f-l", text: label }), control, hint ? el("span", { class: "f-h", text: hint }) : null]);
  }
  function input(value, oninput, props) {
    var p = { type: "text", value: value == null ? "" : String(value), oninput: function (e) { oninput(e.target.value); } };
    if (props) Object.keys(props).forEach(function (k) { p[k] = props[k]; });
    return el("input", p);
  }
  function area(value, oninput, props) {
    var p = { rows: "2", dir: "auto", oninput: function (e) { oninput(e.target.value); } };
    if (props) Object.keys(props).forEach(function (k) { p[k] = props[k]; });
    var t = el("textarea", p);
    t.value = value == null ? "" : String(value);
    return t;
  }
  function select(value, options, onchange) {
    var s = el("select", { onchange: function (e) { onchange(e.target.value); } });
    options.forEach(function (o) { var op = el("option", { value: o[0], text: o[1] }); if (o[0] === value) op.selected = true; s.appendChild(op); });
    return s;
  }
  function move(list, i, d) {
    var j = i + d;
    if (j < 0 || j >= list.length) return;
    var t = list[i]; list[i] = list[j]; list[j] = t;
    touch(); render();
  }
  function moveBtns(list, i) {
    return el("span", { class: "moves" }, [
      btn("↑", function () { move(list, i, -1); }, "ghost sm", { "aria-label": "تحريك للأعلى", disabled: i === 0 }),
      btn("↓", function () { move(list, i, 1); }, "ghost sm", { "aria-label": "تحريك للأسفل", disabled: i === list.length - 1 })
    ]);
  }

  /* ---------- state: changes and draft ---------- */
  function setBase(files, head) {
    S.files = files; S.head = head;
    S.base = L.read(files);
    S.baseJson = {};
    SECTIONS.forEach(function (k) { S.baseJson[k] = JSON.stringify(S.base[k] === undefined ? null : S.base[k]); });
    S.model = clone(S.base);
    S.out = null;
  }
  function changed() {
    if (!S.model) return [];
    return SECTIONS.filter(function (k) { return JSON.stringify(S.model[k] === undefined ? null : S.model[k]) !== S.baseJson[k]; });
  }
  function saveDraftNow() {
    window.clearTimeout(saveTimer); saveTimer = 0;
    if (!S.model || S.ui.draft) return;
    if (changed().length) sset("local", DRAFT_KEY, JSON.stringify({ head: S.head, at: Date.now(), model: S.model }));
    else sdel("local", DRAFT_KEY);
    updateBadge();
  }
  function touch() {
    S.out = null; S.ui.pub = null;
    updateBadge();
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveDraftNow, 250);
  }
  function updateBadge() {
    var b = document.getElementById("badge");
    if (!b) return;
    var n = changed().length;
    b.hidden = !n;
    b.textContent = n ? "تعديلات غير منشورة: " + n : "";
  }
  window.addEventListener("pagehide", function () { if (saveTimer) saveDraftNow(); });
  window.addEventListener("beforeunload", function () { if (saveTimer) saveDraftNow(); });

  function readDraft() {
    var raw = sget("local", DRAFT_KEY);
    if (!raw) return null;
    try {
      var d = JSON.parse(raw);
      if (!d || !d.model || !Array.isArray(d.model.works)) throw new Error("bad");
      return d;
    } catch (e) { sdel("local", DRAFT_KEY); return null; }
  }

  /* ---------- sign in / load ---------- */
  async function signIn(token, remember) {
    token = String(token || "").trim();
    if (!token) { S.ui.signErr = "الصق المفتاح أولًا."; renderSign(); return; }
    S.ui.busy = "جارٍ قراءة ملفات الموقع من GitHub…"; S.ui.signErr = "";
    if (S.model) render(); else renderSign();
    try {
      var got = await GH.load(token, L.FILES);
      var ui = freshUi();
      S.token = token; S.remember = !!remember; S.ui = ui;
      try { setBase(got.files, got.head); }
      catch (e) {
        S.model = null; S.ui.signErr = "قُرئت الملفات، لكن تعذّر تحليلها: " + String((e && e.message) || e);
        renderSign(); return;
      }
      sdel("local", TOKEN_KEY); sdel("session", TOKEN_KEY);
      sset(remember ? "local" : "session", TOKEN_KEY, token);
      var d = readDraft();
      if (d) S.ui.draft = { same: d.head === S.head, data: d };
      render();
    } catch (e) {
      S.ui.busy = "";
      if (e && e.name === "GHError" && (e.code === "auth")) { sdel("local", TOKEN_KEY); sdel("session", TOKEN_KEY); S.token = ""; S.model = null; }
      S.ui.signErr = errText(e);
      if (S.model) { S.ui.pub = { kind: "err", text: errText(e) }; render(); } else renderSign();
    }
  }
  function signOut() {
    if (saveTimer) saveDraftNow();
    sdel("local", TOKEN_KEY); sdel("session", TOKEN_KEY);
    S.token = ""; S.files = null; S.model = null; S.base = null; S.out = null; S.ui = freshUi();
    renderSign();
  }

  function renderSign() {
    app.textContent = "";
    var tokenInput = el("input", { type: "password", id: "token", dir: "ltr", autocomplete: "off", spellcheck: "false", autocapitalize: "off", placeholder: "github_pat_…", "aria-label": "مفتاح GitHub" });
    var remember = el("input", { type: "checkbox", id: "remember" });
    var go = function () { signIn(tokenInput.value, remember.checked); };
    tokenInput.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    var steps = [
      "افتح github.com وسجّل الدخول بحسابك.",
      "اضغط صورتك أعلى الصفحة، ثم Settings، ثم Developer settings في آخر القائمة.",
      "اختر Personal access tokens، ثم Fine-grained tokens، ثم Generate new token.",
      "اكتب اسمًا للمفتاح مثل Site dashboard، واختر مدة الصلاحية.",
      "في Repository access اختر Only select repositories، ثم اختر DrOmaia.github.io فقط.",
      "في Permissions افتح Repository permissions، واجعل Contents على Read and write.",
      "اضغط Generate token، وانسخ المفتاح (يبدأ بـ github_pat_) والصقه في الخانة أدناه."
    ];
    app.appendChild(el("main", { class: "sign" }, [
      el("h1", { text: "لوحة التحكم بالموقع" }),
      el("p", { class: "muted", text: "صفحة خاصة بصاحب الموقع dromaia.github.io: تعدّل منها الأبحاث والأرقام والنصوص والخطوط، ثم تنشر بضغطة." }),
      el("details", { class: "card steps" }, [
        el("summary", { text: "أول مرة؟ إعداد المفتاح (مرة واحدة، دقيقتان)" }),
        el("ol", null, steps.map(function (t) { return el("li", { text: t, dir: "auto" }); })),
        el("a", { class: "btn ghost", href: "https://github.com/settings/personal-access-tokens/new", target: "_blank", rel: "noopener noreferrer", text: "افتح صفحة إنشاء المفتاح في GitHub ↗" })
      ]),
      el("div", { class: "card" }, [
        field("مفتاح GitHub", tokenInput),
        el("label", { class: "check" }, [remember, el("span", { text: "تذكّرني على هذا الجهاز" })]),
        S.ui.signErr ? el("p", { class: "msg err", role: "alert", id: "signErr", text: S.ui.signErr }) : null,
        S.ui.busy ? el("p", { class: "msg info", id: "busy", text: S.ui.busy }) : null,
        btn("دخول", go, "primary big", { id: "signBtn", disabled: !!S.ui.busy }),
        el("p", { class: "muted small", text: "المفتاح يبقى في متصفحك فقط، ولا يُرسل إلا إلى api.github.com. لا تشاركه مع أحد، ولا تفعّل «تذكّرني» على جهاز مشترك. تستطيع حذف المفتاح من GitHub في أي وقت." })
      ])
    ]));
  }

  /* ---------- main frame ---------- */
  function render() {
    if (!S.model) { renderSign(); return; }
    app.textContent = "";
    var n = changed().length;
    app.appendChild(el("header", { class: "top" }, [
      el("div", { class: "top-t" }, [el("strong", { text: "لوحة التحكم بالموقع" }), el("span", { class: "muted small", dir: "ltr", text: "dromaia.github.io" })]),
      el("span", { class: "badge", id: "badge", hidden: !n, text: n ? "تعديلات غير منشورة: " + n : "" }),
      el("div", { class: "top-a" }, [
        btn("إعادة التحميل", function () { if (saveTimer) saveDraftNow(); signIn(S.token, S.remember); }, "ghost sm", { id: "reloadBtn" }),
        btn("خروج", signOut, "ghost sm", { id: "outBtn" })
      ])
    ]));
    if (S.ui.busy) app.appendChild(el("p", { class: "msg info", id: "busy", text: S.ui.busy }));
    if (S.ui.draft) { app.appendChild(draftGate()); return; }
    app.appendChild(el("nav", { class: "tabs", role: "tablist", "aria-label": "أقسام اللوحة" }, TABS.map(function (t) {
      return el("button", { type: "button", role: "tab", class: "tab", "data-tab": t[0], "aria-selected": S.tab === t[0] ? "true" : "false", text: t[1],
        onclick: function () { S.tab = t[0]; S.ui.confirm = ""; render(); } });
    })));
    var view = { works: viewWorks, numbers: viewNumbers, roles: viewRoles, texts: viewTexts, look: viewLook, publish: viewPublish }[S.tab]();
    app.appendChild(el("main", { class: "view", id: "view" }, [view]));
  }

  function draftGate() {
    var d = S.ui.draft;
    var when = d.data.at ? new Date(d.data.at).toLocaleString("ar-SA-u-nu-latn") : "";
    if (d.same) {
      return el("section", { class: "card gate", id: "draftGate" }, [
        el("h2", { text: "عندك مسودة غير منشورة" }),
        el("p", { text: "وجدت تعديلات حفظتها هنا ولم تنشرها" + (when ? " (" + when + ")" : "") + ". هل تتابعها؟" }),
        el("div", { class: "row" }, [
          btn("متابعة المسودة", function () {
            var m = d.data.model;
            SECTIONS.forEach(function (k) { if (m[k] === undefined) m[k] = clone(S.base[k]); });
            Object.keys(S.base).forEach(function (k) { if (m[k] === undefined) m[k] = clone(S.base[k]); });
            S.model = m; S.ui.draft = null; S.out = null; render();
          }, "primary", { id: "draftKeep" }),
          btn("تجاهلها", function () { sdel("local", DRAFT_KEY); S.ui.draft = null; render(); }, "ghost", { id: "draftDrop" })
        ])
      ]);
    }
    return el("section", { class: "card gate", id: "draftGate" }, [
      el("h2", { text: "تغيّر الموقع منذ آخر مسودة" }),
      el("p", { text: "عندك مسودة قديمة" + (when ? " (" + when + ")" : "") + "، لكن الموقع تغيّر بعدها، فلا يمكن متابعتها بأمان." }),
      el("div", { class: "row" }, [confirmBtn("dropDraft", "حذف المسودة والمتابعة", "نعم، احذفها", function () { sdel("local", DRAFT_KEY); S.ui.draft = null; render(); }, "danger")])
    ]);
  }

  /* ---------- tab: works ---------- */
  function typeAr(t) { var x = (L.TYPES || []).filter(function (o) { return o.en === t; })[0]; return x ? x.ar : t; }
  function blankForm() {
    return { title: "", year: String(new Date().getFullYear()), type: (L.TYPES[0] || {}).en || "", theme: (L.THEMES[0] || {}).en || "", methods: "", contribution: "", reference: "", doi: "", verificationNote: "" };
  }
  function openForm(work) {
    var f = blankForm();
    if (work) {
      f = { title: work.title || "", year: String(work.year || ""), type: work.type || "", theme: work.theme || "", methods: (work.methods || []).join(", "),
        contribution: work.contribution || "", reference: work.reference || "", doi: work.doi || "", verificationNote: work.verificationNote || "" };
    }
    S.ui.form = { isNew: !work, id: work ? work.id : L.nextId(S.model.works), f: f, lookup: work && work.doi ? work.doi : "", note: null, errors: [] };
    S.ui.confirm = "";
    render();
    var top = document.getElementById("workForm");
    if (top && top.scrollIntoView) top.scrollIntoView({ block: "start" });
  }
  function cleanDoi(v) {
    return String(v || "").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  }
  async function lookupDoi() {
    var fm = S.ui.form;
    var doi = cleanDoi(fm.lookup);
    if (!doi) { fm.note = { kind: "err", text: "اكتب رقم DOI أولًا، مثل 10.3390/computers15110825" }; render(); return; }
    S.ui.doiBusy = true; fm.note = { kind: "info", text: "جارٍ جلب البيانات من Crossref…" }; render();
    try {
      var res = await fetch("https://api.crossref.org/works/" + encodeURIComponent(doi), { headers: { "Accept": "application/json" }, credentials: "omit", referrerPolicy: "no-referrer" });
      if (!res.ok) throw new Error(res.status === 404 ? "notfound" : "http");
      var json = await res.json();
      var got = L.fromCrossref(json.message || {}) || {};
      if (S.ui.form !== fm) return;
      ["title", "type", "reference", "doi"].forEach(function (k) { if (got[k]) fm.f[k] = String(got[k]); });
      if (got.year) fm.f.year = String(got.year);
      if (!fm.f.doi) fm.f.doi = "https://doi.org/" + doi;
      fm.note = { kind: "ok", text: "جُلبت البيانات. راجعها، ثم اختر الموضوع واكتب المنهجيات والمساهمة." };
    } catch (e) {
      if (S.ui.form !== fm) return;
      fm.note = { kind: "err", text: e && e.message === "notfound" ? "لم يجد Crossref هذا الرقم. تأكد منه، أو اكتب البيانات يدويًا." : "تعذّر جلب البيانات من Crossref. اكتب البيانات يدويًا أو حاول لاحقًا." };
    }
    S.ui.doiBusy = false;
    render();
  }
  function saveForm() {
    var fm = S.ui.form, f = fm.f, errs = [];
    var year = parseInt(f.year, 10);
    if (!f.title.trim()) errs.push("اكتب عنوان البحث.");
    if (!(year >= 1990 && year <= 2100)) errs.push("اكتب السنة بأربعة أرقام.");
    if (!f.type) errs.push("اختر نوع العمل.");
    if (!f.theme) errs.push("اختر الموضوع.");
    if (!f.reference.trim()) errs.push("اكتب مرجع APA.");
    var old = S.model.works.filter(function (w) { return w.id === fm.id; })[0];
    var work = Object.assign({}, old || {}, {
      id: fm.id, title: f.title.trim(), year: year, type: f.type, theme: f.theme,
      methods: f.methods.split(/[,،;\n]/).map(function (x) { return x.trim(); }).filter(Boolean),
      contribution: f.contribution.trim(), reference: f.reference.trim(),
      doi: f.doi.trim() ? (/^https?:\/\//i.test(f.doi.trim()) ? f.doi.trim() : "https://doi.org/" + cleanDoi(f.doi)) : null,
      verificationNote: f.verificationNote.trim() || null
    });
    if (!errs.length) {
      var next = clone(S.model);
      if (old) next.works = next.works.map(function (w) { return w.id === fm.id ? work : w; }); else next.works.push(work);
      var before = safeValidate(S.model), after = safeValidate(next);
      errs = after.filter(function (e) { return before.indexOf(e) < 0; });
      if (!errs.length) { S.model.works = next.works; S.ui.form = null; touch(); render(); return; }
    }
    fm.errors = errs; render();
  }
  function safeValidate(m) { try { return L.validate(m) || []; } catch (e) { return ["تعذّر فحص البيانات: " + String((e && e.message) || e)]; } }

  function workForm() {
    var fm = S.ui.form, f = fm.f;
    var set = function (k) { return function (v) { f[k] = v; }; };
    return el("section", { class: "card form", id: "workForm" }, [
      el("h2", { text: fm.isNew ? "بحث جديد (" + fm.id + ")" : "تعديل " + fm.id }),
      el("div", { class: "doi-row" }, [
        field("رقم DOI", input(fm.lookup, function (v) { fm.lookup = v; }, { id: "doiLookup", dir: "ltr", placeholder: "10.xxxx/…", inputmode: "url" }), "الصق الرقم أو الرابط، ثم اضغط «اجلب البيانات» لتُملأ الخانات تلقائيًا."),
        btn(S.ui.doiBusy ? "جارٍ الجلب…" : "اجلب البيانات", lookupDoi, "primary", { id: "doiBtn", disabled: S.ui.doiBusy })
      ]),
      fm.note ? el("p", { class: "msg " + fm.note.kind, id: "doiNote", role: "status", text: fm.note.text }) : null,
      field("العنوان", area(f.title, set("title"), { id: "fTitle", dir: "ltr", rows: "2" })),
      el("div", { class: "grid2" }, [
        field("السنة", input(f.year, set("year"), { id: "fYear", dir: "ltr", inputmode: "numeric", maxlength: "4" })),
        field("نوع العمل", select(f.type, L.TYPES.map(function (t) { return [t.en, t.ar]; }), set("type")))
      ]),
      field("الموضوع", select(f.theme, L.THEMES.map(function (t) { return [t.en, t.ar]; }), set("theme"))),
      field("المنهجيات", input(f.methods, set("methods"), { id: "fMethods", dir: "ltr" }), "بالإنجليزية، وبينها فواصل. مثال: YOLOv8, SHAP"),
      field("المساهمة", area(f.contribution, set("contribution"), { id: "fContribution", dir: "ltr", rows: "3" }), "جملة أو جملتان بالإنجليزية تلخّصان ما قدّمه البحث."),
      field("مرجع APA", area(f.reference, set("reference"), { id: "fReference", dir: "ltr", rows: "3" })),
      field("رابط DOI", input(f.doi, set("doi"), { id: "fDoi", dir: "ltr", inputmode: "url", placeholder: "https://doi.org/…" }), "اتركه فارغًا إن لم يكن للبحث DOI."),
      field("ملاحظة تحقق (اختياري)", area(f.verificationNote, set("verificationNote"), { id: "fNote", dir: "ltr", rows: "2" })),
      fm.errors.length ? el("ul", { class: "msg err", id: "formErrors", role: "alert" }, fm.errors.map(function (e) { return el("li", { text: e }); })) : null,
      el("div", { class: "row" }, [
        btn("حفظ في المسودة", saveForm, "primary", { id: "saveWork" }),
        btn("إلغاء", function () { S.ui.form = null; render(); }, "ghost")
      ])
    ]);
  }

  function workList() {
    var q = S.ui.q.trim().toLowerCase();
    var list = S.model.works.slice().reverse().filter(function (w) {
      return !q || [w.id, w.title, w.year, w.reference, w.theme].join(" ").toLowerCase().indexOf(q) >= 0;
    });
    var box = el("div", { class: "list", id: "workList" });
    if (!list.length) box.appendChild(el("p", { class: "muted", text: "لا توجد أبحاث مطابقة." }));
    list.forEach(function (w) {
      box.appendChild(el("article", { class: "item", "data-id": w.id }, [
        el("div", { class: "item-h" }, [el("strong", { dir: "ltr", text: w.id }), el("span", { class: "muted small", text: String(w.year) + " · " + typeAr(w.type) })]),
        el("p", { class: "item-t", dir: "ltr", lang: "en", text: w.title }),
        el("div", { class: "row" }, [
          btn("تعديل", function () { openForm(w); }, "ghost sm", { "data-edit": w.id }),
          confirmBtn("del-" + w.id, "حذف", "نعم، احذف", function () {
            S.model.works = S.model.works.filter(function (x) { return x.id !== w.id; });
            if (S.ui.form && S.ui.form.id === w.id) S.ui.form = null;
            touch(); render();
          }, "danger sm")
        ])
      ]));
    });
    return box;
  }
  function viewWorks() {
    var listBox = workList();
    var search = input(S.ui.q, function (v) {
      S.ui.q = v;
      var fresh = workList(); listBox.parentNode.replaceChild(fresh, listBox); listBox = fresh;
    }, { id: "workSearch", type: "search", placeholder: "ابحث بالعنوان أو السنة أو الرقم", "aria-label": "بحث في الأبحاث" });
    return el("div", null, [
      S.ui.form ? workForm() : null,
      el("div", { class: "bar" }, [
        el("h2", { text: "الأبحاث (" + S.model.works.length + ")" }),
        btn("＋ بحث جديد", function () { openForm(null); }, "primary", { id: "addWork" })
      ]),
      search, listBox
    ]);
  }

  /* ---------- tab: numbers and news ---------- */
  function viewNumbers() {
    var m = S.model;
    var tiles = el("div", { class: "list" }, (m.metrics || []).map(function (t, i) {
      var auto = !!t.auto;
      return el("article", { class: "item", "data-metric": String(i) }, [
        el("div", { class: "grid3" }, [
          field("الرقم", input(auto ? String(m.works.length) : t.value, function (v) { t.value = v; touch(); }, { dir: "ltr", readOnly: auto, "data-k": "value" })),
          field("الوصف بالإنجليزية", input(t.en, function (v) { t.en = v; touch(); }, { dir: "ltr", "data-k": "en" })),
          field("الوصف بالعربية", input(t.ar, function (v) { t.ar = v; touch(); }, { dir: "rtl", "data-k": "ar" }))
        ]),
        auto ? el("p", { class: "muted small", text: "هذا الرقم يتبع عدد الأبحاث تلقائيًا." }) : null
      ]);
    }));
    var news = el("div", { class: "list", id: "newsList" }, (m.news || []).map(function (n, i) {
      return el("article", { class: "item", "data-news": String(i) }, [
        el("div", { class: "grid-news" }, [
          field("السنة", input(n.year, function (v) { n.year = v; touch(); }, { dir: "ltr", inputmode: "numeric", maxlength: "4", "data-k": "year" })),
          field("السطر بالإنجليزية", area(n.en, function (v) { n.en = v; touch(); }, { dir: "ltr", "data-k": "en" })),
          field("السطر بالعربية", area(n.ar, function (v) { n.ar = v; touch(); }, { dir: "rtl", "data-k": "ar" }))
        ]),
        el("div", { class: "row" }, [moveBtns(m.news, i), confirmBtn("news-" + i, "حذف", "نعم، احذف", function () { m.news.splice(i, 1); touch(); render(); }, "danger sm")])
      ]);
    }));
    return el("div", null, [
      el("h2", { text: "الأرقام في أعلى الصفحة الرئيسية" }),
      tiles,
      el("div", { class: "bar" }, [
        el("h2", { text: "المستجدات" }),
        btn("＋ سطر جديد", function () { m.news = m.news || []; m.news.unshift({ year: String(new Date().getFullYear()), en: "", ar: "" }); touch(); render(); }, "primary", { id: "addNews" })
      ]),
      el("p", { class: "muted small", text: "تظهر تحت الأرقام في الصفحة الرئيسية بهذا الترتيب." }),
      news
    ]);
  }

  /* ---------- tab: roles ---------- */
  function viewRoles() {
    var m = S.model;
    var list = el("div", { class: "list", id: "roleList" }, (m.roles || []).map(function (r, i) {
      return el("article", { class: "item", "data-role": String(i) }, [
        el("div", { class: "grid2" }, [
          field("الجهة", input(r.org, function (v) { r.org = v; touch(); }, { dir: "ltr", "data-k": "org" })),
          field("الجهة بالعربية (اختياري)", input(r.orgAr, function (v) { r.orgAr = v; touch(); }, { dir: "rtl", "data-k": "orgAr" }))
        ]),
        field("الدور بالإنجليزية", area(r.en, function (v) { r.en = v; touch(); }, { dir: "ltr", "data-k": "en" })),
        field("الدور بالعربية", area(r.ar, function (v) { r.ar = v; touch(); }, { dir: "rtl", "data-k": "ar" })),
        el("div", { class: "row" }, [moveBtns(m.roles, i), confirmBtn("role-" + i, "حذف", "نعم، احذف", function () { m.roles.splice(i, 1); touch(); render(); }, "danger sm")])
      ]);
    }));
    return el("div", null, [
      el("div", { class: "bar" }, [
        el("h2", { text: "اللجان والأدوار (" + (m.roles || []).length + ")" }),
        btn("＋ دور جديد", function () { m.roles = m.roles || []; m.roles.unshift({ org: "", orgAr: "", en: "", ar: "" }); touch(); render(); }, "primary", { id: "addRole" })
      ]),
      el("p", { class: "muted small", text: "تظهر في قسم القيادة تحت «مزيد من اللجان والأدوار»." }),
      list
    ]);
  }

  /* ---------- tab: texts ---------- */
  function textsList() {
    var q = S.ui.tq.trim().toLowerCase();
    var all = S.model.texts || [];
    var hits = all.filter(function (t) { return !q || (String(t.en) + " " + String(t.ar)).toLowerCase().indexOf(q) >= 0; });
    var limit = q ? 100 : 30;
    var shown = hits.slice(0, limit);
    var box = el("div", { id: "textList" });
    box.appendChild(el("p", { class: "muted small", id: "textCount", text: q
      ? "النتائج: " + hits.length + (hits.length > limit ? " (تظهر أول " + limit + ")" : "")
      : "تظهر أول " + shown.length + " من " + all.length + ". اكتب في البحث للوصول إلى أي نص." }));
    var pages = [];
    shown.forEach(function (t) { if (pages.indexOf(t.page) < 0) pages.push(t.page); });
    pages.forEach(function (p) {
      box.appendChild(el("h3", { text: PAGE_AR[p] || p }));
      var list = el("div", { class: "list" });
      shown.filter(function (t) { return t.page === p; }).forEach(function (t) {
        list.appendChild(el("article", { class: "item", "data-text": String(t.id) }, [
          field("بالإنجليزية", area(t.en, function (v) { t.en = v; touch(); }, { "data-k": "en" })),
          field("بالعربية", area(t.ar, function (v) { t.ar = v; touch(); }, { "data-k": "ar" }))
        ]));
      });
      box.appendChild(list);
    });
    if (!shown.length) box.appendChild(el("p", { class: "muted", text: "لا يوجد نص مطابق." }));
    return box;
  }
  function viewTexts() {
    var listBox = textsList();
    var search = input(S.ui.tq, function (v) {
      S.ui.tq = v;
      var fresh = textsList(); listBox.parentNode.replaceChild(fresh, listBox); listBox = fresh;
    }, { id: "textSearch", type: "search", placeholder: "ابحث عن كلمة بالعربية أو الإنجليزية", "aria-label": "بحث في النصوص" });
    return el("div", null, [
      el("h2", { text: "نصوص الموقع" }),
      el("p", { class: "muted small", text: "كل نص في الموقع له صيغتان: إنجليزية وعربية. عدّل أيهما ثم انشر." }),
      search, listBox
    ]);
  }

  /* ---------- tab: look ---------- */
  function weightsOf(f) { var w = f.weights; return Array.isArray(w) ? w.join(";") : String(w || "400;700"); }
  function loadPreviewFonts() {
    if (S.ui.fontsLoaded) return;
    S.ui.fontsLoaded = true;
    ["ar", "en"].forEach(function (k) {
      ((L.FONTS || {})[k] || []).forEach(function (f) {
        document.head.appendChild(el("link", { rel: "stylesheet", "data-preview-font": f.name,
          href: "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(f.name).replace(/%20/g, "+") + ":wght@" + weightsOf(f) + "&display=swap" }));
      });
    });
  }
  function fontPicker(kind, title, sample, dir) {
    var fonts = (L.FONTS || {})[kind] || [];
    var current = (S.model.fonts || {})[kind];
    return el("section", { class: "card" }, [
      el("h2", { text: title }),
      el("div", { class: "fonts", role: "radiogroup", "aria-label": title }, fonts.map(function (f) {
        var radio = el("input", { type: "radio", name: "font-" + kind, value: f.name, checked: f.name === current,
          onchange: function () { S.model.fonts = S.model.fonts || {}; S.model.fonts[kind] = f.name; touch(); render(); } });
        var smp = el("span", { class: "font-s", dir: dir, text: sample });
        smp.style.fontFamily = '"' + f.name + '", sans-serif';
        return el("label", { class: "font" + (f.name === current ? " on" : ""), "data-font": f.name }, [
          radio, el("span", { class: "font-b" }, [el("span", { class: "font-n", dir: "ltr", text: f.name + (f.name === current ? " ✓" : "") }), smp])
        ]);
      }))
    ]);
  }
  function viewLook() {
    loadPreviewFonts();
    return el("div", null, [
      el("p", { class: "muted small", text: "اختر الخط، ثم راجع شكله في تبويب «النشر» قبل أن تنشر." }),
      fontPicker("ar", "الخط العربي", "رئيس قسم نظم المعلومات · أبحاث الذكاء الاصطناعي 2026", "rtl"),
      fontPicker("en", "الخط الإنجليزي", "Chair, Information Systems Department · AI research 2026", "ltr")
    ]);
  }

  /* ---------- tab: publish ---------- */
  function compute() {
    if (S.out) return S.out;
    try {
      var o = L.build(S.files, S.model, { today: today() }) || {};
      S.out = { files: o.files || {}, warnings: o.warnings || [], summary: o.summary || [] };
    } catch (e) {
      S.out = { files: {}, warnings: [], summary: [], error: String((e && e.message) || e) };
    }
    return S.out;
  }
  function englishSummary() {
    var parts = [], ch = changed();
    if (ch.indexOf("works") >= 0) {
      var baseIds = {}, nowIds = {}, added = 0, removed = 0, edited = 0;
      S.base.works.forEach(function (w) { baseIds[w.id] = JSON.stringify(w); });
      S.model.works.forEach(function (w) { nowIds[w.id] = 1; if (!baseIds[w.id]) added++; else if (baseIds[w.id] !== JSON.stringify(w)) edited++; });
      S.base.works.forEach(function (w) { if (!nowIds[w.id]) removed++; });
      var bits = [];
      if (added) bits.push("+" + added); if (edited) bits.push("~" + edited); if (removed) bits.push("-" + removed);
      parts.push("publications " + bits.join(" "));
    }
    if (ch.indexOf("metrics") >= 0) parts.push("numbers");
    if (ch.indexOf("news") >= 0) parts.push("news");
    if (ch.indexOf("roles") >= 0) parts.push("roles");
    if (ch.indexOf("texts") >= 0) parts.push("texts");
    if (ch.indexOf("fonts") >= 0) parts.push("fonts");
    return parts.join(", ") || "update";
  }
  function previewHtml(out) {
    var page = S.ui.pv.page, html = out.files[page] || S.files[page] || "";
    var base = SITE;
    if (S.ui.pv.lang === "ar") {
      html = out.files["ar/" + page] || L.buildArabic(page, html);
      base = SITE + "ar/";
    }
    html = html.replace('data-theme="dark"', 'data-theme="light"');
    return html.replace(/<head([^>]*)>/i, function (m) { return m + '<base href="' + base + '">'; });
  }
  async function doPublish() {
    var out = compute();
    S.ui.busy = "جارٍ النشر على الموقع…"; S.ui.pub = null; render();
    try {
      var sha = await GH.commit(S.token, out.files, "Dashboard: " + englishSummary(), S.head);
      var files = clone(S.files);
      Object.keys(out.files).forEach(function (p) { if (Object.prototype.hasOwnProperty.call(files, p)) files[p] = out.files[p]; });
      sdel("local", DRAFT_KEY);
      S.ui.busy = "";
      try { setBase(files, sha); }
      catch (e) { await signIn(S.token, S.remember); }
      S.ui.last = null; S.ui.lastState = "";
      S.ui.pub = { kind: "ok", text: "تم النشر. يظهر التعديل على الموقع خلال دقيقة تقريبًا." };
    } catch (e) {
      S.ui.busy = "";
      S.ui.pub = { kind: "err", text: errText(e), stale: !!(e && e.code === "stale") };
    }
    render();
  }
  async function doUndo() {
    S.ui.busy = "جارٍ التراجع عن آخر نشر…"; S.ui.pub = null; render();
    try {
      await GH.undo(S.token);
      sdel("local", DRAFT_KEY);
      var got = await GH.load(S.token, L.FILES);
      S.ui.busy = "";
      setBase(got.files, got.head);
      S.ui.last = null; S.ui.lastState = "";
      S.ui.pub = { kind: "ok", text: "تم التراجع. يعود الموقع إلى ما كان عليه خلال دقيقة تقريبًا." };
    } catch (e) {
      S.ui.busy = "";
      S.ui.pub = { kind: "err", text: errText(e) };
    }
    render();
  }
  function fetchLast() {
    if (S.ui.lastState) return;
    S.ui.lastState = "loading";
    GH.lastCommit(S.token).then(function (c) { S.ui.last = c; S.ui.lastState = "ok"; }, function () { S.ui.last = null; S.ui.lastState = "err"; })
      .then(function () { if (S.tab === "publish" && S.model && !S.ui.busy) render(); });
  }
  function viewPublish() {
    var out = compute(), paths = Object.keys(out.files), errors = safeValidate(S.model), n = changed().length;
    var can = paths.length > 0 && !out.error && !errors.length && !S.ui.busy;
    fetchLast();
    var box = el("div");
    if (S.ui.pub) {
      box.appendChild(el("p", { class: "msg " + S.ui.pub.kind, id: "pubMsg", role: "status", text: S.ui.pub.text }));
      if (S.ui.pub.stale) box.appendChild(btn("إعادة التحميل الآن", function () { signIn(S.token, S.remember); }, "primary", { id: "staleReload" }));
    }
    box.appendChild(el("h2", { text: "ما الذي سيتغيّر؟" }));
    if (out.error) box.appendChild(el("p", { class: "msg err", id: "buildErr", role: "alert", text: "تعذّر تجهيز الصفحات: " + out.error }));
    if (errors.length) box.appendChild(el("ul", { class: "msg err", id: "validErr", role: "alert" }, errors.map(function (e) { return el("li", { text: e }); })));
    if (!paths.length && !out.error) box.appendChild(el("p", { class: "muted", id: "noChanges", text: n ? "تعديلاتك لم تغيّر أي ملف." : "لا توجد تعديلات للنشر." }));
    if (out.summary.length) box.appendChild(el("ul", { class: "sum", id: "summary" }, out.summary.map(function (s) { return el("li", { dir: "auto", text: s }); })));
    var warns = (S.model.warnings || []).concat(out.warnings);
    if (warns.length) box.appendChild(el("ul", { class: "msg warn", id: "warnings" }, warns.map(function (s) { return el("li", { dir: "auto", text: s }); })));
    if (paths.length) box.appendChild(el("details", { class: "files" }, [
      el("summary", { text: "الملفات التي ستتغير (" + paths.length + ")" }),
      el("ul", { id: "fileList", dir: "ltr" }, paths.map(function (p) { return el("li", { text: p }); }))
    ]));

    box.appendChild(el("h2", { text: "المعاينة" }));
    var seg = function (key, opts) {
      return el("div", { class: "seg", role: "group" }, opts.map(function (o) {
        return el("button", { type: "button", "aria-pressed": S.ui.pv[key] === o[0] ? "true" : "false", "data-pv": o[0], text: o[1],
          onclick: function () { S.ui.pv[key] = o[0]; render(); } });
      }));
    };
    box.appendChild(el("div", { class: "row" }, [
      seg("page", [["index.html", "الصفحة الرئيسية"], ["publications.html", "الأبحاث"]]),
      seg("lang", [["ar", "عربي"], ["en", "English"]])
    ]));
    var frame = el("iframe", { id: "preview", class: "preview", title: "معاينة الصفحة قبل النشر", sandbox: "", referrerpolicy: "no-referrer" });
    try { frame.srcdoc = previewHtml(out); } catch (e) { frame.srcdoc = ""; }
    box.appendChild(frame);
    box.appendChild(el("p", { class: "muted small", text: "المعاينة ثابتة: الأزرار والقوائم داخلها لا تعمل." }));

    box.appendChild(el("h2", { text: "النشر" }));
    if (S.ui.confirm === "publish" && can) {
      box.appendChild(el("div", { class: "card", id: "publishConfirm" }, [
        el("p", { text: "سيظهر هذا التعديل لزوار الموقع خلال دقيقة تقريبًا. هل تنشر؟" }),
        el("div", { class: "row" }, [
          btn("نعم، انشر", function () { S.ui.confirm = ""; doPublish(); }, "primary big", { id: "publishYes" }),
          btn("إلغاء", function () { S.ui.confirm = ""; render(); }, "ghost")
        ])
      ]));
    } else {
      box.appendChild(btn("انشر على الموقع", function () { S.ui.confirm = "publish"; render(); }, "primary big", { id: "publishBtn", disabled: !can }));
    }

    box.appendChild(el("h2", { text: "التراجع" }));
    var last = S.ui.last, isDash = !!(last && String(last.message).indexOf(GH.PREFIX) === 0);
    if (S.ui.lastState === "loading" || !last) {
      box.appendChild(el("p", { class: "muted small", id: "lastInfo", text: S.ui.lastState === "loading" ? "جارٍ قراءة آخر تعديل…" : "تعذّرت قراءة آخر تعديل على الموقع." }));
    } else {
      box.appendChild(el("p", { class: "muted small", id: "lastInfo" }, [
        "آخر تعديل على الموقع: ",
        el("bdi", { text: String(last.message).split("\n")[0] }),
        last.date ? " · " : null,
        last.date ? el("bdi", { text: new Date(last.date).toLocaleString("ar-SA-u-nu-latn") }) : null
      ]));
    }
    if (isDash) box.appendChild(confirmBtn("undo", "تراجع عن آخر نشر", "نعم، تراجع", doUndo, "danger", n ? "ستُحذف أيضًا تعديلاتك غير المنشورة." : "يعود الموقع إلى ما قبل آخر نشر من اللوحة."));
    else if (last) box.appendChild(el("p", { class: "muted small", id: "undoOff", text: "التراجع متاح فقط حين يكون آخر تعديل على الموقع من لوحة التحكم." }));
    return box;
  }

  /* ---------- start ---------- */
  function start() {
    if (!L || !GH || !L.read || !L.build) {
      app.textContent = "";
      app.appendChild(el("p", { class: "msg err boot", role: "alert", text: "تعذّر تحميل ملفات اللوحة. أعد تحميل الصفحة." }));
      return;
    }
    var saved = sget("local", TOKEN_KEY), remember = true;
    if (!saved) { saved = sget("session", TOKEN_KEY); remember = false; }
    if (saved) { S.ui.busy = "جارٍ قراءة ملفات الموقع من GitHub…"; renderSign(); signIn(saved, remember); }
    else renderSign();
  }
  start();
})();
