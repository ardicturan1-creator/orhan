import React from "react";
import { Btn } from "./ui";

/** Açılış akışı: BYMEL SOFTWARE → TWIN SOCCER → DOKUN VE BAŞLA */

type Stage = "brand" | "title" | "start";

export function Boot({ onStart }: { onStart: () => void }): React.JSX.Element {
  const [stage, setStage] = React.useState<Stage>("brand");
  const [prog, setProg] = React.useState(0);
  const [out, setOut] = React.useState(false);

  React.useEffect(() => {
    const t1 = window.setTimeout(() => {
      setOut(true);
      window.setTimeout(() => { setStage("title"); setOut(false); setProg(0); }, 420);
    }, 2000);
    const iv = window.setInterval(() => setProg((p) => Math.min(1, p + 0.035)), 60);
    return () => { window.clearTimeout(t1); window.clearInterval(iv); };
  }, []);

  React.useEffect(() => {
    if (stage !== "title") return;
    const t1 = window.setTimeout(() => {
      setOut(true);
      window.setTimeout(() => { setStage("start"); setOut(false); }, 420);
    }, 2000);
    return () => window.clearTimeout(t1);
  }, [stage]);

  // Dokun ve başla: tam ekran + yatay kilit + ses izni
  const go = async (): Promise<void> => {
    try {
      const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      }
    } catch { /* yoksay */ }
    try {
      const so = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      if (so && so.lock) await so.lock("landscape");
    } catch { /* yoksay */ }
    onStart();
  };

  return (
    <div className="fixed inset-0 overflow-hidden app-bg flex items-center justify-center select-none">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(900px 420px at 50% 120%, rgba(55,242,139,0.16), transparent 60%), radial-gradient(600px 300px at 15% -10%, rgba(0,140,255,0.14), transparent 60%)",
        }}
      />
      {/* saha çizgisi dokusu */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: "repeating-linear-gradient(100deg, #fff 0 1px, transparent 1px 26px)" }}
      />
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

      {stage === "brand" && (
        <div className={`relative text-center transition-all duration-400 ${out ? "opacity-0 scale-110" : "opacity-100 scale-100"}`}>
          <div className="text-[34px] sm:text-[54px] tsx-title tracking-[0.18em] text-white/95">
            BYMEL
          </div>
          <div className="text-[11px] sm:text-sm tracking-[0.62em] text-emerald-300/80 mt-1 ml-2 font-bold">SOFTWARE</div>
          <div className="mt-7 w-[190px] mx-auto h-[3px] rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-200 transition-all" style={{ width: `${prog * 100}%` }} />
          </div>
          <div className="text-[8px] text-slate-500 mt-2 tracking-[0.3em]">YÜKLENİYOR</div>
        </div>
      )}

      {stage === "title" && (
        <div className={`relative text-center transition-all duration-400 ${out ? "opacity-0 scale-105" : "opacity-100 scale-100 anim-float"}`}>
          <div className="flex items-center justify-center gap-3">
            <span className="text-[38px] sm:text-[56px] leading-none">⚽</span>
            <div className="text-left">
              <div className="text-[38px] sm:text-[66px] tsx-title txt-neon">TWIN</div>
              <div className="text-[38px] sm:text-[66px] tsx-title tracking-[0.13em] text-white/95">SOCCER</div>
            </div>
          </div>
          <div className="mt-4 text-[10px] sm:text-xs tracking-[0.42em] text-slate-300/80 font-bold">MOBİL FUTBOL DENEYİMİ</div>
          <div className="mt-1 text-[8px] tracking-[0.3em] text-slate-500">BYMEL SOFTWARE</div>
        </div>
      )}

      {stage === "start" && (
        <div className="relative text-center anim-pop">
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="text-[28px]">⚽</span>
            <div className="text-left">
              <div className="text-[28px] tsx-title txt-neon">TWIN SOCCER</div>
              <div className="tsx-kicker mt-1">BYMEL SOFTWARE</div>
            </div>
          </div>
          <Btn variant="primary" size="lg" shine onClick={() => void go()} className="!px-9 !py-3 !text-sm">
            DOKUN VE BAŞLA
          </Btn>
          <div className="text-[8px] text-slate-500 mt-4 tracking-[0.2em]">
            TAM EKRAN + YATAY KİLİT + SES İZNİ
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-0 right-0 text-center text-[8px] text-slate-600 tracking-[0.28em]">
        © BYMEL SOFTWARE · TÜM HAKLARI SAKLIDIR
      </div>
    </div>
  );
}

/** Dikey mod uyarısı — telefonu yatay çevir. */
export function RotateWarning(): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-[999] bg-[#04070d] flex flex-col items-center justify-center gap-5 text-center px-6">
      <div className="anim-rotate text-[64px] leading-none">📱</div>
      <div className="text-lg font-black txt-neon tracking-wide">TELEFONU YATAY ÇEVİR</div>
      <div className="text-[11px] text-slate-400 max-w-[260px]">
        TWIN SOCCER yatay (landscape) modda oynanır. Cihazını yatay çevirdiğinde oyun otomatik olarak devam eder.
      </div>
      <div className="flex gap-1.5 mt-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 animate-pulse" style={{ animationDelay: `${i * 0.14}s` }} />
        ))}
      </div>
    </div>
  );
}

export function useIsPortrait(): boolean {
  const [p, setP] = React.useState(() => (typeof window === "undefined" ? false : window.innerHeight > window.innerWidth));
  React.useEffect(() => {
    const f = () => setP(window.innerHeight > window.innerWidth);
    window.addEventListener("resize", f);
    window.addEventListener("orientationchange", f);
    return () => { window.removeEventListener("resize", f); window.removeEventListener("orientationchange", f); };
  }, []);
  return p;
}
