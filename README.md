# Among Us 役職アトラス

バニラ役職とMOD役職を調べ、質問で候補を絞り込める静的Webアプリです。Vercelにそのまま配置できます。

## データの方針

- `public/data/roles-source.csv` はユーザー提供の元CSVを無加工で保存しています。
- `public/data/vanilla-verified.json` はInnersloth公式情報で確認済みのバニラ役職です。元CSVにないジャッジとインフルエンサーをここで追補しています。
- MOD役職は元CSVの能力フラグを表示しますが、説明文・能力の解釈は未検証として扱います。検証できた役職は、専用の確認済みデータを追加する形で更新してください。
- `public/data/mod-registry.json` にMODの表示名、対象バージョン、リリースURLをまとめています。

## ローカルで確認する

Node.jsがある環境で、次を実行します。

```bash
npm install
npm run dev
```

表示されたローカルURLをブラウザで開きます。依存関係を入れずに確認する場合は、`public` フォルダを任意の静的Webサーバーで配信しても動作します。

## Vercelへ公開する

1. このフォルダをGitHubなどのGitリポジトリへ追加します。
2. Vercelで「Add New Project」を選び、そのリポジトリを選択します。
3. Framework Preset は `Other`、Build Command は空欄のままデプロイします。

このプロジェクトはサーバー処理を使わない静的サイトです。`public` 配下が公開されます。

## 更新手順

1. 新しいCSVを `public/data/roles-source.csv` に置き換えます。
2. バニラの公式確認済み情報は `public/data/vanilla-verified.json` を更新します。
3. MODの対象バージョンは `public/data/mod-registry.json` を更新します。
4. ブラウザで図鑑・検索・役職当てを確認してから公開します。
