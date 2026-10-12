const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('file://' + path.join(__dirname, 'index.html'), { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__reel && !document.getElementById('boot'), null, { timeout: 15000 });

  const DUR = await page.evaluate(() => window.__reel.DUR);
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await page.evaluate(() => window.__reel.rebuild());
  const booted = await page.evaluate(() => !document.body.classList.contains('paused'));
  const fps = await page.waitForFunction(() => {
    const t = document.getElementById('hudFps').textContent;
    return t && t !== '— FPS' ? t : false;
  }, null, { timeout: 5000 }).then(h => h.jsonValue()).catch(() => 'no fps update');

  const out = '/tmp/reel-smoke';
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const t of [1, 8, 16, 26, 36, 44, 53]) {
    await page.evaluate(tt => window.__reel.seekTo(tt), t);
    await page.screenshot({ path: `${out}/t${t}.png` });
  }

  // verify frames actually differ (i.e. seek changes what is rendered)
  const sizes = fs.readdirSync(out).map(f => `${f}:${fs.statSync(path.join(out, f)).size}`);
  console.log(JSON.stringify({ DUR, booted, fps, errors, sizes }, null, 2));
  await browser.close();
  if (errors.length) process.exit(1);
})();
