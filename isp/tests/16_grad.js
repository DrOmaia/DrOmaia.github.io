// Graduate Studies added from the member's limits: No time cell, counts as a section, hours in the load, Excel.
const { chromium } = require('playwright'); const fs = require('fs'); const SP = __dirname;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 2300 }, acceptDownloads: true }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8099/isp/');
  await page.evaluate((s) => localStorage.setItem('isp-timetable-v1', s), fs.readFileSync(SP + '/state1.json', 'utf8'));
  await page.reload(); await page.click('[data-act=resumeAuto]'); await page.waitForFunction(() => window.ISPApp.runtime.off);
  await page.click('[data-act=go][data-step="3"]');
  ok(!(await page.$('[data-act=tab][data-tab=msc]')), 'no separate MSc & PhD tab');
  const sa = await page.evaluate(() => window.ISPApp.state.members.find((m) => /Sami/.test(m.name)).id);
  const before = await page.evaluate((id) => { const { ev } = window.ISPApp.snapshot(); return [ev.per[id].counted, ev.per[id].total]; }, sa);
  await page.click(`[data-act=mOpen][data-id="${sa}"]`);
  await page.click(`[data-act=mscAdd][data-id="${sa}"]`);
  await page.selectOption('select[data-chg=msc][data-field=hours]', '2');
  const after = await page.evaluate((id) => { const { ev } = window.ISPApp.snapshot(); return [ev.per[id].counted, ev.per[id].total]; }, sa);
  console.log('Sami before', before, 'after', after);
  ok(after[0] === before[0] + 1 && after[1] === before[1] + 2, 'counts as one section, 2 hours added to the load');
  ok(/Graduate Studies · 2/.test(await page.$eval(`tr:has([data-id="${sa}"][data-act=mOpen]) td.chips`, (e) => e.innerText)), 'shown in the member limits summary');
  await page.click('[data-act=go][data-step="4"]'); await page.waitForSelector('table.tt');
  ok(/Graduate Studies/.test(await page.$eval(`td.slot[data-mid="${sa}"][data-h=nt]`, (e) => e.innerText)), 'Graduate Studies cell in his No time column');
  // drag it up / down like a section
  const ids = await page.evaluate(() => Object.fromEntries(window.ISPApp.state.members.map((m) => [m.name.split(' ').pop(), m.id])));
  const owner = () => page.evaluate(() => window.ISPApp.state.msc[0].member);
  const drag = async (toSel) => {
    const a = await page.locator('.cell[data-grad]').first().boundingBox(); const bb = await page.locator(toSel).first().boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + 20, a.y + 20, { steps: 3 }); await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 8 });
    const tip = await page.$eval('#dragTip', (e) => e.textContent).catch(() => ''); await page.mouse.up(); await page.waitForTimeout(150); return tip;
  };
  let tip = await drag(`td.slot[data-mid="${ids.Saleh}"][data-h=nt]`);
  ok((await owner()) === sa && /already has 3/.test(tip), 'to a full member: refused with the reason');
  tip = await drag(`td.slot[data-mid="${ids.Adel}"][data-h=nt]`);
  ok((await owner()) === ids.Adel, 'down to another member: ' + tip);
  tip = await drag(`td.slot[data-mid="${ids.Saleh}"][data-h="10"]`);
  ok((await owner()) === ids.Adel && /No time column only/.test(tip), 'not into an hour column');
  tip = await drag('tr.na td.slot[data-h=nt]');
  ok((await owner()) === '' && (await page.$('tr.na .cell[data-grad]')), 'up to Not assigned');
  tip = await drag(`td.slot[data-mid="${sa}"][data-h=nt]`);
  ok((await owner()) === '' && /already has 2/.test(tip), 'back to Sami refused: he is full again (2 of 2)');
  tip = await drag(`td.slot[data-mid="${ids.Adel}"][data-h=nt]`); ok((await owner()) === ids.Adel, 'from Not assigned to a member');
  await page.click('[data-act=go][data-step="5"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=excel]')]); await dl.saveAs(SP + '/grad.xlsx');
  ok(!errors.length, 'no errors ' + errors.join('|'));
  await b.close();
})();
