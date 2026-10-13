// Spotify の PKCE 認可（クライアントシークレット不要）
import { CLIENT_ID, SCOPES } from "./config.js";

const TOKEN_KEY = "spotify_token";
const VERIFIER_KEY = "spotify_verifier";

export const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, "");

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function challenge(verifier) {
  return b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
}

export async function login() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  localStorage.setItem(VERIFIER_KEY, verifier);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri(),
    code_challenge_method: "S256",
    code_challenge: await challenge(verifier),
    scope: SCOPES.join(" "),
  });
  location.href = "https://accounts.spotify.com/authorize?" + params;
}

async function tokenRequest(body) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body }),
  });
  if (!res.ok) throw new Error("token " + res.status);
  const t = await res.json();
  const saved = {
    access_token: t.access_token,
    refresh_token: t.refresh_token || JSON.parse(localStorage.getItem(TOKEN_KEY) || "{}").refresh_token,
    expires_at: Date.now() + (t.expires_in - 60) * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(saved));
  return saved;
}

// ログイン後に戻ってきたとき ?code=... を処理する
export async function handleRedirect() {
  const q = new URLSearchParams(location.search);
  if (!q.has("code")) return;
  const verifier = localStorage.getItem(VERIFIER_KEY);
  const code = q.get("code");
  history.replaceState({}, "", redirectUri());
  await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });
  localStorage.removeItem(VERIFIER_KEY);
}

export async function getToken() {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  let t = JSON.parse(raw);
  if (Date.now() < t.expires_at) return t.access_token;
  if (!t.refresh_token) return null;
  try {
    t = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh_token });
    return t.access_token;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}
