// オーバーレイのHTMLを組む純関数。DOMも状態も触らない。
// 自作お題はユーザー入力なので、必ず esc() を通してから埋める。

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function delta(now, before) {
  if (before == null) return '';
  const d = Math.round((now - before) * 10) / 10;
  if (d === 0) return '<i class="flat">±0</i>';
  return `<i class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</i>`;
}

const ROMAJI_RULES = `
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
  </details>`;

/** タイトル。recommendedKey は校正結果から決まる推奨モード */
export function titleHtml({
  modes, recommendedKey, custom, source, sources, calibratedKpm,
}) {
  const rows = modes.map((m) => `
    <li${m.key === recommendedKey ? ' class="pick"' : ''}>
      <kbd>${m.key}</kbd>
      <span><b>${m.name}</b> ${m.en}<em>${m.hint}</em></span>
      <i>${m.kpm ? `${m.kpm}<small>KPM</small>` : m.mark ?? '∞'}</i>
    </li>`).join('');

  const srcButtons = sources.map((s) => `<button type="button" data-src="${s.id}"${source === s.id ? ' class="on"' : ''}${s.id !== 'builtin' && !custom.length ? ' disabled' : ''}>${s.label}</button>`).join('');

  return `
    <h1 class="logo"><span class="logo-jp">鍵闘</span><span class="logo-en">KENTOU</span></h1>
    <p class="tagline">打ち切れ。それが一撃になる。</p>
    <ul class="rules">
      <li><b>打ち切る</b>＝攻撃</li>
      <li><b>時間切れ</b>＝被弾</li>
      <li><b>ミス</b>＝よろけ（コンボ半減）</li>
    </ul>
    <ul class="diff">${rows}</ul>
    ${calibratedKpm
    ? `<p class="calib-note">前回の診断は <b>${calibratedKpm} KPM</b>。おすすめを光らせています</p>`
    : '<p class="calib-note">はじめてなら <kbd>0</kbd> の診断から。10秒で実測しておすすめを出します</p>'}
    <p class="keys">数字キーかクリックで開始　—　<b>日本語入力はOFF（半角英数）に</b></p>
    ${ROMAJI_RULES}
    <details class="mywords">
      <summary>自作のお題（${custom.length}件）</summary>
      <p class="myhelp">1行に1つ。<code>漢字,かな</code> か <code>かな</code> だけ。<code>#</code> の行は無視します。</p>
      <textarea id="my-input" rows="5" spellcheck="false"
        placeholder="無敵の人,むてきのひと&#10;おこのみやき">${esc(custom.map((w) => (w.kanji === w.kana ? w.kana : `${w.kanji},${w.kana}`)).join('\n'))}</textarea>
      <div class="myrow">
        <button type="button" data-act="save">検証して保存</button>
        <button type="button" data-act="clear">全部消す</button>
      </div>
      <div class="myrow">使うお題：${srcButtons}</div>
      <p id="my-status" class="mystatus"></p>
    </details>
    <p class="nokb">この先は物理キーボードが必要です</p>
    <p class="credit">アナウンサーボイスは <a href="https://elevenlabs.io" target="_blank" rel="noopener">ElevenLabs</a> で生成しています</p>`;
}

export function pauseHtml() {
  return `
    <div class="ko-title pause">PAUSE</div>
    <p class="tagline">画面から離れたので止めました</p>
    <p class="keys">何かキーを押すと再開　—　<kbd>Esc</kbd> モード選択</p>`;
}

/** お題ごとの所要時間。詰まった場所が一目で分かるのが replay の本体価値 */
function timelineHtml(log) {
  if (!log.length) return '';
  const rows = log.slice(-10).map((r) => {
    const pct = Math.min(100, Math.round((r.ms / Math.max(r.limitMs || r.ms, 1)) * 100));
    const misses = r.misses ? `<em>×${r.misses}</em>` : '';
    return `<li class="${r.outcome === 'timeout' ? 'lost' : 'won'}">
      <span class="tl-name">${esc(r.kanji)}</span>
      <span class="tl-bar"><i style="width:${pct}%"></i></span>
      <span class="tl-t">${(r.ms / 1000).toFixed(1)}<small>s</small>${misses}</span>
    </li>`;
  }).join('');
  return `
    <details class="timeline">
      <summary>お題ごとの所要時間（直近${Math.min(10, log.length)}件）</summary>
      <ol>${rows}</ol>
      <p class="tlhelp">バーは制限時間に対する割合。赤は落としたお題。<kbd>V</kbd> で打鍵を再生します。</p>
    </details>`;
}

function weakHtml(weak) {
  if (!weak.length) return '<p class="weak-none">苦手キーの判定には、もう少し打鍵が必要です</p>';
  const byMiss = weak[0].miss > 0;
  const items = weak
    .map((r) => `<li><b>${esc(r.ch)}</b><em>${byMiss ? `${Math.round(r.rate * 100)}%` : `${r.meanMs}ms`}</em></li>`)
    .join('');
  return `<div class="weak"><h3>${byMiss ? 'ミスが多いキー' : '打つのが遅いキー'}</h3><ul>${items}</ul></div>`;
}

export function resultHtml({
  outcome, mode, result, prev, best, matches, wins, weak, log,
}) {
  const bestLine = best
    ? `<p class="best-line">自己ベスト　KPM <b>${best.kpm}</b>　正確率 <b>${best.acc}%</b>　コンボ <b>${best.maxCombo}</b>　—　${matches}戦 ${wins}勝</p>`
    : `<p class="best-line">${matches}戦 ${wins}勝</p>`;

  return `
    <div class="ko-title ${outcome === 'WIN' ? 'win' : 'lose'}">${outcome === 'WIN' ? 'K.O.' : 'YOU LOSE'}</div>
    <div class="ko-sub">${outcome === 'WIN' ? '相手を沈めた' : '沈められた'}　—　${mode.name} / ${mode.en}</div>
    <dl class="stats">
      <div><dt>KPM</dt><dd>${result.kpm}${delta(result.kpm, prev?.kpm)}</dd></div>
      <div><dt>正確率</dt><dd>${result.acc == null ? '—' : `${result.acc}<small>%</small>${delta(result.acc, prev?.acc)}`}</dd></div>
      <div><dt>最大コンボ</dt><dd>${result.maxCombo}</dd></div>
      <div><dt>時間</dt><dd>${result.secs}<small>s</small></dd></div>
    </dl>
    ${weakHtml(weak)}
    ${timelineHtml(log)}
    ${bestLine}
    <p class="keys"><kbd>R</kbd> もう一戦　<kbd>V</kbd> リプレイ　<kbd>Esc</kbd> モード選択</p>`;
}

/** 校正の結果と推奨モード */
export function calibHtml({
  kpm, acc, keys, mode,
}) {
  return `
    <div class="ko-title calib">${kpm}<small>KPM</small></div>
    <div class="ko-sub">10秒の実測　—　正確率 ${acc == null ? '—' : `${acc}%`} ／ ${keys}打</div>
    <div class="recommend">
      <p>おすすめは</p>
      <strong>${mode.name} <span>${mode.en}</span></strong>
      <em>${mode.hint}</em>
    </div>
    <p class="keys"><kbd>Enter</kbd> このモードで始める　—　<kbd>Esc</kbd> 自分で選ぶ</p>`;
}
