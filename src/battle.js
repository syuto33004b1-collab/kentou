// 戦闘の数値計算。DOMも音も触らないので node から検証できる。

// 残り時間がこの割合を過ぎてからの完打を COUNTER 扱いにする
export const COUNTER_AT = 0.85;
export const COUNTER_MUL = 1.4;

// 速度補正の基準。この KPM で等倍
export const SPEED_REF_KPM = 200;
export const SPEED_MIN = 0.55;
export const SPEED_MAX = 2.2;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// CPUのKPMは試合の進行でこの範囲を動く。固定値だと
// 「相手のKPMを超えているか」の二値になり、互角の帯が針の穴になる
export const RAMP_FROM = 0.82;
export const RAMP_TO = 1.28;

/**
 * 進行度に応じたCPUの実効KPM。progress は CPU に与えたダメージの割合。
 * 追い詰めるほど速くなるので、どの難易度でも途中で必ず互角の帯を通る。
 */
export function rampedKpm(baseKpm, progress) {
  return baseKpm * (RAMP_FROM + clamp(progress, 0, 1) * (RAMP_TO - RAMP_FROM));
}

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

// 打ちかけの分だけ被弾を軽くする割合
export const PROGRESS_RELIEF = 0.7;

/**
 * 時間切れでプレイヤーが受けるダメージ。
 * progress（打てていた割合）が高いほど軽い。あと一歩で落とした被弾と
 * 手つかずで落とした被弾を同じ重さにすると、少し遅いだけで即死する。
 */
export function cpuDamage(keystrokes, progress = 0) {
  const full = 6 + keystrokes * 0.45;
  const relief = 1 - clamp(progress, 0, 1) * PROGRESS_RELIEF;
  return Math.max(2, Math.round(full * relief));
}

/**
 * 実測KPMに対して、互角に戦える基準KPMを baseKpms から選ぶ。
 * ランプで実効KPMは平均 (RAMP_FROM+RAMP_TO)/2 倍になるので、
 * 実測値をその分割り戻してから比べる。
 * どれにも届かないなら一番易しいものを返す（門前払いにしない）。
 */
export function recommendKpm(measuredKpm, baseKpms) {
  const target = measuredKpm / ((RAMP_FROM + RAMP_TO) / 2);
  const sorted = [...baseKpms].sort((a, b) => a - b);
  return sorted.filter((k) => k <= target).pop() ?? sorted[0];
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
