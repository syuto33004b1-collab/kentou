// 効果音は「音源サンプル + 合成のサブ層」の二階建て。
// サンプルが格ゲーらしいアタックの質感を出し、サブ層（30〜60Hzの正弦波）を
// 合成で足すことでランクごとの重さを連続的に変えられる。
// 音源の取得に失敗したときは、下の4層合成だけで成立させる。
//
// 薄い音にならないよう、1発を4層で作る:
//   1. トランジェント … 高域ノイズの極短バースト（当たった瞬間のクラック）
//   2. ボディ ……………… サチュレーションを通した中低域（倍音が出て「ドン」になる）
//   3. サブ ……………… 30〜60Hz の正弦波。重厚感の正体はここ。歪ませず深く伸ばす
//   4. テール ………… ローパスを通したノイズの長い減衰（空間と破片）
// マスターにコンプを挟んで層を糊付けする。これが無いと重ねた分だけ潰れる。

import * as samples from './samples.js';

let ctx = null;
let master = null;
let noiseBuf = null;
let enabled = true;
const saturators = new Map();

const MASTER_GAIN = 0.55;
// 音源は -1dBFS 正規化済み。合成音に埋もれない範囲で、クリップしない値（実測で詰めた）
const VOICE_GAIN = 1.2;
// 1打のクリックは打撃より20dB前後低く保つ。5打/秒鳴るので疲れさせない
const KEY_SAMPLE_GAIN = 0.15;

/** AudioContext はユーザー操作で初めて生成・resume する（autoplay policy対策） */
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    // 層を重ねても潰れないように、出口で軽く締める
    const comp = ctx.createDynamicsCompressor();
    // 強く掛けると弱・中・強・必殺の差が潰れる。糊付けだけに留める
    comp.threshold.value = -6;
    comp.knee.value = 6;
    comp.ratio.value = 2.5;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;
    comp.connect(ctx.destination);

    master = ctx.createGain();
    master.gain.value = enabled ? MASTER_GAIN : 0;
    master.connect(comp);

    samples.init(ctx);
    samples.preload();

    const len = Math.floor(ctx.sampleRate * 1.5);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  }
  // 起動時（ジェスチャ前）にも呼ぶので、拒否されても黙って進む
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function setEnabled(v) {
  enabled = v;
  if (master) master.gain.value = v ? MASTER_GAIN : 0;
}

export function isEnabled() {
  return enabled;
}

export function context() {
  return ctx;
}

/** ボイス再生などをマスター経由で鳴らすための接続先 */
export function bus() {
  return master;
}

function ready() {
  return !!ctx && enabled;
}

/** peak まで立ち上げて dur 秒で減衰するゲイン */
function env(t0, peak, dur, attack = 0.004, dest = master) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(dest);
  return g;
}

/** tanh 風のカーブで倍音を作る。amount が大きいほど歪む */
function saturator(amount) {
  const key = Math.round(amount * 20);
  if (saturators.has(key)) return saturators.get(key);
  const n = 1024;
  const curve = new Float32Array(n);
  const k = 1 + amount * 40;
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  const ws = ctx.createWaveShaper();
  ws.curve = curve;
  ws.oversample = '2x';
  const out = ctx.createGain();
  // 歪ませると音量が上がるので下げ戻す
  out.gain.value = 1 / (1 + amount * 1.6);
  ws.connect(out);
  out.connect(master);
  saturators.set(key, ws);
  return ws;
}

function tone(type, f0, f1, t0, peak, dur, dest = master, attack = 0.004) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
  o.connect(env(t0, peak, dur, attack, dest));
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(t0, peak, dur, {
  type = 'bandpass', freq = 1200, q = 1, dest = master,
} = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  src.connect(f);
  f.connect(env(t0, peak, dur, 0.002, dest));
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.05);
}

/** 1打ごとの手応え。コンボが伸びるとピッチが上がる */
export function key(combo = 0) {
  if (!ready()) return;
  const t = ctx.currentTime;
  // 連打で機械的に聞こえないよう ±4% 散らし、コンボでピッチを上げる
  const rate = 1 + Math.min(combo, 24) * 0.012;
  if (samples.play('key', KEY_SAMPLE_GAIN, master, { detune: 0.04, rate })) return;
  const f = 1900 + Math.min(combo, 24) * 90;
  noise(t, 0.3, 0.022, { freq: f, q: 2.4 });
  tone('triangle', 620 + Math.min(combo, 24) * 24, 300, t, 0.12, 0.06);
}

// 弱・中・強・必殺。層の厚みと減衰の長さで重さを分ける
const RANKS = {
  light: {
    sub: 58, subDur: 0.26, body: 200, bodyDur: 0.15, drive: 0.35, tail: 0.16, gain: 0.28, smp: 0.42,
  },
  mid: {
    sub: 48, subDur: 0.42, body: 165, bodyDur: 0.22, drive: 0.55, tail: 0.30, gain: 0.5, smp: 0.8,
  },
  heavy: {
    sub: 40, subDur: 0.62, body: 128, bodyDur: 0.30, drive: 0.75, tail: 0.48, gain: 0.78, smp: 0.8,
  },
  super: {
    sub: 33, subDur: 0.95, body: 100, bodyDur: 0.42, drive: 0.9, tail: 0.8, gain: 0.98, smp: 1.1,
  },
};

/** お題を打ち切った瞬間の打撃音。rank は light/mid/heavy/super */
export function hit(rank = 'mid', power = 0.5) {
  if (!ready()) return;
  const r = RANKS[rank] ?? RANKS.mid;
  const t = ctx.currentTime;
  const p = Math.min(1, Math.max(0, power));

  if (samples.play(`hit_${rank}`, r.smp, master, { detune: 0.03 })) {
    // サンプルは質感を出す。重さはサブ層で足す（ランクごとに可変にできる）
    tone('sine', r.sub * 2.1, r.sub * 0.55, t, r.gain * 0.8, r.subDur, master, 0.006);
    if (rank === 'super') tone('sine', r.sub * 2.4, r.sub * 0.5, t + 0.17, r.gain * 0.6, 0.7);
    return;
  }

  const sat = saturator(r.drive);

  // 1. トランジェント（クラック）
  noise(t, r.gain * 0.55, 0.014, { type: 'highpass', freq: 2600 + p * 1800, q: 0.7 });
  // 2. ボディ（歪ませて倍音を出す）
  tone('triangle', r.body * 2.2, r.body * 0.5, t, r.gain * 0.85, r.bodyDur, sat, 0.002);
  tone('square', r.body * 1.2, r.body * 0.4, t, r.gain * 0.3, r.bodyDur * 0.7, sat, 0.002);
  // 3. サブ（重厚感の正体。歪ませない）
  tone('sine', r.sub * 2.1, r.sub * 0.55, t, r.gain, r.subDur, master, 0.006);
  // 4. テール（空間と破片）
  noise(t + 0.01, r.gain * 0.3, r.tail, { type: 'lowpass', freq: 700, q: 0.6 });

  if (rank === 'super') {
    // 溜めの立ち上がりと、追い討ちの second impact
    tone('sawtooth', 160, 1500, t, 0.1, 0.26, sat);
    tone('sine', r.sub * 2.4, r.sub * 0.5, t + 0.17, r.gain * 0.9, 0.7);
    tone('triangle', r.body * 1.8, r.body * 0.45, t + 0.17, r.gain * 0.6, 0.3, sat, 0.002);
    noise(t + 0.17, r.gain * 0.4, 0.5, { type: 'lowpass', freq: 900, q: 0.5 });
  }
}

/** 残り時間ぎりぎりの完打。金属質のカウンター音 */
export function counter() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const sat = saturator(0.5);
  noise(t, 0.16, 0.03, { type: 'highpass', freq: 5000, q: 0.8 });
  tone('square', 1760, 1720, t, 0.12, 0.1, sat);
  tone('square', 2640, 2600, t + 0.015, 0.09, 0.22, sat);
  tone('sine', 90, 44, t, 0.3, 0.3);
}

/** コンボ更新のブリップ */
export function combo(n) {
  if (!ready()) return;
  const t = ctx.currentTime + 0.05;
  const f = 520 + Math.min(n, 24) * 55;
  tone('triangle', f, f * 1.7, t, 0.07, 0.1, saturator(0.3));
}

/** ミスタイプ。鈍く、短く */
export function miss() {
  if (!ready()) return;
  const t = ctx.currentTime;
  if (samples.play('miss', 0.55, master, { detune: 0.04 })) {
    tone('sine', 70, 40, t, 0.2, 0.22);
    return;
  }
  const sat = saturator(0.6);
  tone('sawtooth', 150, 72, t, 0.16, 0.19, sat);
  tone('sine', 70, 40, t, 0.24, 0.22);
  noise(t, 0.08, 0.09, { type: 'lowpass', freq: 400, q: 0.7 });
}

/** プレイヤーが被弾。ガードを割られる金属音から低域のスイープへ */
export function hurt() {
  if (!ready()) return;
  const t = ctx.currentTime;
  if (samples.play('hurt', 0.8, master, { detune: 0.02 })) {
    tone('sine', 74, 34, t + 0.01, 0.5, 0.55);
    return;
  }
  const sat = saturator(0.8);
  noise(t, 0.4, 0.05, { type: 'highpass', freq: 3400, q: 0.6 });
  tone('sawtooth', 420, 60, t + 0.01, 0.32, 0.34, sat);
  tone('sine', 74, 34, t + 0.01, 0.55, 0.55);
  noise(t + 0.03, 0.26, 0.42, { type: 'lowpass', freq: 620, q: 0.5 });
}

/** K.O. の轟音 */
export function ko() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const sat = saturator(0.9);
  noise(t, 0.5, 0.03, { type: 'highpass', freq: 3000, q: 0.5 });
  tone('sine', 78, 22, t, 0.85, 1.9);
  tone('triangle', 130, 30, t, 0.5, 1.1, sat);
  tone('sawtooth', 200, 26, t + 0.02, 0.22, 0.8, sat);
  noise(t, 0.42, 0.7, { type: 'lowpass', freq: 420, q: 0.4 });
  noise(t + 0.08, 0.3, 1.6, { type: 'lowpass', freq: 180, q: 0.5 });
  // 少し遅れた second impact で「沈む」感じを出す
  tone('sine', 62, 20, t + 0.34, 0.6, 1.5);
}

/** アナウンサーボイス。合成音に負けないよう持ち上げる */
export function say(name, gain = VOICE_GAIN) {
  if (!ready()) return;
  samples.play(name, gain, master);
}

/** ROUND コール */
export function round() {
  if (!ready()) return;
  const t = ctx.currentTime;
  tone('triangle', 440, 436, t, 0.14, 0.26, saturator(0.25));
  tone('sine', 110, 106, t, 0.2, 0.3);
}

/** FIGHT コール */
export function bell() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const sat = saturator(0.3);
  tone('triangle', 880, 876, t, 0.15, 0.14, sat);
  tone('triangle', 1320, 1316, t + 0.15, 0.15, 0.3, sat);
  tone('sine', 130, 100, t, 0.26, 0.4);
}
