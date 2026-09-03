// パーティクル・画面シェイク・ヒットストップ・ダメージ数値。
// prefers-reduced-motion では動きの強い演出だけを止め、ヒットストップと
// ダメージ数値は残す（ゲーム性が変わらないようにするため）。

const MAX_FLASH = 0.35; // 光感受性への配慮。全画面フラッシュはここまで

let canvas = null;
let g = null;
let stage = null;
let width = 0;
let height = 0;

const particles = [];
const numbers = [];
let flashState = { a: 0, rgb: '255,255,255', decay: 1 };
let shakeState = { mag: 0, decay: 1 };
let frozenUntil = 0;

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initFx(canvasEl, stageEl) {
  canvas = canvasEl;
  stage = stageEl;
  g = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function isFrozen(now) {
  return now < frozenUntil;
}

/** 全アニメを止めて打撃を焼き付ける */
export function hitstop(ms) {
  frozenUntil = performance.now() + ms;
}

export function shake(mag, ms) {
  if (reducedMotion) return;
  shakeState = { mag, decay: mag / (ms / 1000) };
}

export function flash(rgb, alpha) {
  if (reducedMotion) return;
  const a = Math.min(alpha, MAX_FLASH);
  flashState = { a, rgb, decay: a / 0.18 };
}

/** コンボに応じたヒット色 */
export function comboColor(combo) {
  if (combo >= 16) return '#ff5ce0';
  if (combo >= 10) return '#ff6a2a';
  if (combo >= 5) return '#ffd23f';
  return '#ffffff';
}

export function burst(x, y, opts = {}) {
  if (reducedMotion) return;
  const {
    count = 40, color = '#ffffff', speed = 520, dir = null, spread = Math.PI * 2, size = 3,
  } = opts;
  for (let i = 0; i < count; i += 1) {
    const angle = dir === null
      ? Math.random() * Math.PI * 2
      : dir + (Math.random() - 0.5) * spread;
    const v = speed * (0.25 + Math.random() * 0.95);
    const max = 0.28 + Math.random() * 0.45;
    particles.push({
      kind: 'streak',
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: max,
      max,
      size: size * (0.5 + Math.random()),
      color,
    });
  }
  particles.push({
    kind: 'ring', x, y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: 6, color,
  });
}

export function damageNumber(x, y, text, color = '#fff', size = 46) {
  // HUDに被らないよう上端を切る
  numbers.push({ x, y: Math.max(y, size + 40), vy: -230, life: 0.85, max: 0.85, text, color, size });
}

export function step(dt, now) {
  const frozen = now < frozenUntil;

  if (!frozen) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      if (p.kind === 'ring') { p.size += 900 * dt; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 1250 * dt;
      p.vx *= 1 - 2.2 * dt;
    }

    for (let i = numbers.length - 1; i >= 0; i -= 1) {
      const n = numbers[i];
      n.life -= dt;
      if (n.life <= 0) { numbers.splice(i, 1); continue; }
      n.y += n.vy * dt;
      n.vy += 620 * dt;
    }

    flashState.a = Math.max(0, flashState.a - flashState.decay * dt);
    shakeState.mag = Math.max(0, shakeState.mag - shakeState.decay * dt);
    if (stage) {
      const m = shakeState.mag;
      stage.style.transform = m > 0.05
        ? `translate3d(${(Math.random() - 0.5) * 2 * m}px, ${(Math.random() - 0.5) * 2 * m}px, 0)`
        : '';
    }
  }

  draw();
}

function draw() {
  g.clearRect(0, 0, width, height);

  for (const p of particles) {
    const t = p.life / p.max;
    g.globalAlpha = t;
    if (p.kind === 'ring') {
      g.strokeStyle = p.color;
      g.lineWidth = 6 * t;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.stroke();
      continue;
    }
    g.fillStyle = p.color;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(Math.atan2(p.vy, p.vx));
    g.fillRect(0, -p.size / 2, p.size * (2 + 6 * t), p.size);
    g.restore();
  }

  g.globalAlpha = 1;
  g.textAlign = 'center';
  g.lineJoin = 'round';
  for (const n of numbers) {
    const t = n.life / n.max;
    const pop = 1 + 0.5 * Math.max(0, 1 - (1 - t) * 7);
    g.globalAlpha = Math.min(1, t * 2.5);
    g.font = `900 ${n.size * pop}px "Arial Black", Impact, sans-serif`;
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(10,4,18,0.9)';
    g.strokeText(n.text, n.x, n.y);
    g.fillStyle = n.color;
    g.fillText(n.text, n.x, n.y);
  }

  g.globalAlpha = 1;
  if (flashState.a > 0.002) {
    g.fillStyle = `rgba(${flashState.rgb},${flashState.a})`;
    g.fillRect(0, 0, width, height);
  }
}

/** 要素の中心座標をCanvas座標で返す */
export function centerOf(el) {
  const r = el.getBoundingClientRect();
  const c = canvas.getBoundingClientRect();
  return { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height / 2 };
}
