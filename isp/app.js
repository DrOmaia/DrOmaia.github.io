/* IS Teaching Timetable — interface. Everything runs in the browser; nothing is uploaded. */
(function () {
  'use strict';
  const E = window.ISPEngine, D = window.ISPDefaults, X = window.ISPExport, TXT = window.ISPText;
  const LS_KEY = 'isp-timetable-v1';
  const main = document.getElementById('main');
  const $ = (sel, el) => (el || document).querySelector(sel);

  // ---------------- state ----------------
  const blank = () => ({
    app: 'isp-timetable', v: 1, side: null, term: '', lang: (S0() || {}).lang || 'ar', step: 1,
    files: {}, members: [], courses: {}, courseTouched: {}, secCat: {}, msc: [],
    currentMap: {}, prefsMap: {}, mapManual: {}, hoursSource: '', assign: {}, proposed: {}, autoTime: {}, pins: {}, bans: {},
    decisions: {}, forbidden: {}, built: false, baseline: null, savedAt: null, ref: null,
  });
  function S0() { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; } }
  let S = blank();
  let R = { wb: {}, sheets: {}, err: {}, off: null, cur: null, prefs: null, fac: null, notes: {}, curScore: {}, prefScore: {} };
  const ui = { tab: 'members', open: {}, alts: {}, altBusy: null, building: false, dirty: false, undo: [] };

  // ---------------- helpers ----------------
  const L = () => TXT[S.lang] || TXT.ar;
  const t = (k, ...a) => { const v = L()[k]; return typeof v === 'function' ? v(...a) : v == null ? k : v; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => 'm' + Math.random().toString(36).slice(2, 9);
  const hl = (h) => E.hourLabel(h);
  const memberById = (id) => S.members.find((m) => m.id === id);
  const newMember = (name) => ({ id: uid(), name, required: '', coop: 0, senior: 0, keepCurrent: true, first: 8, last: 18, allowed: [], never: [], prefTime: 'any', prefs: ['', '', ''] });
  const pseudoName = (id) => (id === 'PT' ? 'Part-timers' : id === 'HOLD' ? 'ON-Hold' : '');
  const nameOf = (id) => (memberById(id) || {}).name || pseudoName(id) || id;
  const colour = (code) => '#' + D.colourFor(code);
  function bufToB64(buf) { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
  function b64ToBuf(b64) { const s = atob(b64); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b.buffer; }
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600); }
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  let saveTimer = null;
  function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ } }, 300); }
  const sideLabel = () => (S.side === 'female' ? t('female') : t('male'));
  const fileBase = () => `${S.term || ''} ${S.side === 'female' ? 'female' : 'male'}`.trim();

  // ---------------- parsing ----------------
  async function loadWb(b64) { return E.loadWorkbook(window.ExcelJS, window.JSZip, b64ToBuf(b64)); }
  function guessSheet(kind, sheets) {
    const names = sheets.map((s) => s.name);
    if (kind === 'official') return names.find((n) => n.trim().toUpperCase() === 'IS') || (sheets.find((s) => E.looksOfficial(s)) || sheets[0]).name;
    if (kind === 'current') {
      const vis = sheets.filter((s) => !s.hidden);
      const want = S.side === 'female' ? /female|نساء|طالبات/i : /^(?!.*female).*(male|رجال|طلاب)/i;
      const hit = vis.find((s) => want.test(s.name));
      return (hit || vis[0] || sheets[0]).name;
    }
    if (kind === 'prefs') return (sheets.find((s) => /response|form/i.test(s.name)) || sheets[0]).name;
    if (kind === 'faculty') return (sheets.find((s) => !s.hidden) || sheets[0]).name;
    return sheets[0].name;
  }
  async function readFile(kind) {
    const f = S.files[kind];
    R.err[kind] = null;
    if (!f) { R.wb[kind] = null; R.sheets[kind] = null; return; }
    try {
      R.wb[kind] = await loadWb(f.b64);
      R.sheets[kind] = E.sheetsFromExcelJS(R.wb[kind]);
      if (!f.sheet || !R.sheets[kind].some((s) => s.name === f.sheet)) f.sheet = guessSheet(kind, R.sheets[kind]);
    } catch (e) { R.err[kind] = 'badFile'; R.wb[kind] = null; R.sheets[kind] = null; }
  }
  function parseAll() {
    // faculty list (members are merged only when the file is uploaded, see applyFaculty)
    R.fac = null;
    if (R.sheets.faculty && !R.err.faculty) {
      try { R.fac = E.parseFaculty(R.sheets.faculty, S.files.faculty.sheet); } catch (e) { R.err.faculty = 'notFaculty'; }
    }
    // official
    R.off = null; R.notes = {};
    if (R.sheets.official && !R.err.official) {
      try { R.off = E.parseOfficial(R.sheets.official, S.files.official.sheet); R.notes = E.officialNotes(R.off); }
      catch (e) { R.err.official = 'notOfficial'; }
    }
    // current
    R.cur = null; R.curScore = {};
    if (R.sheets.current && !R.err.current) {
      try {
        R.cur = E.parseCurrent(R.sheets.current, S.files.current.sheet);
        const names = R.cur.rows.filter((r) => r.kind === 'member').map((r) => r.name);
        const auto = E.matchNames(names, S.members);
        names.forEach((n) => { R.curScore[n] = auto[n] ? auto[n].score : 0; if (!S.mapManual['current|' + n] || !(n in S.currentMap)) S.currentMap[n] = auto[n] ? auto[n].id : ''; });
        // part-timer and ON-Hold rows: used as such unless the user chose otherwise
        R.cur.rows.filter((r) => r.kind !== 'member').forEach((r) => { if (!S.mapManual['current|' + r.name] || !(r.name in S.currentMap)) S.currentMap[r.name] = r.kind === 'parttime' ? 'PT' : 'HOLD'; });
      } catch (e) { R.err.current = 'notCurrent'; }
    }
    // preferences
    R.prefs = null; R.prefScore = {};
    if (R.sheets.prefs && !R.err.prefs) {
      try {
        R.prefs = E.parsePrefs(R.sheets.prefs, S.files.prefs.sheet);
        const list = R.prefs.list;
        const auto = E.matchNames(list.map((p) => p.name), S.members, 0.55, (i) => list[i].email);
        list.forEach((p) => { R.prefScore[p.name] = auto[p.name] ? auto[p.name].score : 0; if (!S.mapManual['prefs|' + p.name] || !(p.name in S.prefsMap)) S.prefsMap[p.name] = auto[p.name] ? auto[p.name].id : ''; });
        applyPrefs();
      } catch (e) { R.err.prefs = 'notPrefs'; }
    }
    // course defaults for courses the user has not changed
    if (R.off) {
      const curRoles = R.cur ? { rows: R.cur.rows.map((r) => Object.assign({}, r, { kind: S.currentMap[r.name] === 'PT' ? 'parttime' : 'other' })) } : null;
      const def = E.defaultCourseSettings(R.off, curRoles, {});
      Object.entries(def).forEach(([code, v]) => { if (!S.courseTouched[code] || !S.courses[code]) S.courses[code] = Object.assign({}, S.courses[code] || {}, v); });
    }
  }
  function applyPrefs() {
    if (!R.prefs) return;
    S.members.forEach((m) => { if (m.fromPrefs) { m.prefs = ['', '', '']; m.comment = ''; if (!m.prefTimeTouched) m.prefTime = 'any'; m.fromPrefs = false; } });
    R.prefs.list.forEach((p) => {
      const m = memberById(S.prefsMap[p.name]); if (!m) return;
      m.prefs = p.prefs.slice(); m.comment = [p.comment, p.supervise ? `Supervise: ${p.supervise}` : ''].filter(Boolean).join(' | ');
      if (!m.prefTimeTouched) m.prefTime = p.time; m.fromPrefs = true;
    });
  }
  async function reparseAll() { for (const k of ['faculty', 'official', 'current', 'prefs']) await readFile(k); parseAll(); }
  /** Build or update the member list from the faculty file. Members already known keep their settings. */
  function applyFaculty() {
    if (!R.fac) return;
    const old = S.members;
    const auto = E.matchNames(R.fac.list.map((x) => x.name), old, 0.8);
    S.members = R.fac.list.map((x) => {
      const hit = auto[x.name] && old.find((m) => m.id === auto[x.name].id);
      const m = hit ? Object.assign({}, hit) : newMember(x.name);
      m.name = x.name;
      if (x.required !== '' && x.required != null) m.required = x.required;
      if (S.hoursSource === 'file') {
        if (x.coop != null) m.coop = Math.max(0, Math.round(x.coop));
        if (x.senior != null) m.senior = Math.max(0, Math.round(x.senior));
      }
      return m;
    });
    const ids = new Set(S.members.map((m) => m.id));
    [S.assign, S.pins].forEach((o) => Object.keys(o).forEach((k) => { if (!ids.has(o[k])) delete o[k]; }));
    Object.keys(S.decisions).forEach((k) => { if (!ids.has(k)) delete S.decisions[k]; });
    [['current', S.currentMap], ['prefs', S.prefsMap]].forEach(([kind, map]) => Object.keys(map).forEach((n) => { if (map[n] && !ids.has(map[n])) { map[n] = ''; delete S.mapManual[kind + '|' + n]; } }));
    S.msc.forEach((x) => { if (x.member && !ids.has(x.member)) x.member = ''; });
  }
  function currentFor() {
    const out = {};
    if (R.cur) R.cur.rows.forEach((r) => { const id = S.currentMap[r.name]; if (id && memberById(id)) out[id] = (out[id] || []).concat(r.items); });
    else if (S.baseline) Object.entries(S.baseline).forEach(([id, items]) => { if (memberById(id)) out[id] = items; });
    return out;
  }

  // ---------------- model ----------------
  function model() { return R.off ? E.buildModel(R.off, { courses: S.courses, secCat: S.secCat, proposed: S.proposed, members: S.members }) : {}; }
  function effAssign(secs) {
    const out = {}, ids = new Set(S.members.map((m) => m.id));
    Object.values(secs).forEach((s) => {
      const k = s.key, pin = S.pins[k];
      if (pin && ids.has(pin)) { out[k] = pin; return; }
      if (s.cat === 'parttime') { out[k] = 'PT'; return; }
      if (s.cat === 'onhold') { out[k] = 'HOLD'; return; }
      if (s.cat === 'none') return;
      const a = S.assign[k]; if (a && ids.has(a)) out[k] = a;
    });
    return out;
  }
  const allRows = () => S.members.concat([{ id: 'PT', name: 'Part-timers', pseudo: true }, { id: 'HOLD', name: 'ON-Hold', pseudo: true }]);
  function snapshot() {
    const secs = model();
    const assign = effAssign(secs);
    const ev = E.evaluate(secs, allRows(), assign, S.msc);
    return { secs, assign, ev };
  }
  const sig = (keys) => keys.slice().sort().join('|');

  // ---------------- undo (proposal edits, kept in memory for this visit) ----------------
  const UNDO_KEYS = ['assign', 'pins', 'bans', 'proposed', 'autoTime', 'secCat', 'decisions', 'forbidden', 'built'];
  // the label is kept as a text key + values so it follows the interface language
  function remember(key, ...args) {
    const snap = {}; UNDO_KEYS.forEach((k) => { snap[k] = S[k]; });
    ui.undo.push({ s: JSON.stringify(snap), key, args });
    if (ui.undo.length > 50) ui.undo.shift();
  }
  function undo() {
    const u = ui.undo.pop();
    if (!u) { toast(t('nothingUndo')); return; }
    Object.assign(S, JSON.parse(u.s));
    ui.alts = {}; ui.altBusy = null; closePop();
    persist(); render(); toast(t('undone', t(u.key, ...u.args)));
  }
  const clearUndo = () => { ui.undo = []; };

  // ---------------- proposal ----------------
  function runPropose(extra) {
    const secs = model();
    const locked = {}; S.members.forEach((m) => { if (S.decisions[m.id] === 'final') locked[m.id] = true; });
    const cur = effAssign(secs);
    const start = {}; Object.entries(cur).forEach(([k, v]) => { if (memberById(v)) start[k] = v; });
    const pins = {}; Object.entries(S.pins).forEach(([k, v]) => { if (memberById(v) && secs[k]) pins[k] = v; });
    return E.propose(Object.assign({ members: S.members, secs, current: currentFor(), pins, bans: S.bans, locked, start, startHours: S.proposed, msc: S.msc, forbidden: S.forbidden, iterations: 40000, restarts: 4, seed: 262 }, extra || {}));
  }
  function applyResult(res) {
    S.assign = Object.assign({}, res.assign);
    Object.keys(S.autoTime).forEach((k) => { if (!res.hours[k] && !res.assign[k]) { delete S.proposed[k]; delete S.autoTime[k]; } });
    Object.entries(res.hours).forEach(([k, h]) => { S.proposed[k] = h; S.autoTime[k] = true; });
  }
  function build(fresh) {
    if (!R.off) return;
    ui.building = true; render();
    setTimeout(() => {
      if (fresh) Object.keys(S.autoTime).forEach((k) => { if (!S.pins[k]) { delete S.proposed[k]; delete S.autoTime[k]; } });
      const res = runPropose();
      applyResult(res);
      S.built = true; ui.building = false; ui.alts = {};
      if (!S.ref && R.off) setRef();
      persist(); render();
    }, 30);
  }
  function alternatives(mid) {
    ui.altBusy = mid; render();
    setTimeout(() => {
      const secs = model(); const cur = effAssign(secs);
      const mine = Object.keys(cur).filter((k) => cur[k] === mid);
      const forb = JSON.parse(JSON.stringify(S.forbidden || {}));
      forb[mid] = (forb[mid] || []).concat([sig(mine)]);
      const pins = {}; Object.entries(S.pins).forEach(([k, v]) => { if (v !== mid && memberById(v)) pins[k] = v; });
      const opts = [];
      for (let i = 0; i < 2; i++) {
        const res = runPropose({ forbidden: forb, pins, startAll: true, stability: 14, t0: 25, restarts: 2, iterations: 30000, seed: 1000 + i * 17 });
        const theirs = Object.keys(res.assign).filter((k) => res.assign[k] === mid);
        if (forb[mid].includes(sig(theirs))) break;
        forb[mid].push(sig(theirs));
        // changes vs current
        const changes = {};
        const before = {}; Object.entries(cur).forEach(([k, v]) => { if (memberById(v)) (before[v] = before[v] || []).push(k); });
        const after = {}; Object.entries(res.assign).forEach(([k, v]) => { (after[v] = after[v] || []).push(k); });
        S.members.forEach((m) => {
          const b = before[m.id] || [], a = after[m.id] || [];
          const add = a.filter((k) => !b.includes(k)), rem = b.filter((k) => !a.includes(k));
          if (add.length || rem.length) changes[m.id] = { add, rem };
        });
        // problems this alternative would create
        const secs2 = model(); Object.entries(res.hours).forEach(([k, h]) => { if (secs2[k]) { secs2[k].hour = h; secs2[k].proposed = true; } });
        const ev2 = E.evaluate(secs2, S.members, res.assign, S.msc);
        const evNow = E.evaluate(model(), S.members, Object.fromEntries(Object.entries(cur).filter(([, v]) => memberById(v))), S.msc);
        const key = (i) => [i.type, i.member || '', i.a || '', i.b || ''].join('|');
        const nowKeys = new Set(evNow.issues.map(key));
        const fresh = ev2.issues.filter((i) => !nowKeys.has(key(i)));
        opts.push({ res, changes, hours: res.hours, fresh });
      }
      ui.alts[mid] = { opts, forb: forb[mid] };
      ui.altBusy = null; render();
    }, 30);
  }

  // ---------------- rendering ----------------
  function setLangAttrs() {
    document.documentElement.lang = S.lang; document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
    $('#langBtn').textContent = t('lang');
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  }
  function canReach(step) {
    if (step <= 1) return true;
    if (!S.side || !S.term) return false;
    if (step === 2) return true;
    if (!R.off || !(R.cur || S.baseline) || !S.members.length) return false;
    return true;
  }
  function render() {
    hideCard();
    setLangAttrs();
    const chip = $('#projectChip');
    chip.hidden = !S.side; chip.textContent = S.side ? `${sideLabel()} ${S.term}` : '';
    $('#saveBtn').hidden = !S.side;
    const st = $('#stepper');
    st.hidden = !S.side;
    if (S.side) {
      st.innerHTML = L().steps.map((name, i) => {
        const n = i + 1, cls = n === S.step ? 'on' : n < S.step && canReach(n) ? 'done' : '';
        return `${i ? '<span class="sep"></span>' : ''}<button type="button" class="${cls}" data-act="go" data-step="${n}" ${canReach(n) ? '' : 'disabled'}><b>${n < S.step && canReach(n) ? '✓' : n}</b><span>${esc(name)}</span></button>`;
      }).join('');
    }
    if (ui.view === 'format') {
      st.hidden = true;
      main.classList.add('wide');
      main.innerHTML = viewFormat() + noticeBar();
      return;
    }
    main.classList.toggle('wide', S.step === 3 || S.step === 4);
    const views = { 1: viewStart, 2: viewFiles, 3: viewSettings, 4: viewProposal, 5: viewExport };
    main.innerHTML = (views[S.step] || viewStart)() + noticeBar() + footNav();
  }
  function noticeBar() { return `<p class="notice-bar" role="note"><b>${esc(t('noticeTitle'))}</b> ${esc(t('noticeShort'))}</p>`; }
  function footNav() {
    if (S.step === 1) return '';
    const nextOk = canReach(S.step + 1);
    let msg = '';
    if (S.step === 2 && !nextOk) msg = !S.members.length ? t('needFaculty') : !R.off ? t('needOfficial') : t('needCurrent');
    return `<div class="foot-nav"><button class="btn" type="button" data-act="go" data-step="${S.step - 1}">${S.lang === 'ar' ? '→' : '←'} ${esc(t('back'))}</button><span class="msg">${esc(msg)}</span>${S.step < 5 ? `<button class="btn primary" type="button" data-act="go" data-step="${S.step + 1}" ${nextOk ? '' : 'disabled'}>${esc(t('next'))} ${S.lang === 'ar' ? '←' : '→'}</button>` : '<span></span>'}</div>`;
  }

  // ---- step 1: start ----
  function strip() {
    const lanes = [
      ['Dr. A', { 8: 'IS205', 9: 'IS205', 10: 'IS241', 11: 'IS241' }],
      ['Dr. B', { 13: 'IS371', 14: 'IS371', 15: 'IS371' }],
      ['Dr. C', { 10: 'IS201', 13: 'IS361', 14: 'IS361', 16: 'IS466' }],
    ];
    let d = 0;
    const hrs = E.HOURS.slice(0, 4).map((h) => `<span>${hl(h)}</span>`).join('') + '<span></span>' + E.HOURS.slice(4).map((h) => `<span>${hl(h)}</span>`).join('');
    return `<div class="strip" aria-hidden="true"><div class="hrs">${hrs}</div>${lanes.map(([who, map]) => `<p class="who">${who}</p><div class="lane">${[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((h) => {
      if (h === 12) return '<span class="brk"></span>';
      const c = map[h];
      return c ? `<span class="fill" style="background:${colour(c)};animation-delay:${(d++) * 70}ms">${c}</span>` : '<span></span>';
    }).join('')}</div>`).join('')}</div>`;
  }
  function mini(head, rows, cap) {
    return `<figure class="mini" style="margin:0"><table><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td class="${/^[A-Z]{2,4}\d{3}/.test(c) ? 'c' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</table><figcaption>${esc(cap)}</figcaption></figure>`;
  }
  function viewStart() {
    const saved = S0();
    const hasAuto = saved && saved.side && saved.app === 'isp-timetable' && !S.side;
    const pick = ui.pickSide || S.side;
    return `
    <section class="hero">
      <div><h1>${esc(t('heroTitle'))}</h1><p>${esc(t('heroText'))}</p>
        <div class="notice-box" role="note"><b>${esc(t('noticeTitle'))}</b><p>${esc(t('noticeLong'))}</p></div></div>
      ${strip()}
    </section>
    <section class="start-grid">
      <div class="panel">
        <h2>${esc(t('newProject'))}</h2>
        <p class="sub">${esc(t('chooseSide'))}</p>
        <div class="side-pick">
          <button type="button" data-act="pick" data-side="male" aria-pressed="${pick === 'male'}">${esc(t('male'))}${S.lang === 'ar' ? '<small>Male</small>' : ''}</button>
          <button type="button" data-act="pick" data-side="female" aria-pressed="${pick === 'female'}">${esc(t('female'))}${S.lang === 'ar' ? '<small>Female</small>' : ''}</button>
        </div>
        <div class="row" style="align-items:flex-end">
          <div class="field grow"><label for="termIn">${esc(t('termLabel'))}</label><input id="termIn" class="input" inputmode="numeric" placeholder="${esc(t('termPh'))}" value="${esc(ui.termDraft != null ? ui.termDraft : S.term)}"></div>
          <button class="btn primary big" type="button" data-act="start" ${pick ? '' : 'disabled'}>${esc(t('startBtn'))}</button>
        </div>
      </div>
      <div class="panel resume-box">
        <h2>${esc(t('resumeTitle'))}</h2>
        <p class="sub" style="margin:0">${esc(t('resumeText'))}</p>
        <button class="btn" type="button" data-act="openProject">${esc(t('open'))}</button>
        ${hasAuto ? `<div class="autosave"><span>${esc(t('resumeAuto'))}: <b>${esc((saved.side === 'female' ? t('female') : t('male')) + ' ' + (saved.term || ''))}</b></span><button class="btn small" type="button" data-act="resumeAuto">${esc(t('resumeAutoBtn'))}</button></div>` : ''}
      </div>
    </section>
    <section class="panel fmt-card">
      <div><span class="tag opt">${esc(t('fmtTag'))}</span><h2 style="margin-top:6px">${esc(t('fmtCardTitle'))}</h2><p class="sub" style="margin:4px 0 0">${esc(t('fmtCardText'))}</p></div>
      <label class="drop" data-drop="fmt"><input type="file" accept=".xlsx,.xlsm" data-file="fmt" hidden>${esc(t('fmtDrop'))}</label>
    </section>
    <section class="need">
      <h2>${esc(t('needTitle'))}</h2>
      <p>${esc(t('needIntro'))}</p>
      <div class="files3">
        <article class="fcard"><h3>${esc(t('f0Title'))}<span class="tag">${esc(t('f0Req'))}</span></h3><p><strong>${esc(t('f0From'))}</strong></p><p>${esc(t('f0Has'))}</p>
          ${mini(['No', 'Full name', 'Sections', 'COOP', 'Senior'], [['1', 'Dr. A', '4', '2', ''], ['2', 'Dr. B', '3', '', '']], t('sampleRow') + ': Total Sections')}
          <button class="link" type="button" data-act="facTemplate" style="align-self:flex-start">${esc(t('facTemplate'))}</button></article>
        <article class="fcard"><h3>${esc(t('f1Title'))}<span class="tag">${esc(t('f1Req'))}</span></h3><p><strong>${esc(t('f1From'))}</strong></p><p>${esc(t('f1Has'))}</p>
          ${mini(['SECTION', 'COURSE', 'ACTIVITY', 'START', 'DAYS', 'ROOMS'], [['498', 'IS201', 'Lecture', '10:00 AM', '1 2 4', 'G-A12'], ['499', 'IS201', 'Tutorial', '10:00 AM', '3', 'Online']], t('sampleRow') + ': IS sheet')}</article>
        <article class="fcard"><h3>${esc(t('f2Title'))}<span class="tag">${esc(t('f2Req'))}</span></h3><p><strong>${esc(t('f2From'))}</strong></p><p>${esc(t('f2Has'))}</p>
          ${mini(['', '8', '9', '10', '11', '1', '2'], [['Dr. A', '', 'IS205(L)', 'IS241(L)', '', '', ''], ['Dr. B', '', '', '', '', 'IS371(L)', 'IS371(L)']], t('sampleRow') + ': 261 timetable')}</article>
        <article class="fcard"><h3>${esc(t('f3Title'))}<span class="tag opt">${esc(t('f3Req'))}</span></h3><p><strong>${esc(t('f3From'))}</strong></p><p>${esc(t('f3Has'))}</p>
          ${mini(['Full name', 'First preferred', 'Second', 'Third', 'Class time'], [['Dr. A', 'IS241', 'IS205', 'IS231', 'Morning']], t('sampleRow') + ': Form Responses 1')}</article>
      </div>
    </section>
    <section class="how">
      <div class="panel"><h2>${esc(t('howTitle'))}</h2><ol style="margin-top:14px">${L().how.map(([a, b]) => `<li><div><strong>${esc(a)}</strong><span>${esc(b)}</span></div></li>`).join('')}</ol></div>
      <div class="panel"><h2>${esc(t('rulesTitle'))}</h2><div class="rules">${L().rules.map((r) => `<span>${esc(r)}</span>`).join('')}</div><p class="privacy">${esc(t('privacy'))}</p></div>
    </section>`;
  }

  // ---- extra service: format any timetable for printing ----
  function fmtGrid() {
    const f = ui.fmt; if (!f || !f.grid) return '';
    const g = f.grid;
    const keep = g.extras.map((_, i) => g.blocks.some((b) => b.rows.some((r) => r.extras[i] !== ''))).map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    const am = g.hours.filter((h) => h < 12), pm = g.hours.filter((h) => h > 12);
    const head = `<tr><th class="nm">Member</th>${g.unitLabel ? `<th>${esc(g.unitLabel)}</th>` : ''}${am.map((h) => `<th>${hl(h)}</th>`).join('')}${am.length && pm.length ? '<th class="brk"></th>' : ''}${pm.map((h) => `<th>${hl(h)}</th>`).join('')}${g.hasNoTime ? '<th>No time</th>' : ''}${keep.map((i) => `<th class="ex">${esc(g.extras[i])}</th>`).join('')}</tr>`;
    const cell = (v, i) => { if (v === '') return '<td></td>'; const code = E.courseIn(v); return `<td class="${i === 0 ? 'l' : 't'}" ${code ? `style="background:${colour(code)}"` : ''}>${esc(v)}</td>`; };
    const body = g.blocks.map((b) => b.rows.map((r, i) => `<tr class="${i === 0 ? 'first' : ''} ${i === b.rows.length - 1 ? 'last' : ''}">${i === 0 ? `<td class="nm" rowspan="${b.rows.length}">${esc(b.name)}</td>` : ''}${g.unitLabel ? `<td class="u">${esc(r.unit)}</td>` : ''}${am.map((h) => cell(r.cells[h], i)).join('')}${am.length && pm.length ? '<td class="brk"></td>' : ''}${pm.map((h) => cell(r.cells[h], i)).join('')}${g.hasNoTime ? cell(r.nt, i) : ''}${keep.map((k) => `<td class="ex">${esc(r.extras[k])}</td>`).join('')}</tr>`).join('')).join('');
    const dropped = g.extras.filter((_, i) => !keep.includes(i));
    return `<div id="fmtSheet" class="fmt-sheet" dir="ltr"><h2 class="fmt-title">${esc(f.title || '')}</h2><table class="fmt"><thead>${head}</thead><tbody>${body}</tbody></table>
      <p class="fmt-foot">${esc(X.NOTICE)}</p></div>${dropped.length ? `<p class="small muted no-print" style="margin-top:10px">${esc(t('fmtDropped', dropped.join(', ')))}</p>` : ''}`;
  }
  function viewFormat() {
    const f = ui.fmt || {};
    return `<div class="page-head no-print"><div><h1>${esc(t('fmtCardTitle'))}</h1><p>${esc(t('fmtText'))}</p></div>
      <div class="row"><button class="btn" type="button" data-act="fmtClose">${esc(t('fmtClose'))}</button>${f.grid ? `<button class="btn" type="button" data-act="fmtExcel">${esc(t('fmtExcel'))}</button><button class="btn primary" type="button" data-act="fmtPrint">${esc(t('fmtPrint'))}</button>` : ''}</div></div>
    <div class="panel no-print fmt-controls">
      <div class="row" style="align-items:flex-end">
        <div class="field"><span class="lbl">${esc(t('sheet'))}</span><select class="input" data-chg="fmtSheet">${(f.sheets || []).map((x) => `<option value="${esc(x.name)}" ${x.name === f.sheet ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
        <div class="field grow"><span class="lbl">${esc(t('fmtTitleLbl'))}</span><input class="input" dir="ltr" data-chg="fmtTitle" value="${esc(f.title || '')}"></div>
        <label class="btn small"><input type="file" accept=".xlsx,.xlsm" data-file="fmt" hidden>${esc(t('replace'))}</label>
      </div>
      <p class="small muted" style="margin-top:8px"><span dir="ltr">${esc(f.name || '')}</span> — ${esc(t('fmtFormulaNote'))}</p>
      ${f.err ? `<p class="err">${esc(t(f.err))}</p>` : ''}
    </div>
    ${f.grid ? `<div class="fmt-wrap">${fmtGrid()}</div>` : ''}`;
  }
  async function openFormat(file) {
    if (!file) return;
    const b64 = bufToB64(await file.arrayBuffer());
    ui.fmt = { name: file.name, b64, sheets: [], sheet: null, title: '', grid: null, err: null };
    ui.view = 'format'; render();
    try {
      ui.fmt.wb = await loadWb(b64);
      ui.fmt.sheets = E.sheetsFromExcelJS(ui.fmt.wb);
      const vis = ui.fmt.sheets.filter((x) => !x.hidden);
      const hit = vis.find((x) => { try { return E.readGridRaw(ui.fmt.sheets, x.name).blocks.length; } catch (e) { return false; } });
      fmtUseSheet((hit || vis[0] || ui.fmt.sheets[0]).name);
    } catch (e) { ui.fmt.err = 'badFile'; }
    render();
  }
  function fmtUseSheet(name) {
    const f = ui.fmt; f.sheet = name; f.err = null; f.grid = null;
    try { f.grid = E.readGridRaw(f.sheets, name); f.title = f.grid.title || f.name.replace(/\.xlsx?m?$/i, ''); }
    catch (e) { f.err = 'notCurrent'; }
  }
  async function fmtExcel() {
    const f = ui.fmt; if (!f || !f.grid) return;
    const wb = await X.buildFormatted(window.ExcelJS, { title: f.title, grid: f.grid, sheetName: f.sheet });
    const buf = await wb.xlsx.writeBuffer();
    download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${f.name.replace(/\.xlsx?m?$/i, '')} - formatted.xlsx`);
  }

  // ---- step 2: files ----
  function uploadBlock(kind, n, title, tag, hint) {
    const f = S.files[kind];
    const err = R.err[kind];
    let body = '';
    if (!f) {
      body = `<label class="drop" data-drop="${kind}"><input type="file" accept=".xlsx,.xlsm" data-file="${kind}" hidden>${esc(t('drop'))}</label>`;
    } else {
      const sheets = R.sheets[kind] || [];
      let sum = '';
      if (kind === 'official' && R.off) { const lec = R.off.lectures.length, c = Object.keys(R.off.courses).length, u = R.off.lectures.filter((k) => R.off.sections[k].hour == null).length; sum = t('offSummary', lec, c, u); }
      if (kind === 'current' && R.cur) { const rows = R.cur.rows.filter((r) => r.kind === 'member'); sum = t('curSummary', rows.length, rows.filter((r) => S.currentMap[r.name]).length); }
      if (kind === 'prefs' && R.prefs) sum = t('prefSummary', R.prefs.list.length, R.prefs.list.filter((p) => S.prefsMap[p.name]).length);
      if (kind === 'faculty' && R.fac) sum = t('facSummary', S.members.length, S.members.reduce((a, m) => a + (Number(m.required) || 0), 0));
      body = `<div class="loaded"><span class="fname">${esc(f.name)}</span>
        ${sheets.length > 1 ? `<label class="small muted">${esc(t('sheet'))} <select class="input" data-chg="sheet" data-kind="${kind}">${sheets.map((s) => `<option value="${esc(s.name)}" ${s.name === f.sheet ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>` : ''}
        <span class="sum">${esc(sum)}</span><span class="grow"></span>
        <label class="btn small"><input type="file" accept=".xlsx,.xlsm" data-file="${kind}" hidden>${esc(t('replace'))}</label>
        <button class="btn small danger" type="button" data-act="rmFile" data-kind="${kind}">${esc(t('remove'))}</button></div>
        ${err ? `<p class="err">${esc(t(err))}</p>` : ''}`;
      if (kind === 'official' && R.off) {
        const nk = Object.keys(R.notes); const total = nk.reduce((a, k) => a + R.notes[k].length, 0);
        if (total) body += `<details class="notes"><summary>${esc(t('notesFound', total))}</summary><ul>${nk.map((k) => R.notes[k].map((x) => `<li><b>${esc(k)}</b>: ${esc(x.text)}</li>`).join('')).join('')}</ul></details>`;
      }
      if (kind === 'faculty' && R.fac && R.fac.partTime != null) body += `<p class="small muted" style="margin-top:6px">${esc(t('partNote', R.fac.partTime))}</p>`;
      if (kind === 'faculty' && R.fac) {
        const has = R.fac.hasCoop || R.fac.hasSenior;
        const found = [R.fac.hasCoop ? 'COOP' : '', R.fac.hasSenior ? 'Senior' : ''].filter(Boolean).join(S.lang === 'ar' ? ' و ' : ' and ');
        const src = S.hoursSource || (has ? 'file' : 'manual');
        body += `<fieldset class="src-pick"><legend>${esc(t('hoursSrc'))}</legend>
          <label class="${has ? '' : 'off'}"><input type="radio" name="hsrc" value="file" data-chg="hoursSrc" ${src === 'file' ? 'checked' : ''} ${has ? '' : 'disabled'}><span><b>${esc(t('srcFile'))}</b><small>${esc(has ? t('srcFound', found) : t('srcNoCol'))}</small></span></label>
          <label><input type="radio" name="hsrc" value="manual" data-chg="hoursSrc" ${src === 'manual' ? 'checked' : ''}><span><b>${esc(t('srcManual'))}</b><small>${esc(t('srcManualSub'))}</small></span></label>
        </fieldset>`;
      }
      if (kind === 'current' && R.cur) body += matchTable('current');
      if (kind === 'prefs' && R.prefs) body += matchTable('prefs');
    }
    if (kind === 'current' && !f && S.baseline) body += `<p class="ok-text small" style="margin-top:8px">${esc(t('baselineOn'))}</p>`;
    if (kind === 'faculty' && !f && S.members.length) body += `<p class="ok-text small" style="margin-top:8px">${esc(t('membersKept', S.members.length))}</p>`;
    if (kind === 'faculty' && !f) body += `<p style="margin-top:8px"><button class="link" type="button" data-act="facTemplate">${esc(t('facTemplate'))}</button></p>`;
    if (kind === 'faculty') body += memberEditor();
    const ok = (kind === 'faculty' && S.members.length && !err) || (kind === 'official' && R.off) || (kind === 'current' && (R.cur || (!f && S.baseline))) || (kind === 'prefs' && R.prefs);
    return `<div class="upl ${ok ? 'ok' : ''}"><span class="num">${ok ? '✓' : n}</span><div><h3>${esc(title)} <span class="tag ${kind === 'prefs' ? 'opt' : ''}">${esc(tag)}</span></h3><p class="hint">${esc(hint)}</p>${body}</div></div>`;
  }
  /** Files step: the member list itself — names, order, add and delete — before any matching. */
  function memberEditor() {
    if (!S.members.length && !S.files.faculty) return `<p class="small muted" style="margin-top:10px">${esc(t('orByHand'))} <button class="link" type="button" data-act="mAdd">+ ${esc(t('addMember'))}</button></p>`;
    return `<div class="fac-list"><div class="fac-head"><b>${esc(t('facListTitle', S.members.length))}</b><span class="muted small">${esc(t('facListHint'))}</span></div>
      <table class="fac"><tbody>${S.members.map((m, i) => `<tr>
        <td class="idx">${i + 1}</td>
        <td><input class="input fac-nm" dir="ltr" value="${esc(m.name)}" data-chg="mf" data-id="${m.id}" data-field="name" aria-label="${esc(t('hName'))}"></td>
        <td class="acts"><span class="updown"><button class="btn small quiet" type="button" data-act="mUp" data-id="${m.id}" ${i ? '' : 'disabled'} title="${esc(t('upHint'))}">↑ ${esc(t('up'))}</button><button class="btn small quiet" type="button" data-act="mDown" data-id="${m.id}" ${i < S.members.length - 1 ? '' : 'disabled'} title="${esc(t('downHint'))}">↓ ${esc(t('down'))}</button></span>
          <button class="btn small danger" type="button" data-act="mDel" data-id="${m.id}">${esc(t('delMember'))}</button></td></tr>`).join('')}</tbody></table>
      <div class="row" style="margin-top:10px"><button class="btn small" type="button" data-act="mAdd">+ ${esc(t('addMember'))}</button><span class="muted small">${esc(t('addHint'))}</span></div></div>`;
  }
  function matchTable(kind) {
    const rows = kind === 'current' ? R.cur.rows : R.prefs.list.map((p) => ({ name: p.name, kind: 'member' }));
    const map = kind === 'current' ? S.currentMap : S.prefsMap, score = kind === 'current' ? R.curScore : R.prefScore;
    const used = new Set(Object.values(map).filter(Boolean));
    const missing = S.members.filter((m) => !used.has(m.id));
    const isUnsure = (r) => r.kind === 'member' && (!map[r.name] || (!S.mapManual[kind + '|' + r.name] && (score[r.name] || 0) < 0.9));
    const opts = (sel) => `<optgroup label="${esc(t('optMembers'))}">${S.members.map((m) => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</optgroup>`
      + `<optgroup label="${esc(t('optOther'))}">${kind === 'current' ? `<option value="PT" ${sel === 'PT' ? 'selected' : ''}>${esc(t('optPart'))}</option><option value="HOLD" ${sel === 'HOLD' ? 'selected' : ''}>${esc(t('optHold'))}</option>` : ''}<option value="" ${!sel ? 'selected' : ''}>${esc(t('optIgnore'))}</option></optgroup>`;
    return `<details class="notes" ${rows.some(isUnsure) ? 'open' : ''}><summary>${esc(t('matchTitle'))}</summary><p class="small muted" style="margin-top:6px">${esc(t(kind === 'current' ? 'matchTextCur' : 'matchText'))}</p>
      <table class="match">${rows.map((r) => {
        const sel = map[r.name] || '';
        return `<tr class="${isUnsure(r) ? 'unsure' : ''}"><td>${esc(r.name)}${r.items && r.items.length ? `<small class="muted" style="display:block;font-weight:500">${esc([...new Set(r.items.map((i) => i.course))].join(', '))}</small>` : ''}</td><td><select class="input" data-chg="map" data-kind="${kind}" data-name="${esc(r.name)}">${opts(sel)}</select></td></tr>`;
      }).join('')}</table>
      ${missing.length ? `<p class="small muted" style="margin-top:8px">${esc(t('noRow'))}: <span dir="ltr">${missing.map((m) => esc(m.name)).join(', ')}</span></p>` : ''}</details>`;
  }
  function viewFiles() {
    return `<div class="page-head"><div><h1>${esc(t('filesTitle'))}</h1><p>${esc(t('filesText'))}</p></div></div>
    <div class="panel">
      ${uploadBlock('faculty', 1, t('f0Title'), t('f0Req'), t('f0From'))}
      ${uploadBlock('official', 2, t('f1Title'), t('f1Req'), t('f1From'))}
      ${uploadBlock('current', 3, t('f2Title'), t('f2Req'), t('f2From'))}
      ${uploadBlock('prefs', 4, t('f3Title'), t('f3Req'), t('f3From'))}
    </div>`;
  }

  // ---- step 3: settings ----
  const hourOpts = (sel, anyLabel, anyVal) => `<option value="${anyVal}" ${sel === anyVal ? 'selected' : ''}>${esc(anyLabel)}</option>` + E.HOURS.map((h) => `<option value="${h}" ${+sel === h && sel !== anyVal ? 'selected' : ''}>${hl(h)}</option>`).join('');
  function courseCodes() { return R.off ? Object.keys(R.off.courses) : []; }
  function prefixes() { return [...new Set(courseCodes().map((c) => c.replace(/\d+$/, '')))]; }
  function chipBox(m, field) {
    const vals = m[field] || [];
    const choices = prefixes().concat(courseCodes()).filter((c) => !vals.includes(c));
    return `<div class="chipbox">${vals.map((v) => `<span class="chip" dir="ltr">${esc(v)}<button type="button" aria-label="remove" data-act="chipRm" data-id="${m.id}" data-field="${field}" data-val="${esc(v)}">×</button></span>`).join('')}
      <select data-chg="chipAdd" data-id="${m.id}" data-field="${field}"><option value="">+ ${esc(t('add'))}</option>${choices.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>`;
  }
  function memberChips(m) {
    const c = [];
    if (m.first > 8) c.push(t('lcFirst', hl(m.first)));
    if (m.last < 18) c.push(t('lcLast', hl(m.last)));
    if ((m.allowed || []).length) c.push(t('lcOnly', m.allowed.join(', ')));
    if ((m.never || []).length) c.push(t('lcNever', m.never.join(', ')));
    const pr = (m.prefs || []).filter(Boolean); if (pr.length) c.push(t('lcPrefs', pr.join(' › ')));
    if (m.keepCurrent === false) c.push(t('lcNoKeep'));
    if (!c.length) return `<span class="muted small">${esc(t('noLimits'))}</span>`;
    return c.map((x) => `<span class="chip">${esc(x)}</span>`).join('');
  }
  /** Whole hours chosen from a list (0, 1, 2, …), never typed. */
  function hoursSelect(m, field, max, label) {
    const v = Number(m[field]) || 0;
    const top = Math.max(max, Math.ceil(v));
    let o = '';
    for (let h = 0; h <= top; h++) o += `<option value="${h}" ${Math.round(v) === h ? 'selected' : ''}>${h}</option>`;
    return `<select class="input num" data-chg="mf" data-id="${m.id}" data-field="${field}" aria-label="${esc(label)}">${o}</select>`;
  }
  function hintField(label, hint, control, wide) {
    return `<div class="field${wide ? ' wide' : ''}"><span class="lbl">${esc(label)}</span>${control}${hint ? `<span class="hint2">${esc(hint)}</span>` : ''}</div>`;
  }
  function viewMembers() {
    const cur = currentFor();
    const secs = model();
    const avail = Object.values(secs).filter((s) => (s.cat === 'required') && s.counts).length;
    const asn = Object.values(secs).filter((s) => s.cat === 'asneeded').length;
    const reqTotal = S.members.reduce((a, m) => a + (Number(m.required) || 0), 0);
    const opts3 = (sel) => `<option value="">—</option>` + courseCodes().map((c) => `<option ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join('');
    if (!S.members.length) return `<p class="muted">${esc(t('noMembers'))} <button class="link" type="button" data-act="go" data-step="2">${esc(t('toFiles'))}</button></p>`;
    const th = (a, b, cls) => `<th class="${cls || ''}">${esc(a)}${b ? `<small>${esc(b)}</small>` : ''}</th>`;
    const rows = S.members.map((m, i) => {
      const open = !!ui.open[m.id];
      const curTxt = cur[m.id] && cur[m.id].length ? cur[m.id].map((x) => `${x.course}${x.hour ? ' ' + hl(x.hour) : ''}`).join(', ') : '';
      const main = `<tr class="${open ? 'is-open' : ''}">
        <td class="idx">${i + 1}</td>
        <td class="nmcell" dir="ltr">${esc(m.name)}</td>
        <td class="c"><input class="input num ${m.required === '' ? 'empty' : ''}" type="number" min="0" max="12" step="1" inputmode="numeric" value="${esc(m.required)}" data-chg="mf" data-id="${m.id}" data-field="required" aria-label="${esc(t('hSections'))}"></td>
        <td class="c">${hoursSelect(m, 'coop', 3, t('hCoop'))}</td>
        <td class="c">${hoursSelect(m, 'senior', 6, t('hSenior'))}</td>
        <td class="c"><select class="input pt ${m.prefTime && m.prefTime !== 'any' ? 'set' : ''}" data-chg="mf" data-id="${m.id}" data-field="prefTime" aria-label="${esc(t('prefTime'))}">${['any', 'am', 'pm'].map((v) => `<option value="${v}" ${(m.prefTime || 'any') === v ? 'selected' : ''}>${esc(t(v === 'any' ? 'anyTime' : v))}</option>`).join('')}</select></td>
        <td class="chips">${memberChips(m)}</td>
        <td class="acts">
          <button class="btn small ${open ? 'primary' : ''}" type="button" data-act="mOpen" data-id="${m.id}" aria-expanded="${open}">${esc(open ? t('closeLimits') : t('editLimits'))}</button>
        </td></tr>`;
      if (!open) return main;
      return main + `<tr class="more-row"><td></td><td colspan="7"><div class="more2">
        <section class="rule"><h4>${esc(t('gTime'))}</h4><span class="kind">${esc(t('kindRule'))}</span>
          ${hintField(t('firstHour'), t('hintFirst'), `<select class="input" data-chg="mf" data-id="${m.id}" data-field="first">${hourOpts(m.first || 8, t('any'), 8)}</select>`)}
          ${hintField(t('lastHour'), t('hintLast'), `<select class="input" data-chg="mf" data-id="${m.id}" data-field="last">${hourOpts(m.last || 18, t('any'), 18)}</select>`)}
        </section>
        <section class="rule"><h4>${esc(t('gCourses'))}</h4><span class="kind">${esc(t('kindRule'))}</span>
          ${hintField(t('allowed'), t('allowedHint'), chipBox(m, 'allowed'))}
          ${hintField(t('never'), t('hintNever'), chipBox(m, 'never'))}
          <label class="check"><input type="checkbox" ${m.keepCurrent !== false ? 'checked' : ''} data-chg="mf" data-id="${m.id}" data-field="keepCurrent">${esc(t('keepCurrent'))}</label>
          <span class="hint2">${esc(t('currentCourses'))}: <span dir="ltr">${esc(curTxt || t('noCurrent'))}</span></span>
        </section>
        <section class="wish"><h4>${esc(t('gSurvey'))}</h4><span class="kind">${esc(t('kindWish'))}</span>
          <div class="prefs3">${[0, 1, 2].map((j) => `<label><span>${esc(L().ord[j])}</span><select class="input" data-chg="mpref" data-id="${m.id}" data-j="${j}">${opts3((m.prefs || [])[j])}</select></label>`).join('')}</div>
          <span class="hint2">${esc(t('hintPrefs'))}</span>
          ${m.comment ? `<blockquote class="comment" dir="ltr">${esc(m.comment)}</blockquote>` : ''}
        </section>
      </div></td></tr>`;
    }).join('');
    return `<p class="sub">${esc(t('membersIntro'))}</p>
    <div class="sumbar ${reqTotal > avail + asn ? 'bad' : ''}" style="margin:0 0 14px"><span>${esc(t('totalReq', reqTotal, `${avail}${asn ? ` + ${asn} (${t('cats').asneeded})` : ''}`))}</span></div>
    <div class="mtable-wrap"><table class="mtable">
      <thead><tr>${th('#', '', 'idx')}${th(t('hName'), t('hNameSub'))}${th(t('hSections'), t('hSectionsSub'), 'c')}${th(t('hCoop'), S.hoursSource === 'file' ? t('hHoursFile') : t('hHours'), 'c')}${th(t('hSenior'), S.hoursSource === 'file' ? t('hHoursFile') : t('hHours'), 'c')}${th(t('prefTime'), t('hPrefSub'), 'c')}${th(t('hLimits'), t('hLimitsSub'))}${th('', '')}</tr></thead>
      <tbody>${rows}</tbody></table></div>
    <p class="small muted" style="margin-top:12px">${esc(t('editNamesHint'))} <button class="link" type="button" data-act="go" data-step="2">${esc(t('toFiles'))}</button></p>`;
  }
  function viewCourses() {
    if (!R.off) return `<p class="muted">${esc(t('needOfficial'))}</p>`;
    const cats = L().cats;
    return `<p class="sub">${esc(t('catHelp'))}</p><table class="plain"><thead><tr><th>${esc(t('colCourse'))}</th><th></th><th>${esc(t('colCount'))}</th><th>${esc(t('colWho'))}</th><th>${esc(t('colCounts'))}</th></tr></thead><tbody>
      ${Object.values(R.off.courses).map((c) => {
        const cs = S.courses[c.code] || {};
        const noTime = c.timed === 0;
        return `<tr><td class="code"><span class="sw" style="background:${colour(c.code)}"></span>${esc(c.code)}</td><td dir="ltr" style="text-align:start">${esc(c.name)}</td><td>${c.lectures.length}${c.untimed ? ` <span class="chip warn">${c.untimed} ${esc(t('noTimeCourse'))}</span>` : ''}</td>
          <td><select class="input" data-chg="ccat" data-code="${c.code}">${Object.entries(cats).map(([k, v]) => `<option value="${k}" ${cs.cat === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></td>
          <td>${noTime ? `<label class="check"><input type="checkbox" ${cs.counts !== false ? 'checked' : ''} data-chg="ccount" data-code="${c.code}"></label>` : '<span class="muted">✓</span>'}</td></tr>`;
      }).join('')}</tbody></table>`;
  }
  function viewMsc() {
    return `<p class="sub">${esc(t('mscText'))}</p>
    ${S.msc.length ? `<table class="plain msc"><thead><tr><th>${esc(t('member'))}</th><th>${esc(t('program'))}</th><th>${esc(t('hours'))}</th><th></th></tr></thead><tbody>
    ${S.msc.map((x) => `<tr>
      <td><select class="input" data-chg="msc" data-id="${x.id}" data-field="member"><option value="">—</option>${S.members.map((m) => `<option value="${m.id}" ${m.id === x.member ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></td>
      <td><select class="input" data-chg="msc" data-id="${x.id}" data-field="program">${['MSc', 'PhD'].map((p) => `<option value="${p}" ${p === x.program ? 'selected' : ''}>${p}</option>`).join('')}</select></td>
      <td><select class="input num" data-chg="msc" data-id="${x.id}" data-field="hours">${[1, 2, 3, 4, 5, 6].map((h) => `<option value="${h}" ${Number(x.hours === '' || x.hours == null ? 3 : x.hours) === h ? 'selected' : ''}>${h}</option>`).join('')}</select></td>
      <td><button class="btn small danger" type="button" data-act="mscDel" data-id="${x.id}">${esc(t('remove'))}</button></td></tr>`).join('')}</tbody></table>` : `<p class="muted">${esc(t('noMsc'))}</p>`}
    <div class="row" style="margin-top:12px"><button class="btn" type="button" data-act="mscAdd">+ ${esc(t('addMsc'))}</button></div>`;
  }
  function viewSettings() {
    const tabs = [['members', t('tabMembers')], ['courses', t('tabCourses')], ['msc', t('tabMsc')]];
    return `<div class="page-head"><div><h1>${esc(t('setTitle'))}</h1></div></div>
    <div class="panel"><div class="tabs" role="tablist">${tabs.map(([k, v]) => `<button type="button" role="tab" class="${ui.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${esc(v)}</button>`).join('')}</div>
    ${ui.tab === 'courses' ? viewCourses() : ui.tab === 'msc' ? viewMsc() : viewMembers()}</div>`;
  }

  // ---- step 4: proposal ----
  function cellHtml(s, info) {
    const cls = ['cell'];
    if (s.proposed) cls.push('prop');
    if (info && info.bad) cls.push('bad');
    if (S.pins[s.key]) cls.push('pinned');
    if (info && info.isNew) cls.push('new');
    if (info && info.wish) cls.push('wish');
    if (info && info.moved) cls.push('moved');
    if (ui.focusCourse) cls.push(ui.focusCourse === s.course ? 'hit' : 'dim');
    const tips = [info && info.wish ? t('lgWish') : '', info && info.isNew ? t('lgNew') : '', info && info.moved ? t('lgMoved') : ''].filter(Boolean).join(' — ');
    const comp = s.comp ? `${s.comp.split('-')[1]} ${s.compAct === 'Lab' ? 'Lab' : 'T'}` : '';
    return `<div class="${cls.join(' ')}" data-key="${esc(s.key)}" data-course="${esc(s.course)}" style="background:${colour(s.course)}"${tips ? ` title="${esc(tips)}"` : ''}>${info && info.wish ? '<i class="star" aria-hidden="true">★</i>' : ''}<b>${esc(s.key)}</b>${comp ? `<span>${esc(comp)}</span>` : ''}${info && info.bench ? `<span class="bh">${esc(s.hour == null ? t('noTime') : hl(s.hour))}</span>` : ''}</div>`;
  }
  function viewProposal() {
    if (!R.off) return `<p>${esc(t('needOfficial'))}</p>`;
    if (!S.built && !ui.building) { setTimeout(() => build(true), 0); }
    const { secs, assign, ev } = snapshot();
    const bad = new Set();
    ev.issues.forEach((i) => { if (i.type === 'clash' || i.type === 'window' || i.type === 'notime') { if (i.a) bad.add(i.a); if (i.b) bad.add(i.b); } });
    const rows = S.members.map((m) => ({ m, pseudo: false })).concat(['PT', 'HOLD'].filter((id) => Object.values(assign).includes(id)).map((id) => ({ m: { id, name: pseudoName(id) }, pseudo: true })));
    const byMember = {}; Object.entries(assign).forEach(([k, v]) => { (byMember[v] = byMember[v] || []).push(k); });
    const realKeys = Object.keys(assign).filter((k) => memberById(assign[k]));
    const reqTotal = S.members.reduce((a, m) => a + (Number(m.required) || 0), 0);
    const counted = realKeys.filter((k) => secs[k].counts).length;
    const unassigned = ev.issues.filter((i) => i.type === 'unassigned').length;
    const conflicts = ev.issues.filter((i) => ['clash', 'window', 'notime'].includes(i.type)).length;
    const requests = Object.values(secs).filter((s) => s.proposed && assign[s.key]).length;
    const finals = S.members.filter((m) => S.decisions[m.id] === 'final').length;
    // courses each member taught in the current term (for the "new" mark)
    const hasCur = !!(R.cur || S.baseline);
    const taught = {}; Object.entries(currentFor()).forEach(([id, items]) => { taught[id] = new Set(items.map((x) => x.course)); });
    const isNew = (mid, s) => hasCur && !!memberById(mid) && !(taught[mid] && taught[mid].has(s.course));
    // survey preferences: star on matching sections, "wishes met" under the name
    const wishesOf = (m) => [...new Set((m.prefs || []).filter(Boolean).map(E.normCourse))];
    const isWish = (mid, s) => { const m = memberById(mid); return !!m && wishesOf(m).includes(s.course); };
    const anyWishes = S.members.some((m) => wishesOf(m).length);
    const moved = new Set(refChanged(secs, assign));
    const hh = health(secs, assign, ev);
    const delta = ui.lastScore != null && S.built && !ui.building ? hh.score - ui.lastScore : 0;
    if (S.built && !ui.building) {
      if (ui.wasHealthy === false && hh.healthy) setTimeout(celebrate, 250);
      ui.wasHealthy = hh.healthy; ui.lastScore = hh.score;
    }
    const head = `<tr><th style="text-align:left;padding-left:12px">${S.lang === 'ar' ? 'العضو' : 'Member'}</th>${E.HOURS.slice(0, 4).map((h) => `<th class="hr">${hl(h)}</th>`).join('')}<th class="brk" title="${esc(t('breakCol'))}"></th>${E.HOURS.slice(4).map((h) => `<th class="hr">${hl(h)}</th>`).join('')}<th>${esc(t('noTime'))}</th><th>${esc(t('load'))}</th><th>${esc(t('sections'))}</th><th title="${esc(t('prepsTip'))}">${esc(t('preps'))}</th></tr>`;
    const body = rows.map(({ m, pseudo }) => {
      const keys = byMember[m.id] || [];
      const p = ev.per[m.id] || { load: 0, counted: 0, total: 0 };
      const dec = S.decisions[m.id] || '';
      const slot = (h) => {
        const ks = keys.filter((k) => secs[k].hour === h);
        return `<td class="slot" tabindex="0" data-act="cell" data-mid="${m.id}" data-h="${h}">${ks.map((k) => cellHtml(secs[k], { bad: bad.has(k), isNew: isNew(m.id, secs[k]), wish: isWish(m.id, secs[k]), moved: moved.has(k) })).join('')}</td>`;
      };
      const nt = keys.filter((k) => secs[k].hour == null);
      const req = Number(m.required);
      const cntBad = !pseudo && m.required !== '' && m.required != null && p.counted !== req;
      const tr = `<tr data-mid="${m.id}" class="mem ${pseudo ? 'pseudo' : ''} ${m.id === 'HOLD' ? 'hold' : ''} ${dec}">
        <td class="name" dir="ltr"><span class="nmtxt" ${pseudo ? '' : `data-card="${m.id}" data-act="card" tabindex="0"`}>${esc(m.name)}</span>${(() => {
          if (pseudo) return '';
          const w = wishesOf(m); if (!w.length) return '';
          const mine = new Set(keys.map((k) => secs[k].course)); const got = w.filter((c) => mine.has(c)).length;
          return `<small class="wishes ${got ? 'got' : ''}" dir="${S.lang === 'ar' ? 'rtl' : 'ltr'}" title="${esc(t('wishTip'))}">${esc(t('wishes', got, w.length))}</small>`;
        })()}${pseudo ? '' : `<div class="dec no-print" dir="${S.lang === 'ar' ? 'rtl' : 'ltr'}">${['final', 'reject', 'review'].map((d) => `<button type="button" class="${d} ${dec === d ? 'on' : ''}" data-act="dec" data-id="${m.id}" data-dec="${d}">${esc(t(d))}</button>`).join('')}</div>`}</td>
        ${E.HOURS.slice(0, 4).map(slot).join('')}<td class="brk"></td>${E.HOURS.slice(4).map(slot).join('')}
        <td class="slot" tabindex="0" data-act="cell" data-mid="${m.id}" data-h="nt">${nt.map((k) => cellHtml(secs[k], { bad: bad.has(k), isNew: isNew(m.id, secs[k]), wish: isWish(m.id, secs[k]), moved: moved.has(k) })).join('')}${pseudo ? '' : S.msc.filter((x) => x.member === m.id).map((x) => `<div class="cell grad"><b>${esc(x.program || 'MSc')}</b><span>${esc(t('gradHours', Number(x.hours === '' || x.hours == null ? 3 : x.hours)))}</span></div>`).join('')}</td>
        <td class="num">${pseudo ? p.load : p.total}${!pseudo && p.total !== p.load ? `<small>${p.load} + ${(p.total - p.load)}</small>` : ''}</td>
        <td class="num cnt ${cntBad ? 'bad' : ''}">${pseudo ? keys.length : `${p.counted} / ${m.required === '' ? '–' : req}`}</td>
        <td class="num preps" title="${esc(t('prepsTip'))}">${pseudo ? '' : p.preps || 0}</td></tr>`;
      let alt = '';
      if (!pseudo && dec === 'reject') {
        const dirA = S.lang === 'ar' ? 'rtl' : 'ltr';
        if (ui.altBusy === m.id) alt = `<tr class="alt"><td colspan="16" dir="${dirA}">${esc(t('computing'))}</td></tr>`;
        else if (!ui.alts[m.id]) alt = `<tr class="alt"><td colspan="16" dir="${dirA}"><button class="btn small" type="button" data-act="showAlt" data-id="${m.id}">${esc(t('altTitle', m.name))}</button></td></tr>`;
        else if (ui.alts[m.id]) {
          const a = ui.alts[m.id];
          alt = `<tr class="alt"><td colspan="16" dir="${dirA}"><b>${esc(t('altTitle', m.name))}</b>${a.opts.length ? `<div class="alts">${a.opts.map((o, i) => `<div class="alt-card"><b>${i + 1}</b><ul>${Object.entries(o.changes).map(([id, c]) => `<li><b>${esc(nameOf(id))}</b>: ${c.rem.map((k) => `<span class="minus">− ${esc(k)} ${hl(o.hours[k] != null ? o.hours[k] : secs[k] ? secs[k].hour : null)}</span>`).join(' ')} ${c.add.map((k) => `<span class="plus">+ ${esc(k)} ${hl(o.hours[k] != null ? o.hours[k] : secs[k] ? secs[k].hour : null)}</span>`).join(' ')}</li>`).join('')}</ul>${o.fresh && o.fresh.length ? `<p class="small" style="color:var(--red);margin:0" dir="ltr">⚠ ${o.fresh.map(issueText).map(esc).join(' | ')}</p>` : ''}<button class="btn small primary" type="button" data-act="useAlt" data-id="${m.id}" data-i="${i}">${esc(t('useAlt'))}</button></div>`).join('')}</div>` : `<p class="muted small">${esc(t('altNone'))}</p>`}
            <div style="margin-top:10px"><button class="btn small" type="button" data-act="closeAlt" data-id="${m.id}">${esc(t('closeAlt'))}</button></div></td></tr>`;
        }
      }
      return tr + alt;
    }).join('');
    // attention list
    const items = [];
    ev.issues.forEach((i) => {
      if (i.type === 'unassigned') {
        const s = secs[i.a];
        const opts = S.members.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
        items.push(`<li><span class="t">${esc(t('issue').unassigned(i.a))} ${s.hour != null ? hl(s.hour) : ''}</span><span class="row" style="gap:6px"><select class="input" data-chg="assignTo" data-key="${i.a}"><option value="">${esc(t('assignTo'))}</option>${opts}</select><button class="btn small" type="button" data-act="toHold" data-key="${i.a}">${esc(t('toHold'))}</button></span></li>`);
      } else {
        const keys = [i.a, i.b].filter(Boolean).join(',');
        items.push(`<li class="${i.type === 'count' ? 'info' : ''}"><button type="button" class="go" data-act="goIssue" data-mid="${esc(i.member)}" data-keys="${esc(keys)}" title="${esc(t('goTip'))}"><span>${esc(issueText(i))}</span><i aria-hidden="true">⌖</i></button></li>`);
      }
    });
    const reqs = Object.values(secs).filter((s) => s.proposed && assign[s.key]).map((s) => {
      const fr = E.freeRooms(R.off, s.key, s.hour).filter((g) => !g.online);
      return `<li><span><b>${esc(s.key)}</b> → ${hl(s.hour)} <span class="muted">(${s.officialHour != null ? hl(s.officialHour) : t('noTime')})</span> · ${esc(nameOf(assign[s.key]))}<br><span class="small muted">${esc(t('freeRooms'))}: ${fr.map((g) => `${g.days.map((d) => E.DAY_NAMES[d]).join(' ')}: ${g.rooms.length ? g.rooms.map(E.shortRoom).join(' / ') : t('noFree')}`).join(' | ')}</span></span></li>`;
    });
    return `<div class="page-head"><div><h1>${esc(t('propTitle'))}</h1><p>${esc(t('rebuildHint'))}</p></div>
      <div class="row"><button class="btn" type="button" data-act="undo" ${ui.undo.length ? `title="${esc(t('undoTip', t(ui.undo[ui.undo.length - 1].key, ...ui.undo[ui.undo.length - 1].args)))}"` : 'disabled'}>↶ ${esc(t('undo'))}</button>${moved.size ? `<button class="btn" type="button" data-act="refAll" title="${esc(t('refAllTip'))}">↺ ${esc(t('refAll', moved.size))}</button>` : ''}<button class="btn" type="button" data-act="print">${esc(t('printBtn'))}</button><button class="btn primary" type="button" data-act="rebuild" ${ui.building ? 'disabled' : ''}>${esc(ui.building ? t('building') : t('rebuild'))}</button></div></div>
    <div class="stats">
      ${S.built ? healthCard(hh, delta) : ''}
      <div class="stat ${counted !== reqTotal ? 'warn' : 'good'}"><b>${counted} / ${reqTotal}</b>${esc(t('sAssigned'))}</div>
      <div class="stat ${unassigned ? 'bad' : 'good'}"><b>${unassigned}</b>${esc(t('sUnassigned'))}</div>
      <div class="stat ${conflicts ? 'bad' : 'good'}"><b>${conflicts}</b>${esc(t('sConflicts'))}</div>
      <div class="stat ${requests ? 'warn' : ''}"><b>${requests}</b>${esc(t('sRequests'))}</div>
      <div class="stat"><b>${finals} / ${S.members.length}</b>${esc(t('sFinal'))}</div>
    </div>
    <p class="legend small muted"><span><i class="lg prop"></i>${esc(t('lgProp'))}</span><span><i class="lg bad"></i>${esc(t('lgBad'))}</span><span><i class="lg pin">•</i>${esc(t('lgPin'))}</span>${hasCur ? `<span><i class="lg new"></i>${esc(t('lgNew'))}</span>` : ''}${anyWishes ? `<span><i class="lg star">★</i>${esc(t('lgWish'))}</span>` : ''}${S.ref ? `<span><i class="lg moved"></i>${esc(t('lgMoved'))}</span>` : ''}<span>${esc(t('lgClick'))}</span><span>${esc(t('lgCard'))}</span></p>
    ${howTo()}
    ${benchHtml(secs, assign)}
    ${courseBar(secs, assign)}
    <div class="gridwrap"><table class="tt ${ui.focusCourse ? 'focusing' : ''}"><thead>${head}</thead><tbody>${ui.building && !S.built ? `<tr><td colspan="16" style="padding:30px;text-align:center">${esc(t('building'))}</td></tr>` : body}</tbody></table></div>
    <div class="attn">
      <div class="panel"><h2>${esc(t('attention'))}</h2>${items.length ? `<p class="small muted" style="margin:-4px 0 10px">${esc(t('attnHint'))}</p><ul>${items.join('')}</ul>` : `<p class="good">${esc(t('allGood'))}</p>`}</div>
      <div class="panel"><h2>${esc(t('timeReqTitle'))}</h2>${reqs.length ? `<ul class="req-list">${reqs.join('')}</ul>` : `<p class="muted">—</p>`}</div>
    </div>`;
  }

  /** Short game instructions; can be hidden and shown again (remembered in this browser). */
  function howTo() {
    let hidden = false; try { hidden = localStorage.getItem('isp-howto') === 'hide'; } catch (e) { /* storage blocked */ }
    if (hidden) return `<p class="howto-show no-print"><button type="button" class="link" data-act="howto" data-v="show">? ${esc(t('howTitle'))}</button></p>`;
    return `<div class="howto no-print"><div class="howto-head"><b>✋ ${esc(t('howTitle'))}</b><button type="button" class="link" data-act="howto" data-v="hide">${esc(t('howHide'))}</button></div>
      <ol>${L().howSteps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol><p class="small muted">${esc(t('howTouch'))}</p></div>`;
  }
  /** One number for how sound the timetable is: sections placed, no conflicts, counts met, wishes met. */
  function health(secs, assign, ev) {
    const reqN = Object.values(secs).filter((s) => s.cat === 'required').length;
    const una = ev.issues.filter((i) => i.type === 'unassigned').length;
    const conf = ev.issues.filter((i) => ['clash', 'window', 'notime'].includes(i.type)).length;
    const withReq = S.members.filter((m) => m.required !== '' && m.required != null);
    const countOk = withReq.filter((m) => ((ev.per[m.id] || {}).counted || 0) === Number(m.required)).length;
    let wTot = 0, wGot = 0;
    S.members.forEach((m) => {
      const w = [...new Set((m.prefs || []).filter(Boolean).map(E.normCourse))];
      const mine = new Set(Object.keys(assign).filter((k) => assign[k] === m.id).map((k) => secs[k].course));
      wTot += w.length; wGot += w.filter((c) => mine.has(c)).length;
    });
    const cover = reqN ? 1 - una / reqN : 1, counts = withReq.length ? countOk / withReq.length : 1, wishes = wTot ? wGot / wTot : 1;
    const score = Math.max(0, Math.round(40 * cover + 25 * Math.max(0, 1 - conf / 4) + 25 * counts + 10 * wishes));
    return { score, healthy: una === 0 && conf === 0 && countOk === withReq.length, una, conf, countOk, withReq: withReq.length, wGot, wTot };
  }
  function healthCard(h, delta) {
    const tone = h.healthy ? 'good' : h.score >= 75 ? 'warn' : 'bad';
    return `<div class="stat health ${tone}" title="${esc(t('healthTip'))}">
      <div class="hrow"><span>${esc(t('health'))}</span><b>${h.score}%</b>${delta ? `<em class="delta ${delta > 0 ? 'up' : 'down'}" dir="ltr">${delta > 0 ? '+' : ''}${delta}</em>` : ''}</div>
      <div class="hbar"><i style="width:${h.score}%"></i></div>
      <div class="hparts">${esc(t('hParts', h.una, h.conf, h.countOk, h.withReq, h.wGot, h.wTot))}</div></div>`;
  }
  function celebrate() {
    toast(t('healthyMsg'));
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div'); box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
    const cols = ['#10426e', '#0090ba', '#ffa81f', '#84c4c7', '#2e9b5f'];
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('i');
      p.style.left = (Math.random() * 100) + 'vw'; p.style.background = cols[i % cols.length];
      p.style.animationDelay = (Math.random() * 0.35) + 's'; p.style.animationDuration = (1.4 + Math.random() * 0.9) + 's';
      p.style.setProperty('--dx', ((Math.random() - 0.5) * 160) + 'px'); p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      box.appendChild(p);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 2600);
  }
  /** Sections still waiting for a member, as pieces to drag into the timetable. */
  function benchHtml(secs, assign) {
    if (!S.built) return '';
    const wait = Object.values(secs).filter((s) => s.cat === 'required' && !assign[s.key]).sort((a, b) => (a.hour == null ? 99 : a.hour) - (b.hour == null ? 99 : b.hour) || a.key.localeCompare(b.key));
    return `<div class="bench no-print" data-bench="1"><div class="bench-head"><b>${esc(t('bench'))}</b><span>${esc(wait.length ? t('benchHint') : t('benchEmpty'))}</span></div>
      <div class="bench-items" dir="ltr">${wait.map((s) => cellHtml(s, { bench: true })).join('')}</div></div>`;
  }
  /** Row of course chips: clicking one highlights all its sections and lists who teaches them. */
  function courseBar(secs, assign) {
    const codes = [...new Set(Object.values(secs).filter((s) => assign[s.key] || s.cat === 'required').map((s) => s.course))].sort();
    if (!codes.length) return '';
    const f = ui.focusCourse && codes.includes(ui.focusCourse) ? ui.focusCourse : null;
    if (!f) ui.focusCourse = null;
    const chips = codes.map((c) => `<button type="button" class="cchip ${f === c ? 'on' : ''}" data-act="focusCourse" data-code="${esc(c)}" aria-pressed="${f === c}"><span class="sw" style="background:${colour(c)}"></span>${esc(c)}</button>`).join('');
    let sum = '';
    if (f) {
      const mine = Object.values(secs).filter((s) => s.course === f && (assign[s.key] || s.cat === 'required'));
      const by = {}; let un = 0;
      mine.forEach((s) => { const a = assign[s.key]; if (!a) { un++; return; } (by[a] = by[a] || []).push(s.hour == null ? t('noTime') : hl(s.hour)); });
      const order = S.members.map((m) => m.id).concat(['PT', 'HOLD']).filter((id) => by[id]);
      sum = `<p class="csum"><b>${esc(t('focusSum', f, mine.length))}</b>${order.map((id) => `<span dir="ltr"><b>${esc(nameOf(id))}</b> ${esc(by[id].join(', '))}</span>`).join('')}${un ? `<span class="un">${esc(t('focusUn', un))}</span>` : ''}<button type="button" class="link" data-act="focusCourse" data-code="">${esc(t('focusClear'))}</button></p>`;
    }
    return `<div class="cbar no-print"><span class="lbl">${esc(t('focusLbl'))}</span><div class="cchips" dir="ltr">${chips}</div>${sum}</div>`;
  }
  /** Small card with what the site knows about a member (shown on the name). */
  function cardHtml(mid) {
    const m = memberById(mid); if (!m) return '';
    const { secs, assign, ev } = snapshot();
    const p = ev.per[mid] || {};
    const keys = Object.keys(assign).filter((k) => assign[k] === mid);
    const mine = new Set(keys.map((k) => secs[k].course));
    const cur = currentFor()[mid] || [];
    const row = (label, html) => `<div class="cr"><span class="cl">${esc(label)}</span><span class="cv">${html}</span></div>`;
    const prefs = (m.prefs || []).map((c) => (c ? E.normCourse(c) : ''));
    const prefsHtml = prefs.some(Boolean) ? `<span dir="ltr">${prefs.map((c, i) => c ? `${i + 1}. ${esc(c)}${mine.has(c) ? ' <b class="ok">✓</b>' : ''}` : '').filter(Boolean).join('&nbsp;&nbsp; ')}</span>` : '—';
    const lim = [];
    if (m.first > 8) lim.push(t('lcFirst', hl(m.first)));
    if (m.last < 18) lim.push(t('lcLast', hl(m.last)));
    if ((m.allowed || []).length) lim.push(t('lcOnly', m.allowed.join(', ')));
    if ((m.never || []).length) lim.push(t('lcNever', m.never.join(', ')));
    if (m.keepCurrent === false) lim.push(t('lcNoKeep'));
    const grad = S.msc.filter((x) => x.member === mid).map((x) => `${x.program || 'MSc'} · ${t('gradHours', Number(x.hours === '' || x.hours == null ? 3 : x.hours))}`);
    const req = m.required === '' || m.required == null ? '–' : m.required;
    return `<h4 dir="ltr">${esc(m.name)}</h4>
      <p class="cnow">${esc(t('cardNow', p.counted || 0, req, p.preps || 0, p.total || 0))}</p>
      ${row(t('cardCur'), cur.length ? `<span dir="ltr">${esc(cur.map((x) => `${x.course}${x.hour ? ' ' + hl(x.hour) : ''}`).join(', '))}</span>` : '—')}
      ${row(t('prefs'), prefsHtml)}
      ${row(t('prefTime'), esc(t(!m.prefTime || m.prefTime === 'any' ? 'anyTime' : m.prefTime)))}
      ${row(t('comment'), m.comment ? `<span dir="auto">${esc(m.comment)}</span>` : esc(t('noComment')))}
      ${row(t('cardLimits'), lim.length ? esc(lim.join(' · ')) : esc(t('noLimits')))}
      ${(Number(m.coop) || Number(m.senior)) ? row(t('cardHours'), esc(`COOP ${Number(m.coop) || 0} · Senior ${Number(m.senior) || 0}`)) : ''}
      ${grad.length ? row('MSc / PhD', esc(grad.join(' · '))) : ''}`;
  }
  function cardEl() { let c = document.getElementById('mcard'); if (!c) { c = document.createElement('div'); c.id = 'mcard'; c.className = 'mcard'; c.hidden = true; c.setAttribute('role', 'tooltip'); document.body.appendChild(c); } return c; }
  function showCard(el) {
    const c = cardEl(); const mid = el.dataset.card;
    if (!c.hidden && c.dataset.mid === mid) return;
    c.innerHTML = cardHtml(mid); c.dataset.mid = mid; c.dir = S.lang === 'ar' ? 'rtl' : 'ltr'; c.hidden = false;
    const r = el.getBoundingClientRect(); const w = c.offsetWidth, h = c.offsetHeight;
    let left = r.right + 12, top = r.top - 6;
    if (left + w > window.innerWidth - 10) { left = Math.max(10, Math.min(r.left, window.innerWidth - w - 10)); top = r.bottom + 8; }
    top = Math.max(10, Math.min(top, window.innerHeight - h - 10));
    c.style.left = left + 'px'; c.style.top = top + 'px';
  }
  function hideCard() { const c = document.getElementById('mcard'); if (c) { c.hidden = true; c.dataset.mid = ''; } }
  // ---------------- saved places: where each section was at the last save / open of the project ----------------
  function setRef() {
    const { secs, assign } = snapshot();
    S.ref = {}; Object.keys(secs).forEach((k) => { S.ref[k] = [assign[k] || '', S.proposed[k] != null ? S.proposed[k] : null]; });
  }
  function refChanged(secs, assign) {
    if (!S.ref) return [];
    return Object.keys(secs).filter((k) => S.ref[k] && ((assign[k] || '') !== S.ref[k][0] || (S.proposed[k] != null ? S.proposed[k] : null) !== S.ref[k][1]));
  }
  function refMoved(k) { const { secs, assign } = snapshot(); return refChanged({ [k]: secs[k] }, assign).length > 0; }
  function restoreRef(k) {
    const r = S.ref && S.ref[k]; if (!r) return;
    const [mid, hour] = r;
    if (hour == null) { delete S.proposed[k]; delete S.autoTime[k]; } else if (S.proposed[k] !== hour) { S.proposed[k] = hour; delete S.autoTime[k]; }
    if (mid) putSection(k, mid);
    else { delete S.assign[k]; delete S.pins[k]; if (S.secCat[k] === 'parttime' || S.secCat[k] === 'onhold') delete S.secCat[k]; }
  }

  // ---------------- drag and drop: change the instructor at the same hour ----------------
  /** Can section k move from `from` to `to` (swapping with section `swap` of `to`, if given)? → {ok, warn, why} */
  function dropCheck(k, from, to, swap) {
    const { secs, assign, ev } = snapshot();
    const s = secs[k]; if (!s || from === to) return { ok: false, why: '' };
    const j = swap ? secs[swap] : null;
    const after = Object.assign({}, assign); after[k] = to; if (j) after[swap] = from;
    const checkMember = (mid, inKey, outKey) => {
      const m = memberById(mid); if (!m) return null; // part-timers / ON-Hold: no member rules
      const x = secs[inKey];
      if (!E.inWindow(m, x.hour)) return { why: t('whyWindow', m.name) };
      const never = (m.never || []).map(E.normCourse).filter(Boolean);
      if (x.noTime ? never.some((c) => c === x.course || c === x.prefix) : !E.memberAllows(m, x)) return { why: t('whyCourse', m.name, x.course) };
      const mine = Object.keys(after).filter((kk) => after[kk] === mid && kk !== inKey);
      for (const kk of mine) { if (secs[kk].slots.some((sl) => x.slots.includes(sl))) return { why: t('whyClash', m.name, kk) }; }
      const before = (ev.per[mid] || {}).counted || 0;
      const now = before + (x.counts ? 1 : 0) - (outKey && secs[outKey].counts ? 1 : 0);
      const warns = [];
      // more sections than required is allowed for now (e.g. give one, then take one back); it shows in orange and red until fixed
      if (m.required !== '' && m.required != null && now > Number(m.required) && now > before) warns.push(t('warnCount', m.name, now, Number(m.required)));
      if (x.hour != null && ((m.prefTime === 'am' && x.hour >= 13) || (m.prefTime === 'pm' && x.hour < 13))) warns.push(t('warnTime', m.name));
      return warns.length ? { warn: warns.join(' — '), over: now > Number(m.required || 99) } : null;
    };
    const a = checkMember(to, k, swap), b = j ? checkMember(from, swap, k) : null;
    if (a && a.why) return { ok: false, why: a.why };
    if (b && b.why) return { ok: false, why: b.why };
    return { ok: true, warn: [a && a.warn, b && b.warn].filter(Boolean).join(' — '), over: !!((a && a.over) || (b && b.over)) };
  }
  let pend = null, drag = null;
  const dragTip = () => { let el = document.getElementById('dragTip'); if (!el) { el = document.createElement('div'); el.id = 'dragTip'; el.className = 'drag-tip'; el.hidden = true; document.body.appendChild(el); } return el; };
  function startDrag(x, y) {
    if (!pend) return;
    closePop(); hideCard();
    drag = Object.assign({}, pend, { over: null, res: {} });
    if (pend.timer) clearTimeout(pend.timer);
    pend = null;
    const src = drag.cell; const r = src.getBoundingClientRect();
    const g = src.cloneNode(true); g.classList.add('drag-ghost'); g.classList.remove('flash', 'hit', 'dim'); g.style.width = r.width + 'px';
    document.body.appendChild(g); drag.ghost = g; drag.dx = x - r.left; drag.dy = y - r.top;
    src.classList.add('drag-src'); document.body.classList.add('dragging');
    const table = main.querySelector('table.tt'); table.classList.add('dragging');
    // mark every possible target in the same hour column
    const { secs: sx0, assign: as0 } = snapshot(); const sec = sx0[drag.key];
    let best = null, bestScore = 0;
    table.querySelectorAll(`td.slot[data-h="${drag.h}"]`).forEach((td) => {
      const to = td.dataset.mid; if (to === drag.from) return;
      const res = dropCheck(drag.key, drag.from, to, null);
      drag.res['m|' + to] = res; td.classList.add(res.ok ? (res.warn ? 'dz-warn' : 'dz-ok') : 'dz-no');
      const m = memberById(to);
      if (res.ok && !res.over && m) { // how good a home this member is for the section
        const why = [];
        if ((m.prefs || []).filter(Boolean).map(E.normCourse).includes(sec.course)) why.push(t('bestWish'));
        if (Object.keys(as0).some((kk) => as0[kk] === to && sx0[kk].course === sec.course)) why.push(t('bestSame'));
        if (sec.hour != null && ((m.prefTime === 'am' && sec.hour < 12) || (m.prefTime === 'pm' && sec.hour > 12))) why.push(t('bestTime'));
        const sc = why.length * 2 - (res.warn ? 1 : 0);
        if (sc > bestScore) { bestScore = sc; best = { td, why }; }
      }
      td.querySelectorAll('.cell[data-key]').forEach((c) => {
        const rs = dropCheck(drag.key, drag.from, to, c.dataset.key);
        drag.res['s|' + c.dataset.key] = Object.assign({ to }, rs); c.classList.add(rs.ok ? 'sw-ok' : 'sw-no');
      });
    });
    if (best) { best.td.classList.add('dz-best'); drag.res['m|' + best.td.dataset.mid].best = best.why; }
    const bench = main.querySelector('.bench'); if (bench && drag.from) bench.classList.add('dz-ok');
    moveDrag(x, y); autoScroll();
  }
  function dropTarget(x, y) {
    const el = document.elementFromPoint(x, y); if (!el || !el.closest) return null;
    const bench = el.closest('.bench');
    if (bench) return drag.from ? { el: bench, bench: true, to: '', res: { ok: true } } : null;
    const td = el.closest('table.tt td.slot'); if (!td) return null;
    if (td.dataset.h !== drag.h) return { none: true, why: t('whyHour') };
    if (td.dataset.mid === drag.from) return null;
    const c = el.closest('.cell[data-key]');
    if (c && c.dataset.key !== drag.key) return { el: c, td, swap: c.dataset.key, to: td.dataset.mid, res: drag.res['s|' + c.dataset.key] };
    return { el: td, td, to: td.dataset.mid, res: drag.res['m|' + td.dataset.mid] };
  }
  function moveDrag(x, y) {
    drag.x = x; drag.y = y;
    drag.ghost.style.left = (x - drag.dx) + 'px'; drag.ghost.style.top = (y - drag.dy) + 'px';
    const tg = dropTarget(x, y);
    if (drag.over && (!tg || tg.el !== drag.over)) drag.over.classList.remove('dz-over');
    drag.over = tg && tg.el ? tg.el : null; if (drag.over) drag.over.classList.add('dz-over');
    const tip = dragTip();
    let text = '', cls = '';
    if (tg && tg.none) { text = tg.why; cls = 'no'; }
    else if (tg && tg.res) {
      if (!tg.res.ok) { text = tg.res.why || t('whyHour'); cls = 'no'; }
      else {
        const fromName = drag.from ? nameOf(drag.from) : t('bench');
        text = tg.bench ? t('dropBench', drag.key) : tg.swap ? t('dropSwap', drag.key, tg.swap, fromName, nameOf(tg.to)) : t('dropMove', drag.key, nameOf(tg.to));
        if (tg.res.warn) { text += ' — ' + tg.res.warn; cls = 'warn'; } else cls = 'ok';
        if (tg.res.best && tg.res.best.length) { text = '★ ' + text + ' — ' + t('bestIs', tg.res.best.join(t('sep'))); cls += ' best'; }
      }
    }
    tip.hidden = !text; tip.textContent = text; tip.className = 'drag-tip ' + cls; tip.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
    const tw = tip.offsetWidth || 200;
    tip.style.left = Math.max(8, Math.min(x + 16, window.innerWidth - tw - 8)) + 'px'; tip.style.top = Math.min(y + 18, window.innerHeight - 50) + 'px';
  }
  function autoScroll() {
    if (!drag) return;
    const edge = 70, y = drag.y;
    let dy = 0; if (y < edge) dy = -Math.ceil((edge - y) / 5); else if (y > window.innerHeight - edge) dy = Math.ceil((y - (window.innerHeight - edge)) / 5);
    if (dy) { window.scrollBy(0, dy); moveDrag(drag.x, drag.y); }
    requestAnimationFrame(autoScroll);
  }
  function endDrag(x, y) {
    const d = drag; const tg = d ? dropTarget(x, y) : null;
    cleanDrag();
    if (!d || !tg || !tg.res || !tg.res.ok) { if (tg && tg.res && !tg.res.ok && tg.res.why) toast(tg.res.why); return; }
    if (tg.bench) {
      remember('uBench', d.key);
      toBench(d.key, d.from);
      toast(t('benchDone', d.key));
    } else if (tg.swap) {
      remember('uSwap', d.key, tg.swap);
      putSection(d.key, tg.to);
      if (d.from) putSection(tg.swap, d.from); else toBench(tg.swap, tg.to);
      toast(t('swapDone', d.key, tg.swap));
    } else {
      remember('uDrag', d.key, nameOf(tg.to));
      putSection(d.key, tg.to);
      toast(t('dropDone', d.key, nameOf(tg.to)));
    }
    persist(); render();
    const keys = [d.key].concat(tg.swap ? [tg.swap] : []);
    keys.forEach((k) => main.querySelectorAll(`.cell[data-key="${CSS.escape(k)}"]`).forEach((e) => e.classList.add('flash')));
    setTimeout(() => main.querySelectorAll('.flash').forEach((e) => e.classList.remove('flash')), 2600);
  }
  /** Take a section off its member (or part-timers / ON-Hold) and leave it waiting on the bench. */
  function toBench(k, from) {
    delete S.assign[k]; delete S.pins[k]; S.secCat[k] = 'required';
    if (from && memberById(from)) S.bans[`${k}|${from}`] = 1;
  }
  function cleanDrag() {
    if (!drag) return;
    if (drag.ghost) drag.ghost.remove();
    if (drag.cell) drag.cell.classList.remove('drag-src');
    document.body.classList.remove('dragging');
    main.querySelectorAll('.dz-ok, .dz-warn, .dz-no, .dz-over, .dz-best, .sw-ok, .sw-no, table.tt.dragging').forEach((e) => e.classList.remove('dz-ok', 'dz-warn', 'dz-no', 'dz-over', 'dz-best', 'sw-ok', 'sw-no', 'dragging'));
    dragTip().hidden = true;
    drag = null;
    ui.noClick = true; setTimeout(() => { ui.noClick = false; }, 60);
  }
  main.addEventListener('pointerdown', (ev) => {
    if (S.step !== 4 || ui.view || ev.button > 0 || drag) return;
    const cell = ev.target.closest('.cell[data-key]'); if (!cell) return;
    const td = cell.closest('table.tt td.slot'), bench = cell.closest('.bench');
    if (!td && !bench) return;
    let h = td ? td.dataset.h : null;
    if (bench) { const sx = snapshot().secs[cell.dataset.key]; if (!sx) return; h = sx.hour == null ? 'nt' : String(sx.hour); }
    pend = { key: cell.dataset.key, from: td ? td.dataset.mid : '', h, x: ev.clientX, y: ev.clientY, type: ev.pointerType, cell };
    if (ev.pointerType === 'touch') { const px = ev.clientX, py = ev.clientY; pend.timer = setTimeout(() => startDrag(px, py), 350); }
  });
  document.addEventListener('pointermove', (ev) => {
    if (pend && !drag) {
      const dist = Math.hypot(ev.clientX - pend.x, ev.clientY - pend.y);
      if (pend.type === 'touch') { if (dist > 10) { clearTimeout(pend.timer); pend = null; } }
      else if (dist > 6) startDrag(ev.clientX, ev.clientY);
    }
    if (drag) { ev.preventDefault(); moveDrag(ev.clientX, ev.clientY); }
  });
  document.addEventListener('pointerup', (ev) => { if (pend && pend.timer) clearTimeout(pend.timer); pend = null; if (drag) endDrag(ev.clientX, ev.clientY); });
  document.addEventListener('pointercancel', () => { if (pend && pend.timer) clearTimeout(pend.timer); pend = null; cleanDrag(); });
  document.addEventListener('touchmove', (ev) => { if (drag) ev.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', (ev) => { if (drag || (pend && pend.type === 'touch')) ev.preventDefault(); });

  /** Scroll to a member's cells (or the member's row) and make them flash. */
  function goTo(mid, keys) {
    const row = main.querySelector(`tr.mem[data-mid="${CSS.escape(mid || '')}"]`);
    if (!row) return;
    let els = [];
    keys.forEach((k) => row.querySelectorAll(`.cell[data-key="${CSS.escape(k)}"]`).forEach((e) => els.push(e)));
    if (!els.length) els = [row.querySelector('td.name'), row.querySelector('td.cnt')].filter(Boolean);
    if (!els.length) return;
    els[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    els.forEach((e) => { e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); });
    clearTimeout(goTo.t); goTo.t = setTimeout(() => main.querySelectorAll('.flash').forEach((e) => e.classList.remove('flash')), 2700);
  }
  function issueText(i) {
    if (i.type === 'unassigned') return t('issue').unassigned(i.a);
    if (i.type === 'count') return t('issue').count(nameOf(i.member), i.have, i.need);
    if (i.type === 'clash') return t('issue').clash(nameOf(i.member), i.a, i.b, `${E.DAY_NAMES[i.day]} ${hl(i.hour)}`);
    if (i.type === 'window') return t('issue').window(nameOf(i.member), i.a);
    if (i.type === 'notime') return t('issue').notime(nameOf(i.member), i.a);
    return i.type;
  }
  // popover for a grid cell
  function openPop(td) {
    const mid = td.dataset.mid, hRaw = td.dataset.h, h = hRaw === 'nt' ? null : +hRaw;
    const { secs, assign } = snapshot();
    const here = Object.keys(assign).filter((k) => assign[k] === mid && (hRaw === 'nt' ? secs[k].hour == null : secs[k].hour === h));
    const isPseudo = mid === 'PT' || mid === 'HOLD';
    const m = memberById(mid);
    let html = `<h4>${esc(nameOf(mid))} · ${hRaw === 'nt' ? esc(t('noTime')) : hl(h)}</h4>`;
    here.forEach((k) => {
      const s = secs[k];
      const notes = (R.notes[k] || []).map((n) => n.text);
      html += `<div style="border-top:1px solid var(--line-2);padding-top:8px;margin-top:8px"><h4><span class="sw" style="background:${colour(s.course)}"></span>${esc(k)}${s.comp ? ` + ${esc(s.comp)}` : ''}</h4>
        <div class="meta">${esc(s.name)}<br>${esc(E.describeMeetings(R.off, k))}${s.proposed ? `<br><b style="color:var(--orange)">${esc(t('proposedAt', hl(s.hour)))}</b> (${esc(t('official'))}: ${s.officialHour != null ? hl(s.officialHour) : t('noTime')})${S.autoTime[k] ? ` — ${esc(t('autoTime'))}` : ''}` : ''}</div>
        ${notes.length ? `<div class="note">${notes.map(esc).join('<br>')}</div>` : ''}
        ${!isPseudo ? `<button class="opt" type="button" data-act="rmSec" data-key="${k}" data-mid="${mid}">✕ ${esc(t('removeFrom', nameOf(mid)))}</button>` : `<button class="opt" type="button" data-act="toMembers" data-key="${k}">↩ ${esc(t('toMembers'))}</button>`}
        ${!s.noTime ? `<button class="opt" type="button" data-act="timePick" data-key="${k}">🕒 ${esc(t('proposeTime'))}</button>` : ''}
        ${s.proposed && !S.autoTime[k] && s.officialHour != null ? `<button class="opt" type="button" data-act="timeReset" data-key="${k}">↺ ${esc(t('restoreTime'))}</button>` : ''}
        ${refMoved(k) ? `<button class="opt" type="button" data-act="refBack" data-key="${k}">↺ ${esc(t('refBack', S.ref[k][0] ? nameOf(S.ref[k][0]) : t('bench')))}</button>` : ''}
        ${mid !== 'HOLD' ? `<button class="opt" type="button" data-act="toHold" data-key="${k}">⏸ ${esc(t('toHold'))}</button>` : ''}
        ${mid !== 'PT' ? `<button class="opt" type="button" data-act="toPart" data-key="${k}">👥 ${esc(t('toPart'))}</button>` : ''}
        <div id="tp-${k}"></div></div>`;
    });
    // what can go here
    const cands = Object.values(secs).filter((s) => {
      if (assign[s.key] === mid) return false;
      if (hRaw === 'nt') return s.hour == null;
      return s.hour === h;
    });
    const opt = (s) => {
      const a = assign[s.key];
      const note = a ? t('fromMember', nameOf(a)) : s.cat === 'none' || s.cat === 'asneeded' ? (s.cat === 'none' ? t('notOurs') : L().cats.asneeded) : '';
      const allowed = isPseudo || !m || E.memberAllows(m, s) || s.noTime;
      return `<button class="opt" type="button" data-act="put" data-key="${s.key}" data-mid="${mid}"><span class="sw" style="background:${colour(s.course)}"></span><span class="t">${esc(s.key)}</span><small>${esc(note)}${allowed ? '' : ' ⚠'}</small></button>`;
    };
    const okFor = (s) => (isPseudo || !m || E.memberAllows(m, s) ? 0 : 1);
    cands.sort((a, b) => okFor(a) - okFor(b));
    const free = cands.filter((s) => !assign[s.key]);
    const taken = cands.filter((s) => assign[s.key]);
    html += `<div class="grp">${esc(t('putHere'))}</div>${free.length || taken.length ? free.map(opt).join('') + taken.map(opt).join('') : `<p class="muted small">${esc(t('nothingHere'))}</p>`}`;
    const pop = $('#pop');
    pop.innerHTML = html; pop.hidden = false;
    const r = td.getBoundingClientRect();
    const w = 320, ph = Math.min(pop.scrollHeight, window.innerHeight * 0.7);
    let left = Math.min(window.innerWidth - w - 10, Math.max(10, r.left));
    let top = r.bottom + 6; if (top + ph > window.innerHeight - 10) top = Math.max(10, r.top - ph - 6);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    pop.dataset.mid = mid; pop.dataset.h = hRaw;
  }
  function closePop() { const p = $('#pop'); p.hidden = true; p.innerHTML = ''; }

  // ---- step 5: export ----
  function viewExport() {
    const { ev } = snapshot();
    const n = ev.issues.length;
    return `<div class="page-head"><div><h1>${esc(t('expTitle'))}</h1><p class="${n ? '' : 'ok-text'}">${esc(n ? t('remaining', n) : t('ready'))}</p></div></div>
    <div class="exp">
      <div class="panel"><h2>${esc(t('expExcel'))}</h2><p class="sub" style="margin:0">${esc(t('expExcelText'))}</p><ul>${L().expSheets.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><p class="tip">${esc(t('howToPaste'))}</p><button class="btn primary big" type="button" data-act="excel">${esc(t('expExcelBtn'))}</button></div>
      <div class="panel"><h2>${esc(t('expProj'))}</h2><p class="sub" style="margin:0">${esc(t('expProjText'))}</p><button class="btn big" type="button" data-act="saveProject">${esc(t('expProjBtn'))}</button>
        <hr style="border:0;border-top:1px solid var(--line-2);width:100%;margin:8px 0">
        <h2>${esc(t('nextTerm'))}</h2><p class="sub" style="margin:0">${esc(t('nextTermText'))}</p><button class="btn" type="button" data-act="nextTerm">${esc(t('nextTerm'))}</button></div>
    </div>`;
  }

  // ---------------- actions ----------------
  async function addFile(kind, file) {
    if (!file) return;
    const buf = await file.arrayBuffer();
    S.files[kind] = { name: file.name, size: file.size, b64: bufToB64(buf), sheet: null };
    if (kind === 'current') S.currentMap = {};
    if (kind === 'prefs') S.prefsMap = {};
    if (kind === 'current' || kind === 'prefs') Object.keys(S.mapManual).forEach((k) => { if (k.startsWith(kind + '|')) delete S.mapManual[k]; });
    main.querySelectorAll('[data-drop]').forEach((d) => { if (d.dataset.drop === kind) d.textContent = t('reading'); });
    clearUndo();
    await readFile(kind); parseAll();
    if (kind === 'faculty' && R.fac) { S.hoursSource = R.fac.hasCoop || R.fac.hasSenior ? 'file' : 'manual'; applyFaculty(); parseAll(); }
    S.built = false; persist(); render();
  }
  function startProject() {
    const side = ui.pickSide || S.side;
    const term = ($('#termIn') && $('#termIn').value.trim()) || '';
    if (!side) return;
    if (!term) { $('#termIn').focus(); toast(t('termLabel')); return; }
    if (S.side && S.side !== side) {
      const keepLang = S.lang; S = blank(); S.lang = keepLang; clearUndo(); R = { wb: {}, sheets: {}, err: {}, fac: null, notes: {}, curScore: {}, prefScore: {} };
    }
    S.side = side; S.term = term; S.step = 2; ui.termDraft = null;
    persist(); render(); window.scrollTo(0, 0);
  }
  async function downloadTemplate() {
    const wb = new window.ExcelJS.Workbook();
    const ws = wb.addWorksheet('Faculty');
    const heads = [['No', 6], ['Full name (with title)', 38], ['Sections', 11], ['COOP (hrs)', 12], ['Senior Project (hrs)', 20], ['Notes', 40]];
    heads.forEach(([h, w], i) => { const c = ws.getCell(1, i + 1); c.value = h; ws.getColumn(i + 1).width = w; c.font = { name: 'Tahoma', bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
    ws.getRow(1).height = 24;
    ws.getCell(1, 2).note = 'One member per row, e.g. Dr. First Last. Sections = number of sections required. COOP and Senior hours are optional.';
    for (let r = 2; r <= 31; r++) for (let c = 1; c <= 6; c++) { const cell = ws.getCell(r, c); if (c === 1) cell.value = r - 1; cell.font = { name: 'Tahoma' }; cell.border = { top: { style: 'thin', color: { argb: 'FFBFBFBF' } }, bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } }, left: { style: 'thin', color: { argb: 'FFBFBFBF' } }, right: { style: 'thin', color: { argb: 'FFBFBFBF' } } }; if (c === 1 || c >= 3 && c <= 5) cell.alignment = { horizontal: 'center' }; }
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    const buf = await wb.xlsx.writeBuffer();
    download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), S.side ? `faculty list ${fileBase()}.xlsx` : "faculty list.xlsx");
  }
  function projectData() { return Object.assign({}, S, { savedAt: new Date().toISOString() }); }
  function saveProject() {
    if (S.built && R.off) setRef();
    const blob = new Blob([JSON.stringify(projectData())], { type: 'application/json' });
    download(blob, `${fileBase()} - timetable project.json`);
    persist(); if (S.step === 4) render();
    toast(t('saved'));
  }
  async function openProject(file) {
    try {
      const obj = JSON.parse(await file.text());
      if (!obj || obj.app !== 'isp-timetable') throw new Error('x');
      const lang = S.lang;
      S = Object.assign(blank(), obj); S.lang = obj.lang || lang; clearUndo();
      R = { wb: {}, sheets: {}, err: {}, fac: null, notes: {}, curScore: {}, prefScore: {} };
      await reparseAll();
      if (S.built && R.off) setRef();
      persist(); render(); toast(t('loaded'));
    } catch (e) { toast(t('loadFail')); }
  }
  async function exportExcel() {
    toast(t('exporting'));
    const { secs, assign, ev } = snapshot();
    const cur = currentFor();
    const memberNotes = {};
    S.members.forEach((m) => {
      const lines = [];
      if (cur[m.id] && cur[m.id].length) lines.push(`Current term: ${cur[m.id].map((x) => `${x.course}${x.hour ? ' ' + hl(x.hour) : ''}`).join(', ')}`);
      const pr = (m.prefs || []).filter(Boolean); if (pr.length) lines.push(`Preferences: ${pr.join(', ')}`);
      if (m.prefTime && m.prefTime !== 'any') lines.push(`Preferred time: ${m.prefTime === 'am' ? 'Morning' : 'Afternoon'}`);
      if (m.comment) lines.push(`Comment: ${m.comment}`);
      memberNotes[m.id] = lines;
    });
    const members = S.members.concat([{ id: 'PT', name: 'Part-timers', pseudo: true }, { id: 'HOLD', name: 'ON-Hold', pseudo: true }]);
    const wb = await X.build(window.ExcelJS, { side: S.side, term: S.term, members, secs, assign, off: R.off, notes: R.notes, msc: S.msc, decisions: S.decisions, officialWorkbook: R.wb.official, issues: ev.issues, per: ev.per, memberNotes, generated: new Date() });
    const buf = await X.toBuffer(wb, window.JSZip);
    download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileBase()} timetable.xlsx`);
  }
  function nextTerm() {
    const { secs, assign } = snapshot();
    const base = {};
    Object.entries(assign).forEach(([k, v]) => { if (memberById(v)) (base[v] = base[v] || []).push({ course: secs[k].course, hour: secs[k].hour }); });
    const keep = { side: S.side, lang: S.lang, members: S.members.map((m) => Object.assign({}, m, { prefs: ['', '', ''], comment: '', fromPrefs: false })), courses: S.courses, courseTouched: S.courseTouched };
    S = Object.assign(blank(), keep, { baseline: base, step: 1 }); clearUndo();
    ui.pickSide = S.side; ui.termDraft = '';
    R = { wb: {}, sheets: {}, err: {}, fac: null, notes: {}, curScore: {}, prefScore: {} };
    persist(); render(); window.scrollTo(0, 0);
  }
  function putSection(k, mid) {
    const { secs } = snapshot();
    const s = secs[k]; if (!s) return;
    if (mid === 'PT') { S.secCat[k] = 'parttime'; delete S.pins[k]; delete S.assign[k]; return; }
    if (mid === 'HOLD') { S.secCat[k] = 'onhold'; delete S.pins[k]; delete S.assign[k]; return; }
    const cat = (S.courses[s.course] || {}).cat;
    if (S.secCat[k] || (cat !== 'required' && cat !== 'asneeded')) S.secCat[k] = 'required';
    S.assign[k] = mid; S.pins[k] = mid; delete S.bans[`${k}|${mid}`];
  }

  document.addEventListener('click', async (ev) => {
    if (ui.noClick) { ui.noClick = false; return; }
    const el = ev.target.closest('[data-act]');
    const pop = $('#pop');
    if (!el) { if (!pop.hidden && !ev.target.closest('#pop')) closePop(); if (!ev.target.closest('#mcard')) hideCard(); return; }
    const act = el.dataset.act, d = el.dataset;
    if (act !== 'cell' && act !== 'timePick' && !el.closest('#pop')) closePop();
    if (act !== 'card') hideCard();
    switch (act) {
      case 'home': ev.preventDefault(); ui.view = null; S.step = 1; render(); window.scrollTo(0, 0); break;
      case 'fmtClose': ui.view = null; render(); window.scrollTo(0, 0); break;
      case 'fmtPrint': document.body.classList.add('print-fmt'); window.print(); break;
      case 'fmtExcel': try { await fmtExcel(); } catch (e) { console.error(e); toast('Excel: ' + e.message); } break;
      case 'go': { const n = +d.step; if (n >= 1 && n <= 5 && canReach(n)) { S.step = n; persist(); render(); window.scrollTo(0, 0); main.focus({ preventScroll: true }); } break; }
      case 'pick': ui.pickSide = d.side; ui.termDraft = $('#termIn') ? $('#termIn').value : ui.termDraft; render(); break;
      case 'start': startProject(); break;
      case 'openProject': $('#projectInput').click(); break;
      case 'resumeAuto': { const saved = S0(); if (saved) { S = Object.assign(blank(), saved); clearUndo(); await reparseAll(); render(); } break; }
      case 'rmFile': clearUndo(); delete S.files[d.kind]; if (d.kind === 'current') S.currentMap = {}; if (d.kind === 'prefs') { S.prefsMap = {}; S.members.forEach((m) => { if (m.fromPrefs) { m.prefs = ['', '', '']; m.comment = ''; m.fromPrefs = false; } }); } await readFile(d.kind); parseAll(); S.built = false; persist(); render(); break;
      case 'tab': ui.tab = d.tab; render(); break;
      case 'mOpen': ui.open[d.id] = !ui.open[d.id]; render(); break;
      case 'mUp': case 'mDown': { const i = S.members.findIndex((m) => m.id === d.id); const j = act === 'mUp' ? i - 1 : i + 1; if (j >= 0 && j < S.members.length) { [S.members[i], S.members[j]] = [S.members[j], S.members[i]]; persist(); render(); } break; }
      case 'mDel': { const m = memberById(d.id); if (m && confirm(t('confirmDel', m.name))) { S.members = S.members.filter((x) => x.id !== d.id); Object.keys(S.assign).forEach((k) => { if (S.assign[k] === d.id) delete S.assign[k]; }); Object.keys(S.pins).forEach((k) => { if (S.pins[k] === d.id) delete S.pins[k]; }); Object.keys(S.currentMap).forEach((k) => { if (S.currentMap[k] === d.id) S.currentMap[k] = ''; }); Object.keys(S.prefsMap).forEach((k) => { if (S.prefsMap[k] === d.id) S.prefsMap[k] = ''; }); delete S.decisions[d.id]; persist(); render(); } break; }
      case 'mAdd': { const nm = newMember(t('newMemberName')); nm.required = 4; S.members.push(nm); persist(); render(); setTimeout(() => { const ins = main.querySelectorAll('.fac-nm'); const last = ins[ins.length - 1]; if (last) { last.focus(); last.select(); } }, 0); break; }
      case 'chipRm': { const m = memberById(d.id); m[d.field] = (m[d.field] || []).filter((v) => v !== d.val); persist(); render(); break; }
      case 'mscAdd': S.msc.push({ id: uid(), member: '', program: 'MSc', hours: 3 }); persist(); render(); break;
      case 'mscDel': S.msc = S.msc.filter((x) => x.id !== d.id); persist(); render(); break;
      case 'rebuild': remember('uRebuild'); build(true); break;
      case 'print': window.print(); break;
      case 'undo': undo(); break;
      case 'howto': try { localStorage.setItem('isp-howto', d.v); } catch (e) { /* storage blocked */ } render(); break;
      case 'refBack': { remember('uRef', d.key); restoreRef(d.key); closePop(); persist(); render(); toast(t('refDone', d.key)); break; }
      case 'refAll': { const { secs, assign } = snapshot(); const ks = refChanged(secs, assign); if (!ks.length) break; remember('uRefAll'); ks.forEach(restoreRef); persist(); render(); toast(t('refAllDone', ks.length)); break; }
      case 'focusCourse': ui.focusCourse = d.code && ui.focusCourse !== d.code ? d.code : null; render(); break;
      case 'card': { const c = document.getElementById('mcard'); if (c && !c.hidden && c.dataset.mid === d.card) hideCard(); else showCard(el); break; }
      case 'goIssue': goTo(d.mid, (d.keys || '').split(',').filter(Boolean)); break;
      case 'cell': if (!pop.hidden && pop.dataset.mid === d.mid && pop.dataset.h === d.h) closePop(); else openPop(el); break;
      case 'put': remember('uPut', d.key, nameOf(d.mid)); putSection(d.key, d.mid); closePop(); persist(); render(); break;
      case 'rmSec': remember('uRm', d.key, nameOf(d.mid)); delete S.assign[d.key]; delete S.pins[d.key]; S.bans[`${d.key}|${d.mid}`] = 1; closePop(); persist(); render(); break;
      case 'toHold': remember('uMove', d.key, 'ON-Hold'); S.secCat[d.key] = 'onhold'; delete S.pins[d.key]; delete S.assign[d.key]; closePop(); persist(); render(); break;
      case 'toPart': remember('uMove', d.key, 'Part-timers'); S.secCat[d.key] = 'parttime'; delete S.pins[d.key]; delete S.assign[d.key]; closePop(); persist(); render(); break;
      case 'toMembers': remember('uToMembers', d.key); S.secCat[d.key] = 'required'; closePop(); persist(); render(); break;
      case 'timePick': {
        const box = document.getElementById('tp-' + d.key); if (!box) break;
        const { secs } = snapshot(); const s = secs[d.key];
        box.innerHTML = `<div class="hours" style="margin-top:6px">${E.HOURS.map((h) => `<button type="button" class="${s.hour === h ? 'on' : ''}" data-act="timeSet" data-key="${d.key}" data-h="${h}">${hl(h)}</button>`).join('')}</div>`;
        break;
      }
      case 'timeSet': { remember('uTime', d.key); const { secs } = snapshot(); const s = secs[d.key]; const h = +d.h; if (s.officialHour === h) delete S.proposed[d.key]; else S.proposed[d.key] = h; delete S.autoTime[d.key]; if (S.assign[d.key]) S.pins[d.key] = S.assign[d.key]; closePop(); persist(); render(); break; }
      case 'timeReset': remember('uTime', d.key); delete S.proposed[d.key]; delete S.autoTime[d.key]; closePop(); persist(); render(); break;
      case 'dec': {
        remember('uDec', nameOf(d.id));
        const cur = S.decisions[d.id];
        S.decisions[d.id] = cur === d.dec ? '' : d.dec;
        if (S.decisions[d.id] === 'reject') alternatives(d.id); else { delete ui.alts[d.id]; }
        persist(); render(); break;
      }
      case 'useAlt': {
        const a = ui.alts[d.id]; const o = a && a.opts[+d.i]; if (!o) break;
        remember('uAlt', nameOf(d.id));
        Object.keys(S.pins).forEach((k) => { if (S.pins[k] === d.id) delete S.pins[k]; });
        applyResult(o.res);
        S.forbidden[d.id] = a.forb.filter((x) => x !== sig(Object.keys(o.res.assign).filter((k) => o.res.assign[k] === d.id)));
        S.decisions[d.id] = ''; delete ui.alts[d.id]; persist(); render(); break;
      }
      case 'showAlt': alternatives(d.id); break;
      case 'closeAlt': remember('uDec', nameOf(d.id)); S.decisions[d.id] = 'review'; delete ui.alts[d.id]; persist(); render(); break;
      case 'excel': try { await exportExcel(); } catch (e) { console.error(e); toast('Excel: ' + e.message); } break;
      case 'saveProject': saveProject(); break;
      case 'facTemplate': downloadTemplate(); break;
      case 'nextTerm': nextTerm(); break;
      default: break;
    }
  });
  document.addEventListener('change', async (ev) => {
    const el = ev.target;
    if (el.id === 'projectInput') { if (el.files[0]) await openProject(el.files[0]); el.value = ''; return; }
    if (el.dataset.file === 'fmt') { await openFormat(el.files[0]); el.value = ''; return; }
    if (el.dataset.file) { await addFile(el.dataset.file, el.files[0]); return; }
    const c = el.dataset.chg; if (!c) return;
    const d = el.dataset;
    switch (c) {
      case 'sheet': S.files[d.kind].sheet = el.value; if (d.kind === 'current') S.currentMap = {}; if (d.kind === 'prefs') S.prefsMap = {}; R.err[d.kind] = null; parseAll(); if (d.kind === 'faculty' && R.fac) { applyFaculty(); parseAll(); } S.built = false; break;
      case 'map': (d.kind === 'current' ? S.currentMap : S.prefsMap)[d.name] = el.value; S.mapManual[d.kind + '|' + d.name] = true; if (d.kind === 'current') parseAll(); if (d.kind === 'prefs') applyPrefs(); if (d.kind === 'current') R.curScore[d.name] = 1; else R.prefScore[d.name] = 1; break;
      case 'mf': {
        const m = memberById(d.id); if (!m) break;
        if (d.field === 'keepCurrent') m.keepCurrent = el.checked;
        else if (['required', 'coop', 'senior'].includes(d.field)) m[d.field] = el.value === '' ? '' : Math.max(0, Math.round(Number(el.value)) || 0);
        else if (['first', 'last'].includes(d.field)) m[d.field] = Number(el.value);
        else if (d.field === 'prefTime') { m.prefTime = el.value; m.prefTimeTouched = true; }
        else m[d.field] = el.value.trim();
        break;
      }
      case 'mpref': { const m = memberById(d.id); m.prefs = (m.prefs || ['', '', '']).slice(); m.prefs[+d.j] = el.value; break; }
      case 'chipAdd': { const m = memberById(d.id); if (el.value) m[d.field] = (m[d.field] || []).concat([el.value]); break; }
      case 'ccat': S.courses[d.code] = Object.assign({}, S.courses[d.code], { cat: el.value }); S.courseTouched[d.code] = true; Object.keys(S.secCat).forEach((k) => { if (k.startsWith(d.code + '-')) delete S.secCat[k]; }); break;
      case 'ccount': S.courses[d.code] = Object.assign({}, S.courses[d.code], { counts: el.checked }); S.courseTouched[d.code] = true; break;
      case 'msc': { const x = S.msc.find((y) => y.id === d.id); if (x) x[d.field] = d.field === 'hours' ? Number(el.value) : el.value; break; }
      case 'mscDay': { const x = S.msc.find((y) => y.id === d.id); const day = +d.day; x.days = el.checked ? [...new Set((x.days || []).concat(day))].sort() : (x.days || []).filter((y) => y !== day); break; }
      case 'assignTo': if (el.value) { remember('uPut', d.key, nameOf(el.value)); putSection(d.key, el.value); } break;
      case 'hoursSrc': S.hoursSource = el.value; if (el.value === 'file') applyFaculty(); break;
      case 'fmtSheet': fmtUseSheet(el.value); render(); return;
      case 'fmtTitle': ui.fmt.title = el.value; render(); return;
      default: break;
    }
    persist(); render();
  });
  document.addEventListener('input', (ev) => { if (ev.target.id === 'termIn') ui.termDraft = ev.target.value; });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { if (drag) { cleanDrag(); return; } closePop(); hideCard(); if (ui.focusCourse && !ev.target.matches('input, select, textarea')) { ui.focusCourse = null; render(); } }
    if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && (ev.key === 'z' || ev.key === 'Z') && S.step === 4 && !ui.view && !ev.target.matches('input, select, textarea')) { ev.preventDefault(); undo(); }
    if (ev.key === 'Enter' && ev.target.id === 'termIn') startProject();
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('td.slot')) { ev.preventDefault(); openPop(ev.target); }
  });
  // drag & drop files
  document.addEventListener('dragover', (ev) => { const z = ev.target.closest('[data-drop]'); if (z) { ev.preventDefault(); z.classList.add('over'); } });
  document.addEventListener('dragleave', (ev) => { const z = ev.target.closest('[data-drop]'); if (z) z.classList.remove('over'); });
  document.addEventListener('drop', async (ev) => { const z = ev.target.closest('[data-drop]'); if (!z) return; ev.preventDefault(); z.classList.remove('over'); if (z.dataset.drop === 'fmt') await openFormat(ev.dataTransfer.files[0]); else await addFile(z.dataset.drop, ev.dataTransfer.files[0]); });
  window.addEventListener('afterprint', () => document.body.classList.remove('print-fmt'));
  window.addEventListener('scroll', () => { closePop(); hideCard(); }, { passive: true });
  // member card: hover or keyboard focus on a member's name
  document.addEventListener('mouseover', (ev) => { const el = ev.target.closest && ev.target.closest('[data-card]'); if (el) showCard(el); });
  document.addEventListener('mouseout', (ev) => { const el = ev.target.closest && ev.target.closest('[data-card]'); if (el && !(ev.relatedTarget && el.contains(ev.relatedTarget))) hideCard(); });
  document.addEventListener('focusin', (ev) => { if (ev.target.matches && ev.target.matches('[data-card]')) showCard(ev.target); });
  document.addEventListener('focusout', (ev) => { if (ev.target.matches && ev.target.matches('[data-card]')) hideCard(); });
  $('#langBtn').addEventListener('click', () => { S.lang = S.lang === 'ar' ? 'en' : 'ar'; $('#toast').classList.remove('on'); persist(); render(); });
  $('#saveBtn').addEventListener('click', saveProject);

  // expose for testing
  window.ISPApp = { get state() { return S; }, get runtime() { return R; }, snapshot, render };

  // ---------------- boot ----------------
  const saved = S0();
  if (saved && saved.lang) S.lang = saved.lang;
  render();
})();
