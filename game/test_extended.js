const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox', '--headless=new', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });

  const url = 'file://' + path.join(__dirname, 'dist', 'index.html');
  await page.goto(url);
  await page.waitForTimeout(400);
  await page.evaluate(() => document.getElementById('startBtn').click());

  // survive as long as possible: dodge by reading lane state each tick is not exposed,
  // so alternate lanes/jumps rapidly and randomly for a long stress run.
  const start = Date.now();
  while (Date.now() - start < 45000) {
    const r = Math.random();
    if (r < 0.35) await page.keyboard.press('ArrowLeft');
    else if (r < 0.7) await page.keyboard.press('ArrowRight');
    else await page.keyboard.press('Space');
    await page.waitForTimeout(140);
    // auto-restart if game over so the stress run keeps exercising full loop
    const over = await page.evaluate(() => document.getElementById('overScreen').classList.contains('visible'));
    if (over) {
      await page.evaluate(() => document.getElementById('retryBtn').click());
      await page.waitForTimeout(200);
    }
  }

  const score1 = await page.evaluate(() => window.localStorage.getItem('neonDriftBest'));
  console.log('BEST AFTER STRESS RUN:', score1);

  // reload and confirm persistence + clean re-init
  await page.reload();
  await page.waitForTimeout(500);
  const afterReload = await page.evaluate(() => ({
    bestHud: document.getElementById('bestHud').textContent,
    menuVisible: document.getElementById('menuScreen').classList.contains('visible'),
  }));
  console.log('AFTER RELOAD:', JSON.stringify(afterReload));

  // resize / orientation check
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);

  console.log('TOTAL ERRORS:', errors.length);
  if (errors.length) console.log(JSON.stringify(errors.slice(0, 20), null, 2));

  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
