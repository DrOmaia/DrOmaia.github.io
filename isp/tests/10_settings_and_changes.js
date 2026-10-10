const { chromium } = require('playwright'); const fs = require('fs'); const SP = __dirname, D = SP + '/data/';
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1500, height: 2300 }, acceptDownloads: true }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8099/isp/');
  await page.evaluate((s) => localStorage.setItem('isp-timetable-v1', s), fs.readFileSync(SP + '/state1.json', 'utf8'));
  await page.reload(); await page.click('[data-act=resumeAuto]'); await page.waitForFunction(() => window.ISPApp.runtime.off);
  await page.evaluate(() => { window.ISPApp.state.sent = null; });
  await page.click('[data-act=go][data-step="4"]'); await page.waitForSelector('.chg-panel');
  const box = () => page.$eval('.chg-panel', (e) => e.innerText + (e.querySelector('textarea') ? e.querySelector('textarea').value : ''));
  let t = await box(); console.log(t.split('\n').slice(0, 3).join(' | '));
  ok(/Compared with the first version/.test(t) && /No changes/.test(t), 'proposal page shows the list, compared with the first version');
  const drag = async (fromSel, toSel) => {
    const a = await page.locator(fromSel).first().boundingBox(); const bb = await page.locator(toSel).first().boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + 20, a.y + 20, { steps: 3 }); await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 8 });
    console.log('tip:', await page.$eval('#dragTip', (e) => e.textContent).catch(() => '')); await page.mouse.up(); await page.waitForTimeout(150);
  };
  const ids = await page.evaluate(() => Object.fromEntries(window.ISPApp.state.members.map((m) => [m.name.split(' ').pop(), m.id])));
  const k = await page.$eval(`td.slot[data-mid="${ids.Saleh}"] .cell[data-key]`, (e) => e.dataset.key);
  const h = await page.$eval(`td.slot[data-mid="${ids.Saleh}"] .cell[data-key]`, (e) => e.closest('td').dataset.h);
  await drag(`.cell[data-key="${k}"]`, `td.slot[data-mid="${ids.Adel}"][data-h="${h}"]`);
  t = await box(); console.log(t); ok(/1- Please reassign .* to Mr\. Nasser Adel/.test(t), 'one move → one line');
  await drag(`.cell[data-key="${k}"]`, `tr.na td.slot[data-h="${h}"]`);
  await drag(`.cell[data-key="${k}"]`, `td.slot[data-mid="${ids.Saleh}"][data-h="${h}"]`);
  t = await box(); ok(/No changes/.test(t), 'moves that come back to the start → no line');
  // ---- settings file
  await page.click('[data-act=go][data-step="3"]');
  await page.fill(`input[data-chg=mf][data-id="${ids.Saleh}"][data-field=required]`, '5'); await page.press(`input[data-chg=mf][data-id="${ids.Saleh}"][data-field=required]`, 'Tab');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=saveSettings]')]);
  await dl.saveAs(SP + '/settings.json');
  const sj = JSON.parse(fs.readFileSync(SP + '/settings.json', 'utf8'));
  ok(sj.app === 'isp-settings' && sj.members.length === 11 && sj.members.find((m) => /Saleh/.test(m.name)).required === 5, 'settings file saved');
  // new project in a clean browser
  const p2 = await (await b.newContext({ viewport: { width: 1500, height: 1500 } })).newPage(); p2.on('pageerror', (e) => errors.push(e.message));
  await p2.goto('http://127.0.0.1:8099/isp/'); await p2.click('#langBtn');
  await p2.setInputFiles('#settingsInput', SP + '/settings.json');
  ok(/will be applied when you start/.test(await p2.$eval('main', (e) => e.innerText)), 'start page: settings ready');
  await p2.click('[data-act=pick][data-side=male]'); await p2.fill('#termIn', '263'); await p2.click('[data-act=start]');
  for (const [k2, f] of [['faculty', 'Total Sections.xlsx'], ['official', 'T262_CCIS_TIMETABLE.xlsx'], ['current', '261 male timetable.xlsx']]) {
    await p2.setInputFiles(`input[data-file=${k2}]`, D + f);
    await p2.waitForFunction((k2) => window.ISPApp.state.files[k2] && document.querySelectorAll('.upl.ok').length >= ({ faculty: 1, official: 2, current: 3 })[k2], k2, { timeout: 20000 });
  }
  const st = await p2.evaluate(() => window.ISPApp.state.members.map((m) => ({ n: m.name, r: m.required, a: m.allowed, res: m.res, f: m.first, pr: m.prefs })));
  const sal = st.find((m) => /Saleh/.test(m.n)), om = st.find((m) => /Omaia/.test(m.n)), ba = st.find((m) => /Bayan/.test(m.n));
  console.log(JSON.stringify({ sal, om, ba }));
  ok(st.length === 11 && sal.r === 5, 'faculty file did not override the settings (Saleh 5)');
  ok(om.a.join() === 'IS201,IS492' && om.f === 10 && ba.res[0] === 'IS201-1465', 'limits and reserved section kept');
  ok(!errors.length, 'no errors ' + errors.join('|'));
  await b.close();
})();
