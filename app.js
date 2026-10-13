import { handleRedirect, login, logout, getToken, redirectUri } from "./auth.js";
import { groupTracks } from "./group.js";
import { buildQuery, LABELS } from "./query.js";
import { searchComposers, popularComposers, worksOf } from "./openopus.js";

const $ = (s) => document.querySelector(s);
const PAGES = 3; // 検索APIは1回10件までなので、ページを重ねて取得する
const LIMIT = 10;

async function api(path, params) {
  const token = await getToken();
  if (!token) throw new Error("auth");
  const res = await fetch("https://api.spotify.com/v1" + path + "?" + new URLSearchParams(params), {
    headers: { Authorization: "Bearer " + token },
  });
  if (res.status === 401) throw new Error("auth");
  if (res.status === 429) throw new Error("リクエストが多すぎます。少し待ってから試してください。");
  if (!res.ok) throw new Error("Spotify API エラー " + res.status);
  return res.json();
}

async function search(q) {
  const run = (query, type) => {
    const calls = [];
    for (let i = 0; i < PAGES; i++) calls.push(api("/search", { q: query, type, limit: LIMIT, offset: i * LIMIT }));
    return Promise.all(calls);
  };
  const uniq = (items) => [...new Map(items.filter(Boolean).map((x) => [x.id, x])).values()];
  const [tp, ap] = await Promise.all([run(q.tracks, "track"), run(q.albums, "album")]);
  return {
    tracks: uniq(tp.flatMap((p) => (p.tracks ? p.tracks.items : []))),
    albums: uniq(ap.flatMap((p) => (p.albums ? p.albums.items : []))),
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const albumLink = (id) => `https://open.spotify.com/album/${id}`;
const trackLink = (id) => `https://open.spotify.com/track/${id}`;

function renderWorks(works) {
  return works
    .map(
      (w) => `
    <details class="work" ${works.length <= 3 ? "open" : ""}>
      <summary><span class="work-title">${esc(w.title)}</span><span class="badge">${w.recordings.length}録音</span></summary>
      <ul class="recs">
        ${w.recordings
          .map(
            (r) => `<li class="rec">
          ${r.image ? `<img src="${esc(r.image)}" alt="" width="48" height="48" loading="lazy">` : ""}
          <div class="rec-main">
            <a href="${albumLink(r.albumId)}" target="_blank" rel="noopener" class="rec-album">${esc(r.albumName)}</a>
            <div class="rec-sub">${esc(r.artists)}${r.year ? " · " + esc(r.year) : ""}</div>
            <div class="rec-mv">${r.movements.map((m) => `<a href="${trackLink(m.id)}" target="_blank" rel="noopener">${esc(m.name)}</a>`).join(" / ")}</div>
          </div>
        </li>`
          )
          .join("")}
      </ul>
    </details>`
    )
    .join("");
}

function renderAlbums(albums) {
  return `<ul class="grid">` + albums
    .map((a) => {
      const img = (a.images && a.images[1]) || (a.images && a.images[0]);
      return `<li class="card"><a href="${albumLink(a.id)}" target="_blank" rel="noopener">
        ${img ? `<img src="${esc(img.url)}" alt="" loading="lazy">` : '<img alt="">'}
        <div class="meta"><div class="t">${esc(a.name)}</div>
        <div class="a">${esc(a.artists.map((x) => x.name).join(", "))}</div>
        <div class="y">${esc((a.release_date || "").slice(0, 4))}</div></div></a></li>`;
    })
    .join("") + `</ul>`;
}

function show(view) {
  $("#login").hidden = view !== "login";
  $("#app").hidden = view !== "app";
}

let state = { view: "albums", tracks: [], albums: [], filtered: false };

function renderResults() {
  const out = $("#results");
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("on", b.dataset.view === state.view));
  if (state.view === "albums") {
    out.innerHTML = state.albums.length ? renderAlbums(state.albums) : '<p class="muted">該当するアルバムがありません。条件を減らして試してください。</p>';
  } else {
    const works = groupTracks(state.tracks);
    out.innerHTML =
      (state.filtered ? '<p class="note">※レーベルの絞り込みは「アルバム」表示だけに効きます。</p>' : "") +
      (works.length ? renderWorks(works) : '<p class="muted">該当なし</p>');
  }
}

const field = (id) => $("#" + id).value;

async function onSearch(e) {
  e.preventDefault();
  const f = { composer: field("composer"), work: field("work"), performer: field("performer"), label: field("label"), yearFrom: field("yf"), yearTo: field("yt") };
  const q = buildQuery(f);
  if (!q.tracks && !f.label) return;
  const out = $("#results");
  out.innerHTML = '<p class="muted">検索中…</p>';
  try {
    const { tracks, albums } = await search(q);
    state = { view: state.view, tracks, albums, filtered: !!f.label };
    $("#tabs").hidden = false;
    renderResults();
  } catch (err) {
    if (err.message === "auth") {
      logout();
      show("login");
    } else {
      out.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    }
  }
}

// ---- Open Opus 連携（失敗しても検索は使える）
let composerIds = new Map();
let timer;
function fillList(listId, values) {
  $("#" + listId).innerHTML = values.map((v) => `<option value="${esc(v)}">`).join("");
}
async function onComposerInput() {
  const term = field("composer").trim();
  clearTimeout(timer);
  if (composerIds.has(term)) return loadWorks(composerIds.get(term));
  if (term.length < 2) return;
  timer = setTimeout(async () => {
    try {
      const cs = await searchComposers(term);
      composerIds = new Map(cs.map((c) => [c.name, c.id]));
      fillList("composer-list", cs.map((c) => c.name));
    } catch {}
  }, 250);
}
async function loadWorks(id) {
  try {
    const ws = await worksOf(id, "Recommended");
    fillList("work-list", ws.map((w) => w.title));
  } catch {}
}

async function init() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  $("#redirect").textContent = redirectUri();
  $("#login-btn").addEventListener("click", login);
  $("#logout-btn").addEventListener("click", () => {
    logout();
    show("login");
  });
  $("#form").addEventListener("submit", onSearch);
  $("#label").innerHTML += LABELS.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join("");
  $("#composer").addEventListener("input", onComposerInput);
  $("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (b) { state.view = b.dataset.view; renderResults(); }
  });
  popularComposers().then((cs) => { composerIds = new Map(cs.map((c) => [c.name, c.id])); fillList("composer-list", cs.map((c) => c.name)); }).catch(() => {});
  try {
    await handleRedirect();
  } catch (e) {
    $("#login-error").textContent = "ログインに失敗しました: " + e.message;
  }
  show((await getToken()) ? "app" : "login");
}
init();
