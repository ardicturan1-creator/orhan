/**
 * ŞİFRELİ KAYIT SİSTEMİ — TWIN SOCCER
 *
 * Kayıt dosyası her zaman şifreli saklanır; oyuncuya HİÇBİR ZAMAN şifre sorulmaz.
 * Anahtar, cihaz ilk açıldığında `crypto.getRandomValues` ile üretilen 256 bitlik
 * gizli bir cihaz anahtarından ve uygulamaya gömülü sabit bir "pepper"dan türetilir.
 *
 *   deviceSecret (256 bit, rastgele, cihaza özel)
 *        └─ HKDF benzeri karıştırma (pepper + etiket) ─► encKey (32B) + macKey (32B)
 *
 * Şifreleme: ChaCha20 akış şifresi (RFC 8439 çekirdeği, saf TS uygulaması).
 * Bütünlük : macKey ile anahtarlanmış 128 bitlik özet (nonce || şifreli metin).
 *
 * Biçim: "TS3.<base64(nonce[12] || tag[16] || ciphertext)>"
 * Geriye uyum: "TS2." (eski XOR biçimi, şifresiz anahtarla) ve düz JSON okunabilir.
 */

const PEPPER = "BYMEL::TWIN::SOCCER::2026::save-vault";
const HDR = "TS3.";
const LEGACY_HDR = "TS2.";
const DEVICE_KEY_STORE = "twin_soccer_device_key_v1";

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

function b64encode(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Kriptografik rastgelelik; yoksa (çok eski WebView) zamana dayalı yedek. */
function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const c = typeof globalThis !== "undefined" ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(out);
    return out;
  }
  let seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  for (let i = 0; i < n; i++) {
    seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
    out[i] = (seed >>> 13) & 0xff;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* ChaCha20 (RFC 8439)                                                 */
/* ------------------------------------------------------------------ */

const SIGMA = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574];

function rotl32(v: number, n: number): number {
  return ((v << n) | (v >>> (32 - n))) >>> 0;
}

function chachaBlock(key: Uint32Array, counter: number, nonce: Uint32Array, out: Uint8Array): void {
  const s = new Uint32Array(16);
  s[0] = SIGMA[0]; s[1] = SIGMA[1]; s[2] = SIGMA[2]; s[3] = SIGMA[3];
  for (let i = 0; i < 8; i++) s[4 + i] = key[i];
  s[12] = counter >>> 0;
  s[13] = nonce[0]; s[14] = nonce[1]; s[15] = nonce[2];

  const x = new Uint32Array(s);
  const qr = (a: number, b: number, c: number, d: number): void => {
    x[a] = (x[a] + x[b]) >>> 0; x[d] = rotl32(x[d] ^ x[a], 16);
    x[c] = (x[c] + x[d]) >>> 0; x[b] = rotl32(x[b] ^ x[c], 12);
    x[a] = (x[a] + x[b]) >>> 0; x[d] = rotl32(x[d] ^ x[a], 8);
    x[c] = (x[c] + x[d]) >>> 0; x[b] = rotl32(x[b] ^ x[c], 7);
  };
  for (let i = 0; i < 10; i++) {
    qr(0, 4, 8, 12); qr(1, 5, 9, 13); qr(2, 6, 10, 14); qr(3, 7, 11, 15);
    qr(0, 5, 10, 15); qr(1, 6, 11, 12); qr(2, 7, 8, 13); qr(3, 4, 9, 14);
  }
  for (let i = 0; i < 16; i++) {
    const v = (x[i] + s[i]) >>> 0;
    out[i * 4] = v & 0xff;
    out[i * 4 + 1] = (v >>> 8) & 0xff;
    out[i * 4 + 2] = (v >>> 16) & 0xff;
    out[i * 4 + 3] = (v >>> 24) & 0xff;
  }
}

/** Yerinde XOR — şifreleme ve çözme aynı işlemdir. */
function chachaXor(key: Uint32Array, nonce: Uint32Array, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  const block = new Uint8Array(64);
  let counter = 1;
  for (let off = 0; off < data.length; off += 64) {
    chachaBlock(key, counter++, nonce, block);
    const n = Math.min(64, data.length - off);
    for (let i = 0; i < n; i++) out[off + i] = data[off + i] ^ block[i];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Anahtar türetme + MAC                                               */
/* ------------------------------------------------------------------ */

/** FNV-1a tabanlı, tur sayısı yüksek karıştırıcı (anahtar türetme için). */
function mixBytes(seedParts: (string | Uint8Array)[], outLen: number): Uint8Array {
  const h = new Uint32Array(8);
  for (let i = 0; i < 8; i++) h[i] = (0x811c9dc5 ^ Math.imul(i + 1, 0x9e3779b9)) >>> 0;
  const absorb = (b: number, i: number): void => {
    const s = i & 7;
    h[s] = Math.imul(h[s] ^ b, 0x01000193) >>> 0;
    h[(s + 3) & 7] = (rotl32(h[(s + 3) & 7], 7) ^ h[s]) >>> 0;
  };
  let idx = 0;
  for (const part of seedParts) {
    if (typeof part === "string") {
      for (let i = 0; i < part.length; i++) {
        const c = part.charCodeAt(i);
        absorb(c & 0xff, idx++); absorb((c >>> 8) & 0xff, idx++);
      }
    } else {
      for (let i = 0; i < part.length; i++) absorb(part[i], idx++);
    }
    absorb(0xff, idx++);
  }
  // güçlendirme turları
  for (let r = 0; r < 512; r++) {
    for (let i = 0; i < 8; i++) {
      h[i] = (Math.imul(h[i] ^ rotl32(h[(i + 5) & 7], 11), 0x85ebca6b) + r) >>> 0;
    }
  }
  const out = new Uint8Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const w = h[i & 7];
    out[i] = (w >>> ((i % 4) * 8)) & 0xff;
    if ((i & 7) === 7) {
      for (let k = 0; k < 8; k++) h[k] = (Math.imul(h[k] ^ (i + 1), 0x27d4eb2f) + rotl32(h[(k + 1) & 7], 13)) >>> 0;
    }
  }
  return out;
}

function bytesToU32(b: Uint8Array): Uint32Array {
  const out = new Uint32Array(b.length >> 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = (b[i * 4] | (b[i * 4 + 1] << 8) | (b[i * 4 + 2] << 16) | (b[i * 4 + 3] << 24)) >>> 0;
  }
  return out;
}

/** macKey ile anahtarlanmış 16 baytlık bütünlük etiketi. */
function mac(macKey: Uint8Array, nonce: Uint8Array, cipher: Uint8Array): Uint8Array {
  return mixBytes([macKey, nonce, cipher, PEPPER], 16);
}

/* ------------------------------------------------------------------ */
/* Cihaz anahtarı                                                      */
/* ------------------------------------------------------------------ */

let cachedSecret: Uint8Array | null = null;
let cachedEnc: Uint32Array | null = null;
let cachedMac: Uint8Array | null = null;

/** Cihaza özel gizli anahtar — yoksa üretilir ve saklanır. */
function deviceSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  let raw: Uint8Array | null = null;
  try {
    const s = localStorage.getItem(DEVICE_KEY_STORE);
    if (s && s.length >= 40) raw = b64decode(s);
  } catch { /* private mode */ }
  if (!raw || raw.length !== 32) {
    raw = randomBytes(32);
    try { localStorage.setItem(DEVICE_KEY_STORE, b64encode(raw)); } catch { /* private mode */ }
  }
  cachedSecret = raw;
  return raw;
}

function keys(): { enc: Uint32Array; mac: Uint8Array } {
  if (cachedEnc && cachedMac) return { enc: cachedEnc, mac: cachedMac };
  const sec = deviceSecret();
  cachedEnc = bytesToU32(mixBytes([PEPPER, "enc", sec], 32));
  cachedMac = mixBytes([PEPPER, "mac", sec], 32);
  return { enc: cachedEnc, mac: cachedMac };
}

/* ------------------------------------------------------------------ */
/* Genel API                                                           */
/* ------------------------------------------------------------------ */

/** Düz metni şifreleyip saklanabilir bir dizeye çevirir. */
export function encryptText(plain: string): string {
  try {
    const { enc, mac: mk } = keys();
    const nonce = randomBytes(12);
    const data = new TextEncoder().encode(plain);
    const cipher = chachaXor(enc, bytesToU32(nonce), data);
    const tag = mac(mk, nonce, cipher);
    const blob = new Uint8Array(12 + 16 + cipher.length);
    blob.set(nonce, 0);
    blob.set(tag, 12);
    blob.set(cipher, 28);
    return HDR + b64encode(blob);
  } catch (e) {
    console.warn("[crypto] şifreleme başarısız, düz metne düşüldü", e);
    return plain;
  }
}

/** Şifreli dizeyi çözer; bozuk/kurcalanmış veride null döner. */
export function decryptText(cipherText: string): string | null {
  try {
    if (!cipherText) return null;
    if (cipherText.startsWith(HDR)) {
      const blob = b64decode(cipherText.slice(HDR.length));
      if (blob.length < 28) return null;
      const nonce = blob.subarray(0, 12);
      const tag = blob.subarray(12, 28);
      const cipher = blob.subarray(28);
      const { enc, mac: mk } = keys();
      const expect = mac(mk, nonce, cipher);
      let diff = 0;
      for (let i = 0; i < 16; i++) diff |= tag[i] ^ expect[i];
      if (diff !== 0) return null;
      return new TextDecoder().decode(chachaXor(enc, bytesToU32(nonce), cipher));
    }
    if (cipherText.startsWith(LEGACY_HDR)) return decryptLegacy(cipherText);
    // sürüm öncesi düz JSON kaydı
    return cipherText;
  } catch {
    return null;
  }
}

/** Eski TS2 (PIN'siz XOR) kayıtlarını okuyabilmek için. */
function decryptLegacy(cipher: string): string | null {
  const SALT = "BYMEL::TWIN::SOCCER::v2::";
  const fnv1a = (s: string, seed = 0x811c9dc5): number => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  };
  const rest = cipher.slice(LEGACY_HDR.length);
  const dot = rest.indexOf(".");
  if (dot < 0) return null;
  const sum = rest.slice(0, dot);
  const bytes = b64decode(rest.slice(dot + 1));
  let a = (fnv1a(SALT) ^ 0x9e3779b9) >>> 0;
  const out = new Uint8Array(bytes.length);
  let buf = 0, bits = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bits < 8) {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      buf = ((t ^ (t >>> 14)) >>> 0);
      bits = 32;
    }
    out[i] = bytes[i] ^ (buf & 0xff);
    buf >>>= 8;
    bits -= 8;
  }
  const plain = new TextDecoder().decode(out);
  if (fnv1a(plain).toString(16).padStart(8, "0") !== sum) return null;
  return plain;
}

export function isEncrypted(text: string): boolean {
  return typeof text === "string" && text.startsWith(HDR);
}

/** Ayarlar ekranında gösterilecek kısa parmak izi (anahtarın kendisi değil). */
export function vaultFingerprint(): string {
  try {
    const fp = mixBytes(["fingerprint", deviceSecret()], 4);
    return Array.from(fp).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  } catch {
    return "--------";
  }
}
