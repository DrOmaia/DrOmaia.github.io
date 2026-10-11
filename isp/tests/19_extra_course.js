// A course that is not in the official file (e.g. CYSXXX) added from the member's limits: No time, counts, moves
// to any hour / member, not in the email; any section can be deleted (undo brings it back).
const { chromium } = require('playwright'); const fs = require('fs'); const SP = __dirname;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 2300 }, acceptDownloads: true }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8099/isp/');
  await page.evaluate((s) => localStorage.setItem('isp-timetable-v1', s), fs.readFileSync(SP + '/state1.json', 'utf8'));
  await page.reload(); await page.click('[data-act=resumeAuto]'); await page.waitForFunction(() => window.ISPApp.runtime.off);
  await page.click('[data-act=go][data-step="3"]');
  const ids = await page.evaluate(() => Object.fromEntries(window.ISPApp.state.members.map((m) => [m.name.split(' ').pop(), m.id])));
  const per = (id) => page.evaluate((id) => { const { ev } = window.ISPApp.snapshot(); return [ev.per[id].counted, ev.per[id].total]; }, id);
  // a member with room for 2 more sections
  const room = await page.evaluate(() => { const { ev } = window.ISPApp.snapshot(); return window.ISPApp.state.members.filter((m) => m.required !== '' && ev.per[m.id].counted <= Number(m.required)).map((m) => [m.id, Number(m.required) - ev.per[m.id].counted]); });
  let mid = (room.find((r) => r[1] >= 2) || [])[0];
  if (!mid) { mid = room[0][0]; await page.evaluate((id) => { window.ISPApp.state.members.find((m) => m.id === id).required += 2; }, mid); }
  const before = await per(mid);
  await page.click(`[data-act=mOpen][data-id="${mid}"]`);
  await page.fill(`#xc-${mid}`, 'cys xxx'); await page.selectOption(`#xn-${mid}`, '2'); await page.click(`[data-act=extraAdd][data-id="${mid}"]`);
  const after = await per(mid);
  ok(after[0] === before[0] + 2 && after[1] === before[1] + 6, `2 sections counted, 6 hours added (${before} → ${after})`);
  ok((await page.$$(`[data-act=extraDel]`)).length === 2, 'shown in his limits: CYSXXX-1, CYSXXX-2');
  await page.click('[data-act=go][data-step="4"]'); await page.waitForSelector('table.tt');
  ok(/CYSXXX-1[\s\S]*CYSXXX-2/.test(await page.$eval(`td.slot[data-mid="${mid}"][data-h=nt]`, (e) => e.innerText)), 'both in his No time column');
  const where = () => page.evaluate(() => { const { secs, assign } = window.ISPApp.snapshot(); return [assign['CYSXXX-1'] || 'NA', secs['CYSXXX-1'] ? secs['CYSXXX-1'].hour : 'gone']; });
  const drag = async (toSel) => {
    const a = await page.locator('.cell[data-key="CYSXXX-1"]').boundingBox(); const bb = await page.locator(toSel).first().boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + 20, a.y + 20, { steps: 3 }); await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 8 });
    const tip = await page.$eval('#dragTip', (e) => e.textContent).catch(() => ''); await page.mouse.up(); await page.waitForTimeout(150); return tip;
  };
  // right: to a free hour of the same member
  const freeH = await page.evaluate((id) => { const { secs, assign } = window.ISPApp.snapshot(); const m = window.ISPApp.state.members.find((x) => x.id === id); const used = new Set(Object.keys(assign).filter((k) => assign[k] === id).flatMap((k) => secs[k].slots.map((s) => s % 100))); return [8, 9, 10, 11, 13, 14, 15, 16, 17, 18].find((h) => !used.has(h) && h >= (m.first || 8) && h <= (m.last || 18)); }, mid);
  let tip = await drag(`td.slot[data-mid="${mid}"][data-h="${freeH}"]`);
  let w = await where(); ok(w[0] === mid && w[1] === freeH, `right: to ${freeH}:00 of the same member (${tip})`);
  // up: to Not assigned, then back down to the member's No time
  await drag('tr.na td.slot[data-h=nt]'); w = await where(); ok(w[0] === 'NA', 'up: to Not assigned ' + w);
  await drag(`td.slot[data-mid="${mid}"][data-h=nt]`); w = await where(); ok(w[0] === mid && w[1] == null, 'down: back to his No time');
  // not in the email to registration
  const lines = await page.evaluate(() => (document.querySelector('.chg-text') || {}).value || '');
  ok(!/CYS/.test(lines), 'not in the change list');
  // delete from its menu, undo, delete an official section too
  await page.click('.cell[data-key="CYSXXX-1"]'); await page.click('[data-act=secDel]');
  w = await where(); ok(w[1] === 'gone' && !(await page.$('.cell[data-key="CYSXXX-1"]')), 'deleted from the menu');
  await page.click('[data-act=undo]'); await page.waitForTimeout(150);
  w = await where(); ok(w[0] === mid, 'undo brings it back');
  const off = await page.evaluate(() => { const { assign } = window.ISPApp.snapshot(); return Object.keys(assign).find((k) => !/^CYS/.test(k) && window.ISPApp.state.members.some((m) => m.id === assign[k] && !window.ISPApp.state.decisions[m.id])); });
  await page.click(`.cell[data-key="${off}"]`); await page.click('[data-act=secDel]');
  ok(!(await page.$(`.cell[data-key="${off}"]`)), 'an official section can be deleted too: ' + off);
  // Excel still builds
  await page.click('[data-act=go][data-step="5"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=excel]')]);
  await dl.saveAs(SP + '/extra.xlsx'); ok(true, 'excel saved');
  ok(!errors.length, 'no errors ' + errors.join(' | '));
  await b.close();
})();
