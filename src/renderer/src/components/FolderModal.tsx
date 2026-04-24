import { useState, type JSX } from 'react'
import { Modal } from './Modal'

interface Props {
  mode: 'create' | 'edit'
  initialName?: string
  onSave: (name: string) => Promise<void>
  onClose: () => void
}

export function FolderModal({ mode, initialName, onSave, onClose }: Props): JSX.Element {
  const [name, setName] = useState(initialName ?? '')
  const [saving, setSaving] = useState(false)

  const save = async (): Promise<void> => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave(name)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={mode === 'create' ? 'フォルダを追加' : 'フォルダ名を変更'}
      onClose={onClose}
      footer={
        <>
          <div />
          <div className="modal__footer-right">
            <button className="btn" onClick={onClose}>
              キャンセル
            </button>
            <button
              className="btn btn--primary"
              onClick={save}
              disabled={saving || !name.trim()}
            >
              保存
            </button>
          </div>
        </>
      }
    >
      <div className="field">
        <label className="field__label">フォルダ名</label>
        <input
          className="field__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
          }}
          autoFocus
        />
      </div>
    </Modal>
  )
}
