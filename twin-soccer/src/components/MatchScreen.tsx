import React from "react";
import { Renderer3D, type StadiumLevels } from "../game/render3d";
import { PITCH, type MatchEngine } from "../game/engine";
import { faikTexture } from "../assets/faik";
import { CAMERAS, CAMERA_NAME, type CameraId, type Club, type MatchResult, type MatchSettings } from "../game/types";
import { Btn, StatRow, cx } from "./ui";
import { formationById, overall } from "../game/formations";

export interface MatchScreenProps {
  eng: MatchEngine;
  home: Club;
  away: Club;
  settings: MatchSettings;
  levels: StadiumLevels;
  cupMode: boolean;
  frozen?: boolean;
  onCamera: (c: CameraId) => void;
  onFinish: (r: MatchResult) => void;
  onExit: () => void;
  onSim: () => void;
}

interface Joy { active: boolean; ox: number; oy: number; dx: number; dy: number; id: number }

export function MatchScreen(p: MatchScreenProps): React.JSX.Element {
  const { eng, home, away, settings, levels } = p;
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const rendererRef = React.useRef<Renderer3D>(new Renderer3D());
  const joyRef = React.useRef<Joy>({ active: false, ox: 0, oy: 0, dx: 0, dy: 0, id: -1 });
  const powerRef = React.useRef(0);
  const holdRef = React.useRef(false);
  const faikImgRef = React.useRef<HTMLImageElement | null>(null);
  const [joyUi, setJoyUi] = React.useState({ active: false, ox: 0, oy: 0, dx: 0, dy: 0 });
  const [power, setPower] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [cam, setCam] = React.useState<CameraId>(settings.camera);
  const [sheet, setSheet] = React.useState<"none" | "subs" | "stats" | "tactics">("none");
  const [guide, setGuide] = React.useState(true);
  const [hud, setHud] = React.useState({
    clock: 0, phase: eng.phase, hg: 0, ag: 0,
    name: "", num: 0, stamina: 100, pos: "",
    comm: "", goal: null as null | { scorer: string; assist: string; hg: number; ag: number },
    restart: "none" as string, hasBall: false, manual: false,
  });
  const [, forceTick] = React.useState(0);

  /* ---------------- faik dokusu ---------------- */
  React.useEffect(() => {
    if (!settings.faikMode) return;
    const src = faikTexture();
    if (!src) return;
    const img = new Image();
    img.onload = () => { faikImgRef.current = img; };
    img.src = src;
  }, [settings.faikMode]);

  /* ---------------- girişi motora aktar ---------------- */
  React.useEffect(() => {
    const j = joyRef.current;
    const mag = Math.hypot(j.dx, j.dy);
    const nx = mag > 1 ? j.dx / mag : j.dx;
    const ny = mag > 1 ? j.dy / mag : j.dy;
    eng.input.jx = nx;
    // 3B kamerada dünya +y ekranda YUKARI karşılığı → dikey eksen ters çevrilir
    eng.input.jy = -ny;
    eng.input.shoot = powerRef.current;
    eng.input.shootHeld = holdRef.current;
  });

  /* ---------------- klavye ---------------- */
  React.useEffect(() => {
    const keys = new Set<string>();
    const apply = (): void => {
      const j = joyRef.current;
      let dx = 0, dy = 0;
      if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
      if (keys.has("d") || keys.has("arrowright")) dx += 1;
      if (keys.has("w") || keys.has("arrowup")) dy -= 1;
      if (keys.has("s") || keys.has("arrowdown")) dy += 1;
      if (dx || dy) { j.active = true; j.dx = dx; j.dy = dy; setJoyUi({ ...j }); }
      else if (j.active && !dx && !dy) { j.active = false; j.dx = 0; j.dy = 0; setJoyUi({ ...j }); }
      eng.input.sprint = keys.has("shift");
    };
    const kd = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
      keys.add(k);
      if (k === "j") doPass();
      if (k === "l") doThrough();
      if (k === " ") eng.switchPlayer();
      if (k === "k") { holdRef.current = true; }
      if (k === "c") cycleCam();
      if (k === "p") setPaused((v) => !v);
      apply();
    };
    const ku = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      keys.delete(k);
      if (k === "k") { doShoot(); }
      apply();
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- şut gücü kilitlenmesi güvenliği ----------------
     Parmak butonun dışına kayarsa pointerup kaçar ve güç sonsuza kadar dolardı. */
  React.useEffect(() => {
    const release = (): void => { if (holdRef.current) doShoot(); };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- ana döngü ---------------- */
  React.useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d", { alpha: false });
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let frames = 0;
    const STEP = 1 / 60;

    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, settings.quality === 2 ? 2 : settings.quality === 1 ? 1.5 : 1);
      const w = cv.clientWidth, h = cv.clientHeight;
      cv.width = Math.floor(w * dpr);
      cv.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = (t: number): void => {
      const dt = Math.min(0.06, (t - last) / 1000);
      last = t;
      if (!paused && sheet === "none" && !p.frozen) {
        acc += dt;
        let guard = 0;
        while (acc >= STEP && guard < 6) { eng.step(); acc -= STEP; guard++; }
        if (acc > 0.3) acc = 0;
      }
      const w = cv.clientWidth, h = cv.clientHeight;
      rendererRef.current.render(ctx, w, h, {
        eng, quality: settings.quality, faik: settings.faikMode,
        faikImg: faikImgRef.current, camera: cam, userTeam: eng.userTeam,
        dt, time: t / 1000, levels, home, away,
      });
      // şut gücü
      if (holdRef.current) {
        powerRef.current = Math.min(1, powerRef.current + dt * 1.5);
        setPower(powerRef.current);
      }
      frames++;
      if (frames % 5 === 0) {
        const sel = eng.controlled;
        setHud({
          clock: eng.clock, phase: eng.phase, hg: eng.score[0], ag: eng.score[1],
          name: sel ? sel.p.name : "", num: sel ? sel.p.num : 0,
          stamina: sel ? sel.stamina : 100, pos: sel ? sel.p.pos : "",
          comm: eng.commTimer > 0 ? eng.commentary : "",
          goal: eng.goalBanner,
          restart: eng.restart ? eng.restart.kind : "none",
          hasBall: eng.ball.owner ? eng.ball.owner.team === eng.userTeam : false,
          manual: !!eng.restart?.manual,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, sheet, cam, settings.quality, settings.faikMode, p.frozen]);

  /* ---------------- aksiyonlar ---------------- */
  const doPass = (): void => {
    if (eng.phase === "dead" && eng.restart?.manual) { eng.executeRestart(); return; }
    eng.userPass(false);
  };
  const doThrough = (): void => {
    if (eng.phase === "dead" && eng.restart?.manual) { eng.executeRestart(); return; }
    eng.userPass(true);
  };
  const doShoot = (): void => {
    if (eng.phase === "dead" && eng.restart?.manual) { eng.executeRestart(); return; }
    eng.userShoot(Math.max(0.4, powerRef.current));
    powerRef.current = 0;
    setPower(0);
    holdRef.current = false;
  };
  const cycleCam = (): void => {
    const i = CAMERAS.indexOf(cam);
    const n = CAMERAS[(i + 1) % CAMERAS.length];
    setCam(n);
    p.onCamera(n);
  };

  /* ---------------- dokunmatik ---------------- */
  const onPointerDown = (e: React.PointerEvent): void => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (x > rect.width * 0.5 || y < 52) return;   // sol yarı + HUD alanı hariç
    joyRef.current = { active: true, ox: x, oy: y, dx: 0, dy: 0, id: e.pointerId };
    setJoyUi({ ...joyRef.current });
  };
  const onPointerMove = (e: React.PointerEvent): void => {
    const j = joyRef.current;
    if (!j.active || j.id !== e.pointerId) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    j.dx = (x - j.ox) / 46;
    j.dy = (y - j.oy) / 46;
    const m = Math.hypot(j.dx, j.dy);
    if (m > 1) { j.dx /= m; j.dy /= m; }
    setJoyUi({ ...j });
  };
  const onPointerUp = (e: React.PointerEvent): void => {
    const j = joyRef.current;
    if (j.id !== e.pointerId) return;
    j.active = false; j.dx = 0; j.dy = 0;
    setJoyUi({ ...j });
  };

  const minute = Math.max(0, Math.min(p.settings.minutes, Math.floor(hud.clock)));
  const attacking = hud.hasBall;
  const over = eng.phase === "fulltime" || eng.phase === "pens";
  const halftime = eng.phase === "halftime";
  const goalShow = hud.goal;

  /* ---------------- yedekler ---------------- */
  const userSide = eng.userTeam === 1 ? 1 : 0;
  const teamRt = eng.teams[userSide];
  const [subIn, setSubIn] = React.useState<string | null>(null);
  // kontrol rehberi kendi efektinde sayar (döngü efekti yeniden kurulunca sıfırlanıyordu)
  React.useEffect(() => {
    const g = window.setTimeout(() => setGuide(false), 9000);
    return () => window.clearTimeout(g);
  }, []);

  return (
    <div
      ref={wrapRef}
      className="fixed inset-0 bg-black overflow-hidden touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* ============ ÜST SKOR BANDI ============ */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-start gap-2 p-1.5 pointer-events-none">
        <button
          type="button"
          onClick={() => setPaused(true)}
          className="pointer-events-auto btn btn-dark !px-2.5 !py-1.5 !text-[11px]"
        >
          ⏸
        </button>
        <div className="hud-bar px-3.5 py-1.5 flex items-center gap-2.5 pointer-events-auto">
          <span className="text-[11px] font-black" style={{ color: home.kit.primary === "#ffffff" || home.kit.primary === "#f8f8f8" ? "#dbe6f2" : home.kit.primary }}>
            {home.short}
          </span>
          <span className="text-[17px] font-black tabular-nums text-white leading-none">{hud.hg}</span>
          <span className="text-[10px] text-slate-600">–</span>
          <span className="text-[17px] font-black tabular-nums text-white leading-none">{hud.ag}</span>
          <span className="text-[11px] font-black" style={{ color: away.kit.primary === "#ffffff" || away.kit.primary === "#f8f8f8" ? "#dbe6f2" : away.kit.primary }}>
            {away.short}
          </span>
          <div className="w-px h-4 bg-white/15" />
          <span className="text-[12px] font-black text-emerald-300 tabular-nums w-9 text-center">
            {minute}'
          </span>
          {p.cupMode && <span className="tag bg-amber-400/20 text-amber-300">KUPA</span>}
        </div>

        <div className="ml-auto flex items-center gap-1.5 pointer-events-auto">
          {settings.faikMode && <span className="tag bg-emerald-400/20 text-emerald-300 border border-emerald-400/40">🥅 SAKAT FAİK MODU</span>}
          <button type="button" onClick={cycleCam} className="btn btn-dark !px-2 !py-1.5 !text-[10px]">
            🎥 {CAMERA_NAME[cam]}
          </button>
        </div>
      </div>

      {/* ============ KONTROL EDİLEN OYUNCU ============ */}
      <div className="absolute top-[46px] left-1.5 z-20 pointer-events-none flex flex-col gap-1">
        <div className="panel !rounded-lg px-2 py-1 flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-b from-emerald-400 to-emerald-700 text-emerald-950 text-[11px] font-black flex items-center justify-center">
            {hud.num}
          </div>
          <div>
            <div className="text-[10px] font-bold leading-none">{hud.name}</div>
            <div className="text-[8px] text-slate-400 leading-none mt-0.5">{hud.pos}</div>
          </div>
          <div className="w-14">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={cx("h-full rounded-full", hud.stamina > 55 ? "bg-emerald-400" : hud.stamina > 30 ? "bg-amber-400" : "bg-rose-500")}
                style={{ width: `${hud.stamina}%` }}
              />
            </div>
          </div>
        </div>
        {hud.restart !== "none" && (
          <div className="panel !rounded-lg px-2 py-0.5 text-[9px] text-sky-300 font-bold">
            ⏱ {hud.restart === "kickoff" ? "BAŞLAMA VURUŞU" : hud.restart === "throwin" ? "TAÇ" : hud.restart === "goalkick" ? "KALE VURUŞU"
              : hud.restart === "corner" ? "KORNER" : hud.restart === "freekick" ? "SERBEST VURUŞ" : hud.restart === "penalty" ? "PENALTI" : ""}
            {hud.manual && <span className="text-amber-300"> · PAS ile oyna</span>}
          </div>
        )}
      </div>

      {/* ============ GOL BANNERI ============ */}
      {goalShow && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none">
          <div className="anim-goal text-center">
            <div className="text-[58px] font-black italic tracking-tighter txt-neon drop-shadow-[0_6px_18px_rgba(0,0,0,0.8)]">GOOOL!</div>
            <div className="text-base font-black text-white">{goalShow.scorer}</div>
            {goalShow.assist && <div className="text-[10px] text-emerald-300 font-bold">asist: {goalShow.assist}</div>}
            <div className="mt-1 text-2xl font-black text-white/90 tabular-nums">
              {home.short} {goalShow.hg} - {goalShow.ag} {away.short}
            </div>
          </div>
        </div>
      )}

      {/* ============ SPİKER ============ */}
      {hud.comm && !goalShow && (
        <div className="absolute bottom-[104px] left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="panel !rounded-lg px-3 py-1 text-[10px] text-slate-200 italic max-w-[70vw] text-center">
            🎙️ {hud.comm}
          </div>
        </div>
      )}

      {/* ============ KONTROL REHBERİ ============ */}
      {guide && (
        <div className="absolute top-[92px] left-1/2 -translate-x-1/2 z-20 panel-hi !rounded-xl px-3 py-2 text-[9px] leading-relaxed max-w-[330px] anim-pop">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black txt-neon">KONTROL</span>
            <button type="button" onClick={() => setGuide(false)} className="ml-auto text-slate-400 text-[10px]">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-300">
            <span>◀ Sol yarı: joystick</span><span>Hücum: PAS / ARA / ŞUT</span>
            <span>⚡ Koşu (basılı tut)</span><span>Savunma: KAP / DEĞ</span>
            <span>🔄 Oyuncu değiştir</span><span>🎥 Kamera · ⏸ Duraklat</span>
            <span className="col-span-2 text-slate-500">Klavye: WASD · J pas · K şut (bas-tut) · L ara · Boşluk değiştir</span>
          </div>
        </div>
      )}

      {/* ============ JOYSTICK ============ */}
      {joyUi.active && (
        <>
          <div
            className="absolute z-10 rounded-full border-2 border-emerald-400/25 bg-black/20 pointer-events-none"
            style={{ left: joyUi.ox - 46, top: joyUi.oy - 46, width: 92, height: 92 }}
          />
          <div
            className="absolute z-10 rounded-full bg-gradient-to-b from-emerald-300 to-emerald-600 shadow-[0_0_18px_rgba(55,242,139,0.7)] pointer-events-none"
            style={{ left: joyUi.ox + joyUi.dx * 46 - 19, top: joyUi.oy + joyUi.dy * 46 - 19, width: 38, height: 38 }}
          />
        </>
      )}
      {!joyUi.active && (
        <div className="absolute left-8 bottom-16 z-10 w-[92px] h-[92px] rounded-full border-2 border-white/10 pointer-events-none flex items-center justify-center">
          <span className="text-[8px] text-white/25 font-bold">SÜRÜKLE</span>
        </div>
      )}

      {/* ============ AKSİYON BUTONLARI ============ */}
      <div className="absolute right-2 bottom-2 z-20 flex items-end gap-2">
        <div className="flex flex-col gap-2">
          <ActionBtn label="DEĞ" sub="müdahale" color="from-amber-400 to-amber-700" onDown={() => eng.userTackle()} />
          <ActionBtn label="ARA" sub="delikli pas" color="from-sky-400 to-sky-700" onDown={doThrough} />
        </div>
        <div className="flex flex-col gap-2">
          <ActionBtn label="KAP" sub="top kap" color="from-emerald-400 to-emerald-700" onDown={doPass} />
          <div className="relative">
            <button
              type="button"
              onPointerDown={() => { holdRef.current = true; powerRef.current = 0.18; }}
              onPointerUp={doShoot}
              onPointerCancel={doShoot}
              className={cx(
                "w-[74px] h-[74px] rounded-full font-black text-[13px] text-white/95 relative",
                "bg-gradient-to-b shadow-[0_6px_20px_-6px_rgba(255,120,60,0.9)] active:scale-95 transition-transform",
                attacking ? "from-orange-400 to-red-600" : "from-rose-500 to-red-800",
              )}
            >
              {attacking ? "ŞUT" : "KAY"}
              {power > 0.02 && (
                <span className="absolute inset-1.5 rounded-full overflow-hidden">
                  <span className="absolute left-0 bottom-0 right-0 bg-white/35" style={{ height: `${power * 100}%` }} />
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="absolute left-2 bottom-2 z-20 flex items-center gap-2">
        <button
          type="button"
          onPointerDown={(e) => { e.stopPropagation(); eng.input.sprint = true; }}
          onPointerUp={() => { eng.input.sprint = false; }}
          onPointerCancel={() => { eng.input.sprint = false; }}
          className="w-[52px] h-[52px] rounded-full bg-gradient-to-b from-yellow-300 to-amber-600 text-amber-950 font-black text-[10px] shadow-[0_6px_18px_-6px_rgba(255,200,40,0.9)] active:scale-95"
        >
          ⚡<div className="text-[8px]">KOŞ</div>
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => eng.switchPlayer()}
          className="w-[52px] h-[52px] rounded-full bg-gradient-to-b from-slate-300 to-slate-600 text-slate-900 font-black text-[10px] shadow-[0_6px_18px_-6px_rgba(200,220,255,0.7)] active:scale-95"
        >
          🔄<div className="text-[8px]">DEĞİŞ</div>
        </button>
      </div>

      {/* ============ DEVRE ARASI ============ */}
      {halftime && (
        <div className="absolute inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center">
          <div className="panel-hi !rounded-2xl p-5 text-center anim-pop min-w-[280px]">
            <div className="text-[10px] tracking-[0.3em] text-slate-400">İLK YARI SONUCU</div>
            <div className="text-4xl font-black tabular-nums my-2">{hud.hg} - {hud.ag}</div>
            <div className="text-[10px] text-slate-400 mb-3">{home.name} · {away.name}</div>
            <div className="text-[9px] text-slate-500 mb-3">Kondisyonlar yenileniyor…</div>
            <Btn variant="primary" onClick={() => eng.resumeSecondHalf()}>2. YARIYI BAŞLAT</Btn>
          </div>
        </div>
      )}

      {/* ============ DURAKLATMA MENÜSÜ ============ */}
      {paused && !over && (
        <div className="absolute inset-0 z-40 bg-black/78 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="panel-hi !rounded-2xl p-4 w-full max-w-[420px] anim-pop">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-[13px] font-black txt-neon">DURAKLATILDI</div>
              <div className="ml-auto text-[15px] font-black tabular-nums">{hud.hg} - {hud.ag}</div>
              <div className="text-[10px] text-slate-400">{minute}'</div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {CAMERAS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setCam(c); p.onCamera(c); }}
                  className={cx("rounded-lg py-1.5 text-[9px] font-bold border", cam === c ? "bg-emerald-400/20 border-emerald-400/50 text-emerald-200" : "border-white/10 text-slate-400")}
                >
                  {CAMERA_NAME[c]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Btn variant="primary" onClick={() => setPaused(false)}>▶ DEVAM ET</Btn>
              <Btn variant="dark" onClick={() => { setPaused(false); setSheet("subs"); }}>🔄 Değişiklik</Btn>
              <Btn variant="dark" onClick={() => { setPaused(false); setSheet("stats"); }}>📊 İstatistik</Btn>
              <Btn variant="dark" onClick={() => { setPaused(false); setSheet("tactics"); }}>🧠 Taktik</Btn>
              <Btn variant="gold" onClick={() => { setPaused(false); p.onSim(); }}>⏩ Simüle Et</Btn>
              <Btn variant="danger" onClick={p.onExit}>🚪 Maçı Terk Et</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ============ SHEET'LER ============ */}
      {sheet !== "none" && (
        <div className="absolute inset-0 z-40 bg-black/75 flex items-center justify-center p-3">
          <div className="panel-hi !rounded-2xl p-3 w-full max-w-[460px] max-h-[90%] overflow-hidden anim-pop">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-[12px] font-black txt-neon">
                {sheet === "subs" ? "OYUNCU DEĞİŞİKLİĞİ" : sheet === "stats" ? "MAÇ İSTATİSTİKLERİ" : "TAKTİK"}
              </div>
              <button type="button" onClick={() => setSheet("none")} className="ml-auto btn btn-ghost !px-2 !py-1 text-[11px]">✕</button>
            </div>
            <div className="overflow-y-auto sc max-h-[58vh] pr-1">
              {sheet === "stats" && (
                <div>
                  <div className="flex justify-between text-[10px] font-bold mb-1">
                    <span style={{ color: home.kit.primary }}>{home.short}</span>
                    <span style={{ color: away.kit.primary }}>{away.short}</span>
                  </div>
                  <StatRow l="Topla Oynama %" a={`${eng.stats.possession[0]}%`} b={`${eng.stats.possession[1]}%`} hi />
                  <StatRow l="Şut" a={eng.stats.shots[0]} b={eng.stats.shots[1]} />
                  <StatRow l="İsabetli" a={eng.stats.onTarget[0]} b={eng.stats.onTarget[1]} />
                  <StatRow l="Pas" a={eng.stats.passes[0]} b={eng.stats.passes[1]} />
                  <StatRow l="Pas %" a={`${eng.stats.passAcc[0]}%`} b={`${eng.stats.passAcc[1]}%`} />
                  <StatRow l="Korner" a={eng.stats.corners[0]} b={eng.stats.corners[1]} />
                  <StatRow l="Faul" a={eng.stats.fouls[0]} b={eng.stats.fouls[1]} />
                  <StatRow l="Ofsayt" a={eng.stats.offside[0]} b={eng.stats.offside[1]} />
                  <StatRow l="Müdahale" a={eng.stats.tackles[0]} b={eng.stats.tackles[1]} />
                  <StatRow l="Kurtarış" a={eng.stats.saves[0]} b={eng.stats.saves[1]} />
                  <div className="mt-2 text-[9px] text-slate-400">
                    Goller: {eng.goals.map((g) => `${g.minute}' ${g.scorer}`).join(" · ") || "—"}
                  </div>
                </div>
              )}
              {sheet === "subs" && (
                <div>
                  <div className="text-[9px] text-slate-400 mb-1">Değişiklik hakkı: {3 - teamRt.used}/3 · Sahadan çıkan oyuncuyu seç</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[9px] font-bold text-emerald-300 mb-1">SAHADA</div>
                      {teamRt.mps.filter((m) => m.onPitch).map((m) => (
                        <div
                          key={m.p.id}
                          className="flex items-center gap-1.5 px-1.5 py-1 rounded-md bg-white/5 mb-1 cursor-pointer hover:bg-emerald-400/10"
                          onClick={() => {
                            if (teamRt.used >= 3) return;
                            // seçili yedek → yoksa aynı pozisyon → yoksa ilk uygun
                            const inP = teamRt.bench.find((x) => x.id === subIn)
                              ?? teamRt.bench.find((x) => x.pos === m.p.pos && x.pos !== "GK")
                              ?? teamRt.bench.find((x) => x.pos !== "GK");
                            if (!inP) return;
                            if (eng.substitute(userSide, m.p.id, inP.id)) {
                              setSubIn(null);
                              forceTick((v) => v + 1);
                            }
                          }}
                        >
                          <span className="text-[9px] w-5 font-black text-slate-300">{m.p.num}</span>
                          <span className="text-[10px] flex-1 truncate">{m.p.name}</span>
                          <span className={cx("text-[8px] font-bold", m.stamina > 55 ? "text-emerald-400" : "text-rose-400")}>
                            {Math.round(m.stamina)}%
                          </span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-sky-300 mb-1">
                        YEDEKLER {subIn && <span className="text-emerald-300">· seçildi ✓</span>}
                      </div>
                      {teamRt.bench.length === 0 && <div className="text-[9px] text-slate-500">Yedek kalmadı</div>}
                      {teamRt.bench.map((b) => (
                        <div
                          key={b.id}
                          onClick={() => setSubIn(b.id === subIn ? null : b.id)}
                          className={cx(
                            "flex items-center gap-1.5 px-1.5 py-1 rounded-md mb-1 cursor-pointer transition-colors",
                            subIn === b.id ? "bg-emerald-400/20 ring-1 ring-emerald-400/50" : "bg-sky-400/5 hover:bg-sky-400/15",
                          )}
                        >
                          <span className="text-[9px] w-5 font-black text-slate-300">{b.num}</span>
                          <span className="text-[10px] flex-1 truncate">{b.name}</span>
                          <span className="text-[8px] text-slate-400">{b.pos}</span>
                          <span className="text-[8px] font-bold text-emerald-300">{overall(b)}</span>
                        </div>
                      ))}
                      <div className="text-[8px] text-slate-500 mt-1">Önce yedek seç, sonra sahadan çıkacak oyuncuya dokun.</div>
                    </div>
                  </div>
                </div>
              )}
              {sheet === "tactics" && (
                <TacticQuick eng={eng} side={userSide} onDone={() => forceTick((v) => v + 1)} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ MAÇ SONU ============ */}
      {over && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 overflow-y-auto sc">
          <PostMatch eng={eng} home={home} away={away} onDone={() => p.onFinish(eng.getResult())} />
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, sub, color, onDown }: { label: string; sub: string; color: string; onDown: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); onDown(); }}
      className={cx("w-[62px] h-[62px] rounded-full font-black text-[11px] text-white/95 bg-gradient-to-b shadow-lg active:scale-95 transition-transform", color)}
    >
      {label}
      <div className="text-[7px] font-bold opacity-70">{sub}</div>
    </button>
  );
}

function TacticQuick({ eng, side, onDone }: { eng: MatchEngine; side: 0 | 1; onDone: () => void }): React.JSX.Element {
  const t = eng.teams[side];
  const [f, setF] = React.useState(t.tactic.formation);
  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        {["f442", "f433", "f4231", "f352", "f532", "f343"].map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => { t.tactic.formation = id; setF(id); onDone(); }}
            className={cx("rounded-lg py-1.5 text-[9px] font-bold border", f === id ? "bg-emerald-400/20 border-emerald-400/50 text-emerald-200" : "border-white/10 text-slate-400")}
          >
            {formationById(id).name}
          </button>
        ))}
      </div>
      {([["mentality", "Hücum"], ["pressing", "Pres"], ["lineHeight", "Savunma Hattı"], ["width", "Genişlik"], ["tempo", "Tempo"]] as const).map(([k, label]) => (
        <div key={k} className="mb-1.5">
          <div className="flex justify-between text-[9px] mb-0.5">
            <span className="text-slate-400">{label}</span>
            <span className="font-bold text-emerald-300">{Math.round(t.tactic[k])}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={t.tactic[k]}
            onChange={(e) => { t.tactic[k] = +e.target.value; onDone(); }}
            className="w-full"
            style={{ ["--p" as string]: `${t.tactic[k]}%` }}
          />
        </div>
      ))}
      <div className="grid grid-cols-3 gap-1.5 mt-2">
        {(["short", "mixed", "long"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => { t.tactic.passing = v; onDone(); }}
            className={cx("rounded-lg py-1.5 text-[9px] font-bold border", t.tactic.passing === v ? "bg-emerald-400/20 border-emerald-400/50 text-emerald-200" : "border-white/10 text-slate-400")}
          >
            {v === "short" ? "Kısa Pas" : v === "mixed" ? "Karışık" : "Uzun Top"}
          </button>
        ))}
      </div>
    </div>
  );
}

function PostMatch({
  eng, home, away, onDone,
}: { eng: MatchEngine; home: Club; away: Club; onDone: () => void }): React.JSX.Element {
  const r = eng.getResult();
  const perf = eng.performans();
  const [view, setView] = React.useState<"summary" | "stats" | "perf">("summary");
  return (
    <div className="panel-hi !rounded-2xl p-4 w-full max-w-[520px] anim-pop">
      <div className="text-center mb-2">
        <div className="text-[9px] tracking-[0.3em] text-slate-400">MAÇ SONUCU</div>
        <div className="flex items-center justify-center gap-3 mt-1">
          <div className="text-right">
            <div className="text-[11px] font-black">{home.short}</div>
            <div className="text-[8px] text-slate-500">{home.name}</div>
          </div>
          <div className="text-4xl font-black tabular-nums txt-neon">{r.hg} - {r.ag}</div>
          <div className="text-left">
            <div className="text-[11px] font-black">{away.short}</div>
            <div className="text-[8px] text-slate-500">{away.name}</div>
          </div>
        </div>
        {r.pens && (
          <div className="mt-1 text-[10px] font-bold text-amber-300">
            Penaltılar: {r.pens[0]} - {r.pens[1]} · {r.pens[0] > r.pens[1] ? home.name : away.name} turu geçti
          </div>
        )}
      </div>

      <div className="flex gap-1 mb-2">
        {([["summary", "Özet"], ["stats", "İstatistik"], ["perf", "Performans"]] as const).map(([id, l]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={cx("flex-1 rounded-lg py-1.5 text-[9px] font-bold border", view === id ? "bg-emerald-400/20 border-emerald-400/50 text-emerald-200" : "border-white/10 text-slate-400")}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="max-h-[38vh] overflow-y-auto sc pr-1">
        {view === "summary" && (
          <div className="space-y-1">
            {r.goals.length === 0 && <div className="text-[10px] text-slate-500 text-center py-3">Gol yok — golsüz beraberlik</div>}
            {r.goals.map((g, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5">
                <span className="text-[10px] font-black text-emerald-300 w-7">{g.minute}'</span>
                <span className="text-[9px]" style={{ color: g.team === 0 ? home.kit.primary : away.kit.primary }}>
                  {g.team === 0 ? home.short : away.short}
                </span>
                <span className="text-[11px] font-bold">⚽ {g.scorer}</span>
                {g.assist && <span className="text-[9px] text-slate-400">🅰 {g.assist}</span>}
              </div>
            ))}
            {r.cards.map((c, i) => (
              <div key={"c" + i} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5">
                <span className="text-[10px] font-black text-amber-300 w-7">{c.minute}'</span>
                <span className={cx("text-[10px] font-black", c.kind === "R" ? "text-rose-400" : "text-amber-300")}>
                  {c.kind === "R" ? "🟥" : "🟨"}
                </span>
                <span className="text-[10px]">{c.name}</span>
              </div>
            ))}
            <div className="mt-2 text-[9px] text-slate-400">
              Maçın Adamı: <span className="text-amber-300 font-black">⭐ {perf.find((x) => x.motm)?.name ?? "—"}</span>
            </div>
          </div>
        )}
        {view === "stats" && (
          <div>
            <StatRow l="Topla Oynama %" a={`${r.stats.possession[0]}%`} b={`${r.stats.possession[1]}%`} hi />
            <StatRow l="Şut" a={r.stats.shots[0]} b={r.stats.shots[1]} />
            <StatRow l="İsabetli" a={r.stats.onTarget[0]} b={r.stats.onTarget[1]} />
            <StatRow l="Pas" a={r.stats.passes[0]} b={r.stats.passes[1]} />
            <StatRow l="Pas %" a={`${r.stats.passAcc[0]}%`} b={`${r.stats.passAcc[1]}%`} />
            <StatRow l="Korner" a={r.stats.corners[0]} b={r.stats.corners[1]} />
            <StatRow l="Faul" a={r.stats.fouls[0]} b={r.stats.fouls[1]} />
            <StatRow l="Ofsayt" a={r.stats.offside[0]} b={r.stats.offside[1]} />
            <StatRow l="Müdahale" a={r.stats.tackles[0]} b={r.stats.tackles[1]} />
            <StatRow l="Kurtarış" a={r.stats.saves[0]} b={r.stats.saves[1]} />
          </div>
        )}
        {view === "perf" && (
          <div className="space-y-0.5">
            {perf.map((x, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5">
                <span className="text-[9px] w-8 font-black" style={{ color: x.team === 0 ? home.kit.primary : away.kit.primary }}>
                  {x.team === 0 ? home.short : away.short}
                </span>
                <span className="text-[10px] flex-1 truncate">{x.motm && "⭐ "}{x.name}</span>
                <span className="text-[8px] text-slate-400">{x.pos}</span>
                {x.goals > 0 && <span className="text-[9px]">⚽{x.goals}</span>}
                {x.assists > 0 && <span className="text-[9px]">🅰{x.assists}</span>}
                <span className={cx("text-[10px] font-black w-7 text-right", x.rating >= 8 ? "text-emerald-300" : x.rating >= 7 ? "text-sky-300" : "text-slate-400")}>
                  {x.rating.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex justify-end">
        <Btn variant="primary" size="lg" onClick={onDone}>DEVAM ET</Btn>
      </div>
      <div className="text-[8px] text-slate-600 mt-1 text-center">
        Saha: {PITCH.L}×{PITCH.W} m · Motor: 60Hz sabit adım · Lua beyin aktif
      </div>
    </div>
  );
}
