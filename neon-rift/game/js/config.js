(function () {
  'use strict';

  window.NR_CONFIG = Object.freeze({
    appName: 'Neon Rift',
    studio: 'Bymel Software',
    packageName: 'com.bymel.Neonrift',
    version: '1.3.2',
    saveKey: 'bymel.neonrift.save.v2',
    legacySaveKeys: Object.freeze(['bymel.neonrift.save.v1']),
    minAndroidApi: 21,
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
    })
  });
}());
