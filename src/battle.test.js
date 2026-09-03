// node src/battle.test.js
import assert from 'node:assert/strict';
import {
  COUNTER_AT, COUNTER_MUL, SPEED_MAX, SPEED_MIN,
  wordLimitMs, isCounter, playerDamage, cpuDamage, rankOf,
} from './battle.js';

const dmg = (opts) => playerDamage(opts).dmg;

// --- 制限時間 ---
{
  // 10打を190KPMで打ち切るのに必要な時間 + 猶予1100ms
  assert.equal(Math.round(wordLimitMs(10, 190, 1100)), 4258);
  assert.ok(wordLimitMs(20, 190, 1100) > wordLimitMs(10, 190, 1100), '長いお題ほど長い');
  assert.ok(wordLimitMs(10, 290, 800) < wordLimitMs(10, 110, 1600), '難しいほど短い');
}

// --- COUNTER 判定は閾値で切り替わる ---
{
  const limit = 4000;
  assert.equal(isCounter(limit * (COUNTER_AT - 0.001), limit), false, '閾値の直前は不成立');
  assert.equal(isCounter(limit * COUNTER_AT, limit), true, '閾値ちょうどで成立');
  assert.equal(isCounter(3999, 0), false, '時間制限なしでは成立しない');

  // 丸め誤差が比率を歪めないよう、ダメージが十分大きい条件で倍率を見る
  const big = 12000;
  const at = { keystrokes: 30, elapsedMs: big * COUNTER_AT, combo: 0, wordMiss: 0 };
  const withLimit = playerDamage({ ...at, limitMs: big });
  const without = playerDamage({ ...at, limitMs: 0 });
  assert.equal(withLimit.counter, true);
  assert.equal(without.counter, false);
  const ratio = withLimit.dmg / without.dmg;
  assert.ok(
    Math.abs(ratio - COUNTER_MUL) < 0.06,
    `COUNTERの倍率が ${COUNTER_MUL} 前後になる (実測 ${ratio.toFixed(3)})`,
  );
}

// --- 速い方が必ず強い。COUNTERがあっても遅延が有利にはならない ---
{
  const limit = wordLimitMs(10, 190, 1100);
  const fast = dmg({ keystrokes: 10, elapsedMs: limit * 0.3, limitMs: limit });
  const late = dmg({ keystrokes: 10, elapsedMs: limit * 0.9, limitMs: limit });
  assert.ok(fast > late, `速く打つ方が強い (fast ${fast} > late ${late})`);
  // ただし COUNTER 圏はその手前より落ち込まない（リスクを取った分は返す）
  const justBefore = dmg({ keystrokes: 10, elapsedMs: limit * 0.84, limitMs: limit });
  const justAfter = dmg({ keystrokes: 10, elapsedMs: limit * 0.86, limitMs: limit });
  assert.ok(justAfter >= justBefore, `COUNTER圏で落ち込まない (${justBefore} -> ${justAfter})`);
}

// --- 速度補正は上下でクランプされる ---
{
  const insane = playerDamage({ keystrokes: 30, elapsedMs: 1 });
  assert.equal(insane.speed, SPEED_MAX, '無限に速くはならない');
  assert.equal(insane.power, 1);
  const crawl = playerDamage({ keystrokes: 4, elapsedMs: 60000 });
  assert.equal(crawl.speed, SPEED_MIN, '遅くても0にはならない');
  assert.equal(crawl.power, 0);
  assert.ok(crawl.dmg >= 1, '遅く正確なプレイヤーでも必ず削れる');
}

// --- ノーミス補正とコンボ倍率 ---
{
  const base = { keystrokes: 10, elapsedMs: 3000, limitMs: 0 };
  assert.ok(dmg({ ...base, wordMiss: 0 }) > dmg({ ...base, wordMiss: 1 }), 'ノーミスの方が強い');
  assert.ok(dmg({ ...base, combo: 10 }) > dmg({ ...base, combo: 0 }), 'コンボで伸びる');
  assert.equal(
    dmg({ ...base, combo: 20 }),
    dmg({ ...base, combo: 999 }),
    'コンボ倍率は20で打ち止め',
  );
}

// --- 長いお題ほど1発が重い ---
{
  const short = dmg({ keystrokes: 5, elapsedMs: 5 / 200 * 60 * 1000 });
  const long = dmg({ keystrokes: 20, elapsedMs: 20 / 200 * 60 * 1000 });
  assert.ok(long > short, `同じKPMなら長い方が重い (${short} -> ${long})`);
}

// --- 被弾ダメージ ---
{
  assert.ok(cpuDamage(20) > cpuDamage(5), '長いお題を落とすほど痛い');
  assert.ok(cpuDamage(5) > 2, '被弾はミス（2ダメージ）より必ず重い');
}

// --- 階級の境界 ---
{
  assert.equal(rankOf(13), 'light');
  assert.equal(rankOf(14), 'mid');
  assert.equal(rankOf(27), 'mid');
  assert.equal(rankOf(28), 'heavy');
  assert.equal(rankOf(44), 'heavy');
  assert.equal(rankOf(45), 'super');
}

// --- 実際に出る値が4階級に散る（全部「中攻撃」にならない） ---
{
  const limit = wordLimitMs(10, 190, 1100);
  // 一戦の流れ: 序盤の短文 → 中盤 → コンボが乗った終盤
  const shots = [
    { keystrokes: 6, elapsedMs: limit * 0.8, combo: 0 },
    { keystrokes: 10, elapsedMs: limit * 0.5, combo: 1 },
    { keystrokes: 12, elapsedMs: limit * 0.5, combo: 6 },
    { keystrokes: 14, elapsedMs: limit * 0.3, combo: 8 },
  ];
  const seen = shots.map((s) => rankOf(dmg({ ...s, limitMs: limit })));
  assert.deepEqual(seen, ['light', 'mid', 'heavy', 'super'], `一戦で4階級が順に出る (${seen.join(',')})`);

  // コンボ8以下の現実的な範囲で、一撃が体力の半分を超えない
  for (const s of shots) {
    assert.ok(dmg({ ...s, limitMs: limit }) <= 50, '一撃で試合が終わらない');
  }
}

console.log('OK: battle math / counter / ranks');
