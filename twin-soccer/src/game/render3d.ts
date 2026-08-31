import { PITCH, type MatchEngine } from "./engine";
import { BOOTS, HAIR_COLORS, SKINS, lookOf } from "./look";
import { clamp } from "./rng";
import type { CameraId, Club, MP } from "./types";

/** Gerçek pinhole kamera projeksiyonlu 3B render motoru (hazır kütüphane yok). */

export interface StadiumLevels { stands: number; pitch: number; lights: number; screen: number }

export interface RenderOpts {
  eng: MatchEngine;
  quality: number;
  faik: boolean;
  faikImg: HTMLImageElement | null;
  camera: CameraId;
  userTeam: 0 | 1 | null;
  dt: number;
  time: number;
  levels: StadiumLevels;
  home: Club;
  away: Club;
}

interface CamPreset {
  side: number;      // +1: y pozitif kenar, -1: y negatif kenar
  back: number;      // topun arkasındaki mesafe (m)
  height: number;
  lateral: number;   // yanal kaydırma
  lookAhead: number;
  lookHeight: number;
  fov: number;
  follow: number;
  behind: boolean;
}

const PRESETS: Record<CameraId, CamPreset> = {
  broadcast: { side: 1, back: 46, height: 27, lateral: 0, lookAhead: 0.30, lookHeight: 0, fov: 40, follow: 3.2, behind: false },
  tele: { side: 1, back: 26, height: 16, lateral: 0, lookAhead: 0.18, lookHeight: 0, fov: 22, follow: 4.6, behind: false },
  action: { side: 1, back: 18, height: 6.5, lateral: 0, lookAhead: 0.10, lookHeight: 1.2, fov: 46, follow: 7.0, behind: false },
  behind: { side: 1, back: 17, height: 8.5, lateral: 0, lookAhead: 0.0, lookHeight: 0.9, fov: 44, follow: 6.0, behind: true },
  sky: { side: 1, back: 78, height: 72, lateral: 0, lookAhead: 0.35, lookHeight: 0, fov: 40, follow: 2.4, behind: false },
};

interface V3 { x: number; y: number; z: number }

/** Renk tonlama: amt>0 açar, amt<0 koyultur. #rgb / #rrggbb / rgb() kabul eder. */
function shade(col: string, amt: number): string {
  if (!amt) return col;
  if (col.startsWith("rgb")) return col;
  const h = col.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const p = (i: number): number => parseInt(n.slice(i * 2, i * 2 + 2), 16) || 0;
  const f = (v: number): number => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
  return `rgb(${f(p(0))},${f(p(1))},${f(p(2))})`;
}

function sub(a: V3, b: V3): V3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function cross(a: V3, b: V3): V3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function norm(a: V3): V3 {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}

interface Proj { ok: boolean; sx: number; sy: number; cz: number; sc: number }

export class Renderer3D {
  private pos: V3 = { x: 0, y: PITCH.HW + 46, z: 27 };
  private tgt: V3 = { x: 0, y: 0, z: 0 };
  private fwd: V3 = { x: 0, y: -1, z: 0 };
  private right: V3 = { x: 1, y: 0, z: 0 };
  private up: V3 = { x: 0, y: 0, z: 1 };
  private focal = 500;
  private W = 800;
  private H = 400;
  private shakeT = 0;
  private crowdSeeds: number[] = [];
  private boardCanvases: HTMLCanvasElement[] = [];
  private faikCache: { src: HTMLImageElement | null; canvas: HTMLCanvasElement } | null = null;
  private procCanvas: HTMLCanvasElement | null = null;
  private initialized = false;

  private init(): void {
    if (this.initialized) return;
    this.initialized = true;
    for (let i = 0; i < 3000; i++) this.crowdSeeds.push(Math.random());
  }

  private updateCamera(o: RenderOpts): void {
    const p = PRESETS[o.camera] ?? PRESETS.broadcast;
    const b = o.eng.ball;
    const vx = b.vx, vy = b.vy;
    const spd = Math.hypot(vx, vy);
    // aksiyon yoğunluğu: top hızlıysa/havadaysa kamera açılır, duran topa yaklaşır
    const busy = clamp(spd / 26, 0, 1) * 0.6 + clamp(b.z / 6, 0, 1) * 0.4;
    let px: number, py: number, pz: number, tx: number, ty: number, tz: number;

    if (p.behind && o.userTeam !== null) {
      const dir = o.eng.teams[o.userTeam].dir;
      const user = o.eng.controlled;
      const cx = user ? b.x * 0.62 + user.x * 0.38 : b.x;
      px = cx - dir * p.back;
      py = b.y * 0.62;
      pz = p.height + b.z * 0.34;
      tx = cx + dir * 17;
      ty = b.y * 0.85;
      tz = p.lookHeight + b.z * 0.55;
    } else {
      // topun hız vektörüne göre öngörülü hedef (aksiyon arttıkça daha ileri bak)
      const ax = b.x + vx * p.lookAhead * (1 + busy * 0.4);
      const ay = b.y * 0.44 + vy * p.lookAhead * 0.4;
      px = clamp(ax * 0.6, -PITCH.HL - 8, PITCH.HL + 8);
      py = p.side * (PITCH.HW + p.back);
      pz = p.height + b.z * 0.42;
      tx = clamp(ax, -PITCH.HL, PITCH.HL);
      ty = clamp(ay, -PITCH.HW, PITCH.HW);
      tz = p.lookHeight + b.z * 0.6;
    }

    // konum ve hedef farklı hızlarda yumuşar → sinematik gecikme hissi
    const rate = 1 - Math.exp(-p.follow * o.dt);
    const rateT = 1 - Math.exp(-p.follow * 1.55 * o.dt);
    const s = o.eng.shake;
    this.pos.x += (px - this.pos.x) * rate + Math.sin(this.shakeT * 44) * s * 0.7;
    this.pos.y += (py - this.pos.y) * rate;
    this.pos.z += (pz - this.pos.z) * rate * 0.8;
    this.tgt.x += (tx - this.tgt.x) * rateT;
    this.tgt.y += (ty - this.tgt.y) * rateT;
    this.tgt.z += (tz - this.tgt.z) * rateT;
    this.shakeT += o.dt;

    this.fwd = norm(sub(this.tgt, this.pos));
    this.right = norm(cross(this.fwd, { x: 0, y: 0, z: 1 }));
    this.up = cross(this.right, this.fwd);

    // dinamik FOV (yumuşak zoom)
    const targetFov = p.fov + busy * 6.5 - (spd < 2 ? 2.4 : 0);
    const curFov = (2 * Math.atan(this.H / 2 / Math.max(1, this.focal)) * 180) / Math.PI;
    const newFov = curFov + (targetFov - curFov) * (1 - Math.exp(-2.4 * o.dt));
    const fovRad = (newFov * Math.PI) / 180;
    this.focal = this.H / 2 / Math.tan(fovRad / 2);
  }

  private project(x: number, y: number, z: number): Proj {
    const dx = x - this.pos.x, dy = y - this.pos.y, dz = z - this.pos.z;
    const cz = dx * this.fwd.x + dy * this.fwd.y + dz * this.fwd.z;
    if (cz < 0.6) return { ok: false, sx: 0, sy: 0, cz, sc: 0 };
    const cx = dx * this.right.x + dy * this.right.y + dz * this.right.z;
    const cy = dx * this.up.x + dy * this.up.y + dz * this.up.z;
    const sc = this.focal / cz;
    return { ok: true, sx: this.W / 2 + cx * sc, sy: this.H / 2 - cy * sc, cz, sc };
  }

  private toCam(x: number, y: number, z: number): { cx: number; cy: number; cz: number } {
    const dx = x - this.pos.x, dy = y - this.pos.y, dz = z - this.pos.z;
    return {
      cx: dx * this.right.x + dy * this.right.y + dz * this.right.z,
      cy: dx * this.up.x + dy * this.up.y + dz * this.up.z,
      cz: dx * this.fwd.x + dy * this.fwd.y + dz * this.fwd.z,
    };
  }

  /** Yakın düzleme kırpıp sonra yansıtır — büyük zemin dörtgenlerinde delik oluşmaz. */
  private projPoly(pts: V3[], color: string, stroke?: string, lw = 1): void {
    const cam = pts.map((p) => this.toCam(p.x, p.y, p.z));
    const NEAR = 0.7;
    const out: { cx: number; cy: number; cz: number }[] = [];
    for (let i = 0; i < cam.length; i++) {
      const a = cam[i];
      const b = cam[(i + 1) % cam.length];
      const aIn = a.cz >= NEAR;
      const bIn = b.cz >= NEAR;
      if (aIn) out.push(a);
      if (aIn !== bIn) {
        const t = (NEAR - a.cz) / (b.cz - a.cz);
        out.push({ cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, cz: NEAR });
      }
    }
    if (out.length < 3) return;
    const ctx = this.ctx!;
    ctx.beginPath();
    for (let i = 0; i < out.length; i++) {
      const p = out[i];
      const sc = this.focal / p.cz;
      const sx = this.W / 2 + p.cx * sc;
      const sy = this.H / 2 - p.cy * sc;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    if (color) { ctx.fillStyle = color; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }

  private ctx: CanvasRenderingContext2D | null = null;

  /* ------------------------------------------------------------------ */

  render(ctx: CanvasRenderingContext2D, w: number, h: number, o: RenderOpts): void {
    this.init();
    this.ctx = ctx;
    this.W = w; this.H = h;
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    this.updateCamera(o);
    this.drawSky(o);
    this.drawBowl(o);
    this.drawStands(o);
    this.drawPitch(o);
    this.drawLines(o);
    this.drawFloodPools(o);
    this.drawBoards(o);
    this.drawCornerFlags(o);
    this.drawLightsAndScreen(o);
    this.drawEntities(o);
    ctx.restore();
    this.drawOverlay(ctx, o);
  }

  /* ------------------------------ GÖKYÜZÜ ------------------------------ */

  private drawSky(o: RenderOpts): void {
    const ctx = this.ctx!;
    const g = ctx.createLinearGradient(0, 0, 0, this.H * 0.72);
    if (o.faik) {
      g.addColorStop(0, "#0b2018");
      g.addColorStop(0.55, "#123024");
      g.addColorStop(1, "#1c4534");
    } else {
      g.addColorStop(0, "#071528");
      g.addColorStop(0.5, "#123a63");
      g.addColorStop(1, "#2a6f8f");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
    // atmosfer parıltısı
    const rg = ctx.createRadialGradient(this.W * 0.5, this.H * 0.1, 10, this.W * 0.5, this.H * 0.1, this.W * 0.7);
    rg.addColorStop(0, o.faik ? "rgba(60,220,150,0.20)" : "rgba(180,220,255,0.16)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, this.W, this.H);
  }

  /** Sahayı çevreleyen geniş stadyum tabanı — ön planda gökyüzü görünmesin. */
  private drawBowl(o: RenderOpts): void {
    const R = 150;
    this.projPoly([
      { x: -R, y: -R, z: -0.03 }, { x: R, y: -R, z: -0.03 },
      { x: R, y: R, z: -0.03 }, { x: -R, y: R, z: -0.03 },
    ], o.faik ? "#08160f" : "#071018", undefined);
  }

  /* ------------------------------ TRİBÜNLER ------------------------------ */

  private standQuads(o: RenderOpts): { pts: V3[]; depth: number; side: number }[] {
    const lv = o.levels.stands;
    const depth = 13 + lv * 3.4;
    const height = 7 + lv * 2.7;
    const margin = 6.5;
    const out: { pts: V3[]; depth: number; side: number }[] = [];
    // uzun kenarlar (y)
    for (const s of [1, -1]) {
      const y0 = s * (PITCH.HW + margin);
      const y1 = s * (PITCH.HW + margin + depth);
      const pts: V3[] = [
        { x: -PITCH.HL - 14, y: y0, z: 1.2 },
        { x: PITCH.HL + 14, y: y0, z: 1.2 },
        { x: PITCH.HL + 14, y: y1, z: height },
        { x: -PITCH.HL - 14, y: y1, z: height },
      ];
      const mid = this.toCam(0, (y0 + y1) / 2, height / 2);
      out.push({ pts, depth: mid.cz, side: s });
    }
    // kısa kenarlar (x)
    for (const s of [1, -1]) {
      const x0 = s * (PITCH.HL + margin + 3);
      const x1 = s * (PITCH.HL + margin + 3 + depth * 0.8);
      const pts: V3[] = [
        { x: x0, y: -PITCH.HW - 12, z: 1.2 },
        { x: x0, y: PITCH.HW + 12, z: 1.2 },
        { x: x1, y: PITCH.HW + 12, z: height * 0.92 },
        { x: x1, y: -PITCH.HW - 12, z: height * 0.92 },
      ];
      const mid = this.toCam((x0 + x1) / 2, 0, height / 2);
      out.push({ pts, depth: mid.cz, side: s * 10 });
    }
    return out;
  }

  /** Tribünler — yalnızca kameradan UZAKTA olanlar çizilir (saha asla kapanmaz). */
  private drawStands(o: RenderOpts): void {
    const ctx = this.ctx!;
    const quads = this.standQuads(o).sort((a, b) => b.depth - a.depth);
    const pitchDepth = this.toCam(0, 0, 0).cz;
    // Kamera hangi kenardaysa o kenarın uzun tribünü çizilmez: gerçek yayın kamerası
    // tribünün ÜSTÜNDEDİR, tribün sahayı kapatmaz.
    const camSide = this.pos.y >= 0 ? 1 : -1;
    for (const q of quads) {
      if (Math.abs(q.side) === 1 && q.side === camSide) continue;
      if (q.depth <= pitchDepth) continue;
      const lv = o.levels.stands;
      const rows = 3 + lv;
      // taban bandı
      this.projPoly(q.pts.map((p) => ({ ...p, z: p.z })), "#0b1622", "#1b2c40", 1);
      // katmanlar
      for (let r = 0; r < rows; r++) {
        const t0 = r / rows;
        const t1 = (r + 0.92) / rows;
        const col = r % 2 === 0 ? "#16283a" : "#1b3450";
        this.projPoly(this.lerpQuad(q.pts, t0, t1), col, "#0d1a28", 0.6);
      }
      // ÇATI: tribünün üstünden sahaya doğru uzanan konsol
      {
        const top = this.lerpQuad(q.pts, 0.98, 1.0);
        const roofH = 3.4 + o.levels.stands * 0.6;
        const inner = this.lerpQuad(q.pts, 0.02, 0.04);
        const roof: V3[] = [
          { x: top[0].x, y: top[0].y, z: top[0].z + roofH },
          { x: top[1].x, y: top[1].y, z: top[1].z + roofH },
          { x: inner[1].x, y: inner[1].y, z: top[1].z + roofH * 0.86 },
          { x: inner[0].x, y: inner[0].y, z: top[0].z + roofH * 0.86 },
        ];
        this.projPoly(roof, "#0a1420", "#22364e", 1);
        // çatı altı ışık şeridi
        const l0 = this.project(inner[0].x, inner[0].y, top[0].z + roofH * 0.84);
        const l1 = this.project(inner[1].x, inner[1].y, top[1].z + roofH * 0.84);
        if (l0.ok && l1.ok) {
          ctx.strokeStyle = "rgba(190,225,255,0.30)";
          ctx.lineWidth = Math.max(1, l0.sc * 0.10);
          ctx.beginPath(); ctx.moveTo(l0.sx, l0.sy); ctx.lineTo(l1.sx, l1.sy); ctx.stroke();
        }
      }

      // seyirci pikselleri — kalite seviyesine göre yoğunluk
      const dens = o.quality === 0 ? 150 : o.quality === 1 ? 380 : 640;
      const n = Math.min(dens, 220 + lv * 95);
      const cells = Math.floor(n / rows);
      for (let r = 0; r < rows; r++) {
        for (let i = 0; i < cells; i++) {
          const sd = this.crowdSeeds[(r * 977 + i * 31 + Math.abs(q.side) * 13) % this.crowdSeeds.length];
          const sd2 = this.crowdSeeds[(r * 331 + i * 71 + Math.abs(q.side) * 7) % this.crowdSeeds.length];
          const along = (i + sd * 0.8) / cells;
          const t0 = (r + 0.1) / rows;
          const t1 = (r + 0.95) / rows;
          const quad = this.lerpQuad(q.pts, t0, t1);
          const e0 = this.mix3(quad[0], quad[1], along);
          const e1 = this.mix3(quad[3], quad[2], along);
          const p = this.mix3(e0, e1, sd2 * 0.85 + 0.08);
          const pr = this.project(p.x, p.y, p.z + 0.35);
          if (!pr.ok) continue;
          const cols = ["#e8e8f0", "#ffd166", "#ef476f", "#06d6a0", "#118ab2", "#f78c6b", "#c0c8d8"];
          ctx.fillStyle = cols[Math.floor(sd * cols.length) % cols.length];
          const sz = Math.max(1, pr.sc * 0.42);
          ctx.globalAlpha = 0.75;
          ctx.fillRect(pr.sx - sz / 2, pr.sy - sz / 2, sz, sz);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  /** Tribün dörtgeninde t0..t1 aralığındaki "sıra bandı"nı üretir.
   *  q[0],q[1] alt kenar (saha kenarı), q[3],q[2] üst kenar (dış/dik taraf). */
  private lerpQuad(q: V3[], t0: number, t1: number): V3[] {
    const left = (t: number): V3 => this.mix3(q[0], q[3], t);
    const right = (t: number): V3 => this.mix3(q[1], q[2], t);
    const a0 = left(t0), a1 = right(t0), b0 = left(t1), b1 = right(t1);
    return [a0, a1, b1, b0];
  }

  private mix3(a: V3, b: V3, t: number): V3 {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
  }

  /** Projektörlerin sahada bıraktığı ışık havuzları — zemine hacim katar. */
  private drawFloodPools(o: RenderOpts): void {
    const ctx = this.ctx!;
    const lv = clamp(o.levels.lights, 0, 8);
    const strength = 0.05 + lv * 0.018;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const p = this.project(sx * 26, sy * 15, 0.02);
        if (!p.ok) continue;
        const r = p.sc * 30;
        const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r);
        g.addColorStop(0, `rgba(255,250,225,${strength})`);
        g.addColorStop(1, "rgba(255,250,225,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(p.sx, p.sy, r, r * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    // sahanın kenarlarına doğru hafif karartma (ışık düşüşü)
    ctx.save();
    ctx.globalAlpha = 0.16;
    for (const sx of [-1, 1]) {
      this.projPoly([
        { x: sx * PITCH.HL, y: -PITCH.HW, z: 0.02 }, { x: sx * (PITCH.HL - 16), y: -PITCH.HW, z: 0.02 },
        { x: sx * (PITCH.HL - 16), y: PITCH.HW, z: 0.02 }, { x: sx * PITCH.HL, y: PITCH.HW, z: 0.02 },
      ], "#00120a", undefined);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ------------------------------ REKLAM PANOLARI ------------------------------ */

  private ADS = [
    ["TWIN SOCCER", "#0b1a2a", "#37f28b"],
    ["BYMEL SOFTWARE", "#12061f", "#c084fc"],
    ["FAIR PLAY", "#1a1206", "#ffcb45"],
    ["90+ FUTBOL", "#04121c", "#59d8ff"],
    ["SAHA · KEYİF · GOL", "#0a1408", "#a3e635"],
    ["EFSANE LİG", "#1c0810", "#fb7185"],
  ] as const;

  private boardTexture(i: number): HTMLCanvasElement {
    if (this.boardCanvases[i]) return this.boardCanvases[i];
    const [txt, bg, fg] = this.ADS[i % this.ADS.length];
    const c = document.createElement("canvas");
    c.width = 256; c.height = 40;
    const x = c.getContext("2d")!;
    const g = x.createLinearGradient(0, 0, 0, 40);
    g.addColorStop(0, bg);
    g.addColorStop(0.5, "#000000");
    g.addColorStop(1, bg);
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 40);
    x.fillStyle = fg;
    x.globalAlpha = 0.18;
    x.fillRect(0, 34, 256, 6);
    x.globalAlpha = 1;
    x.font = "900 22px system-ui, sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillStyle = fg;
    x.fillText(txt, 128, 20);
    this.boardCanvases[i] = c;
    return c;
  }

  /** Saha çevresindeki 3B LED reklam panoları — yayın hissini veren en büyük detay. */
  private drawBoards(o: RenderOpts): void {
    if (o.faik) return;                        // halısahada pano yok
    const camSide = this.pos.y >= 0 ? 1 : -1;
    const H = 1.05;
    const segs: { a: V3; b: V3 }[] = [];
    // yalnızca KARŞI uzun kenar (yakın kenar kamerayı kapatır)
    const yFar = -camSide * (PITCH.HW + 3.0);
    const n = 13;
    for (let i = 0; i < n; i++) {
      const x0 = -PITCH.HL - 4 + ((PITCH.L + 8) * i) / n;
      const x1 = -PITCH.HL - 4 + ((PITCH.L + 8) * (i + 1)) / n - 0.35;
      segs.push({ a: { x: x0, y: yFar, z: 0 }, b: { x: x1, y: yFar, z: 0 } });
    }
    // kısa kenarlar
    for (const sx of [-1, 1]) {
      const xs = sx * (PITCH.HL + 3.0);
      const m = 7;
      for (let i = 0; i < m; i++) {
        const y0 = -PITCH.HW - 2 + ((PITCH.W + 4) * i) / m;
        const y1 = -PITCH.HW - 2 + ((PITCH.W + 4) * (i + 1)) / m - 0.35;
        segs.push({ a: { x: xs, y: y0, z: 0 }, b: { x: xs, y: y1, z: 0 } });
      }
    }
    segs.forEach((sg, i) => {
      const tex = this.boardTexture(i + Math.floor(o.time * 0.35));
      // Yazının ters (aynalanmış) görünmemesi için ekran sarım yönü kontrol edilir.
      const pa = this.project(sg.a.x, sg.a.y, H);
      const pb = this.project(sg.b.x, sg.b.y, H);
      const pc = this.project(sg.b.x, sg.b.y, 0);
      if (!pa.ok || !pb.ok || !pc.ok) return;
      const cross = (pb.sx - pa.sx) * (pc.sy - pa.sy) - (pb.sy - pa.sy) * (pc.sx - pa.sx);
      const A = cross > 0 ? sg.a : sg.b;
      const B = cross > 0 ? sg.b : sg.a;
      this.texQuad(
        tex,
        { x: A.x, y: A.y, z: H }, { x: B.x, y: B.y, z: H },
        { x: B.x, y: B.y, z: 0 }, { x: A.x, y: A.y, z: 0 }, 0,
      );
    });
  }

  /** Köşe bayrakları — rüzgârda hafifçe dalgalanır. */
  private drawCornerFlags(o: RenderOpts): void {
    const ctx = this.ctx!;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const x = sx * PITCH.HL, y = sy * PITCH.HW;
        const b = this.project(x, y, 0);
        const t = this.project(x, y, 1.5);
        if (!b.ok || !t.ok) continue;
        ctx.strokeStyle = "#e9f3ff";
        ctx.lineWidth = Math.max(1, b.sc * 0.05);
        ctx.beginPath(); ctx.moveTo(b.sx, b.sy); ctx.lineTo(t.sx, t.sy); ctx.stroke();
        const wave = Math.sin(o.time * 3 + sx + sy) * 0.10;
        const root = this.project(x, y, 1.18);
        const tip = this.project(x - sx * (0.55 + wave), y - sy * 0.12, 1.34);
        if (root.ok && tip.ok) {
          ctx.fillStyle = "#ffcb45";
          ctx.beginPath();
          ctx.moveTo(t.sx, t.sy);
          ctx.lineTo(tip.sx, tip.sy);
          ctx.lineTo(root.sx, root.sy);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  /* ------------------------------ IŞIK / EKRAN ------------------------------ */

  private drawLightsAndScreen(o: RenderOpts): void {
    const ctx = this.ctx!;
    const lv = o.levels.lights;
    const height = 16 + lv * 4.2;
    const lamps = 2 + Math.floor(lv / 2);
    const corners: V3[] = [
      { x: -PITCH.HL - 22, y: -PITCH.HW - 22, z: 0 },
      { x: PITCH.HL + 22, y: -PITCH.HW - 22, z: 0 },
      { x: PITCH.HL + 22, y: PITCH.HW + 22, z: 0 },
      { x: -PITCH.HL - 22, y: PITCH.HW + 22, z: 0 },
    ];
    for (const c of corners) {
      const base = this.project(c.x, c.y, 0);
      const top = this.project(c.x, c.y, height);
      if (!base.ok || !top.ok) continue;
      ctx.strokeStyle = "#2c3e50";
      ctx.lineWidth = Math.max(1.5, base.sc * 0.35);
      ctx.beginPath();
      ctx.moveTo(base.sx, base.sy);
      ctx.lineTo(top.sx, top.sy);
      ctx.stroke();
      // lamba paneli
      const pw = Math.max(6, base.sc * 2.4);
      const ph = Math.max(3, base.sc * 1.1);
      ctx.fillStyle = "#1b2735";
      ctx.fillRect(top.sx - pw / 2, top.sy - ph / 2, pw, ph);
      // gökyüzüne vuran hüzme
      {
        const glow = ctx.createRadialGradient(top.sx, top.sy, 0, top.sx, top.sy, Math.max(30, base.sc * 9));
        glow.addColorStop(0, "rgba(255,248,214,0.30)");
        glow.addColorStop(0.45, "rgba(210,230,255,0.10)");
        glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(top.sx, top.sy, Math.max(30, base.sc * 9), 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < lamps; i++) {
        const bx = top.sx - pw / 2 + (pw / lamps) * (i + 0.5);
        const g = ctx.createRadialGradient(bx, top.sy, 0, bx, top.sy, Math.max(4, pw * 0.5));
        g.addColorStop(0, "rgba(255,250,220,0.95)");
        g.addColorStop(0.35, "rgba(255,240,190,0.55)");
        g.addColorStop(1, "rgba(255,240,190,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, top.sy, Math.max(4, pw * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // dev ekran
    if (o.levels.screen >= 2) {
      const sw = 26, sh = 9;
      const cx = -PITCH.HL - 20, cy = 0;
      const p0 = this.project(cx, cy - sw / 2, 13);
      const p1 = this.project(cx, cy + sw / 2, 13 + sh);
      if (p0.ok && p1.ok) {
        const w = Math.abs(p1.sx - p0.sx);
        const h = Math.abs(p1.sy - p0.sy);
        const x = Math.min(p0.sx, p1.sx);
        const y = Math.min(p0.sy, p1.sy);
        ctx.fillStyle = "#05080e";
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = "#2b4a6b";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        const fs = Math.max(8, Math.min(w * 0.22, h * 0.5));
        ctx.fillStyle = "#7dffbe";
        ctx.font = `900 ${fs}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${o.eng.score[0]} - ${o.eng.score[1]}`, x + w / 2, y + h / 2);
        ctx.font = `700 ${fs * 0.45}px system-ui, sans-serif`;
        ctx.fillStyle = "#9fd9ff";
        ctx.fillText(`${Math.max(0, Math.ceil(o.eng.clock))}'`, x + w / 2, y + h * 0.8);
      }
    }
  }

  /* ------------------------------ SAHA ------------------------------ */

  private faikTexture(img: HTMLImageElement | null): HTMLCanvasElement | null {
    if (!img || !img.complete || !img.naturalWidth) return null;
    // Görsel sonradan yüklenirse önbellek yenilenir (eskiden prosedürel dokuya
    // kilitlenip kullanıcının fotoğrafı hiç görünmüyordu).
    if (this.faikCache && this.faikCache.src === img) return this.faikCache.canvas;
    const c = document.createElement("canvas");
    c.width = 256; c.height = 256;
    const cx = c.getContext("2d");
    if (!cx) return null;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    cx.imageSmoothingQuality = "high";
    cx.drawImage(img, sx, sy, side, side, 0, 0, 256, 256);
    // hafif yeşil zemin tonu — çizgiler okunsun ama fotoğraf net kalsın
    cx.fillStyle = "rgba(0,26,12,0.14)";
    cx.fillRect(0, 0, 256, 256);
    this.faikCache = { src: img, canvas: c };
    return c;
  }

  private proceduralFaik(): HTMLCanvasElement {
    if (this.procCanvas) return this.procCanvas;
    const c = document.createElement("canvas");
    c.width = 128; c.height = 128;
    const cx = c.getContext("2d")!;
    const g = cx.createLinearGradient(0, 0, 128, 128);
    g.addColorStop(0, "#1f6b3a");
    g.addColorStop(0.5, "#1a5c32");
    g.addColorStop(1, "#256f3f");
    cx.fillStyle = g;
    cx.fillRect(0, 0, 128, 128);
    // halısaha dokusu: ince filament çizgileri
    cx.strokeStyle = "rgba(255,255,255,0.045)";
    cx.lineWidth = 1;
    for (let i = 0; i < 128; i += 3) {
      cx.beginPath(); cx.moveTo(i, 0); cx.lineTo(i, 128); cx.stroke();
    }
    for (let i = 0; i < 128; i += 4) {
      cx.beginPath(); cx.moveTo(0, i); cx.lineTo(128, i); cx.stroke();
    }
    // aşınma lekeleri
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * 128, y = Math.random() * 128, r = 4 + Math.random() * 14;
      const rg = cx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, "rgba(120,110,60,0.16)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      cx.fillStyle = rg;
      cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
    }
    cx.fillStyle = "rgba(0,20,10,0.20)";
    cx.fillRect(0, 0, 128, 128);
    this.procCanvas = c;
    return c;
  }

  private drawPitch(o: RenderOpts): void {
    const ctx = this.ctx!;
    const m = 4.5;
    const corners: V3[] = [
      { x: -PITCH.HL - m, y: -PITCH.HW - m, z: 0 },
      { x: PITCH.HL + m, y: -PITCH.HW - m, z: 0 },
      { x: PITCH.HL + m, y: PITCH.HW + m, z: 0 },
      { x: -PITCH.HL - m, y: PITCH.HW + m, z: 0 },
    ];
    // dış zemin (koşu şeridi)
    this.projPoly(corners, o.faik ? "#0e2b1e" : "#0c2e1a", undefined);

    if (o.faik) {
      const tex = this.faikTexture(o.faikImg) ?? this.proceduralFaik();
      const NX = 10, NY = 7;
      const w = PITCH.L / NX, h = PITCH.W / NY;
      for (let i = 0; i < NX; i++) {
        for (let j = 0; j < NY; j++) {
          const x0 = -PITCH.HL + i * w, y0 = -PITCH.HW + j * h;
          this.texQuad(tex, { x: x0, y: y0, z: 0.01 }, { x: x0 + w, y: y0, z: 0.01 },
            { x: x0 + w, y: y0 + h, z: 0.01 }, { x: x0, y: y0 + h, z: 0.01 }, (i + j) % 2 === 0 ? 0.05 : 0);
        }
      }
    } else {
      const strips = 18;
      const w = PITCH.L / strips;
      for (let i = 0; i < strips; i++) {
        const x0 = -PITCH.HL + i * w;
        const c = i % 2 === 0 ? "#1d6a37" : "#175a2d";
        this.projPoly([
          { x: x0, y: -PITCH.HW, z: 0.01 },
          { x: x0 + w, y: -PITCH.HW, z: 0.01 },
          { x: x0 + w, y: PITCH.HW, z: 0.01 },
          { x: x0, y: PITCH.HW, z: 0.01 },
        ], c, undefined);
      }
      // enine biçme izleri (çapraz desen) — sahaya derinlik katar
      ctx.globalAlpha = 0.055;
      const rows = 9;
      const rh = PITCH.W / rows;
      for (let j = 0; j < rows; j++) {
        if (j % 2) continue;
        const y0 = -PITCH.HW + j * rh;
        this.projPoly([
          { x: -PITCH.HL, y: y0, z: 0.011 }, { x: PITCH.HL, y: y0, z: 0.011 },
          { x: PITCH.HL, y: y0 + rh, z: 0.011 }, { x: -PITCH.HL, y: y0 + rh, z: 0.011 },
        ], "#ffffff", undefined);
      }
      ctx.globalAlpha = 1;

      // çim filamentleri
      if (o.quality >= 1) {
        ctx.globalAlpha = 0.06;
        const n = o.quality === 2 ? 2400 : 900;
        for (let i = 0; i < n; i++) {
          const sd = this.crowdSeeds[i % this.crowdSeeds.length];
          const sd2 = this.crowdSeeds[(i * 7 + 13) % this.crowdSeeds.length];
          const p = this.project(-PITCH.HL + sd * PITCH.L, -PITCH.HW + sd2 * PITCH.W, 0.02);
          if (!p.ok) continue;
          ctx.fillStyle = i % 3 === 0 ? "#0a2f18" : i % 3 === 1 ? "#39a865" : "#0f4423";
          ctx.fillRect(p.sx, p.sy, Math.max(1, p.sc * 0.20), Math.max(1, p.sc * 0.09));
        }
        ctx.globalAlpha = 1;
      }

      // kale önü aşınma bölgeleri
      ctx.globalAlpha = 0.10;
      for (const sx of [-1, 1]) {
        this.projPoly([
          { x: sx * (PITCH.HL - 6), y: -9, z: 0.012 }, { x: sx * (PITCH.HL - 0.2), y: -9, z: 0.012 },
          { x: sx * (PITCH.HL - 0.2), y: 9, z: 0.012 }, { x: sx * (PITCH.HL - 6), y: 9, z: 0.012 },
        ], "#6b5a3a", undefined);
      }
      ctx.globalAlpha = 1;
    }

    // tel kafes / bariyer (Sakat Faik modu)
    if (o.faik) this.drawFence(o);
  }

  /** Perspektif-doğru doku döşeme: dörtgeni iki üçgene bölüp afin dönüşümle basar. */
  private texQuad(img: HTMLCanvasElement, p0: V3, p1: V3, p2: V3, p3: V3, dark: number): void {
    const ctx = this.ctx!;
    const q = [p0, p1, p2, p3].map((p) => this.project(p.x, p.y, p.z));
    if (q.some((v) => !v.ok)) return;
    const iw = img.width, ih = img.height;
    // iki üçgen
    const tris: [number, number, number][] = [[0, 1, 2], [0, 2, 3]];
    for (const t of tris) {
      const [a, b, c] = t;
      const dst = [q[a], q[b], q[c]];
      const src = [
        { u: a === 0 || a === 3 ? 0 : iw, v: a < 2 ? 0 : ih },
        { u: b === 0 || b === 3 ? 0 : iw, v: b < 2 ? 0 : ih },
        { u: c === 0 || c === 3 ? 0 : iw, v: c < 2 ? 0 : ih },
      ];
      const m = this.affine(src, dst);
      if (!m) continue;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(dst[0].sx, dst[0].sy);
      ctx.lineTo(dst[1].sx, dst[1].sy);
      ctx.lineTo(dst[2].sx, dst[2].sy);
      ctx.closePath();
      ctx.clip();
      ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }
    if (dark > 0) {
      ctx.save();
      ctx.globalAlpha = dark;
      ctx.beginPath();
      ctx.moveTo(q[0].sx, q[0].sy);
      for (let i = 1; i < 4; i++) ctx.lineTo(q[i].sx, q[i].sy);
      ctx.closePath();
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.restore();
    }
  }

  /** 3 kaynak → 3 hedef nokta için afin matris (a,b,c,d,e,f). */
  private affine(src: { u: number; v: number }[], dst: Proj[]): number[] | null {
    const [s0, s1, s2] = src;
    const [d0, d1, d2] = dst;
    const det = s0.u * (s1.v - s2.v) - s0.v * (s1.u - s2.u) + (s1.u * s2.v - s2.u * s1.v);
    if (Math.abs(det) < 1e-9) return null;
    // x = A*u + C*v + E  →  A, C, E katsayıları Cramer kuralıyla
    const solve = (dx: number, dy: number, dz: number): number[] => {
      const A = (dx * (s1.v - s2.v) - s0.v * (dy - dz) + (dy * s2.v - dz * s1.v)) / det;
      const C = (s0.u * (dy - dz) - dx * (s1.u - s2.u) + (s1.u * dz - s2.u * dy)) / det;
      const E = (dx * (s1.u * s2.v - s2.u * s1.v) - s0.u * (dy * s2.v - dz * s1.v) + s0.v * (dy * s2.u - dz * s1.u)) / det;
      return [A, C, E];
    };
    const X = solve(d0.sx, d1.sx, d2.sx);
    const Y = solve(d0.sy, d1.sy, d2.sy);
    // x = a*u + c*v + e ; y = b*u + d*v + f
    return [X[0], Y[0], X[1], Y[1], X[2], Y[2]];
  }

  private drawFence(o: RenderOpts): void {
    const ctx = this.ctx!;
    const d = 3.2;
    const H = 4.2;
    const segs: [V3, V3][] = [
      [{ x: -PITCH.HL - 2, y: -PITCH.HW - d, z: 0 }, { x: PITCH.HL + 2, y: -PITCH.HW - d, z: 0 }],
      [{ x: -PITCH.HL - 2, y: PITCH.HW + d, z: 0 }, { x: PITCH.HL + 2, y: PITCH.HW + d, z: 0 }],
      [{ x: -PITCH.HL - d, y: -PITCH.HW - 2, z: 0 }, { x: -PITCH.HL - d, y: PITCH.HW + 2, z: 0 }],
      [{ x: PITCH.HL + d, y: -PITCH.HW - 2, z: 0 }, { x: PITCH.HL + d, y: PITCH.HW + 2, z: 0 }],
    ];
    ctx.strokeStyle = "rgba(190,210,225,0.35)";
    ctx.lineWidth = 1;
    for (const [a, b] of segs) {
      const p0 = this.project(a.x, a.y, 0);
      const p1 = this.project(b.x, b.y, 0);
      const q0 = this.project(a.x, a.y, H);
      const q1 = this.project(b.x, b.y, H);
      if (!p0.ok || !p1.ok || !q0.ok || !q1.ok) continue;
      // file örgüsü
      const steps = 22;
      ctx.strokeStyle = "rgba(200,220,235,0.30)";
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const bx = p0.sx + (p1.sx - p0.sx) * t;
        const by = p0.sy + (p1.sy - p0.sy) * t;
        const tx = q0.sx + (q1.sx - q0.sx) * t;
        const ty = q0.sy + (q1.sy - q0.sy) * t;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      }
      for (let j = 0; j <= 8; j++) {
        const t = j / 8;
        ctx.beginPath();
        ctx.moveTo(p0.sx + (q0.sx - p0.sx) * t, p0.sy + (q0.sy - p0.sy) * t);
        ctx.lineTo(p1.sx + (q1.sx - p1.sx) * t, p1.sy + (q1.sy - p1.sy) * t);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(230,245,255,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(q0.sx, q0.sy); ctx.lineTo(q1.sx, q1.sy); ctx.stroke();
      ctx.lineWidth = 1;
    }
    void o;
  }

  /* ------------------------------ ÇİZGİLER ------------------------------ */

  private groundQuad(x0: number, y0: number, x1: number, y1: number, color: string): void {
    this.projPoly([
      { x: x0, y: y0, z: 0.03 }, { x: x1, y: y0, z: 0.03 },
      { x: x1, y: y1, z: 0.03 }, { x: x0, y: y1, z: 0.03 },
    ], color, undefined);
  }

  private groundLine(x0: number, y0: number, x1: number, y1: number, t: number, color: string): void {
    const dx = x1 - x0, dy = y1 - y0;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * (t / 2), ny = (dx / l) * (t / 2);
    this.projPoly([
      { x: x0 + nx, y: y0 + ny, z: 0.03 }, { x: x1 + nx, y: y1 + ny, z: 0.03 },
      { x: x1 - nx, y: y1 - ny, z: 0.03 }, { x: x0 - nx, y: y0 - ny, z: 0.03 },
    ], color, undefined);
  }

  private groundArc(cx: number, cy: number, r: number, a0: number, a1: number, t: number, color: string): void {
    const steps = 22;
    for (let i = 0; i < steps; i++) {
      const b0 = a0 + ((a1 - a0) * i) / steps;
      const b1 = a0 + ((a1 - a0) * (i + 1)) / steps;
      this.groundLine(cx + Math.cos(b0) * r, cy + Math.sin(b0) * r, cx + Math.cos(b1) * r, cy + Math.sin(b1) * r, t, color);
    }
  }

  private drawLines(o: RenderOpts): void {
    const col = o.faik ? "rgba(240,255,245,0.82)" : "rgba(245,255,250,0.92)";
    const T = 0.14;
    const HL = PITCH.HL, HW = PITCH.HW;
    // dış çerçeve
    this.groundLine(-HL, -HW, HL, -HW, T, col);
    this.groundLine(-HL, HW, HL, HW, T, col);
    this.groundLine(-HL, -HW, -HL, HW, T, col);
    this.groundLine(HL, -HW, HL, HW, T, col);
    // orta çizgi + yuvarlak
    this.groundLine(0, -HW, 0, HW, T, col);
    this.groundArc(0, 0, PITCH.CIRCLE, 0, Math.PI * 2, T, col);
    // orta nokta
    this.groundQuad(-0.35, -0.35, 0.35, 0.35, col);
    for (const s of [-1, 1]) {
      const gx = s * HL;
      // ceza sahası
      this.groundLine(gx, -PITCH.PEN_W / 2, gx - s * PITCH.PEN_D, -PITCH.PEN_W / 2, T, col);
      this.groundLine(gx, PITCH.PEN_W / 2, gx - s * PITCH.PEN_D, PITCH.PEN_W / 2, T, col);
      this.groundLine(gx - s * PITCH.PEN_D, -PITCH.PEN_W / 2, gx - s * PITCH.PEN_D, PITCH.PEN_W / 2, T, col);
      // kale sahası
      this.groundLine(gx, -PITCH.SIX_W / 2, gx - s * PITCH.SIX_D, -PITCH.SIX_W / 2, T, col);
      this.groundLine(gx, PITCH.SIX_W / 2, gx - s * PITCH.SIX_D, PITCH.SIX_W / 2, T, col);
      this.groundLine(gx - s * PITCH.SIX_D, -PITCH.SIX_W / 2, gx - s * PITCH.SIX_D, PITCH.SIX_W / 2, T, col);
      // penaltı noktası + yay
      this.groundQuad(gx - s * 11 - 0.3, -0.3, gx - s * 11 + 0.3, 0.3, col);
      const a = Math.acos((PITCH.PEN_D - 11) / PITCH.CIRCLE);
      this.groundArc(gx - s * 11, 0, PITCH.CIRCLE, s > 0 ? Math.PI - a : -a, s > 0 ? Math.PI + a : a, T, col);
      // köşe yayları
      for (const ty of [-1, 1]) {
        this.groundArc(gx, ty * HW, 1, 0, Math.PI * 2, T * 0.8, col);
      }
    }
  }

  /* ------------------------------ VARLIKLAR ------------------------------ */

  private drawGoals(o: RenderOpts): void {
    const ctx = this.ctx!;
    for (const s of [-1, 1]) {
      const gx = s * PITCH.HL;
      const hw = PITCH.GOAL_W / 2;
      const depth = 1.9;
      const post = (y: number, z: number, back = false): Proj =>
        this.project(gx + (back ? -s * depth : 0), y, z);
      const corners = [
        post(-hw, 0), post(hw, 0), post(hw, PITCH.GOAL_H), post(-hw, PITCH.GOAL_H),
      ];
      if (corners.some((c) => !c.ok)) continue;
      // file (arka)
      const back = [post(-hw, 0, true), post(hw, 0, true), post(hw, PITCH.GOAL_H * 0.98, true), post(-hw, PITCH.GOAL_H * 0.98, true)];
      if (back.every((b) => b.ok)) {
        ctx.save();
        ctx.strokeStyle = "rgba(235,245,255,0.20)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          ctx.beginPath();
          ctx.moveTo(corners[0].sx + (corners[3].sx - corners[0].sx) * t, corners[0].sy + (corners[3].sy - corners[0].sy) * t);
          ctx.lineTo(back[0].sx + (back[3].sx - back[0].sx) * t, back[0].sy + (back[3].sy - back[0].sy) * t);
          ctx.stroke();
        }
        for (let i = 0; i <= 7; i++) {
          const t = i / 7;
          ctx.beginPath();
          ctx.moveTo(corners[0].sx + (corners[1].sx - corners[0].sx) * t, corners[0].sy + (corners[1].sy - corners[0].sy) * t);
          ctx.lineTo(back[0].sx + (back[1].sx - back[0].sx) * t, back[0].sy + (back[1].sy - back[0].sy) * t);
          ctx.stroke();
        }
        ctx.restore();
        this.projPoly([
          { x: gx - s * depth, y: -hw, z: 0 },
          { x: gx - s * depth, y: hw, z: 0 },
          { x: gx - s * depth, y: hw, z: PITCH.GOAL_H * 0.98 },
          { x: gx - s * depth, y: -hw, z: PITCH.GOAL_H * 0.98 },
        ], "rgba(255,255,255,0.05)");
      }
      // direkler
      ctx.strokeStyle = "#f4f8ff";
      ctx.lineWidth = Math.max(2, corners[0].sc * 0.13);
      for (const y of [-hw, hw]) {
        const b = this.project(gx, y, 0);
        const t = this.project(gx, y, PITCH.GOAL_H);
        if (b.ok && t.ok) {
          ctx.beginPath(); ctx.moveTo(b.sx, b.sy); ctx.lineTo(t.sx, t.sy); ctx.stroke();
        }
      }
      // üst direk
      const l = this.project(gx, -hw, PITCH.GOAL_H);
      const r = this.project(gx, hw, PITCH.GOAL_H);
      if (l.ok && r.ok) {
        ctx.beginPath(); ctx.moveTo(l.sx, l.sy); ctx.lineTo(r.sx, r.sy); ctx.stroke();
      }
    }
    void o;
  }

  /** Yumuşak, ışık yönüne göre kaymış zemin gölgesi (yükseklikle büyüyüp soluklaşır). */
  private drawShadow(x: number, y: number, r: number, alpha: number, h = 0): void {
    const spread = 1 + clamp(h, 0, 6) * 0.22;
    const p = this.project(x + 0.22 * h, y + 0.16 * h, 0.015);
    if (!p.ok) return;
    const ctx = this.ctx!;
    const rx = Math.max(1.5, r * spread * p.sc);
    const ry = rx * 0.40;
    ctx.save();
    const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, Math.max(rx, ry));
    g.addColorStop(0, `rgba(0,0,0,${alpha / spread})`);
    g.addColorStop(0.62, `rgba(0,0,0,${(alpha / spread) * 0.55})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy, rx * 1.25, ry * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawEntities(o: RenderOpts): void {
    const ctx = this.ctx!;
    const eng = o.eng;
    // gölgeler
    for (const mp of eng.mps) {
      if (!mp.onPitch) continue;
      this.drawShadow(mp.x, mp.y, 0.44, 0.40);
    }
    this.drawShadow(eng.ball.x, eng.ball.y, 0.22, 0.34, eng.ball.z);

    // seçili oyuncu halkası
    const sel = eng.controlled;
    if (sel) {
      const p = this.project(sel.x, sel.y, 0.02);
      if (p.ok) {
        const pulse = 0.5 + Math.sin(o.time * 6) * 0.5;
        ctx.save();
        ctx.strokeStyle = `rgba(255,214,64,${0.55 + pulse * 0.4})`;
        ctx.lineWidth = Math.max(2, p.sc * 0.09);
        ctx.beginPath();
        ctx.ellipse(p.sx, p.sy, p.sc * (0.72 + pulse * 0.09), p.sc * 0.30, 0, 0, Math.PI * 2);
        ctx.stroke();
        // üstte ok
        const top = this.project(sel.x, sel.y, 2.5);
        if (top.ok) {
          ctx.fillStyle = "#ffd640";
          const s = Math.max(5, top.sc * 0.30);
          ctx.beginPath();
          ctx.moveTo(top.sx, top.sy + s);
          ctx.lineTo(top.sx - s * 0.62, top.sy - s * 0.3);
          ctx.lineTo(top.sx + s * 0.62, top.sy - s * 0.3);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // duran top nişanı
    if (eng.restart) {
      const p = this.project(eng.restart.x, eng.restart.y, 0.02);
      if (p.ok) {
        ctx.save();
        ctx.strokeStyle = "rgba(120,220,255,0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(p.sx, p.sy, p.sc * 0.9, p.sc * 0.36, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // derinlik sıralı: kaleler + oyuncular + top
    type Item = { d: number; f: () => void };
    const items: Item[] = [];
    items.push({ d: this.toCam(PITCH.HL, 0, 1).cz, f: () => this.drawGoals(o) });
    for (const mp of eng.mps) {
      if (!mp.onPitch) continue;
      const d = this.toCam(mp.x, mp.y, 1).cz;
      items.push({ d, f: () => this.drawPlayer(ctx, mp, o) });
    }
    const b = eng.ball;
    const bd = this.toCam(b.x, b.y, b.z).cz;
    items.push({ d: bd, f: () => this.drawBall(b.x, b.y, b.z, o) });

    items.sort((p, q) => q.d - p.d);
    for (const it of items) it.f();

    // konfeti
    for (const c of eng.confetti) {
      const p = this.project(c.x, c.y, c.z);
      if (!p.ok) continue;
      ctx.save();
      ctx.globalAlpha = clamp(c.a, 0, 1);
      ctx.fillStyle = c.c;
      ctx.translate(p.sx, p.sy);
      ctx.rotate(c.r);
      const s = Math.max(1.5, p.sc * 0.14);
      ctx.fillRect(-s / 2, -s / 4, s, s / 2);
      ctx.restore();
    }
  }

  /** İkosahedron köşeleri = gerçek futbol topundaki 12 siyah beşgenin merkezi. */
  private static readonly ICO: number[][] = (() => {
    const f = (1 + Math.sqrt(5)) / 2;
    const raw = [
      [0, 1, f], [0, 1, -f], [0, -1, f], [0, -1, -f],
      [1, f, 0], [1, -f, 0], [-1, f, 0], [-1, -f, 0],
      [f, 0, 1], [f, 0, -1], [-f, 0, 1], [-f, 0, -1],
    ];
    return raw.map((v) => {
      const l = Math.hypot(v[0], v[1], v[2]);
      return [v[0] / l, v[1] / l, v[2] / l];
    });
  })();
  private static readonly SPIN: number[] = (() => {
    const a = [0.36, 0.52, 0.78];
    const l = Math.hypot(a[0], a[1], a[2]);
    return [a[0] / l, a[1] / l, a[2] / l];
  })();

  private drawBall(x: number, y: number, z: number, o: RenderOpts): void {
    const ctx = this.ctx!;
    const p = this.project(x, y, z + 0.112);
    if (!p.ok) return;
    // hız izi
    if (o.quality >= 1) {
      const tr = o.eng.ball.trail;
      ctx.save();
      for (let i = 0; i < tr.length; i += 2) {
        const t = tr[i];
        const tp = this.project(t.x, t.y, t.z + 0.1);
        if (!tp.ok) continue;
        ctx.globalAlpha = (i / tr.length) * 0.24;
        ctx.fillStyle = "#ffffff";
        const s = Math.max(1, tp.sc * 0.075);
        ctx.beginPath(); ctx.arc(tp.sx, tp.sy, s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    const r = Math.max(2.6, p.sc * 0.118);
    const bx = p.sx, by = p.sy;

    // küre gövdesi: yumuşak küresel gölgeleme
    const g = ctx.createRadialGradient(bx - r * 0.34, by - r * 0.44, r * 0.06, bx + r * 0.05, by + r * 0.08, r * 1.05);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.38, "#f7f9fc");
    g.addColorStop(0.72, "#dde4ec");
    g.addColorStop(0.92, "#b3bfcc");
    g.addColorStop(1, "#7d8b9b");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();

    // ---- beşgen yamalar (küre üzerine gerçek açısal yerleşim, Rodrigues dönüşümlü) ----
    const rot = o.eng.ball.rot;
    const ax = Renderer3D.SPIN[0], ay = Renderer3D.SPIN[1], az = Renderer3D.SPIN[2];
    const cA = Math.cos(rot), sA = Math.sin(rot);
    const dot = ax * 0 + ay * 0 + az * 0; // Rodrigues kısaltmaları
    void dot;
    const rotate = (v: number[]): number[] => {
      const cx = ay * v[2] - az * v[1];
      const cy = az * v[0] - ax * v[2];
      const cz = ax * v[1] - ay * v[0];
      const d = ax * v[0] + ay * v[1] + az * v[2];
      return [
        v[0] * cA + cx * sA + ax * d * (1 - cA),
        v[1] * cA + cy * sA + ay * d * (1 - cA),
        v[2] * cA + cz * sA + az * d * (1 - cA),
      ];
    };
    const A = 0.345; // beşgenin açısal yarıçapı (rad)
    for (const raw of Renderer3D.ICO) {
      const c = rotate(raw);
      if (c[2] < 0.12) continue;
      // teğet taban
      let ux: number, uy: number, uz: number;
      if (c[2] > 0.96) { ux = 1; uy = 0; uz = 0; }
      else {
        const lx = c[1] * 0 - c[2] * 0 + 0; // cross(c, z)
        void lx;
        const cx = -c[1], cy = c[0];           // cross(c,(0,0,1)) = (-cy, cx, 0)
        const cl = Math.hypot(cx, cy) || 1;
        ux = cx / cl; uy = cy / cl; uz = 0;
      }
      const wx = c[1] * uz - c[2] * uy;
      const wy = c[2] * ux - c[0] * uz;
      const ca = Math.cos(A), sa = Math.sin(A);
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const th = (k / 5) * Math.PI * 2 + 0.31;
        const ct = Math.cos(th), st = Math.sin(th);
        const px = c[0] * ca + (ux * ct + wx * st) * sa;
        const py = c[1] * ca + (uy * ct + wy * st) * sa;
        const sx = bx + px * r;
        const sy = by - py * r;
        if (k === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      // beşgenin kendi gölgelemesi (kameraya dönük olanlar daha açık)
      const shade = 0.32 + c[2] * 0.5;
      const rr = Math.round(26 + (1 - c[2]) * 26);
      const gg = Math.round(32 + (1 - c[2]) * 24);
      const bb = Math.round(44 + (1 - c[2]) * 30);
      ctx.fillStyle = `rgba(${rr},${gg},${bb},${Math.min(1, shade + 0.55)})`;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.lineWidth = Math.max(0.4, r * 0.035);
      ctx.stroke();
    }

    // kenar (rim) ışığı + temas gölgesi
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = Math.max(0.6, r * 0.07);
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.985, Math.PI * 1.02, Math.PI * 1.86);
    ctx.stroke();
    ctx.strokeStyle = "rgba(20,30,45,0.28)";
    ctx.lineWidth = Math.max(0.6, r * 0.08);
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.985, Math.PI * 0.08, Math.PI * 0.72);
    ctx.stroke();
    ctx.restore();

    // parlak nokta
    const hl = ctx.createRadialGradient(bx - r * 0.36, by - r * 0.46, 0, bx - r * 0.36, by - r * 0.46, r * 0.42);
    hl.addColorStop(0, "rgba(255,255,255,0.85)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl;
    ctx.beginPath();
    ctx.arc(bx - r * 0.36, by - r * 0.46, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ------------------------------ OYUNCU ------------------------------ */

  /* ================================================================
     3B HUMANOID OYUNCU
     ----------------------------------------------------------------
     Oyuncu artık "yandan bakan kağıt kukla" değil: iskelet YEREL gövde
     uzayında (f=ileri, s=yan, u=yukarı) kurulur, gövdenin yalpa/yunuslama/
     sapma açılarıyla döndürülür, dünyaya taşınır ve HER EKLEM ayrı ayrı
     3B perspektifle yansıtılır. Bu yüzden oyuncu döndükçe omuzları,
     kalçası ve bacakları gerçek hacimle döner.

     Doğal hareket (robot gibi görünmemesi) için:
       · gerçek yürüyüş döngüsü (salınım/basış fazları ayrı)
       · leğen kemiği: çift frekanslı dikey iniş-çıkış + yanal ağırlık aktarımı
       · kalça ve omuz KARŞIT yönde döner (karşıt salınım)
       · omurga, dönüşe ve ivmeye göre eğilir; baş topa bakar
       · kollar bacaklara zıt fazda, dirsek açısı faz boyunca değişir
       · durunca nefes alma/ağırlık kaydırma mikro hareketi
     ================================================================ */

  private drawPlayer(ctx: CanvasRenderingContext2D, mp: MP, o: RenderOpts): void {
    const base = this.project(mp.x, mp.y, 0);
    if (!base.ok) return;

    const look = lookOf(mp.p);
    const H = 1.80 * look.height;
    const build = [0.90, 1.0, 1.13][look.build];
    const club = mp.team === 0 ? o.home : o.away;
    const kit = mp.isGK ? club.gkKit : club.kit;
    const skin = SKINS[look.skin];
    const hairCol = HAIR_COLORS[look.hairColor];
    const boots = BOOTS[look.boots];

    const speed = Math.hypot(mp.vx, mp.vy);
    const amp = clamp(speed / 6.4, 0, 1);
    const ph = mp.anim;
    const sliding = mp.slide > 0;
    const diving = mp.dive > 0;
    const celebrating = mp.celeb > 0;

    /* ---------------- antropometri (metre) ---------------- */
    const hipH = 0.500 * H;
    const shH = 0.812 * H;
    const neckH = 0.858 * H;
    const headH = 0.920 * H;
    const headR = 0.0715 * H;
    const thighL = 0.245 * H;
    const shinL = 0.246 * H;
    const shW = 0.098 * H * build;      // yarım omuz
    const hipW = 0.062 * H * build;
    const upperArm = 0.152 * H;
    const foreArm = 0.150 * H;
    const thighR = 0.049 * H * build;
    const calfR = 0.036 * H * build;
    const armR = 0.031 * H * build;

    /* ---------------- yürüyüş döngüsü ---------------- */
    const stride = clamp(mp.stride, 0.35, 1.0) * (0.30 + amp * 0.55);
    const lift = 0.055 + amp * 0.13;
    /** Bir bacağın (faz kaymalı) ayak konumu: [ileri, yükseklik] */
    const footTrack = (theta: number): [number, number] => {
      const t = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (t < Math.PI) {
        const u = t / Math.PI;                       // SALINIM: öne taşınır
        const e = u * u * (3 - 2 * u);               // yumuşak geçiş (smoothstep)
        return [stride * (e - 0.5), lift * Math.sin(Math.PI * u) ** 0.85];
      }
      const u = (t - Math.PI) / Math.PI;             // BASIŞ: yere basılı geri kayar
      return [stride * (0.5 - u), 0];
    };

    // leğen kemiği: dikey çift salınım + yanal ağırlık aktarımı + sapma
    const bob = -0.026 * H * amp * Math.abs(Math.sin(ph)) + Math.sin(o.time * 1.9 + mp.idx) * 0.004 * H;
    const sway = 0.021 * H * amp * Math.sin(ph);
    const pelvisYaw = 0.20 * amp * Math.sin(ph);
    const shoulderYaw = -0.26 * amp * Math.sin(ph);   // KARŞIT salınım

    /* ---------------- gövde yönelimi ---------------- */
    let yaw = mp.facing;
    let pitch = 0.10 + amp * 0.16;                    // koşarken öne eğik
    let roll = -(mp.lean ?? 0) * 0.45;                // dönüşte içe yatış
    let rootZ = 0;
    if (sliding) { pitch = 1.15; rootZ = -0.16 * H; }
    else if (diving) { pitch = 0.15; roll = (mp.diveVz > 1.2 ? 1 : 1) * 1.25 * (mp.y >= 0 ? 1 : -1); rootZ = 0.10 * H; }
    else if (celebrating) { pitch = mp.celebKind === 1 ? -0.16 : -0.05; }
    if (mp.jump > 0) rootZ += Math.sin(clamp(mp.jump, 0, 1) * Math.PI) * 0.30;

    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const px = mp.x, py = mp.y;

    /** Yerel gövde uzayı (f ileri, s sağ, u yukarı) → dünya koordinatı. */
    const W = (f: number, sd: number, u: number): { x: number; y: number; z: number } => {
      const s1 = sd * cr - u * sr;
      const u1 = sd * sr + u * cr;
      const f2 = f * cp + u1 * sp;
      const u2 = -f * sp + u1 * cp;
      return { x: px + f2 * cy - s1 * sy, y: py + f2 * sy + s1 * cy, z: Math.max(0, u2 + rootZ) };
    };
    /** Ekrana yansıtılmış eklem. */
    const J = (f: number, sd: number, u: number): Proj => {
      const w = W(f, sd, u);
      return this.project(w.x, w.y, w.z);
    };
    const depthOf = (f: number, sd: number, u: number): number => {
      const w = W(f, sd, u);
      return this.toCam(w.x, w.y, w.z).cz;
    };

    /* ---------------- eklemler ---------------- */
    const pelvis = { f: 0, s: sway, u: hipH + bob };
    const hipOf = (side: number): { f: number; s: number; u: number } => ({
      f: pelvis.f + Math.sin(pelvisYaw) * side * hipW,
      s: pelvis.s + Math.cos(pelvisYaw) * side * hipW,
      u: pelvis.u,
    });
    const shoulderOf = (side: number): { f: number; s: number; u: number } => ({
      f: Math.sin(shoulderYaw) * side * shW,
      s: Math.cos(shoulderYaw) * side * shW + sway * 0.35,
      u: shH + bob * 0.55,
    });

    /** Düzlemsel 2 kemik IK (f-u düzleminde); diz/dirsek `bend` yönüne kırılır. */
    const ik2 = (
      ax: number, az: number, bx: number, bz: number, l1: number, l2: number, bend: number,
    ): [number, number] => {
      let dx = bx - ax, dz = bz - az;
      let d = Math.hypot(dx, dz);
      const maxR = (l1 + l2) * 0.995;
      if (d > maxR) { const k = maxR / (d || 1); dx *= k; dz *= k; d = maxR; }
      if (d < 1e-4) d = 1e-4;
      const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
      const baseA = Math.atan2(dz, dx);
      const a = baseA + Math.acos(cosA) * bend;
      return [ax + Math.cos(a) * l1, az + Math.sin(a) * l1];
    };

    interface Limb { f: number; s: number; u: number }
    const legJoints = (side: number, theta: number): { hip: Limb; knee: Limb; ankle: Limb; toe: Limb } => {
      const hip = hipOf(side);
      let ff: number, fz: number;
      if (sliding) { ff = side > 0 ? 0.62 * H : 0.20 * H; fz = side > 0 ? 0.05 * H : 0.16 * H; }
      else if (diving) { ff = 0.10 * H; fz = 0.02 * H + side * 0.05 * H; }
      else if (celebrating && mp.celebKind === 3) { ff = side * 0.10 * H; fz = 0.02 * H; }
      else { const t = footTrack(theta); ff = t[0]; fz = t[1]; }
      // ayak hedefi bacağın erişemeyeceği yere düşerse bacak "kopmuş" gibi uzardı
      let tf = hip.f * 0.25 + ff;
      let tu = fz;
      const reach = (thighL + shinL) * 0.97;
      const dd = Math.hypot(tf - hip.f, tu - hip.u);
      if (dd > reach) {
        const k = reach / dd;
        tf = hip.f + (tf - hip.f) * k;
        tu = hip.u + (tu - hip.u) * k;
      }
      const [kf, ku] = ik2(hip.f, hip.u, tf, tu, thighL, shinL, +1);
      return {
        hip,
        knee: { f: kf, s: hip.s * 0.92, u: ku },
        ankle: { f: tf, s: hip.s * 0.86, u: tu + 0.035 * H },
        toe: { f: tf + 0.085 * H, s: hip.s * 0.86, u: tu + 0.018 * H },
      };
    };

    /**
     * Kollar İLERİ kinematikle (açıyla) kurulur — ters kinematikte hedef nokta
     * kolun erişemeyeceği yere düşünce kol yatay bir çubuk gibi uzuyordu.
     * Omuz açısı sagital düzlemde salınır, dirsek bükülmesi faz boyunca değişir:
     * kol öne gelirken daha çok bükülür (gerçek koşu mekaniği).
     */
    const armJoints = (side: number, theta: number): { sh: Limb; elbow: Limb; hand: Limb } => {
      const sh = shoulderOf(side);
      const swingAmp = 0.30 + amp * 0.62;                 // rad
      let a1 = -Math.PI / 2 + Math.sin(theta) * swingAmp; // omuz açısı (aşağıya bakan referans)
      let bend = 0.42 + 0.55 * (0.5 + 0.5 * Math.sin(theta + 0.7)) + amp * 0.35;
      let outward = 0.048 + amp * 0.022;                  // gövdeden yanal açılma
      if (celebrating && (mp.celebKind === 0 || mp.celebKind === 2)) {
        a1 = Math.PI / 2 - 0.35 * side; bend = 0.30; outward = 0.16;
      } else if (celebrating && mp.celebKind === 4) {
        a1 = -0.15; bend = 0.9; outward = 0.12;
      } else if (diving) {
        a1 = 0.55; bend = 0.15; outward = 0.11;
      } else if (sliding) {
        a1 = -Math.PI / 2 - 0.7 * side; bend = 0.55; outward = 0.17;
      }
      const ef = sh.f + Math.cos(a1) * upperArm;
      const eu = sh.u + Math.sin(a1) * upperArm;
      const a2 = a1 - bend;                                // dirsek GERİYE kırılır
      const hf = ef + Math.cos(a2) * foreArm;
      const hu = eu + Math.sin(a2) * foreArm;
      return {
        sh,
        elbow: { f: ef, s: sh.s + side * outward * 0.45 * H, u: eu },
        hand: { f: hf, s: sh.s + side * outward * H, u: hu },
      };
    };

    const rightLeg = legJoints(1, ph);
    const leftLeg = legJoints(-1, ph + Math.PI);
    const rightArm = armJoints(1, ph + Math.PI);
    const leftArm = armJoints(-1, ph);

    /* ---------------- çizim yardımcıları ---------------- */
    const capsule = (a: Proj, b: Proj, wa: number, wb: number, col: string): void => {
      if (!a.ok || !b.ok) return;
      const dx = b.sx - a.sx, dy = b.sy - a.sy;
      const l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l;
      const ra = Math.max(0.7, wa * a.sc);
      const rb = Math.max(0.7, wb * b.sc);
      const ang = Math.atan2(ny, nx);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(a.sx + nx * ra, a.sy + ny * ra);
      ctx.lineTo(b.sx + nx * rb, b.sy + ny * rb);
      ctx.arc(b.sx, b.sy, rb, ang - Math.PI / 2, ang + Math.PI / 2, false);
      ctx.lineTo(a.sx - nx * ra, a.sy - ny * ra);
      ctx.arc(a.sx, a.sy, ra, ang + Math.PI / 2, ang - Math.PI / 2, false);
      ctx.closePath();
      ctx.fill();
    };

    const drawLeg = (leg: { hip: Limb; knee: Limb; ankle: Limb; toe: Limb }, dim: number): void => {
      const hp = J(leg.hip.f, leg.hip.s, leg.hip.u);
      const kp = J(leg.knee.f, leg.knee.s, leg.knee.u);
      const ap = J(leg.ankle.f, leg.ankle.s, leg.ankle.u);
      const tp = J(leg.toe.f, leg.toe.s, leg.toe.u);
      capsule(hp, kp, thighR, thighR * 0.74, shade(kit.shorts, -0.06 - dim));       // uyluk (şort)
      capsule(kp, ap, calfR * 0.98, calfR * 0.62, shade(kit.secondary, -0.02 - dim)); // baldır (tozluk)
      capsule(ap, tp, calfR * 0.60, calfR * 0.44, shade(boots, -dim));               // krampon
    };

    const drawArm = (arm: { sh: Limb; elbow: Limb; hand: Limb }, dim: number): void => {
      const sh0 = J(arm.sh.f, arm.sh.s, arm.sh.u);
      const el = J(arm.elbow.f, arm.elbow.s, arm.elbow.u);
      const hd = J(arm.hand.f, arm.hand.s, arm.hand.u);
      capsule(sh0, el, armR * 1.18, armR * 0.84, shade(kit.primary, -0.08 - dim));
      capsule(el, hd, armR * 0.80, armR * 0.58, shade(skin, -dim));
      if (mp.isGK && hd.ok) {
        ctx.fillStyle = shade("#ffd23f", -dim);
        ctx.beginPath();
        ctx.arc(hd.sx, hd.sy, Math.max(1.2, armR * 1.25 * hd.sc), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    /* ---------------- gövde (forma) ---------------- */
    const drawTorso = (): void => {
      const shL = shoulderOf(-1), shR = shoulderOf(1);
      const hpL = hipOf(-1), hpR = hipOf(1);
      const pts = [
        J(shL.f, shL.s * 1.10, shL.u + 0.028 * H),
        J(shR.f, shR.s * 1.10, shR.u + 0.028 * H),
        J(shR.f, shR.s * 1.16, shR.u - 0.10 * H),
        J(hpR.f, hpR.s * 1.16, hpR.u + 0.06 * H),
        J(hpL.f, hpL.s * 1.16, hpL.u + 0.06 * H),
        J(shL.f, shL.s * 1.16, shL.u - 0.10 * H),
      ];
      if (pts.some((q) => !q.ok)) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].sx, pts[0].sy);
      ctx.lineTo(pts[1].sx, pts[1].sy);
      ctx.quadraticCurveTo(pts[2].sx, pts[2].sy, pts[3].sx, pts[3].sy);
      ctx.lineTo(pts[4].sx, pts[4].sy);
      ctx.quadraticCurveTo(pts[5].sx, pts[5].sy, pts[0].sx, pts[0].sy);
      ctx.closePath();
      // hacim: ışık sol-üstten
      const minX = Math.min(...pts.map((q) => q.sx));
      const maxX = Math.max(...pts.map((q) => q.sx));
      const g = ctx.createLinearGradient(minX, 0, maxX, 0);
      g.addColorStop(0, shade(kit.primary, 0.10));
      g.addColorStop(0.42, kit.primary);
      g.addColorStop(1, shade(kit.primary, -0.30));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.clip();

      // ---- forma deseni (gövde uzayında çizilir → gövdeyle birlikte döner) ----
      const bandQuad = (f0: number, s0: number, s1: number, u0: number, u1: number, col: string): void => {
        const q = [J(f0, s0, u0), J(f0, s1, u0), J(f0, s1, u1), J(f0, s0, u1)];
        if (q.some((v) => !v.ok)) return;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(q[0].sx, q[0].sy);
        for (let i = 1; i < 4; i++) ctx.lineTo(q[i].sx, q[i].sy);
        ctx.closePath();
        ctx.fill();
      };
      const uTop = shH + 0.03 * H, uBot = hipH + 0.05 * H;
      const sMax = shW * 1.25;
      const fFront = 0.055 * H;
      switch (kit.pattern) {
        case "stripes":
          for (let i = -3; i <= 3; i++) {
            const c = (i * 2 * sMax) / 7;
            bandQuad(fFront, c - sMax * 0.075, c + sMax * 0.075, uBot, uTop, kit.secondary);
            bandQuad(-fFront, c - sMax * 0.075, c + sMax * 0.075, uBot, uTop, shade(kit.secondary, -0.12));
          }
          break;
        case "halves":
          bandQuad(fFront, 0, sMax, uBot, uTop, kit.secondary);
          bandQuad(-fFront, -sMax, 0, uBot, uTop, shade(kit.secondary, -0.12));
          break;
        case "hoops":
          for (let i = 0; i < 4; i++) {
            const u = uBot + ((uTop - uBot) * (i + 0.25)) / 4;
            bandQuad(fFront, -sMax, sMax, u, u + (uTop - uBot) * 0.12, kit.secondary);
            bandQuad(-fFront, -sMax, sMax, u, u + (uTop - uBot) * 0.12, shade(kit.secondary, -0.12));
          }
          break;
        case "sash": {
          const q = [J(fFront, -sMax, uBot), J(fFront, -sMax * 0.35, uBot), J(fFront, sMax, uTop), J(fFront, sMax * 0.35, uTop)];
          if (!q.some((v) => !v.ok)) {
            ctx.fillStyle = kit.secondary;
            ctx.beginPath();
            ctx.moveTo(q[0].sx, q[0].sy);
            for (let i = 1; i < 4; i++) ctx.lineTo(q[i].sx, q[i].sy);
            ctx.closePath();
            ctx.fill();
          }
          break;
        }
        case "third":
          bandQuad(fFront, -sMax, sMax, uTop - (uTop - uBot) * 0.34, uTop, kit.secondary);
          bandQuad(-fFront, -sMax, sMax, uTop - (uTop - uBot) * 0.34, uTop, shade(kit.secondary, -0.12));
          break;
        default:
          break;
      }
      // yaka
      bandQuad(fFront, -shW * 0.42, shW * 0.42, uTop - 0.022 * H, uTop, shade(kit.secondary, -0.05));
      // gövde gölgesi (alt)
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      const bq = [J(0, -sMax, uBot), J(0, sMax, uBot), J(0, sMax, uBot + 0.05 * H), J(0, -sMax, uBot + 0.05 * H)];
      if (!bq.some((v) => !v.ok)) {
        ctx.beginPath();
        ctx.moveTo(bq[0].sx, bq[0].sy);
        for (let i = 1; i < 4; i++) ctx.lineTo(bq[i].sx, bq[i].sy);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // sırt numarası — yalnızca sırt kameraya dönükse
      const backW = W(-0.09 * H, 0, shH - 0.03 * H);
      const frontW = W(0.09 * H, 0, shH - 0.03 * H);
      const backDepth = this.toCam(backW.x, backW.y, backW.z).cz;
      const frontDepth = this.toCam(frontW.x, frontW.y, frontW.z).cz;
      if (backDepth < frontDepth) {
        const np = this.project(backW.x, backW.y, backW.z);
        if (np.ok) {
          ctx.save();
          ctx.fillStyle = kit.secondary;
          ctx.strokeStyle = "rgba(0,0,0,0.45)";
          ctx.lineWidth = Math.max(0.6, np.sc * 0.008);
          ctx.font = `900 ${Math.max(5, 0.135 * H * np.sc)}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.strokeText(String(mp.p.num), np.sx, np.sy);
          ctx.fillText(String(mp.p.num), np.sx, np.sy);
          ctx.restore();
        }
      }
    };

    /* ---------------- baş ---------------- */
    const drawHead = (): void => {
      // baş topa bakar (gövdeye göre sınırlı sapma) — canlı bir detay
      const bx = o.eng.ball.x - mp.x, by = o.eng.ball.y - mp.y;
      let hy = Math.atan2(by, bx) - yaw;
      while (hy > Math.PI) hy -= Math.PI * 2;
      while (hy < -Math.PI) hy += Math.PI * 2;
      hy = clamp(hy, -0.95, 0.95);
      const hf = Math.cos(hy), hs = Math.sin(hy);

      const cW = W(0, 0, headH + bob * 0.4);
      const cP = this.project(cW.x, cW.y, cW.z);
      if (!cP.ok) return;
      const r = headR * cP.sc;

      // yüzün ekrandaki yönü (yüz kameraya mı dönük?)
      const faceW = W(hf * headR * 1.05, hs * headR * 1.05, headH + bob * 0.4);
      const faceDepth = this.toCam(faceW.x, faceW.y, faceW.z).cz;
      const headDepth = this.toCam(cW.x, cW.y, cW.z).cz;
      const facing = faceDepth < headDepth;
      const fp = this.project(faceW.x, faceW.y, faceW.z);
      const dxF = fp.ok ? (fp.sx - cP.sx) / (r || 1) : 0;
      const dyF = fp.ok ? (fp.sy - cP.sy) / (r || 1) : 0;

      // boyun
      const nk = J(0, 0, neckH - 0.03 * H);
      const shp = J(0, 0, shH + 0.005 * H);
      capsule(nk, shp, 0.026 * H, 0.032 * H, shade(skin, -0.10));

      // kafa küresi (küresel gölgeleme)
      const g = ctx.createRadialGradient(cP.sx - r * 0.34, cP.sy - r * 0.40, r * 0.05, cP.sx, cP.sy, r * 1.06);
      g.addColorStop(0, shade(skin, 0.14));
      g.addColorStop(0.62, skin);
      g.addColorStop(1, shade(skin, -0.26));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cP.sx, cP.sy, r, r * 1.10, 0, 0, Math.PI * 2);
      ctx.fill();
      // kulaklar
      ctx.fillStyle = shade(skin, -0.10);
      ctx.beginPath();
      ctx.ellipse(cP.sx - r * 0.95, cP.sy + r * 0.05, r * 0.22, r * 0.30, 0, 0, Math.PI * 2);
      ctx.ellipse(cP.sx + r * 0.95, cP.sy + r * 0.05, r * 0.22, r * 0.30, 0, 0, Math.PI * 2);
      ctx.fill();

      // saç
      ctx.fillStyle = hairCol;
      switch (look.hair) {
        case 0:
          ctx.beginPath(); ctx.ellipse(cP.sx, cP.sy - r * 0.16, r * 1.0, r * 0.95, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
          break;
        case 1:
          ctx.beginPath(); ctx.ellipse(cP.sx, cP.sy - r * 0.14, r * 1.0, r * 0.98, 0, Math.PI, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#f2f5f8";
          ctx.fillRect(cP.sx - r * 0.92, cP.sy - r * 0.62, r * 1.84, r * 0.20);
          break;
        case 2:
          ctx.beginPath(); ctx.arc(cP.sx, cP.sy - r * 0.20, r * 1.30, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = skin;
          ctx.beginPath(); ctx.ellipse(cP.sx, cP.sy + r * 0.18, r * 0.80, r * 0.86, 0, 0, Math.PI * 2); ctx.fill();
          break;
        case 3:
          ctx.beginPath(); ctx.ellipse(cP.sx, cP.sy - r * 0.10, r * 1.04, r * 1.0, 0, Math.PI, Math.PI * 2); ctx.fill();
          ctx.fillRect(cP.sx - r * 1.04, cP.sy - r * 0.16, r * 0.34, r * 1.35);
          ctx.fillRect(cP.sx + r * 0.70, cP.sy - r * 0.16, r * 0.34, r * 1.35);
          break;
        case 4:
          ctx.beginPath();
          ctx.moveTo(cP.sx - r * 0.26, cP.sy - r * 0.30);
          ctx.quadraticCurveTo(cP.sx, cP.sy - r * 1.95, cP.sx + r * 0.26, cP.sy - r * 0.30);
          ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.ellipse(cP.sx, cP.sy - r * 0.18, r * 0.98, r * 0.72, 0, Math.PI, Math.PI * 2); ctx.fill();
          break;
        case 5:
          ctx.beginPath(); ctx.ellipse(cP.sx, cP.sy - r * 0.12, r * 1.02, r * 0.98, 0, Math.PI, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(cP.sx - dxF * r * 0.9, cP.sy - r * 1.10, r * 0.40, 0, Math.PI * 2); ctx.fill();
          break;
        default:  // kel
          break;
      }

      if (!facing) return;
      // yüz — bakış yönüne göre kayar (3B his)
      const ex = dxF * r * 0.34, ey = dyF * r * 0.30;
      const eyeY = cP.sy - r * 0.10 + ey;
      ctx.fillStyle = "#f4f6fa";
      ctx.beginPath();
      ctx.ellipse(cP.sx - r * 0.33 + ex, eyeY, r * 0.17, r * 0.12, 0, 0, Math.PI * 2);
      ctx.ellipse(cP.sx + r * 0.33 + ex, eyeY, r * 0.17, r * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#15181f";
      ctx.beginPath();
      ctx.arc(cP.sx - r * 0.31 + ex * 1.3, eyeY, Math.max(0.5, r * 0.085), 0, Math.PI * 2);
      ctx.arc(cP.sx + r * 0.35 + ex * 1.3, eyeY, Math.max(0.5, r * 0.085), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hairCol;
      ctx.lineWidth = Math.max(0.6, r * 0.10);
      ctx.beginPath();
      ctx.moveTo(cP.sx - r * 0.52 + ex, eyeY - r * 0.28);
      ctx.lineTo(cP.sx - r * 0.14 + ex, eyeY - r * 0.33);
      ctx.moveTo(cP.sx + r * 0.14 + ex, eyeY - r * 0.33);
      ctx.lineTo(cP.sx + r * 0.52 + ex, eyeY - r * 0.28);
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.30)";
      ctx.lineWidth = Math.max(0.5, r * 0.07);
      ctx.beginPath();
      ctx.moveTo(cP.sx + ex * 1.5, eyeY + r * 0.06);
      ctx.lineTo(cP.sx + ex * 1.9, eyeY + r * 0.32);
      ctx.stroke();
      ctx.strokeStyle = "rgba(70,26,26,0.85)";
      ctx.lineWidth = Math.max(0.6, r * 0.09);
      ctx.beginPath();
      const mo = cP.sy + r * 0.50 + ey;
      ctx.moveTo(cP.sx - r * 0.22 + ex, mo);
      ctx.quadraticCurveTo(cP.sx + ex, mo + (celebrating ? -r * 0.22 : r * 0.16), cP.sx + r * 0.22 + ex, mo);
      ctx.stroke();
      if (look.beard > 0) {
        ctx.fillStyle = hairCol;
        ctx.globalAlpha = look.beard === 1 ? 0.45 : 0.85;
        ctx.beginPath();
        ctx.ellipse(cP.sx + ex, cP.sy + r * 0.34 + ey, r * (look.beard === 1 ? 0.66 : 0.80), r * (look.beard === 1 ? 0.52 : 0.66), 0, 0.08 * Math.PI, 0.92 * Math.PI);
        ctx.fill();
        if (look.beard >= 3) ctx.fillRect(cP.sx - r * 0.30 + ex, cP.sy + r * 0.24 + ey, r * 0.60, r * 0.13);
        ctx.globalAlpha = 1;
      }
    };

    /* ---------------- derinlik sıralı çizim ---------------- */
    // Hangi taraf kameraya UZAK? Omuz derinliklerini karşılaştır.
    const dR = depthOf(0, shW, shH);
    const dL = depthOf(0, -shW, shH);
    const rightIsFar = dR > dL;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    if (rightIsFar) {
      drawArm(rightArm, 0.16); drawLeg(rightLeg, 0.14);
      drawTorso();
      drawLeg(leftLeg, 0); drawArm(leftArm, 0);
    } else {
      drawArm(leftArm, 0.16); drawLeg(leftLeg, 0.14);
      drawTorso();
      drawLeg(rightLeg, 0); drawArm(rightArm, 0);
    }
    drawHead();

    // kayma tozu
    if (sliding && o.quality >= 1) {
      const gp = this.project(mp.x, mp.y, 0.06);
      if (gp.ok) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = o.faik ? "#d8c9a0" : "#cfe6d2";
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + o.time * 3;
          const d = 0.25 + (i % 3) * 0.22;
          ctx.beginPath();
          ctx.arc(gp.sx + Math.cos(a) * d * gp.sc, gp.sy + Math.sin(a) * d * gp.sc * 0.4, Math.max(1, gp.sc * 0.045), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  /* ------------------------------ ÜST KATMAN ------------------------------ */

  private drawOverlay(ctx: CanvasRenderingContext2D, o: RenderOpts): void {
    const eng = o.eng;
    // isim etiketi: yalnızca kontrol edilen VE topu taşıyan oyuncu
    const label = eng.controlled ?? (eng.ball.owner ?? null);
    if (label) {
      const p = this.project(label.x, label.y, 2.05);
      if (p.ok) {
        const fs = Math.max(9, Math.min(15, p.sc * 0.09));
        ctx.save();
        ctx.font = `800 ${fs}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const tw = ctx.measureText(label.p.name).width;
        const pad = fs * 0.4;
        ctx.fillStyle = "rgba(4,10,18,0.72)";
        ctx.beginPath();
        const bx = p.sx, by = p.sy - fs;
        const bw = tw + pad * 2, bh = fs * 1.5;
        const r = bh / 2;
        ctx.moveTo(bx - bw / 2 + r, by - bh / 2);
        ctx.arcTo(bx + bw / 2, by - bh / 2, bx + bw / 2, by + bh / 2, r);
        ctx.arcTo(bx + bw / 2, by + bh / 2, bx - bw / 2, by + bh / 2, r);
        ctx.arcTo(bx - bw / 2, by + bh / 2, bx - bw / 2, by - bh / 2, r);
        ctx.arcTo(bx - bw / 2, by - bh / 2, bx + bw / 2, by - bh / 2, r);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = label === eng.controlled ? "#37f28b" : "#ffd640";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = "#eaf7ff";
        ctx.fillText(`${label.p.num} · ${label.p.name}`, bx, by);
        ctx.restore();
      }
    }

    // radar
    const rw = Math.min(128, this.W * 0.19);
    const rh = rw * (PITCH.W / PITCH.L);
    const rx = this.W - rw - 10;
    const ry = 54;
    ctx.save();
    ctx.fillStyle = "rgba(4,12,20,0.62)";
    ctx.strokeStyle = "rgba(120,190,150,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(rx, ry, rw, rh, 4);
    else ctx.rect(rx, ry, rw, rh);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.moveTo(rx + rw / 2, ry); ctx.lineTo(rx + rw / 2, ry + rh);
    ctx.stroke();
    const mx = (x: number) => rx + ((x + PITCH.HL) / PITCH.L) * rw;
    const my = (y: number) => ry + ((y + PITCH.HW) / PITCH.W) * rh;
    for (const mp of eng.mps) {
      if (!mp.onPitch) continue;
      const cl = mp.team === 0 ? o.home : o.away;
      ctx.fillStyle = (mp.isGK ? cl.gkKit : cl.kit).primary;
      ctx.beginPath();
      ctx.arc(mx(mp.x), my(mp.y), 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
    const sel = eng.controlled;
    if (sel) {
      ctx.strokeStyle = "#ffd640";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(mx(sel.x), my(sel.y), 3.6, 0, Math.PI * 2);
      ctx.stroke();
      // kullanıcı hücum yönü oku
      const dir = eng.teams[sel.team].dir;
      ctx.beginPath();
      ctx.moveTo(mx(sel.x), my(sel.y));
      ctx.lineTo(mx(sel.x) + dir * 7, my(sel.y));
      ctx.stroke();
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(mx(eng.ball.x), my(eng.ball.y), 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // vinyet
    const vg = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.35, this.W / 2, this.H / 2, this.H * 0.95);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.W, this.H);

    // gol flaşı
    if (eng.flash > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${eng.flash * 0.35})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
  }
}
