const { chromium } = require('playwright'); const fs = require('fs'); const SP = __dirname;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  for (const side of ['male', 'female']) {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 2300 }, permissions: ['clipboard-read', 'clipboard-write'] }); const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:8099/isp/');
    const st = JSON.parse(fs.readFileSync(SP + '/state2.json', 'utf8')); st.side = side; st.sent = null; st.lang = 'en';
    await page.evaluate((s) => localStorage.setItem('isp-timetable-v1', s), JSON.stringify(st));
    await page.reload(); await page.click('[data-act=resumeAuto]'); await page.waitForFunction(() => window.ISPApp.runtime.off);
    await page.click('[data-act=go][data-step="5"]');
    const v = await page.$eval('.chg-text', (e) => e.value).catch(() => '');
    console.log(`--- ${side}:\n${v}`);
    await page.click('[data-act=copyChanges]');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    if (side === 'male') ok(/^Dear Mr\. Rev,\n\nWe have some changes in our course assignment as the following, kindly implement it in the system and notify us:\n\n1- /.test(v) && /\n\nRegards,\nDr\. Omaia Al-Omari\nChair, Information Systems Department$/.test(v), 'male email');
    else ok(/^Dear Ms\. Deem,\n\nWe have some changes/.test(v) && /\n\nRegards,$/.test(v), 'female email');
    ok(clip === v, side + ': Copy = the email');
    ok(!errors.length, 'no errors ' + errors.join('|'));
    await ctx.close();
  }
  await b.close();
})();
