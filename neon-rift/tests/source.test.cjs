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

test('anti-kurcalama bütünlük kontrolü tamamen kaldırılmıştır', () => {
  assert.equal(
    fs.existsSync(path.join(root, 'android/app/src/main/java/com/bymel/Neonrift/IntegrityGuard.java')),
    false,
    'IntegrityGuard.java hâlâ mevcut'
  );
  const activity = read('android/app/src/main/java/com/bymel/Neonrift/MainActivity.java');
  const save = read('android/app/src/main/java/com/bymel/Neonrift/SecureSaveBridge.java');
  const gradle = read('android/app/build.gradle');
  for (const source of [activity, save, gradle]) {
    assert.doesNotMatch(source, /IntegrityGuard/);
  }
  assert.doesNotMatch(gradle, /EXPECTED_SIGNING_CERT_SHA256|GAME_ASSET_SHA256|REQUIRE_PLAY_INSTALLER/);
  assert.doesNotMatch(save, /INTEGRITY_BLOCK/);
  // Kurcalama kontrolü kalksa da WebView debug yalnızca debug derlemede açık kalmalıdır.
  assert.match(activity, /setWebContentsDebuggingEnabled\(BuildConfig\.DEBUG\)/);
});

test('AdMob gerçek uygulama ve reklam birimi kimlikleriyle bağlanmıştır', () => {
  const strings = read('android/app/src/main/res/values/strings.xml');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const gradle = read('android/app/build.gradle');
  const properties = read('android/gradle.properties');

  assert.match(strings, /ca-app-pub-4125240213199221~3005404416/);
  assert.match(manifest, /com\.google\.android\.gms\.ads\.APPLICATION_ID/);
  assert.match(manifest, /android:name="com\.google\.android\.gms\.permission\.AD_ID"/);
  assert.match(gradle, /com\.google\.android\.gms:play-services-ads:/);
  assert.match(properties, /ADMOB_INTERSTITIAL_UNIT_ID=ca-app-pub-4125240213199221\/9294766589/);
  assert.match(properties, /ADMOB_REWARDED_UNIT_ID=ca-app-pub-4125240213199221\/4071074074/);

  // Google'ın test reklam kimlikleri hiçbir kaynakta kalmamalıdır.
  for (const relative of ['android/app/build.gradle', 'android/gradle.properties', 'android/app/src/main/res/values/strings.xml', 'android/app/src/main/AndroidManifest.xml', 'android/app/src/main/java/com/bymel/Neonrift/AdsBridge.java', 'game/js/ads.js', 'game/js/game.js', 'game/js/config.js']) {
    assert.doesNotMatch(read(relative), /ca-app-pub-3940256099942544/, `Test reklam kimliği bulundu: ${relative}`);
  }
});

test('ölüm reklamı ve mağazadaki ödüllü reklam akışı bağlanmıştır', () => {
  const bridge = read('android/app/src/main/java/com/bymel/Neonrift/AdsBridge.java');
  const activity = read('android/app/src/main/java/com/bymel/Neonrift/MainActivity.java');
  const game = read('game/js/game.js');
  const config = read('game/js/config.js');
  const html = read('game/index.html');

  assert.match(bridge, /BuildConfig\.ADMOB_INTERSTITIAL_UNIT_ID/);
  assert.match(bridge, /BuildConfig\.ADMOB_REWARDED_UNIT_ID/);
  assert.match(activity, /addJavascriptInterface\(adsBridge, "BymelAds"\)/);
  assert.match(html, /src="js\/ads\.js"/);

  // Ölüm reklamı finishRun içinden, yalnızca oyuncu öldüğünde tetiklenir.
  assert.match(game, /if \(!abandoned\) showGameOverAd\(\);/);
  assert.match(game, /ads\.showGameOverAd\(\)/);

  // 5 reklam -> 200 elmas.
  assert.match(config, /rewardGoal: 5/);
  assert.match(config, /rewardGems: 200/);
  assert.match(game, /save\.adProgress \+= 1;/);
  assert.match(game, /save\.gems \+= CFG\.ads\.rewardGems;/);
  // Ödül yalnızca reklam gerçekten tamamlandığında verilir.
  assert.match(game, /event\.earned !== true/);
});

test('satın alma sunucu doğrulaması yalnızca uç nokta tanımlıysa zorunludur', () => {
  const gradle = read('android/app/build.gradle');
  assert.match(gradle, /requireServerVerification = verifyUrl\.startsWith\('https:\/\/'\)/);
  assert.match(gradle, /'REQUIRE_SERVER_VERIFICATION', requireServerVerification\.toString\(\)/);
  // Gerçek Play Billing akışı korunmalıdır.
  const billing = read('android/app/src/main/java/com/bymel/Neonrift/BillingBridge.java');
  assert.match(billing, /launchBillingFlow/);
  assert.match(billing, /consumeAsync/);
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
