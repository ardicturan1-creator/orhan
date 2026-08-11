(function (root, factory) {
  var api = factory();
  root.NRCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function invLerp(a, b, value) { return a === b ? 0 : clamp((value - a) / (b - a), 0, 1); }
  function distanceSquared(ax, az, bx, bz) { var x = ax - bx; var z = az - bz; return x * x + z * z; }
  function formatTime(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    var mins = Math.floor(seconds / 60);
    var secs = seconds % 60;
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }
  function formatNumber(value) {
    var num = Math.max(0, Math.floor(Number(value) || 0));
    if (num >= 1000000) return (num / 1000000).toFixed(num >= 10000000 ? 0 : 1).replace('.0', '') + 'M';
    if (num >= 10000) return (num / 1000).toFixed(num >= 100000 ? 0 : 1).replace('.0', '') + 'K';
    return num.toLocaleString('tr-TR');
  }
  function dayKey(date) {
    date = date || new Date();
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function hashString(input) {
    var hash = 2166136261;
    for (var i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  function seededRandom(seed) {
    var state = seed >>> 0;
    return function () {
      state += 0x6D2B79F5;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(items, random) {
    var copy = items.slice();
    random = random || Math.random;
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(random() * (i + 1));
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  }
  function todayMissions(key) {
    var random = seededRandom(hashString(key || dayKey()));
    var pool = [
      { id: 'kills', title: 'Rift Temizliği', detail: '75 düşman yok et', target: 75, reward: 350, type: 'gold' },
      { id: 'survive', title: 'Dayanıklı Pilot', detail: 'Toplam 180 sn hayatta kal', target: 180, reward: 450, type: 'gold' },
      { id: 'coins', title: 'Neon Avcısı', detail: '500 altın topla', target: 500, reward: 3, type: 'gems' },
      { id: 'dash', title: 'Akış Kırıcı', detail: '30 kez dash kullan', target: 30, reward: 300, type: 'gold' },
      { id: 'boss', title: 'Titan Düştü', detail: '1 Rift Titan yen', target: 1, reward: 5, type: 'gems' },
      { id: 'commander', title: 'Komuta Zinciri', detail: '1 BYMEL COMMANDER yen', target: 1, reward: 9, type: 'gems' },
      { id: 'elite', title: 'Elit Avı', detail: '20 elit düşman yok et', target: 20, reward: 520, type: 'gold' }
    ];
    return shuffle(pool, random).slice(0, 3).map(function (mission) {
      return Object.assign({}, mission, { progress: 0, claimed: false });
    });
  }
  function defaultSave() {
    var today = dayKey();
    return {
      schema: 2,
      gold: 600,
      gems: 18,
      pilotXp: 0,
      highScore: 0,
      totalRuns: 0,
      totalKills: 0,
      totalBosses: 0,
      commanderKills: 0,
      bestWave: 1,
      bestCombo: 1,
      streak: 1,
      lastOpenDay: today,
      missionsDay: today,
      missions: todayMissions(today),
      permanent: { power: 0, armor: 0, fortune: 0, reactor: 0 },
      achievements: { titanSlayer: false, commanderDown: false, comboMaster: false, waveTen: false },
      ownedSkins: ['cyan'],
      equippedSkin: 'cyan',
      starterOwned: false,
      processedPurchaseTokens: [],
      adProgress: 0,
      adRewardsClaimed: 0,
      settings: { music: true, sfx: true, haptics: true, quality: 'auto', fps: false }
    };
  }
  function mergeSave(raw) {
    var base = defaultSave();
    if (!raw || typeof raw !== 'object') return base;
    Object.keys(base).forEach(function (key) {
      if (raw[key] !== undefined) base[key] = raw[key];
    });
    base.permanent = Object.assign({ power: 0, armor: 0, fortune: 0, reactor: 0 }, raw.permanent || {});
    base.achievements = Object.assign({ titanSlayer: false, commanderDown: false, comboMaster: false, waveTen: false }, raw.achievements || {});
    base.settings = Object.assign({ music: true, sfx: true, haptics: true, quality: 'auto', fps: false }, raw.settings || {});
    base.ownedSkins = Array.isArray(raw.ownedSkins) && raw.ownedSkins.length ? raw.ownedSkins : ['cyan'];
    base.processedPurchaseTokens = Array.isArray(raw.processedPurchaseTokens) ? raw.processedPurchaseTokens.slice(-30) : [];
    if (base.ownedSkins.indexOf(base.equippedSkin) < 0) base.equippedSkin = base.ownedSkins[0];
    base.schema = 2;
    base.gold = clamp(Math.floor(Number(base.gold) || 0), 0, 2000000000);
    base.gems = clamp(Math.floor(Number(base.gems) || 0), 0, 2000000000);
    base.commanderKills = Math.max(0, Math.floor(Number(base.commanderKills) || 0));
    base.totalBosses = Math.max(0, Math.floor(Number(base.totalBosses) || 0));
    base.bestWave = Math.max(1, Math.floor(Number(base.bestWave) || 1));
    base.bestCombo = Math.max(1, Math.floor(Number(base.bestCombo) || 1));
    base.adProgress = clamp(Math.floor(Number(base.adProgress) || 0), 0, 100);
    base.adRewardsClaimed = Math.max(0, Math.floor(Number(base.adRewardsClaimed) || 0));
    Object.keys(base.permanent).forEach(function (key) { base.permanent[key] = clamp(Math.floor(Number(base.permanent[key]) || 0), 0, 10); });
    return base;
  }
  function refreshDaily(save, now) {
    now = now || new Date();
    var today = dayKey(now);
    if (save.lastOpenDay !== today) {
      var previous = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      save.streak = save.lastOpenDay === dayKey(previous) ? Math.min(30, (save.streak || 0) + 1) : 1;
      save.lastOpenDay = today;
    }
    if (save.missionsDay !== today) {
      save.missionsDay = today;
      save.missions = todayMissions(today);
    }
    return save;
  }
  function missionProgress(save, id, amount) {
    if (!Array.isArray(save.missions)) return false;
    var changed = false;
    save.missions.forEach(function (mission) {
      if (mission.id === id && !mission.claimed) {
        var next = clamp((mission.progress || 0) + amount, 0, mission.target);
        changed = changed || next !== mission.progress;
        mission.progress = next;
      }
    });
    return changed;
  }
  function calculateScore(run) {
    var base = (run.kills || 0) * 120 + (run.coins || 0) * 8 + Math.floor((run.elapsed || 0) * 45);
    return Math.floor(base * (1 + Math.min(2, (run.maxCombo || 1) * 0.025)) + (run.bosses || 0) * 5000 + (run.commanders || 0) * 12000 + (run.elites || 0) * 180);
  }
  function upgradeCost(level, base) { return Math.floor((base || 400) * Math.pow(1.62, Math.max(0, level))); }

  return {
    clamp: clamp,
    lerp: lerp,
    invLerp: invLerp,
    distanceSquared: distanceSquared,
    formatTime: formatTime,
    formatNumber: formatNumber,
    dayKey: dayKey,
    hashString: hashString,
    seededRandom: seededRandom,
    shuffle: shuffle,
    todayMissions: todayMissions,
    defaultSave: defaultSave,
    mergeSave: mergeSave,
    refreshDaily: refreshDaily,
    missionProgress: missionProgress,
    calculateScore: calculateScore,
    upgradeCost: upgradeCost
  };
}));
