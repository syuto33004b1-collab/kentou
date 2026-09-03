// node src/words.test.js
import assert from 'node:assert/strict';
import {
  WORDS, TAGS, MAX_KANA, MAX_CUSTOM,
  tierOf, wordsIn, pickWord, parseWordList,
  saveCustom, getCustom, getSource, setSource, activeWords,
} from './words.js';

// --- 既定のお題データの整合 ---
{
  const ids = TAGS.map((t) => t.id);
  const seen = new Set();
  for (const w of WORDS) {
    assert.ok(ids.includes(w.tag), `${w.kanji} のタグが不正: ${w.tag}`);
    assert.ok(!seen.has(w.kana), `かなが重複: ${w.kana}`);
    seen.add(w.kana);
  }
  // 自作カテゴリは既定データには現れない
  assert.equal(WORDS.some((w) => w.tag === 'mine'), false);
}

// --- 既定の全（カテゴリ×長さ）が引ける ---
{
  for (const tag of ['waza', 'term', 'line']) {
    for (const tier of [0, 1, 2]) {
      assert.ok(wordsIn(tier, tag).length > 0, `${tag} × ティア${tier} が空`);
      const picked = pickWord([tier], tag);
      assert.equal(tierOf(picked), tier, 'ティア指定が守られる');
      assert.equal(picked.tag, tag, 'カテゴリ指定が守られる');
    }
  }
  const first = wordsIn(0, 'waza')[0];
  assert.notEqual(pickWord([0], 'waza', first.kana).kana, first.kana, '直前と同じお題は避ける');
}

// --- 自作お題のパース ---
{
  const { words, errors } = parseWordList([
    '無敵の人,むてきのひと',
    '# これはコメント',
    '',
    'おこのみやき',
    '全角も，むてきのて',
    'だめ,ABC',
    'むてきのひと',
    ',',
  ].join('\n'));

  assert.deepEqual(words.map((w) => w.kana), ['むてきのひと', 'おこのみやき', 'むてきのて']);
  assert.equal(words[0].kanji, '無敵の人', '漢字とかなを分けて読む');
  assert.equal(words[1].kanji, 'おこのみやき', '読みだけの行は表示も同じにする');
  assert.equal(words[2].kanji, '全角も', '全角カンマも区切りとして扱う');
  assert.ok(words.every((w) => w.tag === 'mine'));

  assert.deepEqual(errors.map((e) => e.line), [6, 7, 8]);
  assert.match(errors[0].reason, /ローマ字にできません/, '打てない綴りは弾く');
  assert.match(errors[1].reason, /同じ読み/, '重複は弾く');
  assert.match(errors[2].reason, /読みが空/, '空行ではない空の読みは弾く');
}

// --- 長さと件数の上限 ---
{
  const tooLong = 'あ'.repeat(MAX_KANA + 1);
  const { words, errors } = parseWordList(`${'あ'.repeat(MAX_KANA)}\n${tooLong}`);
  assert.equal(words.length, 1, '上限ちょうどは通る');
  assert.match(errors[0].reason, new RegExp(`${MAX_KANA}文字`), '超過は弾く');

  const many = Array.from({ length: MAX_CUSTOM + 5 }, (_, i) => `あ${'い'.repeat(i % 5)}${i}`);
  // 数字は読みにできないので、かなだけで一意な行を作る
  const kanaOnly = Array.from({ length: MAX_CUSTOM + 5 }, (_, i) => 'あ'.repeat((i % 30) + 1) + 'い'.repeat(Math.floor(i / 30) + 1));
  assert.equal(many.length, MAX_CUSTOM + 5);
  const r = parseWordList(kanaOnly.join('\n'));
  assert.equal(r.words.length, MAX_CUSTOM, `${MAX_CUSTOM}件で打ち止め`);
  assert.ok(r.errors.length >= 1, '超過分はエラーとして返す');
}

// --- 出題ソースの切り替え。自作が無いのに自作モードにはできない ---
{
  saveCustom([]);
  assert.equal(setSource('custom'), 'builtin', '自作0件で自作のみは選べない');
  assert.equal(setSource('both'), 'builtin', '自作0件で併用も選べない');
  assert.equal(activeWords().length, WORDS.length);

  const mine = parseWordList('自作技,じさくわざ\nおれのわざ').words;
  saveCustom(mine);
  assert.equal(getCustom().length, 2);

  assert.equal(setSource('custom'), 'custom');
  assert.equal(activeWords().length, 2, '自作のみなら自作だけ出る');
  assert.deepEqual(wordsIn('all', 'mine').map((w) => w.kana), ['じさくわざ', 'おれのわざ']);
  assert.equal(wordsIn('all', 'waza').length, 0, '自作のみでは既定カテゴリが空になる');
  assert.equal(pickWord([0, 1, 2], 'all').tag, 'mine');

  assert.equal(setSource('both'), 'both');
  assert.equal(activeWords().length, WORDS.length + 2);
  assert.equal(wordsIn('all', 'mine').length, 2);
  assert.ok(wordsIn('all', 'waza').length > 0, '併用なら既定も出る');

  assert.equal(setSource('nonsense'), 'builtin', '知らない値は既定に落とす');

  // 自作を全部消したら出題ソースも既定に戻る
  setSource('custom');
  saveCustom([]);
  assert.equal(getSource(), 'builtin', '自作を消したら既定に戻る');
  assert.equal(activeWords().length, WORDS.length);
}

console.log(`OK: words / ${WORDS.length} builtin / tags ${TAGS.map((t) => t.id).join(',')}`);
