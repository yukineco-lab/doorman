import { ipcMain, shell, dialog, protocol, net, BrowserWindow } from 'electron'
import { pathToFileURL } from 'url'
import { spawn } from 'child_process'
import { readFileSync, statSync } from 'fs'
import { extname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { bookmarkRepo, folderRepo, getDataDir, initDb, launchProfileRepo } from './db'
import { deleteIcon, iconPath, importIcon, importIconFromDataUrl } from './icons'
import { fetchPageMeta } from './pageMeta'
import { exportToFile, importFromFile } from './portability'
import type {
  Bookmark,
  BookmarkInput,
  FolderInput,
  LaunchProfileInput,
  ReorderItem
} from '@shared/types'

function withIconMtime(b: Bookmark): Bookmark {
  if (!b.iconFilename) return b
  try {
    const st = statSync(iconPath(b.iconFilename))
    return { ...b, iconMtime: st.mtimeMs }
  } catch {
    return b
  }
}

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
    const filename = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
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

  ipcMain.handle('bookmarks:list', () => bookmarkRepo.list().map(withIconMtime))
  ipcMain.handle('bookmarks:create', (_e, input: BookmarkInput) => {
    const id = uuidv4()
    let iconFilename: string | null = null
    if (input.iconChange.kind === 'file') {
      iconFilename = importIcon(input.iconChange.path, id)
    } else if (input.iconChange.kind === 'dataUrl') {
      iconFilename = importIconFromDataUrl(input.iconChange.dataUrl, id)
    }
    const created = bookmarkRepo.create(
      id,
      input.folderId,
      input.name.trim(),
      input.url.trim(),
      input.memo,
      iconFilename,
      input.launchProfileId ?? null
    )
    return withIconMtime(created)
  })
  ipcMain.handle('bookmarks:update', (_e, id: string, input: BookmarkInput) => {
    const existing = bookmarkRepo.get(id)
    if (!existing) throw new Error('Bookmark not found')
    let iconFilename = existing.iconFilename
    switch (input.iconChange.kind) {
      case 'file':
        deleteIcon(existing.iconFilename)
        iconFilename = importIcon(input.iconChange.path, id)
        break
      case 'dataUrl':
        deleteIcon(existing.iconFilename)
        iconFilename = importIconFromDataUrl(input.iconChange.dataUrl, id)
        break
      case 'remove':
        deleteIcon(existing.iconFilename)
        iconFilename = null
        break
      // 'keep' falls through
    }
    const updated = bookmarkRepo.update(
      id,
      input.folderId,
      input.name.trim(),
      input.url.trim(),
      input.memo,
      iconFilename,
      input.launchProfileId ?? null
    )
    return updated ? withIconMtime(updated) : updated
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

  ipcMain.handle(
    'app:openExternal',
    async (_e, url: string, launchProfileId?: string | null) => {
      if (launchProfileId) {
        const profile = launchProfileRepo.get(launchProfileId)
        if (profile && profile.execPath) {
          try {
            const child = spawn(profile.execPath, [...profile.args, url], {
              detached: true,
              stdio: 'ignore'
            })
            child.unref()
            return
          } catch (err) {
            console.error('Launch profile failed, falling back to default browser:', err)
          }
        }
      }
      await shell.openExternal(url)
    }
  )

  ipcMain.handle('profiles:list', () => launchProfileRepo.list())
  ipcMain.handle('profiles:create', (_e, input: LaunchProfileInput) => {
    const id = uuidv4()
    return launchProfileRepo.create(id, input.name.trim(), input.execPath.trim(), input.args)
  })
  ipcMain.handle('profiles:update', (_e, id: string, input: LaunchProfileInput) => {
    return launchProfileRepo.update(id, input.name.trim(), input.execPath.trim(), input.args)
  })
  ipcMain.handle('profiles:delete', (_e, id: string) => {
    launchProfileRepo.delete(id)
  })
  ipcMain.handle('profiles:reorder', (_e, items: ReorderItem[]) => {
    launchProfileRepo.reorder(items)
  })
  ipcMain.handle('app:pickExecutable', async (event) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow()
    const options = {
      title: '実行ファイルを選択',
      properties: ['openFile' as const],
      filters: [
        { name: 'Executable', extensions: ['exe', 'cmd', 'bat'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
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

  ipcMain.handle('app:fetchPageMeta', (_e, url: string) => fetchPageMeta(url))
  ipcMain.handle('app:exportToFile', (event) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow()
    return exportToFile(win)
  })
  ipcMain.handle('app:importFromFile', (event, mode: 'replace' | 'merge') => {
    const win =
      BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow()
    return importFromFile(win, mode)
  })
}
