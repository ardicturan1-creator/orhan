import * as THREE from 'three';

/* =========================================================
   NEON DRIFT — 3D endless lane-dodger
   Self-contained, offline, touch + keyboard controlled.
========================================================= */

/* ---------- constants ---------- */
const LANE_X = [-2.4, 0, 2.4];
const GROUND_Y = 0;
const GRAVITY = -28;
const JUMP_VELOCITY = 11.5;
const CLEAR_HEIGHT = 1.05;
const PLAYER_Z = 0;
const SPAWN_Z = -90;
const DESPAWN_Z = 9;
const BASE_SPEED = 13;
const MAX_SPEED = 34;
const SPEED_RAMP = 0.055; // speed gain per meter travelled
const SEGMENT_LEN = 15;
const LANE_LERP = 10;

const STATE = { MENU: 'menu', PLAYING: 'playing', GAMEOVER: 'gameover' };

/* ---------- DOM ---------- */
const canvas = document.getElementById('c');
const hud = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const bestHudEl = document.getElementById('bestHud');
const comboEl = document.getElementById('combo');
const shieldEl = document.getElementById('shieldIcon');
const menuScreen = document.getElementById('menuScreen');
const overScreen = document.getElementById('overScreen');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl = document.getElementById('bestScore');
const newBestEl = document.getElementById('newBest');
const startBtn = document.getElementById('startBtn');
const retryBtn = document.getElementById('retryBtn');
const flashEl = document.getElementById('flash');

/* ---------- persistence ---------- */
function loadBest() {
  try { return parseInt(localStorage.getItem('neonDriftBest') || '0', 10) || 0; }
  catch (e) { return 0; }
}
function saveBest(v) {
  try { localStorage.setItem('neonDriftBest', String(v)); } catch (e) { /* ignore */ }
}
let bestScore = loadBest();
bestHudEl.textContent = String(bestScore);

/* ---------- audio (procedural, no assets) ---------- */
let actx = null;
function ensureAudio() {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { actx = null; }
  } else if (actx.state === 'suspended') {
    actx.resume().catch(() => {});
  }
}
function tone(freq, dur, type, gain, glideTo) {
  if (!actx) return;
  const t0 = actx.currentTime;
  const osc = actx.createOscillator();
  const g = actx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain || 0.2, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(actx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}
const sfx = {
  swipe: () => tone(520, 0.08, 'square', 0.06),
  jump: () => tone(320, 0.18, 'triangle', 0.12, 700),
  coin: () => tone(880, 0.12, 'sine', 0.15, 1400),
  shieldGet: () => { tone(500, 0.1, 'sine', 0.14, 900); setTimeout(() => tone(900, 0.12, 'sine', 0.12, 1300), 70); },
  shieldBreak: () => tone(200, 0.25, 'sawtooth', 0.15, 60),
  hit: () => tone(140, 0.35, 'sawtooth', 0.2, 40),
  gameover: () => { tone(300, 0.2, 'sawtooth', 0.15, 120); setTimeout(() => tone(180, 0.35, 'sawtooth', 0.15, 60), 150); },
  start: () => { tone(440, 0.1, 'sine', 0.12, 660); setTimeout(() => tone(660, 0.14, 'sine', 0.12, 990), 90); },
};

/* ---------- renderer / scene ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const CLEAR_COLOR = 0x0a0715;
renderer.setClearColor(CLEAR_COLOR, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(CLEAR_COLOR, 22, 95);

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 200);
const camBaseX = 0, camBaseY = 3.4, camBaseZ = 8.2;
camera.position.set(camBaseX, camBaseY, camBaseZ);
camera.lookAt(0, 1.1, -14);

scene.add(new THREE.AmbientLight(0x8888ff, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(-6, 12, 6);
scene.add(sun);
const rim = new THREE.PointLight(0x4fd6ff, 1.4, 40);
rim.position.set(0, 4, PLAYER_Z + 4);
scene.add(rim);

/* ---------- procedural textures ---------- */
function makeGridTexture() {
  const size = 256;
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = '#0d0a1f';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(90,220,255,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(size, 0);
  ctx.moveTo(0, size); ctx.lineTo(size, size);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90,120,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(cvs);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 40);
  return tex;
}
function makeGlowSprite(hex) {
  const size = 64;
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext('2d');
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const c = new THREE.Color(hex);
  const cs = `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},`;
  grd.addColorStop(0, cs + '1)');
  grd.addColorStop(0.4, cs + '0.55)');
  grd.addColorStop(1, cs + '0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cvs);
  return tex;
}
const glowTexCyan = makeGlowSprite(0x4fe0ff);
const glowTexGold = makeGlowSprite(0xffd24f);
const glowTexPink = makeGlowSprite(0xff4fd6);

/* ---------- ground ---------- */
const groundTex = makeGridTexture();
const groundGeo = new THREE.PlaneGeometry(12, 1200, 1, 1);
const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, emissive: 0x1a1440, emissiveIntensity: 0.4, roughness: 0.9 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, 0, -560);
scene.add(ground);

/* lane edge glow strips */
const stripMat = new THREE.MeshBasicMaterial({ color: 0x4fe0ff, transparent: true, opacity: 0.85 });
const strips = [];
for (const x of [-3.6, 3.6]) {
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1200), stripMat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(x, 0.02, -560);
  scene.add(strip);
  strips.push(strip);
}

/* ---------- player ---------- */
const player = new THREE.Group();
const bodyGeo = new THREE.IcosahedronGeometry(0.55, 1);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7dd8ff, emissive: 0x2fb8ff, emissiveIntensity: 1.1, metalness: 0.3, roughness: 0.25 });
const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
player.add(bodyMesh);
const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexCyan, transparent: true, depthWrite: false, opacity: 0.9, blending: THREE.AdditiveBlending }));
glowSprite.scale.set(2.6, 2.6, 1);
player.add(glowSprite);
player.position.set(LANE_X[1], GROUND_Y + 0.55, PLAYER_Z);
scene.add(player);

/* shield visual */
const shieldMesh = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.85, 1),
  new THREE.MeshBasicMaterial({ color: 0x4fe0ff, wireframe: true, transparent: true, opacity: 0.7 })
);
shieldMesh.visible = false;
player.add(shieldMesh);

/* ---------- pools ---------- */
function makeGlowMesh(geo, color, glowTex) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.0, metalness: 0.2, roughness: 0.35 });
  const mesh = new THREE.Mesh(geo, mat);
  g.add(mesh);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0.85, blending: THREE.AdditiveBlending }));
  spr.scale.set(1.6, 1.6, 1);
  g.add(spr);
  g.visible = false;
  scene.add(g);
  return g;
}

const POOL_SIZE = 24;
const obstacles = [];
const coins = [];
const shields = [];
const barrierGeo = new THREE.BoxGeometry(1.5, 2.0, 0.7);
const lowGeo = new THREE.BoxGeometry(1.5, 0.85, 0.7);
const coinGeo = new THREE.OctahedronGeometry(0.4, 0);
const shieldGeo = new THREE.OctahedronGeometry(0.42, 0);

for (let i = 0; i < POOL_SIZE; i++) {
  const tall = makeGlowMesh(barrierGeo, 0xff3d7a, glowTexPink);
  tall.userData = { kind: 'obstacle', type: 'lane', lane: 0, z: 0, active: false, cleared: false };
  obstacles.push(tall);
}
for (let i = 0; i < POOL_SIZE; i++) {
  const c = makeGlowMesh(coinGeo, 0xffd24f, glowTexGold);
  c.userData = { kind: 'coin', lane: 0, z: 0, active: false };
  coins.push(c);
}
for (let i = 0; i < 6; i++) {
  const s = makeGlowMesh(shieldGeo, 0x4fe0ff, glowTexCyan);
  s.userData = { kind: 'shield', lane: 0, z: 0, active: false };
  shields.push(s);
}
function freeFrom(pool) { return pool.find(o => !o.userData.active); }

/* ---------- particles (simple pooled sprites) ---------- */
const PARTICLE_COUNT = 60;
const particles = [];
const particleMat = (tex) => new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1 });
for (let i = 0; i < PARTICLE_COUNT; i++) {
  const spr = new THREE.Sprite(particleMat(glowTexCyan));
  spr.visible = false;
  spr.scale.set(0.4, 0.4, 1);
  scene.add(spr);
  particles.push({ obj: spr, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1 });
}
function burst(pos, color, count, speed) {
  const tex = color === 'gold' ? glowTexGold : (color === 'pink' ? glowTexPink : glowTexCyan);
  let spawned = 0;
  for (const p of particles) {
    if (p.life > 0) continue;
    p.obj.material.map = tex;
    p.obj.visible = true;
    p.obj.position.copy(pos);
    const ang = Math.random() * Math.PI * 2;
    const spd = (0.5 + Math.random()) * speed;
    p.vx = Math.cos(ang) * spd;
    p.vy = (0.6 + Math.random() * 1.2) * speed;
    p.vz = Math.sin(ang) * spd;
    p.life = p.maxLife = 0.5 + Math.random() * 0.35;
    p.obj.scale.setScalar(0.28 + Math.random() * 0.22);
    spawned++;
    if (spawned >= count) break;
  }
}
function updateParticles(dt) {
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.obj.visible = false; continue; }
    p.vy += GRAVITY * 0.25 * dt;
    p.obj.position.x += p.vx * dt;
    p.obj.position.y += p.vy * dt;
    p.obj.position.z += p.vz * dt;
    const t = p.life / p.maxLife;
    p.obj.material.opacity = t;
  }
}

/* ---------- trail behind player ---------- */
let trailTimer = 0;
function updateTrail(dt) {
  trailTimer -= dt;
  if (trailTimer <= 0 && game.state === STATE.PLAYING) {
    trailTimer = 0.03;
    for (const p of particles) {
      if (p.life > 0) continue;
      p.obj.material.map = glowTexCyan;
      p.obj.visible = true;
      p.obj.position.set(player.position.x + (Math.random() - 0.5) * 0.2, player.position.y - 0.2, player.position.z + 0.3);
      p.vx = (Math.random() - 0.5) * 0.4;
      p.vy = 0.3 + Math.random() * 0.4;
      p.vz = 2.5;
      p.life = p.maxLife = 0.35;
      p.obj.scale.setScalar(0.22);
      break;
    }
  }
}

/* ---------- game state ---------- */
const game = {
  state: STATE.MENU,
  distance: 0,
  speed: BASE_SPEED,
  lane: 1,
  targetLaneX: LANE_X[1],
  vy: 0,
  jumping: false,
  score: 0,
  coinsCollected: 0,
  combo: 1,
  shielded: false,
  invulnT: 0,
  nextSpawnZ: 30,
  shakeT: 0,
  flashT: 0,
};

function resetGame() {
  for (const o of obstacles) { o.userData.active = false; o.visible = false; }
  for (const c of coins) { c.userData.active = false; c.visible = false; }
  for (const s of shields) { s.userData.active = false; s.visible = false; }
  game.distance = 0;
  game.speed = BASE_SPEED;
  game.lane = 1;
  game.targetLaneX = LANE_X[1];
  player.position.x = LANE_X[1];
  game.vy = 0;
  game.jumping = false;
  game.score = 0;
  game.coinsCollected = 0;
  game.combo = 1;
  game.shielded = false;
  game.invulnT = 0;
  game.nextSpawnZ = 30;
  game.shakeT = 0;
  game.flashT = 0;
  shieldMesh.visible = false;
  scoreEl.textContent = '0';
  comboEl.textContent = 'x1';
  shieldEl.classList.remove('on');
}

/* ---------- spawning ---------- */
function spawnPattern(z) {
  const r = Math.random();
  const blockedLanes = [];
  if (r < 0.32) {
    blockedLanes.push(Math.floor(Math.random() * 3));
  } else if (r < 0.5) {
    const a = Math.floor(Math.random() * 3);
    let b = Math.floor(Math.random() * 3);
    if (b === a) b = (b + 1) % 3;
    blockedLanes.push(a, b);
  }
  for (let lane = 0; lane < 3; lane++) {
    if (blockedLanes.includes(lane)) {
      const type = Math.random() < 0.45 ? 'jump' : 'lane';
      const m = freeFrom(obstacles);
      if (m) {
        m.userData.active = true;
        m.userData.type = type;
        m.userData.cleared = false;
        m.userData.lane = lane;
        m.children[0].geometry = type === 'jump' ? lowGeo : barrierGeo;
        m.position.set(LANE_X[lane], type === 'jump' ? 0.42 : 1.0, z);
        m.children[1].position.y = type === 'jump' ? 0 : 0.2;
        m.visible = true;
      }
    } else if (Math.random() < 0.85) {
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const c = freeFrom(coins);
        if (!c) break;
        c.userData.active = true;
        c.userData.lane = lane;
        c.position.set(LANE_X[lane], 0.9, z - i * 1.6);
        c.visible = true;
      }
    }
  }
  if (Math.random() < 0.06) {
    const freeLanes = [0, 1, 2].filter(l => !blockedLanes.includes(l));
    const lane = freeLanes[Math.floor(Math.random() * freeLanes.length)];
    const s = freeFrom(shields);
    if (s) {
      s.userData.active = true;
      s.userData.lane = lane;
      s.position.set(LANE_X[lane], 1.0, z - 8);
      s.visible = true;
    }
  }
}

/* ---------- input ---------- */
function changeLane(dir) {
  if (game.state !== STATE.PLAYING) return;
  const next = game.lane + dir;
  if (next < 0 || next > 2) return;
  game.lane = next;
  game.targetLaneX = LANE_X[next];
  sfx.swipe();
}
function doJump() {
  if (game.state !== STATE.PLAYING) return;
  if (!game.jumping) {
    game.jumping = true;
    game.vy = JUMP_VELOCITY;
    sfx.jump();
  }
}

let touchStartX = 0, touchStartY = 0, touchStartT = 0, touching = false;
canvas.addEventListener('touchstart', (e) => {
  ensureAudio();
  if (game.state !== STATE.PLAYING) return;
  const t = e.changedTouches[0];
  touchStartX = t.clientX; touchStartY = t.clientY; touchStartT = performance.now();
  touching = true;
}, { passive: true });
canvas.addEventListener('touchend', (e) => {
  if (!touching) return;
  touching = false;
  if (game.state !== STATE.PLAYING) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  const THRESH = 32;
  if (adx > THRESH && adx > ady) {
    changeLane(dx > 0 ? 1 : -1);
  } else if (dy < -THRESH && ady > adx) {
    doJump();
  } else if (adx < THRESH && ady < THRESH) {
    doJump();
  }
}, { passive: true });

window.addEventListener('keydown', (e) => {
  ensureAudio();
  if (game.state !== STATE.PLAYING) return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') changeLane(-1);
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') changeLane(1);
  else if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') doJump();
});

/* ---------- collision resolution ---------- */
function onHit() {
  if (game.invulnT > 0) return;
  if (game.shielded) {
    game.shielded = false;
    shieldMesh.visible = false;
    shieldEl.classList.remove('on');
    game.invulnT = 1.1;
    game.combo = 1;
    comboEl.textContent = 'x1';
    sfx.shieldBreak();
    burst(player.position, 'cyan', 18, 4);
    game.shakeT = 0.25;
    return;
  }
  endGame();
}

function endGame() {
  if (game.state !== STATE.PLAYING) return;
  game.state = STATE.GAMEOVER;
  sfx.gameover();
  game.shakeT = 0.5;
  game.flashT = 0.35;
  burst(player.position, 'pink', 34, 6);
  const finalScore = Math.floor(game.score);
  finalScoreEl.textContent = String(finalScore);
  if (finalScore > bestScore) {
    bestScore = finalScore;
    saveBest(bestScore);
    newBestEl.style.display = 'block';
  } else {
    newBestEl.style.display = 'none';
  }
  bestScoreEl.textContent = String(bestScore);
  bestHudEl.textContent = String(bestScore);
  setTimeout(() => {
    overScreen.classList.add('visible');
    hud.classList.remove('visible');
  }, 550);
}

/* ---------- main update ---------- */
let lastT = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  let dt = (now - lastT) / 1000;
  if (dt > 0.05) dt = 0.05;
  lastT = now;

  updateParticles(dt);

  if (game.state === STATE.PLAYING) {
    game.speed = Math.min(MAX_SPEED, BASE_SPEED + game.distance * SPEED_RAMP);
    const dz = game.speed * dt;
    game.distance += dz;
    game.score += dz * game.combo;
    scoreEl.textContent = String(Math.floor(game.score));

    if (game.invulnT > 0) game.invulnT -= dt;

    player.position.x += (game.targetLaneX - player.position.x) * Math.min(1, LANE_LERP * dt);
    const tiltTarget = (game.targetLaneX - player.position.x) * -0.25;
    player.rotation.z += (tiltTarget - player.rotation.z) * Math.min(1, 8 * dt);
    player.rotation.y += dt * 1.4;

    if (game.jumping) {
      game.vy += GRAVITY * dt;
      player.position.y += game.vy * dt;
      if (player.position.y <= GROUND_Y + 0.55) {
        player.position.y = GROUND_Y + 0.55;
        game.jumping = false;
        game.vy = 0;
      }
    }
    shieldMesh.visible = game.shielded;
    if (game.shielded) shieldMesh.rotation.y += dt * 2;
    shieldEl.classList.toggle('on', game.shielded);

    updateTrail(dt);

    groundTex.offset.y += dz * 0.09;
    for (const strip of strips) { /* static, fog handles depth */ void strip; }

    // move + recycle obstacles
    for (const o of obstacles) {
      if (!o.userData.active) continue;
      o.position.z += dz;
      o.rotation.y += dt * 1.5;
      if (o.position.z > DESPAWN_Z) { o.userData.active = false; o.visible = false; continue; }
      if (game.invulnT <= 0 && Math.abs(o.position.z - PLAYER_Z) < 0.55 && o.userData.lane === game.lane) {
        if (o.userData.type === 'jump' && player.position.y > CLEAR_HEIGHT) {
          // cleared by jump
        } else {
          o.userData.active = false; o.visible = false;
          sfx.hit();
          burst(player.position, 'pink', 22, 5);
          game.shakeT = 0.3;
          flashEl.style.opacity = '0.55';
          onHit();
        }
      }
    }
    for (const c of coins) {
      if (!c.userData.active) continue;
      c.position.z += dz;
      c.rotation.y += dt * 3;
      c.position.y = 0.9 + Math.sin(now * 0.006 + c.position.x) * 0.08;
      if (c.position.z > DESPAWN_Z) { c.userData.active = false; c.visible = false; continue; }
      if (Math.abs(c.position.z - PLAYER_Z) < 0.7 && c.userData.lane === game.lane) {
        c.userData.active = false; c.visible = false;
        game.coinsCollected++;
        if (game.coinsCollected % 10 === 0) {
          game.combo = Math.min(8, game.combo + 1);
          comboEl.textContent = 'x' + game.combo;
        }
        game.score += 10 * game.combo;
        sfx.coin();
        burst(c.position, 'gold', 10, 3);
      }
    }
    for (const s of shields) {
      if (!s.userData.active) continue;
      s.position.z += dz;
      s.rotation.y += dt * 2.2;
      if (s.position.z > DESPAWN_Z) { s.userData.active = false; s.visible = false; continue; }
      if (Math.abs(s.position.z - PLAYER_Z) < 0.75 && s.userData.lane === game.lane) {
        s.userData.active = false; s.visible = false;
        game.shielded = true;
        sfx.shieldGet();
        burst(s.position, 'cyan', 14, 3.5);
      }
    }

    if (game.distance > game.nextSpawnZ) {
      spawnPattern(SPAWN_Z);
      const interval = Math.max(9, SEGMENT_LEN - game.distance * 0.01);
      game.nextSpawnZ = game.distance + interval;
    }
  }

  if (game.shakeT > 0) {
    game.shakeT -= dt;
    const s = Math.max(0, game.shakeT) * 0.6;
    camera.position.set(camBaseX + (Math.random() - 0.5) * s, camBaseY + (Math.random() - 0.5) * s, camBaseZ);
  } else {
    camera.position.set(camBaseX, camBaseY, camBaseZ);
  }
  if (game.flashT > 0) {
    game.flashT -= dt;
    flashEl.style.opacity = String(Math.max(0, game.flashT / 0.35) * 0.55);
  } else if (flashEl.style.opacity !== '0') {
    flashEl.style.opacity = '0';
  }

  camera.lookAt(player.position.x * 0.3, 1.1, PLAYER_Z - 14);
  renderer.render(scene, camera);
}

/* ---------- resize ---------- */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, true);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

/* ---------- UI wiring ---------- */
function startGame() {
  ensureAudio();
  resetGame();
  game.state = STATE.PLAYING;
  menuScreen.classList.remove('visible');
  overScreen.classList.remove('visible');
  hud.classList.add('visible');
  sfx.start();
}
startBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', startGame);
startBtn.addEventListener('touchend', (e) => { e.preventDefault(); startGame(); });
retryBtn.addEventListener('touchend', (e) => { e.preventDefault(); startGame(); });

/* ---------- global error guard ---------- */
window.addEventListener('error', (e) => {
  const el = document.getElementById('errBox');
  if (el) {
    el.style.display = 'block';
    el.textContent = 'Bir sorun oluştu: ' + (e.message || 'bilinmeyen hata');
  }
});

menuScreen.classList.add('visible');
requestAnimationFrame(tick);
