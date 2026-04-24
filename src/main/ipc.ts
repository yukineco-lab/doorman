import { ipcMain, shell, dialog, protocol, net, BrowserWindow } from 'electron'
import { pathToFileURL } from 'url'
import { readFileSync } from 'fs'
import { extname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { bookmarkRepo, folderRepo, getDataDir, initDb } from './db'
import { deleteIcon, iconPath, importIcon } from './icons'
import type { BookmarkInput, FolderInput, ReorderItem } from '@shared/types'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

function fileToDataUrl(path: string): string {
  const ext = extname(path).toLowerCase()
  const mime = MIME[ext] ?? 'application/octet-stream'
  const data = readFileSync(path).toString('base64')
  return `data:${mime};base64,${data}`
}

export function registerIpc(): void {
  initDb()

  protocol.handle('doorman-icon', (request) => {
    const url = new URL(request.url)
    const filename = decodeURIComponent(url.hostname + url.pathname).replace(/^\/+/, '')
    const safe = filename.replace(/[\\/]/g, '')
    return net.fetch(pathToFileURL(iconPath(safe)).toString())
  })

  ipcMain.handle('folders:list', () => folderRepo.list())
  ipcMain.handle('folders:create', (_e, input: FolderInput) => {
    const id = uuidv4()
    return folderRepo.create(id, input.name.trim())
  })
  ipcMain.handle('folders:update', (_e, id: string, input: FolderInput) => {
    return folderRepo.update(id, input.name.trim())
  })
  ipcMain.handle('folders:delete', (_e, id: string) => {
    folderRepo.delete(id)
  })
  ipcMain.handle('folders:reorder', (_e, items: ReorderItem[]) => {
    folderRepo.reorder(items)
  })

  ipcMain.handle('bookmarks:list', () => bookmarkRepo.list())
  ipcMain.handle('bookmarks:create', (_e, input: BookmarkInput) => {
    const id = uuidv4()
    let iconFilename: string | null = null
    if (input.iconSourcePath) {
      iconFilename = importIcon(input.iconSourcePath, id)
    }
    return bookmarkRepo.create(
      id,
      input.folderId,
      input.name.trim(),
      input.url.trim(),
      input.memo,
      iconFilename
    )
  })
  ipcMain.handle('bookmarks:update', (_e, id: string, input: BookmarkInput) => {
    const existing = bookmarkRepo.get(id)
    if (!existing) throw new Error('Bookmark not found')
    let iconFilename = existing.iconFilename
    if (input.iconSourcePath) {
      deleteIcon(existing.iconFilename)
      iconFilename = importIcon(input.iconSourcePath, id)
    } else if (input.iconSourcePath === null) {
      // explicit removal
      deleteIcon(existing.iconFilename)
      iconFilename = null
    }
    return bookmarkRepo.update(
      id,
      input.folderId,
      input.name.trim(),
      input.url.trim(),
      input.memo,
      iconFilename
    )
  })
  ipcMain.handle('bookmarks:delete', (_e, id: string) => {
    const existing = bookmarkRepo.get(id)
    if (existing) deleteIcon(existing.iconFilename)
    bookmarkRepo.delete(id)
  })
  ipcMain.handle('bookmarks:reorder', (_e, items: ReorderItem[]) => {
    bookmarkRepo.reorder(items)
  })
  ipcMain.handle('bookmarks:move', (_e, id: string, folderId: string | null) => {
    return bookmarkRepo.move(id, folderId)
  })

  ipcMain.handle('app:openExternal', (_e, url: string) => shell.openExternal(url))
  ipcMain.handle('app:pickIconFile', async (event) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow()
    const options = {
      title: 'アイコン画像を選択',
      properties: ['openFile' as const],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'] }
      ]
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    const path = result.filePaths[0]
    try {
      return { path, dataUrl: fileToDataUrl(path) }
    } catch (err) {
      console.error('Failed to read picked icon:', err)
      throw err
    }
  })
  ipcMain.handle('app:dataDir', () => getDataDir())
}
