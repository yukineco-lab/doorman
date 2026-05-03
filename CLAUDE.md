# CLAUDE.md

Notes for Claude Code (and humans) working on this repository. Keep it short, current, and load-bearing.

## What this is

Doorman is a personal **bookmark manager desktop app**. The canonical user flow is _click a card → browser opens_, with optional per-bookmark launch profiles (e.g. "open this URL in Chrome's work profile").

- Stack: **Electron + electron-vite + React 19 + TypeScript + better-sqlite3**
- Distribution: **GitHub Releases (Win .exe + macOS arm64 .dmg)**, marketing page on **Cloudflare Pages**
- Repo: <https://github.com/yukineco-lab/doorman> (Public)
- Site: <https://doorman-5hh.pages.dev>

## Process model (read this before touching anything)

Electron has three processes; this repo splits them into three top-level folders. **All native / fs / sqlite / shell access lives in `main`.** The renderer is a sandboxed React app and only talks to main through the typed IPC bridge in `preload`.

```
src/
├── main/         Node-side: SQLite, fs, IPC handlers, dialog, shell, child_process
│   ├── index.ts        BrowserWindow + custom protocol registration
│   ├── ipc.ts          ipcMain.handle("namespace:verb", ...) registry
│   ├── db.ts           better-sqlite3, schema + migrations + repos
│   ├── icons.ts        Icon file import (path or data URL)
│   ├── pageMeta.ts     Fetch <title> + <link rel=icon> from a URL
│   └── portability.ts  Export/import of all data as one JSON file
├── preload/      Bridge: exposes a typed `window.api` via contextBridge
├── renderer/     React app (no Node access)
│   └── src/
│       ├── App.tsx
│       ├── components/
│       └── assets/main.css
└── shared/       Types referenced from all three processes
    └── types.ts
```

**Path aliases** (configured in `electron.vite.config.ts` and the three tsconfigs):

| Alias       | Resolves to            | Available in        |
| ----------- | ---------------------- | ------------------- |
| `@shared/*` | `src/shared/*`         | main, preload, renderer |
| `@renderer/*` | `src/renderer/src/*` | renderer            |

## Commands

```bash
npm install           # also runs `electron-builder install-app-deps` (rebuilds native modules for Electron's ABI)
npm run dev           # full hot-reload (renderer HMR; main/preload restart on change)
npm run typecheck     # tsc for both node-side and web-side configs
npm run lint          # eslint
npm run format        # prettier --write .
npm run build         # typecheck + electron-vite build → out/
npm run build:unpack  # build + electron-builder --dir → dist/win-unpacked/
npm run build:win     # build + NSIS installer → dist/*-setup.exe
npm run build:mac     # build + dmg (x64 + arm64) on macOS only
```

Always **fully close any running Doorman.exe before `build:win` / `build:unpack`** — locked files block the rebuild.

## Data & runtime state

- App data dir: `app.getPath('userData') + '/doorman-data/'`
  - `doorman.db` — single SQLite file (WAL mode, foreign keys on)
  - `icons/{bookmarkUUID}.{ext}` — one file per bookmark icon
- Custom URL scheme `doorman-icon://local/<filename>` serves icons to the renderer (registered as privileged in `main/index.ts`, handled in `main/ipc.ts`). The renderer never reads files directly.
- All IDs are UUIDv4, generated in main (`uuidv4()`).

## Schema & migrations

Schema lives in `src/main/db.ts` inside `initDb()`. Tables are created with `CREATE TABLE IF NOT EXISTS`. **For backwards-compatible additions, use `PRAGMA table_info` + `ALTER TABLE ... ADD COLUMN`** so existing user databases keep working — see how `bookmarks.launch_profile_id` was added. Never drop or rename columns without a migration plan.

## IPC contract conventions

- Channel names: `<namespace>:<verb>` — e.g. `bookmarks:list`, `folders:create`, `app:openExternal`.
- Always use `ipcMain.handle` + `ipcRenderer.invoke` (request/response). No `send`/`on` events unless really needed.
- The full surface area is the `DoormanAPI` interface in `src/shared/types.ts`. **Adding an IPC method = update 4 files**: `shared/types.ts`, `main/ipc.ts`, `preload/index.ts`, and the renderer caller.
- Inputs/outputs flow through `structuredClone` — only plain JSON-compatible data. Use discriminated unions for "do X or Y" parameters (see `IconChange`).

## UI conventions

- Styling: a single `src/renderer/src/assets/main.css` with CSS custom properties for the palette (warm beige + navy accent). No Tailwind / CSS-in-JS.
- Modals (`components/Modal.tsx`): close **only** via the × button or an explicit save action. Overlay click and Escape do NOT close — users were losing in-progress input.
- Drag-and-drop: `@dnd-kit/core` + `@dnd-kit/sortable`, with `PointerSensor` activation distance ≥ 5px so taps still register as clicks.
- Image cache busting: append `?v=<file mtime>` (added by main and threaded through `BookmarkIcon`) so editing an icon re-fetches immediately.

## CI/CD

Two workflows under `.github/workflows/`:

- **`release.yml`** — fires on `git push origin v*` tags. Builds Windows + macOS in parallel matrix and attaches artifacts to the GitHub Release. Note `npm run <script> -- --publish never` — electron-builder otherwise tries to upload using its own implicit publisher and fails without a token.
- **`deploy-site.yml`** — fires on push to `main` when `site/**` changes. Auto-creates the Cloudflare Pages project on first run via `curl` to the Pages API (Wrangler 3 doesn't auto-create), then deploys with `npx wrangler@4 pages deploy site`. Uses repo secrets `CLOUDFLARE_API_TOKEN` (Pages: Edit) and `CLOUDFLARE_ACCOUNT_ID`.

### Releasing a new version

```bash
# 1. bump package.json "version"
# 2. commit
git add package.json && git commit -m "Bump version to 0.x.0"
git push

# 3. tag and push
git tag -a v0.x.0 -m "Release v0.x.0"
git push origin v0.x.0
# → CI builds installers and creates the GitHub Release
# → site auto-fetches latest tag at page load, no site rebuild needed
```

## Lessons learned (don't repeat these)

- **Never invoke window.prompt in Electron renderers** — it returns `null` silently. Build a real modal.
- `process.contextIsolated = true` is the default in modern Electron. Always use `contextBridge.exposeInMainWorld`; the `if (contextIsolated)` ladder from boilerplates is no-op cargo.
- `dialog.showOpenDialog(window, options)` — pass the parent window or the dialog can render behind the app.
- Reading local files in the renderer via `file://` is blocked. Either return a data URL from main, or register a custom protocol (we do both: `pickIconFile` returns a data URL for the immediate preview, `doorman-icon://` serves saved icons).
- `cloudflare/wrangler-action` runs `npm install` in the repo root which dragged in Electron and crashed on a 502 from the Electron CDN. Calling `npx wrangler@4` directly avoids touching repo dependencies.
- `electron-builder` auto-generates a Windows `.ico` from `build/icon.png`, but the result is a single low-res image. For a crisp taskbar/exe icon, generate a multi-size ICO (16/24/32/48/64/128/256) — see `scripts/make-icons.mjs`.
- After installing native modules from a different Node version, run `npx electron-rebuild -f -w better-sqlite3` (or just `npm install` since postinstall handles it) to match Electron's ABI. NODE_MODULE_VERSION mismatch crashes the app at startup.
- Run all builds from **Windows-native** Node (`C:\Program Files\nodejs`), not from WSL — native modules built for Linux won't load in a Windows Electron.

## File-touch quick reference

| Goal                                      | Files                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| Add a new IPC endpoint                    | `shared/types.ts` → `main/ipc.ts` → `preload/index.ts` → renderer caller     |
| Add a new persistent column               | `main/db.ts` (schema + ALTER + repo) + `shared/types.ts` + IPC create/update |
| Add a new modal                           | `renderer/src/components/*.tsx` + state in `App.tsx`                          |
| Change palette                            | `renderer/src/assets/main.css` `:root` block + `main/index.ts` `backgroundColor` |
| Update landing page                       | `site/index.html` (then push to main → auto-deploy)                           |
| Bump app icon                             | `build/icon.png` → `node scripts/make-icons.mjs` → rebuild                    |

## Don't commit

`out/`, `dist/`, `build/.icon-tmp/`, `node_modules/` (already in `.gitignore`). The `dist/` directory in particular contains 200+ MB of bundled Electron — never push it.
