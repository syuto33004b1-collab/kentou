import {
  createTyping, press, typedText, pendingText,
} from './romaji.js';
import {
  pickWord, wordsIn, TAGS, TIER_LABELS,
} from './words.js';
import {
  COUNTER_AT, wordLimitMs, playerDamage, cpuDamage, rankOf,
} from './battle.js';
import * as fx from './fx.js';
import * as sfx from './sound.js';
import * as st from './stats.js';

const $ = (sel) => document.querySelector(sel);

const stage = $('#stage');
const kanjiEl = $('#kanji');
const kanaEl = $('#kana');
const romajiEl = $('#romaji');
const comboEl = $('#combo');
const calloutEl = $('#callout');
const timerFill = $('#timer-fill');
const overlay = $('#overlay');
const imeWarn = $('#ime-warn');
const trainBar = $('#train-bar');
const p1 = $('#p1');
const p2 = $('#p2');
const soundBtn = $('#sound-toggle');
const hpBars = { p: $('#hp-p'), c: $('#hp-c') };

const MODES = [
  {
    key: '1', name: '見習い', en: 'ROOKIE', kpm: 110, grace: 1600, tiers: [0, 0, 0, 1], hint: 'ゆっくり。まず打ち切る練習',
  },
  {
    key: '2', name: '闘士', en: 'FIGHTER', kpm: 190, grace: 1100, tiers: [0, 1, 1, 2], hint: '対戦らしい速度。まずここから', best: true,
  },
  {
    key: '3', name: '鬼', en: 'DEMON', kpm: 290, grace: 800, tiers: [1, 1, 2, 2], hint: '大会速度。一瞬で溶ける',
  },
  {
    key: '4', name: '修練', en: 'TRAINING', kpm: null, train: true, hint: '時間制限なし。苦手を潰す',
  },
];

const stats = st.load();

const S = {
  phase: 'TITLE',
  mode: MODES[1],
  hp: { p: 100, c: 100 },
  combo: 0,
  maxCombo: 0,
  totalKeys: 0,
  totalMiss: 0,
  matchStart: 0,
  word: null,
  typing: null,
  wordElapsed: 0,
  wordLimit: 1,
  wordMiss: 0,
  lastKeyAt: 0,
  resumeTo: 'FIGHT',
  train: { tag: 'all', tier: 'all' },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isPlaying = () => S.phase === 'FIGHT' || S.phase === 'TRAIN';

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

  // 長いお題で横に溢れても、カーソルは常に見えるようにする
  const cur = romajiEl.querySelector('.cursor');
  if (cur) romajiEl.scrollLeft = cur.offsetLeft - romajiEl.clientWidth / 2;
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

/** 画面中央のアナウンス。FIGHT! / COUNTER! / SUPER! / 被弾 で共用する */
function callout(text, kind = '') {
  calloutEl.textContent = text;
  calloutEl.className = '';
  void calloutEl.offsetWidth;
  calloutEl.className = `show ${kind}`;
}

function renderTrainStats() {
  const secs = Math.max((performance.now() - S.matchStart) / 1000, 1);
  const total = S.totalKeys + S.totalMiss;
  $('#tv-keys').textContent = String(S.totalKeys);
  $('#tv-acc').textContent = total ? `${Math.round((S.totalKeys / total) * 100)}%` : '—';
  $('#tv-kpm').textContent = String(Math.round((S.totalKeys / secs) * 60));
}

function showOverlay(html) {
  overlay.innerHTML = html;
  overlay.hidden = false;
}

function clearPrompt() {
  kanjiEl.textContent = '';
  kanaEl.textContent = '';
  romajiEl.replaceChildren();
}

// --- ゲーム進行 ---

function nextWord() {
  const train = S.phase === 'TRAIN';
  let tiers = S.mode.tiers;
  if (train) tiers = S.train.tier === 'all' ? [0, 1, 2] : [S.train.tier];
  S.word = pickWord(tiers, train ? S.train.tag : 'all', S.word?.kana);
  S.typing = createTyping(S.word.kana);
  S.wordElapsed = 0;
  S.wordMiss = 0;
  S.wordLimit = S.mode.kpm ? wordLimitMs(S.typing.keystrokes, S.mode.kpm, S.mode.grace) : 0;
  p1.classList.remove('wind');
  renderPrompt();
  bump(kanjiEl, 'enter');
}

/** ラウンドコールを順に出してから対戦に入る。この間タイマーは進まない */
function enterReady(labels, next) {
  S.phase = 'READY';
  let i = 0;
  const tick = () => {
    if (S.phase !== 'READY') return; // 中断された
    if (i >= labels.length) {
      S.phase = next;
      S.lastKeyAt = performance.now();
      return;
    }
    const l = labels[i];
    i += 1;
    callout(l.text, l.kind);
    l.play?.();
    setTimeout(tick, l.ms);
  };
  tick();
}

function startMatch(mode) {
  S.mode = mode;
  S.hp = { p: 100, c: 100 };
  S.combo = 0;
  S.maxCombo = 0;
  S.totalKeys = 0;
  S.totalMiss = 0;
  S.matchStart = performance.now();
  S.word = null;
  overlay.hidden = true;
  stage.classList.remove('ko');
  imeWarn.hidden = true;
  fx.clear();

  const train = !!mode.train;
  document.body.classList.toggle('mode-train', train);
  trainBar.hidden = !train;

  S.phase = train ? 'TRAIN' : 'FIGHT'; // nextWord のティア選択に使う
  nextWord();

  if (train) {
    renderTrainSelectors();
    renderTrainStats();
    renderCombo();
    S.lastKeyAt = performance.now();
    callout('修練開始', 'ready');
    sfx.round();
    return;
  }

  renderHp('p');
  renderHp('c');
  renderCombo();
  enterReady([
    { text: 'ROUND 1', kind: 'ready', ms: 700, play: sfx.round },
    { text: 'FIGHT!', kind: 'fight', ms: 420, play: sfx.bell },
  ], 'FIGHT');
}

const RANK_FX = {
  light: { stop: 45, shake: 5, count: 20, kb: 18, size: 3.2 },
  mid: { stop: 80, shake: 9, count: 34, kb: 30, size: 4 },
  heavy: { stop: 135, shake: 16, count: 54, kb: 46, size: 4.8 },
  super: { stop: 210, shake: 26, count: 92, kb: 68, size: 5.6 },
};

function damageTo(side, amount, color) {
  S.hp[side] = Math.max(0, S.hp[side] - amount);
  renderHp(side);
  const target = side === 'c' ? p2 : p1;
  const { x, y } = fx.centerOf(target);
  fx.damageNumber(x, y - 40, String(amount), color, 40 + Math.min(28, amount));
  bump(target, 'hurt');
}

/** 完打の演出。対戦と修練で共用する */
function strike(rank, power, color) {
  const r = RANK_FX[rank];
  fx.hitstop(r.stop);
  fx.flash('255,255,255', 0.07 + power * 0.12);
  fx.shake(r.shake, 300 + r.stop);
  const at = fx.centerOf(p2);
  fx.burst(at.x - 30, at.y, {
    count: r.count, color, speed: 480 + power * 480, size: r.size,
  });
  fx.burst(at.x - 30, at.y, { count: 14, color: '#ffffff', speed: 250, size: 2.4 });
  if (rank === 'super') {
    fx.burst(at.x - 30, at.y, { count: 40, color: '#fff2b0', speed: 1000, size: 3 });
  }
  sfx.hit(rank, power);
  if (S.combo >= 2) sfx.combo(S.combo);
  bump(p1, 'attack');
  p2.style.setProperty('--kb', `${r.kb}px`);
  bump(p2, 'knockback');
}

function playerAttack() {
  const { dmg, counter, power } = playerDamage({
    keystrokes: S.typing.keystrokes,
    elapsedMs: S.wordElapsed,
    combo: S.combo,
    wordMiss: S.wordMiss,
    limitMs: S.wordLimit,
  });

  S.combo += 1;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  const color = fx.comboColor(S.combo);
  const rank = rankOf(dmg);
  strike(rank, power, color);

  if (counter) { callout('COUNTER!', 'counter'); sfx.counter(); } else if (rank === 'super') callout('SUPER!', 'super');

  damageTo('c', dmg, color);
  renderCombo();

  if (S.hp.c <= 0) return finishMatch('WIN');
  nextWord();
  return undefined;
}

function trainHit() {
  S.combo += 1;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  const n = S.typing.keystrokes;
  strike(n >= 14 ? 'heavy' : n >= 8 ? 'mid' : 'light', 0.5, fx.comboColor(S.combo));
  renderCombo();
  renderTrainStats();
  nextWord();
}

function cpuAttack() {
  const dmg = cpuDamage(S.typing.keystrokes);
  S.combo = 0;
  renderCombo();
  fx.hitstop(90);
  fx.flash('255,40,60', 0.2);
  fx.shake(14, 420);
  const at = fx.centerOf(p1);
  fx.burst(at.x + 30, at.y, { count: 40, color: '#ff3b5c', speed: 560, size: 3.6 });
  fx.burst(at.x + 30, at.y, { count: 14, color: '#ffffff', speed: 260, size: 2.4 });
  sfx.hurt();
  callout('被弾', 'hurt');
  bump(p2, 'attack');
  p1.style.setProperty('--kb', '52px');
  bump(p1, 'knockback');
  damageTo('p', dmg, '#ff5c7a');
  bump(romajiEl, 'broken');

  if (S.hp.p <= 0) return finishMatch('LOSE');
  nextWord();
  return undefined;
}

function onMiss(expected) {
  S.totalMiss += 1;
  S.wordMiss += 1;
  if (expected) st.recordMiss(stats, expected);

  // コンボは全断せず半減。全断はパニック連打での即死を招くうえ、
  // 「わざとミスして短いお題に戻る」抜け道を安くしてしまう
  const had = S.combo;
  S.combo = Math.floor(S.combo / 2);
  renderCombo();
  sfx.miss();
  fx.flash('255,40,60', 0.14);
  fx.shake(5, 180);
  bump(romajiEl, 'shakeout');
  if (had >= 2) {
    const at = fx.centerOf(romajiEl);
    fx.damageNumber(at.x, at.y - 60, 'HALF BREAK', '#ff3b5c', 30);
  }
  if (S.phase === 'TRAIN') { renderTrainStats(); return; }
  damageTo('p', 2, '#ff5c7a');
  if (S.hp.p <= 0) finishMatch('LOSE');
}

function weakKeyBlock() {
  const weak = st.weakKeys(stats);
  if (!weak.length) return '<p class="weak-none">苦手キーの判定には、もう少し打鍵が必要です</p>';
  const byMiss = weak[0].miss > 0;
  const items = weak
    .map((r) => `<li><b>${r.ch}</b><em>${byMiss ? `${Math.round(r.rate * 100)}%` : `${r.meanMs}ms`}</em></li>`)
    .join('');
  return `<div class="weak"><h3>${byMiss ? 'ミスが多いキー' : '打つのが遅いキー'}</h3><ul>${items}</ul></div>`;
}

function deltaOf(now, before) {
  if (before == null) return '';
  const d = Math.round((now - before) * 10) / 10;
  if (d === 0) return '<i class="flat">±0</i>';
  return `<i class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</i>`;
}

function finishMatch(outcome) {
  S.phase = 'ROUND_END';
  const secs = (performance.now() - S.matchStart) / 1000;
  calloutEl.className = '';
  stage.classList.add('ko');
  fx.hitstop(220);
  fx.flash('255,255,255', 0.35);
  fx.shake(26, 900);
  sfx.ko();
  const at = fx.centerOf(outcome === 'WIN' ? p2 : p1);
  fx.burst(at.x, at.y, { count: 90, color: '#ffd23f', speed: 900, size: 4.5 });
  fx.burst(at.x, at.y, { count: 50, color: '#ff3b5c', speed: 640, size: 3.5 });

  const total = S.totalKeys + S.totalMiss;
  const result = {
    kpm: Math.round((S.totalKeys / Math.max(secs, 1)) * 60),
    acc: total ? Math.round((S.totalKeys / total) * 1000) / 10 : null,
    maxCombo: S.maxCombo,
    secs: Math.round(secs * 10) / 10,
    keys: S.totalKeys,
    outcome,
  };
  const prev = stats.last;
  st.mergeMatch(stats, result);
  st.save(stats);

  const best = stats.best
    ? `<p class="best-line">自己ベスト　KPM <b>${stats.best.kpm}</b>　正確率 <b>${stats.best.acc}%</b>　コンボ <b>${stats.best.maxCombo}</b>　—　${stats.matches}戦 ${stats.wins}勝</p>`
    : `<p class="best-line">${stats.matches}戦 ${stats.wins}勝</p>`;

  setTimeout(() => {
    if (S.phase !== 'ROUND_END') return;
    showOverlay(`
      <div class="ko-title ${outcome === 'WIN' ? 'win' : 'lose'}">${outcome === 'WIN' ? 'K.O.' : 'YOU LOSE'}</div>
      <div class="ko-sub">${outcome === 'WIN' ? '相手を沈めた' : '沈められた'}　—　${S.mode.name} / ${S.mode.en}</div>
      <dl class="stats">
        <div><dt>KPM</dt><dd>${result.kpm}${deltaOf(result.kpm, prev?.kpm)}</dd></div>
        <div><dt>正確率</dt><dd>${result.acc == null ? '—' : `${result.acc}<small>%</small>${deltaOf(result.acc, prev?.acc)}`}</dd></div>
        <div><dt>最大コンボ</dt><dd>${result.maxCombo}</dd></div>
        <div><dt>時間</dt><dd>${result.secs}<small>s</small></dd></div>
      </dl>
      ${weakKeyBlock()}
      ${best}
      <p class="keys"><kbd>R</kbd> もう一戦　<kbd>Esc</kbd> モード選択</p>
    `);
  }, 700);
  return undefined;
}

function titleScreen() {
  S.phase = 'TITLE';
  stage.classList.remove('ko');
  document.body.classList.remove('mode-train');
  trainBar.hidden = true;
  imeWarn.hidden = true;
  clearPrompt();
  calloutEl.className = '';
  fx.clear();
  st.save(stats);

  const rows = MODES.map((m) => `
    <li${m.best ? ' class="pick"' : ''}>
      <kbd>${m.key}</kbd>
      <span><b>${m.name}</b> ${m.en}<em>${m.hint}</em></span>
      <i>${m.kpm ? `${m.kpm}<small>KPM</small>` : '∞'}</i>
    </li>`).join('');

  showOverlay(`
    <h1 class="logo"><span class="logo-jp">鍵闘</span><span class="logo-en">KENTOU</span></h1>
    <p class="tagline">打ち切れ。それが一撃になる。</p>
    <ul class="rules">
      <li><b>打ち切る</b>＝攻撃</li>
      <li><b>時間切れ</b>＝被弾</li>
      <li><b>ミス</b>＝よろけ（コンボ半減）</li>
    </ul>
    <ul class="diff">${rows}</ul>
    <p class="keys">数字キーかクリックで開始　—　<b>日本語入力はOFF（半角英数）に</b></p>
    <details class="rtable">
      <summary>ローマ字の受理ルール</summary>
      <table>
        <tr><th>し</th><td>shi / si / ci</td><th>つ</th><td>tsu / tu</td></tr>
        <tr><th>ち</th><td>chi / ti</td><th>ふ</th><td>fu / hu</td></tr>
        <tr><th>じ</th><td>ji / zi</td><th>じゃ</th><td>ja / jya / zya</td></tr>
        <tr><th>しゅ</th><td>shu / syu</td><th>ちょ</th><td>cho / tyo / cyo</td></tr>
        <tr><th>っ</th><td>子音重ね（sekka）/ xtu / ltu</td><th>ー</th><td>-</td></tr>
        <tr><th>ん</th><td colspan="3">後続が子音なら <b>n</b> 単独。母音・な行・や行の前と語末は <b>nn</b> / n' / xn</td></tr>
      </table>
      <p>単独 <b>n</b> で「ん」を確定した直後の追加 <b>n</b> は、IMEと同じく飲み込みます。</p>
    </details>
    <p class="nokb">この先は物理キーボードが必要です</p>
  `);
}

function pauseGame() {
  if (!isPlaying() && S.phase !== 'READY') return;
  S.resumeTo = S.phase === 'TRAIN' ? 'TRAIN' : 'FIGHT';
  S.phase = 'PAUSED';
  calloutEl.className = '';
  showOverlay(`
    <div class="ko-title pause">PAUSE</div>
    <p class="tagline">画面から離れたので止めました</p>
    <p class="keys">何かキーを押すと再開　—　<kbd>Esc</kbd> モード選択</p>
  `);
}

function resumeGame() {
  overlay.hidden = true;
  if (S.resumeTo === 'TRAIN') {
    S.phase = 'TRAIN';
    S.lastKeyAt = performance.now();
    return;
  }
  // 復帰直後に時間切れで殴られないよう、読む時間を返す
  S.wordElapsed = 0;
  enterReady([{ text: 'FIGHT!', kind: 'fight', ms: 420, play: sfx.bell }], 'FIGHT');
}

// --- 修練モードのセレクタ ---

function renderTrainSelectors() {
  const tags = [{ id: 'all', label: 'ぜんぶ' }, ...TAGS];
  const tiers = [{ id: 'all', label: 'ぜんぶ' }, ...TIER_LABELS.map((label, i) => ({ id: i, label }))];
  $('#tsel-tag').innerHTML = tags.map((t) => `<button type="button" data-tag="${t.id}" class="${S.train.tag === t.id ? 'on' : ''}">${t.label}<em>${wordsIn(S.train.tier, t.id).length}</em></button>`).join('');
  $('#tsel-tier').innerHTML = tiers.map((t) => `<button type="button" data-tier="${t.id}" class="${S.train.tier === t.id ? 'on' : ''}">${t.label}<em>${wordsIn(t.id, S.train.tag).length}</em></button>`).join('');
}

trainBar.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tag], button[data-tier]');
  if (!b || S.phase !== 'TRAIN') return;
  if (b.dataset.tag) S.train.tag = b.dataset.tag;
  else S.train.tier = b.dataset.tier === 'all' ? 'all' : Number(b.dataset.tier);
  renderTrainSelectors();
  nextWord();
  b.blur();
});

// --- 入力 ---

window.addEventListener('compositionstart', () => { imeWarn.hidden = false; });

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  sfx.unlock();
  const k = e.key;

  // IMEがONだと keydown は Process か非ASCIIで届く。黙って無視せず理由を出す
  if (e.isComposing || k === 'Process' || (k.length === 1 && k.charCodeAt(0) > 126)) {
    imeWarn.hidden = false;
    return;
  }

  if (S.phase === 'TITLE') {
    const m = MODES.find((x) => x.key === k);
    if (m) { e.preventDefault(); startMatch(m); }
    return;
  }

  if (S.phase === 'PAUSED') {
    e.preventDefault();
    if (k === 'Escape') titleScreen();
    else resumeGame();
    return;
  }

  if (S.phase === 'ROUND_END') {
    if (k === 'r' || k === 'R') { e.preventDefault(); startMatch(S.mode); }
    if (k === 'Escape') { e.preventDefault(); titleScreen(); }
    return;
  }

  if (k === 'Escape') { e.preventDefault(); titleScreen(); return; }
  if (!isPlaying()) return; // READY 中の打鍵はミスにしない
  if (k.length !== 1 || k.charCodeAt(0) < 33) return;
  e.preventDefault();
  imeWarn.hidden = true;

  const expected = pendingText(S.typing)[0];
  const r = press(S.typing, k.toLowerCase());
  if (r === 'miss') { onMiss(expected); renderPrompt(); return; }

  const now = performance.now();
  st.recordHit(stats, expected, now - S.lastKeyAt);
  S.lastKeyAt = now;
  S.totalKeys += 1;
  sfx.key(S.combo);
  fx.shake(2.5, 60);
  renderPrompt(true);

  // 残り1〜2文字で踏み込む。打撃感の本体は当たる前の予兆にある
  if (pendingText(S.typing).length <= 2) p1.classList.add('wind');

  if (r === 'done') {
    if (S.phase === 'TRAIN') trainHit();
    else playerAttack();
  } else if (S.phase === 'TRAIN') renderTrainStats();
});

soundBtn.addEventListener('click', () => {
  sfx.unlock();
  sfx.setEnabled(!sfx.isEnabled());
  soundBtn.textContent = sfx.isEnabled() ? '🔊 SOUND ON' : '🔇 SOUND OFF';
  soundBtn.blur();
});

overlay.addEventListener('click', (e) => {
  if (S.phase !== 'TITLE') return;
  const li = e.target.closest('.diff li');
  if (!li) return;
  sfx.unlock();
  startMatch(MODES[[...li.parentElement.children].indexOf(li)]);
});

// 画面から離れたら止める。「戻ってきたらHPが溶けていた」をなくす
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', pauseGame);

// --- メインループ ---

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (S.phase === 'FIGHT' && !fx.isFrozen(now)) {
    S.wordElapsed += dt * 1000;
    const left = clamp(1 - S.wordElapsed / S.wordLimit, 0, 1);
    timerFill.style.width = `${left * 100}%`;
    timerFill.classList.toggle('urgent', left <= 1 - COUNTER_AT);
    if (S.wordElapsed >= S.wordLimit) cpuAttack();
  }

  fx.step(dt, now);
  requestAnimationFrame(frame);
}

fx.initFx($('#fx'), stage);
if (fx.reducedMotion) document.body.classList.add('reduced');
titleScreen();
requestAnimationFrame(frame);
