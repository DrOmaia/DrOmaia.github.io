const { chromium } = require('playwright'); const fs = require('fs'); const SP = __dirname;
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1500, height: 1600 } });
  await page.goto('http://127.0.0.1:8099/isp/');
  await page.evaluate((s) => localStorage.setItem('isp-timetable-v1', s), fs.readFileSync(SP + '/state2.json', 'utf8'));
  await page.reload(); await page.click('[data-act=resumeAuto]'); await page.waitForFunction(() => window.ISPApp.runtime.off);
  await page.click('[data-act=go][data-step="4"]'); await page.waitForSelector('table.tt');
  await page.emulateMedia({ media: 'print' }); await page.waitForTimeout(300);
  await page.screenshot({ path: SP + '/s_print.png', fullPage: true });
  const vis = await page.evaluate(() => ['.legend', '.howto', '.page-head', '.cell .star', '.cell .rlock', 'small.wishes', '.chg-panel', '.notice-bar', '.print-title'].map((q) => q + ':' + [...document.querySelectorAll(q)].some((e) => e.offsetParent !== null)));
  console.log(vis.join(' '));
  await page.pdf({ path: SP + '/print.pdf', landscape: true, format: 'A4' }); await page.emulateMedia({ media: 'screen' }); await page.click('#langBtn'); await page.emulateMedia({ media: 'print' }); await page.pdf({ path: SP + '/print_en.pdf', landscape: true, format: 'A4' });
  await b.close();
})();
