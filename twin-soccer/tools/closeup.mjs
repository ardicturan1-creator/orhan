import { chromium } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const html = fs.readFileSync(path.resolve("dist/index.html"), "utf8");
const server = http.createServer((_q, r) => { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); r.end(html); });
await new Promise((r) => server.listen(4177, r));
const browser = await chromium.launch({ executablePath: process.env.PW_EXEC });
const ctx = await browser.newContext({ viewport: { width: 900, height: 460 }, deviceScaleFactor: 4 });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("twin_soccer_settings", JSON.stringify({
  minutes: 90, realMinutes: 15, difficulty: 1, sound: false, offside: true, autoSwitch: true,
  camera: "action", assist: 1, quality: 2, haptics: false, commentary: false, faikMode: false })));
await page.goto("http://127.0.0.1:4177/", { waitUntil: "load" });
await page.waitForTimeout(4800);
await page.getByText("DOKUN VE BAŞLA").click().catch(() => {});
await page.waitForTimeout(900);
await page.getByText("Karaköyspor").first().click().catch(() => {});
await page.waitForTimeout(400);
await page.getByText("BAŞLA", { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(1400);
await page.getByText("MAÇA ÇIK").first().click().catch(() => {});
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `tools/shots/close-${i}.png`, clip: { x: 250, y: 120, width: 420, height: 260 } });
}
await browser.close(); server.close();
