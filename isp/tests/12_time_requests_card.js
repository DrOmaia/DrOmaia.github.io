const { chromium } = require('playwright'); const fs = require('fs'); const SP = __dirname;
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1400, height: 800 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8099/isp/');
  await page.evaluate((s) => localStorage.setItem('isp-timetable-v1', s), fs.readFileSync(SP + '/state2.json', 'utf8'));
  await page.reload(); await page.click('[data-act=resumeAuto]'); await page.waitForFunction(() => window.ISPApp.runtime.off);
  await page.click('[data-act=go][data-step="4"]'); await page.waitForSelector('[data-act=toReqs]');
  await page.click('[data-act=toReqs]'); await page.waitForTimeout(900);
  const inView = await page.$eval('#timeReqs', (e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; });
  console.log((inView ? 'PASS' : 'FAIL') + ' Time requests card scrolls to the list', errors.length ? errors : 'no errors');
  await b.close();
})();
