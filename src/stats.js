// 打鍵記録と苦手キー分析。localStorageに永続化するが、
// 保存できない環境（プライベートウィンドウ等）でも遊べるように必ず例外を飲む。

const STORE_KEY = 'kentou.stats.v1';

// 「自己ベスト」に数える最低打鍵数。1打で100%を記録させないため
const BEST_MIN_KEYS = 20;

export function emptyStats() {
  return { keys: {}, matches: 0, wins: 0, last: null, prev: null, best: null };
}

function row(stats, ch) {
  if (!stats.keys[ch]) stats.keys[ch] = { n: 0, miss: 0, sumMs: 0 };
  return stats.keys[ch];
}

/** 打てた1打。ms は直前の打鍵からの間隔 */
export function recordHit(stats, ch, ms) {
  const r = row(stats, ch);
  r.n += 1;
  // 極端な間隔（お題切り替わり直後・離席明け）は平均を壊すので捨てる
  if (ms >= 0 && ms < 3000) r.sumMs += ms;
  return stats;
}

/** ミスした1打。ch は「打つべきだった文字」 */
export function recordMiss(stats, ch) {
  row(stats, ch).miss += 1;
  return stats;
}

/**
 * 苦手キーを弱い順に返す。
 * ミスが1つでもあればミス率順、まだ誰もミスしていなければ平均遅延順。
 */
export function weakKeys(stats, limit = 5, minSamples = 4) {
  const rows = Object.entries(stats.keys).map(([ch, r]) => ({
    ch,
    n: r.n + r.miss,
    miss: r.miss,
    rate: r.n + r.miss ? r.miss / (r.n + r.miss) : 0,
    meanMs: r.n ? Math.round(r.sumMs / r.n) : 0,
  })).filter((r) => r.n >= minSamples);

  const missed = rows.filter((r) => r.miss > 0);
  if (missed.length) {
    return missed
      .sort((a, b) => b.rate - a.rate || b.meanMs - a.meanMs || a.ch.localeCompare(b.ch))
      .slice(0, limit);
  }
  return rows
    .sort((a, b) => b.meanMs - a.meanMs || a.ch.localeCompare(b.ch))
    .slice(0, limit);
}

/** 1試合の結果を通算に反映する。result は {kpm, acc, maxCombo, secs, keys, outcome} */
export function mergeMatch(stats, result) {
  stats.prev = stats.last;
  stats.last = result;
  stats.matches += 1;
  if (result.outcome === 'WIN') stats.wins += 1;
  if (result.keys >= BEST_MIN_KEYS) {
    stats.best = {
      kpm: Math.max(stats.best?.kpm ?? 0, result.kpm),
      acc: Math.max(stats.best?.acc ?? 0, result.acc),
      maxCombo: Math.max(stats.best?.maxCombo ?? 0, result.maxCombo),
    };
  }
  return stats;
}

export function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStats();
    const saved = JSON.parse(raw);
    return { ...emptyStats(), ...saved, keys: saved.keys ?? {} };
  } catch {
    return emptyStats();
  }
}

export function save(stats) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(stats));
  } catch {
    // 保存できなくてもゲームは成立する
  }
}

export function clear() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // 同上
  }
}
