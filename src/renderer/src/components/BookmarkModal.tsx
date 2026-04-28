import { useState, type JSX } from 'react'
import type {
  Bookmark,
  BookmarkInput,
  Folder,
  IconChange,
  LaunchProfile
} from '@shared/types'
import { Modal } from './Modal'
import { BookmarkIcon } from './BookmarkIcon'

interface Props {
  mode: 'create' | 'edit'
  bookmark?: Bookmark
  folders: Folder[]
  launchProfiles: LaunchProfile[]
  defaultFolderId: string | null
  onSave: (input: BookmarkInput) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

export function BookmarkModal({
  mode,
  bookmark,
  folders,
  launchProfiles,
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
  const [launchProfileId, setLaunchProfileId] = useState<string | null>(
    bookmark?.launchProfileId ?? null
  )
  const [iconFilename, setIconFilename] = useState<string | null>(bookmark?.iconFilename ?? null)
  const [pendingIcon, setPendingIcon] = useState<
    | { kind: 'file'; path: string; preview: string }
    | { kind: 'dataUrl'; dataUrl: string }
    | null
  >(null)
  const [iconRemoved, setIconRemoved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchMsg, setFetchMsg] = useState<string | null>(null)

  const pickIcon = async (): Promise<void> => {
    const r = await window.api.pickIconFile()
    if (r) {
      setPendingIcon({ kind: 'file', path: r.path, preview: r.dataUrl })
      setIconRemoved(false)
    }
  }

  const removeIcon = (): void => {
    setPendingIcon(null)
    setIconFilename(null)
    setIconRemoved(true)
  }

  const fetchMeta = async (): Promise<void> => {
    if (!url.trim()) return
    setFetching(true)
    setFetchMsg(null)
    try {
      const meta = await window.api.fetchPageMeta(url.trim())
      let applied: string[] = []
      if (meta.title && !name.trim()) {
        setName(meta.title)
        applied.push('タイトル')
      }
      if (meta.iconDataUrl && !pendingIcon && !iconFilename) {
        setPendingIcon({ kind: 'dataUrl', dataUrl: meta.iconDataUrl })
        setIconRemoved(false)
        applied.push('アイコン')
      }
      if (applied.length === 0) {
        if (!meta.title && !meta.iconDataUrl) {
          setFetchMsg('情報を取得できませんでした')
        } else {
          setFetchMsg('既存の値があるためスキップしました')
        }
      } else {
        setFetchMsg(`${applied.join(' / ')} を取得しました`)
      }
    } catch (err) {
      setFetchMsg('取得に失敗しました')
      console.error(err)
    } finally {
      setFetching(false)
    }
  }

  const save = async (): Promise<void> => {
    if (!name.trim() || !url.trim()) return
    setSaving(true)
    try {
      let iconChange: IconChange = { kind: 'keep' }
      if (pendingIcon?.kind === 'file') {
        iconChange = { kind: 'file', path: pendingIcon.path }
      } else if (pendingIcon?.kind === 'dataUrl') {
        iconChange = { kind: 'dataUrl', dataUrl: pendingIcon.dataUrl }
      } else if (iconRemoved) {
        iconChange = { kind: 'remove' }
      }
      await onSave({
        folderId,
        name,
        url,
        memo,
        iconChange,
        launchProfileId
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const previewIconFilename = pendingIcon ? null : iconFilename
  const pendingPreviewSrc =
    pendingIcon?.kind === 'file' ? pendingIcon.preview : pendingIcon?.dataUrl ?? null

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
        <div className="field__row">
          <input
            className="field__input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            autoFocus
          />
          <button
            type="button"
            className="btn"
            onClick={fetchMeta}
            disabled={fetching || !url.trim()}
            title="ページからタイトルとアイコンを取得"
          >
            {fetching ? '取得中…' : 'URL から取得'}
          </button>
        </div>
        {fetchMsg && <div className="field__hint">{fetchMsg}</div>}
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
            {pendingPreviewSrc ? (
              <img src={pendingPreviewSrc} alt="" />
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
            {(pendingIcon || iconFilename) && (
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
        <label className="field__label">起動方法</label>
        <select
          className="field__select"
          value={launchProfileId ?? ''}
          onChange={(e) =>
            setLaunchProfileId(e.target.value === '' ? null : e.target.value)
          }
        >
          <option value="">既定のブラウザ</option>
          {launchProfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {launchProfiles.length === 0 && (
          <div className="field__hint">
            起動プロファイルはサイドバー下部の「起動プロファイル」から登録できます
          </div>
        )}
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
