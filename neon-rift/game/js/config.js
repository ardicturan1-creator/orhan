(function () {
  'use strict';

  window.NR_CONFIG = Object.freeze({
    appName: 'Neon Rift',
    studio: 'Bymel Software',
    packageName: 'com.bymel.neonrift',
    version: '1.4.2',
    saveKey: 'bymel.neonrift.save.v2',
    legacySaveKeys: Object.freeze(['bymel.neonrift.save.v1']),
    minAndroidApi: 23,
    targetAndroidApi: 36,
    arenaRadius: 20,
    maxEnemies: 58,
    maxPlayerBullets: 92,
    maxEnemyBullets: 96,
    maxPickups: 72,
    products: Object.freeze({
      gems80: 'com.bymel.neonrift.gems_80',
      gems500: 'com.bymel.neonrift.gems_500',
      gold12000: 'com.bymel.neonrift.gold_12000',
      starter: 'com.bymel.neonrift.starter_pack'
    }),
    // Mağazadaki ödüllü reklam çarkı: 5 tamamlanmış reklam 200 elmas verir.
    ads: Object.freeze({
      rewardGoal: 5,
      rewardGems: 200
    })
  });
}());
