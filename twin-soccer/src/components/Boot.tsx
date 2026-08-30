import { useEffect, useRef, useState } from "react";
import { Btn } from "./ui";

/* ============================================================
 *  TWIN SOCCER — Açılış akışı
 *  1) BYMEL SOFTWARE  (2 sn)
 *  2) TWIN SOCCER     (2 sn)
 *  3) Dokun ve başla  (tam ekran + yatay kilit + ses izni)
 * ============================================================ */

export function Splash({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setStage(1), 2000);
    const t2 = window.setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    }, 4000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div className="splash">
      {stage === 0 ? (
        <div key="bymel" className="splash-in px-8 text-center">
          <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-2xl border border-white/15 bg-gradient-to-br from-white/12 to-white/[0.03]">
            <span className="text-4xl">⬢</span>
          </div>
          <h1 className="text-3xl font-black tracking-[0.2em] text-white sm:text-5xl">BYMEL</h1>
          <div className="mt-1 text-[11px] font-black tracking-[0.55em] text-white/45 sm:text-sm">SOFTWARE</div>
          <div className="mx-auto mt-6 h-[2px] w-40 overflow-hidden bg-white/10">
            <div className="splash-bar h-full bg-white/70" />
          </div>
        </div>
      ) : (
        <div key="twin" className="splash-in px-8 text-center">
          <div className="mb-3 text-6xl drop-shadow-[0_6px_20px_rgba(55,242,139,0.35)]">⚽</div>
          <h1 className="text-4xl font-black leading-none tracking-tight sm:text-6xl">
            <span className="text-white">TWIN</span>{" "}
            <span className="bg-gradient-to-b from-emerald-200 via-emerald-400 to-emerald-700 bg-clip-text text-transparent">
              SOCCER
            </span>
          </h1>
          <div className="mt-2 text-[10px] font-black tracking-[0.45em] text-emerald-300/60 sm:text-xs">
            MOBİL FUTBOL DENEYİMİ
          </div>
          <div className="mx-auto mt-6 h-[2px] w-52 overflow-hidden bg-emerald-400/15">
            <div className="splash-bar h-full bg-gradient-to-r from-emerald-300 to-emerald-500" />
          </div>
        </div>
      )}
    </div>
  );
}

/** Tam ekran + yatay yönlendirme dener (mobil tarayıcı izin verirse). */
export async function enterImmersive() {
  try {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    }
  } catch {
    /* tarayıcı izin vermedi — sorun değil */
  }
  try {
    const o = window.screen?.orientation as (ScreenOrientation & { lock?: (s: string) => Promise<void> }) | undefined;
    await o?.lock?.("landscape");
  } catch {
    /* masaüstünde desteklenmiyor */
  }
}

export function StartGate({
  onStart,
  subtitle,
}: {
  onStart: () => void;
  subtitle: string;
}) {
  return (
    <div className="pitch-bg fixed inset-0 z-50 grid place-items-center anim-fade">
      <div className="px-8 text-center">
        <div className="mb-2 text-5xl">⚽</div>
        <h1 className="text-3xl font-black leading-none tracking-tight sm:text-5xl">
          <span className="text-white">TWIN</span>{" "}
          <span className="bg-gradient-to-b from-emerald-200 to-emerald-600 bg-clip-text text-transparent">SOCCER</span>
        </h1>
        <p className="mt-2 text-[10px] font-black tracking-[0.32em] text-white/35">BYMEL SOFTWARE</p>
        <div className="mt-7">
          <Btn
            variant="primary"
            size="lg"
            className="shine w-64"
            onClick={async () => {
              await enterImmersive();
              onStart();
            }}
          >
            DOKUN VE BAŞLA
          </Btn>
        </div>
        <div className="mt-4 text-[10px] leading-relaxed text-white/30">
          Telefonu yatay tut · tam ekran deneyim
          <br />
          {subtitle}
        </div>
      </div>
    </div>
  );
}

/** Dikey moddayken kullanıcıyı yatay çevirmeye yönlendirir. */
export function OrientationGate() {
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth * 1.05 && window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);
  if (!portrait) return null;
  return (
    <div className="pitch-bg fixed inset-0 z-[90] grid place-items-center px-8 text-center">
      <div>
        <div className="anim-rotate-hint mx-auto mb-6 grid h-24 w-16 place-items-center rounded-2xl border-2 border-emerald-300/60 bg-emerald-400/10">
          <span className="text-2xl">📱</span>
        </div>
        <div className="text-lg font-black">TELEFONU YATAY ÇEVİR</div>
        <div className="mt-2 text-xs text-white/45">
          TWIN SOCCER yatay tam ekran oynanır.
          <br />
          Cihazını çevirdiğinde oyun kaldığı yerden devam eder.
        </div>
      </div>
    </div>
  );
}
