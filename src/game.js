import { createTyping, press, typedText, pendingText } from './romaji.js';
import { pickWord } from './words.js';
import * as fx from './fx.js';
import * as sfx from './sound.js';

const $ = (sel) => document.querySelector(sel);

const stage = $('#stage');
const kanjiEl = $('#kanji');
const kanaEl = $('#kana');
const romajiEl = $('#romaji');
const comboEl = $('#combo');
const timerFill = $('#timer-fill');
const overlay = $('#overlay');
const p1 = $('#p1');
const p2 = $('#p2');
const soundBtn = $('#sound-toggle');
const hpBars = { p: $('#hp-p'), c: $('#hp-c') };

const DIFFICULTY = [
  { key: '1', name: '修行 / TRAINING', kpm: 110, grace: 1500 },
  { key: '2', name: '闘士 / FIGHTER', kpm: 190, grace: 1000 },
  { key: '3', name: '鬼 / DEMON', kpm: 290, grace: 600 },
];

const S = {
  phase: 'TITLE',
  diff: DIFFICULTY[1],
  hp: { p: 100, c: 100 },
  combo: 0,
  maxCombo: 0,
  totalKeys: 0,
  totalMiss: 0,
  matchStart: 0,
  matchTime: 0,
  word: null,
  typing: null,
  wordElapsed: 0,
  wordLimit: 1,
  wordMiss: 0,
  result: null,
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// --- 描画 ---

function renderPrompt(justTyped = false) {
  kanjiEl.textContent = S.word.kanji;
  kanaEl.textContent = S.word.kana;

  const typed = typedText(S.typing);
  const pend = pendingText(S.typing);
  const spans = [];
  [...typed].forEach((c, i) => {
    const s = document.createElement('span');
    s.className = justTyped && i === typed.length - 1 ? 'ch done just' : 'ch done';
    s.textContent = c;
    spans.push(s);
  });
  [...pend].forEach((c, i) => {
    const s = document.createElement('span');
    s.className = i === 0 ? 'ch cursor' : 'ch rest';
    s.textContent = c;
    spans.push(s);
  });
  romajiEl.replaceChildren(...spans);
}

function renderHp(side) {
  const pct = `${Math.max(0, S.hp[side])}%`;
  const bar = hpBars[side];
  bar.querySelector('.hp-chip').style.width = pct;
  bar.querySelector('.hp-fill').style.width = pct;
  bar.classList.toggle('danger', S.hp[side] <= 30);
}

function renderCombo() {
  if (S.combo < 2) {
    comboEl.textContent = '';
    comboEl.className = '';
    return;
  }
  comboEl.textContent = `${S.combo} COMBO`;
  comboEl.style.color = fx.comboColor(S.combo);
  comboEl.className = '';
  void comboEl.offsetWidth; // アニメーションを打ち直す
  comboEl.className = 'pop';
}

function bump(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function showOverlay(html) {
  overlay.innerHTML = html;
  overlay.hidden = false;
}

// --- ゲーム進行 ---

function nextWord() {
  S.word = pickWord(S.combo, S.word?.kana);
  S.typing = createTyping(S.word.kana);
  S.wordElapsed = 0;
  S.wordMiss = 0;
  const secPerKey = 60 / S.diff.kpm;
  S.wordLimit = S.typing.keystrokes * secPerKey * 1000 + S.diff.grace;
  renderPrompt();
  bump(kanjiEl, 'enter');
}

function startMatch(diff) {
  S.phase = 'FIGHT';
  S.diff = diff;
  S.hp = { p: 100, c: 100 };
  S.combo = 0;
  S.maxCombo = 0;
  S.totalKeys = 0;
  S.totalMiss = 0;
  S.matchStart = performance.now();
  S.word = null;
  overlay.hidden = true;
  stage.classList.remove('ko');
  renderHp('p');
  renderHp('c');
  renderCombo();
  nextWord();
  sfx.bell();
  fx.flash('255,255,255', 0.2);
}

function damageTo(side, amount, color) {
  S.hp[side] = Math.max(0, S.hp[side] - amount);
  renderHp(side);
  const target = side === 'c' ? p2 : p1;
  const { x, y } = fx.centerOf(target);
  fx.damageNumber(x, y - 40, String(amount), color, 40 + Math.min(28, amount));
  bump(target, side === 'c' ? 'hurt' : 'hurt');
}

function playerAttack() {
  const secs = Math.max(0.35, S.wordElapsed / 1000);
  const kpm = (S.typing.keystrokes / secs) * 60;
  const speed = clamp(kpm / 200, 0.55, 2.2);
  const comboMul = 1 + Math.min(S.combo, 20) * 0.06;
  const perfect = S.wordMiss === 0 ? 1.25 : 1;
  const base = 4 + S.typing.keystrokes * 0.55;
  const dmg = Math.round(base * speed * comboMul * perfect);

  S.combo += 1;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  const color = fx.comboColor(S.combo);
  const power = clamp((speed - 0.55) / 1.65, 0, 1);

  fx.hitstop(70 + power * 40);
  fx.flash('255,255,255', 0.09 + power * 0.13);
  fx.shake(7 + power * 12, 320);
  const at = fx.centerOf(p2);
  fx.burst(at.x - 30, at.y, {
    count: 34 + Math.round(power * 34), color, speed: 520 + power * 460, size: 4.2,
  });
  fx.burst(at.x - 30, at.y, {
    count: 16, color: '#ffffff', speed: 250, size: 2.6,
  });
  sfx.hit(power);
  if (S.combo >= 2) sfx.combo(S.combo);

  bump(p1, 'attack');
  bump(p2, 'knockback');
  damageTo('c', dmg, color);
  renderCombo();

  if (S.hp.c <= 0) return finishMatch('WIN');
  nextWord();
  return undefined;
}

function cpuAttack() {
  const dmg = Math.round(6 + S.typing.keystrokes * 0.45);
  S.combo = 0;
  renderCombo();
  fx.hitstop(60);
  fx.flash('255,40,60', 0.2);
  fx.shake(10, 380);
  const at = fx.centerOf(p1);
  fx.burst(at.x + 30, at.y, { count: 28, color: '#ff3b5c', speed: 480, size: 3.2 });
  sfx.hurt();
  bump(p2, 'attack');
  bump(p1, 'knockback');
  damageTo('p', dmg, '#ff5c7a');
  bump(romajiEl, 'broken');

  if (S.hp.p <= 0) return finishMatch('LOSE');
  nextWord();
  return undefined;
}

function onMiss() {
  S.totalMiss += 1;
  S.wordMiss += 1;
  const hadCombo = S.combo >= 2;
  S.combo = 0;
  renderCombo();
  sfx.miss();
  fx.flash('255,40,60', 0.16);
  fx.shake(5, 180);
  bump(romajiEl, 'shakeout');
  if (hadCombo) {
    const at = fx.centerOf(romajiEl);
    fx.damageNumber(at.x, at.y - 60, 'BREAK', '#ff3b5c', 34);
  }
  damageTo('p', 2, '#ff5c7a');
  if (S.hp.p <= 0) finishMatch('LOSE');
}

function finishMatch(result) {
  S.phase = 'ROUND_END';
  S.result = result;
  S.matchTime = performance.now() - S.matchStart;
  stage.classList.add('ko');
  fx.hitstop(220);
  fx.flash('255,255,255', 0.35);
  fx.shake(26, 900);
  sfx.ko();
  const at = fx.centerOf(result === 'WIN' ? p2 : p1);
  fx.burst(at.x, at.y, { count: 90, color: '#ffd23f', speed: 900, size: 4.5 });
  fx.burst(at.x, at.y, { count: 50, color: '#ff3b5c', speed: 640, size: 3.5 });

  const secs = S.matchTime / 1000;
  const kpm = Math.round((S.totalKeys / Math.max(secs, 1)) * 60);
  const total = S.totalKeys + S.totalMiss;
  const acc = total ? Math.round((S.totalKeys / total) * 1000) / 10 : 100;

  setTimeout(() => {
    showOverlay(`
      <div class="ko-title ${result === 'WIN' ? 'win' : 'lose'}">${result === 'WIN' ? 'K.O.' : 'YOU LOSE'}</div>
      <div class="ko-sub">${result === 'WIN' ? '相手を沈めた' : '沈められた'}</div>
      <dl class="stats">
        <div><dt>KPM</dt><dd>${kpm}</dd></div>
        <div><dt>正確率</dt><dd>${acc}<small>%</small></dd></div>
        <div><dt>最大コンボ</dt><dd>${S.maxCombo}</dd></div>
        <div><dt>時間</dt><dd>${secs.toFixed(1)}<small>s</small></dd></div>
      </dl>
      <p class="keys"><kbd>R</kbd> もう一戦　<kbd>Esc</kbd> 難易度選択</p>
    `);
  }, 700);
}

function titleScreen() {
  S.phase = 'TITLE';
  stage.classList.remove('ko');
  showOverlay(`
    <h1 class="logo"><span class="logo-jp">鍵闘</span><span class="logo-en">KENTOU</span></h1>
    <p class="tagline">打ち切れ。それが一撃になる。</p>
    <ul class="diff">
      ${DIFFICULTY.map((d) => `<li><kbd>${d.key}</kbd><span>${d.name}</span><em>${d.kpm} KPM</em></li>`).join('')}
    </ul>
    <p class="keys">数字キーで開始　—　ローマ字入力で日本語のお題を打つ</p>
    <p class="nokb">この先は物理キーボードが必要です</p>
  `);
}

// 難易度はクリック／タップでも選べる
overlay.addEventListener('click', (e) => {
  const li = e.target.closest('.diff li');
  if (!li || S.phase !== 'TITLE') return;
  sfx.unlock();
  startMatch(DIFFICULTY[[...li.parentElement.children].indexOf(li)]);
});

// --- 入力 ---

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  sfx.unlock();
  const k = e.key;

  if (S.phase === 'TITLE') {
    const d = DIFFICULTY.find((x) => x.key === k);
    if (d) { e.preventDefault(); startMatch(d); }
    return;
  }

  if (S.phase === 'ROUND_END') {
    if (k === 'r' || k === 'R') { e.preventDefault(); startMatch(S.diff); }
    if (k === 'Escape') { e.preventDefault(); titleScreen(); }
    return;
  }

  if (k.length !== 1 || k.charCodeAt(0) < 33 || k.charCodeAt(0) > 126) return;
  e.preventDefault();

  const r = press(S.typing, k.toLowerCase());
  if (r === 'miss') { onMiss(); renderPrompt(); return; }

  S.totalKeys += 1;
  sfx.key(S.combo);
  fx.shake(2.5, 60);
  renderPrompt(true);
  if (r === 'done') playerAttack();
});

soundBtn.addEventListener('click', () => {
  sfx.unlock();
  sfx.setEnabled(!sfx.isEnabled());
  soundBtn.textContent = sfx.isEnabled() ? '🔊 SOUND ON' : '🔇 SOUND OFF';
  soundBtn.blur();
});

// --- メインループ ---

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (S.phase === 'FIGHT' && !fx.isFrozen(now)) {
    S.wordElapsed += dt * 1000;
    timerFill.style.width = `${clamp(1 - S.wordElapsed / S.wordLimit, 0, 1) * 100}%`;
    timerFill.classList.toggle('urgent', S.wordElapsed / S.wordLimit > 0.75);
    if (S.wordElapsed >= S.wordLimit) cpuAttack();
  }

  fx.step(dt, now);
  requestAnimationFrame(frame);
}

fx.initFx($('#fx'), stage);
if (fx.reducedMotion) document.body.classList.add('reduced');
titleScreen();
requestAnimationFrame(frame);
