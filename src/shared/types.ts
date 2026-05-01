export interface Folder {
  id: string
  name: string
  displayOrder: number
}

export interface LaunchProfile {
  id: string
  name: string
  execPath: string
  args: string[]
  displayOrder: number
}

export interface LaunchProfileInput {
  name: string
  execPath: string
  args: string[]
}

export interface Bookmark {
  id: string
  folderId: string | null
  name: string
  url: string
  memo: string
  iconFilename: string | null
  iconMtime: number | null
  launchProfileId: string | null
  displayOrder: number
}

export type IconChange =
  | { kind: 'keep' }
  | { kind: 'remove' }
  | { kind: 'file'; path: string }
  | { kind: 'dataUrl'; dataUrl: string }

export interface BookmarkInput {
  folderId: string | null
  name: string
  url: string
  memo: string
  iconChange: IconChange
  launchProfileId: string | null
}

export interface FolderInput {
  name: string
}

export interface ReorderItem {
  id: string
  displayOrder: number
}

export interface PageMeta {
  title: string | null
  iconDataUrl: string | null
  iconExt: string | null
}

export interface ExportData {
  version: 1
  exportedAt: string
  folders: Folder[]
  profiles?: LaunchProfile[]
  bookmarks: Array<Bookmark & { iconDataUrl?: string | null }>
}

export interface ImportResult {
  folders: number
  bookmarks: number
  skipped: number
}

export interface DoormanAPI {
  listFolders: () => Promise<Folder[]>
  createFolder: (input: FolderInput) => Promise<Folder>
  updateFolder: (id: string, input: FolderInput) => Promise<Folder>
  deleteFolder: (id: string) => Promise<void>
  reorderFolders: (items: ReorderItem[]) => Promise<void>

  listBookmarks: () => Promise<Bookmark[]>
  createBookmark: (input: BookmarkInput) => Promise<Bookmark>
  updateBookmark: (id: string, input: BookmarkInput) => Promise<Bookmark>
  deleteBookmark: (id: string) => Promise<void>
  reorderBookmarks: (items: ReorderItem[]) => Promise<void>
  moveBookmark: (id: string, folderId: string | null) => Promise<Bookmark>

  listLaunchProfiles: () => Promise<LaunchProfile[]>
  createLaunchProfile: (input: LaunchProfileInput) => Promise<LaunchProfile>
  updateLaunchProfile: (id: string, input: LaunchProfileInput) => Promise<LaunchProfile>
  deleteLaunchProfile: (id: string) => Promise<void>
  reorderLaunchProfiles: (items: ReorderItem[]) => Promise<void>
  pickExecutable: () => Promise<string | null>
  detectChromePath: () => Promise<string | null>

  openExternal: (url: string, launchProfileId?: string | null) => Promise<void>
  pickIconFile: () => Promise<{ path: string; dataUrl: string } | null>
  iconUrl: (filename: string, version?: number | null) => string
  dataDir: () => Promise<string>

  fetchPageMeta: (url: string) => Promise<PageMeta>
  exportToFile: () => Promise<string | null>
  importFromFile: (mode: 'replace' | 'merge') => Promise<ImportResult | null>
}
