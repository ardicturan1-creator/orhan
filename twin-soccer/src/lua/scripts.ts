/* ============================================================
 *  BYMEL SOCCER — Lua oyun beyni
 *  Taktik ayarları, piyasa değerlemesi, maç simülasyonu,
 *  topa sahip oyuncu kararları ve spiker replikleri burada.
 * ============================================================ */

export const LUA_GAME_BRAIN = `
-- ================= BYMEL SOCCER :: GAME BRAIN (Lua) =================

local function clamp(v, a, b)
  if v < a then return a end
  if v > b then return b end
  return v
end

-- 1) TAKTİK BEYNİ ------------------------------------------------
-- c = { min, scoreDiff, ratingDiff, stamina, mentality, pressing, tempo, width, line }
function tactics(c)
  local press = 38 + c.pressing * 0.5
  local line  = 30 + c.line * 0.45
  local width = 40 + c.width * 0.4
  local tempo = 40 + c.tempo * 0.5
  local push  = 4 + (c.mentality - 50) * 0.5
  local risk  = 0.35

  -- Geriye düşen takım hücuma çıkar
  if c.scoreDiff < 0 then
    local late = 0
    if c.min > 60 then late = (c.min - 60) / 30 end
    push  = 10 + (-c.scoreDiff) * 4 + late * 12
    press = press + 14
    tempo = tempo + 10
    risk  = 0.7
  elseif c.scoreDiff == 0 and c.min > 55 then
    -- golsüz geçen maçta iki takım da riske girer
    push = push + 6 + (c.min - 55) * 0.25
    tempo = tempo + 8
    risk = 0.5
  elseif c.scoreDiff > 0 then
    push = push - 6
    if c.min > 70 then
      push  = push - 10
      line  = line - 12
      tempo = tempo - 12
      risk  = 0.15
    end
  end

  -- Güçlü rakibe karşı temkinli oyna
  if c.ratingDiff < -3 then
    press = press - 8
    line  = line - 8
    push  = push - 5
  elseif c.ratingDiff > 3 then
    press = press + 6
    line  = line + 6
  end

  -- Yorgun takım presi bırakır
  if c.stamina < 60 then press = press - 14 end
  if c.stamina < 45 then press = press - 10; line = line - 6 end

  return {
    press = clamp(press, 10, 100),
    line  = clamp(line, 5, 95),
    width = clamp(width, 10, 95),
    tempo = clamp(tempo, 10, 100),
    push  = clamp(push, -22, 34),
    risk  = risk
  }
end

-- 2) PİYASA DEĞERİ ------------------------------------------------
function market_value(ovr, age, pos)
  local base = math.pow(ovr / 60, 5.4) * 900
  local peak = 1.0
  if age <= 20 then
    peak = 1.35
  elseif age <= 24 then
    peak = 1.55
  elseif age <= 28 then
    peak = 1.4
  elseif age <= 31 then
    peak = 1.0
  elseif age <= 33 then
    peak = 0.6
  else
    peak = 0.28
  end
  local posMul = 1.0
  if pos == "ST" or pos == "LW" or pos == "RW" then posMul = 1.22 end
  if pos == "AM" then posMul = 1.12 end
  if pos == "GK" then posMul = 0.8 end
  if pos == "LB" or pos == "RB" then posMul = 0.92 end
  local v = base * peak * posMul
  if v < 60 then v = 60 end
  return math.floor(v)
end

-- 3) HAFTA SONU MAÇ SİMÜLASYONU ----------------------------------
local function poisson(lam)
  local L = math.exp(-lam)
  local k = 0
  local p = 1.0
  repeat
    k = k + 1
    p = p * math.random()
  until p <= L
  return k - 1
end

function sim_match(hr, ar, homeAdv)
  local d = (hr - ar) / 11.0
  local hexp = clamp(1.35 + d * 0.85 + homeAdv * 0.28, 0.25, 4.2)
  local aexp = clamp(1.12 - d * 0.85, 0.18, 3.8)
  local hg = poisson(hexp)
  local ag = poisson(aexp)
  if hg > 7 then hg = 7 end
  if ag > 7 then ag = 7 end
  return { hg = hg, ag = ag }
end

-- 4) TOPA SAHİP CPU KARARI ---------------------------------------
function onball_decision(c)
  local shootScore = -25
  if c.dist < 32 then shootScore = (32 - c.dist) * 2.6 end
  if c.dist < 24 then shootScore = shootScore + 10 end
  if c.dist < 15 then shootScore = shootScore + 18 end
  if c.inBox then shootScore = shootScore + 38 end
  shootScore = shootScore + (c.sho - 62) * 0.55 - c.pressure * 22

  local passScore = 22 + (c.pas - 62) * 0.5 + c.open * 24 - c.pressure * 14
  if c.passOptions < 2 then passScore = passScore - 16 end
  if c.mateAhead > 0 then passScore = passScore + c.mateAhead * 4 end

  local dribbleScore = 20 + (c.pac - 62) * 0.22 - c.pressure * 34
  if c.space > 0.5 then dribbleScore = dribbleScore + 16 end

  local clearScore = -18 + c.pressure * 46
  if c.dist > 70 then clearScore = clearScore + 26 end

  local best = "dribble"
  local bs = dribbleScore
  if shootScore > bs then best = "shoot"; bs = shootScore end
  if passScore > bs then best = "pass"; bs = passScore end
  if clearScore > bs then best = "clear"; bs = clearScore end
  return best
end

-- 5) SPİKER -------------------------------------------------------
function commentary(kind, name)
  local t = {
    kickoff = {
      "Maç başladı! Tribünler dolu.",
      "Hakem düdüğü çaldı, oyun başlıyor.",
      "Karşılaşma başladı, tempolu bir maç bekleniyor."
    },
    goal = {
      "GOOOL! %s ağları havalandırdı!",
      "Muhteşem! %s kaleciyi çaresiz bıraktı!",
      "%s bitirdi, tribünler ayakta!",
      "Skor değişti! %s soğukkanlı bir vuruş yaptı.",
      "İnanılmaz bir gol! %s adını skora yazdırdı!"
    },
    save = {
      "Kaleci harika kurtardı!",
      "Muhteşem refleks! %s golü çıkardı!",
      "Elinin ucuyla çeldi, gol olmadı!"
    },
    miss = {
      "Az farkla dışarı! Büyük fırsat kaçtı.",
      "Kaleyi bulamadı, %s üzgün.",
      "Nasıl kaçırdı?! Tribünler ayaklandı."
    },
    foul = {
      "Sert müdahale, hakem faul verdi.",
      "Orta sahada faul, oyun durdu.",
      "Rakip yerde kaldı, serbest vuruş."
    },
    tackle = {
      "Temiz bir top kapma!",
      "%s topu kaptı, hızlı çıkış!",
      "Müdahale zamanlaması mükemmel."
    },
    corner = { "Korner vuruşu." },
    chance = {
      "Tehlikeli bir bölgede top!",
      "Konum atışı, savunma ayakta!",
      "%s ile büyük fırsat doğuyor!"
    }
  }
  local arr = t[kind]
  if arr == nil then return "" end
  local line = arr[math.random(1, #arr)]
  if name == nil or name == "" then
    return line:gsub("%%s", "")
  end
  return string.format(line, name)
end

-- 6) GELİŞİM / EKONOMİ -------------------------------------------
function training_gain(age, ovr, minutes)
  local base = 0.55
  if age <= 19 then base = 1.5 elseif age <= 22 then base = 1.15
  elseif age <= 26 then base = 0.7 elseif age <= 30 then base = 0.35
  else base = 0.08 end
  if ovr > 82 then base = base * 0.45 end
  local m = minutes / 90.0
  return base * (0.35 + m)
end

function prize_money(pos, size)
  local base = 2400
  if pos == 1 then base = 16000 elseif pos == 2 then base = 10500
  elseif pos == 3 then base = 8000 elseif pos <= 6 then base = 5200
  elseif pos <= 10 then base = 3200 else base = 1800 end
  return math.floor(base * (size / 14.0))
end

function cpu_sub(min, stamina, diff)
  if min < 58 then return false end
  if stamina < 62 then return true end
  if diff < 0 and min > 70 then return true end
  return false
end

-- 7) MAÇ SONU MOD TAHMİNİ (man of the match) ---------------------
function motm_score(goals, assists, rating, tackles, passes)
  return goals * 3.1 + assists * 1.9 + (rating - 6) * 2.2 + tackles * 0.22 + passes * 0.012
end
`;
