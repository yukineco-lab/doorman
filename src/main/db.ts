import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import type { Bookmark, Folder, ReorderItem } from '@shared/types'

let db: Database.Database | null = null

export function getDataDir(): string {
  const dir = join(app.getPath('userData'), 'doorman-data')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function getIconsDir(): string {
  const dir = join(getDataDir(), 'icons')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function initDb(): Database.Database {
  if (db) return db
  const dbPath = join(getDataDir(), 'doorman.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      folder_id TEXT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      memo TEXT NOT NULL DEFAULT '',
      icon_filename TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bookmarks_folder ON bookmarks(folder_id);
  `)
  return db
}

function rowToFolder(row: {
  id: string
  name: string
  display_order: number
}): Folder {
  return { id: row.id, name: row.name, displayOrder: row.display_order }
}

function rowToBookmark(row: {
  id: string
  folder_id: string | null
  name: string
  url: string
  memo: string
  icon_filename: string | null
  display_order: number
}): Bookmark {
  return {
    id: row.id,
    folderId: row.folder_id,
    name: row.name,
    url: row.url,
    memo: row.memo,
    iconFilename: row.icon_filename,
    iconMtime: null,
    displayOrder: row.display_order
  }
}

export const folderRepo = {
  list(): Folder[] {
    const d = initDb()
    const rows = d
      .prepare('SELECT id, name, display_order FROM folders ORDER BY display_order ASC')
      .all() as Array<{ id: string; name: string; display_order: number }>
    return rows.map(rowToFolder)
  },
  get(id: string): Folder | null {
    const d = initDb()
    const row = d
      .prepare('SELECT id, name, display_order FROM folders WHERE id = ?')
      .get(id) as { id: string; name: string; display_order: number } | undefined
    return row ? rowToFolder(row) : null
  },
  create(id: string, name: string): Folder {
    const d = initDb()
    const maxOrder = (d.prepare('SELECT COALESCE(MAX(display_order), -1) AS m FROM folders').get() as {
      m: number
    }).m
    const order = maxOrder + 1
    d.prepare('INSERT INTO folders (id, name, display_order) VALUES (?, ?, ?)').run(
      id,
      name,
      order
    )
    return { id, name, displayOrder: order }
  },
  update(id: string, name: string): Folder | null {
    const d = initDb()
    d.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, id)
    return this.get(id)
  },
  delete(id: string): void {
    const d = initDb()
    d.prepare('DELETE FROM folders WHERE id = ?').run(id)
  },
  reorder(items: ReorderItem[]): void {
    const d = initDb()
    const stmt = d.prepare('UPDATE folders SET display_order = ? WHERE id = ?')
    const tx = d.transaction((list: ReorderItem[]) => {
      for (const it of list) stmt.run(it.displayOrder, it.id)
    })
    tx(items)
  }
}

export const bookmarkRepo = {
  list(): Bookmark[] {
    const d = initDb()
    const rows = d
      .prepare(
        'SELECT id, folder_id, name, url, memo, icon_filename, display_order FROM bookmarks ORDER BY display_order ASC'
      )
      .all() as Array<{
      id: string
      folder_id: string | null
      name: string
      url: string
      memo: string
      icon_filename: string | null
      display_order: number
    }>
    return rows.map(rowToBookmark)
  },
  get(id: string): Bookmark | null {
    const d = initDb()
    const row = d
      .prepare(
        'SELECT id, folder_id, name, url, memo, icon_filename, display_order FROM bookmarks WHERE id = ?'
      )
      .get(id) as
      | {
          id: string
          folder_id: string | null
          name: string
          url: string
          memo: string
          icon_filename: string | null
          display_order: number
        }
      | undefined
    return row ? rowToBookmark(row) : null
  },
  create(
    id: string,
    folderId: string | null,
    name: string,
    url: string,
    memo: string,
    iconFilename: string | null
  ): Bookmark {
    const d = initDb()
    const maxOrder = (d
      .prepare(
        'SELECT COALESCE(MAX(display_order), -1) AS m FROM bookmarks WHERE folder_id IS ?'
      )
      .get(folderId) as { m: number }).m
    const order = maxOrder + 1
    d.prepare(
      'INSERT INTO bookmarks (id, folder_id, name, url, memo, icon_filename, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, folderId, name, url, memo, iconFilename, order)
    return {
      id,
      folderId,
      name,
      url,
      memo,
      iconFilename,
      iconMtime: null,
      displayOrder: order
    }
  },
  update(
    id: string,
    folderId: string | null,
    name: string,
    url: string,
    memo: string,
    iconFilename: string | null
  ): Bookmark | null {
    const d = initDb()
    d.prepare(
      'UPDATE bookmarks SET folder_id = ?, name = ?, url = ?, memo = ?, icon_filename = ? WHERE id = ?'
    ).run(folderId, name, url, memo, iconFilename, id)
    return this.get(id)
  },
  delete(id: string): void {
    const d = initDb()
    d.prepare('DELETE FROM bookmarks WHERE id = ?').run(id)
  },
  reorder(items: ReorderItem[]): void {
    const d = initDb()
    const stmt = d.prepare('UPDATE bookmarks SET display_order = ? WHERE id = ?')
    const tx = d.transaction((list: ReorderItem[]) => {
      for (const it of list) stmt.run(it.displayOrder, it.id)
    })
    tx(items)
  },
  move(id: string, folderId: string | null): Bookmark | null {
    const d = initDb()
    const maxOrder = (d
      .prepare(
        'SELECT COALESCE(MAX(display_order), -1) AS m FROM bookmarks WHERE folder_id IS ?'
      )
      .get(folderId) as { m: number }).m
    d.prepare('UPDATE bookmarks SET folder_id = ?, display_order = ? WHERE id = ?').run(
      folderId,
      maxOrder + 1,
      id
    )
    return this.get(id)
  }
}
