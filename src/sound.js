// SEはすべてWeb Audio APIの合成音。音源ファイルは持たない。

let ctx = null;
let master = null;
let noise = null;
let enabled = true;

/** AudioContext はユーザー操作で初めて生成・resume する（autoplay policy対策） */
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.7 : 0;
    master.connect(ctx.destination);

    const len = Math.floor(ctx.sampleRate * 0.6);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setEnabled(v) {
  enabled = v;
  if (master) master.gain.value = v ? 0.7 : 0;
}

export function isEnabled() {
  return enabled;
}

function ready() {
  return !!ctx && enabled;
}

/** peak まで立ち上げて dur 秒で減衰するゲイン */
function envelope(t0, peak, dur, attack = 0.004) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(master);
  return g;
}

function tone(type, f0, f1, t0, peak, dur) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
  o.connect(envelope(t0, peak, dur));
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function burstNoise(t0, peak, dur, freq, q = 1) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  src.connect(bp);
  bp.connect(envelope(t0, peak, dur, 0.002));
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** 1打ごとの軽いクリック。コンボが伸びるとピッチが上がる */
export function key(combo = 0) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const f = 1150 + Math.min(combo, 24) * 45;
  tone('square', f, f * 0.7, t, 0.045, 0.035);
  burstNoise(t, 0.02, 0.02, 4200, 0.7);
}

// 攻撃の階級ごとに、音の重さそのものを変える。
// 一律だと何を打っても「中攻撃」に聞こえる
const RANKS = {
  light: { f: 320, dur: 0.13, gain: 0.28, nf: 2000, nd: 0.05 },
  mid: { f: 250, dur: 0.22, gain: 0.4, nf: 1700, nd: 0.09 },
  heavy: { f: 190, dur: 0.34, gain: 0.5, nf: 1200, nd: 0.14 },
  super: { f: 140, dur: 0.55, gain: 0.58, nf: 900, nd: 0.22 },
};

/** お題を打ち切った瞬間の打撃音。rank は light/mid/heavy/super */
export function hit(rank = 'mid', power = 0.5) {
  if (!ready()) return;
  const r = RANKS[rank] ?? RANKS.mid;
  const t = ctx.currentTime;
  const p = Math.min(1, Math.max(0, power));

  tone('sine', r.f + p * 90, 34, t, r.gain, r.dur);
  tone('triangle', r.f * 0.5, 28, t, r.gain * 0.7, r.dur * 1.3);
  burstNoise(t, r.gain * 0.8, r.nd, r.nf + p * 900, 0.6);
  burstNoise(t + 0.012, r.gain * 0.4, r.nd * 2, 420, 0.9);

  if (rank === 'super') {
    // 溜めの立ち上がりと、追い討ちの second impact
    tone('sawtooth', 180, 1400, t, 0.14, 0.3);
    tone('sine', 200, 30, t + 0.16, 0.45, 0.5);
    burstNoise(t + 0.16, 0.34, 0.3, 700, 0.4);
  }
}

/** 残り時間ぎりぎりの完打 */
export function counter() {
  if (!ready()) return;
  const t = ctx.currentTime;
  tone('square', 1760, 1760, t, 0.13, 0.09);
  tone('square', 2640, 2640, t + 0.02, 0.1, 0.16);
  burstNoise(t, 0.12, 0.06, 6000, 1.2);
}

/** コンボ更新のブリップ */
export function combo(n) {
  if (!ready()) return;
  const t = ctx.currentTime + 0.04;
  const f = 520 + Math.min(n, 24) * 55;
  tone('square', f, f * 1.6, t, 0.09, 0.09);
}

/** ミスタイプ */
export function miss() {
  if (!ready()) return;
  const t = ctx.currentTime;
  tone('sawtooth', 165, 88, t, 0.18, 0.17);
  burstNoise(t, 0.09, 0.1, 280, 0.8);
}

/** プレイヤーが被弾。ガードを割られた感を出す */
export function hurt() {
  if (!ready()) return;
  const t = ctx.currentTime;
  burstNoise(t, 0.3, 0.05, 3200, 0.5);
  tone('sawtooth', 330, 52, t + 0.02, 0.32, 0.3);
  tone('triangle', 140, 46, t + 0.02, 0.26, 0.4);
  burstNoise(t + 0.03, 0.24, 0.2, 620, 0.5);
}

/** K.O. の轟音 */
export function ko() {
  if (!ready()) return;
  const t = ctx.currentTime;
  tone('sine', 90, 24, t, 0.55, 1.4);
  tone('triangle', 180, 40, t, 0.3, 0.9);
  burstNoise(t, 0.4, 0.5, 320, 0.4);
  burstNoise(t + 0.06, 0.24, 1.0, 130, 0.5);
}

/** ROUND コール */
export function round() {
  if (!ready()) return;
  const t = ctx.currentTime;
  tone('square', 440, 440, t, 0.13, 0.22);
}

/** FIGHT コール */
export function bell() {
  if (!ready()) return;
  const t = ctx.currentTime;
  tone('square', 880, 880, t, 0.16, 0.12);
  tone('square', 1320, 1320, t + 0.14, 0.16, 0.26);
}
