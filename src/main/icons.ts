import { copyFileSync, existsSync, unlinkSync, writeFileSync } from 'fs'
import { extname, join } from 'path'
import { getIconsDir } from './db'

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'])

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico'
}

export function importIcon(sourcePath: string, id: string): string {
  const ext = extname(sourcePath).toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(`Unsupported icon extension: ${ext}`)
  }
  const filename = `${id}${ext}`
  const dest = join(getIconsDir(), filename)
  copyFileSync(sourcePath, dest)
  return filename
}

export function importIconFromDataUrl(dataUrl: string, id: string): string {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/)
  if (!m) throw new Error('Invalid data URL')
  const mime = m[1].toLowerCase()
  const ext = MIME_TO_EXT[mime]
  if (!ext || !ALLOWED_EXT.has(ext)) {
    throw new Error(`Unsupported icon mime: ${mime}`)
  }
  const filename = `${id}${ext}`
  const dest = join(getIconsDir(), filename)
  writeFileSync(dest, Buffer.from(m[2], 'base64'))
  return filename
}

export function deleteIcon(filename: string | null): void {
  if (!filename) return
  const path = join(getIconsDir(), filename)
  if (existsSync(path)) {
    try {
      unlinkSync(path)
    } catch {
      // ignore
    }
  }
}

export function iconPath(filename: string): string {
  return join(getIconsDir(), filename)
}
