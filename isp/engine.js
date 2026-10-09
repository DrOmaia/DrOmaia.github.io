/* IS Timetable — engine: file readers, rules, proposal builder and checks.
   Runs in the browser (window.ISPEngine) and in Node (module.exports) for testing. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ISPEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- constants ----------
  const HOURS = [8, 9, 10, 11, 13, 14, 15, 16, 17, 18]; // 12:00 is the break
  const DAY_NAMES = { 1: 'Sun', 2: 'Mon', 3: 'Tue', 4: 'Wed', 5: 'Thu', 6: 'Fri', 7: 'Sat' };
  const hourLabel = (h) => (h == null ? '' : `${h > 12 ? h - 12 : h}:00`);
  const COURSE_RE = /([A-Za-z]{2,4})\s*(\d{3})(?:\s*-\s*(\d{1,5}))?/g;

  // ---------- cell & sheet helpers ----------
  function cellValue(v) {
    if (v == null) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'object') {
      if ('result' in v) return cellValue(v.result);
      if (v.richText) return v.richText.map((t) => t.text).join('');
      if ('text' in v) return v.text;
      if (v.error) return null;
      if ('formula' in v || 'sharedFormula' in v) return null;
      return String(v);
    }
    return v;
  }
  const txt = (v) => {
    const c = cellValue(v);
    if (c == null) return '';
    if (c instanceof Date) return c.toISOString();
    return String(c).replace(/\s+/g, ' ').trim();
  };

  /** Convert an ExcelJS workbook into plain sheets: [{name, hidden, rows:[[value...]] (0-based)}] */
  function sheetsFromExcelJS(wb) {
    const out = [];
    wb.eachSheet((ws) => {
      const rows = [];
      const n = ws.rowCount;
      for (let r = 1; r <= n; r++) {
        const row = ws.getRow(r);
        const arr = [];
        const cc = Math.max(row.cellCount, ws.columnCount || 0);
        for (let c = 1; c <= cc; c++) {
          const cell = row.getCell(c);
          // merged slaves report the master's value; keep only the master
          if (cell.isMerged && cell.master && cell.master.address !== cell.address) arr.push(null);
          else arr.push(cellValue(cell.value));
        }
        rows.push(arr);
      }
      out.push({ name: ws.name, hidden: ws.state && ws.state !== 'visible', rows });
    });
    return out;
  }

  /** Load an .xlsx with ExcelJS; if its notes/comments links are written in a form ExcelJS cannot read
      (e.g. files saved by some tools), repair the links with JSZip and try again. */
  async function loadWorkbook(ExcelJS, JSZip, buf) {
    const tryLoad = async (b) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(b); return wb; };
    try { return await tryLoad(buf); } catch (e) { if (!JSZip) throw e; }
    const zip = await JSZip.loadAsync(buf);
    const rels = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/_rels\/.*\.rels$/.test(n));
    for (const n of rels) { const x = await zip.file(n).async('string'); zip.file(n, x.replace(/Target="\/xl\//g, 'Target="../')); }
    try { return await tryLoad(await zip.generateAsync({ type: 'arraybuffer' })); } catch (e) { /* drop notes entirely */ }
    for (const n of rels) {
      const x = await zip.file(n).async('string');
      zip.file(n, x.replace(/<Relationship\b[^>]*relationships\/(comments|vmlDrawing)"[^>]*\/>/g, ''));
    }
    return tryLoad(await zip.generateAsync({ type: 'arraybuffer' }));
  }

  // ---------- time parsing ----------
  function parseHour(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return v.getUTCHours();
    if (typeof v === 'number') {
      if (v > 0 && v < 1) return Math.round(v * 24 * 60) / 60 | 0; // Excel time fraction
      if (v >= 1 && v <= 24) return v < 8 ? v + 12 : v;
      return null;
    }
    const s = String(v).trim();
    const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|ص|م)?/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const ap = (m[3] || '').toUpperCase();
    if (ap === 'PM' || ap === 'م') { if (h < 12) h += 12; } else if (ap === 'AM' || ap === 'ص') { if (h === 12) h = 0; } else if (h < 8) h += 12;
    return h;
  }
  /** Header cell of a timetable grid → hour, or 'none' for the No time column */
  function headerHour(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') {
      if (v > 0 && v < 1) return parseHour(v);
      if (Number.isInteger(v) && ((v >= 8 && v <= 11) || (v >= 1 && v <= 6) || (v >= 13 && v <= 18))) return v <= 6 ? v + 12 : v;
      return null;
    }
    const s = String(v).trim();
    if (/^no\s*time$/i.test(s) || /untimed/i.test(s)) return 'none';
    if (/^\d{1,2}(:00)?(\s*(am|pm))?$/i.test(s)) { const h = parseHour(s); return HOURS.includes(h) ? h : null; }
    return null;
  }
  function parseDays(v) {
    if (v == null) return [];
    if (typeof v === 'number') return [v];
    const s = String(v).toUpperCase();
    const out = new Set();
    s.split(/[^0-9A-Z]+/).forEach((t) => {
      if (/^[1-7]$/.test(t)) out.add(+t);
      else if (/^SU/.test(t)) out.add(1); else if (/^MO/.test(t)) out.add(2); else if (/^TU/.test(t)) out.add(3);
      else if (/^WE/.test(t)) out.add(4); else if (/^TH/.test(t)) out.add(5);
    });
    return [...out].sort((a, b) => a - b);
  }
  const normCourse = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');

  // ---------- official file ----------
  const OFFICIAL_COLS = {
    section: /^section$|^sec(tion)?\s*(no|#)?$/i,
    course: /^course$|^course\s*(code|no)$/i,
    courseName: /course[_\s]*name|title/i,
    activity: /activity|type/i,
    crd: /crd|credit/i,
    start: /^start/i,
    end: /^end/i,
    days: /^days?$/i,
    rooms: /^rooms?$/i,
    instructor: /instructor/i,
  };
  function findHeader(rows, need) {
    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const cols = {};
      (rows[r] || []).forEach((v, c) => {
        const s = txt(v);
        if (!s) return;
        for (const k of Object.keys(OFFICIAL_COLS)) if (cols[k] == null && OFFICIAL_COLS[k].test(s)) { cols[k] = c; break; }
      });
      if (need.every((k) => cols[k] != null)) return { row: r, cols };
    }
    return null;
  }
  function looksOfficial(sheet) { return !!findHeader(sheet.rows, ['section', 'course', 'start']); }

  function readOfficialRows(sheet) {
    const h = findHeader(sheet.rows, ['section', 'course', 'start']);
    if (!h) return null;
    const { cols } = h;
    const rows = [];
    for (let r = h.row + 1; r < sheet.rows.length; r++) {
      const row = sheet.rows[r] || [];
      const course = normCourse(txt(row[cols.course]));
      const sec = txt(row[cols.section]);
      if (!course || !sec || !/^[A-Z]{2,4}\d{3}$/.test(course)) continue;
      const act = txt(row[cols.activity]);
      const room = txt(row[cols.rooms]);
      rows.push({
        excelRow: r + 1,
        course, sec: sec.replace(/\.0$/, ''),
        key: `${course}-${sec.replace(/\.0$/, '')}`,
        courseName: txt(row[cols.courseName]),
        activity: /lab/i.test(act) ? 'Lab' : /tut/i.test(act) ? 'T' : 'L',
        activityText: act,
        crd: parseFloat(txt(row[cols.crd])) || 0,
        hour: parseHour(cellValue(row[cols.start])),
        startText: txt(row[cols.start]), endText: txt(row[cols.end]),
        days: parseDays(cellValue(row[cols.days])),
        room, online: /online/i.test(room),
        instructor: cols.instructor != null ? txt(row[cols.instructor]) : '',
      });
    }
    return { headerRow: h.row + 1, cols, rows };
  }

  /** Parse the official timetable workbook: sections of the chosen sheet + rooms used in every sheet. */
  function parseOfficial(sheets, sheetName) {
    const sheet = sheets.find((s) => s.name === sheetName);
    if (!sheet) throw new Error('sheet-not-found');
    const main = readOfficialRows(sheet);
    if (!main || !main.rows.length) throw new Error('not-official');
    // group rows by section key
    const groups = new Map();
    main.rows.forEach((row) => {
      if (!groups.has(row.key)) groups.set(row.key, { key: row.key, course: row.course, sec: row.sec, secNum: parseInt(row.sec, 10), courseName: row.courseName, crd: row.crd, rows: [] });
      groups.get(row.key).rows.push(row);
    });
    for (const g of groups.values()) {
      const acts = g.rows.map((r) => r.activity);
      g.activity = acts.includes('L') ? 'L' : acts.includes('Lab') ? 'Lab' : 'T';
      const hours = [...new Set(g.rows.map((r) => r.hour).filter((h) => h != null))];
      g.hour = hours.length ? Math.min(...hours) : null;
      g.hours = hours;
      g.meetings = g.rows.filter((r) => r.hour != null).map((r) => ({ days: r.days, hour: r.hour, room: r.room, online: r.online, activity: r.activity }));
      g.excelRows = g.rows.map((r) => r.excelRow);
    }
    // pair companions (T / Lab) with lectures
    const lectures = [], companionOf = {}, lectureOf = {};
    const byCourse = {};
    for (const g of groups.values()) (byCourse[g.course] = byCourse[g.course] || []).push(g);
    for (const list of Object.values(byCourse)) {
      const ls = list.filter((g) => g.activity === 'L');
      const cs = list.filter((g) => g.activity !== 'L');
      cs.forEach((c) => {
        let best = ls.find((l) => l.secNum === c.secNum - 1 && !companionOf[l.key]);
        if (!best) {
          const cands = ls.filter((l) => !companionOf[l.key] && (c.hour == null || l.hour == null || Math.abs(l.hour - c.hour) <= 1));
          cands.sort((a, b) => Math.abs(a.secNum - c.secNum) - Math.abs(b.secNum - c.secNum));
          best = cands[0];
        }
        if (best) { companionOf[best.key] = c.key; lectureOf[c.key] = best.key; }
        else { c.activity = 'L'; ls.push(c); } // orphan companion → treat as its own section
      });
    }
    const order = [...groups.values()].sort((a, b) => a.rows[0].excelRow - b.rows[0].excelRow);
    order.forEach((g) => { if (g.activity === 'L') lectures.push(g.key); });
    const sections = {};
    order.forEach((g) => { sections[g.key] = g; });
    // courses
    const courses = {};
    lectures.forEach((k) => {
      const s = sections[k];
      const c = courses[s.course] || (courses[s.course] = { code: s.course, name: s.courseName, crd: s.crd, lectures: [], timed: 0, untimed: 0, prefix: s.course.replace(/\d+$/, '') });
      c.lectures.push(k);
      if (s.hour != null) c.timed++; else c.untimed++;
      if (!c.name && s.courseName) c.name = s.courseName;
    });
    // rooms in every sheet of the workbook (for clashes and free-room suggestions)
    const roomUse = []; // {sheet, key, course, day, hour, room, activity}
    const keySheets = {};
    sheets.forEach((sh) => {
      const res = readOfficialRows(sh);
      if (!res) return;
      res.rows.forEach((r) => {
        (keySheets[r.key] = keySheets[r.key] || new Set()).add(sh.name);
        if (r.online || !r.room || r.hour == null) return;
        r.days.forEach((d) => roomUse.push({ sheet: sh.name, key: r.key, course: r.course, day: d, hour: r.hour, room: r.room, activity: r.activity }));
      });
    });
    const allRooms = {};
    roomUse.forEach((u) => { allRooms[u.room] = /CLAB/i.test(u.room) ? 'lab' : 'room'; });
    return {
      sheetName, headerRow: main.headerRow, cols: main.cols, rows: main.rows, rowCount: sheet.rows.length,
      sections, lectures, companionOf, lectureOf, courses, roomUse, allRooms,
      keySheets: Object.fromEntries(Object.entries(keySheets).map(([k, v]) => [k, [...v]])),
    };
  }

  /** Header row of a grid timetable: the first row with a contiguous run of distinct hours (8 … 6). */
  function findGridHeader(rows) {
    for (let r = 0; r < Math.min(rows.length, 20); r++) {
      const cells = [];
      (rows[r] || []).forEach((v, c) => { const h = headerHour(cellValue(v)); if (h != null && c > 0) cells.push([c, h]); });
      const map = {}; const seen = new Set(); let prev = null;
      for (const [c, h] of cells) {
        if (prev != null && c - prev > 2) break;
        if (h !== 'none' && seen.has(h)) break;
        map[c] = h; if (h !== 'none') seen.add(h); prev = c;
      }
      if (seen.size >= 6) return { headerRow: r, colHour: map };
    }
    return null;
  }

  // ---------- current-term timetable (261 style or this site's own export) ----------
  function parseCurrent(sheets, sheetName) {
    const sheet = sheets.find((s) => s.name === sheetName);
    if (!sheet) throw new Error('sheet-not-found');
    const rows = sheet.rows;
    const gh = findGridHeader(rows);
    if (!gh) throw new Error('not-timetable');
    const { headerRow, colHour } = gh;
    const lastHourCol = Math.max(...Object.keys(colHour).map(Number));
    // blocks: a name in column A starts a block
    const blocks = [];
    let cur = null, blank = 0;
    for (let r = headerRow + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const name = txt(row[0]);
      if (name && /colou?r key|course colou?rs|matching summary|every section|ms[c]?\s*\/\s*phd teaching/i.test(name)) break;
      const hasAny = row.slice(1, lastHourCol + 1).some((v) => txt(v));
      if (name) { cur = { name, rows: [] }; blocks.push(cur); blank = 0; }
      if (!name && !hasAny) { blank++; if (blank > 3 && cur) cur = null; }
      if (cur) cur.rows.push(row);
    }
    const out = blocks.map((b) => {
      const kind = /on.?hold/i.test(b.name) ? 'onhold' : /part.?tim/i.test(b.name) ? 'parttime' : 'member';
      const items = [];
      for (let i = 0; i < b.rows.length; i += 2) {
        const pair = [b.rows[i], b.rows[i + 1] || []];
        Object.entries(colHour).forEach(([c, h]) => {
          const found = new Map();
          pair.forEach((row) => {
            const s = txt(row[+c]);
            if (!s) return;
            let m; COURSE_RE.lastIndex = 0;
            while ((m = COURSE_RE.exec(s))) {
              const code = (m[1] + m[2]).toUpperCase();
              if (!found.has(code)) found.set(code, { course: code, hour: h === 'none' ? null : h, sec: m[3] || null, raw: s });
            }
          });
          found.forEach((v) => items.push(v));
        });
      }
      return { name: b.name, kind, items };
    });
    return { sheetName, rows: out };
  }

  // ---------- any department timetable, read as it is (for the "format for printing" service) ----------
  /** Reads a grid timetable without changing any text: names, hour cells, No time and the columns after them. */
  function readGridRaw(sheets, sheetName) {
    const sheet = sheets.find((s) => s.name === sheetName);
    if (!sheet) throw new Error('sheet-not-found');
    const rows = sheet.rows;
    const gh = findGridHeader(rows);
    if (!gh) throw new Error('not-timetable');
    const { headerRow, colHour } = gh;
    const header = rows[headerRow] || [];
    const hourCols = Object.entries(colHour).filter(([, h]) => h !== 'none').map(([c, h]) => ({ col: +c, hour: h })).sort((a, b) => a.col - b.col);
    const ntEntry = Object.entries(colHour).find(([, h]) => h === 'none');
    const ntCol = ntEntry ? +ntEntry[0] : null;
    const firstHourCol = hourCols[0].col;
    const lastGridCol = Math.max(hourCols[hourCols.length - 1].col, ntCol == null ? -1 : ntCol);
    // a column between the names and the first hour (e.g. "Unit load")
    let unitCol = null;
    for (let c = 1; c < firstHourCol; c++) if (txt(header[c])) { unitCol = c; break; }
    // columns after the grid, until the first column without a heading
    const extras = [];
    for (let c = lastGridCol + 1; c < header.length; c++) {
      const label = txt(header[c]);
      if (!label || typeof cellValue(header[c]) === 'number') break;
      extras.push({ col: c, label });
    }
    // title: first text above the header that is not a band heading
    let title = '';
    const lastCol = extras.length ? extras[extras.length - 1].col : lastGridCol;
    for (let r = 0; r < headerRow && !title; r++) (rows[r] || []).slice(0, lastCol + 1).forEach((v) => { const t = txt(v); if (!title && t && /[A-Za-z\u0600-\u06ff]{3}/.test(t) && !/^(timeslots|teaching load|sections)$/i.test(t)) title = t; });
    const val = (v) => { const c = cellValue(v); if (c == null || c === '') return ''; if (typeof c === 'number') return Math.round(c * 100) / 100; if (c instanceof Date) return c.toISOString().slice(0, 10); return String(c).trim(); };
    const blocks = [];
    let cur = null, blank = 0;
    for (let r = headerRow + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const name = txt(row[0]);
      if (name && /colou?r key|course colou?rs|matching summary|every section|ms[c]?\s*\/\s*phd teaching|^summary/i.test(name)) break;
      const used = [unitCol, ...hourCols.map((h) => h.col), ntCol, ...extras.map((e) => e.col)].filter((c) => c != null);
      const hasAny = used.some((c) => val(row[c]) !== '');
      if (!name && !hasAny) { blank++; if (blank > 2) { if (cur) cur = null; } continue; }
      blank = 0;
      if (name) { cur = { name, rows: [] }; blocks.push(cur); }
      if (!cur) { cur = { name: '', rows: [] }; blocks.push(cur); }
      cur.rows.push({
        unit: unitCol == null ? '' : val(row[unitCol]),
        cells: Object.fromEntries(hourCols.map((h) => [h.hour, val(row[h.col])])),
        nt: ntCol == null ? '' : val(row[ntCol]),
        extras: extras.map((e) => val(row[e.col])),
      });
    }
    return { sheetName, title, unitLabel: unitCol == null ? '' : txt(header[unitCol]), hours: hourCols.map((h) => h.hour), hasNoTime: ntCol != null, extras: extras.map((e) => e.label), blocks: blocks.filter((b) => b.rows.length) };
  }
  /** First course code in a cell's text, e.g. "IS 101 (L)" → IS101. */
  function courseIn(text) { COURSE_RE.lastIndex = 0; const m = COURSE_RE.exec(String(text || '')); return m ? (m[1] + m[2]).toUpperCase() : null; }

  // ---------- preferences (Google Form export) ----------
  function parsePrefs(sheets, sheetName) {
    const sheet = sheets.find((s) => s.name === sheetName);
    if (!sheet) throw new Error('sheet-not-found');
    const rows = sheet.rows;
    let hr = -1, cols = {};
    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      const c = {};
      (rows[r] || []).forEach((v, i) => {
        const s = txt(v).toLowerCase();
        if (!s) return;
        if (c.name == null && /full\s*name|^name$/.test(s)) c.name = i;
        else if (c.email == null && /e-?mail/.test(s)) c.email = i;
        else if (c.p1 == null && /first\s*pref/.test(s)) c.p1 = i;
        else if (c.p2 == null && /second\s*pref/.test(s)) c.p2 = i;
        else if (c.p3 == null && /third\s*pref/.test(s)) c.p3 = i;
        else if (c.sup == null && /supervis/.test(s)) c.sup = i;
        else if (c.time == null && /(morning|afternoon|class time)/.test(s)) c.time = i;
        else if (c.comment == null && /comment|note/.test(s)) c.comment = i;
      });
      if (c.name != null && (c.p1 != null || c.time != null)) { hr = r; cols = c; break; }
    }
    if (hr < 0) throw new Error('not-prefs');
    const codes = (v) => { const out = []; let m; const s = txt(v); COURSE_RE.lastIndex = 0; while ((m = COURSE_RE.exec(s))) out.push((m[1] + m[2]).toUpperCase()); return out; };
    const list = [];
    for (let r = hr + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const name = txt(row[cols.name]);
      if (!name) continue;
      const t = txt(row[cols.time]).toLowerCase();
      list.push({
        name, email: txt(row[cols.email]),
        prefs: [codes(row[cols.p1])[0] || '', codes(row[cols.p2])[0] || '', codes(row[cols.p3])[0] || ''],
        supervise: txt(row[cols.sup]),
        time: /morning/.test(t) ? 'am' : /afternoon/.test(t) ? 'pm' : 'any',
        timeText: txt(row[cols.time]),
        comment: txt(row[cols.comment]),
      });
    }
    return { sheetName, list };
  }

  // ---------- faculty list (e.g. Total Sections.xlsx, or the site's template) ----------
  /** Returns {sheetName, list:[{name, required, coop, senior}], partTime: number|null} */
  function parseFaculty(sheets, sheetName) {
    const sheet = sheets.find((s) => s.name === sheetName);
    if (!sheet) throw new Error('sheet-not-found');
    const rows = sheet.rows;
    const num = (v) => { const c = cellValue(v); if (typeof c === 'number') return c; const s = txt(c); return /^\d+(\.\d+)?$/.test(s) ? parseFloat(s) : null; };
    let hr = -1; const col = {};
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const found = {};
      (rows[r] || []).forEach((v, c) => {
        const s = txt(v).toLowerCase();
        if (!s) return;
        if (found.sections == null && /section|شعب/.test(s)) found.sections = c;
        else if (found.coop == null && /co-?op|تدريب/.test(s)) found.coop = c;
        else if (found.senior == null && /senior|مشروع/.test(s)) found.senior = c;
        else if (found.name == null && /\bname\b|الاسم/.test(s)) found.name = c;
      });
      if (found.sections != null || found.name != null) { hr = r; Object.assign(col, found); break; }
    }
    const list = []; let partTime = null;
    for (let r = hr + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      let nameCol = col.name != null ? col.name : -1;
      if (nameCol < 0) nameCol = row.findIndex((v) => { const s = txt(v); return s && /[A-Za-z؀-ۿ]/.test(s) && num(v) == null; });
      if (nameCol < 0) continue;
      const name = txt(row[nameCol]);
      if (!name || /^(total|sum|المجموع|الإجمالي)/i.test(name)) continue;
      let sections = col.sections != null ? num(row[col.sections]) : null;
      if (col.sections == null) for (let c = nameCol + 1; c < row.length; c++) { const n = num(row[c]); if (n != null) { sections = n; break; } }
      if (/part.?tim|need part|متعاون/i.test(name)) { partTime = sections; continue; }
      if (!/[A-Za-z؀-ۿ]{2}/.test(name)) continue;
      list.push({
        name,
        required: sections == null ? '' : sections,
        coop: col.coop != null ? num(row[col.coop]) : null,
        senior: col.senior != null ? num(row[col.senior]) : null,
      });
    }
    if (!list.length) throw new Error('not-faculty');
    return { sheetName, list, partTime, hasCoop: col.coop != null, hasSenior: col.senior != null };
  }

  // ---------- name matching ----------
  const TITLES = new Set(['dr', 'prof', 'professor', 'ms', 'mr', 'mrs', 'miss', 'eng', 'engr']);
  const JOINERS = new Set(['al', 'el', 'abu', 'abo', 'bin', 'ibn', 'ur', 'ul']);
  function nameTokens(s) {
    const raw = String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z\u0600-\u06ff\s]/g, ' ')
      .split(/\s+/).filter((t) => t && !TITLES.has(t) && !/^(need|time|covered|by)$/.test(t));
    const out = [];
    for (let i = 0; i < raw.length; i++) {
      if (JOINERS.has(raw[i]) && i + 1 < raw.length) { out.push(raw[i] + raw[i + 1]); i++; }
      else if (raw[i].length > 1) out.push(raw[i]);
    }
    return out;
  }
  function jw(a, b) { // Jaro-Winkler similarity
    if (a === b) return 1;
    const la = a.length, lb = b.length; if (!la || !lb) return 0;
    const md = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
    const am = new Array(la).fill(false), bm = new Array(lb).fill(false);
    let m = 0;
    for (let i = 0; i < la; i++) for (let j = Math.max(0, i - md); j < Math.min(lb, i + md + 1); j++) if (!bm[j] && a[i] === b[j]) { am[i] = bm[j] = true; m++; break; }
    if (!m) return 0;
    let t = 0, k = 0;
    for (let i = 0; i < la; i++) if (am[i]) { while (!bm[k]) k++; if (a[i] !== b[k]) t++; k++; }
    const j = (m / la + m / lb + (m - t / 2) / m) / 3;
    let p = 0; while (p < 4 && a[p] === b[p]) p++;
    return j + p * 0.1 * (1 - j);
  }
  function tokSim(x, y) {
    const s = jw(x, y);
    if (s >= 0.86) return s;
    if (x.length >= 5 && y.length >= 5 && (y.includes(x.slice(-5)) || x.includes(y.slice(-5)))) return 0.88;
    return 0;
  }
  /** Similarity of two person names (0..1). extraB: more text known about b (e.g. an e-mail address). */
  function nameScore(a, b, extraB) {
    const ta = nameTokens(a), tb = nameTokens(b), te = extraB ? nameTokens(String(extraB).split('@')[0].replace(/[._]/g, ' ')) : [];
    if (!ta.length || !tb.length) return 0;
    const cover = (xs, ys) => xs.reduce((sum, x) => sum + Math.max(0, ...ys.map((y) => tokSim(x, y))), 0);
    const ab = cover(ta, tb.concat(te)) / ta.length;
    const ba = cover(tb, ta.concat(te)) / tb.length;
    const tok = 0.7 * Math.max(ab, ba) + 0.3 * Math.min(ab, ba);
    const cat = jw(ta.join(''), tb.join(''));
    return Math.max(tok, cat >= 0.92 ? cat : 0);
  }
  /** One-to-one matching of external names to member ids. Returns {extName: memberId} */
  function matchNames(extNames, members, threshold = 0.55, getExtra) {
    const pairs = [];
    extNames.forEach((n, i) => members.forEach((m) => {
      const s = nameScore(n, m.name, getExtra ? getExtra(i) : null);
      if (s >= threshold) pairs.push({ n, m: m.id, s });
    }));
    pairs.sort((a, b) => b.s - a.s);
    const usedN = new Set(), usedM = new Set(), out = {};
    pairs.forEach((p) => { if (usedN.has(p.n) || usedM.has(p.m)) return; usedN.add(p.n); usedM.add(p.m); out[p.n] = { id: p.m, score: p.s }; });
    return out;
  }

  // ---------- model ----------
  /**
   * Build the working model from parsed files and settings.
   * settings: {members, courses (code→{cat, counts, load, compLoad}), secCat, proposed, msc}
   */
  function buildModel(off, settings) {
    const secs = {};
    const proposed = settings.proposed || {};
    off.lectures.forEach((k) => {
      const s = off.sections[k];
      const comp = off.companionOf[k] ? off.sections[off.companionOf[k]] : null;
      const cs = settings.courses[s.course] || {};
      const course = off.courses[s.course];
      const noTime = course.timed === 0; // COOP / Senior style
      const needsTime = s.hour == null && !noTime;
      const cat = (settings.secCat && settings.secCat[k]) || cs.cat || 'required';
      const officialHour = s.hour;
      const ph = proposed[k];
      const hour = ph != null ? ph : officialHour;
      // slots (day*100+hour) of lecture + companion; shifted when a time is proposed
      let slots = [];
      const shift = ph != null && officialHour != null ? ph - officialHour : 0;
      const addMeet = (m) => m.days.forEach((d) => slots.push(d * 100 + m.hour + shift));
      s.meetings.forEach(addMeet);
      if (comp) comp.meetings.forEach(addMeet);
      if (ph != null && officialHour == null) {
        // untimed section: borrow the day pattern of a sibling section of the same course
        const sib = course.lectures.map((x) => off.sections[x]).find((x) => x.hour != null);
        const pattern = new Set();
        if (sib) {
          sib.meetings.forEach((m) => m.days.forEach((d) => pattern.add(d)));
          const sc = off.companionOf[sib.key] ? off.sections[off.companionOf[sib.key]] : null;
          if (sc) sc.meetings.forEach((m) => m.days.forEach((d) => pattern.add(d)));
        } else [1, 2, 3, 4].forEach((d) => pattern.add(d));
        slots = [...pattern].map((d) => d * 100 + ph);
      }
      const load = cs.load != null ? cs.load : noTime ? 0 : Math.min(3, s.crd || 3);
      const compLoad = comp ? (cs.compLoad != null ? cs.compLoad : noTime ? 0 : 0.5) : 0;
      secs[k] = {
        key: k, course: s.course, sec: s.sec, name: s.courseName, prefix: course.prefix,
        comp: comp ? comp.key : null, compAct: comp ? comp.activity : null,
        officialHour, hour, proposed: ph != null, needsTime, noTime,
        slots: [...new Set(slots)], cat,
        counts: noTime ? cs.counts !== false : true,
        load, compLoad,
      };
    });
    return secs;
  }

  // member constraints
  function memberAllows(m, sec) {
    const list = (m.allowed || []).map(normCourse).filter(Boolean);
    const never = (m.never || []).map(normCourse).filter(Boolean);
    if (never.some((x) => x === sec.course || x === sec.prefix)) return false;
    if (sec.noTime) return list.includes(sec.course); // COOP/Senior only where explicitly allowed
    if (!list.length) return true;
    return list.some((x) => x === sec.course || x === sec.prefix);
  }
  function inWindow(m, hour) {
    if (hour == null) return true;
    const first = m.first || 8, last = m.last || 18;
    return hour >= first && hour <= last;
  }
  /** MSc / PhD courses of a member: no time (evening), so they never clash. */
  function mscOf(msc, memberId) { return (msc || []).filter((x) => x.member === memberId); }
  const mscCounted = (msc, memberId) => mscOf(msc, memberId).filter((x) => x.counts !== false).length;
  const mscHoursOf = (msc, memberId) => mscOf(msc, memberId).reduce((a, x) => a + (x.hours === '' || x.hours == null ? 3 : Number(x.hours) || 0), 0);
  function mscSlots(msc, memberId) {
    const out = [];
    (msc || []).forEach((x) => { if (x.member === memberId && x.hour) (x.days || []).forEach((d) => out.push(d * 100 + x.hour)); });
    return out;
  }

  // ---------- scoring ----------
  const W = {
    uncovered: 1000, countDiff: 400, keepMissing: 60, keepSameHour: -8, changeFrom: 15,
    pref: [-12, -9, -6], newCourse: 10, prefTime: 10, mixed: 25, gap: 12, gapExtra: 40, lateStart: 6,
    prep: 6, proposedTime: 20, forbidden: 5000, asNeeded: 5,
  };

  function memberCost(m, keys, secs, ctx) {
    let cost = 0;
    const counted = keys.filter((k) => secs[k].counts).length + ((ctx.mscCount && ctx.mscCount[m.id]) || 0);
    if (m.required != null && m.required !== '') cost += W.countDiff * Math.abs(counted - Number(m.required));
    const courses = keys.map((k) => secs[k].course);
    const base = (m.keepCurrent !== false && ctx.current[m.id]) || null;
    if (base) {
      const need = {}; base.forEach((b) => { need[b.course] = (need[b.course] || 0) + 1; });
      const have = {}; courses.forEach((c) => { have[c] = (have[c] || 0) + 1; });
      Object.entries(need).forEach(([c, n]) => { cost += W.keepMissing * Math.max(0, n - (have[c] || 0)); });
      keys.forEach((k) => {
        const s = secs[k];
        if (!need[s.course]) cost += W.changeFrom;
        else if (base.some((b) => b.course === s.course && b.hour === s.hour)) cost += W.keepSameHour;
      });
    }
    const prefs = (m.prefs || []).map(normCourse);
    keys.forEach((k) => {
      const s = secs[k];
      const pi = prefs.indexOf(s.course);
      if (pi >= 0) cost += W.pref[pi] || 0;
      else if (!base || !base.some((b) => b.course === s.course)) cost += s.noTime ? 0 : W.newCourse;
      if (s.hour != null) {
        if (m.prefTime === 'am' && s.hour >= 13) cost += W.prefTime;
        if (m.prefTime === 'pm' && s.hour < 13) cost += W.prefTime;
      }
      if (s.proposed && ctx.autoTime && ctx.autoTime[k]) cost += W.proposedTime;
      if (s.cat === 'asneeded') cost += W.asNeeded;
      if (ctx.stability && ctx.start && ctx.start[k] !== m.id) cost += ctx.stability;
    });
    // compactness on start hours
    const hrs = [...new Set(keys.map((k) => secs[k].hour).filter((h) => h != null))].sort((a, b) => a - b);
    const am = hrs.filter((h) => h < 12), pm = hrs.filter((h) => h > 12);
    if (am.length && pm.length) cost += W.mixed;
    const gaps = (arr, from, to) => { let g = 0; for (let h = from; h <= to; h++) if (h !== 12 && !arr.includes(h)) g++; return g; };
    if (am.length > 1) { const g = gaps(am, am[0], am[am.length - 1]); cost += g * W.gap + Math.max(0, g - 1) * W.gapExtra; }
    if (pm.length) {
      const g = pm.length > 1 ? gaps(pm, pm[0], pm[pm.length - 1]) : 0;
      cost += g * W.gap + Math.max(0, g - 1) * W.gapExtra;
      if (!am.length) cost += (pm[0] - 13) * W.lateStart;
    }
    const preps = new Set(courses).size;
    if (preps > 1) cost += (preps - 1) * W.prep;
    // forbidden (rejected) combinations
    const fb = ctx.forbidden && ctx.forbidden[m.id];
    if (fb && fb.length) { const sig = keys.slice().sort().join('|'); if (fb.includes(sig)) cost += W.forbidden; }
    return cost;
  }

  // ---------- proposal builder (simulated annealing) ----------
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; }

  /**
   * opts: {members, secs, current:{memberId:[{course,hour}]}, pins:{key:memberId}, bans:{'key|id':1},
   *        locked:{memberId:true}, start:{key:memberId}, msc, forbidden:{memberId:[sig]}, iterations, restarts, seed}
   * returns {assign:{key:memberId}, hours:{key:hour for auto-timed}, cost}
   */
  function propose(opts) {
    const members = opts.members.filter((m) => !m.pseudo);
    const mById = Object.fromEntries(members.map((m) => [m.id, m]));
    const baseSecs = opts.secs;
    const assignable = Object.values(baseSecs).filter((s) => s.cat === 'required' || s.cat === 'asneeded' || opts.pins[s.key]);
    const keys = assignable.map((s) => s.key);
    const pins = opts.pins || {}, bans = opts.bans || {}, locked = opts.locked || {};
    const ctx = { current: opts.current || {}, forbidden: opts.forbidden || {}, autoTime: {}, start: opts.start || null, stability: opts.stability || 0 };
    const msc = {}; members.forEach((m) => { msc[m.id] = new Set(); });
    ctx.mscCount = {}; members.forEach((m) => { ctx.mscCount[m.id] = mscCounted(opts.msc, m.id); });

    // sections that need a time: candidate hours (any teaching hour)
    const autoTimed = keys.filter((k) => baseSecs[k].needsTime && !baseSecs[k].proposed);
    const slotsAt = (s, h) => {
      const sib = Object.values(baseSecs).find((x) => x.course === s.course && x.officialHour != null);
      const pattern = new Set(); if (sib) sib.slots.forEach((sl) => pattern.add(Math.floor(sl / 100))); else [1, 2, 3, 4].forEach((d) => pattern.add(d));
      return [...pattern].map((d) => d * 100 + h);
    };

    let best = null;
    const restarts = opts.restarts || 4, iters = opts.iterations || 40000;
    for (let rs = 0; rs < restarts; rs++) {
      const rand = rng((opts.seed || 262) + rs * 7919);
      const secs = {}; keys.forEach((k) => { secs[k] = Object.assign({}, baseSecs[k]); });
      autoTimed.forEach((k) => { ctx.autoTime[k] = true; });
      const assign = {}; keys.forEach((k) => { assign[k] = null; });
      const byMember = {}; members.forEach((m) => { byMember[m.id] = []; });
      const occupied = {}; members.forEach((m) => { occupied[m.id] = new Map(); });
      const fits = (mid, s) => {
        const m = mById[mid]; if (!m) return false;
        if (bans[`${s.key}|${mid}`]) return false;
        if (!pins[s.key] && !memberAllows(m, s)) return false;
        if (s.needsTime && s.hour == null) return false;
        if (!inWindow(m, s.hour)) return false;
        const occ = occupied[mid];
        for (const sl of s.slots) { if (occ.has(sl) && occ.get(sl) !== s.key) return false; if (msc[mid].has(sl)) return false; }
        return true;
      };
      const place = (k, mid) => { assign[k] = mid; byMember[mid].push(k); secs[k].slots.forEach((sl) => occupied[mid].set(sl, k)); };
      const unplace = (k) => { const mid = assign[k]; if (mid == null) return; assign[k] = null; byMember[mid] = byMember[mid].filter((x) => x !== k); secs[k].slots.forEach((sl) => { if (occupied[mid].get(sl) === k) occupied[mid].delete(sl); }); };
      const setHour = (k, h) => { secs[k].hour = h; secs[k].proposed = true; secs[k].slots = slotsAt(secs[k], h); };
      const mcost = {}; const recost = (mid) => { mcost[mid] = memberCost(mById[mid], byMember[mid], secs, ctx); };
      const uncoveredCost = (k) => (assign[k] == null && secs[k].cat === 'required' ? W.uncovered : 0);

      // 1) pins and locked members' current sections
      Object.entries(pins).forEach(([k, mid]) => { if (secs[k] && mById[mid]) { if (secs[k].needsTime && secs[k].hour == null) setHour(k, HOURS[0]); place(k, mid); } });
      Object.entries(opts.start || {}).forEach(([k, mid]) => {
        if (!secs[k] || assign[k] != null || !mById[mid]) return;
        if (locked[mid] || rs === 0 || opts.startAll) {
          if (secs[k].needsTime && secs[k].hour == null && opts.startHours && opts.startHours[k] != null) setHour(k, opts.startHours[k]);
          if (fits(mid, secs[k])) place(k, mid);
        }
      });
      const fixed = new Set(keys.filter((k) => pins[k] || (assign[k] != null && locked[assign[k]])));
      // 2) greedy from current-term courses
      if (!((rs === 0 || opts.startAll) && opts.start)) {
        const order = members.slice().sort(() => rand() - 0.5);
        order.forEach((m) => {
          if (locked[m.id]) return;
          const base = (m.keepCurrent !== false && ctx.current[m.id]) || [];
          base.forEach((b) => {
            const cands = keys.filter((k) => assign[k] == null && secs[k].course === b.course && !fixed.has(k));
            cands.sort((x, y) => (secs[x].hour === b.hour ? -1 : 0) - (secs[y].hour === b.hour ? -1 : 0));
            for (const k of cands) {
              if (secs[k].needsTime && secs[k].hour == null) setHour(k, b.hour && HOURS.includes(b.hour) ? b.hour : HOURS[Math.floor(rand() * HOURS.length)]);
              if (fits(m.id, secs[k])) { place(k, m.id); break; }
            }
          });
        });
      }
      members.forEach((m) => recost(m.id));
      const movable = keys.filter((k) => !fixed.has(k));
      const memberIds = members.filter((m) => !locked[m.id]).map((m) => m.id);
      let total = members.reduce((a, m) => a + mcost[m.id], 0) + keys.reduce((a, k) => a + uncoveredCost(k), 0);
      let bestLocal = { total, assign: Object.assign({}, assign), hours: Object.fromEntries(autoTimed.map((k) => [k, secs[k].hour])) };
      if (movable.length && memberIds.length) {
        const T0 = opts.t0 || 60, T1 = 0.3;
        for (let it = 0; it < iters; it++) {
          const T = T0 * Math.pow(T1 / T0, it / iters);
          const r = rand();
          if (r < 0.6) {
            // move one section to a member (or drop it)
            const k = movable[Math.floor(rand() * movable.length)];
            const old = assign[k];
            const to = rand() < 0.08 ? null : memberIds[Math.floor(rand() * memberIds.length)];
            if (to === old) continue;
            const oldHour = secs[k].hour, oldSlots = secs[k].slots, oldProp = secs[k].proposed;
            const before = (old != null ? mcost[old] : 0) + (to != null ? mcost[to] : 0) + uncoveredCost(k);
            unplace(k);
            if (autoTimed.includes(k) && to != null && (rand() < 0.5 || oldHour == null)) setHour(k, HOURS[Math.floor(rand() * HOURS.length)]);
            if (to != null && !fits(to, secs[k])) { secs[k].hour = oldHour; secs[k].slots = oldSlots; secs[k].proposed = oldProp; if (old != null) place(k, old); continue; }
            if (to != null) place(k, to);
            if (old != null) recost(old); if (to != null) recost(to);
            const after = (old != null ? mcost[old] : 0) + (to != null ? mcost[to] : 0) + uncoveredCost(k);
            const d = after - before;
            if (d <= 0 || rand() < Math.exp(-d / T)) total += d;
            else { unplace(k); secs[k].hour = oldHour; secs[k].slots = oldSlots; secs[k].proposed = oldProp; if (old != null) place(k, old); if (old != null) recost(old); if (to != null) recost(to); }
          } else {
            // swap two sections between members
            const a = movable[Math.floor(rand() * movable.length)], b = movable[Math.floor(rand() * movable.length)];
            const ma = assign[a], mb = assign[b];
            if (a === b || ma === mb) continue;
            if ((ma != null && locked[ma]) || (mb != null && locked[mb])) continue;
            const before = (ma != null ? mcost[ma] : 0) + (mb != null ? mcost[mb] : 0) + uncoveredCost(a) + uncoveredCost(b);
            unplace(a); unplace(b);
            const okA = mb == null || fits(mb, secs[a]); if (okA && mb != null) place(a, mb);
            const okB = okA && (ma == null || fits(ma, secs[b])); if (okB && ma != null) place(b, ma);
            if (!okA || !okB) { unplace(a); unplace(b); if (ma != null) place(a, ma); if (mb != null) place(b, mb); continue; }
            if (ma != null) recost(ma); if (mb != null) recost(mb);
            const after = (ma != null ? mcost[ma] : 0) + (mb != null ? mcost[mb] : 0) + uncoveredCost(a) + uncoveredCost(b);
            const d = after - before;
            if (d <= 0 || rand() < Math.exp(-d / T)) total += d;
            else { unplace(a); unplace(b); if (ma != null) place(a, ma); if (mb != null) place(b, mb); if (ma != null) recost(ma); if (mb != null) recost(mb); }
          }
          if (total < bestLocal.total - 1e-9) bestLocal = { total, assign: Object.assign({}, assign), hours: Object.fromEntries(autoTimed.map((k) => [k, secs[k].hour])) };
        }
      }
      if (!best || bestLocal.total < best.total) best = bestLocal;
    }
    const assignOut = {}; Object.entries(best.assign).forEach(([k, v]) => { if (v != null) assignOut[k] = v; });
    const hours = {}; autoTimed.forEach((k) => { if (assignOut[k] && best.hours[k] != null) hours[k] = best.hours[k]; });
    return { assign: assignOut, hours, cost: best.total };
  }

  // ---------- evaluation of a finished assignment ----------
  /** assign: {key: memberId}; returns per-member info and the issue list */
  function evaluate(secs, members, assign, msc) {
    const per = {};
    members.forEach((m) => { per[m.id] = { keys: [], load: 0, counted: 0, issues: [] }; });
    Object.entries(assign).forEach(([k, mid]) => { if (per[mid] && secs[k]) per[mid].keys.push(k); });
    const issues = [];
    const seen = {};
    members.forEach((m) => {
      const p = per[m.id];
      if (m.pseudo) { p.keys.forEach((k) => { p.load += secs[k].load + secs[k].compLoad; }); return; }
      const occ = new Map();
      p.keys.forEach((k) => {
        const s = secs[k];
        p.load += s.load + s.compLoad;
        if (s.counts) p.counted++;
        s.slots.forEach((sl) => {
          if (occ.has(sl) && occ.get(sl) !== k) {
            const sig = [m.id, k, occ.get(sl)].join('|');
            if (!seen[sig]) { seen[sig] = 1; p.issues.push({ type: 'clash', a: k, b: occ.get(sl), day: Math.floor(sl / 100), hour: sl % 100 }); }
          } else occ.set(sl, k);
        });
        if (!inWindow(m, s.hour)) p.issues.push({ type: 'window', a: k });
        if (s.needsTime && s.hour == null) p.issues.push({ type: 'notime', a: k });
      });
      p.mscCount = mscCounted(msc, m.id);
      p.counted += p.mscCount;
      if (m.required !== '' && m.required != null && p.counted !== Number(m.required)) p.issues.push({ type: 'count', have: p.counted, need: Number(m.required) });
      p.mscHours = mscHoursOf(msc, m.id);
      p.total = p.load + (Number(m.senior) || 0) + (Number(m.coop) || 0) + p.mscHours;
      p.issues.forEach((i) => issues.push(Object.assign({ member: m.id }, i)));
    });
    Object.values(secs).forEach((s) => {
      if (s.cat === 'required' && !assign[s.key]) issues.push({ type: 'unassigned', a: s.key });
    });
    return { per, issues };
  }

  // ---------- notes on the official file ----------
  function officialNotes(off) {
    const notes = {}; // key → [{code, text}]
    const add = (k, code, text) => { (notes[k] = notes[k] || []).push({ code, text }); };
    const use = {}; // day|hour|room → [{sheet,key}]
    off.roomUse.forEach((u) => { const id = `${u.day}|${u.hour}|${u.room}`; (use[id] = use[id] || []).push(u); });
    const lect = (k) => off.lectureOf[k] || k;
    Object.values(off.sections).forEach((s) => {
      const L = lect(s.key);
      if (s.activity === 'L' && s.hour == null) add(L, 'notime', 'No time in the official file');
      s.rows.forEach((r) => {
        if (r.hour === 12) add(L, 'break', `${s.key} meets during the 12:00 break`);
        if (r.days.includes(5)) add(L, 'thu', `${s.key} meets on Thursday`);
        if (r.activity === 'Lab' && !r.online && r.room && !/CLAB/i.test(r.room)) add(L, 'labroom', `${s.key} lab is in ${r.room.replace(/\s*\[.*\]/, '')}, which is not marked as a computer lab`);
        if (!r.online && r.room && r.hour != null) r.days.forEach((d) => {
          const others = (use[`${d}|${r.hour}|${r.room}`] || []).filter((u) => u.key !== s.key && u.course + u.key !== s.course + s.key);
          others.forEach((o) => add(L, 'room', `Room clash: ${s.key} and ${o.key}${o.sheet !== off.sheetName ? ` (${o.sheet} sheet)` : ''} in ${r.room.replace(/\s*\[.*\]/, '')}, ${DAY_NAMES[d]} ${hourLabel(r.hour)}`));
        });
      });
      const other = (off.keySheets[s.key] || []).filter((n) => n !== off.sheetName);
      if (other.length && s.activity === 'L') add(L, 'shared', `Also listed in the ${other.join(', ')} sheet${other.length > 1 ? 's' : ''}`);
    });
    Object.entries(off.companionOf).forEach(([lk, ck]) => {
      const l = off.sections[lk], c = off.sections[ck];
      if (l.hour != null && c.hour != null && l.hour !== c.hour) add(lk, 'comphour', `${c.activity === 'Lab' ? 'Lab' : 'Tutorial'} ${ck} is at ${hourLabel(c.hour)}, the lecture at ${hourLabel(l.hour)}`);
    });
    // de-duplicate texts
    Object.keys(notes).forEach((k) => { const seenT = new Set(); notes[k] = notes[k].filter((n) => (seenT.has(n.text) ? false : seenT.add(n.text))); });
    return notes;
  }

  /** Free rooms for a section at a proposed hour, per meeting pattern of the section (or its siblings). */
  function freeRooms(off, secKey, hour) {
    const s = off.sections[secKey];
    if (!s) return [];
    const course = off.courses[s.course];
    let meets = s.meetings.slice();
    const comp = off.companionOf[secKey] ? off.sections[off.companionOf[secKey]] : null;
    if (comp) meets = meets.concat(comp.meetings);
    if (!meets.length) {
      const sib = course.lectures.map((x) => off.sections[x]).find((x) => x.hour != null);
      if (sib) { meets = sib.meetings.slice(); const sc = off.companionOf[sib.key] ? off.sections[off.companionOf[sib.key]] : null; if (sc) meets = meets.concat(sc.meetings); }
    }
    const busy = new Set(off.roomUse.filter((u) => u.key !== secKey && !(comp && u.key === comp.key)).map((u) => `${u.day}|${u.hour}|${u.room}`));
    const result = [];
    const groups = {};
    meets.forEach((m) => {
      if (m.online) { result.push({ days: m.days, online: true, rooms: [] }); return; }
      const kind = /CLAB/i.test(m.room) ? 'lab' : 'room';
      const id = m.days.join(',') + '|' + kind;
      if (groups[id]) return; groups[id] = 1;
      const cands = Object.keys(off.allRooms).filter((r) => off.allRooms[r] === kind && m.days.every((d) => !busy.has(`${d}|${hour}|${r}`)));
      cands.sort((a, b) => (a === m.room ? -1 : b === m.room ? 1 : a.localeCompare(b)));
      result.push({ days: m.days, online: false, kind, current: m.room, rooms: cands.slice(0, 3) });
    });
    return result;
  }

  const shortRoom = (r) => String(r || '').replace(/\s*\[.*\]/, '').replace(/\s+CLAB/i, '');
  function describeMeetings(off, key, hourOverride) {
    const s = off.sections[key];
    if (!s) return '';
    const comp = off.companionOf[key] ? off.sections[off.companionOf[key]] : null;
    const parts = [];
    const fmt = (list) => {
      const byRoom = {};
      list.forEach((m) => { const r = m.online ? 'Online' : shortRoom(m.room); (byRoom[r] = byRoom[r] || new Set()); m.days.forEach((d) => byRoom[r].add(d)); });
      return Object.entries(byRoom).map(([r, ds]) => `${[...ds].sort().map((d) => DAY_NAMES[d]).join(' ')}: ${r}`);
    };
    parts.push(...fmt(s.meetings));
    if (comp) parts.push(...fmt(comp.meetings).map((x) => `${comp.activity === 'Lab' ? 'Lab' : 'Tut'} ${x}`));
    return parts.join(' | ');
  }

  /** Default category for each course of the official sheet. */
  function defaultCourseSettings(off, current, fixed) {
    const out = {};
    const ptCourses = new Set();
    if (current) current.rows.filter((r) => r.kind === 'parttime').forEach((r) => r.items.forEach((i) => ptCourses.add(i.course)));
    Object.values(off.courses).forEach((c) => {
      const shared = c.lectures.some((k) => (off.keySheets[k] || []).length > 1);
      let cat = 'required';
      if (ptCourses.has(c.code)) cat = 'parttime';
      else if (shared) cat = 'asneeded';
      const noTime = c.timed === 0;
      out[c.code] = Object.assign({ cat, counts: noTime ? !/senior/i.test(c.name) : true }, (fixed && fixed[c.code]) || {});
    });
    return out;
  }

  return {
    HOURS, DAY_NAMES, hourLabel, shortRoom, defaultCourseSettings,
    cellValue, txt, sheetsFromExcelJS, loadWorkbook, parseHour, headerHour, parseDays, normCourse,
    looksOfficial, parseOfficial, parseCurrent, parsePrefs, parseFaculty, readGridRaw, courseIn,
    nameTokens, nameScore, matchNames,
    buildModel, memberAllows, mscOf, inWindow, memberCost, propose, evaluate, officialNotes, freeRooms, describeMeetings,
    WEIGHTS: W,
  };
});
