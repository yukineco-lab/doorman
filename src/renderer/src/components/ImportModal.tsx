import { useState, type JSX } from 'react'
import { Modal } from './Modal'

interface Props {
  onChoose: (mode: 'replace' | 'merge') => Promise<void>
  onClose: () => void
}

export function ImportModal({ onChoose, onClose }: Props): JSX.Element {
  const [mode, setMode] = useState<'replace' | 'merge'>('merge')
  const [running, setRunning] = useState(false)

  const proceed = async (): Promise<void> => {
    if (
      mode === 'replace' &&
      !confirm(
        '既存のフォルダ・ブックマーク・アイコンをすべて削除して置き換えます。よろしいですか?'
      )
    ) {
      return
    }
    setRunning(true)
    try {
      await onChoose(mode)
      onClose()
    } finally {
      setRunning(false)
    }
  }

  return (
    <Modal
      title="インポート"
      onClose={onClose}
      footer={
        <>
          <div />
          <div className="modal__footer-right">
            <button className="btn" onClick={onClose}>
              キャンセル
            </button>
            <button className="btn btn--primary" onClick={proceed} disabled={running}>
              ファイルを選択
            </button>
          </div>
        </>
      }
    >
      <div className="field">
        <label className="field__label">取り込み方法</label>
        <label className="radio">
          <input
            type="radio"
            name="import-mode"
            value="merge"
            checked={mode === 'merge'}
            onChange={() => setMode('merge')}
          />
          <span>
            <strong>追加 (merge)</strong>
            <small>既存データを残し、インポート分を新規 ID で追加します</small>
          </span>
        </label>
        <label className="radio">
          <input
            type="radio"
            name="import-mode"
            value="replace"
            checked={mode === 'replace'}
            onChange={() => setMode('replace')}
          />
          <span>
            <strong>置き換え (replace)</strong>
            <small>既存のフォルダ・ブックマーク・アイコンをすべて削除します</small>
          </span>
        </label>
      </div>
      <div className="field__hint">
        ※ アイコン画像はエクスポート JSON に内包されているため、JSON
        ファイル単体でデータを持ち運べます。
      </div>
    </Modal>
  )
}
