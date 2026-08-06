const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox', '--headless=new', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });

  const url = 'file://' + path.join(__dirname, 'dist', 'index.html');
  await page.goto(url);
  await page.waitForTimeout(600);

  await page.screenshot({ path: 'shot_menu.png' });

  const pre = await page.evaluate(() => ({
    over: document.getElementById('overScreen').className,
    menu: document.getElementById('menuScreen').className,
  }));
  console.log('PRE-CLICK STATE:', JSON.stringify(pre));

  // start game (dispatch directly; headless hit-testing over fixed/transitioning
  // overlays is flaky and irrelevant to the real touch path we test separately)
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForTimeout(400);

  // simulate lane changes + jumps + let it run
  for (let i = 0; i < 30; i++) {
    const k = i % 4;
    if (k === 0) await page.keyboard.press('ArrowLeft');
    else if (k === 1) await page.keyboard.press('ArrowRight');
    else if (k === 2) await page.keyboard.press('Space');
    await page.waitForTimeout(220);
  }
  await page.screenshot({ path: 'shot_playing.png' });

  // let it run long enough to likely crash (no dodging) to test gameover screen
  await page.waitForTimeout(15000);
  await page.screenshot({ path: 'shot_after.png' });

  const state = await page.evaluate(() => ({
    overVisible: document.getElementById('overScreen').classList.contains('visible'),
    finalScore: document.getElementById('finalScore').textContent,
    bestScore: document.getElementById('bestScore').textContent,
  }));
  console.log('STATE:', JSON.stringify(state));
  console.log('ERRORS:', JSON.stringify(errors, null, 2));

  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
