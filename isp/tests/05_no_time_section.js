const { chromium } = require('playwright'); const fs = require('fs'); const SP = __dirname;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 2300 }, acceptDownloads: true }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8099/isp/');
  await page.evaluate((s) => localStorage.setItem('isp-timetable-v1', s), fs.readFileSync(SP + '/state1.json', 'utf8'));
  await page.reload(); await page.click('[data-act=resumeAuto]'); await page.waitForFunction(() => window.ISPApp.runtime.off);
  await page.click('[data-act=go][data-step="4"]'); await page.waitForSelector('table.tt tr.na');
  const K = 'IS311-514';
  const where = () => page.evaluate((k) => { const { secs, assign } = window.ISPApp.snapshot(); return { who: assign[k] || 'NA', hour: secs[k].hour, prop: window.ISPApp.state.proposed[k], auto: !!window.ISPApp.state.autoTime[k] }; }, K);
  console.log('start:', JSON.stringify(await where()));
  const ids = await page.evaluate(() => Object.fromEntries(window.ISPApp.state.members.map((m) => [m.name.split(' ').pop(), m.id])));
  const dragTo = async (toSel) => {
    const a = await page.locator(`.cell[data-key="${K}"]`).first().boundingBox(); const bb = await page.locator(toSel).first().boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + 20, a.y + 20, { steps: 3 }); await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 8 });
    const tip = await page.$eval('#dragTip', (e) => e.textContent).catch(() => ''); await page.mouse.up(); await page.waitForTimeout(150); return tip;
  };
  let tip = await dragTo('tr.hold td.slot[data-h="9"]'); let w = await where();
  ok(w.who === 'HOLD' && w.hour === 9, 'to ON-HOLD at 9:00 (any column): ' + tip);
  tip = await dragTo('tr.hold td.slot[data-h="16"]'); w = await where(); ok(w.who === 'HOLD' && w.hour === 16, 'within ON-HOLD to 4:00');
  tip = await dragTo('tr.na td.slot[data-h="nt"]'); w = await where(); ok(w.who === 'NA' && w.hour == null && w.prop == null, 'to Not assigned, No time column');
  tip = await dragTo(`td.slot[data-mid="${ids.Adel}"][data-h="nt"]`); w = await where(); ok(w.who === 'NA' && /Choose an hour/.test(tip), 'member No time column refused: ' + tip);
  tip = await dragTo(`td.slot[data-mid="${ids.Adel}"][data-h="17"]`); w = await where(); ok(w.who === ids.Adel && w.hour === 17, 'to a member at 5:00: ' + tip);
  // the request appears with the note
  const req = await page.$$eval('.req-list li', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ')));
  console.log(req.join('\n')); ok(req.some((x) => /IS311-514 → 5:00 \(No time · request to set this time\)/.test(x)), 'time request note');
  // empty-cell menu offers it at another hour
  await page.click(`td.slot[data-mid="${ids.Adel}"][data-h="18"]`);
  const opts = await page.$$eval('#pop button.opt', (o) => o.map((x) => x.textContent)); console.log('Adel 6:00 menu:', opts.join(' | '));
  ok(opts.some((x) => /IS311-514.*request to set this time/.test(x)), 'empty cell menu lists the section with no time');
  await page.click(`#pop button.opt[data-key="${K}"]`); w = await where(); ok(w.hour === 18, 'moved to 6:00 from the menu');
  // Change time menu in ON-HOLD offers No time
  await dragTo('tr.hold td.slot[data-h="10"]');
  await page.click(`tr.hold .cell[data-key="${K}"]`); await page.click('#pop [data-act=timePick]');
  const hrs = await page.$$eval('#pop .hours button', (x) => x.map((y) => y.textContent)); ok(hrs.includes('No time') && hrs.length === 11, 'ON-HOLD change time: all hours + No time');
  await page.keyboard.press('Escape');
  // a normal timed section still moves within its hour only
  const a = await page.locator('.cell[data-key="IS311-422"]').first().boundingBox(); const t2 = await page.locator(`td.slot[data-mid="${ids.Adel}"][data-h="16"]`).boundingBox();
  await page.mouse.move(a.x + 5, a.y + 5); await page.mouse.down(); await page.mouse.move(a.x + 25, a.y + 25, { steps: 3 }); await page.mouse.move(t2.x + 10, t2.y + 10, { steps: 6 });
  const tip2 = await page.$eval('#dragTip', (e) => e.textContent); await page.mouse.up();
  ok(/same hour only/.test(tip2), 'timed sections: same hour only');
  await page.click('[data-act=go][data-step="5"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=excel]')]); await dl.saveAs(SP + '/out5.xlsx');
  ok(!errors.length, 'no console errors ' + errors.join('|'));
  await b.close();
})();
