import { copyFileSync, existsSync, unlinkSync } from 'fs'
import { extname, join } from 'path'
import { getIconsDir } from './db'

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'])

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
