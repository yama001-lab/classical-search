// Open Opus (https://openopus.org) の公開API。失敗しても検索自体は使えるようにする。
const BASE = "https://api.openopus.org";

async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error("openopus " + res.status);
  const j = await res.json();
  if (j.status && j.status.success === "false") throw new Error("openopus " + (j.status.error || "error"));
  return j;
}

export async function searchComposers(term) {
  const j = await get(`/composer/list/search/${encodeURIComponent(term)}.json`);
  return (j.composers || []).map((c) => ({ id: c.id, name: c.name, complete: c.complete_name, epoch: c.epoch }));
}

export async function popularComposers() {
  const j = await get("/composer/list/pop.json");
  return (j.composers || []).map((c) => ({ id: c.id, name: c.name, complete: c.complete_name, epoch: c.epoch }));
}

// genre: all / Popular / Recommended / Orchestral / Chamber / Keyboard / Vocal / Stage / Opera
export async function worksOf(composerId, genre = "Recommended") {
  const j = await get(`/work/list/composer/${composerId}/genre/${genre}.json`);
  return (j.works || []).map((w) => ({ title: w.title, subtitle: w.subtitle, genre: w.genre }));
}
