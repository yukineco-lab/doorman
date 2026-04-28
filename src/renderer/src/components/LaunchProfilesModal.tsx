import { useEffect, useState, type JSX } from 'react'
import type { LaunchProfile } from '@shared/types'
import { Modal } from './Modal'
import { IconEdit, IconPlus, IconTrash } from './Icons'

interface Props {
  onClose: () => void
  onChanged: () => void
}

export function LaunchProfilesModal({ onClose, onChanged }: Props): JSX.Element {
  const [profiles, setProfiles] = useState<LaunchProfile[]>([])
  const [editing, setEditing] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; profile: LaunchProfile }
    | null
  >(null)

  const reload = async (): Promise<void> => {
    setProfiles(await window.api.listLaunchProfiles())
  }

  useEffect(() => {
    reload()
  }, [])

  const remove = async (p: LaunchProfile): Promise<void> => {
    if (!confirm(`プロファイル「${p.name}」を削除しますか?\n紐付くブックマークは「既定のブラウザ」に戻ります。`))
      return
    await window.api.deleteLaunchProfile(p.id)
    await reload()
    onChanged()
  }

  if (editing) {
    return (
      <ProfileEditor
        mode={editing.mode}
        profile={editing.mode === 'edit' ? editing.profile : undefined}
        onSaved={async () => {
          setEditing(null)
          await reload()
          onChanged()
        }}
        onCancel={() => setEditing(null)}
        onClose={onClose}
      />
    )
  }

  return (
    <Modal
      title="起動プロファイル"
      onClose={onClose}
      footer={
        <>
          <div />
          <div className="modal__footer-right">
            <button className="btn" onClick={onClose}>
              閉じる
            </button>
            <button
              className="btn btn--primary"
              onClick={() => setEditing({ mode: 'create' })}
            >
              <IconPlus />
              追加
            </button>
          </div>
        </>
      }
    >
      {profiles.length === 0 ? (
        <div className="empty" style={{ padding: '24px 0' }}>
          <div className="empty__title">プロファイル未登録</div>
          <div>
            「追加」から、ブラウザの実行ファイルパスと引数（例:{' '}
            <code>--profile-directory=Default</code>）を登録してください。
          </div>
        </div>
      ) : (
        <div className="profile-list">
          {profiles.map((p) => (
            <div key={p.id} className="profile-row">
              <div className="profile-row__main">
                <div className="profile-row__name">{p.name}</div>
                <div className="profile-row__exec" title={p.execPath}>
                  {p.execPath}
                </div>
                {p.args.length > 0 && (
                  <div className="profile-row__args">{p.args.join(' ')}</div>
                )}
              </div>
              <div className="profile-row__actions">
                <button
                  className="btn btn--ghost"
                  onClick={() => setEditing({ mode: 'edit', profile: p })}
                  title="編集"
                >
                  <IconEdit />
                </button>
                <button
                  className="btn btn--ghost"
                  onClick={() => remove(p)}
                  title="削除"
                >
                  <IconTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="field__hint">
        例: Chrome のプロファイル切替には{' '}
        <code>--profile-directory=Profile 8</code>{' '}
        のような引数を 1 行で指定してください。
      </div>
    </Modal>
  )
}

interface EditorProps {
  mode: 'create' | 'edit'
  profile?: LaunchProfile
  onSaved: () => Promise<void>
  onCancel: () => void
  onClose: () => void
}

function ProfileEditor({
  mode,
  profile,
  onSaved,
  onCancel,
  onClose
}: EditorProps): JSX.Element {
  const [name, setName] = useState(profile?.name ?? '')
  const [execPath, setExecPath] = useState(profile?.execPath ?? '')
  const [argsText, setArgsText] = useState((profile?.args ?? []).join('\n'))
  const [saving, setSaving] = useState(false)

  const pickExe = async (): Promise<void> => {
    const p = await window.api.pickExecutable()
    if (p) setExecPath(p)
  }

  const save = async (): Promise<void> => {
    if (!name.trim() || !execPath.trim()) return
    const args = argsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    setSaving(true)
    try {
      if (mode === 'edit' && profile) {
        await window.api.updateLaunchProfile(profile.id, { name, execPath, args })
      } else {
        await window.api.createLaunchProfile({ name, execPath, args })
      }
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={mode === 'create' ? '起動プロファイルを追加' : '起動プロファイルを編集'}
      onClose={onClose}
      footer={
        <>
          <div />
          <div className="modal__footer-right">
            <button className="btn" onClick={onCancel}>
              戻る
            </button>
            <button
              className="btn btn--primary"
              onClick={save}
              disabled={saving || !name.trim() || !execPath.trim()}
            >
              保存
            </button>
          </div>
        </>
      }
    >
      <div className="field">
        <label className="field__label">表示名</label>
        <input
          className="field__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: Chrome - 個人"
          autoFocus
        />
      </div>
      <div className="field">
        <label className="field__label">実行ファイルパス</label>
        <div className="field__row">
          <input
            className="field__input"
            value={execPath}
            onChange={(e) => setExecPath(e.target.value)}
            placeholder="C:\Program Files\Google\Chrome\Application\chrome.exe"
          />
          <button type="button" className="btn" onClick={pickExe}>
            参照
          </button>
        </div>
      </div>
      <div className="field">
        <label className="field__label">引数（1 行 1 引数 / URL は自動で末尾に追加）</label>
        <textarea
          className="field__textarea"
          value={argsText}
          onChange={(e) => setArgsText(e.target.value)}
          placeholder={'--profile-directory=Default'}
        />
        <div className="field__hint">
          例: <code>--profile-directory=Profile 8</code>{' '}
          を 1 行に書く（クォートは不要です）
        </div>
      </div>
    </Modal>
  )
}
