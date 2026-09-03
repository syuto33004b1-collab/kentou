// 音源ファイルの読み込みと再生。
// 合成では出しにくい「格ゲーの打撃の質感」と、合成では作れないアナウンサーボイスを
// ここで持つ。AudioContext は sound.js から渡してもらう（循環importを避ける）。
//
// 取得・デコード・再生のどこで失敗しても play() は false を返すだけ。
// 呼び側は合成音にフォールバックできる。

const NAMES = [
  // アナウンサー
  'round1', 'fight', 'counter', 'super', 'ko', 'lose',
  // 効果音
  'key', 'hit_light', 'hit_mid', 'hit_heavy', 'hit_super', 'hurt', 'miss',
];

const buffers = new Map();
let ctx = null;
let started = false;

const url = (name) => new URL(`../audio/${name}.mp3`, import.meta.url);

export function init(audioCtx) {
  ctx = audioCtx;
}

/**
 * AudioContext は suspended のままでもデコードできるので、起動時に済ませる。
 * 最初の打鍵を待つと1戦目の ROUND 1 と1打目のクリックに間に合わない。
 */
export function preload() {
  if (started || !ctx) return;
  started = true;
  for (const name of NAMES) {
    fetch(url(name))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => ctx.decodeAudioData(data))
      .then((buf) => buffers.set(name, buf))
      .catch(() => { /* 音源無しでも合成音で成立する */ });
  }
}

export function has(name) {
  return buffers.has(name);
}

/**
 * 鳴らせたら true。false なら呼び側が合成音を出す。
 * rate は狙って変えるピッチ、detune は連打を機械的に聞かせないための散らし幅。
 */
export function play(name, gain, dest, { detune = 0, rate = 1 } = {}) {
  const buf = buffers.get(name);
  if (!ctx || !dest || !buf) return false;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate * (1 + (Math.random() - 0.5) * 2 * detune);
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g);
  g.connect(dest);
  src.start();
  return true;
}
