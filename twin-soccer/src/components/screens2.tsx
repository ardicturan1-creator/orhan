import { useMemo, useState } from "react";
import { CLUB_MAP } from "../game/data/clubs";
import { overall } from "../game/formations";
import {
  askingPrice, buyPlayer, contractDemand, expiringPlayers, freeAgents,
  generateMarket, renewContract, sellPlayer, sellPrice, signFreeAgent,
} from "../game/career";
import {
  MANAGER_SKILLS, MAX_LEVEL, MAX_SKILL, SHOP_ITEMS, STADIUM_PARTS, addXp, bonusesOf,
  buySkillPoint, canAfford, payFor, skillPointDiamonds, spendSkillPoint, stadiumCapacity,
  upgradeDiamonds, upgradeGold, upgradeStadium, xpForLevel,
} from "../game/economy";
import { Bar, Btn, Card, Crest, LevelDots, OvrBadge, SectionTitle, Sheet, Tabs, cx, money } from "./ui";
import { FaceChip, Page, PlayerRow, type ScreenProps } from "./screens";
import type { ManagerSkill, Player, StadiumPart } from "../game/types";
import { clamp } from "../game/rng";

/* ============================ TRANSFER ============================ */
export function TransferScreen(p: ScreenProps) {
  const { career, world } = p;
  const [tab, setTab] = useState<"market" | "free" | "sell">("market");
  const [pos, setPos] = useState<string>("ALL");
  const [sel, setSel] = useState<string | null>(null);
  if (!career) return null;

  const squad = Object.values(world.players).filter((x) => x.teamId === career.clubId);
  const market = career.market
    .map((id) => world.players[id])
    .filter((x): x is Player => Boolean(x) && x.teamId !== career.clubId && x.teamId !== "RET");
  const frees = freeAgents(world);
  const filt = (arr: Player[]) =>
    (pos === "ALL" ? arr : arr.filter((x) => x.pos === pos)).slice(0, 60);

  const wageTotal = squad.reduce((a, x) => a + x.wage, 0);

  const refreshMarket = () => {
    const cost = 700;
    if (career.gold < cost) return p.toast("700 altın gerekiyor.");
    career.gold -= cost;
    career.market = generateMarket(world, Date.now() % 100000, bonusesOf(career).scoutQuality);
    addXp(career, 25);
    p.setCareer({ ...career });
    p.toast("Gözlemciler yeni isimler getirdi 🔎");
  };

  return (
    <Page
      title="Transfer Merkezi"
      sub={`Bütçe ${money(career.budget)} · Haftalık maaş ${money(wageTotal)}`}
      onBack={() => p.go("home")}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <Tabs
            tabs={[
              { id: "market" as const, label: "PİYASA" },
              { id: "free" as const, label: `BONSERVİSSİZ (${frees.length})` },
              { id: "sell" as const, label: "SAT" },
            ]}
            active={tab}
            onChange={setTab}
          />
        </div>
        {tab === "market" && (
          <Btn size="sm" variant="gold" onClick={refreshMarket}>
            🔎 Listeyi Yenile · 700🪙
          </Btn>
        )}
      </div>

      <div className="mb-3 flex gap-1 scroll-x">
        {["ALL", "GK", "CB", "LB", "RB", "DM", "CM", "AM", "LM", "RM", "LW", "RW", "ST"].map((x) => (
          <button
            key={x}
            onClick={() => setPos(x)}
            className={cx(
              "btn-press shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-black",
              pos === x ? "bg-emerald-400 text-emerald-950" : "bg-white/6 text-white/50"
            )}
          >
            {x === "ALL" ? "TÜMÜ" : x}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
        {tab === "sell"
          ? filt(squad).map((x) => (
              <PlayerRow
                key={x.id}
                player={x}
                onClick={() => setSel(x.id)}
                right={<span className="shrink-0 text-[10px] font-black text-emerald-300">{money(sellPrice(x))}</span>}
              />
            ))
          : filt(tab === "market" ? market : frees).map((x) => (
              <PlayerRow
                key={x.id}
                player={x}
                onClick={() => setSel(x.id)}
                right={
                  <span className="shrink-0 text-[10px] font-black text-amber-300">
                    {tab === "free" ? money(contractDemand(x, career, 2).signing) : money(askingPrice(x, career))}
                  </span>
                }
              />
            ))}
      </div>

      <Sheet open={!!sel} onClose={() => setSel(null)} title="Transfer Görüşmesi">
        {sel && world.players[sel] && (
          <TransferDetail
            player={world.players[sel]}
            mode={tab}
            p={p}
            onDone={() => setSel(null)}
          />
        )}
      </Sheet>
    </Page>
  );
}

function TransferDetail({
  player,
  mode,
  p,
  onDone,
}: {
  player: Player;
  mode: "market" | "free" | "sell";
  p: ScreenProps;
  onDone: () => void;
}) {
  const career = p.career!;
  const world = p.world;
  const price = mode === "sell" ? sellPrice(player) : askingPrice(player, career);
  const demand = contractDemand(player, career, 3);
  const bon = bonusesOf(career);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <OvrBadge value={overall(player)} size={52} pos={player.pos} />
        <FaceChip player={player} size={46} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-black">{player.name}</div>
          <div className="text-[11px] text-white/45">
            {player.nat} · {player.age} yaş · {CLUB_MAP[player.teamId]?.name ?? "Serbest"}
          </div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-[10px]">
        {([["Bonservis", money(price)], ["Maaş", `${money(demand.wage)}/hf`], ["Form", Math.round(player.form)]] as [string, string | number][]).map(
          ([l, v]) => (
            <div key={l} className="rounded-xl bg-white/5 p-2">
              <div className="text-white/40">{l}</div>
              <div className="text-xs font-black">{v}</div>
            </div>
          )
        )}
      </div>

      <div className="mb-3 space-y-1.5">
        {([["Hız", player.pac], ["Şut", player.sho], ["Pas", player.pas], ["Sav.", player.def], ["Fizik", player.phy]] as [string, number][]).map(
          ([l, v]) => (
            <div key={l} className="flex items-center gap-2">
              <span className="w-12 text-[10px] font-bold text-white/50">{l}</span>
              <div className="flex-1"><Bar value={v} height={5} /></div>
              <span className="w-6 text-right text-[11px] font-black tabnum">{v}</span>
            </div>
          )
        )}
      </div>

      {mode !== "sell" && bon.transferCost < 1 && (
        <div className="mb-2 rounded-lg bg-emerald-400/10 px-2 py-1.5 text-[10px] text-emerald-300">
          🤝 Pazarlık yeteneğin bonservisi %{Math.round((1 - bon.transferCost) * 100)} düşürdü.
        </div>
      )}

      <div className="flex gap-2">
        {mode === "sell" ? (
          <Btn
            variant="danger"
            className="flex-1"
            onClick={() => {
              const r = sellPlayer(world, career, player.id);
              p.toast(r.msg);
              if (r.ok) {
                p.setCareer({ ...career });
                p.setWorld({ ...world });
                onDone();
              }
            }}
          >
            {money(price)} karşılığı SAT
          </Btn>
        ) : mode === "free" ? (
          <Btn
            variant="gold"
            className="flex-1"
            onClick={() => {
              const r = signFreeAgent(world, career, player.id, 3);
              p.toast(r.msg);
              if (r.ok) {
                p.setCareer({ ...career });
                p.setWorld({ ...world });
                onDone();
              }
            }}
          >
            BONSERVİSSİZ İMZALA
          </Btn>
        ) : (
          <Btn
            variant="primary"
            className="flex-1"
            disabled={career.budget < price}
            onClick={() => {
              const r = buyPlayer(world, career, player.id);
              p.toast(r.msg);
              if (r.ok) {
                p.setCareer({ ...career });
                p.setWorld({ ...world });
                onDone();
              }
            }}
          >
            {career.budget < price ? "BÜTÇE YETERSİZ" : `${money(price)} TEKLİF ET`}
          </Btn>
        )}
        <Btn variant="dark" onClick={onDone}>Kapat</Btn>
      </div>
    </div>
  );
}

/* ============================ SÖZLEŞMELER ============================ */
export function ContractsScreen(p: ScreenProps) {
  const { career, world } = p;
  const [sel, setSel] = useState<string | null>(null);
  const [years, setYears] = useState(3);
  const [boost, setBoost] = useState(0);
  if (!career) return null;
  const squad = Object.values(world.players)
    .filter((x) => x.teamId === career.clubId)
    .sort((a, b) => a.contract - b.contract || overall(b) - overall(a));
  const expiring = expiringPlayers(world, career);
  const wageTotal = squad.reduce((a, x) => a + x.wage, 0);
  const player = sel ? world.players[sel] : null;
  const offer = player ? contractDemand(player, career, years) : null;

  return (
    <Page
      title="Sözleşme Yönetimi"
      sub={`Haftalık maaş yükü ${money(wageTotal)} · ${expiring.length} oyuncunun süresi doluyor`}
      onBack={() => p.go("home")}
    >
      {expiring.length > 0 && (
        <Card hi className="mb-3">
          <SectionTitle>⚠️ ACİL — SÖZLEŞMESİ BİTİYOR</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {expiring.map((x) => (
              <PlayerRow
                key={x.id}
                player={x}
                onClick={() => {
                  setSel(x.id);
                  setYears(3);
                  setBoost(0);
                }}
                right={
                  <span className="shrink-0 rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-black text-rose-300">
                    {x.contract === 0 ? "BİTTİ" : `${x.contract} YIL`}
                  </span>
                }
              />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>TÜM KADRO</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {squad.map((x) => (
            <PlayerRow
              key={x.id}
              player={x}
              onClick={() => {
                setSel(x.id);
                setYears(3);
                setBoost(0);
              }}
              right={
                <div className="shrink-0 text-right">
                  <div className="text-[10px] font-black text-white/70">{money(x.wage)}</div>
                  <div className={cx("text-[9px] font-black", x.contract <= 1 ? "text-rose-300" : "text-white/35")}>
                    {x.contract} yıl
                  </div>
                </div>
              }
            />
          ))}
        </div>
      </Card>

      <Sheet open={!!player} onClose={() => setSel(null)} title="Sözleşme Görüşmesi">
        {player && offer && (
          <div>
            <div className="mb-3 flex items-center gap-3">
              <OvrBadge value={overall(player)} size={50} pos={player.pos} />
              <FaceChip player={player} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-black">{player.name}</div>
                <div className="text-[11px] text-white/45">
                  {player.age} yaş · Mevcut maaş {money(player.wage)}/hf · Kalan {player.contract} yıl
                </div>
              </div>
            </div>

            <SectionTitle>SÜRE</SectionTitle>
            <div className="mb-3 flex gap-2">
              {[1, 2, 3, 4, 5].map((y) => (
                <button
                  key={y}
                  onClick={() => setYears(y)}
                  className={cx(
                    "btn-press flex-1 rounded-xl py-2 text-xs font-black",
                    years === y ? "bg-emerald-400 text-emerald-950" : "bg-white/6 text-white/55"
                  )}
                >
                  {y} yıl
                </button>
              ))}
            </div>

            <SectionTitle>EK ZAM TEKLİFİ</SectionTitle>
            <input
              type="range"
              min={0}
              max={50}
              value={boost * 100}
              onChange={(e) => setBoost(Number(e.target.value) / 100)}
              className="w-full"
            />
            <div className="mb-3 flex justify-between text-[10px] text-white/45">
              <span>Zam: %{Math.round(boost * 100)}</span>
              <span>Kabul şansı: %{Math.round(clamp(offer.accept + boost * 1.6 + career.manager.skills.negotiation * 0.04, 0.05, 0.99) * 100)}</span>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2 text-center text-[10px]">
              <div className="rounded-xl bg-white/5 p-2">
                <div className="text-white/40">Yeni maaş</div>
                <div className="text-sm font-black text-emerald-300">{money(Math.round(offer.wage * (1 + boost)))}/hf</div>
              </div>
              <div className="rounded-xl bg-white/5 p-2">
                <div className="text-white/40">İmza bedeli</div>
                <div className="text-sm font-black text-amber-300">{money(Math.round(offer.signing * (1 + boost * 0.5)))}</div>
              </div>
            </div>

            <Btn
              variant="primary"
              className="w-full"
              onClick={() => {
                const r = renewContract(world, career, player.id, years, boost);
                p.toast(r.msg);
                p.setCareer({ ...career });
                p.setWorld({ ...world });
                if (r.ok) setSel(null);
              }}
            >
              SÖZLEŞME UZAT
            </Btn>
          </div>
        )}
      </Sheet>
    </Page>
  );
}

/* ============================ STADYUM ============================ */
export function StadiumScreen(p: ScreenProps) {
  const { career } = p;
  if (!career) return null;
  const club = CLUB_MAP[career.clubId];
  const st = career.stadium;

  return (
    <Page
      title="Stadyum Geliştirme"
      sub={`${st.name} · Kapasite ${stadiumCapacity(st).toLocaleString("tr-TR")}`}
      onBack={() => p.go("home")}
    >
      {/* stadyum önizleme */}
      <div className="panel-hi mb-3 overflow-hidden rounded-2xl p-3">
        <div className="flex items-center gap-3">
          <Crest club={club} size={46} />
          <div className="flex-1">
            <div className="text-sm font-black">{st.name}</div>
            <div className="text-[10px] text-white/45">
              Ortalama seviye {Math.round(Object.values(st.levels).reduce((a, b) => a + b, 0) / 6)} · {club.city}
            </div>
          </div>
        </div>
        <StadiumPreview levels={st.levels} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
        {STADIUM_PARTS.map((part) => {
          const lv = st.levels[part.id];
          const g = upgradeGold(lv);
          const d = upgradeDiamonds(lv);
          const maxed = lv >= MAX_LEVEL;
          const afford = career.gold >= g && career.diamonds >= d;
          return (
            <Card key={part.id} className={cx(maxed && "opacity-80")}>
              <div className="mb-2 flex items-center gap-2">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/8 text-lg">{part.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-black">{part.name}</div>
                  <div className="text-[9px] text-white/40">{part.desc}</div>
                </div>
                <div className="shrink-0 rounded-lg bg-emerald-400/15 px-2 py-0.5 text-[11px] font-black text-emerald-300">
                  Sv.{lv}
                </div>
              </div>
              <LevelDots level={lv} max={MAX_LEVEL} />
              <div className="mt-2 rounded-lg bg-white/4 px-2 py-1.5 text-[10px] text-white/60">
                {part.effect(lv)}
              </div>
              {!maxed && (
                <div className="mt-2 rounded-lg bg-emerald-400/8 px-2 py-1 text-[9px] text-emerald-200/70">
                  Sonraki: {part.effect(lv + 1)}
                </div>
              )}
              <Btn
                variant={maxed ? "dark" : afford ? "gold" : "dark"}
                size="sm"
                className="mt-2 w-full"
                disabled={maxed || !afford}
                onClick={() => {
                  const r = upgradeStadium(career, part.id as StadiumPart);
                  p.toast(r.msg);
                  if (r.ok) {
                    const objDone = career.objectives.find((o) => o.id === "upgrade2");
                    if (objDone && !objDone.claimed) objDone.progress = Math.min(objDone.goal, objDone.progress + 1);
                    p.setCareer({ ...career });
                  }
                }}
              >
                {maxed ? "MAKSİMUM" : (
                  <span className="flex items-center gap-1.5">
                    YÜKSELT <span className="text-amber-900">🪙{g}</span>
                    {d > 0 && <span className="text-sky-900">💎{d}</span>}
                  </span>
                )}
              </Btn>
            </Card>
          );
        })}
      </div>
    </Page>
  );
}

function StadiumPreview({ levels }: { levels: Record<StadiumPart, number> }) {
  const tiers = clamp(levels.stands, 1, 8);
  const lights = levels.lights;
  const rings = Array.from({ length: tiers }, (_, i) => tiers - i); // dıştan içe
  return (
    <div className="relative mt-3 h-36 overflow-hidden rounded-xl bg-gradient-to-b from-[#0b1826] via-[#081320] to-[#04080d]">
      {/* tribün kâsesi */}
      {rings.map((k) => (
        <div
          key={k}
          className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
          style={{
            width: `${34 + k * 7.5}%`,
            height: `${34 + k * 8.5}%`,
            background: `rgb(${14 + k * 6},${26 + k * 7},${22 + k * 6})`,
            boxShadow: "inset 0 2px 0 rgba(255,255,255,0.06), 0 2px 8px -4px rgba(0,0,0,0.8)",
          }}
        />
      ))}
      {/* seyirci dokusu */}
      <div
        className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] opacity-45"
        style={{
          width: `${34 + tiers * 7.5}%`,
          height: `${34 + tiers * 8.5}%`,
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.5) 0.5px, transparent 0.6px)",
          backgroundSize: "5px 5px",
        }}
      />
      {/* saha */}
      <div
        className="absolute left-1/2 top-[54%] h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-white/25"
        style={{ background: "repeating-linear-gradient(90deg,#1d8347 0 7px,#17703c 7px 14px)" }}
      />
      {/* ışık kuleleri */}
      {[10, 90].map((x) => (
        <div key={x} className="absolute bottom-4" style={{ left: `${x}%` }}>
          <div className="mx-auto w-0.5 bg-white/25" style={{ height: 40 + lights * 3 }} />
          <div
            className="absolute left-1/2 h-2 -translate-x-1/2 rounded-sm"
            style={{
              top: -2,
              width: 12 + lights * 2.5,
              background: `rgba(255,250,225,${0.35 + lights * 0.07})`,
              boxShadow: `0 0 ${10 + lights * 4}px rgba(255,250,220,${0.25 + lights * 0.07})`,
            }}
          />
        </div>
      ))}
      {levels.screen > 1 && (
        <div className="absolute right-3 top-2 grid h-7 w-14 place-items-center rounded border border-white/25 bg-black/75 text-[8px] font-black text-emerald-300">
          TWIN TV
        </div>
      )}
      <div className="absolute bottom-1.5 left-3 text-[9px] font-black text-white/40">
        TRİBÜN Sv.{tiers} · IŞIK Sv.{lights}
      </div>
    </div>
  );
}

/* ============================ MENAJER ============================ */
export function ManagerScreen(p: ScreenProps) {
  const { career } = p;
  if (!career) return null;
  const m = career.manager;
  const bon = bonusesOf(career);
  const need = xpForLevel(m.level);

  return (
    <Page
      title="Menajer Gelişimi"
      sub={`Seviye ${m.level} · İtibar ${m.reputation}`}
      onBack={() => p.go("home")}
    >
      <div className="grid gap-3 md:grid-cols-[1fr_1.6fr]">
        <div className="space-y-3">
          <Card hi>
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400/35 to-sky-400/10 text-2xl">
                🧠
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black">{m.name}</div>
                <div className="text-[10px] text-white/45">
                  {CLUB_MAP[career.clubId].name} · {career.played} maç
                </div>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-400/20 text-lg font-black text-emerald-300">
                {m.level}
              </div>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[10px] font-bold text-white/45">
                <span>TECRÜBE</span>
                <span className="tabnum">{m.xp} / {need}</span>
              </div>
              <Bar value={(m.xp / need) * 100} height={6} />
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 p-2">
              <div>
                <div className="text-[10px] text-white/40">Yetenek puanı</div>
                <div className="text-lg font-black text-amber-300">{m.points}</div>
              </div>
              <Btn
                size="sm"
                variant="diamond"
                disabled={career.diamonds < skillPointDiamonds}
                onClick={() => {
                  const r = buySkillPoint(career);
                  p.toast(r.msg);
                  p.setCareer({ ...career });
                }}
              >
                💎{skillPointDiamonds} · PUAN AL
              </Btn>
            </div>
          </Card>

          <Card>
            <SectionTitle>AKTİF BONUSLAR</SectionTitle>
            <div className="space-y-1 text-[10px]">
              {([
                ["Takım gücü", `+${bon.teamBoost.toFixed(1)} OVR`],
                ["Gelişim hızı", `×${bon.growth.toFixed(2)}`],
                ["Transfer bedeli", `×${bon.transferCost.toFixed(2)}`],
                ["Kondisyon kaybı", `×${bon.staminaDrain.toFixed(2)}`],
                ["Maç başı altın", `+${Math.round(bon.goldPerMatch)} 🪙`],
                ["Ev sahibi avantajı", `×${bon.homeAdv.toFixed(2)}`],
              ] as [string, string][]).map(([l, v]) => (
                <div key={l} className="flex justify-between rounded-lg bg-white/4 px-2 py-1">
                  <span className="text-white/50">{l}</span>
                  <span className="font-black text-emerald-300">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <SectionTitle right={m.points > 0 ? <span className="anim-pulse text-[10px] font-black text-amber-300">{m.points} PUAN HAZIR</span> : undefined}>
            YETENEK AĞACI
          </SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {MANAGER_SKILLS.map((s) => {
              const lv = m.skills[s.id as ManagerSkill];
              const maxed = lv >= MAX_SKILL;
              return (
                <div key={s.id} className="rounded-xl bg-white/4 p-2.5">
                  <div className="mb-1.5 flex items-center gap-2">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/8">{s.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-black">{s.name}</div>
                      <div className="text-[9px] text-white/40">{s.desc}</div>
                    </div>
                    <span className="shrink-0 text-[11px] font-black text-emerald-300 tabnum">{lv}/{MAX_SKILL}</span>
                  </div>
                  <LevelDots level={lv} max={MAX_SKILL} color="#38bdf8" />
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-emerald-200/70">{s.effect(lv)}</span>
                    <Btn
                      size="xs"
                      variant={maxed || m.points <= 0 ? "dark" : "primary"}
                      disabled={maxed || m.points <= 0}
                      onClick={() => {
                        const r = spendSkillPoint(career, s.id as ManagerSkill);
                        p.toast(r.msg);
                        p.setCareer({ ...career });
                      }}
                    >
                      {maxed ? "MAKS" : "+1"}
                    </Btn>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </Page>
  );
}

/* ============================ MAĞAZA ============================ */
export function ShopScreen(p: ScreenProps) {
  const { career, world } = p;
  if (!career) return null;

  const use = (id: string) => {
    const item = SHOP_ITEMS.find((x) => x.id === id)!;
    if (!canAfford(career, item)) return p.toast("Yeterli bakiyen yok.");
    const squad = Object.values(world.players).filter((x) => x.teamId === career.clubId);
    switch (id) {
      case "g2m_s":
        payFor(career, item);
        career.budget += 2500;
        break;
      case "g2m_l":
        payFor(career, item);
        career.budget += 10000;
        break;
      case "d2g":
        payFor(career, item);
        career.gold += 4000;
        break;
      case "heal":
        payFor(career, item);
        squad.forEach((x) => (x.injury = 0));
        break;
      case "morale":
        payFor(career, item);
        squad.forEach((x) => (x.morale = clamp(x.morale + 25, 20, 100)));
        break;
      case "fitness":
        payFor(career, item);
        squad.forEach((x) => (x.fitness = 100));
        break;
      case "scout":
        payFor(career, item);
        career.market = generateMarket(world, Date.now() % 100000, bonusesOf(career).scoutQuality + 6);
        break;
      case "skill":
        payFor(career, item);
        career.manager.points++;
        break;
      default:
        return;
    }
    addXp(career, 20);
    p.setCareer({ ...career });
    p.setWorld({ ...world });
    p.toast(`${item.name} kullanıldı ✓`);
  };

  return (
    <Page
      title="Kulüp Mağazası"
      sub="Altın ve elmasını kulübünü büyütmek için kullan"
      onBack={() => p.go("home")}
    >
      <Card hi className="mb-3">
        <SectionTitle>EKONOMİ NASIL İŞLER?</SectionTitle>
        <div className="grid gap-2 text-[10px] leading-relaxed text-white/60 sm:grid-cols-3">
          <div className="rounded-xl bg-white/5 p-2">
            <div className="mb-1 font-black text-amber-300">🪙 ALTIN</div>
            Maç geliri, galibiyet primi, gol primi ve görev ödülleriyle kazanılır. Stadyum
            yükseltmelerinde ve mağazada harcanır.
          </div>
          <div className="rounded-xl bg-white/5 p-2">
            <div className="mb-1 font-black text-cyan-300">💎 ELMAS</div>
            Farklı galibiyetler, galibiyet serileri, kupa turları ve seviye atlamalarıyla kazanılır.
            Üst seviye yükseltmeler ve yetenek puanları için gerekir.
          </div>
          <div className="rounded-xl bg-white/5 p-2">
            <div className="mb-1 font-black text-emerald-300">💶 BÜTÇE</div>
            Transfer ve maaşlarda kullanılır. Altınını bütçeye çevirebilir, sezon sonu ödülleriyle
            büyütebilirsin.
          </div>
        </div>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
        {SHOP_ITEMS.map((item) => {
          const ok = canAfford(career, item);
          return (
            <Card key={item.id} className={cx(!ok && "opacity-60")}>
              <div className="mb-2 flex items-center gap-2">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/8 text-xl">{item.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-black">{item.name}</div>
                  <div className="text-[9px] leading-snug text-white/45">{item.desc}</div>
                </div>
              </div>
              <Btn
                size="sm"
                variant={item.costDiamonds ? "diamond" : "gold"}
                className="w-full"
                disabled={!ok}
                onClick={() => use(item.id)}
              >
                {item.costGold ? `🪙 ${item.costGold}` : ""} {item.costDiamonds ? `💎 ${item.costDiamonds}` : ""}
              </Btn>
            </Card>
          );
        })}
      </div>
    </Page>
  );
}

export function useSquadCount(p: ScreenProps) {
  return useMemo(
    () => Object.values(p.world.players).filter((x) => x.teamId === p.career?.clubId).length,
    [p.world, p.career]
  );
}
