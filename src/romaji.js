// かな列をローマ字入力の受理オートマトンに変換する。
// 1トークン = 1かな（拗音は2かな）で、そのトークンを打ち切れる綴りの配列を持つ。

const KANA = {
  あ: ['a'], い: ['i', 'yi'], う: ['u', 'wu', 'whu'], え: ['e'], お: ['o'],
  か: ['ka', 'ca'], き: ['ki'], く: ['ku', 'cu', 'qu'], け: ['ke'], こ: ['ko', 'co'],
  が: ['ga'], ぎ: ['gi'], ぐ: ['gu'], げ: ['ge'], ご: ['go'],
  さ: ['sa'], し: ['shi', 'si', 'ci'], す: ['su'], せ: ['se', 'ce'], そ: ['so'],
  ざ: ['za'], じ: ['ji', 'zi'], ず: ['zu'], ぜ: ['ze'], ぞ: ['zo'],
  た: ['ta'], ち: ['chi', 'ti'], つ: ['tsu', 'tu'], て: ['te'], と: ['to'],
  だ: ['da'], ぢ: ['di'], づ: ['du'], で: ['de'], ど: ['do'],
  な: ['na'], に: ['ni'], ぬ: ['nu'], ね: ['ne'], の: ['no'],
  は: ['ha'], ひ: ['hi'], ふ: ['fu', 'hu'], へ: ['he'], ほ: ['ho'],
  ば: ['ba'], び: ['bi'], ぶ: ['bu'], べ: ['be'], ぼ: ['bo'],
  ぱ: ['pa'], ぴ: ['pi'], ぷ: ['pu'], ぺ: ['pe'], ぽ: ['po'],
  ま: ['ma'], み: ['mi'], む: ['mu'], め: ['me'], も: ['mo'],
  や: ['ya'], ゆ: ['yu'], よ: ['yo'],
  ら: ['ra'], り: ['ri'], る: ['ru'], れ: ['re'], ろ: ['ro'],
  わ: ['wa'], を: ['wo'], ん: ['n'],
  ぁ: ['xa', 'la'], ぃ: ['xi', 'li'], ぅ: ['xu', 'lu'], ぇ: ['xe', 'le'], ぉ: ['xo', 'lo'],
  ゃ: ['xya', 'lya'], ゅ: ['xyu', 'lyu'], ょ: ['xyo', 'lyo'],
  ー: ['-'],
};

const DIGRAPH = {
  きゃ: ['kya'], きゅ: ['kyu'], きょ: ['kyo'], きぇ: ['kye'],
  ぎゃ: ['gya'], ぎゅ: ['gyu'], ぎょ: ['gyo'],
  しゃ: ['sha', 'sya'], しゅ: ['shu', 'syu'], しぇ: ['she', 'sye'], しょ: ['sho', 'syo'],
  じゃ: ['ja', 'jya', 'zya'], じゅ: ['ju', 'jyu', 'zyu'], じぇ: ['je', 'jye', 'zye'], じょ: ['jo', 'jyo', 'zyo'],
  ちゃ: ['cha', 'tya', 'cya'], ちゅ: ['chu', 'tyu', 'cyu'], ちぇ: ['che', 'tye', 'cye'], ちょ: ['cho', 'tyo', 'cyo'],
  にゃ: ['nya'], にゅ: ['nyu'], にょ: ['nyo'],
  ひゃ: ['hya'], ひゅ: ['hyu'], ひょ: ['hyo'],
  びゃ: ['bya'], びゅ: ['byu'], びょ: ['byo'],
  ぴゃ: ['pya'], ぴゅ: ['pyu'], ぴょ: ['pyo'],
  みゃ: ['mya'], みゅ: ['myu'], みょ: ['myo'],
  りゃ: ['rya'], りゅ: ['ryu'], りょ: ['ryo'],
  ふぁ: ['fa'], ふぃ: ['fi'], ふぇ: ['fe'], ふぉ: ['fo'], ふゅ: ['fyu'],
  てぃ: ['thi'], でぃ: ['dhi'], とぅ: ['twu'], どぅ: ['dwu'],
  つぁ: ['tsa'], つぃ: ['tsi'], つぇ: ['tse'], つぉ: ['tso'],
  うぃ: ['wi', 'whi'], うぇ: ['we', 'whe'], うぉ: ['who'],
  ヴぁ: ['va'], ヴぃ: ['vi'], ヴぇ: ['ve'], ヴぉ: ['vo'],
};

const SMALL_TSU = ['xtu', 'ltu', 'xtsu', 'ltsu'];

// 単独 n で確定できない後続の頭文字（母音・n・y は な行/にゃ行と衝突する）
const N_AMBIGUOUS = 'aiueony';

export function tokenize(kana) {
  const raw = [];
  for (let i = 0; i < kana.length;) {
    const two = kana.slice(i, i + 2);
    if (DIGRAPH[two]) { raw.push({ k: two, s: DIGRAPH[two] }); i += 2; continue; }
    const one = kana[i];
    if (one === 'っ') { raw.push({ k: 'っ', s: null }); i += 1; continue; }
    if (!KANA[one]) throw new Error(`unknown kana "${one}" in "${kana}"`);
    raw.push({ k: one, s: KANA[one] }); i += 1;
  }

  const tokens = [];
  for (let i = 0; i < raw.length; i += 1) {
    const t = raw[i];

    if (t.k === 'っ') {
      const next = raw[i + 1];
      if (!next || !next.s) { tokens.push(SMALL_TSU.slice()); continue; }
      // 促音は次のかなに融合する: 子音重ね形と、xtu 等の明示形の両方を許す
      const doubled = next.s
        .filter((s) => !'aiueon'.includes(s[0]))
        .map((s) => s[0] + s);
      const explicit = SMALL_TSU.flatMap((x) => next.s.map((s) => x + s));
      tokens.push([...doubled, ...explicit]);
      i += 1;
      continue;
    }

    if (t.k === 'ん') {
      const next = raw[i + 1];
      const bareOk = !!(next && next.s && !next.s.some((s) => N_AMBIGUOUS.includes(s[0])));
      tokens.push(bareOk ? ['n', 'nn', "n'", 'xn'] : ['nn', "n'", 'xn']);
      continue;
    }

    tokens.push(t.s.slice());
  }
  return tokens;
}

export function createTyping(kana) {
  const tokens = tokenize(kana);
  return {
    kana,
    tokens,
    i: 0,
    buf: '',
    chosen: [],
    swallowN: false,
    // CPUの制限時間計算用。第1候補を選んだ場合の打鍵数
    keystrokes: tokens.reduce((n, t) => n + t[0].length, 0),
  };
}

/** 1打を処理する。戻り値: 'hit' | 'done' | 'miss' */
export function press(st, ch) {
  const token = st.tokens[st.i];
  if (!token) return 'miss';

  const want = st.buf + ch;
  const candidates = token.filter((s) => s.startsWith(want));

  if (candidates.length === 0) {
    // 単独 n で「ん」を確定した直後の追加 n は、IMEと同じく受理して飲み込む
    if (st.swallowN && ch === 'n') {
      st.swallowN = false;
      st.chosen[st.i - 1] = 'nn';
      return 'hit';
    }
    return 'miss';
  }

  st.swallowN = false;
  st.buf = want;

  if (candidates.includes(want)) {
    st.chosen[st.i] = want;
    st.i += 1;
    st.buf = '';
    if (want === 'n' && token.includes('nn')) st.swallowN = true;
    return st.i >= st.tokens.length ? 'done' : 'hit';
  }
  return 'hit';
}

/** 確定済み（＋入力途中のバッファ）のローマ字 */
export function typedText(st) {
  return st.chosen.slice(0, st.i).join('') + st.buf;
}

/** これから打つローマ字 */
export function pendingText(st) {
  const token = st.tokens[st.i];
  let head = '';
  if (token) {
    const candidate = token.find((s) => s.startsWith(st.buf)) ?? token[0];
    head = candidate.slice(st.buf.length);
  }
  const rest = st.tokens.slice(st.i + 1).map((t) => t[0]).join('');
  return head + rest;
}
