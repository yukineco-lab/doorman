import { useState, type JSX } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Folder } from '@shared/types'
import { IconFolder, IconPlus, IconStar, IconInbox, IconEdit, IconTrash } from './Icons'

export type SelectionKey = 'all' | 'top' | string

interface Props {
  folders: Folder[]
  counts: Record<string, number>
  totalCount: number
  topCount: number
  selection: SelectionKey
  onSelect: (key: SelectionKey) => void
  onCreateFolder: () => void
  onEditFolder: (folder: Folder) => void
  onDeleteFolder: (folder: Folder) => void
  onReorder: (folders: Folder[]) => void
  onExport: () => void
  onImport: () => void
}

export function Sidebar({
  folders,
  counts,
  totalCount,
  topCount,
  selection,
  onSelect,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onReorder,
  onExport,
  onImport
}: Props): JSX.Element {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = (ev: DragEndEvent): void => {
    const { active, over } = ev
    if (!over || active.id === over.id) return
    const oldIndex = folders.findIndex((f) => f.id === active.id)
    const newIndex = folders.findIndex((f) => f.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(folders, oldIndex, newIndex))
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <span className="sidebar__title">フォルダ</span>
        <button className="sidebar__add" onClick={onCreateFolder} title="フォルダを追加">
          <IconPlus />
        </button>
      </div>
      <div className="sidebar__list">
        <StaticItem
          icon={<IconStar />}
          label="すべて"
          count={totalCount}
          active={selection === 'all'}
          onClick={() => onSelect('all')}
        />
        <StaticItem
          icon={<IconInbox />}
          label="トップ"
          count={topCount}
          active={selection === 'top'}
          onClick={() => onSelect('top')}
        />
        <div style={{ height: 8 }} />
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={folders.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            {folders.map((f) => (
              <SortableFolder
                key={f.id}
                folder={f}
                count={counts[f.id] ?? 0}
                active={selection === f.id}
                onSelect={() => onSelect(f.id)}
                onEdit={() => onEditFolder(f)}
                onDelete={() => onDeleteFolder(f)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <div className="sidebar__footer">
        <button className="btn btn--ghost" onClick={onExport} title="JSON ファイルにエクスポート">
          エクスポート
        </button>
        <button className="btn btn--ghost" onClick={onImport} title="JSON ファイルからインポート">
          インポート
        </button>
      </div>
    </aside>
  )
}

interface StaticItemProps {
  icon: JSX.Element
  label: string
  count: number
  active: boolean
  onClick: () => void
}

function StaticItem({ icon, label, count, active, onClick }: StaticItemProps): JSX.Element {
  return (
    <div
      className={`folder-item${active ? ' folder-item--active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <span className="folder-item__icon">{icon}</span>
      <span className="folder-item__name">{label}</span>
      <span className="folder-item__count">{count}</span>
    </div>
  )
}

interface SortableFolderProps {
  folder: Folder
  count: number
  active: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

function SortableFolder({
  folder,
  count,
  active,
  onSelect,
  onEdit,
  onDelete
}: SortableFolderProps): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folder.id
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }
  const [hovering, setHovering] = useState(false)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`folder-item${active ? ' folder-item--active' : ''}${isDragging ? ' dragging' : ''}`}
      onClick={onSelect}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      {...attributes}
      {...listeners}
    >
      <span className="folder-item__icon">
        <IconFolder />
      </span>
      <span className="folder-item__name">{folder.name}</span>
      {hovering ? (
        <span className="folder-item__actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="folder-item__btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            title="名前を変更"
          >
            <IconEdit />
          </button>
          <button
            className="folder-item__btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            title="削除"
          >
            <IconTrash />
          </button>
        </span>
      ) : (
        <span className="folder-item__count">{count}</span>
      )}
    </div>
  )
}
