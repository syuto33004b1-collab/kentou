// 戦闘の数値計算。DOMも音も触らないので node から検証できる。

// 残り時間がこの割合を過ぎてからの完打を COUNTER 扱いにする
export const COUNTER_AT = 0.85;
export const COUNTER_MUL = 1.4;

// 速度補正の基準。この KPM で等倍
export const SPEED_REF_KPM = 200;
export const SPEED_MIN = 0.55;
export const SPEED_MAX = 2.2;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** お題1つに与える制限時間 */
export function wordLimitMs(keystrokes, kpm, graceMs) {
  return keystrokes * (60 / kpm) * 1000 + graceMs;
}

export function isCounter(elapsedMs, limitMs) {
  return limitMs > 0 && elapsedMs / limitMs >= COUNTER_AT;
}

/**
 * 完打1回のダメージ。combo は加算前の値を渡す。
 * limitMs が 0 なら時間制限なし（修練モード）として COUNTER 判定を外す。
 */
export function playerDamage({
  keystrokes, elapsedMs, combo = 0, wordMiss = 0, limitMs = 0,
}) {
  const secs = Math.max(0.35, elapsedMs / 1000);
  const kpm = (keystrokes / secs) * 60;
  const speed = clamp(kpm / SPEED_REF_KPM, SPEED_MIN, SPEED_MAX);
  const comboMul = 1 + Math.min(combo, 20) * 0.06;
  const perfect = wordMiss === 0 ? 1.25 : 1;
  const base = 4 + keystrokes * 0.55;
  const counter = isCounter(elapsedMs, limitMs);
  return {
    dmg: Math.round(base * speed * comboMul * perfect * (counter ? COUNTER_MUL : 1)),
    speed,
    counter,
    power: clamp((speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN), 0, 1),
  };
}

/** 時間切れでプレイヤーが受けるダメージ */
export function cpuDamage(keystrokes) {
  return Math.round(6 + keystrokes * 0.45);
}

/**
 * 弱・中・強・必殺。手応えを変えるための階級。
 * 実際の一戦で出る値（コンボ0〜8、5〜20打）が4段に散るよう境界を取っている。
 * 低すぎると中盤以降が全部「必殺」になって、階級を分けた意味が消える。
 */
export function rankOf(dmg) {
  if (dmg >= 45) return 'super';
  if (dmg >= 28) return 'heavy';
  if (dmg >= 14) return 'mid';
  return 'light';
}
