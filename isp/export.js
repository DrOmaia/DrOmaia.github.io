/* IS Timetable — Excel export (ExcelJS). Builds the workbook the department sends on:
   <Side> <term> timetable grid, Is Reg (names for registration), Time requests, Official file notes, hidden Lists. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root.ISPEngine || require('./engine.js'), root.ISPDefaults || require('./defaults.js'));
  else root.ISPExport = factory(root.ISPEngine, root.ISPDefaults);
})(typeof self !== 'undefined' ? self : this, function (E, D) {
  'use strict';
  const FONT = 'Tahoma';
  const ARGB = (hex) => 'FF' + String(hex).replace('#', '').toUpperCase();
  const fill = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB(hex) }, bgColor: { argb: ARGB(hex) } });
  const thin = { style: 'thin', color: { argb: 'FF808080' } };
  const med = { style: 'medium', color: { argb: 'FF000000' } };
  const dashed = { style: 'dashed', color: { argb: 'FFC65911' } };
  const center = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const colL = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const HCOL = {}; E.HOURS.forEach((h, i) => { HCOL[h] = 3 + i; }); // C..L
  const NOTIME = 13, NCOL = 14, OCOL = 15, PCOL = 16, QCOL = 17, RCOL = 18, SCOL = 19, TCOL = 20; // M..T
  const LAST = TCOL;

  /**
   * ctx: {side, term, members:[{id,name,required,coop,senior,pseudo?}], secs (model), assign {key: memberId|'PT'|'HOLD'},
   *       off (parsed official), notes (officialNotes), msc, decisions, officialWorkbook (ExcelJS wb of the official file),
   *       issues (evaluate().issues), per (evaluate().per), generated (Date)}
   */
  async function build(ExcelJS, ctx) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'IS Timetable';
    wb.created = ctx.generated || new Date();
    wb.calcProperties = { fullCalcOnLoad: true };
    const sideName = ctx.side === 'female' ? 'Female' : 'Male';
    const title = `${sideName} ${ctx.term}`.trim();
    const ws = wb.addWorksheet(title.slice(0, 31), { views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }], properties: { defaultRowHeight: 20 } });
    const secs = ctx.secs;
    const assign = ctx.assign;
    const memberName = Object.fromEntries(ctx.members.map((m) => [m.id, m.name]));
    const compLabel = (s) => (s.comp ? `${s.comp} (${s.compAct === 'Lab' ? 'Lab' : 'T'})` : '');
    const lLabel = (k) => `${k} (L)`;

    // ---------- grid header ----------
    ws.getColumn(1).width = 30; ws.getColumn(2).width = 8;
    for (let c = 3; c <= NOTIME; c++) ws.getColumn(c).width = 17;
    for (let c = NCOL; c <= TCOL; c++) ws.getColumn(c).width = 11;
    ws.mergeCells(1, 1, 1, LAST);
    const gen = ctx.generated || new Date();
    ws.getCell(1, 1).value = `IS Department – ${sideName} Teaching Timetable – Term ${ctx.term}   |   Draft generated ${gen.toISOString().slice(0, 10)}`;
    ws.getCell(1, 1).font = { name: FONT, size: 14, bold: true, color: { argb: 'FF1F4E79' } };
    ws.getCell(1, 1).alignment = { vertical: 'middle' };
    ws.getRow(1).height = 26;
    ws.mergeCells(2, 3, 2, LAST);
    ws.getCell(2, 3).value = 'Red: conflict or section count different from required   |   Orange italic text with dashed border: proposed time (needs registration approval)';
    ws.getCell(2, 3).font = { name: FONT, size: 9, italic: true, color: { argb: 'FF7F7F7F' } };
    ws.mergeCells(3, 3, 3, NOTIME); ws.getCell(3, 3).value = 'Timeslots';
    ws.getCell(3, 3).fill = fill('0000FF'); ws.getCell(3, 3).font = { name: FONT, size: 14, bold: true, color: { argb: 'FFFFFFFF' } }; ws.getCell(3, 3).alignment = center;
    ws.mergeCells(3, NCOL, 3, SCOL); ws.getCell(3, NCOL).value = 'Teaching Load';
    ws.getCell(3, NCOL).font = { name: FONT, size: 14, bold: true }; ws.getCell(3, NCOL).alignment = center;
    for (let c = NCOL; c <= SCOL; c++) ws.getCell(3, c).fill = fill('EAD1DC');
    ws.getCell(3, TCOL).value = 'Sections'; ws.getCell(3, TCOL).font = { name: FONT, size: 11, bold: true }; ws.getCell(3, TCOL).alignment = center; ws.getCell(3, TCOL).fill = fill('DDEBF7');
    ws.getRow(3).height = 24;
    const head = ws.getRow(4);
    head.height = 46;
    ws.getCell(4, 1).fill = fill('00FF00'); ws.getCell(4, 2).fill = fill('00FF00');
    ws.getCell(4, 2).value = 'Unit load';
    E.HOURS.forEach((h) => { const c = ws.getCell(4, HCOL[h]); c.value = h > 12 ? h - 12 : h; c.numFmt = '0":00"'; });
    const heads = { [NOTIME]: 'No time', [NCOL]: 'Course load', [OCOL]: 'Classes load', [PCOL]: 'Senior Project\n(hrs)', [QCOL]: 'COOP\n(hrs)', [RCOL]: 'MSc / PhD\n(hrs)', [SCOL]: 'Total Load\n(hrs)', [TCOL]: 'Sections\nassigned' };
    Object.entries(heads).forEach(([c, v]) => { ws.getCell(4, +c).value = v; if (+c >= NCOL && +c <= SCOL) ws.getCell(4, +c).fill = fill('EAD1DC'); });
    ws.getCell(4, TCOL).fill = fill('DDEBF7');
    for (let c = 2; c <= LAST; c++) { const cell = ws.getCell(4, c); cell.font = { name: FONT, size: 11, bold: true }; cell.alignment = center; cell.border = { top: thin, bottom: med, left: thin, right: thin }; }

    // ---------- rows of the grid ----------
    const per = ctx.per || {};
    const blocks = []; // {member, pairs:[[{col, key}]] }
    const placed = {}; // key → {row, col}
    const sectionsOf = (id) => Object.keys(assign).filter((k) => assign[k] === id && secs[k]);
    const layout = (keys) => { // distribute keys into L/T pairs so one cell per hour per pair
      const pairs = [];
      const nt = [];
      keys.sort((a, b) => (secs[a].hour || 99) - (secs[b].hour || 99)).forEach((k) => {
        const s = secs[k];
        if (s.hour == null) { nt.push(k); return; }
        let p = pairs.find((x) => !x[s.hour]); if (!p) { p = {}; pairs.push(p); } p[s.hour] = k;
      });
      if (!pairs.length) pairs.push({});
      return { pairs, nt };
    };
    const realMembers = ctx.members.filter((m) => !m.pseudo);
    realMembers.forEach((m) => blocks.push({ m, ...layout(sectionsOf(m.id)) }));
    const pt = ctx.members.find((m) => m.id === 'PT');
    if (pt && sectionsOf('PT').length) blocks.push({ m: pt, ...layout(sectionsOf('PT')) });
    const hold = ctx.members.find((m) => m.id === 'HOLD');
    if (hold) { const L = layout(sectionsOf('HOLD')); while (L.pairs.length < 2) L.pairs.push({}); blocks.push({ m: hold, ...L }); }

    const tFormula = 'IF(INDIRECT("R[-1]C",FALSE)="","",IFERROR(INDEX(SecComp,MATCH(INDIRECT("R[-1]C",FALSE),SecKey,0)),"?"))';
    const courseLoadF = 'SUMPRODUCT(SUMIF(SecKey,INDIRECT("RC3:RC12",FALSE),SecLoad))';
    let r = 5;
    const rowsOfMember = {};
    const dvFor = (h) => ({ type: 'list', allowBlank: true, formulae: [h === 'nt' ? 'NoTime' : `Lec_${String(h).padStart(2, '0')}`], showErrorMessage: true, errorStyle: 'warning', errorTitle: 'Check the section', error: 'This section is not at this hour, or it is already assigned.' });
    blocks.forEach((b) => {
      const first = r;
      const isPseudo = !!b.m.pseudo;
      const unitL = b.pairs.some((p) => Object.values(p).some((k) => secs[k].load === 2)) && isPseudo ? 2 : 3;
      b.pairs.forEach((p, pi) => {
        for (const rr of [r, r + 1]) {
          ws.getRow(rr).height = 20;
          for (let c = 1; c <= LAST; c++) {
            const cell = ws.getCell(rr, c);
            cell.alignment = center;
            cell.font = { name: FONT, size: c >= 3 && c <= NOTIME ? 11 : 11, bold: c >= 3 && c <= NOTIME };
            cell.border = { left: thin, right: thin, top: rr === first ? med : thin, bottom: thin };
          }
        }
        ws.getCell(r, 2).value = unitL; ws.getCell(r + 1, 2).value = 0.5;
        ws.getCell(r, 2).font = ws.getCell(r + 1, 2).font = { name: FONT, size: 10, color: { argb: 'FF404040' } };
        E.HOURS.forEach((h) => {
          const k = p[h];
          const cL = ws.getCell(r, HCOL[h]), cT = ws.getCell(r + 1, HCOL[h]);
          if (k) {
            const s = secs[k];
            cL.value = lLabel(k);
            cT.value = { formula: tFormula, result: compLabel(s) };
            placed[k] = { row: r, col: HCOL[h] };
            if (s.proposed) [cL, cT].forEach((c) => { c.font = { name: FONT, size: 11, bold: true, italic: true, color: { argb: 'FFC65911' } }; c.border = { left: dashed, right: dashed, top: dashed, bottom: dashed }; });
          } else cT.value = { formula: tFormula, result: '' };
          cL.dataValidation = dvFor(h);
          cT.font = Object.assign({}, cT.font, { size: 10 });
        });
        // No time column: two editable cells
        const nt = pi === 0 ? b.nt : [];
        if (nt[0]) ws.getCell(r, NOTIME).value = secs[nt[0]].noTime ? nt[0] : lLabel(nt[0]);
        if (nt[1]) ws.getCell(r + 1, NOTIME).value = nt.slice(1).map((k) => (secs[k].noTime ? k : lLabel(k))).join(', ');
        ws.getCell(r, NOTIME).dataValidation = dvFor('nt'); ws.getCell(r + 1, NOTIME).dataValidation = dvFor('nt');
        nt.forEach((k) => { placed[k] = { row: r, col: NOTIME }; });
        // course load per row
        const loadRow = (row) => {
          let v = 0;
          E.HOURS.forEach((h) => { const k = p[h]; if (k) v += row === r ? secs[k].load : secs[k].comp ? secs[k].compLoad : 0; });
          return v;
        };
        ws.getCell(r, NCOL).value = { formula: courseLoadF, result: loadRow(r) };
        ws.getCell(r + 1, NCOL).value = { formula: courseLoadF, result: loadRow(r + 1) };
        ws.getCell(r, NCOL).font = ws.getCell(r + 1, NCOL).font = { name: FONT, size: 10, color: { argb: 'FF404040' } };
        r += 2;
      });
      const last = r - 1;
      rowsOfMember[b.m.id] = { first, last };
      // merged member columns
      ws.mergeCells(first, 1, last, 1);
      const nameCell = ws.getCell(first, 1);
      nameCell.value = b.m.name;
      nameCell.font = { name: FONT, size: 12, bold: true };
      nameCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 };
      if (b.m.id === 'HOLD') nameCell.fill = fill('FFC000');
      [OCOL, PCOL, QCOL, RCOL, SCOL, TCOL].forEach((c) => ws.mergeCells(first, c, last, c));
      // totals use the whole block
      const blockLoad = () => { let v = 0; for (let rr = first; rr <= last; rr++) { const cv = ws.getCell(rr, NCOL).value; v += cv && cv.result ? cv.result : 0; } return v; };
      const cls = blockLoad();
      ws.getCell(first, OCOL).value = { formula: `SUM(${colL(NCOL)}${first}:${colL(NCOL)}${last})`, result: cls };
      ws.getCell(first, OCOL).font = { name: FONT, size: 11, bold: true };
      if (!isPseudo) {
        const senior = Number(b.m.senior) || 0, coop = Number(b.m.coop) || 0, mscH = (per[b.m.id] && per[b.m.id].mscHours) || 0;
        ws.getCell(first, PCOL).value = senior; ws.getCell(first, QCOL).value = coop; ws.getCell(first, RCOL).value = mscH;
        [PCOL, QCOL, RCOL].forEach((c) => {
          ws.getCell(first, c).font = { name: FONT, size: 11, bold: true, color: { argb: 'FF1F4E79' } };
          ws.getCell(first, c).dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true, showErrorMessage: true, errorTitle: 'Numbers only', error: 'Type the number of hours, e.g. 1 or 3.' };
        });
        ws.getCell(first, SCOL).value = { formula: `${colL(OCOL)}${first}+SUM(${colL(PCOL)}${first}:${colL(RCOL)}${last})`, result: cls + senior + coop + mscH };
        ws.getCell(first, SCOL).font = { name: FONT, size: 12, bold: true };
        // sections assigned: timed L cells + No time cells − sections that do not count (e.g. Senior Project)
        const nonCounting = [...new Set(Object.values(secs).filter((s) => !s.counts).map((s) => s.course))];
        const ranges = [];
        for (let rr = first; rr <= last; rr += 2) ranges.push(`COUNTIF(INDIRECT("R${rr}C3:R${rr}C12",FALSE),"?*")`);
        const ntRange = `INDIRECT("R${first}C13:R${last}C13",FALSE)`;
        let f = ranges.join('+') + `+COUNTIF(${ntRange},"?*")`;
        nonCounting.forEach((c) => { f += `-COUNTIF(${ntRange},"${c}*")`; });
        const counted = sectionsOf(b.m.id).filter((k) => secs[k].counts).length;
        ws.getCell(first, TCOL).value = { formula: f, result: counted };
        ws.getCell(first, TCOL).font = { name: FONT, size: 12, bold: true };
        const req = b.m.required === '' || b.m.required == null ? null : Number(b.m.required);
        if (req != null) {
          ws.addConditionalFormatting({ ref: `${colL(TCOL)}${first}`, rules: [{ type: 'expression', priority: 1, formulae: [`${colL(TCOL)}${first}<>${req}`], style: { fill: fill('FFC7CE'), font: { color: { argb: 'FF9C0006' }, bold: true } } }] });
        }
        // note on the name cell
        const lines = [];
        if (req != null) lines.push(`Required sections: ${req}`);
        const dec = ctx.decisions && ctx.decisions[b.m.id];
        if (dec) lines.push(`Decision: ${dec === 'final' ? 'Final' : dec === 'reject' ? 'Rejected – to revise' : 'Review next round'}`);
        const nonc = sectionsOf(b.m.id).filter((k) => !secs[k].counts);
        if (nonc.length) lines.push(`${nonc.join(', ')}: counted as hours, not as a section`);
        (ctx.memberNotes && ctx.memberNotes[b.m.id] || []).forEach((x) => lines.push(x));
        if (lines.length) nameCell.note = { texts: [{ font: { name: FONT, size: 9 }, text: lines.join('\n') }] };
      } else {
        ws.getCell(first, TCOL).value = sectionsOf(b.m.id).length;
        ws.getCell(first, TCOL).font = { name: FONT, size: 11, bold: true, color: { argb: 'FF7F7F7F' } };
        if (b.m.id === 'PT') nameCell.note = { texts: [{ font: { name: FONT, size: 9 }, text: `Part-timers: ${sectionsOf('PT').length} sections. Names are left blank in Is Reg.` }] };
        if (b.m.id === 'HOLD') nameCell.note = { texts: [{ font: { name: FONT, size: 9 }, text: 'ON-Hold: not offered unless the department decides otherwise. Names are left blank in Is Reg.' }] };
      }
      // thick line under the block
      for (let c = 1; c <= LAST; c++) { const cell = ws.getCell(last, c); cell.border = Object.assign({}, cell.border, { bottom: med }); }
    });
    const lastGrid = r - 1;
    // member issues → red text on the name cell
    (ctx.issues || []).forEach((i) => {
      if (!i.member || !rowsOfMember[i.member]) return;
      if (i.type === 'clash' || i.type === 'window') {
        [i.a, i.b].forEach((k) => { if (placed[k]) { const c = ws.getCell(placed[k].row, placed[k].col); c.font = Object.assign({}, c.font, { color: { argb: 'FFC00000' } }); c.border = { left: med, right: med, top: med, bottom: med }; } });
      }
    });

    // conditional formatting: duplicates (red) first, then course colours
    const gridRef = `C5:${colL(NOTIME)}${lastGrid}`;
    const rules = [{ type: 'expression', priority: 1, formulae: [`AND(C5<>"",ISERROR(SEARCH("(T)",C5)),ISERROR(SEARCH("(Lab)",C5)),COUNTIF($C$5:$${colL(NOTIME)}$${lastGrid},C5)>1)`], style: { fill: fill('FF0000'), font: { color: { argb: 'FFFFFFFF' }, bold: true } } }];
    const courseList = [...new Set(Object.values(secs).map((s) => s.course))];
    courseList.forEach((c, i) => {
      rules.push({ type: 'expression', priority: 2 + i, formulae: [`LEFT(C5,${c.length + 1})="${c}-"`], style: { fill: fill(D.colourFor(c)) } });
    });
    ws.addConditionalFormatting({ ref: gridRef, rules });

    // ---------- colour key ----------
    r = lastGrid + 2;
    ws.mergeCells(r, 1, r + 1, 2);
    ws.getCell(r, 1).value = 'Course colours'; ws.getCell(r, 1).font = { name: FONT, size: 11, bold: true }; ws.getCell(r, 1).alignment = center;
    const used = courseList.filter((c) => Object.keys(assign).some((k) => secs[k] && secs[k].course === c));
    used.forEach((c, i) => {
      const row = r + Math.floor(i / 11), col = 3 + (i % 11);
      const cell = ws.getCell(row, col);
      cell.value = c; cell.fill = fill(D.colourFor(c)); cell.font = { name: FONT, size: 10, bold: true }; cell.alignment = center; cell.border = { left: thin, right: thin, top: thin, bottom: thin };
    });
    const keyEnd = r + Math.max(1, Math.ceil(used.length / 11));
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };
    ws.pageSetup.printArea = `A1:${colL(LAST)}${keyEnd}`;
    ws.pageSetup.printTitlesRow = '3:4';

    // ---------- MSc / PhD block ----------
    r = keyEnd + 2;
    const sec = (titleText, headers) => {
      ws.mergeCells(r, 1, r, 8); ws.getCell(r, 1).value = titleText; ws.getCell(r, 1).font = { name: FONT, size: 12, bold: true, color: { argb: 'FF1F4E79' } };
      r++;
      headers.forEach((h, i) => { const c = ws.getCell(r, 1 + i); c.value = h; c.font = { name: FONT, size: 10, bold: true }; c.fill = fill('D9E1F2'); c.alignment = center; c.border = { left: thin, right: thin, top: thin, bottom: thin }; });
      r++;
    };
    const putRow = (vals, opts) => {
      vals.forEach((v, i) => { const c = ws.getCell(r, 1 + i); if (v !== undefined) c.value = v; c.font = Object.assign({ name: FONT, size: 10 }, (opts && opts.font) || {}); c.alignment = { vertical: 'middle', wrapText: true, horizontal: i === 0 ? 'left' : 'center' }; c.border = { left: thin, right: thin, top: thin, bottom: thin }; });
      r++;
    };
    sec('MSc / PhD teaching', ['Member', 'Course', 'Program', 'Days', 'Hour', 'Hours', 'Impact on timetable']);
    const msc = ctx.msc || [];
    if (!msc.length) putRow(['No MSc / PhD teaching entered (TBC)', '', '', '', '', '', '']);
    msc.forEach((x) => {
      const clash = (ctx.issues || []).some((i) => i.member === x.member && i.type === 'clash' && (i.a === 'MSc/PhD' || i.b === 'MSc/PhD'));
      putRow([memberName[x.member] || '', x.course || '', x.program || '', (x.days || []).map((d) => E.DAY_NAMES[d]).join(' '), E.hourLabel(x.hour), Number(x.hours) || 0, clash ? 'Clash with an undergraduate section' : 'No clash']);
    });

    // ---------- summary ----------
    r++;
    const status = statusMap(ctx);
    const lecs = Object.values(secs);
    const cnt = (f) => lecs.filter(f).length;
    sec('Summary against the official file', ['Item', '', '', '', '', 'Count']);
    const sumRows = [
      [`Sections in the ${ctx.off.sheetName} sheet (lectures)`, lecs.length],
      ['Assigned to members', cnt((s) => status[s.key].st.startsWith('Assigned'))],
      ['Part-timers', cnt((s) => status[s.key].st === 'Part-timer')],
      ['ON-Hold', cnt((s) => status[s.key].st === 'ON-Hold')],
      ['Not assigned to the department (shared or not ours)', cnt((s) => status[s.key].st === 'Not assigned to IS')],
      ['Unassigned (must be assigned)', cnt((s) => status[s.key].st === 'Unassigned')],
      ['Sections with a proposed time (need registration approval)', cnt((s) => s.proposed)],
      ['Sections assigned / required (members)', `${realMembers.reduce((a, m) => a + sectionsOf(m.id).filter((k) => secs[k].counts).length, 0)} / ${realMembers.reduce((a, m) => a + (Number(m.required) || 0), 0)}`],
    ];
    sumRows.forEach(([a, b]) => { ws.mergeCells(r, 1, r, 5); putRow([a, undefined, undefined, undefined, undefined, b]); });

    // ---------- check table ----------
    r++;
    ws.mergeCells(r, 1, r, 10);
    ws.getCell(r, 1).value = `Every section in the official ${ctx.off.sheetName} sheet: status, assigned to, and notes`;
    ws.getCell(r, 1).font = { name: FONT, size: 12, bold: true, color: { argb: 'FF1F4E79' } };
    r++;
    const ch = ['Section', 'Type', 'Time', 'Days & rooms', 'Course name', 'T/Lab', 'Status', 'Assigned to', 'Official-file note', 'Is Reg rows'];
    ch.forEach((h, i) => { const c = ws.getCell(r, 1 + i); c.value = h; c.font = { name: FONT, size: 10, bold: true }; c.fill = fill('D9E1F2'); c.alignment = center; c.border = { left: thin, right: thin, top: thin, bottom: thin }; });
    r++;
    ctx.off.lectures.forEach((k) => {
      const s = secs[k];
      const st = status[k];
      const time = s.proposed ? `${E.hourLabel(s.hour)} proposed${s.officialHour != null ? ` (official ${E.hourLabel(s.officialHour)})` : ' (no official time)'}` : s.hour != null ? E.hourLabel(s.hour) : 'No time';
      const rowsTxt = rowSpan(ctx.off, k);
      putRow([k, s.prefix, time, E.describeMeetings(ctx.off, k), s.name, s.comp || '', st.st, st.name || '', (ctx.notes[k] || []).map((n) => n.text).join('; '), rowsTxt], { font: st.red ? { color: { argb: 'FFC00000' }, bold: true } : null });
      if (s.proposed) ws.getCell(r - 1, 3).font = { name: FONT, size: 10, italic: true, color: { argb: 'FFC65911' } };
    });

    // ---------- Is Reg ----------
    await buildIsReg(wb, ctx, status);
    // ---------- Time requests ----------
    buildTimeRequests(wb, ctx, status);
    // ---------- Official notes ----------
    buildNotes(wb, ctx);
    // ---------- Lists (hidden, last sheet) ----------
    const lists = wb.addWorksheet('Lists', { state: 'hidden' });
    lists.getRow(1).values = ['SecKey', 'SecLoad', 'SecComp', '', ...E.HOURS.map((h) => `Lec_${String(h).padStart(2, '0')}`), 'NoTime'];
    let lr = 2;
    Object.values(secs).forEach((s) => {
      if (s.noTime) { lists.getRow(lr++).values = [s.key, s.load, '']; return; }
      lists.getRow(lr++).values = [lLabel(s.key), s.load, compLabel(s)];
      if (s.comp) lists.getRow(lr++).values = [compLabel(s), s.compLoad, ''];
    });
    const lastList = Math.max(2, lr - 1);
    wb.definedNames.add(`Lists!$A$2:$A$${lastList}`, 'SecKey');
    wb.definedNames.add(`Lists!$B$2:$B$${lastList}`, 'SecLoad');
    wb.definedNames.add(`Lists!$C$2:$C$${lastList}`, 'SecComp');
    E.HOURS.forEach((h, i) => {
      const col = 5 + i;
      const keys = Object.values(secs).filter((s) => s.hour === h && !s.noTime).map((s) => lLabel(s.key));
      keys.forEach((k, j) => { lists.getCell(2 + j, col).value = k; });
      wb.definedNames.add(`Lists!$${colL(col)}$2:$${colL(col)}$${Math.max(2, 1 + keys.length)}`, `Lec_${String(h).padStart(2, '0')}`);
    });
    const ntCol = 5 + E.HOURS.length;
    const ntKeys = Object.values(secs).filter((s) => s.noTime || (s.needsTime && s.hour == null)).map((s) => (s.noTime ? s.key : lLabel(s.key)));
    ntKeys.forEach((k, j) => { lists.getCell(2 + j, ntCol).value = k; });
    wb.definedNames.add(`Lists!$${colL(ntCol)}$2:$${colL(ntCol)}$${Math.max(2, 1 + ntKeys.length)}`, 'NoTime');

    return wb;
  }

  function rowSpan(off, k) {
    const rows = [...off.sections[k].excelRows].concat(off.companionOf[k] ? off.sections[off.companionOf[k]].excelRows : []).sort((a, b) => a - b);
    if (!rows.length) return '';
    return rows[0] === rows[rows.length - 1] ? String(rows[0]) : `${rows[0]}-${rows[rows.length - 1]}`;
  }

  /** status per lecture key: {st, name, red} */
  function statusMap(ctx) {
    const out = {};
    const real = new Set(ctx.members.filter((m) => !m.pseudo).map((m) => m.id));
    const memberName = Object.fromEntries(ctx.members.map((m) => [m.id, m.name]));
    Object.values(ctx.secs).forEach((s) => {
      const a = ctx.assign[s.key];
      let st, name = '', red = false;
      if (a && real.has(a)) { st = s.counts ? 'Assigned' : 'Assigned (counted as hours)'; name = memberName[a]; }
      else if (a === 'PT') st = 'Part-timer';
      else if (a === 'HOLD' || s.cat === 'onhold') st = 'ON-Hold';
      else if (s.cat === 'parttime') st = 'Part-timer';
      else if (s.cat === 'none' || s.cat === 'asneeded') st = 'Not assigned to IS';
      else { st = 'Unassigned'; red = true; }
      const clash = (ctx.issues || []).some((i) => (i.type === 'clash' || i.type === 'window') && (i.a === s.key || i.b === s.key));
      if (clash) { st = st + ' – conflict'; red = true; }
      out[s.key] = { st, name, red };
    });
    return out;
  }

  async function buildIsReg(wb, ctx, status) {
    const off = ctx.off;
    const ws = wb.addWorksheet('Is Reg', { views: [{ state: 'frozen', ySplit: off.headerRow }] });
    const src = ctx.officialWorkbook && ctx.officialWorkbook.getWorksheet(off.sheetName);
    const instrCol = off.cols.instructor != null ? off.cols.instructor + 1 : (src ? src.columnCount + 1 : 12);
    const lastSrcCol = Math.max(instrCol, src ? src.columnCount : 11);
    if (src) {
      for (let c = 1; c <= lastSrcCol; c++) { const sc = src.getColumn(c); if (sc.width) ws.getColumn(c).width = sc.width; }
      src.eachRow({ includeEmpty: true }, (row, rn) => {
        const dst = ws.getRow(rn);
        if (row.height) dst.height = row.height;
        for (let c = 1; c <= lastSrcCol; c++) {
          const s = row.getCell(c), d = dst.getCell(c);
          let v = s.value;
          if (v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v)) v = v.result != null ? v.result : null;
          d.value = v;
          if (s.style) d.style = JSON.parse(JSON.stringify(s.style));
        }
      });
      (src.model.merges || []).forEach((m) => { try { ws.mergeCells(m); } catch (e) { /* ignore */ } });
    }
    // names column + helpers
    const hdr = off.headerRow;
    const hcell = ws.getCell(hdr, instrCol);
    if (!hcell.value) hcell.value = "INSTRUCTOR'S NAME";
    const helpCols = [[lastSrcCol + 1, 'STATUS (helper - do not copy)', 26], [lastSrcCol + 2, 'NOTE (helper - do not copy)', 60]];
    helpCols.forEach(([c, t, w]) => { const cell = ws.getCell(hdr, c); cell.value = t; cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF595959' } }; cell.fill = fill('E7E6E6'); cell.alignment = center; ws.getColumn(c).width = w; });
    if (!ws.getColumn(instrCol).width || ws.getColumn(instrCol).width < 24) ws.getColumn(instrCol).width = 28;
    off.rows.forEach((row) => {
      const lk = off.lectureOf[row.key] || row.key;
      const st = status[lk] || { st: 'Not in timetable', name: '', red: true };
      const s = ctx.secs[lk];
      const nameCell = ws.getCell(row.excelRow, instrCol);
      nameCell.value = st.st.startsWith('Assigned') && !st.red ? st.name : null;
      if (!nameCell.value) nameCell.fill = fill('F2F2F2');
      const sc = ws.getCell(row.excelRow, lastSrcCol + 1);
      sc.value = st.st; sc.font = { name: FONT, size: 10, bold: true, color: { argb: st.red ? 'FFC00000' : st.st.startsWith('Assigned') ? 'FF2E7D32' : 'FF7F7F7F' } };
      const notes = (ctx.notes[lk] || []).map((n) => n.text);
      if (s && s.proposed) notes.unshift(`Proposed time ${E.hourLabel(s.hour)}${s.officialHour != null ? ` instead of ${E.hourLabel(s.officialHour)}` : ''} (needs registration approval)`);
      const nc = ws.getCell(row.excelRow, lastSrcCol + 2);
      nc.value = notes.join('; ') || null; nc.font = { name: FONT, size: 9, color: { argb: 'FF595959' } }; nc.alignment = { wrapText: false, vertical: 'middle' };
    });
  }

  function buildTimeRequests(wb, ctx, status) {
    const ws = wb.addWorksheet('Time requests');
    const heads = ['Section', 'T / Lab', 'Course', 'Instructor', 'Official time', 'Proposed time', 'Days', 'Suggested free rooms', 'Note'];
    const widths = [16, 14, 34, 28, 14, 14, 18, 46, 46];
    ws.getRow(1).values = heads;
    ws.getRow(1).eachCell((c) => { c.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = fill('1F4E79'); c.alignment = center; });
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    let r = 2;
    Object.values(ctx.secs).filter((s) => s.proposed).forEach((s) => {
      const fr = E.freeRooms(ctx.off, s.key, s.hour);
      const days = fr.map((g) => `${g.days.map((d) => E.DAY_NAMES[d]).join(' ')}${g.online ? ' (Online)' : ''}`).join(' | ');
      const rooms = fr.filter((g) => !g.online).map((g) => `${g.days.map((d) => E.DAY_NAMES[d]).join(' ')}: ${g.rooms.length ? g.rooms.map(E.shortRoom).join(' or ') : 'no free room found'}`).join(' | ');
      ws.getRow(r).values = [s.key, s.comp || '', s.name, (status[s.key] && status[s.key].name) || '', s.officialHour != null ? E.hourLabel(s.officialHour) : 'No time', E.hourLabel(s.hour), days, rooms, (ctx.notes[s.key] || []).map((n) => n.text).join('; ')];
      ws.getRow(r).eachCell((c) => { c.font = { name: FONT, size: 10 }; c.alignment = { vertical: 'middle', wrapText: true }; });
      r++;
    });
    if (r === 2) { ws.getCell(2, 1).value = 'No time changes requested.'; ws.getCell(2, 1).font = { name: FONT, size: 10, italic: true }; }
  }

  function buildNotes(wb, ctx) {
    const ws = wb.addWorksheet('Official file notes');
    ws.getRow(1).values = ['Section', 'Course', 'Rows in the sheet', 'Note'];
    ws.getRow(1).eachCell((c) => { c.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = fill('1F4E79'); c.alignment = center; });
    [16, 34, 16, 90].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    let r = 2;
    ctx.off.lectures.forEach((k) => {
      (ctx.notes[k] || []).forEach((n) => {
        ws.getRow(r).values = [k, ctx.off.sections[k].courseName, rowSpan(ctx.off, k), n.text];
        ws.getRow(r).eachCell((c) => { c.font = { name: FONT, size: 10 }; c.alignment = { vertical: 'middle', wrapText: true }; });
        r++;
      });
    });
    if (r === 2) { ws.getCell(2, 1).value = 'No notes.'; }
  }

  return { build, statusMap };
});
