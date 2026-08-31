// Görsel doğrulama: oyunu başlat, maça gir, ekran görüntüleri al.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const html = fs.readFileSync(path.resolve("dist/index.html"), "utf8");
const server = http.createServer((req, res) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html); });
await new Promise((r) => server.listen(4173, r));

const browser = await chromium.launch({ executablePath: process.env.PW_EXEC });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 600 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });
await page.addInitScript(() => {
  try { localStorage.setItem("twin_soccer_settings", JSON.stringify({ faikMode: !!globalThis.__FAIK })); } catch { /* */ }
});
await page.goto("http://127.0.0.1:4173/", { waitUntil: "load" });
const shot = async (n) => { await page.screenshot({ path: `tools/shots/${n}.png` }); console.log("shot", n); };

await page.waitForTimeout(4800);
await page.getByText("DOKUN VE BAŞLA").click().catch(() => {});
await page.waitForTimeout(1000);

// kulüp seç (ilk kart)
await page.getByText("Karaköyspor").first().click().catch((e) => console.log("club click", e.message));
await page.waitForTimeout(500);
await page.getByText("BAŞLA", { exact: true }).first().click().catch((e) => console.log("basla", e.message));
await page.waitForTimeout(1500);
await shot("03-home");

// maça çık
await page.getByText("MAÇA ÇIK").first().click().catch((e) => console.log("match click", e.message));
await page.waitForTimeout(4000);
await shot("04-match-broadcast");
await page.waitForTimeout(6000);
await shot("05-match-broadcast2");

// kamera değiştir
for (const name of ["tele", "action", "behind", "sky"]) {
  await page.keyboard.press("c");
  await page.waitForTimeout(2500);
  await shot("06-cam-" + name);
}

const dump = await page.evaluate(() => document.body.innerText.slice(0, 400));
console.log("---SAYFA---\n" + dump);
console.log("---HATA---\n" + (errors.slice(0, 12).join("\n") || "yok"));
await browser.close();
server.close();
