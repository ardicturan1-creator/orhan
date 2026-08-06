(function () {
  'use strict';

  var C = window.NRCore;
  var CFG = window.NR_CONFIG;
  var THREE = window.THREE;
  var $ = function (id) { return document.getElementById(id); };

  var dom = {};
  var audio = new window.NeonAudio();
  var billing = new window.NeonBilling(CFG);
  var saveStatus = { native: false, code: 'WEB_FALLBACK', storage: 'localStorage', encrypted: false };
  var save = loadSave();
  var mode = 'boot';
  var lastTime = 0;
  var frameAccumulator = 0;
  var frameCount = 0;
  var fps = 60;
  var renderScale = 1;
  var lastScaleChange = 0;
  var toastTimer = 0;
  var objectiveTimer = 0;
  var flashTimer = 0;

  var renderer;
  var scene;
  var camera;
  var clock;
  var arena;
  var grid;
  var stars;
  var playerMesh;
  var playerParts = {};
  var novaRing;
  var sceneReady = false;
  var cameraShake = 0;

  var shared = { geo: {}, mat: {} };
  var enemyPool = [];
  var playerBulletPool = [];
  var enemyBulletPool = [];
  var pickupPool = [];
  var particlePool = [];
  var activeBoss = null;
  var pendingCommander = 0;
  var bossCycle = 0;

  var joystick = { active: false, pointerId: null, x: 0, y: 0 };
  var keys = {};
  var input = { x: 0, y: 0 };
  var lastDirection = { x: 0, z: -1 };
  var spawnTimer = 0;
  var currentWave = 0;
  var run = null;
  var player = null;

  var SKINS = {
    cyan: { id: 'cyan', name: 'Rift Zero', detail: 'Standart neon pilot zırhı', color: 0x35efff, accent: 0x8b65ff, icon: '◇', cost: 0, currency: 'gold' },
    magenta: { id: 'magenta', name: 'Pulse Riot', detail: 'Darbe pembesi özel kaplama', color: 0xff4fd8, accent: 0x835bff, icon: '✦', cost: 28, currency: 'gems' },
    solar: { id: 'solar', name: 'Solar Flare', detail: 'Başlangıç paketine özel', color: 0xffb52e, accent: 0xff4f6d, icon: '☀', cost: 0, currency: 'starter' },
    toxic: { id: 'toxic', name: 'Toxic Byte', detail: 'Asit yeşili veri zırhı', color: 0x5dff8b, accent: 0x00a9a7, icon: '⌁', cost: 7200, currency: 'gold' },
    void: { id: 'void', name: 'Void Crown', detail: 'Titan avcılarına özel görünüm', color: 0x9a6cff, accent: 0x321b78, icon: '♛', cost: 65, currency: 'gems' },
    commander: { id: 'commander', name: 'Command Protocol', detail: 'BYMEL COMMANDER ilk zafer ödülü', color: 0xffd34f, accent: 0x35efff, icon: '⌬', cost: 0, currency: 'achievement' }
  };

  var UPGRADES = [
    { id: 'damage', name: 'Aşırı Yük', desc: 'Hasar +%22', icon: '⚡', max: 8 },
    { id: 'fireRate', name: 'Hızlı Tetik', desc: 'Atış hızı +%16', icon: '»', max: 8 },
    { id: 'multishot', name: 'Çatallı Işın', desc: '+1 mermi; hasar dengelenir', icon: '⋔', max: 3 },
    { id: 'speed', name: 'Akış Botları', desc: 'Hareket hızı +%12', icon: '➤', max: 6 },
    { id: 'health', name: 'Nano Onarım', desc: 'Maks. can +25 ve iyileş', icon: '+', max: 6 },
    { id: 'shield', name: 'Rift Kalkanı', desc: '+35 geçici kalkan', icon: '⬡', max: 5 },
    { id: 'crit', name: 'Kritik Kod', desc: 'Kritik şansı +%8', icon: '✧', max: 5 },
    { id: 'magnet', name: 'Çekim Alanı', desc: 'Toplama menzili +%30', icon: '⊙', max: 5 },
    { id: 'dash', name: 'Faz Kayması', desc: 'Dash bekleme -%14', icon: '↠', max: 5 },
    { id: 'orbital', name: 'Yörünge Bıçağı', desc: 'Etrafında dönen bıçak ekler', icon: '◎', max: 3 },
    { id: 'lifesteal', name: 'Enerji Sifonu', desc: 'Her 12 öldürmede 7 can', icon: '♥', max: 3 },
    { id: 'nova', name: 'Nova Çekirdeği', desc: 'Nova hasarı +%35, bekleme -%8', icon: '✦', max: 5 },
    { id: 'velocity', name: 'Hiper İletken', desc: 'Mermi hızı +%20 ve menzil +%12', icon: '➶', max: 5 },
    { id: 'pierce', name: 'Faz Delici', desc: 'Mermiler +1 hedef deler', icon: '◈', max: 3 },
    { id: 'recovery', name: 'Saha Onarımı', desc: 'Her dalgada 8 can yenile', icon: '✚', max: 4 },
    { id: 'overdrive', name: 'Rift Reaktörü', desc: 'Overdrive dolumu +%22', icon: '∞', max: 5 }
  ];

  var ENEMY_TYPES = {
    drone: { hp: 30, speed: 2.9, damage: 9, scale: .72, color: 0xff496d, xp: 3, coins: 4 },
    runner: { hp: 22, speed: 4.7, damage: 8, scale: .56, color: 0xff9e42, xp: 3, coins: 5 },
    tank: { hp: 105, speed: 1.55, damage: 17, scale: 1.05, color: 0x9f63ff, xp: 8, coins: 12 },
    shooter: { hp: 48, speed: 2.15, damage: 8, scale: .78, color: 0x43a1ff, xp: 6, coins: 8 },
    splitter: { hp: 72, speed: 2.45, damage: 12, scale: .86, color: 0x5dff8b, xp: 9, coins: 11 },
    titan: { hp: 1450, speed: 1.25, damage: 22, scale: 2.25, color: 0xff38c7, xp: 90, coins: 180, boss: true },
    commander: { hp: 6100, speed: 1.6, damage: 33, scale: 2.7, color: 0xffd34f, xp: 260, coins: 480, boss: true }
  };

  function cacheDom() {
    [
      'splash','splashFill','bootStatus','home','hud','pilotLevel','homeGold','homeGems','highScore','streakText','missionBadge',
      'playButton','profileButton','goldButton','gemButton','healthBar','shieldBar','healthText','xpBar','levelText','waveText',
      'timerText','bossBarWrap','bossName','bossBar','runCoins','comboText','pauseButton','joystick','joystickKnob','novaButton',
      'novaCooldown','dashButton','dashCooldown','objectiveToast','damageFlash','levelup','newLevel','upgradeChoices','pause',
      'resumeButton','restartButton','quitButton','results','resultEyebrow','resultTitle','resultScore','newRecord','resultTime',
      'resultKills','resultCoins','resultWave','resultReplay','resultHome','panel','panelKicker','panelTitle','panelClose','panelTabs',
      'panelBody','toast','fpsBadge','overdriveBar','overdriveText','rerollButton','resultBosses'
    ].forEach(function (id) { dom[id] = $(id); });
  }

  function bridgeJson(value) {
    try { return typeof value === 'string' ? JSON.parse(value) : value; } catch (error) { return null; }
  }

  function loadSave() {
    var parsed = null;
    var nativeFound = false;
    try {
      if (window.BymelSecure && typeof window.BymelSecure.status === 'function') {
        var status = bridgeJson(window.BymelSecure.status());
        if (status) saveStatus = { native: true, code: status.code || 'UNKNOWN', storage: status.storage || 'no_backup', encrypted: !!status.encrypted, signaturePinned: !!status.signaturePinned };
        var nativeResult = bridgeJson(window.BymelSecure.read());
        if (nativeResult && nativeResult.ok && nativeResult.data) {
          parsed = JSON.parse(nativeResult.data);
          nativeFound = true;
        } else if (nativeResult && nativeResult.code === 'CORRUPT_OR_TAMPERED') {
          saveStatus.code = 'SAVE_RECOVERED';
        }
      }
    } catch (error) { saveStatus.code = 'NATIVE_READ_FAILED'; }

    if (!parsed) {
      var keys = [CFG.saveKey].concat(CFG.legacySaveKeys || []);
      for (var i = 0; i < keys.length && !parsed; i += 1) {
        try { parsed = JSON.parse(localStorage.getItem(keys[i]) || 'null'); } catch (error) { parsed = null; }
      }
    }
    var merged = C.refreshDaily(C.mergeSave(parsed));
    if (saveStatus.native && !nativeFound) {
      try {
        var migration = bridgeJson(window.BymelSecure.write(JSON.stringify(merged)));
        if (migration && migration.ok) {
          [CFG.saveKey].concat(CFG.legacySaveKeys || []).forEach(function (key) { try { localStorage.removeItem(key); } catch (ignored) { } });
          saveStatus.code = 'MIGRATED';
        } else saveStatus.code = migration && migration.code ? migration.code : 'MIGRATION_FAILED';
      } catch (error) { saveStatus.code = 'MIGRATION_FAILED'; }
    }
    return merged;
  }

  function persist() {
    var payload = JSON.stringify(save);
    var hasNativeBridge = !!(window.BymelSecure && typeof window.BymelSecure.write === 'function');
    var storedNatively = false;
    try {
      if (hasNativeBridge) {
        var result = bridgeJson(window.BymelSecure.write(payload));
        storedNatively = !!(result && result.ok);
        saveStatus.native = storedNatively;
        if (!storedNatively && result) saveStatus.code = result.code || 'NATIVE_WRITE_FAILED';
      }
    } catch (error) { saveStatus.native = false; saveStatus.code = 'NATIVE_WRITE_FAILED'; }
    try {
      if (storedNatively) {
        [CFG.saveKey].concat(CFG.legacySaveKeys || []).forEach(function (key) { localStorage.removeItem(key); });
      } else localStorage.setItem(CFG.saveKey, payload);
    } catch (error) { /* Native kayıt veya tarayıcı fallback'i kullanılmaya devam eder. */ }
    updateHome();
  }

  window.NRFlushSave = persist;

  function init3D() {
    if (!THREE) throw new Error('3D motoru yüklenemedi');
    renderer = new THREE.WebGLRenderer({ canvas: $('gameCanvas'), antialias: false, alpha: false, powerPreference: 'high-performance', precision: 'mediump' });
    renderer.setClearColor(0x030611, 1);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setPixelRatio(pixelRatioForQuality());

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030611);
    scene.fog = new THREE.FogExp2(0x050817, 0.028);
    camera = new THREE.PerspectiveCamera(53, window.innerWidth / window.innerHeight, 0.1, 90);
    camera.position.set(7.8, 5.2, 10.8);
    camera.lookAt(0, .25, 0);
    clock = new THREE.Clock();

    var hemi = new THREE.HemisphereLight(0x7edfff, 0x160d33, 1.16);
    scene.add(hemi);
    var key = new THREE.DirectionalLight(0xb9d5ff, 1.15);
    key.position.set(-6, 11, 7);
    scene.add(key);
    var rim = new THREE.PointLight(0x8f4fff, 2.1, 28);
    rim.position.set(8, 4, -5);
    scene.add(rim);

    buildSharedAssets();
    buildArena();
    buildPlayer();
    buildPools();
    sceneReady = true;
  }

  function buildSharedAssets() {
    shared.geo.playerBody = new THREE.IcosahedronGeometry(.66, 1);
    shared.geo.playerCore = new THREE.OctahedronGeometry(.31, 0);
    shared.geo.playerCockpit = new THREE.SphereGeometry(.28, 8, 5);
    shared.geo.playerShoulder = new THREE.BoxGeometry(.3, .28, .5);
    shared.geo.playerEngine = new THREE.CylinderGeometry(.12, .2, .42, 6);
    shared.geo.playerFin = new THREE.ConeGeometry(.18, .62, 3);
    shared.geo.enemyDrone = new THREE.OctahedronGeometry(.62, 0);
    shared.geo.enemyRunner = new THREE.ConeGeometry(.56, 1.1, 5);
    shared.geo.enemyTank = new THREE.DodecahedronGeometry(.75, 0);
    shared.geo.enemyShooter = new THREE.TetrahedronGeometry(.75, 0);
    shared.geo.enemySplitter = new THREE.IcosahedronGeometry(.68, 0);
    shared.geo.enemyTitan = new THREE.IcosahedronGeometry(.92, 1);
    shared.geo.enemyCommander = new THREE.DodecahedronGeometry(1.02, 1);
    shared.geo.enemyEye = new THREE.SphereGeometry(.16, 6, 4);
    shared.geo.enemyPod = new THREE.CylinderGeometry(.14, .24, .7, 6);
    shared.geo.enemyArmor = new THREE.BoxGeometry(.34, .46, .62);
    shared.geo.enemyCrown = new THREE.TorusGeometry(.72, .075, 5, 22);
    shared.geo.enemyCore = new THREE.OctahedronGeometry(.28, 0);
    shared.geo.enemySpike = new THREE.ConeGeometry(.15, .58, 4);
    shared.geo.enemyBack = new THREE.ConeGeometry(.24, .82, 4);
    shared.geo.ring = new THREE.TorusGeometry(.78, .035, 5, 28);
    shared.geo.playerVisor = new THREE.SphereGeometry(.14, 7, 5);
    shared.geo.playerTailFin = new THREE.ConeGeometry(.14, .46, 3);
    shared.geo.bullet = new THREE.SphereGeometry(.13, 5, 4);
    shared.geo.enemyBullet = new THREE.OctahedronGeometry(.18, 0);
    shared.geo.xp = new THREE.OctahedronGeometry(.19, 0);
    shared.geo.coin = new THREE.CylinderGeometry(.2, .2, .08, 8);
    shared.geo.heal = new THREE.BoxGeometry(.16, .46, .16);
    shared.geo.particle = new THREE.TetrahedronGeometry(.09, 0);
    shared.geo.orbital = new THREE.ConeGeometry(.16, .65, 3);
    shared.geo.shadow = new THREE.CircleGeometry(.75, 24);

    shared.mat.player = new THREE.MeshPhongMaterial({ color: 0x35efff, emissive: 0x063f55, shininess: 110, flatShading: true });
    shared.mat.playerAccent = new THREE.MeshBasicMaterial({ color: 0x9b6cff });
    shared.mat.playerGlow = new THREE.MeshBasicMaterial({ color: 0x6ffaff, transparent: true, opacity: .68, blending: THREE.AdditiveBlending, depthWrite: false });
    shared.mat.cockpit = new THREE.MeshPhongMaterial({ color: 0xbafcff, emissive: 0x145b78, shininess: 150, transparent: true, opacity: .88 });
    shared.mat.shadow = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .3, depthWrite: false });
    shared.mat.bullet = new THREE.MeshBasicMaterial({ color: 0x6ffaff });
    shared.mat.enemyBullet = new THREE.MeshBasicMaterial({ color: 0xff4fd8 });
    shared.mat.xp = new THREE.MeshBasicMaterial({ color: 0x9b6cff });
    shared.mat.coin = new THREE.MeshPhongMaterial({ color: 0xffd34f, emissive: 0x5a3900, shininess: 90, flatShading: true });
    shared.mat.heal = new THREE.MeshPhongMaterial({ color: 0x5dffad, emissive: 0x0a4b32, shininess: 90 });
    shared.mat.particle = new THREE.MeshBasicMaterial({ color: 0x62eeff, transparent: true, opacity: .9 });
    shared.mat.orbital = new THREE.MeshBasicMaterial({ color: 0x65f8ff });
  }

  function buildArena() {
    arena = new THREE.Group();
    scene.add(arena);

    var floor = new THREE.Mesh(new THREE.CircleGeometry(CFG.arenaRadius + 2, 64), new THREE.MeshPhongMaterial({ color: 0x080d22, emissive: 0x02040d, shininess: 8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -.05;
    arena.add(floor);

    grid = new THREE.GridHelper(44, 44, 0x20619b, 0x122549);
    grid.position.y = 0;
    grid.material.transparent = true;
    grid.material.opacity = .34;
    arena.add(grid);

    var boundary = new THREE.Mesh(new THREE.TorusGeometry(CFG.arenaRadius, .09, 6, 96), new THREE.MeshBasicMaterial({ color: 0x2ec8ff, transparent: true, opacity: .58 }));
    boundary.rotation.x = Math.PI / 2;
    boundary.position.y = .05;
    arena.add(boundary);

    var pillarGeo = new THREE.BoxGeometry(.55, 2.8, .55);
    var pillarMat = new THREE.MeshPhongMaterial({ color: 0x131d44, emissive: 0x09132d, flatShading: true });
    for (var i = 0; i < 16; i += 1) {
      var angle = i / 16 * Math.PI * 2;
      var pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(Math.cos(angle) * 21.25, 1.3 + (i % 3) * .25, Math.sin(angle) * 21.25);
      pillar.rotation.y = -angle;
      pillar.scale.y = .75 + (i % 4) * .13;
      arena.add(pillar);
      var cap = new THREE.Mesh(new THREE.BoxGeometry(.62, .06, .62), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x6f4fff : 0x2ec8ff }));
      cap.position.set(pillar.position.x, pillar.position.y + 1.42 * pillar.scale.y, pillar.position.z);
      cap.rotation.y = -angle;
      arena.add(cap);
    }

    var starGeo = new THREE.BufferGeometry();
    var positions = [];
    for (var s = 0; s < 280; s += 1) {
      var radius = 12 + Math.random() * 54;
      var a = Math.random() * Math.PI * 2;
      positions.push(Math.cos(a) * radius, 6 + Math.random() * 22, Math.sin(a) * radius);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x7bc8ff, size: .06, transparent: true, opacity: .7, depthWrite: false }));
    scene.add(stars);
  }

  function buildPlayer() {
    playerMesh = new THREE.Group();
    scene.add(playerMesh);

    playerParts.shadow = new THREE.Mesh(shared.geo.shadow, shared.mat.shadow);
    playerParts.shadow.rotation.x = -Math.PI / 2;
    playerParts.shadow.position.y = .02;
    playerMesh.add(playerParts.shadow);

    playerParts.body = new THREE.Mesh(shared.geo.playerBody, shared.mat.player);
    playerParts.body.position.y = .72;
    playerMesh.add(playerParts.body);

    playerParts.core = new THREE.Mesh(shared.geo.playerCore, shared.mat.playerAccent);
    playerParts.core.position.set(0, .74, .53);
    playerMesh.add(playerParts.core);

    playerParts.cockpit = new THREE.Mesh(shared.geo.playerCockpit, shared.mat.cockpit);
    playerParts.cockpit.scale.set(1, .7, 1.25);
    playerParts.cockpit.position.set(0, 1.03, .12);
    playerMesh.add(playerParts.cockpit);

    playerParts.leftShoulder = new THREE.Mesh(shared.geo.playerShoulder, shared.mat.player);
    playerParts.rightShoulder = new THREE.Mesh(shared.geo.playerShoulder, shared.mat.player);
    playerParts.leftShoulder.position.set(-.58, .86, .02);
    playerParts.rightShoulder.position.set(.58, .86, .02);
    playerParts.leftShoulder.rotation.z = -.2;
    playerParts.rightShoulder.rotation.z = .2;
    playerMesh.add(playerParts.leftShoulder, playerParts.rightShoulder);

    playerParts.leftEngine = new THREE.Mesh(shared.geo.playerEngine, shared.mat.playerGlow);
    playerParts.rightEngine = new THREE.Mesh(shared.geo.playerEngine, shared.mat.playerGlow);
    playerParts.leftEngine.rotation.x = Math.PI / 2;
    playerParts.rightEngine.rotation.x = Math.PI / 2;
    playerParts.leftEngine.position.set(-.34, .62, -.58);
    playerParts.rightEngine.position.set(.34, .62, -.58);
    playerMesh.add(playerParts.leftEngine, playerParts.rightEngine);

    playerParts.topFin = new THREE.Mesh(shared.geo.playerFin, shared.mat.playerAccent);
    playerParts.topFin.position.set(0, 1.22, -.18);
    playerParts.topFin.rotation.x = -.35;
    playerMesh.add(playerParts.topFin);

    playerParts.visor = new THREE.Mesh(shared.geo.playerVisor, shared.mat.playerGlow);
    playerParts.visor.scale.set(1.35, .55, .5);
    playerParts.visor.position.set(0, 1.0, .34);
    playerMesh.add(playerParts.visor);

    playerParts.tailFin = new THREE.Mesh(shared.geo.playerTailFin, shared.mat.player);
    playerParts.tailFin.position.set(0, .82, -.72);
    playerParts.tailFin.rotation.x = Math.PI / 2 + .3;
    playerMesh.add(playerParts.tailFin);

    playerParts.ring = new THREE.Mesh(shared.geo.ring, shared.mat.playerGlow);
    playerParts.ring.position.y = .72;
    playerParts.ring.rotation.x = Math.PI / 2;
    playerMesh.add(playerParts.ring);

    var wingGeo = new THREE.BoxGeometry(.78, .09, .28);
    playerParts.leftWing = new THREE.Mesh(wingGeo, shared.mat.playerAccent);
    playerParts.rightWing = new THREE.Mesh(wingGeo, shared.mat.playerAccent);
    playerParts.leftWing.position.set(-.66, .72, .02);
    playerParts.rightWing.position.set(.66, .72, .02);
    playerParts.leftWing.rotation.z = -.22;
    playerParts.rightWing.rotation.z = .22;
    playerMesh.add(playerParts.leftWing, playerParts.rightWing);

    playerParts.orbitals = [];
    for (var i = 0; i < 3; i += 1) {
      var blade = new THREE.Mesh(shared.geo.orbital, shared.mat.orbital);
      blade.visible = false;
      blade.position.y = .7;
      playerMesh.add(blade);
      playerParts.orbitals.push(blade);
    }

    novaRing = new THREE.Mesh(new THREE.TorusGeometry(1, .055, 5, 52), new THREE.MeshBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    novaRing.rotation.x = Math.PI / 2;
    novaRing.position.y = .12;
    scene.add(novaRing);
    applySkin(save.equippedSkin);
  }

  function makeEnemySlot() {
    var group = new THREE.Group();
    var bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xff496d, emissive: 0x4c0719, shininess: 70, flatShading: true });
    var accentMaterial = new THREE.MeshBasicMaterial({ color: 0xffa0b4 });
    var body = new THREE.Mesh(shared.geo.enemyDrone, bodyMaterial);
    body.position.y = .58;
    group.add(body);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(.7, .035, 4, 18), new THREE.MeshBasicMaterial({ color: 0xff496d, transparent: true, opacity: .58 }));
    ring.position.y = .08; ring.rotation.x = Math.PI / 2; group.add(ring);
    var eye = new THREE.Mesh(shared.geo.enemyEye, accentMaterial); eye.position.set(0, .62, .55); group.add(eye);
    var podL = new THREE.Mesh(shared.geo.enemyPod, bodyMaterial); podL.position.set(-.7, .58, 0); podL.rotation.z = Math.PI / 2; group.add(podL);
    var podR = new THREE.Mesh(shared.geo.enemyPod, bodyMaterial); podR.position.set(.7, .58, 0); podR.rotation.z = Math.PI / 2; group.add(podR);
    var armorL = new THREE.Mesh(shared.geo.enemyArmor, bodyMaterial); armorL.position.set(-.62, .62, 0); group.add(armorL);
    var armorR = new THREE.Mesh(shared.geo.enemyArmor, bodyMaterial); armorR.position.set(.62, .62, 0); group.add(armorR);
    var crown = new THREE.Mesh(shared.geo.enemyCrown, accentMaterial); crown.position.y = 1.25; crown.rotation.x = Math.PI / 2; group.add(crown);
    var core = new THREE.Mesh(shared.geo.enemyCore, accentMaterial); core.position.set(0, .62, .72); group.add(core);
    var spikeL = new THREE.Mesh(shared.geo.enemySpike, bodyMaterial); spikeL.position.set(-.78, .96, -.18); spikeL.rotation.z = .55; group.add(spikeL);
    var spikeR = new THREE.Mesh(shared.geo.enemySpike, bodyMaterial); spikeR.position.set(.78, .96, -.18); spikeR.rotation.z = -.55; group.add(spikeR);
    var backSpine = new THREE.Mesh(shared.geo.enemyBack, accentMaterial); backSpine.position.set(0, .8, -.6); backSpine.rotation.x = Math.PI / 2 - .2; group.add(backSpine);
    var shadow = new THREE.Mesh(shared.geo.shadow, shared.mat.shadow);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .02; group.add(shadow);
    group.visible = false; scene.add(group);
    return { active: false, mesh: group, body: body, ring: ring, eye: eye, podL: podL, podR: podR, armorL: armorL, armorR: armorR, crown: crown, core: core, spikeL: spikeL, spikeR: spikeR, backSpine: backSpine, accentMaterial: accentMaterial, baseAccentColor: 0xffd5df, type: 'drone', hp: 0, maxHp: 0, speed: 0, damage: 0, xp: 0, coins: 0, hitCd: 0, attackCd: 0, specialCd: 0, dashTime: 0, barrier: 0, bossPhase: 0, elite: false, phase: Math.random() * 10, knockX: 0, knockZ: 0 };
  }

  function configureEnemyModel(enemy, type, elite) {
    [enemy.eye, enemy.podL, enemy.podR, enemy.armorL, enemy.armorR, enemy.crown, enemy.core, enemy.spikeL, enemy.spikeR, enemy.backSpine].forEach(function (part) { part.visible = false; });
    enemy.body.position.y = .58;
    enemy.body.scale.set(1, 1, 1);
    enemy.ring.scale.set(1, 1, 1);
    if (type === 'runner') {
      enemy.eye.visible = true; enemy.eye.position.set(0, .75, .32); enemy.body.rotation.x = Math.PI;
    } else if (type === 'tank') {
      enemy.eye.visible = true; enemy.armorL.visible = true; enemy.armorR.visible = true; enemy.ring.scale.set(1.18, 1.18, 1.18);
    } else if (type === 'shooter') {
      enemy.eye.visible = true; enemy.podL.visible = true; enemy.podR.visible = true; enemy.podL.position.x = -.72; enemy.podR.position.x = .72;
    } else if (type === 'splitter') {
      enemy.eye.visible = true; enemy.core.visible = true; enemy.core.position.set(0, .6, .64);
    } else if (type === 'titan') {
      enemy.eye.visible = true; enemy.podL.visible = true; enemy.podR.visible = true; enemy.armorL.visible = true; enemy.armorR.visible = true; enemy.crown.visible = true; enemy.core.visible = true;
      enemy.crown.position.y = 1.14; enemy.crown.scale.set(1.15, 1.15, 1.15); enemy.ring.scale.set(1.22, 1.22, 1.22);
      enemy.spikeL.visible = true; enemy.spikeR.visible = true; enemy.spikeL.scale.set(1.1, 1.1, 1.1); enemy.spikeR.scale.set(1.1, 1.1, 1.1);
      enemy.backSpine.visible = true; enemy.backSpine.scale.set(1.05, 1.05, 1.05);
    } else if (type === 'commander') {
      enemy.eye.visible = true; enemy.podL.visible = true; enemy.podR.visible = true; enemy.armorL.visible = true; enemy.armorR.visible = true; enemy.crown.visible = true; enemy.core.visible = true;
      enemy.crown.position.y = 1.32; enemy.crown.scale.set(1.48, 1.48, 1.48); enemy.ring.scale.set(1.42, 1.42, 1.42);
      enemy.podL.position.x = -.86; enemy.podR.position.x = .86; enemy.armorL.position.x = -.66; enemy.armorR.position.x = .66;
      enemy.spikeL.visible = true; enemy.spikeR.visible = true; enemy.spikeL.scale.set(1.4, 1.4, 1.4); enemy.spikeR.scale.set(1.4, 1.4, 1.4);
      enemy.spikeL.position.set(-.98, 1.18, -.24); enemy.spikeR.position.set(.98, 1.18, -.24);
      enemy.backSpine.visible = true; enemy.backSpine.scale.set(1.4, 1.4, 1.4); enemy.backSpine.position.set(0, .96, -.74);
    } else enemy.eye.visible = true;
    enemy.body.rotation.set(type === 'runner' ? Math.PI : 0, 0, 0);
    enemy.baseAccentColor = elite ? 0xffffff : (type === 'commander' ? 0x35efff : 0xffd5df);
    enemy.accentMaterial.color.setHex(enemy.baseAccentColor);
  }

  function makeBulletSlot(enemy) {
    var mesh = new THREE.Mesh(enemy ? shared.geo.enemyBullet : shared.geo.bullet, enemy ? shared.mat.enemyBullet : shared.mat.bullet);
    mesh.visible = false; scene.add(mesh);
    return { active: false, mesh: mesh, x: 0, z: 0, vx: 0, vz: 0, damage: 0, life: 0, pierce: 0, enemy: enemy };
  }

  function makePickupSlot() {
    var mesh = new THREE.Mesh(shared.geo.xp, shared.mat.xp);
    mesh.visible = false; scene.add(mesh);
    return { active: false, mesh: mesh, type: 'xp', value: 0, x: 0, z: 0, life: 0, phase: Math.random() * 6 };
  }

  function makeParticleSlot() {
    var material = shared.mat.particle.clone();
    var mesh = new THREE.Mesh(shared.geo.particle, material);
    mesh.visible = false; scene.add(mesh);
    return { active: false, mesh: mesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0 };
  }

  function buildPools() {
    var i;
    for (i = 0; i < CFG.maxEnemies; i += 1) enemyPool.push(makeEnemySlot());
    for (i = 0; i < CFG.maxPlayerBullets; i += 1) playerBulletPool.push(makeBulletSlot(false));
    for (i = 0; i < CFG.maxEnemyBullets; i += 1) enemyBulletPool.push(makeBulletSlot(true));
    for (i = 0; i < CFG.maxPickups; i += 1) pickupPool.push(makePickupSlot());
    for (i = 0; i < 78; i += 1) particlePool.push(makeParticleSlot());
  }

  function pixelRatioForQuality() {
    var quality = save.settings.quality;
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (quality === 'low') return Math.min(1, dpr);
    if (quality === 'high') return Math.min(1.65, dpr);
    return Math.min(1.35, dpr) * renderScale;
  }

  function applySkin(id) {
    var skin = SKINS[id] || SKINS.cyan;
    shared.mat.player.color.setHex(skin.color);
    shared.mat.player.emissive.setHex(skin.color).multiplyScalar(.18);
    shared.mat.playerAccent.color.setHex(skin.accent);
    shared.mat.playerGlow.color.setHex(skin.color);
    shared.mat.orbital.color.setHex(skin.color);
    shared.mat.cockpit.emissive.setHex(skin.color).multiplyScalar(.22);
  }

  function bindUI() {
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', function () { window.setTimeout(onResize, 180); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && mode === 'playing') pauseGame();
    });
    window.addEventListener('keydown', function (event) {
      keys[event.code] = true;
      if (event.code === 'Space') triggerDash();
      if (event.code === 'KeyE') triggerNova();
      if (event.code === 'Escape' && mode === 'playing') pauseGame();
    });
    window.addEventListener('keyup', function (event) { keys[event.code] = false; });

    dom.playButton.addEventListener('click', startGame);
    dom.profileButton.addEventListener('click', function () { openPanel('armory'); });
    dom.goldButton.addEventListener('click', function () { openPanel('armory'); });
    dom.gemButton.addEventListener('click', function () { openPanel('shop', 'currency'); });
    document.querySelectorAll('.side-actions button').forEach(function (button) {
      button.addEventListener('click', function () { openPanel(button.getAttribute('data-panel')); });
    });
    dom.panelClose.addEventListener('click', closePanel);
    dom.panel.addEventListener('click', function (event) { if (event.target === dom.panel) closePanel(); });
    dom.pauseButton.addEventListener('click', pauseGame);
    dom.resumeButton.addEventListener('click', resumeGame);
    dom.restartButton.addEventListener('click', function () { hideModal('pause'); startGame(); });
    dom.quitButton.addEventListener('click', function () { hideModal('pause'); finishRun(true); });
    dom.resultReplay.addEventListener('click', function () { hideModal('results'); startGame(); });
    dom.resultHome.addEventListener('click', function () { hideModal('results'); showHome(); });
    dom.dashButton.addEventListener('pointerdown', function (event) { event.preventDefault(); triggerDash(); });
    dom.novaButton.addEventListener('pointerdown', function (event) { event.preventDefault(); triggerNova(); });
    dom.rerollButton.addEventListener('click', rerollUpgrades);
    bindJoystick();
  }

  function bindJoystick() {
    function updatePointer(event) {
      var rect = dom.joystick.getBoundingClientRect();
      var centerX = rect.left + rect.width / 2;
      var centerY = rect.top + rect.height / 2;
      var dx = event.clientX - centerX;
      var dy = event.clientY - centerY;
      var limit = rect.width * .32;
      var length = Math.sqrt(dx * dx + dy * dy) || 1;
      if (length > limit) { dx = dx / length * limit; dy = dy / length * limit; }
      joystick.x = C.clamp(dx / limit, -1, 1);
      joystick.y = C.clamp(dy / limit, -1, 1);
      dom.joystickKnob.style.transform = 'translate(calc(-50% + ' + dx.toFixed(1) + 'px), calc(-50% + ' + dy.toFixed(1) + 'px))';
    }
    dom.joystick.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      joystick.active = true; joystick.pointerId = event.pointerId;
      try { dom.joystick.setPointerCapture(event.pointerId); } catch (error) { /* Old WebView fallback. */ }
      updatePointer(event);
    });
    dom.joystick.addEventListener('pointermove', function (event) {
      if (!joystick.active || event.pointerId !== joystick.pointerId) return;
      event.preventDefault(); updatePointer(event);
    });
    function release(event) {
      if (!joystick.active || (event && event.pointerId !== joystick.pointerId)) return;
      joystick.active = false; joystick.pointerId = null; joystick.x = 0; joystick.y = 0;
      dom.joystickKnob.style.transform = 'translate(-50%, -50%)';
    }
    dom.joystick.addEventListener('pointerup', release);
    dom.joystick.addEventListener('pointercancel', release);
    window.addEventListener('blur', function () { release(); });
  }

  function onResize() {
    if (!renderer || !camera) return;
    camera.aspect = Math.max(.5, window.innerWidth / Math.max(1, window.innerHeight));
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setPixelRatio(pixelRatioForQuality());
  }

  function boot() {
    cacheDom();
    dom.splashFill.style.width = '18%';
    try {
      init3D();
      dom.splashFill.style.width = '62%';
      dom.bootStatus.textContent = 'RIFT SENKRONİZE EDİLİYOR';
      bindUI();
      audio.setSettings(save.settings);
      billing.initialize().then(function () { /* Availability is surfaced only when the player opens currency packs. */ });
      billing.onEvent(handleBillingEvent);
      updateHome();
      requestAnimationFrame(loop);
      window.setTimeout(function () {
        dom.splashFill.style.width = '100%';
        dom.bootStatus.textContent = 'SİSTEM HAZIR';
      }, 620);
      window.setTimeout(showHome, 1700);
    } catch (error) {
      dom.bootStatus.textContent = '3D BAŞLATILAMADI · UYGULAMAYI YENİDEN AÇ';
      dom.bootStatus.style.color = '#ff6f87';
      dom.splashFill.style.width = '100%';
      dom.splashFill.style.background = '#ff4f6d';
    }
  }

  function updateHome() {
    if (!dom.homeGold) return;
    var pilotLevel = 1 + Math.floor(Math.sqrt((save.pilotXp || 0) / 600));
    dom.pilotLevel.textContent = 'SV. ' + pilotLevel;
    dom.homeGold.textContent = C.formatNumber(save.gold);
    dom.homeGems.textContent = C.formatNumber(save.gems);
    dom.highScore.textContent = C.formatNumber(save.highScore);
    dom.streakText.textContent = Math.max(1, save.streak || 1) + '. GÜN';
    var claimable = (save.missions || []).filter(function (mission) { return !mission.claimed && mission.progress >= mission.target; }).length;
    dom.missionBadge.textContent = claimable || (save.missions || []).length;
    dom.missionBadge.style.background = claimable ? '#5dffad' : '#ff4f6d';
    dom.missionBadge.style.color = claimable ? '#07161b' : '#fff';
    dom.fpsBadge.classList.toggle('active', !!save.settings.fps);
    applySkin(save.equippedSkin);
  }

  function showHome() {
    mode = 'home';
    dom.splash.classList.remove('active');
    dom.hud.classList.remove('active');
    dom.home.classList.add('active');
    dom.levelup.classList.remove('active');
    dom.pause.classList.remove('active');
    dom.results.classList.remove('active');
    clearRunEntities();
    playerMesh.visible = true;
    playerMesh.position.set(0, 0, 0);
    playerMesh.rotation.set(0, -.5, 0);
    audio.stopMusic();
    updateHome();
  }

  function startGame() {
    audio.unlock(); audio.play('ui'); audio.startMusic();
    closePanel(); hideModal('results'); hideModal('pause'); hideModal('levelup');
    dom.home.classList.remove('active');
    dom.hud.classList.add('active');
    resetRun();
    mode = 'playing';
    lastTime = performance.now();
    showObjective('DALGA 1');
    haptic(16);
  }

  function resetRun() {
    clearRunEntities();
    activeBoss = null; pendingCommander = 0; bossCycle = 0; spawnTimer = .2; currentWave = 1; cameraShake = 0;
    joystick.x = 0; joystick.y = 0; input.x = 0; input.y = 0;
    dom.joystickKnob.style.transform = 'translate(-50%, -50%)';
    run = { elapsed: 0, kills: 0, coins: 0, wave: 1, level: 1, xp: 0, xpNeed: 16, combo: 1, maxCombo: 1, comboTimer: 0, bosses: 0, commanders: 0, elites: 0, upgrades: {}, score: 0, dashUses: 0, rerolls: 1, overdriveCharge: 0, overdriveTime: 0, overdriveDuration: 7, modifier: 'standard', bossWaves: {}, bonusGems: 0 };
    var armor = save.permanent.armor || 0;
    var power = save.permanent.power || 0;
    player = {
      x: 0, z: 0, vx: 0, vz: 0,
      maxHp: 100 + armor * 13, hp: 100 + armor * 13, shield: 0,
      speed: 6.9, damage: 15 * (1 + power * .085), fireRate: 4.2, fireTimer: .15,
      bulletSpeed: 17, projectileCount: 1, crit: .06, magnet: 3.2,
      invuln: 0, dashTime: 0, dashCooldown: 0, dashMax: 2.9 * Math.pow(.94, save.permanent.reactor || 0),
      novaCooldown: 0, novaMax: 12 * Math.pow(.96, save.permanent.reactor || 0), novaPower: 1,
      orbitals: 0, orbitalAngle: 0, lifeSteal: 0, lifeCounter: 0, pierce: 0, recovery: 0, overdriveGain: 1 + (save.permanent.reactor || 0) * .08
    };
    playerMesh.visible = true; playerMesh.position.set(0, 0, 0); playerMesh.rotation.set(0, 0, 0);
    playerParts.orbitals.forEach(function (blade) { blade.visible = false; });
    novaRing.material.opacity = 0; novaRing.scale.set(1, 1, 1);
    dom.hud.classList.remove('overdrive');
    updateHUD();
  }

  function clearRunEntities() {
    enemyPool.forEach(function (item) { item.active = false; item.mesh.visible = false; });
    playerBulletPool.forEach(function (item) { item.active = false; item.mesh.visible = false; });
    enemyBulletPool.forEach(function (item) { item.active = false; item.mesh.visible = false; });
    pickupPool.forEach(function (item) { item.active = false; item.mesh.visible = false; });
    particlePool.forEach(function (item) { item.active = false; item.mesh.visible = false; });
    activeBoss = null; pendingCommander = 0;
    if (dom.bossBarWrap) dom.bossBarWrap.classList.remove('active');
  }

  function pauseGame() {
    if (mode !== 'playing') return;
    mode = 'paused'; showModal('pause'); audio.play('ui');
  }

  function resumeGame() {
    if (mode !== 'paused') return;
    hideModal('pause'); mode = 'playing'; lastTime = performance.now(); audio.play('ui');
  }

  function showModal(id) { dom[id].classList.add('active'); }
  function hideModal(id) { if (dom[id]) dom[id].classList.remove('active'); }

  function showObjective(text) {
    dom.objectiveToast.textContent = text;
    dom.objectiveToast.classList.add('show');
    objectiveTimer = 1.6;
  }

  function toast(message, icon) {
    window.clearTimeout(toastTimer);
    dom.toast.querySelector('span').textContent = icon || '✓';
    dom.toast.querySelector('p').textContent = message;
    dom.toast.classList.add('show');
    toastTimer = window.setTimeout(function () { dom.toast.classList.remove('show'); }, 2600);
  }

  function haptic(ms) {
    if (!save.settings.haptics) return;
    try {
      if (window.android && typeof window.android.vibrate === 'function') window.android.vibrate(ms || 18);
      else if (navigator.vibrate) navigator.vibrate(ms || 18);
    } catch (error) { /* Optional hardware feedback. */ }
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (!lastTime) lastTime = now;
    var rawDt = Math.max(0, (now - lastTime) / 1000);
    var dt = Math.min(.042, rawDt || .016);
    lastTime = now;

    if (sceneReady) {
      if (mode === 'playing') updateGame(dt);
      else updateAmbient(dt, now * .001);
      updateTransientUI(dt);
      renderer.render(scene, camera);
    }

    frameAccumulator += rawDt;
    frameCount += 1;
    if (frameAccumulator >= 1) {
      fps = Math.round(frameCount / frameAccumulator);
      dom.fpsBadge.textContent = fps + ' FPS';
      frameAccumulator = 0; frameCount = 0;
      adaptQuality(now * .001);
    }
  }

  function updateAmbient(dt, time) {
    if (playerMesh && mode === 'home') {
      playerMesh.visible = true;
      playerMesh.position.y = Math.sin(time * 1.8) * .09;
      playerMesh.rotation.y += dt * .34;
      playerParts.body.rotation.y += dt * .7;
      playerParts.core.rotation.z += dt * 1.4;
      playerParts.ring.rotation.z -= dt * .65;
      camera.position.x = C.lerp(camera.position.x, 7.8, 1 - Math.pow(.002, dt));
      camera.position.y = C.lerp(camera.position.y, 5.2, 1 - Math.pow(.002, dt));
      camera.position.z = C.lerp(camera.position.z, 10.8, 1 - Math.pow(.002, dt));
      camera.lookAt(0, .5, 0);
    }
    if (grid) grid.position.z = (time * .22) % 1;
    if (stars) stars.rotation.y += dt * .008;
  }

  function updateTransientUI(dt) {
    if (objectiveTimer > 0) {
      objectiveTimer -= dt;
      if (objectiveTimer <= 0) dom.objectiveToast.classList.remove('show');
    }
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) dom.damageFlash.classList.remove('show');
    }
  }

  function adaptQuality(nowSeconds) {
    if (!renderer || save.settings.quality !== 'auto' || mode !== 'playing' || nowSeconds - lastScaleChange < 5) return;
    var changed = false;
    if (fps < 43 && renderScale > .68) { renderScale = Math.max(.68, renderScale - .12); changed = true; }
    else if (fps > 57 && renderScale < 1) { renderScale = Math.min(1, renderScale + .06); changed = true; }
    if (changed) {
      renderer.setPixelRatio(pixelRatioForQuality());
      lastScaleChange = nowSeconds;
    }
  }

  function updateGame(dt) {
    run.elapsed += dt;
    player.invuln = Math.max(0, player.invuln - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.novaCooldown = Math.max(0, player.novaCooldown - dt);
    if (run.overdriveTime > 0) {
      run.overdriveTime = Math.max(0, run.overdriveTime - dt);
      if (run.overdriveTime <= 0) { dom.hud.classList.remove('overdrive'); toast('Overdrive sona erdi', '◇'); }
    }
    run.comboTimer = Math.max(0, run.comboTimer - dt);
    if (run.comboTimer <= 0 && run.combo > 1) run.combo = Math.max(1, run.combo - dt * 1.8);

    updateInput();
    updatePlayer(dt);
    updateWavesAndSpawns(dt);
    updateEnemies(dt);
    updatePlayerBullets(dt);
    updateEnemyBullets(dt);
    updatePickups(dt);
    updateParticles(dt);
    updateNovaRing(dt);
    updateCamera(dt);
    updateHUD();
  }

  function updateInput() {
    var keyX = 0; var keyZ = 0;
    if (keys.KeyA || keys.ArrowLeft) keyX -= 1;
    if (keys.KeyD || keys.ArrowRight) keyX += 1;
    if (keys.KeyW || keys.ArrowUp) keyZ -= 1;
    if (keys.KeyS || keys.ArrowDown) keyZ += 1;
    input.x = joystick.active ? joystick.x : keyX;
    input.y = joystick.active ? joystick.y : keyZ;
    var length = Math.sqrt(input.x * input.x + input.y * input.y);
    if (length > 1) { input.x /= length; input.y /= length; }
    if (Math.abs(input.x) + Math.abs(input.y) > .08) { lastDirection.x = input.x; lastDirection.z = input.y; }
  }

  function updatePlayer(dt) {
    var moveSpeed = player.speed * (run.overdriveTime > 0 ? 1.22 : 1);
    if (player.dashTime > 0) {
      player.dashTime -= dt;
      moveSpeed = 22;
      input.x = lastDirection.x; input.y = lastDirection.z;
      spawnTrail(player.x, player.z, SKINS[save.equippedSkin].color);
    }
    var smoothing = 1 - Math.pow(.0008, dt);
    player.vx = C.lerp(player.vx, input.x * moveSpeed, smoothing);
    player.vz = C.lerp(player.vz, input.y * moveSpeed, smoothing);
    player.x += player.vx * dt;
    player.z += player.vz * dt;
    var distance = Math.sqrt(player.x * player.x + player.z * player.z);
    var limit = CFG.arenaRadius - .8;
    if (distance > limit) {
      player.x = player.x / distance * limit;
      player.z = player.z / distance * limit;
      player.vx *= .3; player.vz *= .3;
    }
    playerMesh.position.x = player.x;
    playerMesh.position.z = player.z;
    playerMesh.position.y = Math.sin(run.elapsed * 6.5) * .045;
    if (Math.abs(player.vx) + Math.abs(player.vz) > .2) {
      var targetRotation = Math.atan2(player.vx, player.vz);
      var delta = Math.atan2(Math.sin(targetRotation - playerMesh.rotation.y), Math.cos(targetRotation - playerMesh.rotation.y));
      playerMesh.rotation.y += delta * (1 - Math.pow(.00003, dt));
    }
    playerParts.body.rotation.x += dt * 1.25;
    playerParts.core.rotation.z -= dt * 2.6;
    playerParts.ring.rotation.z += dt * (run.overdriveTime > 0 ? 4.2 : 1.8);
    playerParts.cockpit.rotation.y = Math.sin(run.elapsed * 2.2) * .08;
    var engineScale = 1 + Math.min(.9, Math.sqrt(player.vx * player.vx + player.vz * player.vz) / 10) + (run.overdriveTime > 0 ? .55 : 0);
    playerParts.leftEngine.scale.y = engineScale; playerParts.rightEngine.scale.y = engineScale;

    updateOrbitals(dt);
    player.fireTimer -= dt;
    if (player.fireTimer <= 0) {
      var target = nearestEnemy(player.x, player.z, 15.5);
      if (target) {
        autoFire(target);
        player.fireTimer += 1 / (player.fireRate * (run.overdriveTime > 0 ? 1.55 : 1));
      } else player.fireTimer = .05;
    }
  }

  function updateOrbitals(dt) {
    player.orbitalAngle += dt * 2.5;
    for (var i = 0; i < playerParts.orbitals.length; i += 1) {
      var blade = playerParts.orbitals[i];
      var enabled = i < player.orbitals;
      blade.visible = enabled;
      if (!enabled) continue;
      var angle = player.orbitalAngle + i / player.orbitals * Math.PI * 2;
      var radius = 1.65 + player.orbitals * .1;
      blade.position.set(Math.cos(angle) * radius, .72, Math.sin(angle) * radius);
      blade.rotation.set(Math.PI / 2, -angle, 0);
      enemyPool.forEach(function (enemy) {
        if (!enemy.active || enemy.orbitCd > 0) return;
        var bx = player.x + Math.cos(angle) * radius;
        var bz = player.z + Math.sin(angle) * radius;
        if (C.distanceSquared(bx, bz, enemy.mesh.position.x, enemy.mesh.position.z) < .72) {
          damageEnemy(enemy, player.damage * .62, bx, bz);
          enemy.orbitCd = .25;
        }
      });
    }
  }

  function updateWavesAndSpawns(dt) {
    var wave = 1 + Math.floor(run.elapsed / 20);
    if (wave !== currentWave) {
      currentWave = wave; run.wave = wave;
      if (player.recovery > 0) player.hp = Math.min(player.maxHp, player.hp + 8 * player.recovery);
      if (wave > 1 && wave % 5 === 0) run.rerolls += 1;
      setWaveModifier(wave);
      showObjective('DALGA ' + wave + ' · ' + modifierLabel(run.modifier));
      if (wave % 4 === 1 && wave > 1) toast('Yeni düşman deseni: ' + modifierLabel(run.modifier), '⚠');
    }

    if (pendingCommander > 0) {
      pendingCommander -= dt;
      if (pendingCommander <= 0 && !activeBoss) spawnEnemy('commander');
      return;
    }

    var dueBossWave = wave - (wave % 4);
    if (dueBossWave >= 4 && !activeBoss && !run.bossWaves[dueBossWave]) {
      var spawnedTitan = spawnEnemy('titan');
      if (spawnedTitan) run.bossWaves[dueBossWave] = true;
    }

    spawnTimer -= dt;
    var activeCount = enemyPool.reduce(function (count, enemy) { return count + (enemy.active ? 1 : 0); }, 0);
    var swarmBonus = run.modifier === 'swarm' ? 8 : 0;
    var desired = Math.min(CFG.maxEnemies - (activeBoss ? 1 : 0), 7 + wave * 3 + Math.floor(run.elapsed / 35) + swarmBonus);
    if (spawnTimer <= 0 && activeCount < desired) {
      spawnEnemy(selectEnemyType(wave));
      if (wave >= 6 && Math.random() < (run.modifier === 'swarm' ? .42 : .22)) spawnEnemy('runner');
      spawnTimer = Math.max(.26, 1.12 - wave * .055 - run.elapsed * .0017 - (run.modifier === 'frenzy' ? .12 : 0));
    }
  }

  function setWaveModifier(wave) {
    var cycle = wave % 9;
    run.modifier = cycle === 3 ? 'swarm' : cycle === 6 ? 'armored' : cycle === 0 ? 'frenzy' : 'standard';
  }

  function modifierLabel(id) {
    return id === 'swarm' ? 'SÜRÜ' : id === 'armored' ? 'ZIRHLI' : id === 'frenzy' ? 'ÇILGIN' : 'STANDART';
  }

  function selectEnemyType(wave) {
    var roll = Math.random();
    if (wave >= 6 && roll < .12) return 'splitter';
    if (wave >= 4 && roll < .27) return 'tank';
    if (wave >= 3 && roll < .48) return 'shooter';
    if (wave >= 2 && roll < .70) return 'runner';
    return 'drone';
  }

  function spawnEnemy(type, options) {
    options = options || {};
    var def = ENEMY_TYPES[type] || ENEMY_TYPES.drone;
    if (def.boss && activeBoss) return null;
    var slot = enemyPool.find(function (enemy) { return !enemy.active; });
    if (!slot) return null;
    var bossDifficulty = type === 'commander' ? 1 + Math.min(2.1, bossCycle * .24) + Math.min(1.4, run.wave * .055) : 1;
    var difficulty = (1 + Math.min(2.6, Math.max(0, run.wave - 1) * .105) + Math.min(1.2, run.elapsed * .0015)) * bossDifficulty;
    var angle = Math.random() * Math.PI * 2;
    var radius = def.boss ? 17 : 13 + Math.random() * 5;
    var x = options.x !== undefined ? options.x : player.x + Math.cos(angle) * radius;
    var z = options.z !== undefined ? options.z : player.z + Math.sin(angle) * radius;
    var centerDist = Math.sqrt(x * x + z * z);
    if (centerDist > CFG.arenaRadius - 1) { x = x / centerDist * (CFG.arenaRadius - 1); z = z / centerDist * (CFG.arenaRadius - 1); }

    var eliteChance = Math.min(.24, .035 + run.wave * .012);
    var elite = !def.boss && (options.elite === true || (run.wave >= 5 && Math.random() < eliteChance));
    var hpModifier = run.modifier === 'armored' && !def.boss ? 1.3 : 1;
    var speedModifier = run.modifier === 'frenzy' && !def.boss ? 1.18 : 1;
    slot.active = true; slot.type = type; slot.elite = elite;
    slot.maxHp = def.hp * difficulty * hpModifier * (elite ? 1.8 : 1); slot.hp = slot.maxHp;
    slot.speed = def.speed * Math.min(1.42, 1 + run.wave * .012) * speedModifier * (elite ? 1.12 : 1);
    slot.damage = def.damage * (1 + run.wave * .055) * (elite ? 1.24 : 1);
    slot.xp = Math.round(def.xp * (elite ? 2.2 : 1)); slot.coins = Math.round(def.coins * (elite ? 2.1 : 1));
    slot.hitCd = .2; slot.attackCd = .8 + Math.random(); slot.specialCd = 1.2; slot.orbitCd = 0;
    slot.knockX = 0; slot.knockZ = 0; slot.phase = Math.random() * 10; slot.bossPhase = type === 'commander' ? 1 : 0;
    slot.barrier = 0; slot.dashTime = 0; slot.specialCount = 0; slot.summonCd = 4;
    slot.hitToken = (slot.hitToken || 0) + 1;
    slot.mesh.position.set(x, 0, z); slot.mesh.scale.setScalar(def.scale * (elite ? 1.12 : 1)); slot.mesh.visible = true;
    slot.body.geometry = type === 'runner' ? shared.geo.enemyRunner : type === 'tank' ? shared.geo.enemyTank : type === 'shooter' ? shared.geo.enemyShooter : type === 'splitter' ? shared.geo.enemySplitter : type === 'titan' ? shared.geo.enemyTitan : type === 'commander' ? shared.geo.enemyCommander : shared.geo.enemyDrone;
    slot.body.material.color.setHex(def.color);
    slot.body.material.emissive.setHex(def.color).multiplyScalar(elite ? .38 : .22);
    slot.ring.material.color.setHex(elite ? 0xffffff : def.color);
    slot.ring.material.opacity = def.boss ? .9 : elite ? .84 : .55;
    configureEnemyModel(slot, type, elite);
    if (def.boss) {
      activeBoss = slot;
      var title = type === 'commander' ? 'BYMEL COMMANDER' : 'RIFT TITAN';
      dom.bossBarWrap.classList.add('active'); dom.bossName.textContent = title;
      showObjective('⚠ ' + title + ' ⚠'); audio.play('boss'); haptic(type === 'commander' ? 75 : 45); cameraShake = type === 'commander' ? .9 : .55;
      if (type === 'commander') { bossCycle += 1; burst(x, z, def.color, 30); }
    }
    return slot;
  }

  function nearestEnemy(x, z, maxDistance) {
    var closest = null; var best = maxDistance * maxDistance;
    enemyPool.forEach(function (enemy) {
      if (!enemy.active) return;
      var distance = C.distanceSquared(x, z, enemy.mesh.position.x, enemy.mesh.position.z);
      if (distance < best) { best = distance; closest = enemy; }
    });
    return closest;
  }

  function updateEnemies(dt) {
    enemyPool.forEach(function (enemy) {
      if (!enemy.active) return;
      enemy.hitCd = Math.max(0, enemy.hitCd - dt);
      enemy.orbitCd = Math.max(0, (enemy.orbitCd || 0) - dt);
      enemy.attackCd -= dt; enemy.specialCd -= dt; enemy.summonCd = Math.max(0, (enemy.summonCd || 0) - dt);
      enemy.barrier = Math.max(0, (enemy.barrier || 0) - dt);
      var ex = enemy.mesh.position.x;
      var ez = enemy.mesh.position.z;
      var dx = player.x - ex;
      var dz = player.z - ez;
      var distance = Math.sqrt(dx * dx + dz * dz) || .001;
      var dirX = dx / distance; var dirZ = dz / distance;
      var moveX = dirX; var moveZ = dirZ;

      if (enemy.type === 'commander') {
        updateCommander(enemy, dt, distance, dirX, dirZ);
      } else {
        if (enemy.type === 'shooter' || enemy.type === 'titan') {
          var desired = enemy.type === 'titan' ? 7.5 : 8.5;
          if (distance < desired - 1) { moveX = -dirX; moveZ = -dirZ; }
          else if (distance < desired + 1.5) {
            var strafe = Math.sin(run.elapsed * .7 + enemy.phase) > 0 ? 1 : -1;
            moveX = -dirZ * strafe; moveZ = dirX * strafe;
          }
          if (enemy.attackCd <= 0 && distance < 14) {
            if (enemy.type === 'titan') titanVolley(enemy, dirX, dirZ);
            else spawnEnemyBullet(ex, ez, dirX, dirZ, enemy.damage, enemy.elite ? 7.4 : 6.4);
            enemy.attackCd = enemy.type === 'titan' ? 1.25 : 2.1 - Math.min(.45, run.wave * .025);
          }
        }
        var knockDecay = Math.pow(.001, dt);
        enemy.mesh.position.x += (moveX * enemy.speed + enemy.knockX) * dt;
        enemy.mesh.position.z += (moveZ * enemy.speed + enemy.knockZ) * dt;
        enemy.knockX *= knockDecay; enemy.knockZ *= knockDecay;
      }

      enemy.mesh.position.y = Math.sin(run.elapsed * 4 + enemy.phase) * .06;
      enemy.body.rotation.y += dt * (enemy.type === 'runner' ? 5 : enemy.type === 'commander' ? 1.9 : 1.4);
      enemy.body.rotation.x += dt * (enemy.type === 'commander' ? .28 : .7);
      enemy.ring.rotation.z += dt * (enemy.type === 'commander' ? 3.2 : enemy.type === 'titan' ? 1.6 : .8);
      if (enemy.crown.visible) enemy.crown.rotation.z -= dt * (enemy.type === 'commander' ? 4 : 1.8);
      if (enemy.core.visible) enemy.core.rotation.y += dt * 3.2;
      enemy.mesh.rotation.y = Math.atan2(dirX, dirZ);
      enemy.ring.material.opacity = enemy.barrier > 0 ? .98 : (ENEMY_TYPES[enemy.type].boss ? .9 : enemy.elite ? .84 : .55);

      if (distance < (.72 + (ENEMY_TYPES[enemy.type].scale * .58)) && enemy.hitCd <= 0) {
        damagePlayer(enemy.damage);
        enemy.hitCd = enemy.type === 'commander' ? .45 : .7;
        enemy.knockX = -dirX * 5; enemy.knockZ = -dirZ * 5;
      }
    });
  }

  function updateCommander(enemy, dt, distance, dirX, dirZ) {
    var ratio = enemy.hp / enemy.maxHp;
    var nextPhase = ratio > .62 ? 1 : ratio > .34 ? 2 : ratio > .13 ? 3 : 4;
    if (nextPhase !== enemy.bossPhase) {
      enemy.bossPhase = nextPhase;
      enemy.barrier = nextPhase === 4 ? 4 : 3.2;
      enemy.specialCd = nextPhase === 4 ? .4 : .55;
      clearEnemyProjectiles();
      summonCommanderGuards(enemy, nextPhase);
      showObjective(nextPhase === 4 ? '⚠ COMMANDER ÇILGINA DÖNDÜ ⚠' : 'COMMANDER · FAZ ' + nextPhase);
      burst(enemy.mesh.position.x, enemy.mesh.position.z, ENEMY_TYPES.commander.color, nextPhase === 4 ? 34 : 22);
      cameraShake = nextPhase === 4 ? 1.1 : .75; haptic(nextPhase === 4 ? 90 : 55);
      if (nextPhase === 4) { enemy.accentMaterial.color.setHex(0xff2d4a); enemy.ring.material.color.setHex(0xff2d4a); }
    }

    if (enemy.dashTime > 0) {
      enemy.dashTime -= dt;
      enemy.mesh.position.x += enemy.dashX * (12 + enemy.bossPhase * 2) * dt;
      enemy.mesh.position.z += enemy.dashZ * (12 + enemy.bossPhase * 2) * dt;
      spawnTrail(enemy.mesh.position.x, enemy.mesh.position.z, enemy.bossPhase === 4 ? 0xff2d4a : ENEMY_TYPES.commander.color);
    } else {
      var desired = enemy.bossPhase === 1 ? 9 : enemy.bossPhase === 2 ? 7.2 : enemy.bossPhase === 3 ? 5.8 : 4.6;
      var moveX = dirX; var moveZ = dirZ;
      if (distance < desired - .8) { moveX = -dirX; moveZ = -dirZ; }
      else if (distance < desired + 1.8) {
        var strafe = Math.sin(run.elapsed * (1 + enemy.bossPhase * .18) + enemy.phase) > 0 ? 1 : -1;
        moveX = -dirZ * strafe; moveZ = dirX * strafe;
      }
      var decay = Math.pow(.0005, dt);
      enemy.mesh.position.x += (moveX * enemy.speed + enemy.knockX) * dt;
      enemy.mesh.position.z += (moveZ * enemy.speed + enemy.knockZ) * dt;
      enemy.knockX *= decay; enemy.knockZ *= decay;
    }

    if (enemy.specialCd <= 0 && distance < 17) {
      commanderAttack(enemy, dirX, dirZ);
      enemy.specialCd = enemy.bossPhase === 1 ? 1.55 : enemy.bossPhase === 2 ? 1.18 : enemy.bossPhase === 3 ? .82 : .58;
    }
    if (enemy.summonCd <= 0 && enemy.bossPhase >= 2) {
      summonCommanderGuards(enemy, enemy.bossPhase);
      enemy.summonCd = enemy.bossPhase === 2 ? 7.5 : enemy.bossPhase === 3 ? 5.2 : 3.8;
    }
  }

  function commanderAttack(enemy, dirX, dirZ) {
    enemy.specialCount += 1;
    var phase = enemy.bossPhase;
    var base = Math.atan2(dirZ, dirX);
    var fan = 5 + phase * 2;
    for (var i = 0; i < fan; i += 1) {
      var angle = base + (i - (fan - 1) / 2) * (.17 - phase * .012);
      spawnEnemyBullet(enemy.mesh.position.x, enemy.mesh.position.z, Math.cos(angle), Math.sin(angle), enemy.damage, 7.2 + phase * .7, 4.2, phase >= 3 ? 1.22 : 1);
    }
    if (phase >= 2 && enemy.specialCount % 2 === 0) {
      var count = 10 + phase * 2;
      for (var r = 0; r < count; r += 1) {
        var radial = r / count * Math.PI * 2 + run.elapsed * .7;
        spawnEnemyBullet(enemy.mesh.position.x, enemy.mesh.position.z, Math.cos(radial), Math.sin(radial), enemy.damage * .68, 5.7 + phase * .45, 4.5, .9);
      }
    }
    if (phase === 4) {
      var spiralCount = 15;
      for (var sp = 0; sp < spiralCount; sp += 1) {
        var spiralAngle = sp / spiralCount * Math.PI * 2 - run.elapsed * 1.6;
        spawnEnemyBullet(enemy.mesh.position.x, enemy.mesh.position.z, Math.cos(spiralAngle), Math.sin(spiralAngle), enemy.damage * .5, 6.4, 4.8, .85);
      }
    }
    if (phase >= 3 && enemy.specialCount % (phase === 4 ? 2 : 3) === 0) {
      enemy.dashTime = .34; enemy.dashX = dirX; enemy.dashZ = dirZ;
    }
    audio.play('boss'); cameraShake = Math.max(cameraShake, .28 + phase * .08);
  }

  function summonCommanderGuards(enemy, phase) {
    var count = phase === 1 ? 2 : phase === 2 ? 3 : phase === 3 ? 4 : 5;
    var pool = phase === 1 ? ['runner'] : (bossCycle % 2 === 0 ? ['shooter', 'tank'] : ['shooter', 'splitter']);
    for (var i = 0; i < count; i += 1) {
      var angle = i / count * Math.PI * 2 + run.elapsed;
      var type = pool[i % pool.length];
      spawnEnemy(type, { x: enemy.mesh.position.x + Math.cos(angle) * 3.2, z: enemy.mesh.position.z + Math.sin(angle) * 3.2, elite: phase >= 3 && i === 0 });
    }
  }

  function clearEnemyProjectiles() {
    enemyBulletPool.forEach(function (bullet) { if (bullet.active) deactivateBullet(bullet); });
  }

  function titanVolley(enemy, dirX, dirZ) {
    var base = Math.atan2(dirZ, dirX);
    for (var i = -2; i <= 2; i += 1) {
      var angle = base + i * .2;
      spawnEnemyBullet(enemy.mesh.position.x, enemy.mesh.position.z, Math.cos(angle), Math.sin(angle), enemy.damage);
    }
    if (Math.random() < .38) {
      for (var r = 0; r < 8; r += 1) {
        var radial = r / 8 * Math.PI * 2 + run.elapsed;
        spawnEnemyBullet(enemy.mesh.position.x, enemy.mesh.position.z, Math.cos(radial), Math.sin(radial), enemy.damage * .65);
      }
    }
  }

  function autoFire(target) {
    var dx = target.mesh.position.x - player.x;
    var dz = target.mesh.position.z - player.z;
    var base = Math.atan2(dz, dx);
    var count = Math.max(1, player.projectileCount);
    var spread = count > 1 ? .15 : 0;
    var damageScale = 1 / (1 + Math.max(0, count - 1) * .18);
    for (var i = 0; i < count; i += 1) {
      var offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
      var angle = base + offset;
      var critical = Math.random() < player.crit;
      spawnPlayerBullet(Math.cos(angle), Math.sin(angle), player.damage * damageScale * (critical ? 1.85 : 1) * (run.overdriveTime > 0 ? 1.2 : 1));
    }
    audio.play('shoot');
  }

  function spawnPlayerBullet(dirX, dirZ, damage) {
    var bullet = playerBulletPool.find(function (item) { return !item.active; });
    if (!bullet) return;
    bullet.active = true; bullet.life = 1.25 * (1 + (run.upgrades.velocity || 0) * .12); bullet.damage = damage; bullet.pierce = player.pierce;
    bullet.x = player.x + dirX * .7; bullet.z = player.z + dirZ * .7;
    bullet.vx = dirX * player.bulletSpeed; bullet.vz = dirZ * player.bulletSpeed;
    bullet.mesh.position.set(bullet.x, .72, bullet.z);
    bullet.mesh.scale.set(1, 1, 1);
    bullet.mesh.visible = true;
  }

  function spawnEnemyBullet(x, z, dirX, dirZ, damage, speed, life, scale) {
    var bullet = enemyBulletPool.find(function (item) { return !item.active; });
    if (!bullet) return;
    bullet.active = true; bullet.life = life || 3.5; bullet.damage = damage;
    speed = speed || 6.4; bullet.x = x; bullet.z = z; bullet.vx = dirX * speed; bullet.vz = dirZ * speed;
    bullet.mesh.position.set(x, .62, z); bullet.mesh.scale.setScalar(scale || 1); bullet.mesh.visible = true;
  }

  function updatePlayerBullets(dt) {
    playerBulletPool.forEach(function (bullet) {
      if (!bullet.active) return;
      bullet.life -= dt; bullet.x += bullet.vx * dt; bullet.z += bullet.vz * dt;
      bullet.mesh.position.x = bullet.x; bullet.mesh.position.z = bullet.z;
      bullet.mesh.rotation.x += dt * 8; bullet.mesh.rotation.y += dt * 11;
      if (bullet.life <= 0 || bullet.x * bullet.x + bullet.z * bullet.z > (CFG.arenaRadius + 3) * (CFG.arenaRadius + 3)) { deactivateBullet(bullet); return; }
      for (var i = 0; i < enemyPool.length; i += 1) {
        var enemy = enemyPool[i];
        if (!enemy.active) continue;
        var radius = .35 + ENEMY_TYPES[enemy.type].scale * .58;
        if (C.distanceSquared(bullet.x, bullet.z, enemy.mesh.position.x, enemy.mesh.position.z) < radius * radius) {
          damageEnemy(enemy, bullet.damage, bullet.x, bullet.z);
          if (bullet.pierce > 0) { bullet.pierce -= 1; bullet.damage *= .78; } else { deactivateBullet(bullet); break; }
        }
      }
    });
  }

  function updateEnemyBullets(dt) {
    enemyBulletPool.forEach(function (bullet) {
      if (!bullet.active) return;
      bullet.life -= dt; bullet.x += bullet.vx * dt; bullet.z += bullet.vz * dt;
      bullet.mesh.position.x = bullet.x; bullet.mesh.position.z = bullet.z;
      bullet.mesh.rotation.x += dt * 4; bullet.mesh.rotation.z += dt * 7;
      if (bullet.life <= 0 || bullet.x * bullet.x + bullet.z * bullet.z > (CFG.arenaRadius + 3) * (CFG.arenaRadius + 3)) { deactivateBullet(bullet); return; }
      if (C.distanceSquared(bullet.x, bullet.z, player.x, player.z) < .5) {
        damagePlayer(bullet.damage); deactivateBullet(bullet);
      }
    });
  }

  function deactivateBullet(bullet) { bullet.active = false; bullet.mesh.visible = false; }

  function damageEnemy(enemy, damage, hitX, hitZ) {
    if (!enemy.active) return;
    if (enemy.type === 'commander' && enemy.barrier > 0) damage *= .32;
    enemy.hp -= damage;
    var dx = enemy.mesh.position.x - hitX; var dz = enemy.mesh.position.z - hitZ;
    var distance = Math.sqrt(dx * dx + dz * dz) || 1;
    var knockFactor = ENEMY_TYPES[enemy.type].boss ? .2 : 1;
    enemy.knockX += dx / distance * Math.min(5, damage * .045) * knockFactor;
    enemy.knockZ += dz / distance * Math.min(5, damage * .045) * knockFactor;
    enemy.body.scale.setScalar(1.11);
    enemy.hitToken = (enemy.hitToken || 0) + 1;
    var hitToken = enemy.hitToken;
    window.setTimeout(function () { if (enemy.body && enemy.hitToken === hitToken) enemy.body.scale.setScalar(1); }, 55);
    burst(hitX, hitZ, ENEMY_TYPES[enemy.type].color, 2);
    if (enemy.hp <= 0) killEnemy(enemy);
  }

  function killEnemy(enemy) {
    var wasTitan = enemy.type === 'titan';
    var wasCommander = enemy.type === 'commander';
    var wasBoss = wasTitan || wasCommander;
    var wasElite = enemy.elite;
    var wasSplitter = enemy.type === 'splitter';
    var x = enemy.mesh.position.x; var z = enemy.mesh.position.z;
    enemy.active = false; enemy.mesh.visible = false;
    run.kills += 1;
    run.combo = Math.min(40, Math.floor(run.combo) + (wasElite ? 2 : 1));
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    if (run.maxCombo >= 30 && !save.achievements.comboMaster) { save.achievements.comboMaster = true; toast('Başarı: Kesintisiz Akış', '∞'); }
    run.comboTimer = 3.4;
    C.missionProgress(save, 'kills', 1);
    if (wasElite) { run.elites += 1; C.missionProgress(save, 'elite', 1); }
    player.lifeCounter += 1;
    if (player.lifeSteal > 0 && player.lifeCounter >= Math.max(7, 12 - player.lifeSteal * 2)) {
      player.lifeCounter = 0; player.hp = Math.min(player.maxHp, player.hp + 7);
    }
    addOverdrive((wasBoss ? 48 : wasElite ? 14 : 4 + Math.min(5, run.combo * .12)) * player.overdriveGain);
    spawnPickup('xp', x, z, Math.max(1, Math.round(enemy.xp * (1 + (save.permanent.fortune || 0) * .04))));
    if (Math.random() < .62 || wasBoss || wasElite) spawnPickup('coin', x + (Math.random() - .5) * .6, z + (Math.random() - .5) * .6, enemy.coins);
    if (Math.random() < (wasBoss ? .85 : wasElite ? .16 : .035)) spawnPickup('heal', x - .35, z + .25, wasBoss ? 32 : 18);
    burst(x, z, ENEMY_TYPES[enemy.type].color, wasBoss ? 30 : wasElite ? 12 : 7);
    audio.play(wasBoss ? 'level' : 'hit');

    if (wasSplitter) {
      for (var child = 0; child < 2; child += 1) spawnEnemy('runner', { x: x + (child ? .7 : -.7), z: z + (Math.random() - .5) * .8 });
    }

    if (wasTitan) {
      activeBoss = null; run.bosses += 1; C.missionProgress(save, 'boss', 1);
      save.achievements.titanSlayer = true;
      dom.bossBarWrap.classList.remove('active');
      showObjective('TITAN YOK EDİLDİ · KOMUTA SİNYALİ'); cameraShake = .8; haptic(70);
      for (var i = 0; i < 7; i += 1) spawnPickup('coin', x + (Math.random() - .5) * 2.4, z + (Math.random() - .5) * 2.4, 24);
      prepareCommanderArena();
      pendingCommander = 3.4;
    } else if (wasCommander) {
      activeBoss = null; run.bosses += 1; run.commanders += 1; C.missionProgress(save, 'commander', 1);
      dom.bossBarWrap.classList.remove('active');
      var firstVictory = !save.achievements.commanderDown;
      save.achievements.commanderDown = true;
      save.commanderKills += 1;
      save.gems += firstVictory ? 15 : 3;
      if (save.ownedSkins.indexOf('commander') < 0) save.ownedSkins.push('commander');
      persist();
      showObjective('BYMEL COMMANDER YENİLDİ'); cameraShake = 1; haptic(95);
      toast(firstVictory ? 'Command Protocol açıldı · +15 elmas' : 'Commander ödülü · +3 elmas', '⌬');
      for (var reward = 0; reward < 10; reward += 1) spawnPickup('coin', x + (Math.random() - .5) * 3, z + (Math.random() - .5) * 3, 35);
      clearEnemyProjectiles();
    }
  }

  function prepareCommanderArena() {
    enemyPool.forEach(function (enemy) {
      if (enemy.active && !ENEMY_TYPES[enemy.type].boss) { enemy.active = false; enemy.mesh.visible = false; }
    });
    clearEnemyProjectiles();
    showObjective('⚠ BYMEL COMMANDER YAKLAŞIYOR ⚠');
  }

  function addOverdrive(amount) {
    if (run.overdriveTime > 0) return;
    run.overdriveCharge = Math.min(100, run.overdriveCharge + amount);
    if (run.overdriveCharge >= 100) activateOverdrive();
  }

  function activateOverdrive() {
    run.overdriveCharge = 0;
    run.overdriveTime = run.overdriveDuration;
    dom.hud.classList.add('overdrive');
    showObjective('RIFT OVERDRIVE');
    audio.play('level'); haptic(42); cameraShake = .42;
  }

  function spawnPickup(type, x, z, value) {
    var item = pickupPool.find(function (pickup) { return !pickup.active; });
    if (!item) {
      if (type === 'xp') gainXp(value);
      else collectCoins(value);
      return;
    }
    item.active = true; item.type = type; item.value = value; item.x = x; item.z = z; item.life = 15;
    item.mesh.geometry = type === 'coin' ? shared.geo.coin : type === 'heal' ? shared.geo.heal : shared.geo.xp;
    item.mesh.material = type === 'coin' ? shared.mat.coin : type === 'heal' ? shared.mat.heal : shared.mat.xp;
    item.mesh.position.set(x, .42, z); item.mesh.scale.setScalar(type === 'coin' ? 1 : type === 'heal' ? 1.15 : .92); item.mesh.visible = true;
  }

  function updatePickups(dt) {
    pickupPool.forEach(function (item) {
      if (!item.active) return;
      item.life -= dt;
      var dx = player.x - item.x; var dz = player.z - item.z;
      var distSq = dx * dx + dz * dz;
      if (distSq < player.magnet * player.magnet) {
        var distance = Math.sqrt(distSq) || .01;
        var pull = 4 + (1 - Math.min(1, distance / player.magnet)) * 13;
        item.x += dx / distance * pull * dt;
        item.z += dz / distance * pull * dt;
      }
      item.mesh.position.set(item.x, .38 + Math.sin(run.elapsed * 5 + item.phase) * .12, item.z);
      item.mesh.rotation.y += dt * 3.5; item.mesh.rotation.x += dt * .8;
      if (C.distanceSquared(item.x, item.z, player.x, player.z) < .58) collectPickup(item);
      else if (item.life <= 0) { item.active = false; item.mesh.visible = false; }
    });
  }

  function collectPickup(item) {
    item.active = false; item.mesh.visible = false;
    if (item.type === 'coin') { collectCoins(item.value); audio.play('coin'); }
    else if (item.type === 'heal') { player.hp = Math.min(player.maxHp, player.hp + item.value); toast('Nano onarım +' + item.value, '+'); audio.play('xp'); }
    else { gainXp(item.value); audio.play('xp'); }
  }

  function collectCoins(value) {
    var amount = Math.max(1, Math.floor(value));
    run.coins += amount;
    C.missionProgress(save, 'coins', amount);
  }

  function gainXp(value) {
    run.xp += Math.max(1, value);
    if (run.xp >= run.xpNeed && mode === 'playing') openLevelUp();
  }

  function openLevelUp() {
    mode = 'levelup';
    run.xp -= run.xpNeed; run.level += 1; run.xpNeed = Math.floor(15 + Math.pow(run.level, 1.42) * 7);
    dom.newLevel.textContent = run.level;
    renderUpgradeChoices();
    showModal('levelup'); audio.play('level'); haptic(32);
  }

  function renderUpgradeChoices() {
    dom.upgradeChoices.innerHTML = '';
    var available = UPGRADES.filter(function (upgrade) { return (run.upgrades[upgrade.id] || 0) < upgrade.max; });
    var choices = C.shuffle(available.length ? available : UPGRADES).slice(0, 3);
    choices.forEach(function (upgrade) {
      var level = run.upgrades[upgrade.id] || 0;
      var button = document.createElement('button');
      button.className = 'upgrade-card';
      button.innerHTML = '<span class="up-icon">' + upgrade.icon + '</span><strong>' + upgrade.name + '</strong><p>' + upgrade.desc + '</p><small>' + (level ? 'SV. ' + level : 'YENİ') + '</small>';
      button.addEventListener('click', function () { chooseUpgrade(upgrade); });
      dom.upgradeChoices.appendChild(button);
    });
    dom.rerollButton.disabled = run.rerolls <= 0;
    dom.rerollButton.querySelector('span').textContent = run.rerolls;
  }

  function rerollUpgrades() {
    if (mode !== 'levelup' || run.rerolls <= 0) return;
    run.rerolls -= 1; renderUpgradeChoices(); audio.play('ui'); haptic(12);
  }

  function chooseUpgrade(upgrade) {
    var level = (run.upgrades[upgrade.id] || 0) + 1;
    run.upgrades[upgrade.id] = level;
    if (upgrade.id === 'damage') player.damage *= 1.22;
    else if (upgrade.id === 'fireRate') player.fireRate *= 1.16;
    else if (upgrade.id === 'multishot') player.projectileCount = Math.min(4, player.projectileCount + 1);
    else if (upgrade.id === 'speed') player.speed *= 1.12;
    else if (upgrade.id === 'health') { player.maxHp += 25; player.hp = Math.min(player.maxHp, player.hp + 25); }
    else if (upgrade.id === 'shield') player.shield += 35;
    else if (upgrade.id === 'crit') player.crit = Math.min(.48, player.crit + .08);
    else if (upgrade.id === 'magnet') player.magnet *= 1.3;
    else if (upgrade.id === 'dash') player.dashMax *= .86;
    else if (upgrade.id === 'orbital') player.orbitals = Math.min(3, player.orbitals + 1);
    else if (upgrade.id === 'lifesteal') player.lifeSteal = Math.min(3, player.lifeSteal + 1);
    else if (upgrade.id === 'nova') { player.novaPower *= 1.35; player.novaMax *= .92; }
    else if (upgrade.id === 'velocity') player.bulletSpeed *= 1.2;
    else if (upgrade.id === 'pierce') player.pierce = Math.min(3, player.pierce + 1);
    else if (upgrade.id === 'recovery') player.recovery = Math.min(4, player.recovery + 1);
    else if (upgrade.id === 'overdrive') { player.overdriveGain *= 1.22; run.overdriveDuration += .45; }
    hideModal('levelup'); mode = 'playing'; lastTime = performance.now(); audio.play('buy');
    toast(upgrade.name + ' etkinleştirildi', upgrade.icon);
    if (run.xp >= run.xpNeed) window.setTimeout(function () { if (mode === 'playing') openLevelUp(); }, 180);
  }

  function triggerDash() {
    if (mode !== 'playing' || player.dashCooldown > 0 || player.dashTime > 0) return;
    if (Math.abs(lastDirection.x) + Math.abs(lastDirection.z) < .1) { lastDirection.x = 0; lastDirection.z = -1; }
    player.dashTime = .2; player.dashCooldown = player.dashMax; player.invuln = Math.max(player.invuln, .34);
    run.dashUses += 1; C.missionProgress(save, 'dash', 1);
    audio.play('dash'); haptic(20); cameraShake = .16;
  }

  function triggerNova() {
    if (mode !== 'playing' || player.novaCooldown > 0) return;
    player.novaCooldown = player.novaMax;
    novaRing.position.set(player.x, .12, player.z); novaRing.scale.set(.7, .7, .7); novaRing.material.opacity = .92;
    enemyPool.forEach(function (enemy) {
      if (!enemy.active) return;
      var distanceSq = C.distanceSquared(player.x, player.z, enemy.mesh.position.x, enemy.mesh.position.z);
      if (distanceSq <= 9 * 9) {
        var bossScale = enemy.type === 'commander' ? .42 : enemy.type === 'titan' ? .65 : 1;
        var damage = player.damage * 4.1 * player.novaPower * bossScale * (run.overdriveTime > 0 ? 1.22 : 1);
        damageEnemy(enemy, damage, player.x, player.z);
        var distance = Math.sqrt(distanceSq) || 1;
        enemy.knockX += (enemy.mesh.position.x - player.x) / distance * 10;
        enemy.knockZ += (enemy.mesh.position.z - player.z) / distance * 10;
      }
    });
    enemyBulletPool.forEach(function (bullet) {
      if (bullet.active && C.distanceSquared(player.x, player.z, bullet.x, bullet.z) <= 10 * 10) deactivateBullet(bullet);
    });
    audio.play('nova'); haptic(45); cameraShake = .55;
  }

  function damagePlayer(amount) {
    if (mode !== 'playing' || player.invuln > 0) return;
    var damage = Math.max(1, amount);
    if (player.shield > 0) {
      var absorbed = Math.min(player.shield, damage); player.shield -= absorbed; damage -= absorbed;
    }
    if (damage > 0) player.hp -= damage;
    player.invuln = .48; cameraShake = .32; flashTimer = .16;
    dom.damageFlash.classList.add('show'); audio.play('hurt'); haptic(30);
    run.combo = 1; run.comboTimer = 0;
    if (player.hp <= 0) { player.hp = 0; finishRun(false); }
  }

  function updateNovaRing(dt) {
    if (novaRing.material.opacity <= 0) return;
    var scale = novaRing.scale.x + dt * 12;
    novaRing.scale.set(scale, scale, scale);
    novaRing.material.opacity = Math.max(0, novaRing.material.opacity - dt * 1.8);
  }

  function spawnTrail(x, z, color) {
    if (Math.random() > (save.settings.quality === 'low' ? .3 : .65)) return;
    var particle = particlePool.find(function (item) { return !item.active; });
    if (!particle) return;
    particle.active = true; particle.life = .32; particle.maxLife = .32;
    particle.vx = (Math.random() - .5) * .7; particle.vy = .5; particle.vz = (Math.random() - .5) * .7;
    particle.mesh.material.color.setHex(color); particle.mesh.material.opacity = .65;
    particle.mesh.position.set(x, .42, z); particle.mesh.scale.setScalar(1.8); particle.mesh.visible = true;
  }

  function burst(x, z, color, count) {
    if (save.settings.quality === 'low') count = Math.ceil(count * .45);
    for (var i = 0; i < count; i += 1) {
      var particle = particlePool.find(function (item) { return !item.active; });
      if (!particle) break;
      var angle = Math.random() * Math.PI * 2; var speed = 1.5 + Math.random() * 4;
      particle.active = true; particle.life = .28 + Math.random() * .42; particle.maxLife = particle.life;
      particle.vx = Math.cos(angle) * speed; particle.vz = Math.sin(angle) * speed; particle.vy = 1 + Math.random() * 2.8;
      particle.mesh.material.color.setHex(color); particle.mesh.material.opacity = .9;
      particle.mesh.position.set(x, .45 + Math.random() * .5, z); particle.mesh.scale.setScalar(.6 + Math.random()); particle.mesh.visible = true;
    }
  }

  function updateParticles(dt) {
    particlePool.forEach(function (particle) {
      if (!particle.active) return;
      particle.life -= dt; particle.vy -= 5.5 * dt;
      particle.mesh.position.x += particle.vx * dt; particle.mesh.position.y += particle.vy * dt; particle.mesh.position.z += particle.vz * dt;
      particle.mesh.rotation.x += dt * 6; particle.mesh.rotation.z += dt * 4;
      particle.mesh.material.opacity = Math.max(0, particle.life / particle.maxLife);
      if (particle.life <= 0) { particle.active = false; particle.mesh.visible = false; }
    });
  }

  function updateCamera(dt) {
    var targetX = player.x;
    var targetY = 14.5;
    var targetZ = player.z + 10.6;
    var smoothing = 1 - Math.pow(.0014, dt);
    camera.position.x = C.lerp(camera.position.x, targetX, smoothing);
    camera.position.y = C.lerp(camera.position.y, targetY, smoothing);
    camera.position.z = C.lerp(camera.position.z, targetZ, smoothing);
    if (cameraShake > 0) {
      cameraShake = Math.max(0, cameraShake - dt * 1.8);
      camera.position.x += (Math.random() - .5) * cameraShake;
      camera.position.y += (Math.random() - .5) * cameraShake * .32;
      camera.position.z += (Math.random() - .5) * cameraShake;
    }
    camera.lookAt(player.x, 0, player.z - 1.5);
    if (grid) { grid.position.x = Math.round(player.x); grid.position.z = Math.round(player.z); }
  }

  function updateHUD() {
    if (!run || !player) return;
    var hpRatio = C.clamp(player.hp / player.maxHp, 0, 1);
    dom.healthBar.style.width = (hpRatio * 100).toFixed(1) + '%';
    dom.shieldBar.style.width = (C.clamp(player.shield / player.maxHp, 0, 1) * 100).toFixed(1) + '%';
    dom.healthText.textContent = Math.ceil(player.hp) + (player.shield > 0 ? ' +' + Math.ceil(player.shield) : '');
    dom.xpBar.style.width = (C.clamp(run.xp / run.xpNeed, 0, 1) * 100).toFixed(1) + '%';
    dom.levelText.textContent = 'SV. ' + run.level;
    dom.waveText.textContent = 'DALGA ' + run.wave;
    dom.timerText.textContent = C.formatTime(run.elapsed);
    dom.runCoins.textContent = C.formatNumber(run.coins);
    dom.comboText.textContent = 'x' + Math.max(1, Math.floor(run.combo));
    var overdriveRatio = run.overdriveTime > 0 ? run.overdriveTime / run.overdriveDuration : run.overdriveCharge / 100;
    dom.overdriveBar.style.width = (C.clamp(overdriveRatio, 0, 1) * 100).toFixed(1) + '%';
    dom.overdriveText.textContent = run.overdriveTime > 0 ? run.overdriveTime.toFixed(1) + 'sn' : Math.floor(run.overdriveCharge) + '%';
    dom.dashCooldown.style.height = (C.clamp(player.dashCooldown / player.dashMax, 0, 1) * 100).toFixed(1) + '%';
    dom.novaCooldown.style.height = (C.clamp(player.novaCooldown / player.novaMax, 0, 1) * 100).toFixed(1) + '%';
    if (activeBoss && activeBoss.active) {
      dom.bossBarWrap.classList.add('active');
      dom.bossBar.style.width = (C.clamp(activeBoss.hp / activeBoss.maxHp, 0, 1) * 100).toFixed(1) + '%';
    } else dom.bossBarWrap.classList.remove('active');
  }

  function finishRun(abandoned) {
    if (!run || mode === 'results') return;
    mode = 'results';
    dom.hud.classList.remove('active');
    clearRunEntities();
    playerMesh.visible = true;
    playerMesh.position.set(0, 0, 0);
    C.missionProgress(save, 'survive', Math.floor(run.elapsed));
    run.score = C.calculateScore(run);
    var fortune = save.permanent.fortune || 0;
    var reward = Math.floor(run.coins * (1 + fortune * .09));
    save.gold += reward;
    save.pilotXp += Math.floor(run.score / 7);
    save.totalRuns += 1;
    save.totalKills += run.kills;
    save.totalBosses += run.bosses;
    save.bestWave = Math.max(save.bestWave || 1, run.wave);
    save.bestCombo = Math.max(save.bestCombo || 1, Math.floor(run.maxCombo));
    if (run.maxCombo >= 30) save.achievements.comboMaster = true;
    if (run.wave >= 10) save.achievements.waveTen = true;
    var isRecord = run.score > save.highScore;
    if (isRecord) save.highScore = run.score;
    persist();

    dom.resultEyebrow.textContent = abandoned ? 'KOŞU SONLANDIRILDI' : 'RIFT KAPANDI';
    dom.resultTitle.textContent = isRecord ? 'EFSANEVİ KOŞU!' : (abandoned ? 'SONRAKİNE DAHA İLERİ' : 'İYİ KOŞU!');
    dom.resultScore.textContent = C.formatNumber(run.score);
    dom.newRecord.classList.toggle('active', isRecord);
    dom.resultTime.textContent = C.formatTime(run.elapsed);
    dom.resultKills.textContent = run.kills;
    dom.resultCoins.textContent = '+' + C.formatNumber(reward);
    dom.resultWave.textContent = run.wave;
    dom.resultBosses.textContent = run.bosses + (run.commanders ? ' · C' + run.commanders : '');
    showModal('results');
    if (!abandoned) { audio.play('death'); haptic(70); }
    audio.stopMusic();
  }

  function openPanel(type, tab) {
    if (mode !== 'home') return;
    audio.unlock(); audio.play('ui');
    dom.panel.classList.add('active');
    renderPanel(type, tab);
  }

  function closePanel() {
    if (dom.panel) dom.panel.classList.remove('active');
  }

  function renderPanel(type, tab) {
    dom.panelTabs.innerHTML = '';
    dom.panelBody.innerHTML = '';
    if (type === 'shop') {
      dom.panelKicker.textContent = 'GÜVENLİ PLAY MAĞAZASI'; dom.panelTitle.textContent = 'MAĞAZA';
      var activeTab = tab || 'skins';
      addPanelTabs([{ id: 'skins', name: 'KAPLAMALAR' }, { id: 'currency', name: 'ELMAS & ALTIN' }], activeTab, function (id) { renderPanel('shop', id); });
      if (activeTab === 'currency') renderCurrencyShop(); else renderSkinShop();
    } else if (type === 'armory') {
      dom.panelKicker.textContent = 'KALICI PİLOT GELİŞİMİ'; dom.panelTitle.textContent = 'RIFT LAB';
      renderArmory();
    } else if (type === 'missions') {
      dom.panelKicker.textContent = 'GÜNLÜK HEDEFLER VE KARİYER'; dom.panelTitle.textContent = 'GÖREVLER';
      var missionTab = tab || 'daily';
      addPanelTabs([{ id: 'daily', name: 'GÜNLÜK' }, { id: 'records', name: 'KAYITLAR' }], missionTab, function (id) { renderPanel('missions', id); });
      if (missionTab === 'records') renderRecords(); else renderMissions();
    } else {
      dom.panelKicker.textContent = 'CİHAZINA GÖRE AYARLA'; dom.panelTitle.textContent = 'AYARLAR';
      renderSettings();
    }
  }

  function addPanelTabs(tabs, active, onSelect) {
    tabs.forEach(function (tab) {
      var button = document.createElement('button'); button.textContent = tab.name;
      button.classList.toggle('active', tab.id === active);
      button.addEventListener('click', function () { audio.play('ui'); onSelect(tab.id); });
      dom.panelTabs.appendChild(button);
    });
  }

  function renderSkinShop() {
    dom.panelBody.innerHTML = '<p class="section-label">PİLOT KAPLAMALARI</p><div class="item-grid" id="skinGrid"></div>';
    var gridNode = $('skinGrid');
    Object.keys(SKINS).forEach(function (id) {
      var skin = SKINS[id]; var owned = save.ownedSkins.indexOf(id) >= 0; var equipped = save.equippedSkin === id;
      var item = document.createElement('article'); item.className = 'shop-item';
      var price = skin.currency === 'gems' ? '◆ ' + skin.cost : skin.currency === 'gold' ? '● ' + skin.cost : skin.currency === 'achievement' ? 'COMMANDER ZAFERİ' : 'BAŞLANGIÇ PAKETİ';
      item.innerHTML = '<div class="item-art" style="color:#' + skin.color.toString(16).padStart(6, '0') + '">' + skin.icon + '</div><strong>' + skin.name + '</strong><p>' + skin.detail + '</p>' + (owned ? '<span class="owned">SAHİP</span>' : '') + '<button>' + (equipped ? 'KUŞANILDI' : owned ? 'KUŞAN' : price) + '</button>';
      var button = item.querySelector('button'); button.disabled = equipped || (!owned && (skin.currency === 'starter' || skin.currency === 'achievement'));
      button.addEventListener('click', function () { buyOrEquipSkin(skin); });
      gridNode.appendChild(item);
    });
  }

  function buyOrEquipSkin(skin) {
    var owned = save.ownedSkins.indexOf(skin.id) >= 0;
    if (!owned) {
      if (skin.currency === 'achievement') { toast('Bu kaplama Commander zaferiyle açılır', '⌬'); return; }
      var balance = skin.currency === 'gems' ? save.gems : save.gold;
      if (balance < skin.cost) { toast('Yeterli ' + (skin.currency === 'gems' ? 'elmas' : 'altın') + ' yok', '!'); return; }
      if (skin.currency === 'gems') save.gems -= skin.cost; else save.gold -= skin.cost;
      save.ownedSkins.push(skin.id); audio.play('buy'); haptic(22);
    }
    save.equippedSkin = skin.id; applySkin(skin.id); persist(); renderPanel('shop', 'skins');
    toast(skin.name + ' kuşanıldı', skin.icon);
  }

  function renderCurrencyShop() {
    var products = [
      { id: CFG.products.gems80, icon: '◆', name: '80 Elmas', detail: 'Kozmetik kaplamalar için', color: '#67eaff' },
      { id: CFG.products.gems500, icon: '◆', name: '500 Elmas', detail: 'En yüksek değerli elmas paketi', color: '#b776ff' },
      { id: CFG.products.gold12000, icon: '●', name: '12.000 Altın', detail: 'Rift Lab gelişimleri için', color: '#ffd34f' },
      { id: CFG.products.starter, icon: '☀', name: 'Başlangıç Paketi', detail: '250 elmas · 5.000 altın · Solar Flare', color: '#ff8d42' }
    ];
    dom.panelBody.innerHTML = '<p class="section-label">GOOGLE PLAY ÜRÜNLERİ</p><div class="item-grid" id="currencyGrid"></div><p class="legal-note">Fiyat ve para birimi Google Play tarafından bölgenize göre gösterilir. Satın alma yalnızca Play test/yayın kanalından kurulan sürümde açılır; teslim, başarılı satın alma doğrulamasından sonra yapılır.</p><button id="restorePurchases" class="restore-button">SATIN ALMALARI GERİ YÜKLE</button>';
    var gridNode = $('currencyGrid');
    products.forEach(function (product) {
      var item = document.createElement('article'); item.className = 'shop-item';
      var ownedLabel = product.id === CFG.products.starter && save.starterOwned ? '<span class="owned">SAHİP</span>' : '';
      item.innerHTML = '<div class="item-art" style="color:' + product.color + '">' + product.icon + '</div><strong>' + product.name + '</strong><p>' + product.detail + '</p>' + ownedLabel + '<button>' + (product.id === CFG.products.starter && save.starterOwned ? 'ALINDI' : 'PLAY\'DE GÖR') + '</button>';
      var button = item.querySelector('button'); button.disabled = product.id === CFG.products.starter && save.starterOwned;
      button.addEventListener('click', function () { purchaseProduct(product.id); });
      gridNode.appendChild(item);
    });
    $('restorePurchases').addEventListener('click', restorePurchases);
  }

  function purchaseProduct(productId) {
    toast('Google Play bağlantısı hazırlanıyor…', '◆');
    billing.purchase(productId).then(function (event) {
      grantPurchase(event);
    }).catch(function (error) {
      var message = error && error.code === 'PLAY_BUILD_REQUIRED' ? 'Ödeme, Google Play test/yayın sürümünde etkinleşir.' : ((error && error.message) || 'Satın alma tamamlanamadı.');
      toast(message, '!');
    });
  }

  function restorePurchases() {
    billing.restore().then(function (result) {
      if (result && Array.isArray(result.purchases)) result.purchases.forEach(grantPurchase);
      toast(result && result.ok ? 'Satın almalar kontrol edildi' : 'Geri yükleme Play sürümünde kullanılabilir', result && result.ok ? '✓' : '!');
    });
  }

  function handleBillingEvent(event) {
    if (event && event.type === 'purchase') grantPurchase(event);
  }

  function grantPurchase(event) {
    if (!event || event.ok !== true || event.verified !== true || !event.productId) { toast('Satın alma doğrulanamadı; içerik teslim edilmedi.', '!'); return false; }
    var token = event.purchaseToken || event.orderId || (event.productId + ':' + event.requestId);
    if (!token || save.processedPurchaseTokens.indexOf(token) >= 0) return false;
    save.processedPurchaseTokens.push(token); save.processedPurchaseTokens = save.processedPurchaseTokens.slice(-30);
    if (event.productId === CFG.products.gems80) save.gems += 80;
    else if (event.productId === CFG.products.gems500) save.gems += 500;
    else if (event.productId === CFG.products.gold12000) save.gold += 12000;
    else if (event.productId === CFG.products.starter && !save.starterOwned) {
      save.starterOwned = true; save.gems += 250; save.gold += 5000;
      if (save.ownedSkins.indexOf('solar') < 0) save.ownedSkins.push('solar');
    } else return false;
    persist(); audio.play('buy'); haptic(35); toast('Satın alma teslim edildi', '✓');
    if (dom.panel.classList.contains('active')) renderPanel('shop', 'currency');
    return true;
  }

  function renderArmory() {
    var definitions = [
      { id: 'power', icon: '⚡', name: 'Çekirdek Gücü', desc: 'Her seviyede başlangıç hasarı +%8,5', base: 420, max: 10 },
      { id: 'armor', icon: '⬡', name: 'Nano Zırh', desc: 'Her seviyede başlangıç canı +13', base: 470, max: 10 },
      { id: 'fortune', icon: '◎', name: 'Rift Şansı', desc: 'Toplanan altın +%9 ve XP +%4', base: 540, max: 10 },
      { id: 'reactor', icon: '∞', name: 'Reaktör Senkronu', desc: 'Dash/Nova beklemesini azaltır, Overdrive dolumunu artırır', base: 680, max: 10 }
    ];
    dom.panelBody.innerHTML = '<p class="section-label">KALICI GELİŞİMLER · MAKS. SV. 10</p><div id="armoryList" class="upgrade-list"></div>';
    var list = $('armoryList');
    definitions.forEach(function (definition) {
      var level = save.permanent[definition.id] || 0; var cost = C.upgradeCost(level, definition.base); var maxed = level >= definition.max;
      var pips = ''; for (var i = 0; i < definition.max; i += 1) pips += '<i class="' + (i < level ? 'active' : '') + '"></i>';
      var item = document.createElement('article'); item.className = 'upgrade-item';
      item.innerHTML = '<div class="item-art">' + definition.icon + '</div><div><strong>' + definition.name + ' · SV. ' + level + '</strong><p>' + definition.desc + '</p><div class="level-pips">' + pips + '</div></div><button>' + (maxed ? 'MAKS.' : '● ' + C.formatNumber(cost)) + '</button>';
      var button = item.querySelector('button'); button.disabled = maxed;
      button.addEventListener('click', function () { buyPermanent(definition, cost); });
      list.appendChild(item);
    });
  }

  function buyPermanent(definition, cost) {
    if (save.gold < cost) { toast('Yeterli altın yok', '!'); return; }
    if ((save.permanent[definition.id] || 0) >= definition.max) return;
    save.gold -= cost; save.permanent[definition.id] += 1; persist(); audio.play('buy'); haptic(22); renderPanel('armory');
    toast(definition.name + ' yükseltildi', definition.icon);
  }

  function renderMissions() {
    dom.panelBody.innerHTML = '<p class="section-label">BUGÜN · ' + save.missionsDay + '</p><div id="missionList" class="mission-list"></div>';
    var list = $('missionList');
    (save.missions || []).forEach(function (mission) {
      var done = mission.progress >= mission.target; var percent = C.clamp(mission.progress / mission.target, 0, 1) * 100;
      var item = document.createElement('article'); item.className = 'mission-item';
      item.innerHTML = '<div class="item-art">' + (mission.claimed ? '✓' : done ? '★' : '⌁') + '</div><div><strong>' + mission.title + '</strong><p>' + mission.detail + ' · ' + Math.floor(mission.progress) + '/' + mission.target + '</p><div class="mission-progress"><i style="width:' + percent + '%"></i></div></div><button>' + (mission.claimed ? 'ALINDI' : done ? (mission.type === 'gems' ? '◆ ' : '● ') + mission.reward : 'DEVAM') + '</button>';
      var button = item.querySelector('button'); button.disabled = !done || mission.claimed;
      button.addEventListener('click', function () { claimMission(mission.id); });
      list.appendChild(item);
    });
  }

  function renderRecords() {
    var pilotLevel = 1 + Math.floor(Math.sqrt((save.pilotXp || 0) / 600));
    dom.panelBody.innerHTML = '<p class="section-label">PİLOT KARİYERİ</p><div class="record-list">' +
      recordCard('PİLOT SEVİYESİ', pilotLevel, 'Kalıcı XP ile yükselir') +
      recordCard('EN İYİ DALGA', save.bestWave || 1, 'Daha yüksek tehdit ve elit oranı') +
      recordCard('COMMANDER ZAFERİ', save.commanderKills || 0, 'Her zafer kalıcı elmas kazandırır') +
      recordCard('EN YÜKSEK KOMBO', 'x' + (save.bestCombo || 1), '30 kombo özel başarı açar') +
      recordCard('TOPLAM YOK ETME', C.formatNumber(save.totalKills || 0), 'Tüm koşuların toplamı') +
      recordCard('TOPLAM BOSS', save.totalBosses || 0, 'Titan ve Commander toplamı') +
      '</div><div class="achievement-list">' +
      achievementRow(save.achievements.titanSlayer, '♛', 'Titan Avcısı', 'Bir Rift Titan yen') +
      achievementRow(save.achievements.commanderDown, '⌬', 'Komuta Kesildi', 'BYMEL COMMANDER yen ve Command Protocol aç') +
      achievementRow(save.achievements.comboMaster, '∞', 'Kesintisiz Akış', '30 komboya ulaş') +
      achievementRow(save.achievements.waveTen, '◇', 'Derin Rift', '10. dalgaya ulaş') +
      '</div>';
  }

  function recordCard(label, value, detail) {
    return '<article class="record-card"><small>' + label + '</small><b>' + value + '</b><span>' + detail + '</span></article>';
  }

  function achievementRow(active, icon, title, detail) {
    return '<article class="achievement ' + (active ? 'active' : '') + '"><i>' + (active ? icon : '×') + '</i><div><strong>' + title + '</strong><small>' + detail + '</small></div></article>';
  }

  function claimMission(id) {
    var mission = (save.missions || []).find(function (item) { return item.id === id; });
    if (!mission || mission.claimed || mission.progress < mission.target) return;
    mission.claimed = true; if (mission.type === 'gems') save.gems += mission.reward; else save.gold += mission.reward;
    persist(); audio.play('buy'); haptic(22); renderPanel('missions'); toast('Görev ödülü alındı', '★');
  }

  function renderSettings() {
    var settings = save.settings;
    dom.panelBody.innerHTML = '<div class="settings-list">' +
      settingToggle('music', 'Müzik', 'Prosedürel neon müziği', settings.music) +
      settingToggle('sfx', 'Ses efektleri', 'Atış, darbe ve arayüz sesleri', settings.sfx) +
      settingToggle('haptics', 'Titreşim', 'Desteklenen cihazlarda dokunsal geri bildirim', settings.haptics) +
      settingToggle('fps', 'FPS göstergesi', 'Performans sayacını göster', settings.fps) +
      '<article class="setting-item"><div><strong>Grafik kalitesi</strong><small>Otomatik mod FPS\'e göre çözünürlüğü ayarlar</small></div><div class="quality-buttons"><button data-quality="low">DÜŞÜK</button><button data-quality="auto">OTO</button><button data-quality="high">YÜKSEK</button></div></article>' +
      '</div><p class="legal-note">Neon Rift v' + CFG.version + ' · ' + CFG.studio + '<br>Paket: ' + CFG.packageName + '<br>Kayıt: ' + saveStatus.storage + ' · ' + (saveStatus.encrypted ? 'şifreli' : 'imzalı/fallback') + ' · ' + saveStatus.code + '<br>Canlı mağaza ürünleri Google Play hesabınız üzerinden yönetilir.</p>';
    dom.panelBody.querySelectorAll('.toggle').forEach(function (toggle) {
      toggle.addEventListener('click', function () { toggleSetting(toggle.getAttribute('data-setting')); });
    });
    dom.panelBody.querySelectorAll('[data-quality]').forEach(function (button) {
      var quality = button.getAttribute('data-quality'); button.classList.toggle('active', quality === settings.quality);
      button.addEventListener('click', function () { save.settings.quality = quality; renderScale = 1; persist(); renderer.setPixelRatio(pixelRatioForQuality()); renderPanel('settings'); });
    });
  }

  function settingToggle(id, name, detail, enabled) {
    return '<article class="setting-item"><div><strong>' + name + '</strong><small>' + detail + '</small></div><button class="toggle ' + (enabled ? 'on' : '') + '" data-setting="' + id + '"><i></i></button></article>';
  }

  function toggleSetting(key) {
    save.settings[key] = !save.settings[key]; persist(); audio.setSettings(save.settings);
    if (key === 'music') { if (save.settings.music) audio.startMusic(); else audio.stopMusic(); }
    audio.play('ui'); renderPanel('settings');
  }

  boot();
}());
