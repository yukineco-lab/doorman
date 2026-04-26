import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  BookmarkInput,
  DoormanAPI,
  FolderInput,
  ReorderItem
} from '../shared/types'

const api: DoormanAPI = {
  listFolders: () => ipcRenderer.invoke('folders:list'),
  createFolder: (input: FolderInput) => ipcRenderer.invoke('folders:create', input),
  updateFolder: (id: string, input: FolderInput) =>
    ipcRenderer.invoke('folders:update', id, input),
  deleteFolder: (id: string) => ipcRenderer.invoke('folders:delete', id),
  reorderFolders: (items: ReorderItem[]) => ipcRenderer.invoke('folders:reorder', items),

  listBookmarks: () => ipcRenderer.invoke('bookmarks:list'),
  createBookmark: (input: BookmarkInput) => ipcRenderer.invoke('bookmarks:create', input),
  updateBookmark: (id: string, input: BookmarkInput) =>
    ipcRenderer.invoke('bookmarks:update', id, input),
  deleteBookmark: (id: string) => ipcRenderer.invoke('bookmarks:delete', id),
  reorderBookmarks: (items: ReorderItem[]) =>
    ipcRenderer.invoke('bookmarks:reorder', items),
  moveBookmark: (id: string, folderId: string | null) =>
    ipcRenderer.invoke('bookmarks:move', id, folderId),

  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  pickIconFile: () => ipcRenderer.invoke('app:pickIconFile'),
  iconUrl: (filename: string, version?: number | null) => {
    const base = `doorman-icon://local/${encodeURIComponent(filename)}`
    return version ? `${base}?v=${version}` : base
  },
  dataDir: () => ipcRenderer.invoke('app:dataDir'),

  fetchPageMeta: (url: string) => ipcRenderer.invoke('app:fetchPageMeta', url),
  exportToFile: () => ipcRenderer.invoke('app:exportToFile'),
  importFromFile: (mode: 'replace' | 'merge') =>
    ipcRenderer.invoke('app:importFromFile', mode)
}

console.log('[doorman preload] loading, contextIsolated =', process.contextIsolated)

try {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', api)
  console.log('[doorman preload] api exposed via contextBridge')
} catch (error) {
  console.error('[doorman preload] contextBridge failed, falling back to window:', error)
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
