import { handleRedirect, login, logout, getToken, redirectUri } from "./auth.js";
import { groupTracks } from "./group.js";

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
  const calls = [];
  for (let i = 0; i < PAGES; i++) {
    calls.push(api("/search", { q, type: "track,album", limit: LIMIT, offset: i * LIMIT }));
  }
  const pages = await Promise.all(calls);
  const uniq = (items) => [...new Map(items.filter(Boolean).map((x) => [x.id, x])).values()];
  const tracks = uniq(pages.flatMap((p) => (p.tracks ? p.tracks.items : [])));
  const albums = uniq(pages.flatMap((p) => (p.albums ? p.albums.items : [])));
  return { tracks, albums };
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
  const seen = new Set();
  return albums
    .filter((a) => !seen.has(a.id) && seen.add(a.id))
    .map(
      (a) => `<li class="rec">
      ${a.images && a.images.length ? `<img src="${esc(a.images[a.images.length - 1].url)}" alt="" width="48" height="48" loading="lazy">` : ""}
      <div class="rec-main">
        <a href="${albumLink(a.id)}" target="_blank" rel="noopener" class="rec-album">${esc(a.name)}</a>
        <div class="rec-sub">${esc(a.artists.map((x) => x.name).join(", "))} · ${esc((a.release_date || "").slice(0, 4))}</div>
      </div></li>`
    )
    .join("");
}

function show(view) {
  $("#login").hidden = view !== "login";
  $("#app").hidden = view !== "app";
}

async function onSearch(e) {
  e.preventDefault();
  const q = $("#q").value.trim();
  if (!q) return;
  const out = $("#results");
  out.innerHTML = '<p class="muted">検索中…</p>';
  try {
    const { tracks, albums } = await search(q);
    const works = groupTracks(tracks);
    out.innerHTML = `
      <h2>作品ごと <small>${works.length}件</small></h2>
      ${works.length ? renderWorks(works) : '<p class="muted">該当なし</p>'}
      <h2>アルバム <small>${albums.length}件</small></h2>
      <ul class="recs">${renderAlbums(albums)}</ul>`;
  } catch (err) {
    if (err.message === "auth") {
      logout();
      show("login");
    } else {
      out.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    }
  }
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
  try {
    await handleRedirect();
  } catch (e) {
    $("#login-error").textContent = "ログインに失敗しました: " + e.message;
  }
  show((await getToken()) ? "app" : "login");
}
init();
