import { MatchEngine, PITCH, type MP } from "./engine";
import { CLUB_MAP } from "./data/clubs";
import { clamp, hashStr } from "./rng";
import { BOOT_COLORS, HAIR_COLORS, SKIN_TONES, lookOf, shadeOf } from "./look";
import { FAIK_IMAGE } from "../assets/faik";
import type { CameraId, Kit } from "./types";

/* ============================================================
 *  TWIN SOCCER — 3B Perspektif Maç Render Motoru
 *  Kuş bakışı değil: gerçek pinhole kamera projeksiyonu ile
 *  FIFA tarzı yayın kamerası, oyuncu arkası ve tele açılar.
 *
 *  Dünya: x = saha uzunluğu (0..105), y = saha genişliği (0..68),
 *         z = yükseklik (metre, yukarı pozitif)
 * ============================================================ */

export interface ViewOpts {
  camera: CameraId;
  quality: number; // 0 düşük · 1 orta · 2 yüksek
  showNames: boolean;
  faik: boolean;
  userTeam: 0 | 1;
  standsLevel: number;
  lightsLevel: number;
  screenLevel: number;
  radar: boolean;
}

interface CamPreset {
  /** Topun arkasında/yanında konum ofseti (saha eksenlerinde) */
  side: number; // yan mesafe (m) — yayın kamerası için
  back: number; // hücum yönünün tersine mesafe
  height: number; // yükseklik
  lookAhead: number; // hedefin top önüne kayması
  lookHeight: number; // hedef yüksekliği
  fov: number; // derece
  /** Kamerayı hücum yönüne göre döndür (oyuncu arkası açıları) */
  behind: boolean;
  follow: number; // takip yumuşaklığı
}

const PRESETS: Record<CameraId, CamPreset> = {
  broadcast: { side: 33, back: 0, height: 18.5, lookAhead: 3, lookHeight: 1.5, fov: 38, behind: false, follow: 3.4 },
  tele: { side: 25, back: 0, height: 13, lookAhead: 2, lookHeight: 1.6, fov: 34, behind: false, follow: 4.4 },
  action: { side: 19, back: 7, height: 9.5, lookAhead: 4, lookHeight: 1.5, fov: 42, behind: false, follow: 5 },
  behind: { side: 0, back: 16, height: 8, lookAhead: 11, lookHeight: 1.7, fov: 50, behind: true, follow: 4.8 },
  sky: { side: 0, back: 30, height: 28, lookAhead: 8, lookHeight: 0.6, fov: 40, behind: true, follow: 3.2 },
};

export const CAMERA_LABELS: { id: CameraId; name: string; desc: string }[] = [
  { id: "broadcast", name: "Yayın", desc: "Klasik TV kamerası — geniş açı" },
  { id: "tele", name: "Tele", desc: "Yakın plan yayın kamerası" },
  { id: "action", name: "Aksiyon", desc: "Alçak ve dinamik takip" },
  { id: "behind", name: "Oyuncu Arkası", desc: "FIFA tarzı arkadan görüş" },
  { id: "sky", name: "Kule", desc: "Yüksek taktik açısı" },
];

/** Oyuncular oyun hissi için gerçek ölçekten biraz büyük çizilir (DLS/FIFA mobil yaklaşımı) */
const PLAYER_SCALE = 1.32;
const MARGIN = 6.5; // çim kenarı
const STAND_GAP = 3.5; // saha kenarı ile tribün arası

/* ------------------------------------------------------------------ */
/*  Yardımcılar                                                        */
/* ------------------------------------------------------------------ */

function shade(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = clamp(((n >> 16) & 255) * amt, 0, 255);
  const g = clamp(((n >> 8) & 255) * amt, 0, 255);
  const b = clamp((n & 255) * amt, 0, 255);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

interface Proj {
  sx: number;
  sy: number;
  s: number; // metre başına piksel
  z: number; // kamera derinliği
  ok: boolean;
}

export class Renderer3D {
  ctx: CanvasRenderingContext2D;
  w = 0;
  h = 0;
  dpr = 1;

  /* kamera durumu */
  private camPos = { x: 52.5, y: -40, z: 25 };
  private camTgt = { x: 52.5, y: 34, z: 1 };
  private smTgt = { x: 52.5, y: 34, z: 1 };
  private fwd = { x: 0, y: 1, z: 0 };
  private right = { x: 1, y: 0, z: 0 };
  private up = { x: 0, y: 0, z: 1 };
  private focal = 600;
  private initialized = false;

  /* dokular / önbellek */
  private crowdSeed: { x: number; y: number; z: number; c: string; ph: number }[] = [];
  private faikImg: HTMLImageElement | null = null;
  private faikReady = false;
  private ballTrail: { x: number; y: number; z: number }[] = [];
  private confetti: { x: number; y: number; z: number; vx: number; vy: number; vz: number; c: string; life: number }[] = [];
  private grassTuft: { x: number; y: number; r: number }[] = [];
  private time = 0;

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.resize();
    this.buildCrowd();
    this.buildGrass();
    this.loadFaik();
  }

  private loadFaik() {
    const img = new Image();
    img.onload = () => {
      this.faikReady = true;
    };
    img.src = FAIK_IMAGE;
    this.faikImg = img;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
  }

  /* ---------------- tribün ve çim dokusu ---------------- */
  private buildCrowd() {
    const cols = ["#e2e8f0", "#f8b4c0", "#93c5fd", "#fcd34d", "#86efac", "#c4b5fd", "#fda4af", "#a5b4fc", "#fbbf24"];
    const seed = 991;
    let s = seed;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const out: typeof this.crowdSeed = [];
    // dört tribün: kuzey/güney (uzun kenar), doğu/batı (kale arkası)
    const push = (x: number, y: number, tier: number) => {
      out.push({
        x,
        y,
        z: 2.2 + tier * 0.9 + rnd() * 0.35,
        c: cols[(rnd() * cols.length) | 0],
        ph: rnd() * Math.PI * 2,
      });
    };
    for (let row = 0; row < 13; row++) {
      for (let i = 0; i < 62; i++) {
        const x = -MARGIN + (i / 61) * (PITCH.L + MARGIN * 2);
        push(x, -MARGIN - STAND_GAP - row * 1.15, row);
        push(x, PITCH.W + MARGIN + STAND_GAP + row * 1.15, row);
      }
    }
    for (let row = 0; row < 13; row++) {
      for (let i = 0; i < 42; i++) {
        const y = -MARGIN - STAND_GAP + (i / 41) * (PITCH.W + (MARGIN + STAND_GAP) * 2);
        push(-MARGIN - STAND_GAP - row * 1.15, y, row);
        push(PITCH.L + MARGIN + STAND_GAP + row * 1.15, y, row);
      }
    }
    this.crowdSeed = out;
  }

  private buildGrass() {
    let s = 4242;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const out: typeof this.grassTuft = [];
    for (let i = 0; i < 260; i++) {
      out.push({ x: rnd() * PITCH.L, y: rnd() * PITCH.W, r: 0.5 + rnd() * 1.4 });
    }
    this.grassTuft = out;
  }

  /* ------------------------------------------------------------------ */
  /*  Kamera                                                             */
  /* ------------------------------------------------------------------ */

  private updateCamera(e: MatchEngine, opts: ViewOpts, dt: number) {
    const p = PRESETS[opts.camera] ?? PRESETS.broadcast;
    const b = e.ball;
    // hücum yönü: kullanıcı takımının saldırdığı yön (+1 sağa)
    const attack = e.dir[opts.userTeam] === 1 ? 1 : -1;

    // odak noktası: top + hareket öngörüsü
    let tx = b.x + b.vx * 0.2;
    let ty = b.y + b.vy * 0.2;
    if (e.phase === "goal") {
      const cel = e.players.find((q) => q.celebrate > 0);
      if (cel) {
        tx = cel.x;
        ty = cel.y;
      }
    }
    tx = clamp(tx, 9, PITCH.L - 9);
    ty = clamp(ty, 5, PITCH.W - 5);

    const k = this.initialized ? 1 - Math.pow(0.0015, dt * p.follow) : 1;
    this.smTgt.x += (tx - this.smTgt.x) * k;
    this.smTgt.y += (ty - this.smTgt.y) * k;
    this.smTgt.z = p.lookHeight;

    // aksiyon yoğunluğuna göre hafif zoom
    const breathe = 1 + clamp(Math.hypot(b.vx, b.vy) / 110, 0, 0.12);

    let cx: number;
    let cy: number;
    let lx: number;
    let ly: number;
    if (p.behind) {
      // oyuncu arkası: kamera ekseni saha boyuna paralel → saha ekranda düz durur
      cy = this.smTgt.y * 0.5 + (PITCH.W / 2) * 0.5;
      cx = this.smTgt.x - attack * p.back;
      lx = this.smTgt.x + attack * p.lookAhead;
      ly = cy;
    } else {
      // yayın kamerası: uzun kenarın dışında, topun x'ini takip eder
      cx = clamp(this.smTgt.x, 14, PITCH.L - 14) - attack * p.back;
      cy = -p.side;
      lx = cx + attack * p.back;
      ly = this.smTgt.y * 0.45 + (PITCH.W / 2) * 0.55;
    }
    const cz = p.height * breathe;

    const kp = this.initialized ? 1 - Math.pow(0.002, dt * p.follow) : 1;
    this.camPos.x += (cx - this.camPos.x) * kp;
    this.camPos.y += (cy - this.camPos.y) * kp;
    this.camPos.z += (cz - this.camPos.z) * kp;
    this.camTgt.x += (lx - this.camTgt.x) * kp;
    this.camTgt.y += (ly - this.camTgt.y) * kp;
    this.camTgt.z = p.lookHeight;
    this.initialized = true;

    // gol sarsıntısı
    const sh = e.fx.shake;
    if (sh > 0) {
      this.camPos.x += (Math.random() - 0.5) * sh * 0.6;
      this.camPos.z += (Math.random() - 0.5) * sh * 0.4;
    }

    this.buildBasis(p.fov);
  }

  private buildBasis(fovDeg: number) {
    const dx = this.camTgt.x - this.camPos.x;
    const dy = this.camTgt.y - this.camPos.y;
    const dz = this.camTgt.z - this.camPos.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    this.fwd = { x: dx / len, y: dy / len, z: dz / len };
    // right = fwd × worldUp
    const rx = this.fwd.y * 1 - this.fwd.z * 0;
    const ry = this.fwd.z * 0 - this.fwd.x * 1;
    const rz = this.fwd.x * 0 - this.fwd.y * 0;
    const rl = Math.hypot(rx, ry, rz) || 1;
    this.right = { x: rx / rl, y: ry / rl, z: rz / rl };
    // up = right × fwd
    this.up = {
      x: this.right.y * this.fwd.z - this.right.z * this.fwd.y,
      y: this.right.z * this.fwd.x - this.right.x * this.fwd.z,
      z: this.right.x * this.fwd.y - this.right.y * this.fwd.x,
    };
    const fov = (fovDeg * Math.PI) / 180;
    this.focal = this.h / 2 / Math.tan(fov / 2);
  }

  /** Dünya noktasını ekrana taşır. */
  project(x: number, y: number, z: number): Proj {
    const dx = x - this.camPos.x;
    const dy = y - this.camPos.y;
    const dz = z - this.camPos.z;
    const cz = dx * this.fwd.x + dy * this.fwd.y + dz * this.fwd.z;
    if (cz < 0.6) return { sx: 0, sy: 0, s: 0, z: cz, ok: false };
    const cx = dx * this.right.x + dy * this.right.y + dz * this.right.z;
    const cy = dx * this.up.x + dy * this.up.y + dz * this.up.z;
    const f = this.focal / cz;
    return { sx: this.w / 2 + cx * f, sy: this.h / 2 - cy * f, s: f, z: cz, ok: true };
  }

  /* ------------------------------------------------------------------ */
  /*  Çizim yardımcıları                                                 */
  /* ------------------------------------------------------------------ */

  /** Dünya poligonunu ekrana çizer. Herhangi bir köşe kameranın arkasındaysa atlar. */
  private poly(pts: [number, number, number][], fill: string | CanvasGradient, stroke?: string, lw = 1) {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = this.project(pts[i][0], pts[i][1], pts[i][2]);
      if (!p.ok) return false;
      if (i === 0) ctx.moveTo(p.sx, p.sy);
      else ctx.lineTo(p.sx, p.sy);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    return true;
  }

  /** Zemine çizilen kalın çizgi (dikdörtgen olarak, perspektifi doğru). */
  private groundLine(x1: number, y1: number, x2: number, y2: number, w: number, color: string) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (w / 2);
    const ny = (dx / len) * (w / 2);
    this.poly(
      [
        [x1 + nx, y1 + ny, 0.02],
        [x2 + nx, y2 + ny, 0.02],
        [x2 - nx, y2 - ny, 0.02],
        [x1 - nx, y1 - ny, 0.02],
      ],
      color
    );
  }

  /** Zemine çizilen yay (kalın). */
  private groundArc(cx: number, cy: number, r: number, a0: number, a1: number, w: number, color: string) {
    const steps = 26;
    const outer: [number, number, number][] = [];
    const inner: [number, number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      outer.push([cx + Math.cos(a) * (r + w / 2), cy + Math.sin(a) * (r + w / 2), 0.02]);
      inner.push([cx + Math.cos(a) * (r - w / 2), cy + Math.sin(a) * (r - w / 2), 0.02]);
    }
    inner.reverse();
    this.poly([...outer, ...inner], color);
  }

  /** Zemin üzerinde dikdörtgen çerçeve (ceza sahası vb). */
  private groundRect(x: number, y: number, w: number, h: number, lw: number, color: string) {
    this.groundLine(x, y, x + w, y, lw, color);
    this.groundLine(x + w, y, x + w, y + h, lw, color);
    this.groundLine(x + w, y + h, x, y + h, lw, color);
    this.groundLine(x, y + h, x, y, lw, color);
  }

  /** Perspektif dörtgene doku uygular (iki afin üçgen ile). */
  private texQuad(
    img: CanvasImageSource,
    iw: number,
    ih: number,
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number]
  ) {
    const a = this.project(p0[0], p0[1], p0[2]);
    const b = this.project(p1[0], p1[1], p1[2]);
    const c = this.project(p2[0], p2[1], p2[2]);
    const d = this.project(p3[0], p3[1], p3[2]);
    if (!a.ok || !b.ok || !c.ok || !d.ok) return;
    this.tri(img, 0, 0, iw, 0, iw, ih, a, b, c);
    this.tri(img, 0, 0, iw, ih, 0, ih, a, c, d);
  }

  private tri(
    img: CanvasImageSource,
    u0: number, v0: number, u1: number, v1: number, u2: number, v2: number,
    d0: Proj, d1: Proj, d2: Proj
  ) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(d0.sx, d0.sy);
    ctx.lineTo(d1.sx, d1.sy);
    ctx.lineTo(d2.sx, d2.sy);
    ctx.closePath();
    ctx.clip();
    // afin dönüşüm: kaynak üçgeni hedef üçgene taşı
    const x0 = d0.sx;
    const y0 = d0.sy;
    const x1 = d1.sx - x0;
    const y1 = d1.sy - y0;
    const x2 = d2.sx - x0;
    const y2 = d2.sy - y0;
    const su1 = u1 - u0;
    const sv1 = v1 - v0;
    const su2 = u2 - u0;
    const sv2 = v2 - v0;
    const denom = su1 * sv2 - su2 * sv1;
    if (Math.abs(denom) < 1e-6) {
      ctx.restore();
      return;
    }
    const det = 1 / denom;
    const a = (sv2 * x1 - sv1 * x2) * det;
    const b = (sv2 * y1 - sv1 * y2) * det;
    const c = (su1 * x2 - su2 * x1) * det;
    const d = (su1 * y2 - su2 * y1) * det;
    ctx.transform(a, b, c, d, x0 - a * u0 - c * v0, y0 - b * u0 - d * v0);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  private faikTile: HTMLCanvasElement | null = null;
  private buildFaikTile(): HTMLCanvasElement | null {
    if (this.faikTile) return this.faikTile;
    if (!this.faikReady || !this.faikImg) return null;
    const size = 220;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const g = c.getContext("2d")!;
    g.fillStyle = "#123a22";
    g.fillRect(0, 0, size, size);
    const im = this.faikImg;
    const ar = im.width / im.height;
    let dw = size;
    let dh = size;
    if (ar > 1) dw = size * ar;
    else dh = size / ar;
    g.drawImage(im, (size - dw) / 2, (size - dh) / 2, dw, dh);
    // hafif koyultma: saha çizgileri okunur kalsın
    g.fillStyle = "rgba(8,34,20,0.3)";
    g.fillRect(0, 0, size, size);
    this.faikTile = c;
    return c;
  }

  /* ------------------------------------------------------------------ */
  /*  Ortam: gökyüzü, tribün, ışıklar                                    */
  /* ------------------------------------------------------------------ */

  private drawSky(opts: ViewOpts) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    if (opts.faik) {
      g.addColorStop(0, "#101c16");
      g.addColorStop(0.45, "#16281d");
      g.addColorStop(1, "#0a1410");
    } else {
      g.addColorStop(0, "#050d18");
      g.addColorStop(0.4, "#0a1b2b");
      g.addColorStop(1, "#07130f");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  private standRows(opts: ViewOpts) {
    return clamp(Math.round(3 + opts.standsLevel * 1.35), 4, 13);
  }

  private drawStands(opts: ViewOpts) {
    const rows = this.standRows(opts);
    const out = rows * 1.15;
    const top = 2.2 + rows * 0.9;
    const inner = MARGIN + STAND_GAP;
    const L = PITCH.L;
    const W = PITCH.W;
    const ex = MARGIN + 10;

    const face = "#101a24";
    const back = "#0a1219";

    // dört tribünün eğimli yüzeyi
    const sides: [number, number, number, number, number, number, number, number][] = [
      // x1,y1  x2,y2 (iç kenar) → dış kenar ofseti (dy)
      [-ex, -inner, L + ex, -inner, 0, -out, 0, 0],
      [-ex, W + inner, L + ex, W + inner, 0, out, 0, 0],
      [-inner, -ex, -inner, W + ex, -out, 0, 0, 0],
      [L + inner, -ex, L + inner, W + ex, out, 0, 0, 0],
    ];
    for (const [x1, y1, x2, y2, dx, dy] of sides) {
      const grd = this.ctx.createLinearGradient(0, 0, 0, this.h);
      grd.addColorStop(0, back);
      grd.addColorStop(1, face);
      this.poly(
        [
          [x1, y1, 1.1],
          [x2, y2, 1.1],
          [x2 + dx, y2 + dy, top],
          [x1 + dx, y1 + dy, top],
        ],
        grd
      );
      // ön duvar (reklam panosu yüksekliğinde)
      this.poly(
        [
          [x1, y1, 0],
          [x2, y2, 0],
          [x2, y2, 1.1],
          [x1, y1, 1.1],
        ],
        "#0e2a1c"
      );
    }

    // seyirciler
    const maxZ = top - 0.2;
    const step = opts.quality >= 2 ? 1 : opts.quality === 1 ? 2 : 4;
    const ctx = this.ctx;
    for (let i = 0; i < this.crowdSeed.length; i += step) {
      const c = this.crowdSeed[i];
      if (c.z > maxZ) continue;
      const wob = Math.sin(this.time * 2.2 + c.ph) * 0.09;
      const pr = this.project(c.x, c.y, c.z + wob);
      if (!pr.ok) continue;
      if (pr.sx < -20 || pr.sx > this.w + 20 || pr.sy < -20 || pr.sy > this.h + 20) continue;
      const r = Math.max(0.7, pr.s * 0.24);
      ctx.fillStyle = c.c;
      ctx.fillRect(pr.sx - r / 2, pr.sy - r, r, r * 1.5);
    }

    // çatı hattı
    for (const [x1, y1, x2, y2, dx, dy] of sides) {
      this.poly(
        [
          [x1 + dx, y1 + dy, top],
          [x2 + dx, y2 + dy, top],
          [x2 + dx * 1.05, y2 + dy * 1.05, top + 3.2],
          [x1 + dx * 1.05, y1 + dy * 1.05, top + 3.2],
        ],
        "rgba(9,16,22,0.92)"
      );
    }
  }

  private drawFloodlights(opts: ViewOpts) {
    const lv = opts.lightsLevel;
    if (lv < 1) return;
    const rows = this.standRows(opts);
    const top = 2.2 + rows * 0.9 + 3.2;
    const h = top + 6 + lv * 1.6;
    const corners: [number, number][] = [
      [-MARGIN - 6, -MARGIN - 6],
      [PITCH.L + MARGIN + 6, -MARGIN - 6],
      [-MARGIN - 6, PITCH.W + MARGIN + 6],
      [PITCH.L + MARGIN + 6, PITCH.W + MARGIN + 6],
    ];
    const ctx = this.ctx;
    for (const [x, y] of corners) {
      const base = this.project(x, y, 0);
      const tip = this.project(x, y, h);
      if (!base.ok || !tip.ok) continue;
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = Math.max(1, tip.s * 0.5);
      ctx.beginPath();
      ctx.moveTo(base.sx, base.sy);
      ctx.lineTo(tip.sx, tip.sy);
      ctx.stroke();
      const rw = Math.max(6, tip.s * (2.6 + lv * 0.4));
      const rh = Math.max(3, tip.s * 1.2);
      ctx.fillStyle = "#111a24";
      ctx.fillRect(tip.sx - rw / 2, tip.sy - rh, rw, rh);
      // lamba parıltısı
      const glow = ctx.createRadialGradient(tip.sx, tip.sy - rh / 2, 0, tip.sx, tip.sy - rh / 2, rw * 1.6);
      glow.addColorStop(0, `rgba(255,250,220,${0.28 + lv * 0.05})`);
      glow.addColorStop(1, "rgba(255,250,220,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(tip.sx - rw * 1.8, tip.sy - rh - rw * 1.8, rw * 3.6, rw * 3.6);
      const cols = 3 + Math.min(3, Math.floor(lv / 2));
      for (let i = 0; i < cols; i++) {
        ctx.fillStyle = "rgba(255,253,235,0.92)";
        const bw = rw / (cols + 1);
        ctx.fillRect(tip.sx - rw / 2 + bw * i + bw * 0.35, tip.sy - rh + rh * 0.2, bw * 0.6, rh * 0.55);
      }
    }
  }

  private drawBigScreen(opts: ViewOpts, e: MatchEngine) {
    if (opts.screenLevel < 2) return;
    const rows = this.standRows(opts);
    const z0 = 2.2 + rows * 0.72;
    const w = 10 + opts.screenLevel * 1.6;
    const hgt = w * 0.5;
    const x = PITCH.L / 2;
    const y = PITCH.W + MARGIN + STAND_GAP + rows * 0.95;
    const ctx = this.ctx;
    const p0 = this.project(x - w / 2, y, z0 + hgt);
    const p1 = this.project(x + w / 2, y, z0 + hgt);
    const p2 = this.project(x + w / 2, y, z0);
    const p3 = this.project(x - w / 2, y, z0);
    if (!p0.ok || !p1.ok || !p2.ok || !p3.ok) return;
    ctx.beginPath();
    ctx.moveTo(p0.sx, p0.sy);
    ctx.lineTo(p1.sx, p1.sy);
    ctx.lineTo(p2.sx, p2.sy);
    ctx.lineTo(p3.sx, p3.sy);
    ctx.closePath();
    ctx.fillStyle = "#050a10";
    ctx.fill();
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2;
    ctx.stroke();
    // skor
    const cx = (p0.sx + p2.sx) / 2;
    const cy = (p0.sy + p2.sy) / 2;
    const fs = Math.max(7, Math.abs(p2.sy - p0.sy) * 0.42);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#37f28b";
    ctx.font = `900 ${fs}px system-ui, sans-serif`;
    ctx.fillText(`${e.score[0]} - ${e.score[1]}`, cx, cy);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /*  Saha                                                               */
  /* ------------------------------------------------------------------ */

  private drawPitch(opts: ViewOpts) {
    const L = PITCH.L;
    const W = PITCH.W;
    const ctx = this.ctx;

    // dış çim / halı kenarı
    this.poly(
      [
        [-MARGIN, -MARGIN, 0],
        [L + MARGIN, -MARGIN, 0],
        [L + MARGIN, W + MARGIN, 0],
        [-MARGIN, W + MARGIN, 0],
      ],
      opts.faik ? "#123324" : "#0d3d22"
    );

    if (opts.faik) {
      const tile = this.buildFaikTile();
      if (tile) {
        const cols = 10;
        const rowsT = 7;
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rowsT; j++) {
            const x0 = (i / cols) * L;
            const x1 = ((i + 1) / cols) * L;
            const y0 = (j / rowsT) * W;
            const y1 = ((j + 1) / rowsT) * W;
            this.texQuad(
              tile,
              tile.width,
              tile.height,
              [x0, y0, 0],
              [x1, y0, 0],
              [x1, y1, 0],
              [x0, y1, 0]
            );
          }
        }
      } else {
        this.poly(
          [
            [0, 0, 0],
            [L, 0, 0],
            [L, W, 0],
            [0, W, 0],
          ],
          "#1c6b3d"
        );
      }
      // halısaha zemin parlaklığı
      const p0 = this.project(0, 0, 0);
      const p2 = this.project(L, W, 0);
      if (p0.ok && p2.ok) {
        const g = ctx.createLinearGradient(0, Math.min(p0.sy, p2.sy), 0, Math.max(p0.sy, p2.sy));
        g.addColorStop(0, "rgba(255,255,255,0.06)");
        g.addColorStop(1, "rgba(0,0,0,0.18)");
        this.poly(
          [
            [0, 0, 0.01],
            [L, 0, 0.01],
            [L, W, 0.01],
            [0, W, 0.01],
          ],
          g
        );
      }
    } else {
      // çim şeritleri (biçme deseni)
      const stripes = 16;
      for (let i = 0; i < stripes; i++) {
        const x0 = (i / stripes) * L;
        const x1 = ((i + 1) / stripes) * L;
        this.poly(
          [
            [x0, 0, 0],
            [x1, 0, 0],
            [x1, W, 0],
            [x0, W, 0],
          ],
          i % 2 === 0 ? "#1d8347" : "#17703c"
        );
      }
      // çim dokusu
      if (opts.quality >= 1) {
        for (const t of this.grassTuft) {
          const p = this.project(t.x, t.y, 0);
          if (!p.ok || p.s < 3) continue;
          ctx.fillStyle = "rgba(255,255,255,0.022)";
          ctx.beginPath();
          ctx.ellipse(p.sx, p.sy, t.r * p.s * 0.34, t.r * p.s * 0.1, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    /* --------- çizgiler --------- */
    const LINE = opts.faik ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.88)";
    const lw = 0.14;
    this.groundRect(0, 0, L, W, lw, LINE);
    this.groundLine(L / 2, 0, L / 2, W, lw, LINE);
    this.groundArc(L / 2, W / 2, PITCH.CIRCLE, 0, Math.PI * 2, lw, LINE);
    // orta nokta
    this.groundArc(L / 2, W / 2, 0.16, 0, Math.PI * 2, 0.3, LINE);

    for (const side of [0, 1]) {
      const dir = side === 0 ? 1 : -1;
      const gx = side === 0 ? 0 : L;
      this.groundRect(
        side === 0 ? 0 : L - PITCH.PEN_D,
        W / 2 - PITCH.PEN_W / 2,
        PITCH.PEN_D,
        PITCH.PEN_W,
        lw,
        LINE
      );
      this.groundRect(
        side === 0 ? 0 : L - PITCH.SIX_D,
        W / 2 - PITCH.SIX_W / 2,
        PITCH.SIX_D,
        PITCH.SIX_W,
        lw,
        LINE
      );
      const px = gx + dir * 11;
      this.groundArc(px, W / 2, 0.18, 0, Math.PI * 2, 0.34, LINE);
      const a = Math.acos(clamp((PITCH.PEN_D - 11) / PITCH.CIRCLE, -1, 1));
      if (dir === 1) this.groundArc(px, W / 2, PITCH.CIRCLE, -a, a, lw, LINE);
      else this.groundArc(px, W / 2, PITCH.CIRCLE, Math.PI - a, Math.PI + a, lw, LINE);
      for (const cy of [0, W]) {
        const s0 = cy === 0 ? 0 : -Math.PI / 2;
        this.groundArc(gx, cy, 1, s0 + (dir === 1 ? 0 : Math.PI / 2), s0 + (dir === 1 ? Math.PI / 2 : Math.PI), lw, LINE);
      }
    }

    if (opts.faik) this.drawCage();
  }

  /** Halısaha modunda saha çevresi kafes/bariyer */
  private drawCage() {
    const L = PITCH.L;
    const W = PITCH.W;
    const h = 4.2;
    const ctx = this.ctx;
    const segs: [number, number, number, number][] = [
      [-1.5, -1.5, L + 1.5, -1.5],
      [-1.5, W + 1.5, L + 1.5, W + 1.5],
    ];
    for (const [x1, y1, x2, y2] of segs) {
      // alt bariyer
      this.poly(
        [
          [x1, y1, 0],
          [x2, y2, 0],
          [x2, y2, 1.0],
          [x1, y1, 1.0],
        ],
        "rgba(16,44,30,0.9)"
      );
      // tel örgü
      const n = 34;
      ctx.strokeStyle = "rgba(190,220,205,0.16)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        const a = this.project(x, y, 1.0);
        const b = this.project(x, y, h);
        if (!a.ok || !b.ok) continue;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
      for (let k = 1; k <= 3; k++) {
        const z = 1.0 + ((h - 1.0) * k) / 3;
        const a = this.project(x1, y1, z);
        const b = this.project(x2, y2, z);
        if (!a.ok || !b.ok) continue;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
    }
  }

  /** Üç boyutlu görünüm veren kalın çubuk (kamera dik düzleminde kalınlık). */
  private bar(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, t: number, color: string) {
    const a = this.project(x1, y1, z1);
    const b = this.project(x2, y2, z2);
    if (!a.ok || !b.ok) return;
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1.1, ((a.s + b.s) / 2) * t);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
    ctx.lineCap = "butt";
  }

  /* ------------------------------------------------------------------ */
  /*  Oyuncular                                                          */
  /* ------------------------------------------------------------------ */

  /** Oyuncunun kameraya göre yönü: yan bileşen ve ileri bileşen */
  private facingOf(p: MP) {
    const fx = Math.cos(p.facing);
    const fy = Math.sin(p.facing);
    return {
      side: fx * this.right.x + fy * this.right.y,
      away: fx * this.fwd.x + fy * this.fwd.y,
    };
  }

  private kitOf(e: MatchEngine, p: MP): Kit {
    const club = CLUB_MAP[e.teams[p.team].clubId];
    return p.gk
      ? { ...club.kit, primary: club.gkKit.primary, secondary: club.gkKit.secondary, pattern: "plain" }
      : club.kit;
  }

  private drawShadow(x: number, y: number, r: number, alpha: number) {
    const pr = this.project(x, y, 0);
    if (!pr.ok) return;
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(pr.sx, pr.sy, r * pr.s, r * pr.s * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPlayer(e: MatchEngine, p: MP, opts: ViewOpts) {
    const pr = this.project(p.x, p.y, 0);
    if (!pr.ok) return;
    if (pr.sx < -260 || pr.sx > this.w + 260) return;
    const ctx = this.ctx;
    const look = lookOf(p.ref);
    const kit = this.kitOf(e, p);
    const H = 1.84 * look.height * PLAYER_SCALE;
    const k = (pr.s * H) / 100; // 100 birimlik figürü metreye ölçekle
    if (k < 0.03) return;
    const detail = pr.s * H; // figür piksel yüksekliği
    const face = detail > 44 && opts.quality >= 1;

    const dir = this.facingOf(p);
    const mirror = dir.side >= 0 ? 1 : -1;
    const backView = dir.away > 0.15;
    const speed = Math.hypot(p.vx, p.vy);
    const running = speed > 0.6;
    const cyc = p.anim * 1.5;
    const swing = running ? Math.sin(cyc) * clamp(speed / 7, 0.25, 1) : Math.sin(this.time * 1.6) * 0.12;
    const bob = running ? Math.abs(Math.cos(cyc)) * 2.4 * clamp(speed / 7, 0.3, 1) : Math.sin(this.time * 1.6) * 0.7;

    // kutlama / kayma / uçuş durumları
    const celebrating = p.celebrate > 0;
    const celType = hashStr(p.id + "cel") % 5;
    const sliding = p.slide > 0;
    const diving = p.gk && p.dive > 0;
    let lean = 0;
    let lift = 0;
    if (sliding) {
      lean = mirror * 1.15;
      lift = -6;
    } else if (diving) {
      const dy = e.ball.y - p.y;
      lean = (dy > 0 ? 1 : -1) * mirror * 1.25;
      lift = -18;
    } else if (celebrating && celType === 1) {
      lean = mirror * 0.85;
      lift = -4;
    } else if (celebrating && (celType === 0 || celType === 3)) {
      lift = -Math.abs(Math.sin(this.time * 7)) * 12;
    } else if (p.stagger > 0) {
      lean = -mirror * 0.35;
    }

    const skin = SKIN_TONES[look.skin];
    const skinDark = shadeOf(look.skin);
    const hairCol = HAIR_COLORS[look.hairColor];
    const boot = BOOT_COLORS[look.boots];
    const shorts = kit.shorts || shade(kit.primary, 0.55);
    const socks = p.gk ? kit.secondary : kit.primary;

    ctx.save();
    ctx.translate(pr.sx, pr.sy + lift * k);
    ctx.scale(k * mirror, k);
    if (lean) ctx.rotate(lean * mirror);

    const bodyW = look.build === 0 ? 25 : look.build === 1 ? 28 : 32;

    /* ---------------- bacaklar ---------------- */
    const legSwing = celebrating && celType === 0 ? 4 : swing * 16;
    const drawLeg = (dxOff: number, phase: number, front: boolean) => {
      ctx.save();
      ctx.translate(dxOff, -46 - bob);
      ctx.rotate((phase * Math.PI) / 180 / 4);
      ctx.fillStyle = front ? skin : skinDark;
      // uyluk + baldır
      ctx.fillRect(-5.2, 0, 10.4, 26);
      ctx.save();
      ctx.translate(0, 26);
      ctx.rotate((-phase * Math.PI) / 180 / 6);
      ctx.fillRect(-4.6, 0, 9.2, 12);
      // çorap
      ctx.fillStyle = socks;
      ctx.fillRect(-4.8, 8, 9.6, 12);
      // krampon
      ctx.fillStyle = boot;
      ctx.beginPath();
      ctx.ellipse(1.5, 21, 7, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.restore();
    };
    drawLeg(-7, -legSwing, false);
    drawLeg(7, legSwing, true);

    /* ---------------- şort ---------------- */
    ctx.fillStyle = shorts;
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.52, -56 - bob);
    ctx.lineTo(bodyW * 0.52, -56 - bob);
    ctx.lineTo(bodyW * 0.46, -40 - bob);
    ctx.lineTo(2, -38 - bob);
    ctx.lineTo(-2, -38 - bob);
    ctx.lineTo(-bodyW * 0.46, -40 - bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fillRect(-1.2, -56 - bob, 2.4, 18);

    /* ---------------- gövde / forma ---------------- */
    const tTop = -84 - bob;
    const tBot = -54 - bob;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-bodyW / 2, tTop + 4);
    ctx.quadraticCurveTo(0, tTop - 2, bodyW / 2, tTop + 4);
    ctx.lineTo(bodyW * 0.56, tBot);
    ctx.lineTo(-bodyW * 0.56, tBot);
    ctx.closePath();
    ctx.fillStyle = kit.primary;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = kit.secondary;
    switch (kit.pattern) {
      case "stripes":
        for (let i = -3; i <= 3; i++) ctx.fillRect(i * 8 - 2.4, tTop - 4, 4.8, 40);
        break;
      case "halves":
        ctx.fillRect(0, tTop - 4, bodyW, 40);
        break;
      case "hoops":
        for (let i = 0; i < 4; i++) ctx.fillRect(-bodyW, tTop + 2 + i * 8, bodyW * 2, 4);
        break;
      case "sash":
        ctx.save();
        ctx.rotate(-0.6);
        ctx.fillRect(-40, tTop + 6, 80, 7);
        ctx.restore();
        break;
      default:
        break;
    }
    // gölge / hacim
    const grd = ctx.createLinearGradient(-bodyW / 2, 0, bodyW / 2, 0);
    grd.addColorStop(0, "rgba(255,255,255,0.14)");
    grd.addColorStop(0.5, "rgba(255,255,255,0)");
    grd.addColorStop(1, "rgba(0,0,0,0.24)");
    ctx.fillStyle = grd;
    ctx.fillRect(-bodyW, tTop - 6, bodyW * 2, 42);
    ctx.restore();

    // forma numarası (sırt görünümünde)
    if (backView && detail > 40) {
      ctx.save();
      ctx.scale(mirror, 1); // yazı ters dönmesin
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 16px system-ui, sans-serif";
      ctx.fillStyle = shade(kit.primary, 0.4) === kit.secondary ? "#ffffff" : kit.secondary;
      ctx.globalAlpha = 0.95;
      ctx.fillText(String(p.ref.num), 0, tTop + 17);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    /* ---------------- kollar ---------------- */
    const armUp = celebrating && (celType === 0 || celType === 3);
    const armWide = celebrating && celType === 2;
    const drawArm = (sideSign: number, phase: number) => {
      ctx.save();
      ctx.translate(sideSign * (bodyW / 2 + 1), tTop + 8);
      let rot = (-phase * Math.PI) / 180 / 3.4;
      if (armUp) rot = sideSign * -2.5;
      else if (armWide) rot = sideSign * -1.55;
      else if (diving) rot = sideSign * -1.9;
      else if (sliding) rot = sideSign * -0.9;
      ctx.rotate(rot);
      ctx.fillStyle = kit.primary;
      ctx.fillRect(-3.6, 0, 7.2, 11); // kısa kol
      ctx.fillStyle = skin;
      ctx.fillRect(-3.1, 10, 6.2, 17);
      if (p.gk) {
        ctx.fillStyle = kit.secondary;
        ctx.beginPath();
        ctx.ellipse(0, 28, 4.6, 5.2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = skinDark;
        ctx.beginPath();
        ctx.ellipse(0, 27, 3.4, 3.9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };
    drawArm(-1, -legSwing);
    drawArm(1, legSwing);

    /* ---------------- baş ---------------- */
    const hx = 0;
    const hy = tTop - 11;
    ctx.fillStyle = skinDark;
    ctx.fillRect(-3.4, tTop - 4, 6.8, 6); // boyun
    ctx.beginPath();
    ctx.ellipse(hx, hy, 10.4, 11.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = skin;
    ctx.fill();
    // kulak
    ctx.beginPath();
    ctx.ellipse(-9.6, hy + 1, 2.1, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = skinDark;
    ctx.fill();

    if (!backView && face) {
      // yüz detayları
      const eyeY = hy + 0.6;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(-3.6, eyeY, 2.3, 1.8, 0, 0, Math.PI * 2);
      ctx.ellipse(3.6, eyeY, 2.3, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#14100c";
      ctx.beginPath();
      ctx.arc(-3.4, eyeY + 0.2, 1.05, 0, Math.PI * 2);
      ctx.arc(3.8, eyeY + 0.2, 1.05, 0, Math.PI * 2);
      ctx.fill();
      // kaş
      ctx.strokeStyle = hairCol;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, eyeY - 3.4);
      ctx.lineTo(-1.4, eyeY - 4.1);
      ctx.moveTo(1.4, eyeY - 4.1);
      ctx.lineTo(6, eyeY - 3.4);
      ctx.stroke();
      // burun + ağız
      ctx.strokeStyle = skinDark;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0.2, eyeY + 1.2);
      ctx.lineTo(0.9, eyeY + 4.2);
      ctx.stroke();
      ctx.strokeStyle = "#8c4a44";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      if (celebrating) ctx.arc(0, eyeY + 5.2, 3.1, 0.15 * Math.PI, 0.85 * Math.PI);
      else ctx.arc(0, eyeY + 4.4, 2.6, 0.12 * Math.PI, 0.88 * Math.PI);
      ctx.stroke();
      // sakal
      if (look.beard > 0) {
        ctx.fillStyle = hairCol;
        ctx.globalAlpha = look.beard === 1 ? 0.35 : 0.8;
        ctx.beginPath();
        ctx.ellipse(0, hy + 6.4, 8.4, look.beard === 3 ? 6.6 : 4.6, 0, 0, Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // saç
    if (look.hair !== 5) {
      ctx.fillStyle = hairCol;
      ctx.beginPath();
      switch (look.hair) {
        case 0: // kısa
          ctx.ellipse(hx, hy - 3.6, 10.6, 8.4, 0, Math.PI, Math.PI * 2);
          ctx.fill();
          break;
        case 1: // saç bandı / kısa kesim
          ctx.ellipse(hx, hy - 2.6, 10.8, 8.8, 0, Math.PI, Math.PI * 2);
          ctx.fill();
          break;
        case 2: // afro
          ctx.ellipse(hx, hy - 5.4, 13, 10.4, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 3: // uzun
          ctx.ellipse(hx, hy - 3, 11.4, 9.4, 0, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(-11.4, hy - 3, 3.4, 13);
          ctx.fillRect(8, hy - 3, 3.4, 13);
          break;
        case 4: // mohawk
          ctx.ellipse(hx, hy - 3.2, 10.4, 7.6, 0, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(-2.4, hy - 16, 4.8, 10);
          break;
        default: // topuz
          ctx.ellipse(hx, hy - 3.4, 10.8, 8.6, 0, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(hx - 9, hy - 9, 4.2, 0, Math.PI * 2);
          ctx.fill();
          break;
      }
    }

    ctx.restore();

    /* ---------------- durum göstergeleri ---------------- */
    if (p.slide > 0) {
      // kayma tozu
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      for (let i = 0; i < 4; i++) {
        const t = this.project(p.x - p.vx * 0.06 * i, p.y - p.vy * 0.06 * i, 0.05);
        if (!t.ok) continue;
        ctx.beginPath();
        ctx.ellipse(t.sx, t.sy, pr.s * (0.3 + i * 0.08), pr.s * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Kontrol edilen oyuncunun zemin halkası ve ok işareti */
  private drawSelection(p: MP, opts: ViewOpts) {
    const ctx = this.ctx;
    const pr = this.project(p.x, p.y, 0);
    if (!pr.ok) return;
    const rx = pr.s * 1.15;
    const pulse = 0.6 + Math.sin(this.time * 5) * 0.25;
    ctx.strokeStyle = `rgba(255,224,102,${pulse})`;
    ctx.lineWidth = Math.max(1.5, pr.s * 0.06);
    ctx.beginPath();
    ctx.ellipse(pr.sx, pr.sy, rx, rx * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,224,102,0.14)";
    ctx.fill();
    if (opts.quality >= 1) {
      const head = this.project(p.x, p.y, 2.5 + Math.sin(this.time * 4) * 0.12);
      if (head.ok) {
        const a = Math.max(4, pr.s * 0.4);
        ctx.fillStyle = "#ffe066";
        ctx.beginPath();
        ctx.moveTo(head.sx, head.sy + a);
        ctx.lineTo(head.sx - a * 0.8, head.sy - a * 0.6);
        ctx.lineTo(head.sx + a * 0.8, head.sy - a * 0.6);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /* --------------------------- top --------------------------- */
  private drawBall(e: MatchEngine, opts: ViewOpts) {
    const b = e.ball;
    const ctx = this.ctx;
    // iz
    this.ballTrail.push({ x: b.x, y: b.y, z: b.z });
    if (this.ballTrail.length > 10) this.ballTrail.shift();
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 12 && opts.quality >= 1) {
      for (let i = 0; i < this.ballTrail.length - 1; i++) {
        const t = this.ballTrail[i];
        const pr = this.project(t.x, t.y, t.z + 0.12);
        if (!pr.ok) continue;
        ctx.fillStyle = `rgba(255,255,255,${(i / this.ballTrail.length) * 0.22})`;
        ctx.beginPath();
        ctx.arc(pr.sx, pr.sy, Math.max(0.6, pr.s * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const pr = this.project(b.x, b.y, b.z + 0.12);
    if (!pr.ok) return;
    const r = Math.max(2.2, pr.s * 0.2);
    // top gövdesi
    const g = ctx.createRadialGradient(pr.sx - r * 0.35, pr.sy - r * 0.4, r * 0.1, pr.sx, pr.sy, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.75, "#eef2f0");
    g.addColorStop(1, "#b9c4bf");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(pr.sx, pr.sy, r, 0, Math.PI * 2);
    ctx.fill();
    if (r > 3) {
      const rot = this.time * 6 + b.x * 0.4;
      ctx.fillStyle = "#161b1e";
      for (let i = 0; i < 5; i++) {
        const a = rot + (i * Math.PI * 2) / 5;
        const px = pr.sx + Math.cos(a) * r * 0.52;
        const py = pr.sy + Math.sin(a) * r * 0.52;
        ctx.beginPath();
        ctx.arc(px, py, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(pr.sx, pr.sy, r * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = Math.max(0.5, r * 0.1);
    ctx.stroke();
  }

  /* --------------------------- konfeti --------------------------- */
  private spawnConfetti(x: number, y: number, kit: Kit) {
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 7;
      this.confetti.push({
        x: x + Math.cos(a) * 2,
        y: y + Math.sin(a) * 2,
        z: 1 + Math.random() * 3,
        vx: Math.cos(a) * sp * 0.4,
        vy: Math.sin(a) * sp * 0.4,
        vz: 3 + Math.random() * 5,
        c: Math.random() < 0.5 ? kit.primary : Math.random() < 0.5 ? kit.secondary : "#ffffff",
        life: 2.2 + Math.random(),
      });
    }
  }

  private drawConfetti(dt: number) {
    const ctx = this.ctx;
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.life -= dt;
      if (c.life <= 0) {
        this.confetti.splice(i, 1);
        continue;
      }
      c.vz -= 6 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z = Math.max(0, c.z + c.vz * dt);
      const pr = this.project(c.x, c.y, c.z);
      if (!pr.ok) continue;
      const s = Math.max(1, pr.s * 0.12);
      ctx.fillStyle = c.c;
      ctx.globalAlpha = clamp(c.life, 0, 1);
      ctx.fillRect(pr.sx, pr.sy, s, s * 1.8);
      ctx.globalAlpha = 1;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Üst katman (ekran uzayı)                                           */
  /* ------------------------------------------------------------------ */

  private drawOverlay(e: MatchEngine, opts: ViewOpts) {
    const ctx = this.ctx;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // isim etiketleri
    if (opts.showNames) {
      for (const p of e.players) {
        if (!p.onPitch) continue;
        const isCtrl = e.controlled === p;
        const hasBall = e.ball.owner === p;
        if (!isCtrl && !hasBall) continue;
        const pr = this.project(p.x, p.y, 2.6);
        if (!pr.ok) continue;
        const name = p.ref.name.split(" ").slice(-1)[0].toUpperCase();
        const fs = clamp(pr.s * 0.42, 8, 15);
        ctx.font = `800 ${fs}px system-ui, sans-serif`;
        const tw = ctx.measureText(name).width;
        const bx = pr.sx - tw / 2 - 5;
        const by = pr.sy - fs - 12;
        ctx.fillStyle = isCtrl ? "rgba(9,20,14,0.82)" : "rgba(9,20,14,0.5)";
        roundRect(ctx, bx, by, tw + 10, fs + 6, 4);
        ctx.fill();
        ctx.fillStyle = isCtrl ? "#ffe066" : "rgba(255,255,255,0.7)";
        ctx.fillText(name, pr.sx, by + fs / 2 + 3);
        if (isCtrl) {
          // numara rozeti
          ctx.fillStyle = "#ffe066";
          ctx.font = `900 ${fs * 0.8}px system-ui, sans-serif`;
        }
      }
    }

    // duran top göstergesi
    if (e.restart && e.restart.taker) {
      const t = e.restart.taker;
      const pr = this.project(t.x, t.y, 0);
      if (pr.ok) {
        ctx.strokeStyle = "rgba(55,242,139,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(pr.sx, pr.sy, pr.s * 1.5, pr.s * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // radar
    if (opts.radar) this.drawRadar(e, opts);
  }

  private drawRadar(e: MatchEngine, opts: ViewOpts) {
    const ctx = this.ctx;
    const rw = clamp(this.w * 0.17, 100, 190);
    const rh = rw * (PITCH.W / PITCH.L);
    const rx = this.w - rw - 12;
    const ry = 56;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(4,14,10,0.82)";
    roundRect(ctx, rx - 4, ry - 4, rw + 8, rh + 8, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.beginPath();
    ctx.moveTo(rx + rw / 2, ry);
    ctx.lineTo(rx + rw / 2, ry + rh);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rx + rw / 2, ry + rh / 2, rw * 0.08, 0, Math.PI * 2);
    ctx.stroke();
    // kullanıcı hücum yönü oku
    const attack = e.dir[opts.userTeam] === 1 ? 1 : -1;
    ctx.fillStyle = "rgba(55,242,139,0.35)";
    ctx.beginPath();
    const ax = attack === 1 ? rx + rw - 10 : rx + 10;
    ctx.moveTo(ax + attack * 7, ry + rh / 2);
    ctx.lineTo(ax, ry + rh / 2 - 5);
    ctx.lineTo(ax, ry + rh / 2 + 5);
    ctx.closePath();
    ctx.fill();

    for (const p of e.players) {
      if (!p.onPitch) continue;
      const club = CLUB_MAP[e.teams[p.team].clubId];
      const px = rx + (p.x / PITCH.L) * rw;
      const py = ry + (p.y / PITCH.W) * rh;
      ctx.fillStyle = p.gk ? club.gkKit.primary : club.kit.primary;
      ctx.beginPath();
      ctx.arc(px, py, e.controlled === p ? 3.4 : 2.4, 0, Math.PI * 2);
      ctx.fill();
      if (e.controlled === p) {
        ctx.strokeStyle = "#ffe066";
        ctx.lineWidth = 1.4;
        ctx.stroke();
      } else if (p.team !== opts.userTeam) {
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(rx + (e.ball.x / PITCH.L) * rw, ry + (e.ball.y / PITCH.W) * rh, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /*  Ana çizim                                                          */
  /* ------------------------------------------------------------------ */

  private lastGoals = 0;

  draw(e: MatchEngine, opts: ViewOpts, dt: number) {
    const ctx = this.ctx;
    this.time += dt;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.updateCamera(e, opts, dt);

    this.drawSky(opts);
    this.drawStands(opts);
    this.drawFloodlights(opts);
    this.drawBigScreen(opts, e);
    this.drawPitch(opts);

    // gölgeler (zemin düzleminde, herkesin altında)
    for (const p of e.players) {
      if (!p.onPitch) continue;
      this.drawShadow(p.x + 0.25, p.y + 0.2, 0.62, 0.3);
    }
    this.drawShadow(e.ball.x, e.ball.y, 0.16 + e.ball.z * 0.03, 0.34);

    // seçili oyuncu halkası
    if (e.controlled && e.controlled.onPitch) this.drawSelection(e.controlled, opts);

    // derinlik sıralı katman: kaleler + oyuncular + top
    interface Item {
      z: number;
      fn: () => void;
    }
    const items: Item[] = [];
    const depthAt = (x: number, y: number, z = 0) => {
      const dx = x - this.camPos.x;
      const dy = y - this.camPos.y;
      const dz = z - this.camPos.z;
      return dx * this.fwd.x + dy * this.fwd.y + dz * this.fwd.z;
    };
    for (const p of e.players) {
      if (!p.onPitch) continue;
      items.push({ z: depthAt(p.x, p.y, 0.9), fn: () => this.drawPlayer(e, p, opts) });
    }
    items.push({ z: depthAt(e.ball.x, e.ball.y, e.ball.z), fn: () => this.drawBall(e, opts) });
    items.push({ z: depthAt(0, PITCH.W / 2, 1.2), fn: () => this.drawGoalAt(0, opts.faik) });
    items.push({ z: depthAt(PITCH.L, PITCH.W / 2, 1.2), fn: () => this.drawGoalAt(1, opts.faik) });
    items.sort((a, b) => b.z - a.z);
    for (const it of items) it.fn();

    // gol konfetisi
    if (e.score[0] + e.score[1] !== this.lastGoals) {
      this.lastGoals = e.score[0] + e.score[1];
      const team = e.fx.goalTeam >= 0 ? e.fx.goalTeam : 0;
      const club = CLUB_MAP[e.teams[team].clubId];
      this.spawnConfetti(e.ball.x, e.ball.y, club.kit);
    }
    this.drawConfetti(dt);

    this.drawOverlay(e, opts);

    if (e.fx.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${e.fx.flash * 0.3})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    // sinematik kenar karartma
    const vig = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.35, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.78);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  private drawGoalAt(side: 0 | 1, faik: boolean) {
    const ctx = this.ctx;
    const W = PITCH.W;
    const gw = PITCH.GOAL_W;
    const gh = PITCH.GOAL_H;
    const depth = 2.0;
    const gx = side === 0 ? 0 : PITCH.L;
    const dir = side === 0 ? -1 : 1;
    const y0 = W / 2 - gw / 2;
    const y1 = W / 2 + gw / 2;
    const bx = gx + dir * depth;

    const netFill = "rgba(226,240,235,0.10)";
    this.poly([[gx, y0, 0], [bx, y0, 0], [bx, y0, gh * 0.82], [gx, y0, gh]], netFill);
    this.poly([[gx, y1, 0], [bx, y1, 0], [bx, y1, gh * 0.82], [gx, y1, gh]], netFill);
    this.poly([[bx, y0, 0], [bx, y1, 0], [bx, y1, gh * 0.82], [bx, y0, gh * 0.82]], netFill);
    this.poly([[gx, y0, gh], [gx, y1, gh], [bx, y1, gh * 0.82], [bx, y0, gh * 0.82]], "rgba(226,240,235,0.07)");

    ctx.strokeStyle = "rgba(240,255,248,0.32)";
    ctx.lineWidth = 1;
    const nv = 11;
    for (let i = 0; i <= nv; i++) {
      const y = y0 + ((y1 - y0) * i) / nv;
      const a = this.project(gx, y, gh);
      const b = this.project(bx, y, gh * 0.82);
      const c = this.project(bx, y, 0);
      if (a.ok && b.ok && c.ok) {
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.lineTo(c.sx, c.sy);
        ctx.stroke();
      }
    }
    for (let k = 0; k <= 5; k++) {
      const z = (gh * k) / 5;
      const a = this.project(bx, y0, z * 0.82);
      const b = this.project(bx, y1, z * 0.82);
      if (a.ok && b.ok) {
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
    }
    const post = faik ? "#f1f5f9" : "#ffffff";
    this.bar(gx, y0, 0, gx, y0, gh, 0.15, post);
    this.bar(gx, y1, 0, gx, y1, gh, 0.15, post);
    this.bar(gx, y0, gh, gx, y1, gh, 0.15, post);
    this.bar(bx, y0, 0, bx, y0, gh * 0.82, 0.09, "rgba(255,255,255,0.5)");
    this.bar(bx, y1, 0, bx, y1, gh * 0.82, 0.09, "rgba(255,255,255,0.5)");
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
