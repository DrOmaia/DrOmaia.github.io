const { chromium } = require('playwright'); const fs = require('fs'); const SP = __dirname;
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const S = JSON.parse(fs.readFileSync(SP + '/state2.json', 'utf8'));
  const ids = S.members.map((m) => m.id);
  S.decisions = { [ids[0]]: 'final', [ids[1]]: 'reject', [ids[2]]: 'review' };
  S.members.forEach((m) => { delete m.res; }); // older file: no time choices yet
  fs.writeFileSync(SP + '/old.json', JSON.stringify(S));
  await page.goto('http://127.0.0.1:8099/isp/');
  await page.setInputFiles('#projectInput', SP + '/old.json');
  await page.waitForFunction(() => window.ISPApp.runtime.off);
  const st = await page.evaluate(() => ({ d: window.ISPApp.state.decisions, res: window.ISPApp.state.members.map((m) => m.res.length === m.allowed.length) }));
  console.log(JSON.stringify(st.d), st.res.every(Boolean) ? 'res ok' : 'res bad');
  await page.click('[data-act=go][data-step="4"]'); await page.waitForSelector('table.tt'); await page.waitForTimeout(500);
  console.log('locked rows:', await page.$$eval('tr.locked', (r) => r.length), 'h-scroll page:', await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await page.screenshot({ path: SP + '/s_phone.png' });
  console.log('errors', errors);
  await b.close();
})();
