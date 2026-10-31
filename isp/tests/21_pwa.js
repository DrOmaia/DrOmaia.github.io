// PWA: the tool installs as an app (phone / Windows) and keeps working offline.
const { chromium, devices } = require('playwright');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const BASE = 'http://127.0.0.1:8099/isp/';
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });

  // --- desktop: manifest, icons, service worker, offline ---
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);

  const man = await page.evaluate(async () => {
    const l = document.querySelector('link[rel=manifest]'); if (!l) return null;
    const r = await fetch(l.href); return r.ok ? r.json() : null;
  });
  ok(man && man.name && man.start_url && man.display === 'standalone', 'manifest linked and valid');
  ok(man && man.icons && man.icons.some((i) => /192/.test(i.sizes)) && man.icons.some((i) => /512/.test(i.sizes)), 'manifest has 192 + 512 icons');
  ok(man && man.icons.some((i) => i.purpose && i.purpose.indexOf('maskable') >= 0), 'manifest has a maskable icon');

  const icons = await page.evaluate(async (list) => {
    const out = {}; for (const u of list) { try { out[u] = (await fetch(u)).status; } catch (e) { out[u] = 0; } } return out;
  }, ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable.png', 'icons/icon.svg']);
  ok(Object.values(icons).every((s) => s === 200), 'all icons load: ' + JSON.stringify(icons));

  // service worker registers and becomes active
  const active = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    return !!(reg && reg.active);
  });
  ok(active, 'service worker active');

  // offline: the page still loads (served from the cache)
  await ctx.setOffline(true);
  let offlineOk = false;
  try { await page.reload({ waitUntil: 'domcontentloaded' }); offlineOk = await page.evaluate(() => !!document.getElementById('main')); } catch (e) { offlineOk = false; }
  ok(offlineOk, 'works offline (app shell cached)');
  await ctx.setOffline(false);
  ok(!errors.length, 'no page errors ' + errors.join('|'));
  await ctx.close();

  // --- iPhone: install button is offered (no beforeinstallprompt on iOS Safari) ---
  const ictx = await b.newContext({ ...devices['iPhone 13'] });
  const ipage = await ictx.newPage();
  await ipage.goto(BASE);
  await ipage.waitForTimeout(200);
  ok(await ipage.$('#installBtn:not([hidden])'), 'install button shown on iOS');
  await ipage.tap('#installBtn'); await ipage.waitForTimeout(100);
  ok(await ipage.$('#toast.on'), 'iOS install hint shown');
  await ictx.close();

  await b.close();
})();
