import {
  createTyping, press, typedText, pendingText,
} from './romaji.js';
import {
  pickWord, wordsIn, parseWordList, loadCustom, saveCustom, getCustom,
  getSource, setSource, SOURCES, TAGS, TIER_LABELS,
} from './words.js';
import {
  COUNTER_AT, wordLimitMs, playerDamage, cpuDamage, rankOf, rampedKpm, recommendKpm,
} from './battle.js';
import {
  titleHtml, pauseHtml, resultHtml, calibHtml,
} from './screens.js';
import * as fx from './fx.js';
import * as sfx from './sound.js';
import * as voice from './voice.js';
import * as st from './stats.js';

const $ = (sel) => document.querySelector(sel);

const stage = $('#stage');
const kanjiEl = $('#kanji');
const kanaEl = $('#kana');
const romajiEl = $('#romaji');
const comboEl = $('#combo');
const calloutEl = $('#callout');
const timerFill = $('#timer-fill');
const timerLabel = $('#timer-label');
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
    key: '2', name: '闘士', en: 'FIGHTER', kpm: 190, grace: 1100, tiers: [0, 1, 1, 2], hint: '対戦らしい速度。まずここから',
  },
  {
    key: '3', name: '鬼', en: 'DEMON', kpm: 290, grace: 800, tiers: [1, 1, 2, 2], hint: '大会速度。一瞬で溶ける',
  },
  {
    key: '4', name: '修練', en: 'TRAINING', kpm: null, train: true, hint: '時間制限なし。苦手を潰す',
  },
  {
    key: '0', name: '診断', en: 'CALIBRATE', kpm: null, calib: true, mark: '10s', hint: '10秒で実測して、おすすめを出す',
  },
];

const FIGHT_MODES = MODES.filter((m) => m.kpm);
const CALIB_MS = 10000;
// アナウンサーは合成音に負けないよう持ち上げる（音源は -15 LUFS / TP -1dB 正規化済み）。
// 2.2倍だと 0dBFS を超えてクリップしたので実測で詰めた値
const VOICE_GAIN = 1.5;
// リプレイと所要時間の記録を残す上限。長期戦でも際限なく溜めない
const MAX_LOG = 40;

const stats = st.load();
loadCustom();

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
  wordLimit: 0,
  wordMiss: 0,
  lastKeyAt: 0,
  resumeTo: 'FIGHT',
  train: { tag: 'all', tier: 'all' },
  log: [],
  rec: null,
  calibEnd: 0,
  calibMode: null,
  result: null,
  prevResult: null,
  outcome: null,
  replayTimers: [],
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isPlaying = () => S.phase === 'FIGHT' || S.phase === 'TRAIN' || S.phase === 'CALIB';

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

/** CPUに与えたダメージの割合。追い詰めるほど相手は速くなる */
function cpuProgress() {
  return 1 - S.hp.c / 100;
}

// --- ゲーム進行 ---

function nextWord() {
  const train = S.phase === 'TRAIN';
  let tiers = S.mode.tiers ?? [0, 1, 2];
  if (train) tiers = S.train.tier === 'all' ? [0, 1, 2] : [S.train.tier];
  if (S.phase === 'CALIB') tiers = [0]; // 診断は短文だけ。読む時間の差を測りたくない

  S.word = pickWord(tiers, train ? S.train.tag : 'all', S.word?.kana);
  S.typing = createTyping(S.word.kana);
  S.wordElapsed = 0;
  S.wordMiss = 0;

  if (S.mode.kpm) {
    const kpm = rampedKpm(S.mode.kpm, cpuProgress());
    S.wordLimit = wordLimitMs(S.typing.keystrokes, kpm, S.mode.grace);
    timerLabel.textContent = `残り時間 · CPU ${Math.round(kpm)} KPM`;
  } else {
    S.wordLimit = 0;
  }

  S.rec = {
    kanji: S.word.kanji,
    kana: S.word.kana,
    limitMs: S.wordLimit,
    keys: [],
    misses: 0,
    ms: 0,
    outcome: null,
    startAt: 0,
  };
  if (S.log.length >= MAX_LOG) S.log.shift();
  S.log.push(S.rec);

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

function resetMatch(mode) {
  S.mode = mode;
  S.hp = { p: 100, c: 100 };
  S.combo = 0;
  S.maxCombo = 0;
  S.totalKeys = 0;
  S.totalMiss = 0;
  S.matchStart = performance.now();
  S.word = null;
  S.log = [];
  overlay.hidden = true;
  stage.classList.remove('ko');
  imeWarn.hidden = true;
  fx.clear();
  stopReplay();
}

function startMatch(mode) {
  if (mode.calib) { startCalibration(); return; }
  resetMatch(mode);

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
    { text: 'ROUND 1', kind: 'ready', ms: 700, play: callRound },
    { text: 'FIGHT!', kind: 'fight', ms: 420, play: callFight },
  ], 'FIGHT');
}

function callRound() { sfx.round(); voice.play('round1', VOICE_GAIN); }
function callFight() { sfx.bell(); voice.play('fight', VOICE_GAIN); }

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

/** 完打の演出。対戦・修練・診断・リプレイで共用する */
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

function closeRec(outcome) {
  if (!S.rec) return;
  S.rec.outcome = outcome;
  S.rec.ms = Math.round(S.wordElapsed);
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

  if (counter) {
    callout('COUNTER!', 'counter');
    sfx.counter();
    voice.play('counter', VOICE_GAIN);
  } else if (rank === 'super') {
    callout('SUPER!', 'super');
    voice.play('super', VOICE_GAIN);
  }

  closeRec('hit');
  damageTo('c', dmg, color);
  renderCombo();

  if (S.hp.c <= 0) { finishMatch('WIN'); return; }
  nextWord();
}

function trainHit() {
  S.combo += 1;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  const n = S.typing.keystrokes;
  strike(n >= 14 ? 'heavy' : n >= 8 ? 'mid' : 'light', 0.5, fx.comboColor(S.combo));
  closeRec('hit');
  renderCombo();
  renderTrainStats();
  nextWord();
}

function cpuAttack() {
  // 打てていた分だけ被弾を軽くする。少し遅いだけで一方的に溶けないように
  const progress = typedText(S.typing).length / Math.max(1, S.typing.keystrokes);
  const dmg = cpuDamage(S.typing.keystrokes, progress);
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
  closeRec('timeout');
  damageTo('p', dmg, '#ff5c7a');
  bump(romajiEl, 'broken');

  if (S.hp.p <= 0) { finishMatch('LOSE'); return; }
  nextWord();
}

function onMiss(expected) {
  S.totalMiss += 1;
  S.wordMiss += 1;
  if (S.rec) S.rec.misses += 1;
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
  if (S.phase !== 'FIGHT') {
    if (S.phase === 'TRAIN') renderTrainStats();
    return;
  }
  damageTo('p', 2, '#ff5c7a');
  if (S.hp.p <= 0) finishMatch('LOSE');
}

// --- 結果 ---

function measure() {
  const secs = (performance.now() - S.matchStart) / 1000;
  const total = S.totalKeys + S.totalMiss;
  return {
    kpm: Math.round((S.totalKeys / Math.max(secs, 1)) * 60),
    acc: total ? Math.round((S.totalKeys / total) * 1000) / 10 : null,
    maxCombo: S.maxCombo,
    secs: Math.round(secs * 10) / 10,
    keys: S.totalKeys,
  };
}

function renderResult() {
  S.phase = 'ROUND_END';
  showOverlay(resultHtml({
    outcome: S.outcome,
    mode: S.mode,
    result: S.result,
    prev: S.prevResult,
    best: stats.best,
    matches: stats.matches,
    wins: stats.wins,
    weak: st.weakKeys(stats),
    log: S.log.filter((r) => r.outcome),
  }));
}

function finishMatch(outcome) {
  // 結果が出るまでの間は入力を捨てる。勝った瞬間まで打っていると、
  // 打鍵の余りが R（再戦）や V（リプレイ）として拾われてしまう
  S.phase = 'SETTLE';
  S.outcome = outcome;
  calloutEl.className = '';
  if (S.rec && !S.rec.outcome) closeRec(outcome === 'WIN' ? 'hit' : 'timeout');
  stage.classList.add('ko');
  fx.hitstop(220);
  fx.flash('255,255,255', 0.35);
  fx.shake(26, 900);
  sfx.ko();
  setTimeout(() => voice.play(outcome === 'WIN' ? 'ko' : 'lose', VOICE_GAIN * 1.15), 260);
  const at = fx.centerOf(outcome === 'WIN' ? p2 : p1);
  fx.burst(at.x, at.y, { count: 90, color: '#ffd23f', speed: 900, size: 4.5 });
  fx.burst(at.x, at.y, { count: 50, color: '#ff3b5c', speed: 640, size: 3.5 });

  S.result = { ...measure(), outcome };
  S.prevResult = stats.last;
  st.mergeMatch(stats, S.result);
  st.save(stats);

  setTimeout(() => {
    if (S.phase === 'SETTLE') renderResult();
  }, 700);
}

// --- 校正（10秒の実測） ---

function startCalibration() {
  resetMatch(MODES.find((m) => m.calib));
  document.body.classList.remove('mode-train');
  trainBar.hidden = true;
  renderHp('p');
  renderHp('c');
  renderCombo();
  S.phase = 'CALIB';
  nextWord();
  S.calibEnd = performance.now() + CALIB_MS;
  S.lastKeyAt = performance.now();
  callout('10秒 診断', 'ready');
  sfx.round();
}

function finishCalibration() {
  const m = measure();
  const target = recommendKpm(m.kpm, FIGHT_MODES.map((x) => x.kpm));
  S.calibMode = FIGHT_MODES.find((x) => x.kpm === target) ?? FIGHT_MODES[0];
  stats.calibratedKpm = m.kpm;
  st.save(stats);
  S.phase = 'CALIB_END';
  calloutEl.className = '';
  clearPrompt();
  sfx.bell();
  fx.flash('255,255,255', 0.2);
  showOverlay(calibHtml({
    kpm: m.kpm, acc: m.acc, keys: m.keys, mode: S.calibMode,
  }));
}

// --- リプレイ ---

function stopReplay() {
  S.replayTimers.forEach(clearTimeout);
  S.replayTimers = [];
  document.body.classList.remove('mode-replay');
}

function endReplay() {
  stopReplay();
  clearPrompt();
  calloutEl.className = '';
  stage.classList.add('ko');
  renderResult();
}

function startReplay() {
  const log = S.log.filter((r) => r.outcome && r.keys.length);
  if (!log.length) return;
  stopReplay();
  S.phase = 'REPLAY';
  overlay.hidden = true;
  stage.classList.remove('ko');
  fx.clear();
  document.body.classList.add('mode-replay');
  timerLabel.textContent = 'リプレイ · 何かキーで戻る';

  let i = 0;
  const at = (fn, ms) => S.replayTimers.push(setTimeout(fn, ms));

  const playWord = () => {
    if (S.phase !== 'REPLAY') return;
    if (i >= log.length) {
      at(() => { if (S.phase === 'REPLAY') endReplay(); }, 600);
      return;
    }
    const rec = log[i];
    i += 1;
    S.word = { kanji: rec.kanji, kana: rec.kana };
    S.typing = createTyping(rec.kana);
    renderPrompt();
    bump(kanjiEl, 'enter');

    rec.keys.forEach((k) => at(() => {
      if (S.phase !== 'REPLAY') return;
      const r = press(S.typing, k.ch);
      renderPrompt(r !== 'miss');
      if (r === 'miss') { sfx.miss(); bump(romajiEl, 'shakeout'); return; }
      sfx.key(0);
      if (r === 'done') strike('mid', 0.5, '#ffd23f');
    }, k.t));

    const lastAt = rec.keys.at(-1)?.t ?? 0;
    at(playWord, lastAt + (rec.outcome === 'timeout' ? 900 : 450));
  };

  callout('REPLAY', 'ready');
  at(playWord, 500);
}

// --- タイトル ---

function recommendedKey() {
  if (!stats.calibratedKpm) return '2';
  const target = recommendKpm(stats.calibratedKpm, FIGHT_MODES.map((m) => m.kpm));
  return FIGHT_MODES.find((m) => m.kpm === target)?.key ?? '2';
}

function titleScreen({ keepText, status } = {}) {
  S.phase = 'TITLE';
  stage.classList.remove('ko');
  document.body.classList.remove('mode-train');
  trainBar.hidden = true;
  imeWarn.hidden = true;
  clearPrompt();
  calloutEl.className = '';
  fx.clear();
  stopReplay();
  st.save(stats);

  showOverlay(titleHtml({
    modes: MODES,
    recommendedKey: recommendedKey(),
    custom: getCustom(),
    source: getSource(),
    sources: SOURCES,
    calibratedKpm: stats.calibratedKpm,
  }));

  if (keepText !== undefined) {
    const box = $('#my-input');
    box.value = keepText;
    box.closest('details').open = true;
  }
  if (status) $('#my-status').innerHTML = status;
}

function pauseGame() {
  if (S.phase !== 'FIGHT' && S.phase !== 'TRAIN' && S.phase !== 'READY') return;
  S.resumeTo = S.phase === 'TRAIN' ? 'TRAIN' : 'FIGHT';
  S.phase = 'PAUSED';
  calloutEl.className = '';
  showOverlay(pauseHtml());
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
  enterReady([{ text: 'FIGHT!', kind: 'fight', ms: 420, play: callFight }], 'FIGHT');
}

// --- 修練モードのセレクタ ---

function renderTrainSelectors() {
  const tags = [{ id: 'all', label: 'ぜんぶ' }, ...TAGS];
  const tiers = [{ id: 'all', label: 'ぜんぶ' }, ...TIER_LABELS.map((label, i) => ({ id: i, label }))];
  const chip = (attr, id, label, count) => {
    const on = (attr === 'tag' ? S.train.tag : S.train.tier) === id;
    return `<button type="button" data-${attr}="${id}"${on ? ' class="on"' : ''}${count === 0 ? ' disabled' : ''}>${label}<em>${count}</em></button>`;
  };
  $('#tsel-tag').innerHTML = tags
    .map((t) => chip('tag', t.id, t.label, wordsIn(S.train.tier, t.id).length)).join('');
  $('#tsel-tier').innerHTML = tiers
    .map((t) => chip('tier', t.id, t.label, wordsIn(t.id, S.train.tag).length)).join('');
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

// --- 自作お題 ---

function applyCustomWords() {
  const text = $('#my-input').value;
  const { words, errors } = parseWordList(text);
  saveCustom(words);
  const ok = `<b>${words.length}件</b>を保存しました`;
  const bad = errors.length
    ? `<span class="err">${errors.length}行は読み込めません</span><ul>${errors.slice(0, 6).map((e) => `<li>${e.line}行目: ${e.reason}</li>`).join('')}</ul>`
    : '';
  titleScreen({ keepText: text, status: ok + bad });
}

overlay.addEventListener('click', (e) => {
  if (S.phase !== 'TITLE') return;

  const act = e.target.closest('button[data-act]');
  if (act) {
    if (act.dataset.act === 'save') applyCustomWords();
    else {
      saveCustom([]);
      titleScreen({ keepText: '', status: '自作のお題を消しました' });
    }
    return;
  }

  const src = e.target.closest('button[data-src]');
  if (src) {
    setSource(src.dataset.src);
    const label = SOURCES.find((s) => s.id === getSource()).label;
    titleScreen({ keepText: $('#my-input')?.value ?? '', status: `出題を「${label}」にしました` });
    return;
  }

  const li = e.target.closest('.diff li');
  if (!li) return;
  sfx.unlock();
  startMatch(MODES[[...li.parentElement.children].indexOf(li)]);
});

// --- 入力 ---

window.addEventListener('compositionstart', () => { imeWarn.hidden = false; });

window.addEventListener('keydown', (e) => {
  // 自作お題の入力中はゲームの操作として取らない
  if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
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

  if (S.phase === 'CALIB_END') {
    e.preventDefault();
    if (k === 'Enter' || k === ' ') startMatch(S.calibMode);
    else if (k === 'Escape') titleScreen();
    return;
  }

  if (S.phase === 'PAUSED') {
    e.preventDefault();
    if (k === 'Escape') titleScreen();
    else resumeGame();
    return;
  }

  if (S.phase === 'SETTLE') { e.preventDefault(); return; }
  if (S.phase === 'REPLAY') { e.preventDefault(); endReplay(); return; }

  if (S.phase === 'ROUND_END') {
    if (k === 'r' || k === 'R') { e.preventDefault(); startMatch(S.mode); }
    if (k === 'v' || k === 'V') { e.preventDefault(); startReplay(); }
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
  const now = performance.now();
  if (S.rec) {
    if (!S.rec.startAt) S.rec.startAt = now;
    S.rec.keys.push({ t: Math.round(now - S.rec.startAt), ch: k.toLowerCase() });
  }

  if (r === 'miss') { onMiss(expected); renderPrompt(); return; }

  st.recordHit(stats, expected, now - S.lastKeyAt);
  S.lastKeyAt = now;
  S.totalKeys += 1;
  sfx.key(S.combo);
  fx.shake(2.5, 60);
  renderPrompt(true);

  // 残り1〜2文字で踏み込む。打撃感の本体は当たる前の予兆にある
  if (pendingText(S.typing).length <= 2) p1.classList.add('wind');

  if (r !== 'done') {
    if (S.phase === 'TRAIN') renderTrainStats();
    return;
  }
  if (S.phase === 'TRAIN') trainHit();
  else if (S.phase === 'CALIB') {
    closeRec('hit');
    strike('light', 0.4, '#3fe0ff');
    nextWord();
  } else playerAttack();
});

soundBtn.addEventListener('click', () => {
  sfx.unlock();
  sfx.setEnabled(!sfx.isEnabled());
  soundBtn.textContent = sfx.isEnabled() ? '🔊 SOUND ON' : '🔇 SOUND OFF';
  soundBtn.blur();
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
  } else if (S.phase === 'CALIB') {
    S.wordElapsed += dt * 1000;
    const leftMs = Math.max(0, S.calibEnd - now);
    timerFill.style.width = `${(leftMs / CALIB_MS) * 100}%`;
    timerFill.classList.toggle('urgent', leftMs < 3000);
    timerLabel.textContent = `診断 · 残り${Math.ceil(leftMs / 1000)}秒`;
    if (leftMs <= 0) finishCalibration();
  } else if (S.phase === 'TRAIN') {
    S.wordElapsed += dt * 1000;
  }

  fx.step(dt, now);
  requestAnimationFrame(frame);
}

fx.initFx($('#fx'), stage);
sfx.unlock();   // AudioContext を suspended のまま作る
voice.preload();
if (fx.reducedMotion) document.body.classList.add('reduced');
titleScreen();
requestAnimationFrame(frame);
