// トラック名から「作品」と「楽章」を取り出し、作品ごとにまとめる。

const CATALOG = /\b(?:op|bwv|kv|k|d|hob|rv|wwv|sz|bb|s|wq|hwv|b)\.?\s*(\d+[a-z]?)(?:\s*[-\/]\s*\d+)?/i;
const CATALOG_NAME = /\b(op|bwv|kv|k|d|hob|rv|wwv|sz|bb|s|wq|hwv|b)\.?\s*\d/i;

export function normalize(s) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[“”"'’]/g, "")
    .replace(/\.(?=[^\s.])/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

// "Symphony No. 5 in C Minor, Op. 67: I. Allegro" -> { work, movement }
export function splitTitle(title) {
  // 末尾の「 - Live」「(Remastered)」などの付記は楽章側に残す
  const colon = title.indexOf(":");
  if (colon > 0) {
    return { work: title.slice(0, colon).trim(), movement: title.slice(colon + 1).trim() };
  }
  const m = title.match(/^(.*?)\s+[-–—]\s+((?:[IVXLC]+\.|\d+\.).*)$/);
  if (m) return { work: m[1].trim(), movement: m[2].trim() };
  return { work: title.trim(), movement: "" };
}

export function workKey(work) {
  const cat = work.match(CATALOG);
  const n = normalize(work);
  if (cat && CATALOG_NAME.test(work)) {
    // 作品番号だけだと別の作曲家と衝突するので、番号の前の名前部分も使う
    const base = n.split(/,|\(/)[0].replace(/\s+in\s+.*$/, "").trim();
    return `${base}|${normalize(cat[0]).replace(/\s|\./g, "")}`;
  }
  return n;
}

function primaryArtists(artists) {
  return artists.map((a) => a.name).join(", ");
}

// tracks: Spotify の track オブジェクト配列
// 戻り値: 作品の配列。各作品は recordings（アルバム単位）を持つ
export function groupTracks(tracks) {
  const works = new Map();
  for (const t of tracks) {
    if (!t || !t.album) continue;
    const { work, movement } = splitTitle(t.name);
    const key = workKey(work);
    let w = works.get(key);
    if (!w) {
      w = { key, title: work, recordings: new Map() };
      works.set(key, w);
    }
    let r = w.recordings.get(t.album.id);
    if (!r) {
      r = {
        albumId: t.album.id,
        albumName: t.album.name,
        artists: primaryArtists(t.artists || []),
        image: (t.album.images && t.album.images[t.album.images.length - 1] || {}).url,
        year: (t.album.release_date || "").slice(0, 4),
        movements: [],
      };
      w.recordings.set(t.album.id, r);
    }
    r.movements.push({ id: t.id, name: movement || t.name, track_number: t.track_number, uri: t.uri });
  }
  const out = [...works.values()].map((w) => {
    const recordings = [...w.recordings.values()].map((r) => {
      r.movements.sort((a, b) => a.track_number - b.track_number);
      return r;
    });
    recordings.sort((a, b) => b.movements.length - a.movements.length);
    return { key: w.key, title: w.title, recordings };
  });
  out.sort((a, b) => b.recordings.length - a.recordings.length);
  return out;
}
