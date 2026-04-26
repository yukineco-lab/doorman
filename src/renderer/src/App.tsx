import { useEffect, useMemo, useState, type JSX } from 'react'
import type { Bookmark, BookmarkInput, Folder } from '@shared/types'
import { Sidebar, type SelectionKey } from './components/Sidebar'
import { BookmarkList } from './components/BookmarkList'
import { BookmarkModal } from './components/BookmarkModal'
import { FolderModal } from './components/FolderModal'
import { ImportModal } from './components/ImportModal'
import { IconClose, IconPlus } from './components/Icons'

function App(): JSX.Element {
  const [folders, setFolders] = useState<Folder[]>([])
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [selection, setSelection] = useState<SelectionKey>('all')
  const [search, setSearch] = useState('')

  const [bookmarkModal, setBookmarkModal] = useState<
    { mode: 'create' } | { mode: 'edit'; bookmark: Bookmark } | null
  >(null)
  const [folderModal, setFolderModal] = useState<
    { mode: 'create' } | { mode: 'edit'; folder: Folder } | null
  >(null)
  const [importOpen, setImportOpen] = useState(false)

  const reload = async (): Promise<void> => {
    const [fs, bs] = await Promise.all([window.api.listFolders(), window.api.listBookmarks()])
    setFolders(fs)
    setBookmarks(bs)
  }

  useEffect(() => {
    reload()
  }, [])

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const b of bookmarks) {
      if (b.folderId) map[b.folderId] = (map[b.folderId] ?? 0) + 1
    }
    return map
  }, [bookmarks])

  const topCount = useMemo(
    () => bookmarks.filter((b) => b.folderId === null).length,
    [bookmarks]
  )

  const searchLower = search.trim().toLowerCase()
  const isSearching = searchLower.length > 0

  const visibleBookmarks = useMemo(() => {
    let list: Bookmark[]
    if (isSearching) {
      // 検索時はフォルダ選択を無視して全体検索
      list = bookmarks.filter((b) => {
        return (
          b.name.toLowerCase().includes(searchLower) ||
          b.url.toLowerCase().includes(searchLower) ||
          b.memo.toLowerCase().includes(searchLower)
        )
      })
    } else if (selection === 'all') list = bookmarks
    else if (selection === 'top') list = bookmarks.filter((b) => b.folderId === null)
    else list = bookmarks.filter((b) => b.folderId === selection)
    return [...list].sort((a, b) => a.displayOrder - b.displayOrder)
  }, [bookmarks, selection, isSearching, searchLower])

  const currentTitle = useMemo(() => {
    if (isSearching) return `検索: "${search.trim()}"`
    if (selection === 'all') return 'すべてのブックマーク'
    if (selection === 'top') return 'トップ'
    return folders.find((f) => f.id === selection)?.name ?? ''
  }, [selection, folders, isSearching, search])

  const defaultFolderId = selection === 'all' || selection === 'top' ? null : selection

  const openBookmark = async (b: Bookmark): Promise<void> => {
    await window.api.openExternal(b.url)
  }

  const saveBookmark = async (input: BookmarkInput): Promise<void> => {
    if (bookmarkModal?.mode === 'edit') {
      await window.api.updateBookmark(bookmarkModal.bookmark.id, input)
    } else {
      await window.api.createBookmark(input)
    }
    await reload()
  }

  const deleteBookmark = async (id: string): Promise<void> => {
    await window.api.deleteBookmark(id)
    await reload()
  }

  const reorderBookmarks = async (list: Bookmark[]): Promise<void> => {
    const newOrders = list.map((b, i) => ({ id: b.id, displayOrder: i }))
    setBookmarks((prev) =>
      prev.map((b) => {
        const o = newOrders.find((n) => n.id === b.id)
        return o ? { ...b, displayOrder: o.displayOrder } : b
      })
    )
    await window.api.reorderBookmarks(newOrders)
  }

  const saveFolder = async (name: string): Promise<void> => {
    if (folderModal?.mode === 'edit') {
      await window.api.updateFolder(folderModal.folder.id, { name })
    } else {
      const created = await window.api.createFolder({ name })
      setSelection(created.id)
    }
    await reload()
  }

  const deleteFolder = async (folder: Folder): Promise<void> => {
    const count = counts[folder.id] ?? 0
    const msg =
      count > 0
        ? `フォルダ「${folder.name}」を削除しますか? 中の ${count} 件のブックマークはトップに移動します。`
        : `フォルダ「${folder.name}」を削除しますか?`
    if (!confirm(msg)) return
    await window.api.deleteFolder(folder.id)
    if (selection === folder.id) setSelection('all')
    await reload()
  }

  const reorderFolders = async (list: Folder[]): Promise<void> => {
    const newOrders = list.map((f, i) => ({ id: f.id, displayOrder: i }))
    setFolders(list.map((f, i) => ({ ...f, displayOrder: i })))
    await window.api.reorderFolders(newOrders)
  }

  const exportData = async (): Promise<void> => {
    try {
      const path = await window.api.exportToFile()
      if (path) alert(`エクスポートしました:\n${path}`)
    } catch (e) {
      alert('エクスポートに失敗しました: ' + (e as Error).message)
    }
  }

  const runImport = async (mode: 'replace' | 'merge'): Promise<void> => {
    try {
      const result = await window.api.importFromFile(mode)
      if (result) {
        const lines = [
          'インポートしました',
          `フォルダ: ${result.folders} 件 (同名は既存に合流)`,
          `ブックマーク: ${result.bookmarks} 件追加`
        ]
        if (mode === 'merge' && result.skipped > 0) {
          lines.push(`URL 重複でスキップ: ${result.skipped} 件`)
        }
        alert(lines.join('\n'))
        await reload()
      }
    } catch (e) {
      alert('インポートに失敗しました: ' + (e as Error).message)
    }
  }

  return (
    <div className="app">
      <Sidebar
        folders={folders}
        counts={counts}
        totalCount={bookmarks.length}
        topCount={topCount}
        selection={selection}
        onSelect={setSelection}
        onCreateFolder={() => setFolderModal({ mode: 'create' })}
        onEditFolder={(f) => setFolderModal({ mode: 'edit', folder: f })}
        onDeleteFolder={deleteFolder}
        onReorder={reorderFolders}
        onExport={exportData}
        onImport={() => setImportOpen(true)}
      />
      <main className="main">
        <div className="main__header">
          <h1 className="main__title">{currentTitle}</h1>
          <div className="main__actions">
            <div className="search">
              <input
                className="search__input"
                placeholder="検索 (名前・URL・メモ)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="search__clear"
                  onClick={() => setSearch('')}
                  title="クリア"
                >
                  <IconClose />
                </button>
              )}
            </div>
            <button
              className="btn btn--primary"
              onClick={() => setBookmarkModal({ mode: 'create' })}
            >
              <IconPlus />
              追加
            </button>
          </div>
        </div>
        <div className="main__body">
          <BookmarkList
            bookmarks={visibleBookmarks}
            onOpen={openBookmark}
            onEdit={(b) => setBookmarkModal({ mode: 'edit', bookmark: b })}
            onReorder={reorderBookmarks}
          />
        </div>
      </main>

      {bookmarkModal && (
        <BookmarkModal
          mode={bookmarkModal.mode}
          bookmark={bookmarkModal.mode === 'edit' ? bookmarkModal.bookmark : undefined}
          folders={folders}
          defaultFolderId={defaultFolderId}
          onSave={saveBookmark}
          onDelete={
            bookmarkModal.mode === 'edit'
              ? () => deleteBookmark(bookmarkModal.bookmark.id)
              : undefined
          }
          onClose={() => setBookmarkModal(null)}
        />
      )}
      {folderModal && (
        <FolderModal
          mode={folderModal.mode}
          initialName={folderModal.mode === 'edit' ? folderModal.folder.name : ''}
          onSave={saveFolder}
          onClose={() => setFolderModal(null)}
        />
      )}
      {importOpen && (
        <ImportModal onChoose={runImport} onClose={() => setImportOpen(false)} />
      )}
    </div>
  )
}

export default App
