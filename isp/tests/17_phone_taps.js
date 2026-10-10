// Phone: two taps to move a section (tap it, tap the new place), compact timetable.
const { chromium, devices } = require('playwright'); const fs = require('fs'); const SP = __dirname;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8099/isp/');
  const st = JSON.parse(fs.readFileSync(SP + '/state1.json', 'utf8')); st.lang = 'en';
  await page.evaluate((s) => localStorage.setItem('isp-timetable-v1', s), JSON.stringify(st));
  await page.reload(); await page.tap('[data-act=resumeAuto]'); await page.waitForFunction(() => window.ISPApp.runtime.off);
  await page.tap('[data-act=go][data-step="4"]'); await page.waitForSelector('table.tt');
  const ids = await page.evaluate(() => Object.fromEntries(window.ISPApp.state.members.map((m) => [m.name.split(' ').pop(), m.id])));
  const who = (k) => page.evaluate((k) => window.ISPApp.snapshot().assign[k] || 'NA', k);
  const tapIn = async (sel) => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.tap(); await page.waitForTimeout(120); };
  const w = await page.evaluate(() => document.querySelector('td.name').getBoundingClientRect().width);
  ok(w < 130, 'compact name column on the phone: ' + Math.round(w) + 'px');
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no sideways page scroll (only inside the grid)');
  // 1st tap picks
  await tapIn('.cell[data-key="IS311-422"]');
  ok(await page.$('#pickBar:not([hidden])') && await page.$('.cell[data-key="IS311-422"].drag-src'), 'tap a section: picked, bar shown');
  ok((await page.$$('td.dz-ok, td.dz-warn')).length > 0, 'allowed places light up');
  // tap a full member → reason, stays picked
  await tapIn(`td.slot[data-mid="${ids.Saleh}"][data-h="10"]`);
  ok((await who('IS311-422')) === ids.Fahad && await page.$('#pickBar:not([hidden])'), 'tap a locked place: stays, reason shown');
  // tap an allowed place → moved
  await tapIn(`td.slot[data-mid="${ids.Adel}"][data-h="10"]`);
  ok((await who('IS311-422')) === ids.Adel && await page.$('#pickBar[hidden]'), 'second tap moves it');
  // swap by tapping a section of another member at the same hour
  await tapIn('.cell[data-key="IS311-422"]');
  await tapIn(`td.slot[data-mid="${ids.Noor}"][data-h="10"] .cell[data-key]`);
  ok((await who('IS311-422')) === ids.Noor, 'tap on another section swaps');
  // cancel
  await tapIn('.cell[data-key="IS311-422"]'); await page.tap('#pickBar [data-pick=cancel]'); await page.waitForTimeout(100);
  ok(await page.$('#pickBar[hidden]') && (await who('IS311-422')) === ids.Noor, 'Cancel');
  // menu from the bar
  await tapIn('.cell[data-key="IS311-422"]'); await page.tap('#pickBar [data-pick=menu]'); await page.waitForTimeout(150);
  ok(await page.$('#pop:not([hidden]) [data-act=timePick]'), 'Menu opens the section menu');
  await page.screenshot({ path: SP + '/phone_board.png' });
  ok(!errors.length, 'no errors ' + errors.join('|'));
  await b.close();
})();
