'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../game/js/core.js');

test('sayı ve zaman biçimleme kararlı çalışır', () => {
  assert.equal(Core.formatTime(0), '00:00');
  assert.equal(Core.formatTime(125.9), '02:05');
  assert.equal(Core.formatNumber(12500), '12.5K');
  assert.equal(Core.clamp(12, 0, 10), 10);
});

test('günlük görev seçimi aynı gün için deterministiktir', () => {
  const first = Core.todayMissions('2026-08-01');
  const second = Core.todayMissions('2026-08-01');
  assert.deepEqual(first, second);
  assert.equal(first.length, 3);
  assert.equal(new Set(first.map(item => item.id)).size, 3);
});

test('bozuk kayıt güvenli varsayılanlarla birleştirilir', () => {
  const save = Core.mergeSave({ gold: -10, gems: '8', settings: { music: false }, ownedSkins: [] });
  assert.equal(save.gold, 0);
  assert.equal(save.gems, 8);
  assert.equal(save.settings.music, false);
  assert.equal(save.settings.sfx, true);
  assert.deepEqual(save.ownedSkins, ['cyan']);
});

test('görev ilerlemesi hedefte durur ve kimliği ayırır', () => {
  const save = Core.defaultSave();
  save.missions = [{ id: 'kills', target: 5, progress: 4, claimed: false }];
  assert.equal(Core.missionProgress(save, 'kills', 12), true);
  assert.equal(save.missions[0].progress, 5);
  assert.equal(Core.missionProgress(save, 'coins', 2), false);
});

test('koşu skoru kombo ve boss ödülünü doğru uygular', () => {
  const score = Core.calculateScore({ kills: 10, coins: 100, elapsed: 60, maxCombo: 10, bosses: 1 });
  assert.equal(score, 10875);
});

test('kalıcı yükseltme maliyeti seviyelerle artar', () => {
  assert.equal(Core.upgradeCost(0, 400), 400);
  assert.ok(Core.upgradeCost(4, 400) > Core.upgradeCost(3, 400));
});


test('v1 kayıtları v2 şemasına ve yeni gelişim alanlarına taşınır', () => {
  const save = Core.mergeSave({ schema: 1, permanent: { power: 2 }, achievements: { titanSlayer: true } });
  assert.equal(save.schema, 2);
  assert.equal(save.permanent.power, 2);
  assert.equal(save.permanent.reactor, 0);
  assert.equal(save.achievements.titanSlayer, true);
  assert.equal(save.achievements.commanderDown, false);
});

test('Commander ve elitler skora ek ödül verir', () => {
  const base = Core.calculateScore({ kills: 1, coins: 0, elapsed: 0, maxCombo: 1, bosses: 0 });
  const enhanced = Core.calculateScore({ kills: 1, coins: 0, elapsed: 0, maxCombo: 1, bosses: 0, commanders: 1, elites: 2 });
  assert.ok(enhanced - base >= 12360);
  assert.ok(enhanced - base <= 12361);
});
