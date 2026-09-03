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
    master.gain.value = 0.7;
    master.connect(ctx.destination);

    const len = Math.floor(ctx.sampleRate * 0.4);
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
  return o;
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

/** お題を打ち切った瞬間の打撃音。power は 0..1 */
export function hit(power = 0.5) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const p = Math.min(1, Math.max(0, power));
  tone('sine', 240 + p * 120, 38, t, 0.42, 0.22);
  tone('triangle', 120, 30, t, 0.3, 0.3);
  burstNoise(t, 0.34, 0.09, 1600 + p * 1400, 0.6);
  burstNoise(t + 0.01, 0.16, 0.18, 420, 0.9);
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

/** プレイヤーが被弾 */
export function hurt() {
  if (!ready()) return;
  const t = ctx.currentTime;
  tone('sawtooth', 300, 55, t, 0.3, 0.28);
  burstNoise(t, 0.26, 0.16, 700, 0.5);
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

/** ラウンド開始のコール */
export function bell() {
  if (!ready()) return;
  const t = ctx.currentTime;
  tone('square', 880, 880, t, 0.16, 0.12);
  tone('square', 1320, 1320, t + 0.14, 0.16, 0.26);
}
