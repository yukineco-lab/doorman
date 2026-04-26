import { useState, type JSX } from 'react'
import type { Bookmark, BookmarkInput, Folder } from '@shared/types'
import { Modal } from './Modal'
import { BookmarkIcon } from './BookmarkIcon'

interface Props {
  mode: 'create' | 'edit'
  bookmark?: Bookmark
  folders: Folder[]
  defaultFolderId: string | null
  onSave: (input: BookmarkInput) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

export function BookmarkModal({
  mode,
  bookmark,
  folders,
  defaultFolderId,
  onSave,
  onDelete,
  onClose
}: Props): JSX.Element {
  const [name, setName] = useState(bookmark?.name ?? '')
  const [url, setUrl] = useState(bookmark?.url ?? '')
  const [memo, setMemo] = useState(bookmark?.memo ?? '')
  const [folderId, setFolderId] = useState<string | null>(
    bookmark ? bookmark.folderId : defaultFolderId
  )
  const [iconFilename, setIconFilename] = useState<string | null>(bookmark?.iconFilename ?? null)
  const [newIconPath, setNewIconPath] = useState<string | null>(null)
  const [newIconPreview, setNewIconPreview] = useState<string | null>(null)
  const [iconRemoved, setIconRemoved] = useState(false)
  const [saving, setSaving] = useState(false)

  const pickIcon = async (): Promise<void> => {
    const r = await window.api.pickIconFile()
    if (r) {
      setNewIconPath(r.path)
      setNewIconPreview(r.dataUrl)
      setIconRemoved(false)
    }
  }

  const removeIcon = (): void => {
    setNewIconPath(null)
    setNewIconPreview(null)
    setIconFilename(null)
    setIconRemoved(true)
  }

  const save = async (): Promise<void> => {
    if (!name.trim() || !url.trim()) return
    setSaving(true)
    try {
      const input: BookmarkInput = {
        folderId,
        name,
        url,
        memo,
        iconSourcePath: newIconPath ?? (iconRemoved ? null : undefined)
      }
      await onSave(input)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const previewIconFilename = newIconPath ? null : iconFilename

  return (
    <Modal
      title={mode === 'create' ? 'ブックマークを追加' : 'ブックマークを編集'}
      onClose={onClose}
      footer={
        <>
          <div>
            {mode === 'edit' && onDelete && (
              <button
                className="btn btn--danger"
                onClick={async () => {
                  if (confirm('このブックマークを削除しますか?')) {
                    await onDelete()
                    onClose()
                  }
                }}
              >
                削除
              </button>
            )}
          </div>
          <div className="modal__footer-right">
            <button className="btn" onClick={onClose}>
              キャンセル
            </button>
            <button
              className="btn btn--primary"
              onClick={save}
              disabled={saving || !name.trim() || !url.trim()}
            >
              保存
            </button>
          </div>
        </>
      }
    >
      <div className="field">
        <label className="field__label">URL</label>
        <input
          className="field__input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          autoFocus
        />
      </div>

      <div className="field">
        <label className="field__label">略称</label>
        <input
          className="field__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: GitHub"
        />
      </div>

      <div className="field">
        <label className="field__label">アイコン</label>
        <div className="icon-picker">
          <div className="icon-picker__preview">
            {newIconPreview ? (
              <img src={newIconPreview} alt="" />
            ) : (
              <BookmarkIcon
                filename={previewIconFilename}
                version={bookmark?.iconMtime}
              />
            )}
          </div>
          <div className="icon-picker__actions">
            <button type="button" className="btn" onClick={pickIcon}>
              画像を選択
            </button>
            {(newIconPath || iconFilename) && (
              <button type="button" className="btn btn--ghost" onClick={removeIcon}>
                アイコンを削除
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="field">
        <label className="field__label">フォルダ</label>
        <select
          className="field__select"
          value={folderId ?? ''}
          onChange={(e) => setFolderId(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">（トップ）</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field__label">メモ</label>
        <textarea
          className="field__textarea"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>
    </Modal>
  )
}
