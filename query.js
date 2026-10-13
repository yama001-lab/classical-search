// 入力欄の内容を Spotify 検索クエリに変換する。
export const LABELS = [
  ["Deutsche Grammophon", "ドイツ・グラモフォン (DG)"],
  ["Decca", "デッカ"],
  ["Philips", "フィリップス"],
  ["EMI Classics", "EMI"],
  ["Warner Classics", "ワーナー"],
  ["Sony Classical", "ソニー"],
  ["RCA Red Seal", "RCA"],
  ["Mercury Living Presence", "マーキュリー"],
  ["Harmonia Mundi", "ハルモニア・ムンディ"],
  ["Hyperion", "ハイペリオン"],
  ["Chandos", "シャンドス"],
  ["Naxos", "ナクソス"],
  ["ECM", "ECM"],
];

// 著作権表記（℗ 1963 Decca Music Group...）に含まれる語で、レーベルを判定する
export const LABEL_WORDS = {
  "Deutsche Grammophon": ["deutsche grammophon", "universal international music"],
  Decca: ["decca"],
  Philips: ["philips"],
  "EMI Classics": ["emi"],
  "Warner Classics": ["warner"],
  "Sony Classical": ["sony", "cbs"],
  "RCA Red Seal": ["rca"],
  "Mercury Living Presence": ["mercury"],
  "Harmonia Mundi": ["harmonia mundi"],
  Hyperion: ["hyperion"],
  Chandos: ["chandos"],
  Naxos: ["naxos"],
  ECM: ["ecm"],
};

export function matchesLabel(label, copyrights) {
  const words = LABEL_WORDS[label] || [label.toLowerCase()];
  const text = (copyrights || []).map((c) => c.text).join(" ").toLowerCase();
  return words.some((w) => text.includes(w));
}

const clean = (s) => (s || "").replace(/["]/g, " ").replace(/\s+/g, " ").trim();

// f: { composer, work, performer, label, yearFrom, yearTo }
export function buildQuery(f) {
  const terms = [f.composer, f.work, f.performer].map(clean).filter(Boolean).join(" ");
  const parts = terms ? [terms] : [];
  const from = parseInt(f.yearFrom, 10);
  const to = parseInt(f.yearTo, 10);
  if (from || to) {
    const a = from || 1000, b = to || new Date().getFullYear();
    parts.push(a === b ? `year:${a}` : `year:${Math.min(a, b)}-${Math.max(a, b)}`);
  }
  const base = parts.join(" ");
  const label = clean(f.label);
  return { tracks: base, albums: label ? `${base} label:"${label}"`.trim() : base, albumsPlain: base };
}
