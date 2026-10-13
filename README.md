# Classical Search

Spotifyのクラシック音楽を、楽章（トラック）ではなく**作品ごと**にまとめて検索する個人用PWA。

- 設定: `config.js` の `CLIENT_ID`
- Spotify Dashboard の Redirect URI に、公開URL（例: `https://yama001-lab.github.io/classical-search/`）を登録
- ローカル確認: `python3 -m http.server 5173 --bind 127.0.0.1` → `http://127.0.0.1:5173/`（このURLもRedirect URIに登録）
- テスト: `node test-group.mjs`
