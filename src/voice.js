// アナウンサーボイス。合成では作れないので、ここだけ音源ファイルを持つ。
// 6本で合計30KB弱。取得や再生に失敗しても、合成音だけでゲームは成立させる。

import { context, bus } from './sound.js';

const NAMES = ['round1', 'fight', 'counter', 'super', 'ko', 'lose'];
const buffers = new Map();
let started = false;

const url = (name) => new URL(`../audio/${name}.mp3`, import.meta.url);

/**
 * 起動時に呼ぶ。AudioContext は suspended のままでもデコードできるので、
 * 最初の打鍵を待たずに用意しておく（待つと1戦目の ROUND 1 に間に合わない）。
 */
export function preload() {
  const ctx = context();
  if (started || !ctx) return;
  started = true;
  for (const name of NAMES) {
    fetch(url(name))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => ctx.decodeAudioData(data))
      .then((buf) => buffers.set(name, buf))
      .catch(() => { /* ボイス無しでも遊べる */ });
  }
}

export function play(name, gain = 1) {
  const ctx = context();
  const dest = bus();
  const buf = buffers.get(name);
  if (!ctx || !dest || !buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g);
  g.connect(dest);
  src.start();
}
