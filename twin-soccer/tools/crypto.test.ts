// düğüm ortamı için localStorage + btoa/atob taklidi
const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};
import { encryptText, decryptText, isEncrypted, vaultFingerprint } from "../src/game/crypto";

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { console.error("FAIL:", m); fail++; } else console.log("ok:", m); };

const samples = [
  "{}",
  JSON.stringify({ v: 2, seed: 12345, players: Array.from({ length: 500 }, (_, i) => [i, "Öğüt Şıklıoğlu" + i, 7, "ST"]) }),
  "türkçe karakterler: ğüşiöçİĞÜŞÖÇ 😀⚽",
  "a".repeat(1) ,
  "",
];
for (const s of samples) {
  const c = encryptText(s);
  ok(isEncrypted(c) || s === "", "başlık: " + s.slice(0, 12));
  ok(decryptText(c) === s, "round-trip len=" + s.length);
  ok(c.indexOf(s.slice(0, 20)) === -1 || s.length < 4, "düz metin sızmıyor");
}
// aynı metin iki kez şifrelenince farklı çıktı (nonce)
ok(encryptText("abc") !== encryptText("abc"), "nonce rastgele");
// kurcalama tespiti
const c = encryptText("gizli kariyer");
const arr = c.split("");
arr[arr.length - 3] = arr[arr.length - 3] === "A" ? "B" : "A";
ok(decryptText(arr.join("")) !== "gizli kariyer", "kurcalama reddedilir");
ok(decryptText("TS3.@@@@") === null, "bozuk base64 null");
ok(decryptText('{"v":2}') === '{"v":2}', "eski düz JSON okunur");
ok(/^[0-9A-F]{8}$/.test(vaultFingerprint()), "parmak izi " + vaultFingerprint());

// performans: 500KB
const big = "x".repeat(500_000);
const t0 = Date.now();
const bc = encryptText(big);
const bp = decryptText(bc);
console.log("500KB şifrele+çöz:", Date.now() - t0, "ms");
ok(bp === big, "büyük veri round-trip");

console.log(fail === 0 ? "\nTÜM TESTLER GEÇTİ" : `\n${fail} TEST BAŞARISIZ`);
process.exit(fail === 0 ? 0 : 1);
