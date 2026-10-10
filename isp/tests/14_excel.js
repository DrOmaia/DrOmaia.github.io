const { chromium } = require('playwright'); const fs = require('fs'); const SP = __dirname;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ acceptDownloads: true }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8099/isp/');
  await page.evaluate((s) => localStorage.setItem('isp-timetable-v1', s), fs.readFileSync(SP + '/state2.json', 'utf8'));
  await page.reload(); await page.click('[data-act=resumeAuto]'); await page.waitForFunction(() => window.ISPApp.runtime.off);
  await page.click('[data-act=go][data-step="5"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=excel]')]); await dl.saveAs(SP + '/outx.xlsx');
  console.log('excel saved', errors.length ? errors : 'no errors'); await b.close();
})();
