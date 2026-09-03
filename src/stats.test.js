// node src/stats.test.js
import assert from 'node:assert/strict';
import {
  emptyStats, recordHit, recordMiss, weakKeys, mergeMatch,
} from './stats.js';

// --- ミスが1つでもあればミス率順に並ぶ ---
{
  const s = emptyStats();
  // a: 10打0ミス / z: 4打4ミス / q: 6打2ミス
  for (let i = 0; i < 10; i += 1) recordHit(s, 'a', 120);
  for (let i = 0; i < 4; i += 1) recordMiss(s, 'z');
  for (let i = 0; i < 4; i += 1) recordHit(s, 'q', 200);
  for (let i = 0; i < 2; i += 1) recordMiss(s, 'q');

  const weak = weakKeys(s);
  assert.deepEqual(weak.map((r) => r.ch), ['z', 'q'], 'ミスしたキーだけがミス率順に出る');
  assert.equal(weak[0].rate, 1, 'z は全ミス');
  assert.equal(Math.round(weak[1].rate * 100), 33, 'q は 2/6');
}

// --- ミスが皆無なら平均遅延順にフォールバックする ---
{
  const s = emptyStats();
  for (let i = 0; i < 5; i += 1) recordHit(s, 'a', 100);
  for (let i = 0; i < 5; i += 1) recordHit(s, 'b', 400);
  assert.deepEqual(weakKeys(s).map((r) => r.ch), ['b', 'a'], '遅い順');
  assert.equal(weakKeys(s)[0].meanMs, 400);
}

// --- サンプル数が足りないキーは出さない ---
{
  const s = emptyStats();
  recordMiss(s, 'x');
  assert.equal(weakKeys(s).length, 0, '1打だけのキーは判断材料にしない');
  for (let i = 0; i < 4; i += 1) recordHit(s, 'x', 150);
  assert.equal(weakKeys(s)[0].ch, 'x', '5打まで溜まれば出る');
}

// --- 異常な打鍵間隔は平均に混ぜない ---
{
  const s = emptyStats();
  recordHit(s, 'a', 100);
  recordHit(s, 'a', 100);
  recordHit(s, 'a', 999999); // 離席明けの巨大な間隔
  recordHit(s, 'a', 100);
  assert.equal(weakKeys(s, 5, 1)[0].meanMs, 75, '3000ms以上は捨てる（300/4）');
}

// --- 通算は前回を退避してから更新し、短すぎる試合は自己ベストに数えない ---
{
  const s = emptyStats();
  mergeMatch(s, {
    kpm: 50, acc: 100, maxCombo: 3, secs: 10, keys: 8, outcome: 'WIN',
  });
  assert.equal(s.best, null, '8打の試合は自己ベストに数えない');
  assert.equal(s.matches, 1);
  assert.equal(s.wins, 1);
  assert.equal(s.prev, null);

  mergeMatch(s, {
    kpm: 90, acc: 96, maxCombo: 7, secs: 40, keys: 60, outcome: 'LOSE',
  });
  assert.equal(s.prev.kpm, 50, '前回が退避されている');
  assert.equal(s.last.kpm, 90);
  assert.equal(s.best.kpm, 90);
  assert.equal(s.wins, 1, '負けは勝数に入らない');

  mergeMatch(s, {
    kpm: 70, acc: 99, maxCombo: 12, secs: 30, keys: 35, outcome: 'WIN',
  });
  assert.equal(s.best.kpm, 90, '自己ベストは下がらない');
  assert.equal(s.best.acc, 99);
  assert.equal(s.best.maxCombo, 12);
}

console.log('OK: stats / weak keys / totals');
