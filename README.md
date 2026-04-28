# Doorman

フォルダとカード形式のミニマルな UI を備えたブックマーク管理アプリ（Electron + React + TypeScript）。

## ダウンロード

最新のインストーラは [Releases](https://github.com/yukineco-lab/doorman/releases/latest) から取得できます。

- Windows: `doorman-x.x.x-setup.exe`
- macOS: `doorman-x.x.x.dmg` (Intel / Apple Silicon)

## 特徴

- ブックマーク（アイコン画像、略称、URL、メモ）の管理
- フォルダ（1 階層）による分類。トップ直下にも配置可能
- ドラッグ & ドロップで並び替え
- クリックでブラウザ起動
- データは SQLite（単一 `.db` ファイル）＋ 画像フォルダで保存

## データ保存場所

Windows: `%APPDATA%/doorman/doorman-data/`

- `doorman.db`（SQLite）
- `icons/{uuid}.{ext}`

## 開発

```bash
npm install
npm run dev        # 開発起動
npm run build      # プロダクションビルド
npm run build:win  # Windows インストーラ作成
npm run build:mac  # macOS 向けビルド
```

## スタック

- Electron + electron-vite
- React 19 + TypeScript
- better-sqlite3
- @dnd-kit（並び替え）
