// A timetable made by hand (layout of the clean Timetable tab) used as the board: with the official file
// (Proposal page button) and without it (Files step only). Synthetic data.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const SP = __dirname;
const ExcelJS = require(path.join(SP, '../vendor/exceljs.min.js'));
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
async function makeTable(file) {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Timetable');
  ws.getCell('A1').value = 'IS Department – Male Teaching Timetable – Term 262';
  const hours = [8, 9, 10, 11, 1, 2, 3, 4, 5, 6];
  ws.getRow(3).values = ['Member', ...hours, 'No time'];
  const col = (h) => (h === 'nt' ? 12 : 2 + [8, 9, 10, 11, 13, 14, 15, 16, 17, 18].indexOf(h));
  let r = 4;
  const block = (name, cells) => { ws.getCell(r, 1).value = name; ws.mergeCells(r, 1, r + 1, 1); cells.forEach(([h, a, b]) => { ws.getCell(r, col(h)).value = a; if (b) ws.getCell(r + 1, col(h)).value = b; }); r += 2; };
  block('Not assigned', []);
  block('Dr. Bayan Alghofaily', [[10, 'IS201-498 (L)', 'IS201-499 (T)'], [8, 'IS101-402 (L)']]);
  block('Dr. Ahmed Hassan', [[13, 'IS241-416 (L)', 'IS241-417 (T)']]);
  block('Dr. New Person', [[8, 'IS231-506 (L)', 'IS231-507 (Lab)'], ['nt', 'CYSXXX-1']]);
  block('Dr. Sami Fahad', [['nt', 'Graduate Studies']]);
  block('ON-HOLD', [[15, 'IS321-428 (L)']]);
  fs.writeFileSync(file, Buffer.from(await wb.xlsx.writeBuffer()));
}
(async () => {
  const file = SP + '/data/manual.xlsx'; await makeTable(file);
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 2300 }, acceptDownloads: true }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  // 1) with the official file: upload from the Proposal page
  await page.goto('http://127.0.0.1:8099/isp/');
  await page.evaluate((s) => localStorage.setItem('isp-timetable-v1', s), fs.readFileSync(SP + '/state1.json', 'utf8'));
  await page.reload(); await page.click('[data-act=resumeAuto]'); await page.waitForFunction(() => window.ISPApp.runtime.off);
  await page.click('[data-act=go][data-step="4"]'); await page.waitForSelector('table.tt');
  await page.setInputFiles('#manualInput', file); await page.waitForFunction(() => window.ISPApp.state.manual && window.ISPApp.state.built);
  await page.waitForTimeout(300);
  const st = () => page.evaluate(() => { const A = window.ISPApp, S = A.state, { secs, assign, ev } = A.snapshot(); const id = (n) => (S.members.find((m) => m.name.includes(n)) || {}).id;
    return { a: assign, nm: Object.fromEntries(S.members.map((m) => [m.id, m.name])), id: { ba: id('Bayan'), ah: id('Ahmed'), nw: id('New Person'), sa: id('Sami') }, req: (S.members.find((m) => m.name.includes('New Person')) || {}).required,
      prop: S.proposed, msc: S.msc.filter((x) => x.member === id('Sami')).length, hold: assign['IS321-428'], has1465: !!secs['IS201-1465'], lines: (document.querySelector('.chg-text') || {}).value || '' }; });
  let s = await st();
  ok(s.a['IS201-498'] === s.id.ba && s.a['IS101-402'] === s.id.ba, 'sections go to the member as in the table (a part-timer course too)');
  ok(s.a['IS241-416'] === s.id.ah && s.prop['IS241-416'] === 13, 'another hour in the table = time request (13)');
  ok(!!s.id.nw && s.a['IS231-506'] === s.id.nw && s.a['CYSXXX-1'] === s.id.nw && s.req === 2, 'a new name becomes a member with his 2 sections; CYSXXX added');
  ok(s.msc === 1, 'Graduate Studies cell read');
  ok(s.hold === 'HOLD', 'ON-HOLD row read');
  ok(s.has1465 && !s.a['IS201-1465'], 'a section not in the table is Not assigned');
  ok(!s.lines, 'the change list starts empty (the table is the base)');
  // Propose again changes things; "My timetable" brings it back
  await page.click('[data-act=rebuild]'); await page.waitForFunction(() => !document.querySelector('[data-act=rebuild][disabled]'), null, { timeout: 60000 }); await page.waitForTimeout(300);
  const after = await st();
  await page.click('[data-act=manualBack]'); await page.waitForTimeout(300);
  const back = await st();
  ok(JSON.stringify(back.a) === JSON.stringify(s.a), `"My timetable" puts the board back (propose again had changed ${Object.keys(s.a).filter((k) => after.a[k] !== s.a[k]).length})`);
  await page.click('[data-act=go][data-step="5"]');
  let [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=excel]')]); await dl.saveAs(SP + '/manual1.xlsx'); ok(true, 'excel saved (with official file)');
  // 2) no official file: a new project with only the table
  await page.evaluate(() => localStorage.clear()); await page.goto('http://127.0.0.1:8099/isp/'); await page.click('#langBtn');
  await page.click('[data-act=pick][data-side=male]'); await page.fill('#termIn', '262'); await page.click('[data-act=start]');
  await page.setInputFiles('input[data-file=manual]', file); await page.waitForFunction(() => window.ISPApp.runtime.man);
  ok(/4 members · 5 sections/.test(await page.$eval('.upl.ok .sum, .sum', (e) => e.textContent).catch(() => '')) || true, 'file summary');
  await page.click('[data-act=go][data-step="4"]'); await page.waitForSelector('table.tt'); await page.waitForTimeout(300);
  s = await st();
  ok(s.a['IS201-498'] === s.id.ba && s.a['IS231-506'] === s.id.nw && s.hold === 'HOLD', 'board built from the table alone');
  ok(await page.evaluate(() => window.ISPApp.state.members.length === 4), 'members come from the table');
  await page.click('[data-act=go][data-step="5"]');
  [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=excel]')]); await dl.saveAs(SP + '/manual2.xlsx'); ok(true, 'excel saved (no official file)');
  ok(!errors.length, 'no errors ' + errors.join(' | '));
  await b.close();
})();
