import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const html = fs.readFileSync(path.resolve("dist/index.html"), "utf8");
const server = http.createServer((_q, r) => { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); r.end(html); });
await new Promise((r) => server.listen(4174, r));
const browser = await chromium.launch({ executablePath: process.env.PW_EXEC });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 600 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
await page.addInitScript(() => {
  localStorage.setItem("twin_soccer_settings", JSON.stringify({
    minutes: 90, realMinutes: 15, difficulty: 1, sound: false, offside: true, autoSwitch: true,
    camera: "broadcast", assist: 1, quality: 2, haptics: false, commentary: true, faikMode: true,
  }));
});
await page.goto("http://127.0.0.1:4174/", { waitUntil: "load" });
await page.waitForTimeout(4800);
await page.getByText("DOKUN VE BAŞLA").click().catch(() => {});
await page.waitForTimeout(1000);
await page.getByText("Karaköyspor").first().click().catch(() => {});
await page.waitForTimeout(400);
await page.getByText("BAŞLA", { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(1500);
await page.getByText("MAÇA ÇIK").first().click().catch(() => {});
await page.waitForTimeout(5000);
await page.screenshot({ path: "tools/shots/10-faik.png" });
await page.keyboard.press("c"); await page.keyboard.press("c");
await page.waitForTimeout(2500);
await page.screenshot({ path: "tools/shots/11-faik-action.png" });
console.log("HATA:", errors.join("\n") || "yok");
await browser.close(); server.close();
