const { chromium } = require('playwright');
const SP = __dirname, D = SP + '/data/';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8099/isp/');
  await page.click('#langBtn'); // English
  await page.click('[data-act=pick][data-side=male]'); await page.fill('#termIn', '262'); await page.click('[data-act=start]');
  for (const [k, f] of [['faculty', 'Total Sections.xlsx'], ['official', 'T262_CCIS_TIMETABLE.xlsx'], ['current', '261 male timetable.xlsx'], ['prefs', '262 male Preferences.xlsx']]) {
    await page.setInputFiles(`input[data-file=${k}]`, D + f);
    await page.waitForFunction((k) => window.ISPApp.state.files[k] && document.querySelectorAll('.upl.ok').length >= ({ faculty: 1, official: 2, current: 3, prefs: 4 })[k], k, { timeout: 20000 });
  }
  const st = () => page.evaluate(() => window.ISPApp.state);
  let S = await st();
  const id = (n) => S.members.find((m) => m.name.includes(n)).id;
  console.log('members', S.members.length, S.members.map((m) => m.name + ':' + m.required).join(' | '));
  // settings
  await page.click('[data-act=go][data-step="3"]');
  const om = id('Omaia'), ba = id('Bayan');
  await page.click(`[data-act=mOpen][data-id=${om}]`); await page.click(`[data-act=mOpen][data-id=${ba}]`);
  await page.selectOption(`select[data-chg=chipAdd][data-id=${om}][data-field=allowed]`, 'IS201');
  await page.selectOption(`select[data-chg=chipAdd][data-id=${om}][data-field=allowed]`, 'IS492');
  await page.selectOption(`select[data-chg=chipAdd][data-id=${ba}][data-field=allowed]`, 'IS201');
  await page.selectOption(`select[data-chg=resv][data-id=${ba}][data-i="0"]`, 'IS201-1465');
  await page.selectOption(`select[data-chg=chipAdd][data-id=${ba}][data-field=allowed]`, 'IS241');
  const opts = await page.$$eval(`select[data-chg=resv][data-id=${om}][data-i="0"] option`, (os) => os.map((o) => (o.disabled ? '[x] ' : '') + o.textContent));
  console.log('Omaia IS201 options:\n  ' + opts.join('\n  '));
  // Omaia: first class 10 → 8:00 sections go away
  await page.selectOption(`select[data-chg=mf][data-id=${om}][data-field=first]`, '10');
  const opts2 = await page.$$eval(`select[data-chg=resv][data-id=${om}][data-i="0"] option`, (os) => os.map((o) => o.textContent));
  console.log('after first=10:', opts2.join(' / '));
  // Bayan narrows hours so 1465 (11:00) is outside → warning
  await page.selectOption(`select[data-chg=mf][data-id=${ba}][data-field=last]`, '10');
  console.log('warn:', await page.$$eval('.reswarn', (e) => e.map((x) => x.textContent)));
  await page.selectOption(`select[data-chg=mf][data-id=${ba}][data-field=last]`, '18');
  await page.screenshot({ path: SP + '/s_settings.png', fullPage: false, clip: { x: 0, y: 250, width: 1500, height: 700 } });
  // proposal
  await page.click('[data-act=go][data-step="4"]');
  await page.waitForFunction(() => window.ISPApp.state.built && !document.querySelector('[data-act=rebuild][disabled]'), null, { timeout: 60000 });
  const res = await page.evaluate(() => {
    const A = window.ISPApp, S = A.state, { secs, assign, ev } = A.snapshot();
    return S.members.map((m) => ({ n: m.name, req: m.required, counted: ev.per[m.id].counted, keys: Object.keys(assign).filter((k) => assign[k] === m.id).join(',') }));
  });
  res.forEach((r) => console.log(`${r.n}: ${r.counted}/${r.req}  ${r.keys}`));
  const rowsOrder = await page.$$eval('table.tt tbody tr', (rs) => rs.map((r) => r.dataset.mid));
  console.log('first row', rowsOrder[0], 'last row', rowsOrder[rowsOrder.length - 1]);
  console.log('NA row cells:', await page.$$eval('tr.na .cell b', (e) => e.map((x) => x.textContent).join(', ')));
  const cut = await page.$$eval('table.tt .cell b, table.tt .cell span', (e) => e.filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent));
  console.log('cut texts:', cut);
  console.log('locks:', await page.$$eval('.cell .rlock', (e) => e.map((x) => x.closest('.cell').dataset.key)));
  await page.screenshot({ path: SP + '/s_prop.png', fullPage: true });
  require('fs').writeFileSync(SP + '/state1.json', JSON.stringify(await st()));
  console.log('errors:', errors);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
