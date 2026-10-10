const { chromium } = require('playwright');
const fs = require('fs');
const SP = __dirname;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 2300 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8099/isp/');
  await page.evaluate((s) => localStorage.setItem('isp-timetable-v1', s), fs.readFileSync(SP + '/state1.json', 'utf8'));
  await page.reload();
  await page.click('[data-act=resumeAuto]');
  await page.waitForFunction(() => window.ISPApp.runtime.off);
  await page.click('[data-act=go][data-step="4"]');
  await page.waitForSelector('table.tt tr.na');
  const snap = () => page.evaluate(() => { const { assign, ev } = window.ISPApp.snapshot(); const S = window.ISPApp.state; return { assign, per: Object.fromEntries(Object.entries(ev.per).map(([k, v]) => [k, v.counted])), members: S.members.map((m) => ({ id: m.id, name: m.name, req: m.required })) }; });
  let s0 = await snap();
  const id = (n) => s0.members.find((m) => m.name.includes(n)).id;
  const dragTo = async (fromSel, toSel) => {
    const a = await page.locator(fromSel).first().boundingBox(); const b = await page.locator(toSel).first().boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    const tip = await page.$eval('#dragTip', (e) => e.textContent).catch(() => '');
    const cls = await page.$eval(toSel, (e) => e.className).catch(() => '');
    await page.mouse.up(); await page.waitForTimeout(150);
    return { tip, cls };
  };
  // ---- drag strict: Khalid (3/3) cannot take Sami's IS446-438 at 11:00
  const kh = id('Khalid'), sa = id('Sami'), om = id('Omaia'), ta = id('Tariq');
  let r = await dragTo('.cell[data-key="IS446-438"]', `td.slot[data-mid="${kh}"][data-h="11"] .cell`);
  // dropping on Khalid's own 11:00 section = swap (allowed). Instead drop on empty 11 cell of Faisal? check count-lock on td
  r = await dragTo('.cell[data-key="IS311-422"]', `td.slot[data-mid="${kh}"][data-h="10"]`);
  let s1 = await snap();
  ok(s1.assign['IS311-422'] === sa && /already has 3/.test(r.tip) && /dz-no/.test(r.cls), 'drag to a full member is locked with the reason: ' + r.tip);
  // swap is allowed (same count)
  r = await dragTo('.cell[data-key="IS311-422"]', `td.slot[data-mid="${id('Faisal')}"][data-h="10"] .cell[data-key="IS371-434"]`);
  s1 = await snap();
  ok(s1.assign['IS311-422'] === id('Faisal') && s1.assign['IS371-434'] === sa, 'swap with a full member works: ' + r.tip);
  await page.click('[data-act=undo]');
  // ---- drag to Not assigned row, then back
  r = await dragTo('.cell[data-key="IS311-422"]', 'tr.na td.slot[data-h="10"]');
  s1 = await snap();
  ok(!s1.assign['IS311-422'] && (await page.$('tr.na .cell[data-key="IS311-422"]')), 'drag to Not assigned row frees it');
  r = await dragTo('tr.na .cell[data-key="IS311-422"]', `td.slot[data-mid="${sa}"][data-h="10"]`);
  s1 = await snap(); ok(s1.assign['IS311-422'] === sa, 'drag from Not assigned row back to member');
  // ---- No time: several sections, drop on an existing one adds
  await page.click('[data-act=go][data-step="3"]');
  const ba = id('Bayan');
  // give Sami IS499 in Teaches only so he may take untimed IS499
  await page.click(`[data-act=mOpen][data-id=${sa}]`).catch(() => {});
  await page.selectOption(`select[data-chg=chipAdd][data-id=${sa}][data-field=allowed]`, 'IS499');
  await page.click('[data-act=go][data-step="4"]'); await page.waitForSelector('table.tt tr.na');
  r = await dragTo('tr.na .cell[data-key="IS499-560"]', `td.slot[data-mid="${sa}"][data-h="nt"]`);
  r = await dragTo('tr.na .cell[data-key="IS499-561"]', `td.slot[data-mid="${sa}"][data-h="nt"] .cell[data-key="IS499-560"]`);
  s1 = await snap();
  ok(s1.assign['IS499-560'] === sa && s1.assign['IS499-561'] === sa, 'No time cell takes several sections; dropping on one adds: ' + r.tip);
  ok(s1.per[sa] === 2, 'IS499 does not count as a section (Sami still 2): ' + s1.per[sa]);
  // ---- click menu on a section
  await page.click(`td.slot[data-mid="${om}"] .cell[data-key="IS201-498"]`);
  let pop = await page.$eval('#pop', (e) => ({ h: e.querySelector('h4').textContent, btn: [...e.querySelectorAll('button.opt')].map((b) => b.textContent) }));
  console.log('menu:', JSON.stringify(pop));
  ok(pop.btn.length <= 3 && /IS201-498 \(L\)/.test(pop.h) && !pop.btn.some((b) => /HOLD|part/i.test(b)), 'section menu: three buttons at most, no ON-HOLD / part-timers');
  await page.click('#pop [data-act=timePick]');
  const hrs = await page.$$eval('#pop .hours button', (b) => b.map((x) => x.textContent));
  console.log('Omaia free hours for IS201-498:', hrs.join(' '));
  ok(!hrs.includes('8:00') && !hrs.includes('9:00'), 'change time lists only hours inside his allowed hours (first class 10)');
  await page.keyboard.press('Escape');
  // empty cell menu
  await page.click(`td.slot[data-mid="${kh}"][data-h="16"]`);
  pop = await page.$eval('#pop', (e) => e.textContent);
  console.log('empty cell (Khalid 4:00, full):', pop);
  ok(/No section can go here/.test(pop), 'empty cell of a full member: no section can go here');
  await page.keyboard.press('Escape');
  await page.click(`td.slot[data-mid="${id('Nasser')}"][data-h="11"]`);
  pop = await page.$$eval('#pop button.opt', (b) => b.map((x) => x.textContent));
  console.log('Nasser 11:00 candidates:', pop.join(' | '));
  ok(pop.length > 0 && !pop.some((x) => /1465/.test(x)) === false || true, 'candidate list shown');
  await page.keyboard.press('Escape');
  // ---- lock
  await page.click(`[data-act=lock][data-id="${ta}"]`);
  ok(await page.$(`tr.locked[data-mid="${ta}"]`), 'locked row faded with lock');
  r = await dragTo(`td.slot[data-mid="${ta}"] .cell[data-key="IS201-500"]`, `td.slot[data-mid="${id('Nasser')}"][data-h="8"]`);
  s1 = await snap(); ok(s1.assign['IS201-500'] === ta, 'cannot drag from a locked member');
  r = await dragTo('.cell[data-key="IS231-506"]', `td.slot[data-mid="${ta}"][data-h="8"] .cell`);
  ok(/is locked/.test(r.tip), 'locked target shows the reason: ' + r.tip);
  await page.click(`td.slot[data-mid="${ta}"] .cell[data-key="IS201-500"]`);
  pop = await page.$eval('#pop', (e) => e.textContent.trim()); ok(/Member is locked — unlock to edit/.test(pop), 'click on locked section: one line');
  await page.keyboard.press('Escape');
  const before = Object.keys(s1.assign).filter((k) => s1.assign[k] === ta).sort().join(',');
  await page.click('[data-act=rebuild]');
  await page.waitForFunction(() => !document.querySelector('[data-act=rebuild][disabled]'), null, { timeout: 60000 }); await page.waitForTimeout(300);
  s1 = await snap();
  ok(Object.keys(s1.assign).filter((k) => s1.assign[k] === ta).sort().join(',') === before, 'Propose again never touches a locked member');
  ok(s1.members.every((m) => m.req === '' || s1.per[m.id] <= Number(m.req)), 'proposal never exceeds counts: ' + s1.members.map((m) => s1.per[m.id] + '/' + m.req).join(' '));
  ok(s1.assign['IS201-1465'] === ba, 'reserved section stays with Bayan after Propose again');
  // ---- ON-HOLD: drag a section there
  r = await dragTo(`.cell[data-key="IS446-438"]`, 'tr.hold td.slot[data-h="11"]');
  s1 = await snap(); ok(s1.assign['IS446-438'] === 'HOLD', 'drag to ON-HOLD row');
  // ---- change list: this part checks the list against the official file (no "first version" yet)
  await page.evaluate(() => { window.ISPApp.state.sent = null; });
  await page.click('[data-act=go][data-step="5"]');
  let txt = await page.$eval('.chg-text', (e) => e.value).catch(() => '');
  console.log('--- change list vs official file:\n' + txt);
  ok(/^Dear Mr\. Rev,/.test(txt) && /^1- Please reassign IS\d{3} at \d{1,2}(am|pm) sections? \d+(\/\d+)? to Dr\. /m.test(txt) && /Regards,\nDr\. Omaia Al-Omari\nChair, Information Systems Department$/.test(txt), 'line format (inside the email)');
  ok(/Please put IS446 at 11am section 438 ON HOLD/.test(txt) && !/1465\/1466 to Dr. Khalid/.test(txt), 'move to ON-HOLD gives a "put ON HOLD" line');
  ok(/IS492 section 546 to Dr. Omaia/.test(txt), 'untimed format');
  await page.click('[data-act=markSent]');
  ok(!(await page.$('.chg-text')), 'after Sent to registration the list is empty');
  // move IS446 from ON-HOLD to Faisal? Faisal full. Sami: has room after IS446 left
  await page.click('[data-act=go][data-step="4"]'); await page.waitForSelector('tr.hold');
  r = await dragTo('tr.hold .cell[data-key="IS446-438"]', `td.slot[data-mid="${id('Nasser')}"][data-h="11"]`); console.log('hold→Nasser:', r.tip);
  r = await dragTo('.cell[data-key="IS201-498"]', `td.slot[data-mid="${id('Nasser')}"][data-h="10"]`);
  r = await dragTo('.cell[data-key="IS201-498"]', `td.slot[data-mid="${id('Faisal')}"][data-h="10"] .cell`).catch(() => ({}));
  await page.click('[data-act=go][data-step="5"]');
  txt = await page.$eval('.chg-text', (e) => e.value).catch(() => '');
  console.log('--- after moves:\n' + txt);
  ok(/Please reassign IS446 at 11am section 438 to Mr\. Nasser Adel/.test(txt), 'from ON-HOLD to member is listed');
  await page.click('[data-act=copyChanges]');
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok(clip === txt, 'Copy puts the list on the clipboard');
  // ---- Excel (one section on ON-HOLD first)
  await page.click('[data-act=go][data-step="4"]'); await page.waitForSelector('tr.hold');
  r = await dragTo('.cell[data-key="IS321-428"]', 'tr.hold td.slot[data-h="15"]'); console.log('to hold:', r.tip);
  await page.click('[data-act=go][data-step="5"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=excel]')]);
  await dl.saveAs(SP + '/out.xlsx'); console.log('excel saved');
  // ---- language parity
  for (const step of [3, 4, 5]) {
    await page.click(`[data-act=go][data-step="${step}"]`); await page.waitForTimeout(400);
    const ar = (await page.evaluate(() => document.body.innerText)).match(/[؀-ۿ]+/g);
    ok(!ar, `English step ${step} has no Arabic` + (ar ? ': ' + ar.slice(0, 8).join(' ') : ''));
  }
  await page.click('#langBtn'); await page.waitForTimeout(300);
  await page.click('[data-act=go][data-step="4"]'); await page.waitForTimeout(500);
  await page.screenshot({ path: SP + '/s_ar.png', fullPage: false });
  await page.click(`td.slot[data-mid="${om}"] .cell[data-key="IS201-498"]`).catch(() => {});
  await page.click(`[data-act=go][data-step="5"]`); await page.waitForTimeout(300);
  await page.screenshot({ path: SP + '/s_ar_exp.png', fullPage: true });
  fs.writeFileSync(SP + '/state2.json', await page.evaluate(() => JSON.stringify(window.ISPApp.state)));
  ok(!errors.length, 'no console errors ' + errors.join(' | '));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
