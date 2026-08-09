'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Android paket kimliği istenen büyük-küçük harf biçimindedir', () => {
  const gradle = read('android/app/build.gradle');
  const config = read('game/js/config.js');
  assert.match(gradle, /applicationId 'com\.bymel\.Neonrift'/);
  assert.match(gradle, /namespace 'com\.bymel\.Neonrift'/);
  assert.match(config, /packageName: 'com\.bymel\.Neonrift'/);
});

test('güvenli kayıt Android data alanı ve şifreleme köprüsünü kullanır', () => {
  const bridge = read('android/app/src/main/java/com/bymel/Neonrift/SecureSaveBridge.java');
  assert.match(bridge, /getExternalFilesDir\("NeonRift"\)/);
  assert.match(bridge, /AES\/GCM\/NoPadding/);
  assert.match(bridge, /HmacSHA256/);
  assert.match(bridge, /CORRUPT_OR_TAMPERED/);
  const game = read('game/js/game.js');
  assert.match(game, /if \(storedNatively\)[\s\S]*localStorage\.removeItem/);
});

test('release bütünlük korumaları kaynakta etkindir', () => {
  const guard = read('android/app/src/main/java/com/bymel/Neonrift/IntegrityGuard.java');
  const activity = read('android/app/src/main/java/com/bymel/Neonrift/MainActivity.java');
  assert.match(guard, /EXPECTED_SIGNING_CERT_SHA256/);
  assert.match(guard, /GAME_ASSET_SHA256/);
  assert.match(activity, /FLAG_SECURE/);
  assert.match(activity, /setWebContentsDebuggingEnabled\(BuildConfig\.DEBUG\)/);
});

test('Titan sonrası BYMEL COMMANDER akışı ve dört faz (öfke fazı dahil) bulunur', () => {
  const game = read('game/js/game.js');
  assert.match(game, /pendingCommander = 3\.4/);
  assert.match(game, /spawnEnemy\('commander'\)/);
  assert.match(game, /BYMEL COMMANDER/);
  assert.match(game, /ratio > \.62 \? 1 : ratio > \.34 \? 2 : ratio > \.13 \? 3 : 4/);
  assert.match(game, /ÇILGINA DÖNDÜ/);
  assert.match(game, /dueBossWave = wave - \(wave % 4\)/);
});

test('HTML içindeki yeni HUD kimlikleri mevcuttur', () => {
  const html = read('game/index.html');
  for (const id of ['overdriveBar', 'overdriveText', 'rerollButton', 'resultBosses']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('JavaScript tarafından önbelleğe alınan tüm UI kimlikleri HTML içinde bulunur', () => {
  const game = read('game/js/game.js');
  const html = read('game/index.html');
  const cacheBlock = game.match(/function cacheDom\(\) \{[\s\S]*?\.forEach\(function \(id\)/);
  assert.ok(cacheBlock, 'cacheDom bloğu bulunamadı');
  const ids = [...cacheBlock[0].matchAll(/'([A-Za-z][A-Za-z0-9]+)'/g)].map(match => match[1]);
  assert.ok(ids.length > 40, 'Beklenen UI kimliği sayısı bulunamadı');
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), `Eksik HTML kimliği: ${id}`);
});
