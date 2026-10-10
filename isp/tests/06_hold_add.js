const { chromium } = require('playwright'); const fs = require('fs'); const SP = __dirname;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1500, height: 2300 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8099/isp/');
  await page.evaluate((s) => localStorage.setItem('isp-timetable-v1', s), fs.readFileSync(SP + '/state1.json', 'utf8'));
  await page.reload(); await page.click('[data-act=resumeAuto]'); await page.waitForFunction(() => window.ISPApp.runtime.off);
  await page.click('[data-act=go][data-step="4"]'); await page.waitForSelector('table.tt tr.na');
  const who = (k) => page.evaluate((k) => window.ISPApp.snapshot().assign[k] || 'NA', k);
  const drag = async (fromSel, toSel) => {
    const a = await page.locator(fromSel).first().boundingBox(); const bb = await page.locator(toSel).first().boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + 20, a.y + 20, { steps: 3 }); await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 8 });
    const tip = await page.$eval('#dragTip', (e) => e.textContent).catch(() => ''); await page.mouse.up(); await page.waitForTimeout(150); return tip;
  };
  // two IS101 sections at 8:00 and 9:00 are with part-timers; find two sections at the same hour with members
  const pair = await page.evaluate(() => { const { secs, assign } = window.ISPApp.snapshot(); const by = {}; Object.keys(assign).forEach((k) => { const h = secs[k].hour; if (h != null && assign[k] !== 'PT') (by[h] = by[h] || []).push(k); }); const h = Object.keys(by).find((x) => by[x].length >= 3); return { h, keys: by[h] }; });
  const [k1, k2, k3] = pair.keys; console.log('hour', pair.h, k1, k2, k3);
  let tip = await drag(`.cell[data-key="${k1}"]`, `tr.hold td.slot[data-h="${pair.h}"]`);
  tip = await drag(`.cell[data-key="${k2}"]`, `tr.hold .cell[data-key="${k1}"]`); // dropped on the first one
  ok((await who(k1)) === 'HOLD' && (await who(k2)) === 'HOLD', 'ON-HOLD takes two sections at the same hour, dropping on one adds: ' + tip);
  tip = await drag(`tr.hold .cell[data-key="${k2}"]`, `tr.na td.slot[data-h="${pair.h}"]`);
  tip = await drag(`tr.hold .cell[data-key="${k1}"]`, `tr.na .cell[data-key="${k2}"]`);
  ok((await who(k1)) === 'NA' && (await who(k2)) === 'NA', 'Not assigned also adds: ' + tip);
  // back to HOLD, then from HOLD onto a member's section → member's old one to Not assigned
  await drag(`tr.na .cell[data-key="${k1}"]`, `tr.hold td.slot[data-h="${pair.h}"]`);
  const m3 = await who(k3);
  tip = await drag(`tr.hold .cell[data-key="${k1}"]`, `td.slot[data-mid="${m3}"] .cell[data-key="${k3}"]`);
  console.log('tip:', tip); ok(/^Replace: /.test(tip), 'wording: Replace');
  ok((await who(k1)) === m3 && (await who(k3)) === 'NA', 'from ON-HOLD onto a member section: it goes to the member, the old one to Not assigned');
  ok(!errors.length, 'no errors ' + errors.join('|'));
  await b.close();
})();
