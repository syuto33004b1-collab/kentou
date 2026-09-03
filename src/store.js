// localStorage の薄いラッパ。プライベートウィンドウやサイトデータ拒否では
// アクセス自体が例外を投げるので、読み書きは必ず飲む。
// 保存できなくてもゲームは成立させる。

const PREFIX = 'kentou.';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // 消せなくても困らない
  }
}
