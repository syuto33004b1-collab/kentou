// お題。kanji は表示用、kana は判定用（ひらがな）、tag はカテゴリ。
export const TAGS = [
  { id: 'waza', label: '技名' },
  { id: 'term', label: '格ゲー用語' },
  { id: 'line', label: '実況セリフ' },
];

export const WORDS = [
  // --- 技名系 ---
  { kanji: '波動拳', kana: 'はどうけん', tag: 'waza' },
  { kanji: '昇龍拳', kana: 'しょうりゅうけん', tag: 'waza' },
  { kanji: '竜巻旋風脚', kana: 'たつまきせんぷうきゃく', tag: 'waza' },
  { kanji: '瞬獄殺', kana: 'しゅんごくさつ', tag: 'waza' },
  { kanji: '真空波動拳', kana: 'しんくうはどうけん', tag: 'waza' },
  { kanji: '滅殺豪波動', kana: 'めっさつごうはどう', tag: 'waza' },
  { kanji: '疾風迅雷', kana: 'しっぷうじんらい', tag: 'waza' },
  { kanji: '電光石火', kana: 'でんこうせっか', tag: 'waza' },
  { kanji: '一撃必殺', kana: 'いちげきひっさつ', tag: 'waza' },
  { kanji: '天翔十字鳳', kana: 'てんしょうじゅうじほう', tag: 'waza' },
  { kanji: '百裂脚', kana: 'ひゃくれつきゃく', tag: 'waza' },
  { kanji: '覇王翔吼拳', kana: 'はおうしょうこうけん', tag: 'waza' },
  { kanji: '鳳凰脚', kana: 'ほうおうきゃく', tag: 'waza' },
  { kanji: '神龍拳', kana: 'しんりゅうけん', tag: 'waza' },
  { kanji: '灼熱波動拳', kana: 'しゃくねつはどうけん', tag: 'waza' },
  { kanji: '灼熱豪波動', kana: 'しゃくねつごうはどう', tag: 'waza' },
  { kanji: '滅殺豪龍拳', kana: 'めっさつごうりゅうけん', tag: 'waza' },
  { kanji: '真空竜巻旋風脚', kana: 'しんくうたつまきせんぷうきゃく', tag: 'waza' },
  { kanji: '天魔封殺斬', kana: 'てんまふうさつざん', tag: 'waza' },
  { kanji: '阿修羅閃空', kana: 'あしゅらせんくう', tag: 'waza' },
  { kanji: '空破弾', kana: 'くうはだん', tag: 'waza' },
  { kanji: '気功拳', kana: 'きこうけん', tag: 'waza' },
  { kanji: '双掌破', kana: 'そうしょうは', tag: 'waza' },
  { kanji: '螺旋岩砕', kana: 'らせんがんさい', tag: 'waza' },
  { kanji: '雷撃', kana: 'らいげき', tag: 'waza' },
  { kanji: '剛拳', kana: 'ごうけん', tag: 'waza' },
  { kanji: '無双正拳突き', kana: 'むそうせいけんづき', tag: 'waza' },
  { kanji: '大蛇薙', kana: 'おろちなぎ', tag: 'waza' },
  { kanji: '超必殺技', kana: 'ちょうひっさつわざ', tag: 'waza' },
  { kanji: '起死回生', kana: 'きしかいせい', tag: 'waza' },
  { kanji: '乾坤一擲', kana: 'けんこんいってき', tag: 'waza' },
  { kanji: '電撃波', kana: 'でんげきは', tag: 'waza' },
  { kanji: '奈落殺', kana: 'ならくざん', tag: 'waza' },
  { kanji: '烈風拳', kana: 'れっぷうけん', tag: 'waza' },

  // --- 格ゲー用語系 ---
  { kanji: '確定反撃', kana: 'かくていはんげき', tag: 'term' },
  { kanji: '目押し', kana: 'めおし', tag: 'term' },
  { kanji: '暴れ潰し', kana: 'あばれつぶし', tag: 'term' },
  { kanji: '起き攻め', kana: 'おきぜめ', tag: 'term' },
  { kanji: '差し返し', kana: 'さしかえし', tag: 'term' },
  { kanji: '投げ抜け', kana: 'なげぬけ', tag: 'term' },
  { kanji: '立ち回り', kana: 'たちまわり', tag: 'term' },
  { kanji: '対空', kana: 'たいくう', tag: 'term' },
  { kanji: '中段択', kana: 'ちゅうだんたく', tag: 'term' },
  { kanji: '削り殺し', kana: 'けずりごろし', tag: 'term' },
  { kanji: '相殺', kana: 'そうさい', tag: 'term' },
  { kanji: '画面端', kana: 'がめんぎわ', tag: 'term' },
  { kanji: '無敵技', kana: 'むてきわざ', tag: 'term' },
  { kanji: '弾抜け', kana: 'たまぬけ', tag: 'term' },
  { kanji: '屈伸', kana: 'くっしん', tag: 'term' },
  { kanji: '判定勝ち', kana: 'はんていがち', tag: 'term' },
  { kanji: '先読み', kana: 'さきよみ', tag: 'term' },
  { kanji: '咄嗟の対応', kana: 'とっさのたいおう', tag: 'term' },
  { kanji: '連続技', kana: 'れんぞくわざ', tag: 'term' },
  { kanji: '開幕', kana: 'かいまく', tag: 'term' },
  { kanji: '択を通す', kana: 'たくをとおす', tag: 'term' },
  { kanji: '反応速度', kana: 'はんのうそくど', tag: 'term' },
  { kanji: '割り込み', kana: 'わりこみ', tag: 'term' },
  { kanji: '詐欺跳び', kana: 'さぎとび', tag: 'term' },
  { kanji: '固め', kana: 'かため', tag: 'term' },
  { kanji: '密着', kana: 'みっちゃく', tag: 'term' },
  { kanji: '距離感', kana: 'きょりかん', tag: 'term' },
  { kanji: '読み合い', kana: 'よみあい', tag: 'term' },
  { kanji: '逆択', kana: 'ぎゃくたく', tag: 'term' },
  { kanji: '最大反撃', kana: 'さいだいはんげき', tag: 'term' },
  { kanji: '硬直', kana: 'こうちょく', tag: 'term' },
  { kanji: '発生', kana: 'はっせい', tag: 'term' },
  { kanji: '持続', kana: 'じぞく', tag: 'term' },
  { kanji: '暴発', kana: 'ぼうはつ', tag: 'term' },
  { kanji: '空振り', kana: 'からぶり', tag: 'term' },
  { kanji: '差し込み', kana: 'さしこみ', tag: 'term' },
  { kanji: '仕込み', kana: 'しこみ', tag: 'term' },
  { kanji: '牽制', kana: 'けんせい', tag: 'term' },
  { kanji: '起き攻めの択', kana: 'おきぜめのたく', tag: 'term' },
  { kanji: '相手の癖を読む', kana: 'あいてのくせをよむ', tag: 'term' },
  { kanji: '画面端の攻防', kana: 'がめんぎわのこうぼう', tag: 'term' },
  { kanji: '立ち回りの組み立て', kana: 'たちまわりのくみたて', tag: 'term' },
  { kanji: '確定反撃を狙う', kana: 'かくていはんげきをねらう', tag: 'term' },
  { kanji: '中段と下段の二択', kana: 'ちゅうだんとげだんのにたく', tag: 'term' },

  // --- 実況セリフ系 ---
  { kanji: 'そこだ', kana: 'そこだ', tag: 'line' },
  { kanji: '遅い', kana: 'おそい', tag: 'line' },
  { kanji: '甘い', kana: 'あまい', tag: 'line' },
  { kanji: '隙あり', kana: 'すきあり', tag: 'line' },
  { kanji: '終わりだ', kana: 'おわりだ', tag: 'line' },
  { kanji: '圧倒的', kana: 'あっとうてき', tag: 'line' },
  { kanji: '覚悟しろ', kana: 'かくごしろ', tag: 'line' },
  { kanji: '押し切る', kana: 'おしきる', tag: 'line' },
  { kanji: '決めるぞ', kana: 'きめるぞ', tag: 'line' },
  { kanji: '反撃開始', kana: 'はんげきかいし', tag: 'line' },
  { kanji: '逃げ場はない', kana: 'にげばはない', tag: 'line' },
  { kanji: '二度は効かん', kana: 'にどはきかん', tag: 'line' },
  { kanji: '見えているぞ', kana: 'みえているぞ', tag: 'line' },
  { kanji: '全弾命中', kana: 'ぜんだんめいちゅう', tag: 'line' },
  { kanji: '気迫が違う', kana: 'きはくがちがう', tag: 'line' },
  { kanji: '効いてないぞ', kana: 'きいてないぞ', tag: 'line' },
  { kanji: '一撃でいい', kana: 'いちげきでいい', tag: 'line' },
  { kanji: '燃え尽きろ', kana: 'もえつきろ', tag: 'line' },
  { kanji: '一歩も引かん', kana: 'いっぽもひかん', tag: 'line' },
  { kanji: '立ち上がれ', kana: 'たちあがれ', tag: 'line' },
  { kanji: 'まだ終わらんよ', kana: 'まだおわらんよ', tag: 'line' },
  { kanji: '完全に読み切った', kana: 'かんぜんによみきった', tag: 'line' },
  { kanji: 'お前はもう終わりだ', kana: 'おまえはもうおわりだ', tag: 'line' },
  { kanji: '勝負はここからだ', kana: 'しょうぶはここからだ', tag: 'line' },
  { kanji: '全て見切った', kana: 'すべてみきった', tag: 'line' },
  { kanji: '手加減はしない', kana: 'てかげんはしない', tag: 'line' },
  { kanji: '力の差を見せてやる', kana: 'ちからのさをみせてやる', tag: 'line' },
  { kanji: 'ここで決める', kana: 'ここできめる', tag: 'line' },
  { kanji: '避けられんぞ', kana: 'さけられんぞ', tag: 'line' },
  { kanji: '真の実力を見せろ', kana: 'しんのじつりょくをみせろ', tag: 'line' },
];

export const TIER_LABELS = ['短文', '中文', '長文'];

/** かな長で3段階。境界は重ねない */
export function tierOf(word) {
  if (word.kana.length <= 6) return 0;
  if (word.kana.length <= 9) return 1;
  return 2;
}

/** tier / tag は数値・ID、または 'all' */
export function wordsIn(tier = 'all', tag = 'all') {
  return WORDS.filter((w) => (tier === 'all' || tierOf(w) === tier)
    && (tag === 'all' || w.tag === tag));
}

/**
 * お題を1つ引く。
 * tierPool は許容する長さティアの配列で、重複させると出現率が上がる。
 * コンボ数には依存させない（ミスして短文帯に戻る抜け道を作らないため）。
 */
export function pickWord(tierPool, tag, avoid) {
  for (let n = 0; n < 12; n += 1) {
    const tier = tierPool[Math.floor(Math.random() * tierPool.length)];
    const pool = wordsIn(tier, tag);
    if (!pool.length) continue;
    const w = pool[Math.floor(Math.random() * pool.length)];
    if (w.kana !== avoid) return w;
  }
  const fallback = wordsIn('all', tag);
  return fallback.find((w) => w.kana !== avoid) ?? WORDS[0];
}
