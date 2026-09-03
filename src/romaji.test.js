// node src/romaji.test.js
import assert from 'node:assert/strict';
import { tokenize, createTyping, press, typedText, pendingText } from './romaji.js';
import { WORDS } from './words.js';

/** 文字列を順に打ち、1打ごとの結果を返す */
function typeAll(kana, input) {
  const st = createTyping(kana);
  const results = [...input].map((ch) => press(st, ch));
  return { st, results };
}

const cleanRun = (kana, input) => {
  const { results } = typeAll(kana, input);
  return results.at(-1) === 'done' && !results.includes('miss');
};

// --- 拗音は2かな1トークンで、複数綴りを許す ---
{
  const t = tokenize('しゅんごくさつ');
  assert.deepEqual(t[0], ['shu', 'syu'], '拗音「しゅ」は shu/syu の両方');
  assert.equal(t.length, 6, 'しゅ/ん/ご/く/さ/つ の6トークン');
}

// --- 促音は次のかなに融合し、子音重ねと xtu 明示形の両方を許す ---
{
  const t = tokenize('せっか');
  assert.equal(t.length, 2, 'っ は独立トークンにならない');
  assert.ok(t[1].includes('kka'), '子音重ね形');
  assert.ok(t[1].includes('cca'), '別綴りの子音重ね形');
  assert.ok(t[1].includes('xtuka'), 'xtu 明示形');
  assert.ok(cleanRun('せっか', 'sekka'), '子音重ねで打ち切れる');
  assert.ok(cleanRun('せっか', 'sextuka'), 'xtu 明示形でも打ち切れる');
  assert.ok(cleanRun('いっぽもひかん', 'ippomohikann'), '促音+半濁音');
}

// --- ん は後続文脈で単独 n の可否が変わる ---
{
  assert.ok(tokenize('でんこう')[1].includes('n'), '後続が子音なら単独 n で確定できる');
  assert.ok(!tokenize('かんい')[1].includes('n'), '後続が母音なら単独 n では確定できない');
  assert.ok(!tokenize('かんにゅう')[1].includes('n'), '後続が な行 なら単独 n では確定できない');
  assert.ok(!tokenize('ほん')[1].includes('n'), '語末では単独 n では確定できない');

  assert.ok(cleanRun('でんこう', 'denkou'), '単独 n');
  assert.ok(cleanRun('でんこう', 'dennkou'), '単独 n 確定直後の追加 n を飲み込む（IME互換）');
  assert.ok(cleanRun('でんこう', 'dexnkou'), 'xn でも打てる');
  assert.notEqual(typeAll('ほん', 'hon').results.at(-1), 'done', '語末の ん は n 1回では終わらない');
  assert.ok(cleanRun('ほん', 'honn'), '語末は nn で打ち切れる');
}

// --- si / shi の分岐後も状態が正しく続く ---
{
  assert.ok(cleanRun('しかく', 'sikaku'), '訓令式');
  assert.ok(cleanRun('しかく', 'shikaku'), 'ヘボン式');
  const half = typeAll('しかく', 'sh').st;
  assert.equal(half.i, 0, 'sh は途中なのでトークンは進まない');
  assert.equal(typedText(half), 'sh');
  assert.equal(pendingText(half), 'ikaku', '選んだ綴りに応じて残りが変わる');
  assert.equal(pendingText(typeAll('しかく', 's').st), 'hikaku', '第1候補は shi なので s の次は hi');
}

// --- ミスタイプは状態を進めない ---
{
  const st = createTyping('はどうけん');
  assert.equal(press(st, 'x'), 'miss');
  assert.equal(st.i, 0);
  assert.equal(st.buf, '');
  assert.equal(press(st, 'h'), 'hit', 'ミス後も続けて打てる');
}

// --- typedText + pendingText は常に打ち切り可能な1本の綴りを表す ---
{
  const st = createTyping('しゅんごくさつ');
  assert.equal(typedText(st) + pendingText(st), 'shungokusatsu');
  press(st, 's');
  press(st, 'y');
  assert.equal(typedText(st) + pendingText(st), 'syungokusatsu', '別綴りを打つと表示が追従する');
}

// --- 全お題が破綴なくトークン化でき、表示どおり打ち切れる ---
{
  const seen = new Set();
  for (const w of WORDS) {
    assert.ok(!seen.has(w.kana), `お題のかなが重複: ${w.kana}`);
    seen.add(w.kana);
    const guide = pendingText(createTyping(w.kana));
    const { st, results } = typeAll(w.kana, guide);
    assert.ok(!results.includes('miss'), `${w.kanji}(${w.kana}) をガイド ${guide} で打つとミスが出る`);
    assert.equal(results.at(-1), 'done', `${w.kanji}(${w.kana}) が打ち切れない`);
    assert.equal(st.keystrokes, guide.length, `${w.kanji} の打鍵数が表示と一致しない`);
  }
}

console.log(`OK: romaji engine / ${WORDS.length} words`);
