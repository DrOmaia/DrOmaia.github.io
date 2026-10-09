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
  const UCOL = 21, VCOL = 22, WCOL = 23; // hidden helpers: block owner, row of a section in the grid, name in this draft
  const NOTICE = 'Unofficial simulation produced by a training tool. Not an official document; the data and results must not be relied on.';
  function noticeFooter(ws) { ws.headerFooter = { oddFooter: '&L&8&"Tahoma,Italic"' + NOTICE + '&R&8Page &P of &N', evenFooter: '&L&8&"Tahoma,Italic"' + NOTICE + '&R&8Page &P of &N' }; }

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
    ws.getCell(1, 1).value = `IS Department – ${sideName} Teaching Timetable – Term ${ctx.term}   |   Unofficial simulation draft, generated ${gen.toISOString().slice(0, 10)}`;
    ws.getCell(1, 1).font = { name: FONT, size: 14, bold: true, color: { argb: 'FF1F4E79' } };
    ws.getCell(1, 1).alignment = { vertical: 'middle' };
    ws.getRow(1).height = 26;
    ws.mergeCells(2, 3, 2, LAST); ws.getRow(2).height = 30; ws.getCell(2, 3).alignment = { wrapText: true, vertical: 'middle' };
    ws.getCell(2, 3).value = NOTICE + '   |   To move a section, choose it from the list in a cell (only sections not yet placed at that hour are listed) and clear its old cell; loads, counts, the check table, Is Reg names and the summary update by themselves.   |   Red: duplicated section, section outside its hour, or sections different from required   |   Orange italic dashed: proposed time (needs registration approval)';
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

    // ---------- layout of everything below the grid (formulas need these rows) ----------
    const LG = 4 + blocks.reduce((a, b) => a + b.pairs.length * 2, 0);
    const courseList = [...new Set(Object.values(secs).map((s) => s.course))];
    const used = courseList.filter((c) => Object.keys(assign).some((k) => secs[k] && secs[k].course === c));
    const keyStart = LG + 2, keyEnd = keyStart + Math.max(1, Math.ceil(used.length / 11));
    const msc = ctx.msc || [];
    const mscFirst = keyEnd + 4, mscRows = msc.length + 4, mscLast = mscFirst + mscRows - 1;
    const SUMN = 9, sumFirst = mscLast + 4, sumLast = sumFirst + SUMN - 1;
    const chkFirst = sumLast + 4, chkLast = chkFirst + ctx.off.lectures.length - 1;
    const chkRow = {}; ctx.off.lectures.forEach((k, i) => { chkRow[k] = chkFirst + i; });
    const SH = `'${title.slice(0, 31).replace(/'/g, "''")}'`;
    const GRID = 'Grid';
    const extraNames = [{ name: 'Grid', formula: `${SH}!$C$5:$${colL(NOTIME)}$${LG}` }];
    const tagOf = (h) => (h === 'nt' ? 'NT' : String(h).padStart(2, '0'));

    const tFormula = 'IF(INDIRECT("R[-1]C",FALSE)="","",IFERROR(INDEX(SecComp,MATCH(INDIRECT("R[-1]C",FALSE),SecKey,0)),"?"))';
    const courseLoadF = 'SUMPRODUCT(SUMIF(SecKey,INDIRECT("RC3:RC12",FALSE),SecLoad))';
    let r = 5;
    const rowsOfMember = {};
    const dvFor = (h) => ({ type: 'list', allowBlank: true, formulae: [`Lec_${tagOf(h)}`], showErrorMessage: true, errorStyle: 'warning', errorTitle: 'Check the section', error: 'This section is not at this hour, or it is already assigned. The list shows only sections not yet placed at this hour.' });
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
        ws.getCell(r, UCOL).value = { formula: `$A$${first}`, result: b.m.name }; ws.getCell(r + 1, UCOL).value = { formula: `$A$${first}`, result: b.m.name };
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
        ws.getCell(first, PCOL).value = senior; ws.getCell(first, QCOL).value = coop;
        ws.getCell(first, RCOL).value = { formula: `SUMIF($A$${mscFirst}:$A$${mscLast},$A$${first},$F$${mscFirst}:$F$${mscLast})`, result: mscH };
        [PCOL, QCOL].forEach((c) => {
          ws.getCell(first, c).font = { name: FONT, size: 11, bold: true, color: { argb: 'FF1F4E79' } };
          ws.getCell(first, c).dataValidation = c === QCOL ? { type: 'list', allowBlank: true, formulae: ['"0,1,2,3"'], showErrorMessage: true, errorTitle: 'Whole hours', error: 'Choose 0, 1, 2 or 3.' } : { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true, showErrorMessage: true, errorTitle: 'Whole hours', error: 'Type a whole number of hours, e.g. 0, 1, 2 or 3.' };
        });
        ws.getCell(first, RCOL).font = { name: FONT, size: 11, bold: true, color: { argb: 'FF1F4E79' } };
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
    if (lastGrid !== LG) throw new Error('layout mismatch');
    ws.getColumn(UCOL).hidden = true; ws.getColumn(VCOL).hidden = true; ws.getColumn(WCOL).hidden = true;
    // problems found by the site (clash, outside the member's hours) → red border on the cells
    (ctx.issues || []).forEach((i) => {
      if (!i.member || !rowsOfMember[i.member]) return;
      if (i.type === 'clash' || i.type === 'window') {
        [i.a, i.b].forEach((k) => { if (placed[k]) { const c = ws.getCell(placed[k].row, placed[k].col); c.font = Object.assign({}, c.font, { color: { argb: 'FFC00000' } }); c.border = { left: med, right: med, top: med, bottom: med }; } });
      }
    });

    // ---------- conditional formatting (live) ----------
    const isL = (a) => `AND(${a}<>"",ISERROR(SEARCH("(T)",${a})),ISERROR(SEARCH("(Lab)",${a})))`;
    const gridAbs = `$C$5:$${colL(NOTIME)}$${lastGrid}`;
    const keyOf = 'LEFT(C5,FIND(" ",C5&" ")-1)';
    ws.addConditionalFormatting({ ref: `C5:${colL(NOTIME)}${lastGrid}`, rules: [
      { type: 'expression', priority: 1, formulae: [`AND(${isL('C5')},COUNTIF(${gridAbs},C5)>1)`], style: { fill: fill('FF0000'), font: { color: { argb: 'FFFFFFFF' }, bold: true } } },
      { type: 'expression', priority: 2, formulae: [`AND(${isL('C5')},COUNTIFS($A$${chkFirst}:$A$${chkLast},${keyOf},$G$${chkFirst}:$G$${chkLast},"Outside its time")>0)`], style: { fill: fill('FF0000'), font: { color: { argb: 'FFFFFFFF' }, bold: true } } },
    ] });
    ws.addConditionalFormatting({ ref: `C5:${colL(NOTIME)}${lastGrid}`, rules: courseList.map((c, i) => ({ type: 'expression', priority: 3 + i, formulae: [`LEFT(C5,${c.length + 1})="${c}-"`], style: { fill: fill(D.colourFor(c)) } })) });

    // ---------- colour key ----------
    r = keyStart;
    ws.mergeCells(r, 1, r + 1, 2);
    ws.getCell(r, 1).value = 'Course colours'; ws.getCell(r, 1).font = { name: FONT, size: 11, bold: true }; ws.getCell(r, 1).alignment = center;
    used.forEach((c, i) => {
      const cell = ws.getCell(r + Math.floor(i / 11), 3 + (i % 11));
      cell.value = c; cell.fill = fill(D.colourFor(c)); cell.font = { name: FONT, size: 10, bold: true }; cell.alignment = center; cell.border = { left: thin, right: thin, top: thin, bottom: thin };
    });
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.5, header: 0.2, footer: 0.25 } };
    ws.pageSetup.printArea = `A1:${colL(LAST)}${keyEnd}`;
    ws.pageSetup.printTitlesRow = '3:4';
    noticeFooter(ws);

    const titleRow = (row, text, width) => { ws.mergeCells(row, 1, row, width || 9); ws.getCell(row, 1).value = text; ws.getCell(row, 1).font = { name: FONT, size: 12, bold: true, color: { argb: 'FF1F4E79' } }; };
    const headRow = (row, headers) => headers.forEach((h, i) => { if (h == null) return; const c = ws.getCell(row, 1 + i); c.value = h; c.font = { name: FONT, size: 10, bold: true }; c.fill = fill('D9E1F2'); c.alignment = center; c.border = { left: thin, right: thin, top: thin, bottom: thin }; });
    const cellStyle = (c, left) => { c.font = { name: FONT, size: 10 }; c.alignment = { vertical: 'middle', wrapText: true, horizontal: left ? 'left' : 'center' }; c.border = { left: thin, right: thin, top: thin, bottom: thin }; };

    // ---------- MSc / PhD (editable: rows added here count in the member's load) ----------
    titleRow(mscFirst - 2, 'MSc / PhD teaching — type or choose here; the hours are added to the member’s load and a clash with the timetable is shown');
    headRow(mscFirst - 1, ['Member', 'Course', 'Program', 'Days', 'Hour', 'Hours', 'Impact on timetable']);
    const memberNames = realMembers.map((m) => m.name);
    for (let i = 0; i < mscRows; i++) {
      const row = mscFirst + i, x = msc[i];
      for (let c = 1; c <= 7; c++) cellStyle(ws.getCell(row, c), c === 1 || c === 7);
      if (x) {
        ws.getCell(row, 1).value = memberName[x.member] || null; ws.getCell(row, 2).value = x.course || null; ws.getCell(row, 3).value = x.program || null;
        ws.getCell(row, 4).value = (x.days || []).map((d) => E.DAY_NAMES[d]).join(' ') || null;
        ws.getCell(row, 5).value = x.hour ? (x.hour > 12 ? x.hour - 12 : x.hour) : null; ws.getCell(row, 6).value = Number(x.hours) || 0;
      }
      ws.getCell(row, 5).numFmt = '0":00"';
      ws.getCell(row, 1).dataValidation = { type: 'list', allowBlank: true, formulae: ['Members'], showErrorMessage: true, errorStyle: 'warning', errorTitle: 'Member', error: 'Choose a member from the list.' };
      ws.getCell(row, 3).dataValidation = { type: 'list', allowBlank: true, formulae: ['"MSc,PhD"'] };
      ws.getCell(row, 5).dataValidation = { type: 'list', allowBlank: true, formulae: ['"8,9,10,11,1,2,3,4,5,6"'] };
      ws.getCell(row, 6).dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true, showErrorMessage: true, errorTitle: 'Hours', error: 'Type the number of hours.' };
      const at = `INDEX($C$5:$L$${lastGrid},MATCH($A${row},$A$5:$A$${lastGrid},0),MATCH($E${row},$C$4:$L$4,0))`;
      let res = '';
      if (x && x.member && x.hour) { const hit = Object.keys(assign).find((k) => assign[k] === x.member && secs[k].hour === x.hour); res = hit ? `Clash with ${hit} (L)` : 'No clash'; }
      ws.getCell(row, 7).value = { formula: `IF(OR($A${row}="",$E${row}=""),"",IFERROR(IF(${at}<>"","Clash with "&${at},"No clash"),"Check the member and the hour"))`, result: res };
    }
    ws.addConditionalFormatting({ ref: `G${mscFirst}:G${mscLast}`, rules: [{ type: 'expression', priority: 1, formulae: [`LEFT(G${mscFirst},5)="Clash"`], style: { font: { color: { argb: 'FFC00000' }, bold: true } } }] });

    // ---------- the check table (live): where every section is now ----------
    const status = statusMap(ctx);
    const lecs = Object.values(secs);
    const GS = `$G$${chkFirst}:$G$${chkLast}`, IS_ = `$I$${chkFirst}:$I$${chkLast}`;
    titleRow(chkFirst - 2, `Every section in the official ${ctx.off.sheetName} sheet: status and instructor update when you move a section in the timetable above`, 11);
    headRow(chkFirst - 1, ['Section', 'Type', 'Time', 'Days & rooms', 'Course name', 'T/Lab', 'Status', 'Assigned to', 'Change vs this draft', 'Official-file note', 'Is Reg rows']);
    ctx.off.lectures.forEach((k) => {
      const row = chkRow[k], s = secs[k];
      const L1 = `${k} (L)`, L2 = k;
      const cnt = `(COUNTIF(${GRID},"${L1}")+COUNTIF(${GRID},"${L2}"))`;
      const where = `((${GRID}="${L1}")+(${GRID}="${L2}"))`;
      const expCol = s.noTime ? NOTIME : s.hour != null ? HCOL[s.hour] : 0;
      const una = s.cat === 'none' || s.cat === 'asneeded' ? 'Not assigned to IS' : 'Unassigned';
      const asg = s.counts ? 'Assigned' : 'Assigned (counted as hours)';
      const a = assign[k];
      const realA = a && memberName[a] && a !== 'PT' && a !== 'HOLD';
      const cachedSt = realA ? asg : a === 'PT' ? 'Part-timer' : a === 'HOLD' ? 'ON-Hold' : una;
      const cachedName = realA ? memberName[a] : '';
      const time = s.proposed ? `${E.hourLabel(s.hour)} proposed${s.officialHour != null ? ` (official ${E.hourLabel(s.officialHour)})` : ' (no official time)'}` : s.hour != null ? E.hourLabel(s.hour) : 'No time';
      const vals = [k, s.prefix, time, E.describeMeetings(ctx.off, k), s.name, s.comp || ''];
      vals.forEach((v, i) => { const c = ws.getCell(row, 1 + i); c.value = v; cellStyle(c, i === 0 || i === 3 || i === 4); });
      if (s.proposed) ws.getCell(row, 3).font = { name: FONT, size: 10, italic: true, color: { argb: 'FFC65911' } };
      ws.getCell(row, VCOL).value = { formula: `IF(${cnt}=1,SUMPRODUCT(${where}*ROW(${GRID})),0)`, result: placed[k] ? placed[k].row : 0 };
      ws.getCell(row, WCOL).value = cachedName;
      const own = `INDEX($${colL(UCOL)}:$${colL(UCOL)},$${colL(VCOL)}${row})`;
      ws.getCell(row, 7).value = { formula: `IF(${cnt}=0,"${una}",IF(${cnt}>1,"Duplicate",IF(${own}="ON-Hold","ON-Hold",IF(${own}="Part-timers","Part-timer",IF(AND(${expCol}>0,SUMPRODUCT(${where}*COLUMN(${GRID}))<>${expCol}),"Outside its time","${asg}")))))`, result: cachedSt };
      ws.getCell(row, 8).value = { formula: `IF(LEFT(G${row},8)="Assigned",${own},"")`, result: cachedName };
      ws.getCell(row, 9).value = { formula: `IF(H${row}=$${colL(WCOL)}${row},"","Changed: was "&IF($${colL(WCOL)}${row}="","(none)",$${colL(WCOL)}${row})&", now "&IF(H${row}="","(none)",H${row}))`, result: '' };
      ws.getCell(row, 10).value = (ctx.notes[k] || []).map((n) => n.text).join('; ') || null;
      ws.getCell(row, 11).value = rowSpan(ctx.off, k);
      [7, 8, 9, 10, 11].forEach((c) => cellStyle(ws.getCell(row, c), c === 8 || c === 9 || c === 10));
      ws.getCell(row, 7).font = { name: FONT, size: 10, bold: true };
    });
    ws.addConditionalFormatting({ ref: `G${chkFirst}:G${chkLast}`, rules: [
      { type: 'expression', priority: 1, formulae: [`OR(G${chkFirst}="Unassigned",G${chkFirst}="Duplicate",G${chkFirst}="Outside its time")`], style: { fill: fill('FFC7CE'), font: { color: { argb: 'FF9C0006' }, bold: true } } },
      { type: 'expression', priority: 2, formulae: [`LEFT(G${chkFirst},8)="Assigned"`], style: { font: { color: { argb: 'FF2E7D32' }, bold: true } } },
    ] });
    ws.addConditionalFormatting({ ref: `I${chkFirst}:I${chkLast}`, rules: [{ type: 'expression', priority: 1, formulae: [`I${chkFirst}<>""`], style: { fill: fill('FFF2CC'), font: { color: { argb: 'FFC65911' }, bold: true } } }] });

    // ---------- summary (live) ----------
    titleRow(sumFirst - 2, 'Summary — updates when you change the timetable above');
    headRow(sumFirst - 1, ['Item', null, null, null, null, 'Count']);
    const reqTotal = realMembers.reduce((a, m) => a + (Number(m.required) || 0), 0);
    const memberTotalCells = realMembers.map((m) => `${colL(TCOL)}${rowsOfMember[m.id].first}`);
    const cnt0 = (f) => lecs.filter(f).length;
    const assignedNow = realMembers.reduce((a, m) => a + sectionsOf(m.id).filter((k) => secs[k].counts).length, 0);
    const cachedSt = (s) => { const a = assign[s.key]; return a && memberName[a] && a !== 'PT' && a !== 'HOLD' ? 'A' : a === 'PT' ? 'P' : a === 'HOLD' ? 'H' : (s.cat === 'none' || s.cat === 'asneeded') ? 'N' : 'U'; };
    const sums = [
      [`Sections in the ${ctx.off.sheetName} sheet (lectures)`, lecs.length],
      ['Assigned to members', { formula: `COUNTIF(${GS},"Assigned*")`, result: cnt0((s) => cachedSt(s) === 'A') }],
      ['Part-timers', { formula: `COUNTIF(${GS},"Part-timer")`, result: cnt0((s) => cachedSt(s) === 'P') }],
      ['ON-Hold', { formula: `COUNTIF(${GS},"ON-Hold")`, result: cnt0((s) => cachedSt(s) === 'H') }],
      ['Not assigned to the department (shared or not ours)', { formula: `COUNTIF(${GS},"Not assigned to IS")`, result: cnt0((s) => cachedSt(s) === 'N') }],
      ['Unassigned (must be assigned)', { formula: `COUNTIF(${GS},"Unassigned")`, result: cnt0((s) => cachedSt(s) === 'U') }],
      ['Duplicated or outside their time', { formula: `COUNTIF(${GS},"Duplicate")+COUNTIF(${GS},"Outside its time")`, result: 0 }],
      ['Sections changed in this file (vs this draft)', { formula: `COUNTIF(${IS_},"Changed*")`, result: 0 }],
      ['Sections assigned / required (members)', { formula: `(${memberTotalCells.join('+') || 0})&" / ${reqTotal}"`, result: `${assignedNow} / ${reqTotal}` }],
    ];
    sums.forEach(([label, v], i) => {
      const row = sumFirst + i;
      ws.mergeCells(row, 1, row, 5);
      const a = ws.getCell(row, 1); a.value = label; cellStyle(a, true);
      const c = ws.getCell(row, 6); c.value = v; cellStyle(c); c.font = { name: FONT, size: 10, bold: true };
    });
    ws.addConditionalFormatting({ ref: `F${sumFirst + 5}:F${sumFirst + 6}`, rules: [{ type: 'expression', priority: 1, formulae: [`F${sumFirst + 5}>0`], style: { fill: fill('FFC7CE'), font: { color: { argb: 'FF9C0006' }, bold: true } } }] });

    // ---------- Is Reg ----------
    await buildIsReg(wb, ctx, status, { SH, chkRow });
    noticeFooter(wb.getWorksheet('Is Reg'));
    // ---------- Time requests ----------
    buildTimeRequests(wb, ctx, status, { SH, chkFirst, chkLast });
    noticeFooter(wb.getWorksheet('Time requests'));
    // ---------- Official notes ----------
    buildNotes(wb, ctx);
    noticeFooter(wb.getWorksheet('Official file notes'));
    // ---------- Lists (hidden, last sheet) ----------
    const lists = wb.addWorksheet('Lists', { state: 'hidden' });
    lists.getRow(1).values = ['SecKey', 'SecLoad', 'SecComp', 'Members'];
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
    memberNames.forEach((n, i) => { lists.getCell(2 + i, 4).value = n; });
    wb.definedNames.add(`Lists!$D$2:$D$${Math.max(2, 1 + memberNames.length)}`, 'Members');
    // per hour: all candidates (Cand_xx), rank of the ones not placed yet, and the compact list the dropdown shows (Lec_xx)
    [...E.HOURS, 'nt'].forEach((h, i) => {
      const tag = tagOf(h);
      const cC = 6 + i * 3, rC = cC + 1, kC = cC + 2;
      const cand = Object.values(secs).filter((s) => (h === 'nt' ? (s.noTime || (s.needsTime && s.hour == null)) : (s.hour === h && !s.noTime))).map((s) => (s.noTime ? s.key : lLabel(s.key)));
      const n = Math.max(1, cand.length), lastR = 1 + n;
      lists.getCell(1, cC).value = `Cand_${tag}`; lists.getCell(1, rC).value = `Rank_${tag}`; lists.getCell(1, kC).value = `Lec_${tag}`;
      const free = cand.filter((k) => !Object.keys(placed).some((pk) => (secs[pk].noTime ? pk : lLabel(pk)) === k));
      for (let j = 0; j < n; j++) {
        const row = 2 + j;
        lists.getCell(row, cC).value = cand[j] || null;
        const rankRes = cand[j] && free.includes(cand[j]) ? free.indexOf(cand[j]) + 1 : '';
        lists.getCell(row, rC).value = { formula: `IF(${colL(cC)}${row}="","",IF(COUNTIF(Grid,${colL(cC)}${row})=0,MAX($${colL(rC)}$1:${colL(rC)}${row - 1})+1,""))`, result: rankRes };
        lists.getCell(row, kC).value = { formula: `IFERROR(INDEX($${colL(cC)}$2:$${colL(cC)}$${lastR},MATCH(ROW()-1,$${colL(rC)}$2:$${colL(rC)}$${lastR},0)),"")`, result: free[j] || '' };
      }
      extraNames.push({ name: `Cand_${tag}`, formula: `Lists!$${colL(cC)}$2:$${colL(cC)}$${lastR}` });
      extraNames.push({ name: `Lec_${tag}`, formula: `OFFSET(Lists!$${colL(kC)}$2,0,0,MAX(1,COUNTIF(Lists!$${colL(kC)}$2:$${colL(kC)}$${lastR},"?*")),1)` });
    });
    wb.__extraNames = extraNames;
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

  async function buildIsReg(wb, ctx, status, link) {
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
      const cr = link && link.chkRow[lk];
      const nm = st.st.startsWith('Assigned') && !st.red ? st.name : '';
      const sc = ws.getCell(row.excelRow, lastSrcCol + 1);
      if (cr) {
        nameCell.value = { formula: `IF(LEFT(${link.SH}!$G$${cr},8)="Assigned",${link.SH}!$H$${cr},"")`, result: nm };
        sc.value = { formula: `${link.SH}!$G$${cr}`, result: st.st.replace(' – conflict', '') };
      } else { nameCell.value = nm || null; sc.value = st.st; }
      sc.font = { name: FONT, size: 10, bold: true };
      const notes = (ctx.notes[lk] || []).map((n) => n.text);
      if (s && s.proposed) notes.unshift(`Proposed time ${E.hourLabel(s.hour)}${s.officialHour != null ? ` instead of ${E.hourLabel(s.officialHour)}` : ''} (needs registration approval)`);
      const nc = ws.getCell(row.excelRow, lastSrcCol + 2);
      nc.value = notes.join('; ') || null; nc.font = { name: FONT, size: 9, color: { argb: 'FF595959' } }; nc.alignment = { wrapText: false, vertical: 'middle' };
    });
    const first = off.headerRow + 1, last = Math.max(first, ...off.rows.map((x) => x.excelRow));
    const L = colL(instrCol), M = colL(lastSrcCol + 1);
    ws.addConditionalFormatting({ ref: `${L}${first}:${L}${last}`, rules: [{ type: 'expression', priority: 1, formulae: [`${L}${first}=""`], style: { fill: fill('F2F2F2') } }] });
    ws.addConditionalFormatting({ ref: `${M}${first}:${M}${last}`, rules: [
      { type: 'expression', priority: 1, formulae: [`OR(${M}${first}="Unassigned",${M}${first}="Duplicate",${M}${first}="Outside its time")`], style: { font: { color: { argb: 'FFC00000' }, bold: true } } },
      { type: 'expression', priority: 2, formulae: [`LEFT(${M}${first},8)="Assigned"`], style: { font: { color: { argb: 'FF2E7D32' }, bold: true } } },
    ] });
  }

  function buildTimeRequests(wb, ctx, status, link) {
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
      if (link) ws.getCell(r, 4).value = { formula: `IFERROR(INDEX(${link.SH}!$H$${link.chkFirst}:$H$${link.chkLast},MATCH($A${r},${link.SH}!$A$${link.chkFirst}:$A$${link.chkLast},0)),"")`, result: (status[s.key] && status[s.key].name) || '' };
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

  /**
   * "Format for printing" service: the grid exactly as read (readGridRaw), laid out and coloured, nothing changed.
   * fmt: {title, grid, sheetName}
   */
  async function buildFormatted(ExcelJS, fmt) {
    const g = fmt.grid;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'IS Timetable';
    const ws = wb.addWorksheet(String(fmt.sheetName || 'Timetable').trim().slice(0, 31) || 'Timetable', { views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }] });
    const keep = g.extras.map((_, i) => g.blocks.some((b) => b.rows.some((r) => r.extras[i] !== ''))).map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    const hasUnit = !!g.unitLabel;
    const col = { name: 1 };
    let c = 2;
    if (hasUnit) col.unit = c++;
    const hcol = {}; g.hours.forEach((h) => { hcol[h] = c++; });
    if (g.hasNoTime) col.nt = c++;
    const ecol = {}; keep.forEach((i) => { ecol[i] = c++; });
    const last = c - 1;
    ws.getColumn(1).width = 30; if (hasUnit) ws.getColumn(col.unit).width = 8;
    g.hours.forEach((h) => { ws.getColumn(hcol[h]).width = 16; }); if (g.hasNoTime) ws.getColumn(col.nt).width = 16;
    keep.forEach((i) => { ws.getColumn(ecol[i]).width = 12; });
    ws.mergeCells(1, 1, 1, last); ws.getCell(1, 1).value = fmt.title || 'Teaching timetable';
    ws.getCell(1, 1).font = { name: FONT, size: 14, bold: true, color: { argb: 'FF1F4E79' } }; ws.getRow(1).height = 26; ws.getCell(1, 1).alignment = { vertical: 'middle' };
    ws.mergeCells(2, 1, 2, last); ws.getCell(2, 1).value = NOTICE;
    ws.getCell(2, 1).font = { name: FONT, size: 9, italic: true, color: { argb: 'FF7F7F7F' } };
    const firstH = hcol[g.hours[0]], lastH = g.hasNoTime ? col.nt : hcol[g.hours[g.hours.length - 1]];
    ws.mergeCells(3, firstH, 3, lastH); ws.getCell(3, firstH).value = 'Timeslots';
    ws.getCell(3, firstH).fill = fill('0000FF'); ws.getCell(3, firstH).font = { name: FONT, size: 13, bold: true, color: { argb: 'FFFFFFFF' } }; ws.getCell(3, firstH).alignment = center;
    if (keep.length) {
      const a = ecol[keep[0]], b = ecol[keep[keep.length - 1]];
      if (b > a) ws.mergeCells(3, a, 3, b);
      ws.getCell(3, a).value = 'Teaching Load'; ws.getCell(3, a).font = { name: FONT, size: 13, bold: true }; ws.getCell(3, a).alignment = center;
      for (let x = a; x <= b; x++) ws.getCell(3, x).fill = fill('EAD1DC');
    }
    ws.getRow(3).height = 22; ws.getRow(4).height = 40;
    ws.getCell(4, 1).value = 'Member'; if (hasUnit) ws.getCell(4, col.unit).value = g.unitLabel;
    g.hours.forEach((h) => { const cell = ws.getCell(4, hcol[h]); cell.value = h > 12 ? h - 12 : h; cell.numFmt = '0":00"'; });
    if (g.hasNoTime) ws.getCell(4, col.nt).value = 'No time';
    keep.forEach((i) => { ws.getCell(4, ecol[i]).value = g.extras[i]; ws.getCell(4, ecol[i]).fill = fill('EAD1DC'); });
    for (let x = 1; x <= last; x++) { const cell = ws.getCell(4, x); cell.font = { name: FONT, size: 11, bold: true }; cell.alignment = center; cell.border = { top: thin, left: thin, right: thin, bottom: med }; if (!cell.fill || !cell.fill.fgColor) cell.fill = fill('F2F2F2'); }
    let r = 5;
    g.blocks.forEach((b) => {
      const first = r;
      b.rows.forEach((row, ri) => {
        ws.getRow(r).height = 20;
        const put = (x, v, isGrid) => {
          const cell = ws.getCell(r, x);
          cell.value = v === '' ? null : v;
          cell.alignment = center;
          cell.font = { name: FONT, size: ri === 0 ? 11 : 10, bold: ri === 0 && isGrid, color: { argb: ri === 0 ? 'FF000000' : 'FF404040' } };
          cell.border = { left: thin, right: thin, top: ri === 0 ? med : thin, bottom: thin };
          const code = isGrid && v !== '' ? E.courseIn(v) : null;
          if (code) cell.fill = fill(D.colourFor(code));
        };
        put(1, '', false);
        if (hasUnit) put(col.unit, row.unit, false);
        g.hours.forEach((h) => put(hcol[h], row.cells[h], true));
        if (g.hasNoTime) put(col.nt, row.nt, true);
        keep.forEach((i) => put(ecol[i], row.extras[i], false));
        r++;
      });
      const lastR = r - 1;
      if (lastR > first) ws.mergeCells(first, 1, lastR, 1);
      const nc = ws.getCell(first, 1);
      nc.value = b.name; nc.font = { name: FONT, size: 12, bold: true }; nc.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 };
      for (let x = 1; x <= last; x++) { const cell = ws.getCell(lastR, x); cell.border = Object.assign({}, cell.border, { bottom: med }); }
    });
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.5, header: 0.2, footer: 0.25 } };
    ws.pageSetup.printArea = `A1:${colL(last)}${r - 1}`;
    ws.pageSetup.printTitlesRow = '3:4';
    noticeFooter(ws);
    return wb;
  }

  /** Save the workbook and add the defined names ExcelJS cannot write (OFFSET lists, the grid range). */
  async function toBuffer(wb, JSZip) {
    const buf = await wb.xlsx.writeBuffer();
    const names = wb.__extraNames || [];
    if (!names.length) return buf;
    const zip = await JSZip.loadAsync(buf);
    let xml = await zip.file('xl/workbook.xml').async('string');
    const escX = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const add = names.map((n) => `<definedName name="${n.name}">${escX(n.formula)}</definedName>`).join('');
    if (xml.includes('</definedNames>')) xml = xml.replace('</definedNames>', add + '</definedNames>');
    else xml = xml.replace('</sheets>', '</sheets><definedNames>' + add + '</definedNames>');
    zip.file('xl/workbook.xml', xml);
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }

  return { build, statusMap, buildFormatted, toBuffer, NOTICE };
});
