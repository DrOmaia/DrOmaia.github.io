const { chromium } = require('playwright'); const fs = require('fs'); const SP = __dirname;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1500, height: 2300 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8099/isp/');
  await page.evaluate((s) => localStorage.setItem('isp-timetable-v1', s), fs.readFileSync(SP + '/state1.json', 'utf8'));
  await page.reload(); await page.click('[data-act=resumeAuto]'); await page.waitForFunction(() => window.ISPApp.runtime.off);
  await page.click('[data-act=go][data-step="4"]'); await page.waitForSelector('tr.hold');
  const who = (k) => page.evaluate((k) => window.ISPApp.snapshot().assign[k] || 'NA', k);
  const ids = await page.evaluate(() => Object.fromEntries(window.ISPApp.state.members.map((m) => [m.name.split(' ').pop(), m.id])));
  const drag = async (fromSel, toSel) => {
    const a = await page.locator(fromSel).first().boundingBox(); const bb = await page.locator(toSel).first().boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(a.x + 20, a.y + 20, { steps: 3 }); await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 8 });
    const tip = await page.$eval('#dragTip', (e) => e.textContent).catch(() => ''); await page.mouse.up(); await page.waitForTimeout(150); return tip;
  };
  // Bayan has "Teaches only IS201, IS241": IS101 at 8:00 now allowed with a warning
  let tip = await drag('.cell[data-key="IS101-402"]', `td.slot[data-mid="${ids.Alghofaily}"][data-h="8"]`);
  ok((await who('IS101-402')) === ids.Alghofaily && /outside his allowed courses/.test(tip), 'course limit is a warning: ' + tip);
  await page.click('[data-act=undo]');
  // part-timer section dropped on a full member's section at the same hour: his section goes to Not assigned
  const t = await page.evaluate(() => { const { secs, assign } = window.ISPApp.snapshot(); const pt = Object.keys(assign).filter((k) => assign[k] === 'PT'); for (const k of pt) { const h = secs[k].hour; const other = Object.keys(assign).find((x) => secs[x].hour === h && window.ISPApp.state.members.some((m) => m.id === assign[x])); if (other) return { k, other, mid: assign[other] }; } return null; });
  tip = await drag(`.cell[data-key="${t.k}"]`, `td.slot[data-mid="${t.mid}"] .cell[data-key="${t.other}"]`);
  console.log(tip);
  ok((await who(t.k)) === t.mid && (await who(t.other)) === 'NA', 'from part-timers onto a member section: his section to Not assigned');
  ok(!errors.length, 'no errors ' + errors.join('|'));
  await b.close();
})();
