// The female side uses the same code: build a female project from the sample files and check the result.
const { chromium } = require('playwright'); const fs = require('fs'); const SP = __dirname, D = SP + '/data/';
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 2300 }, acceptDownloads: true }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8099/isp/'); await page.click('#langBtn');
  await page.click('[data-act=pick][data-side=female]'); await page.fill('#termIn', '262'); await page.click('[data-act=start]');
  for (const [k, f] of [['faculty', 'Total Sections.xlsx'], ['official', 'T262_CCIS_TIMETABLE.xlsx'], ['current', '261 male timetable.xlsx']]) {
    await page.setInputFiles(`input[data-file=${k}]`, D + f);
    await page.waitForFunction((k) => window.ISPApp.state.files[k] && document.querySelectorAll('.upl.ok').length >= ({ faculty: 1, official: 2, current: 3 })[k], k, { timeout: 20000 });
  }
  await page.click('[data-act=go][data-step="4"]');
  await page.waitForFunction(() => window.ISPApp.state.built && !document.querySelector('[data-act=rebuild][disabled]'), null, { timeout: 60000 });
  ok(await page.$('tr.na') && await page.$('tr.hold') && await page.$('[data-act=lock]') && await page.$('.chg-panel'), 'female: Not assigned, ON-HOLD, Lock, change list');
  const S = await page.evaluate(() => { const { ev } = window.ISPApp.snapshot(); return window.ISPApp.state.members.map((m) => [ev.per[m.id].counted, m.required]); });
  ok(S.every(([c, r]) => r === '' || c <= Number(r)), 'female: counts never exceeded');
  // one move so the email has a line
  const k = await page.$eval('td.slot .cell[data-key]', (e) => e.dataset.key);
  await page.click(`.cell[data-key="${k}"]`); await page.click('#pop [data-act=put][data-mid=NA]').catch(() => {});
  await page.click('[data-act=go][data-step="5"]');
  await page.evaluate(() => { window.ISPApp.state.sent = null; window.ISPApp.render(); }); // compare with the official file
  const v = await page.$eval('.chg-text', (e) => e.value).catch(() => '');
  ok(/^Dear Ms\. Deem,/.test(v) && /Regards,$/.test(v), 'female email');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=excel]')]); await dl.saveAs(SP + '/female.xlsx');
  ok(!errors.length, 'no errors ' + errors.join('|'));
  await b.close();
})();
