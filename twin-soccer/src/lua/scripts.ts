/** Oyun beyni — taktik, piyasa, simülasyon, karar ve spiker betiği (Lua). */

export const LUA_GAME_BRAIN = `
-- ==================================================================
--  TWIN SOCCER GAME BRAIN   (BYMEL SOFTWARE)
--  Taktik motoru, piyasa değerlemesi, maç simülasyonu, topa sahip
--  karar mekanizması, spiker, antrenman, ödül ve MOTM hesabı.
-- ==================================================================

local function cl(v, a, b)
  if v < a then return a end
  if v > b then return b end
  return v
end

local function rpl(s, tok, val)
  if val == nil then val = "" end
  local res = ""
  local i = 1
  local n = string.len(s)
  local m = string.len(tok)
  while i <= n do
    local hit = false
    if i + m - 1 <= n then
      hit = true
      local j = 0
      while j < m do
        if string.sub(s, i + j, i + j) ~= string.sub(tok, j + 1, j + 1) then
          hit = false
        end
        j = j + 1
      end
    end
    if hit then
      res = res .. val
      i = i + m
    else
      res = res .. string.sub(s, i, i)
      i = i + 1
    end
  end
  return res
end

-- ------------------------------------------------------------------
-- 1) TAKTİK MOTORU
--    c.diff = skor farkı (+ önde), c.min = dakika, c.press = taktik pres
--    c.oppStrong = rakip güç oranı(0..1), c.tired = yorgunluk(0..1)
--    c.mentality = taktik hücum seviyesi
-- ------------------------------------------------------------------
function tactics(c)
  local push = c.mentality
  local line = 38
  local width = 52
  local press = c.press
  local tempo = 50
  local risk = 0

  if c.diff < 0 then
    push = push + 9 + (-c.diff) * 4
    line = line + 10
    tempo = tempo + 9
    risk = 1
  elseif c.diff > 0 then
    push = push - 6 - c.diff * 2.2
    line = line - 7
  end

  if c.min > 70 and c.diff > 0 then
    push = push - 7
    line = line - 6
    press = press - 7
  end

  -- SKORSUZ ve 55. dakikadan sonra: iki taraf da riske girer (0-0 kilidi kırılır)
  if c.min > 55 and c.diff == 0 then
    push = push + 13
    line = line + 8
    tempo = tempo + 11
    press = press + 10
    risk = 2
  end

  if c.oppStrong > 0.55 then
    push = push - 5
    line = line - 3
  end

  if c.tired > 0.55 then
    press = press - 12 * c.tired
    tempo = tempo - 6 * c.tired
  end

  return {
    push = cl(push, 8, 96),
    line = cl(line, 16, 84),
    width = cl(width, 26, 78),
    press = cl(press, 8, 96),
    tempo = cl(tempo, 26, 94),
    risk = risk
  }
end

-- ------------------------------------------------------------------
-- 2) PİYASA DEĞERİ (bin €) — yaş eğrisi 24'te zirve, 33+ düşüş
-- ------------------------------------------------------------------
function market_value(ovr, age, pos)
  local base = 4200 * math.pow(ovr / 60, 6.15)
  local ageMul = 1.0
  if age <= 20 then
    ageMul = 1.26
  elseif age <= 23 then
    ageMul = 1.16
  elseif age <= 27 then
    ageMul = 1.0
  elseif age <= 30 then
    ageMul = 0.74
  elseif age <= 32 then
    ageMul = 0.46
  else
    ageMul = 0.21
  end

  local posMul = 1.0
  if pos == "ST" or pos == "LW" or pos == "RW" then
    posMul = 1.22
  elseif pos == "AM" then
    posMul = 1.15
  elseif pos == "CM" then
    posMul = 1.06
  elseif pos == "DM" then
    posMul = 1.0
  elseif pos == "GK" then
    posMul = 0.8
  else
    posMul = 0.97
  end

  return math.max(45, base * ageMul * posMul)
end

-- ------------------------------------------------------------------
-- 3) MAÇ SİMÜLASYONU (Poisson) — hr/ar 63..85, homeAdv 0..1
-- ------------------------------------------------------------------
function sim_match(hr, ar, homeAdv)
  local function pois(lam)
    local L = math.exp(-lam)
    local k = 0
    local p = 1.0
    while true do
      k = k + 1
      p = p * math.random()
      if p <= L then
        return k - 1
      end
      if k > 11 then
        return 11
      end
    end
  end

  local d = (hr - ar) / 20.0
  local lamH = cl(1.34 + d * 0.95 + homeAdv * 0.26, 0.18, 4.6)
  local lamA = cl(1.16 - d * 0.85 + homeAdv * 0.05, 0.16, 4.4)
  local hg = pois(lamH)
  local ag = pois(lamA)
  return { h = hg, a = ag }
end

-- ------------------------------------------------------------------
-- 4) TOPA SAHİP KARAR MEKANİZMASI
-- ------------------------------------------------------------------
function onball_decision(c)
  -- Şut isteği mesafeyle KARESEL düşer: uzaktan şut gerçek futbolda nadirdir.
  local shoot = 0
  if c.dist < 30 then
    local n = 30 - c.dist
    shoot = n * n * 0.09
  end
  if c.inBox == 1 then
    shoot = shoot + 42
  end
  if c.central == 1 then
    shoot = shoot + 10
  end
  shoot = shoot + c.shoot * 24 - c.pressure * 34

  local pass = c.passBest + 10 - c.pressure * 12
  local dribble = 12 + c.dribble * 36 - c.pressure * 34
  local clear = 3

  if c.ownThird == 1 and c.pressure > 0.55 then
    clear = clear + 24 + c.pressure * 42
  end
  if c.dist > 55 and c.pressure > 0.45 then
    clear = clear + 12
  end
  if c.mustRisk == 1 then
    shoot = shoot + 12
    pass = pass + 4
  end

  local act = "pass"
  local best = pass

  if shoot > best then
    best = shoot
    act = "shoot"
  end
  if dribble > best then
    best = dribble
    act = "dribble"
  end
  if clear > best then
    best = clear
    act = "clear"
  end

  local power = 0.62
  if act == "shoot" then
    power = cl(0.58 + (1 - cl(c.dist / 34, 0, 1)) * 0.42, 0.5, 1)
  elseif act == "clear" then
    power = 1
  else
    power = cl(0.4 + c.pressure * 0.3, 0.35, 0.95)
  end

  return { act = act, power = power, score = math.floor(best) }
end

-- ------------------------------------------------------------------
-- 5) SPİKER
-- ------------------------------------------------------------------
local CLINES = {}
CLINES.kickoff = {
  "Ve hakem maçı başlatıyor! %t topu oyuna sokuyor.",
  "Saha hazır, tribünler dolu... maç başladı!",
  "İlk düdük çaldı, %t ile başlıyoruz."
}
CLINES.shotWide = {
  "%p vurdu... az farkla auta gitti!",
  "Büyük şans! %p vuruşunu kaleyi bulamadı.",
  "Dışarı! %p çok üzgün, pozisyon netti."
}
CLINES.shotSaved = {
  "Muhteşem kurtarış! %p boş gole bakıyor.",
  "Kaleci uçtu ve topu çeldi!",
  "Ne refleksti! %p şaşkın bakıyor."
}
CLINES.goal = {
  "GOOOL! %p ağları havalandırıyor!",
  "İnanılmaz! %p bitirdi işi, %t deliriyor!",
  "GOL! %p köşeden fileleri buldu!"
}
CLINES.tackle = {
  "Temiz müdahale, top kazanıldı.",
  "Güzel top kapma, oyun devam ediyor.",
  "Defans ayakta, %p topu kazandı."
}
CLINES.foul = { "Faul! Hakem düdüğü çaldırdı.", "Sert temas var, serbest vuruş." }
CLINES.yellow = { "Sarı kart! %p artık dikkatli olmalı.", "Hakem kart gösteriyor, %p kayıtlarda." }
CLINES.red = { "KIRMIZI KART! %p oyundan atıldı!", "Kırmızı kart! Takım 10 kişi kaldı!" }
CLINES.corner = { "Korner! Ceza sahasında tehlike.", "Köşe vuruşu, orta sahaya yükleniyorlar." }
CLINES.offside = { "Ofsayt! Bayrak havada.", "Ofsayt bayrağı kalktı." }
CLINES.halftime = { "İlk yarı sona erdi.", "Devre arası. Soyunma odasına gidiliyor." }
CLINES.fulltime = { "Ve maç bitiyor! Son düdük çalıyor.", "Maç sona erdi, tribünlerde alkış." }
CLINES.pens = { "Penaltılar! Sinirler tırmanıyor.", "Kaleci ile gole buluşan arasında nefes kesen anlar." }
CLINES.chance = { "%p ceza sahasına giriyor!", "Güzel top, boş alan açıldı...", "Hızlı çıkış geliyor!" }
CLINES.near = { "Direkten döndü! İnanılmaz pozisyon.", "Kalenin dibinden geçti!" }

function commentary(kind, name, team)
  local arr = CLINES[kind]
  if arr == nil then
    return "..."
  end
  local i = math.random(1, #arr)
  local s = arr[i]
  s = rpl(s, "%p", name)
  s = rpl(s, "%t", team)
  return s
end

-- ------------------------------------------------------------------
-- 6) ANTRENMAN GELİŞİMİ (potansiyel puan)
-- ------------------------------------------------------------------
function training_gain(age, ovr, minutes)
  local ageF = 1.0
  if age <= 19 then
    ageF = 1.55
  elseif age <= 22 then
    ageF = 1.3
  elseif age <= 25 then
    ageF = 1.0
  elseif age <= 28 then
    ageF = 0.55
  elseif age <= 31 then
    ageF = 0.24
  else
    ageF = 0.06
  end
  local pot = cl((94 - ovr) / 34, 0.05, 1.0)
  return cl(ageF * pot * (minutes / 90) * 2.35, 0, 6)
end

-- ------------------------------------------------------------------
-- 7) ÖDÜL HESABI (bin €) — pos = lig sırası, size = takım sayısı
-- ------------------------------------------------------------------
function prize_money(pos, size)
  local base = 3200 + size * 210
  local mul = math.pow(1.34, cl(size - pos, 0, size))
  return math.floor(base * mul / 50) * 50
end

-- ------------------------------------------------------------------
-- 8) CPU OTOMATİK OYUNCU DEĞİŞİKLİĞİ
-- ------------------------------------------------------------------
function cpu_sub(minute, stamina, diff)
  if minute < 55 then
    return false
  end
  local thr = 58 - diff * 2
  if minute > 78 then
    thr = thr + 8
  end
  return stamina < thr
end

-- ------------------------------------------------------------------
-- 9) MAÇIN ADAMI PUANI
-- ------------------------------------------------------------------
function motm_score(rating, goals, assists, passes, tackles, saves)
  local s = rating * 1.15 + goals * 22 + assists * 12 + passes * 0.16 + tackles * 0.5 + saves * 3.2
  return s
end
`;
