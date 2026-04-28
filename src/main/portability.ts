import { dialog, BrowserWindow } from 'electron'
import { writeFileSync, readFileSync, writeFileSync as writeBuf } from 'fs'
import { extname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { bookmarkRepo, folderRepo, launchProfileRepo } from './db'
import { iconPath, deleteIcon } from './icons'
import type { ExportData, ImportResult } from '@shared/types'

const ICON_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'])

function readIconAsDataUrl(filename: string): string | null {
  try {
    const ext = extname(filename).toLowerCase()
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.gif'
            ? 'image/gif'
            : ext === '.webp'
              ? 'image/webp'
              : ext === '.svg'
                ? 'image/svg+xml'
                : 'image/x-icon'
    const buf = readFileSync(iconPath(filename))
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

function dataUrlToBuffer(
  dataUrl: string
): { buffer: Buffer; mime: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/)
  if (!m) return null
  return { mime: m[1].toLowerCase(), buffer: Buffer.from(m[2], 'base64') }
}

function extFromMime(mime: string): string {
  if (mime === 'image/png') return '.png'
  if (mime === 'image/jpeg' || mime === 'image/jpg') return '.jpg'
  if (mime === 'image/gif') return '.gif'
  if (mime === 'image/webp') return '.webp'
  if (mime === 'image/svg+xml') return '.svg'
  if (mime === 'image/x-icon' || mime === 'image/vnd.microsoft.icon') return '.ico'
  return '.bin'
}

export async function exportToFile(parent: BrowserWindow | null): Promise<string | null> {
  const result = await dialog.showSaveDialog(
    parent ?? BrowserWindow.getFocusedWindow()!,
    {
      title: 'エクスポート先を選択',
      defaultPath: `doorman-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'Doorman Export', extensions: ['json'] }]
    }
  )
  if (result.canceled || !result.filePath) return null

  const folders = folderRepo.list()
  const bookmarks = bookmarkRepo.list()
  const profiles = launchProfileRepo.list()
  const data: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    folders,
    profiles,
    bookmarks: bookmarks.map((b) => ({
      ...b,
      iconDataUrl: b.iconFilename ? readIconAsDataUrl(b.iconFilename) : null
    }))
  }
  writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
  return result.filePath
}

export async function importFromFile(
  parent: BrowserWindow | null,
  mode: 'replace' | 'merge'
): Promise<ImportResult | null> {
  const result = await dialog.showOpenDialog(
    parent ?? BrowserWindow.getFocusedWindow()!,
    {
      title: 'インポートするファイルを選択',
      properties: ['openFile'],
      filters: [{ name: 'Doorman Export', extensions: ['json'] }]
    }
  )
  if (result.canceled || result.filePaths.length === 0) return null

  const raw = readFileSync(result.filePaths[0], 'utf-8')
  let parsed: ExportData
  try {
    parsed = JSON.parse(raw) as ExportData
  } catch {
    throw new Error('JSON 形式が不正です')
  }
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.folders)) {
    throw new Error('Doorman エクスポート形式ではありません')
  }

  // Replace mode: clear existing data + icons + profiles
  if (mode === 'replace') {
    const existing = bookmarkRepo.list()
    for (const b of existing) deleteIcon(b.iconFilename)
    for (const b of existing) bookmarkRepo.delete(b.id)
    for (const f of folderRepo.list()) folderRepo.delete(f.id)
    for (const p of launchProfileRepo.list()) launchProfileRepo.delete(p.id)
  }

  // Map old (export-side) profile id -> new (db) profile id
  const profileIdMap = new Map<string, string>()
  const incomingProfiles = parsed.profiles ?? []
  if (mode === 'replace') {
    for (const p of incomingProfiles) {
      const newId = uuidv4()
      launchProfileRepo.create(newId, p.name, p.execPath, p.args ?? [])
      profileIdMap.set(p.id, newId)
    }
  } else {
    // merge: reuse existing profile by name
    const existingByName = new Map<string, string>()
    for (const ep of launchProfileRepo.list()) existingByName.set(ep.name, ep.id)
    for (const p of incomingProfiles) {
      const matched = existingByName.get(p.name)
      if (matched) {
        profileIdMap.set(p.id, matched)
      } else {
        const newId = uuidv4()
        launchProfileRepo.create(newId, p.name, p.execPath, p.args ?? [])
        profileIdMap.set(p.id, newId)
        existingByName.set(p.name, newId)
      }
    }
  }

  // Map old (export-side) folder id -> new (db) folder id
  const folderIdMap = new Map<string, string>()

  if (mode === 'replace') {
    // Recreate every folder with a fresh id
    for (const f of parsed.folders) {
      const newId = uuidv4()
      folderRepo.create(newId, f.name)
      folderIdMap.set(f.id, newId)
    }
    // Restore folder order from export
    folderRepo.reorder(
      parsed.folders.map((f, i) => ({
        id: folderIdMap.get(f.id)!,
        displayOrder: typeof f.displayOrder === 'number' ? f.displayOrder : i
      }))
    )
  } else {
    // merge: reuse existing folder by name; create if missing
    const existingByName = new Map<string, string>()
    for (const ef of folderRepo.list()) existingByName.set(ef.name, ef.id)
    for (const f of parsed.folders) {
      const matched = existingByName.get(f.name)
      if (matched) {
        folderIdMap.set(f.id, matched)
      } else {
        const newId = uuidv4()
        folderRepo.create(newId, f.name)
        folderIdMap.set(f.id, newId)
        existingByName.set(f.name, newId)
      }
    }
  }

  // For merge: skip bookmarks whose URL already exists
  const existingUrls =
    mode === 'merge' ? new Set(bookmarkRepo.list().map((b) => b.url)) : new Set<string>()

  let bookmarkCount = 0
  let skipped = 0
  for (const b of parsed.bookmarks ?? []) {
    const url = (b.url ?? '').trim()
    if (mode === 'merge' && url && existingUrls.has(url)) {
      skipped++
      continue
    }

    const newBookmarkId = uuidv4()
    let iconFilename: string | null = null
    if (b.iconDataUrl) {
      const decoded = dataUrlToBuffer(b.iconDataUrl)
      if (decoded) {
        const ext = extFromMime(decoded.mime)
        if (ICON_EXTS.has(ext)) {
          iconFilename = `${newBookmarkId}${ext}`
          writeBuf(iconPath(iconFilename), decoded.buffer)
        }
      }
    }
    const folderId = b.folderId ? folderIdMap.get(b.folderId) ?? null : null
    const launchProfileId = b.launchProfileId
      ? profileIdMap.get(b.launchProfileId) ?? null
      : null
    bookmarkRepo.create(
      newBookmarkId,
      folderId,
      b.name ?? '',
      url,
      b.memo ?? '',
      iconFilename,
      launchProfileId
    )
    if (url) existingUrls.add(url)
    bookmarkCount++
  }

  return { folders: parsed.folders.length, bookmarks: bookmarkCount, skipped }
}
