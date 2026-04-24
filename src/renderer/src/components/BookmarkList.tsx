import type { JSX } from 'react'
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
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Bookmark } from '@shared/types'
import { BookmarkIcon } from './BookmarkIcon'
import { IconEdit } from './Icons'

interface Props {
  bookmarks: Bookmark[]
  onOpen: (b: Bookmark) => void
  onEdit: (b: Bookmark) => void
  onReorder: (b: Bookmark[]) => void
}

export function BookmarkList({ bookmarks, onOpen, onEdit, onReorder }: Props): JSX.Element {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleDragEnd = (ev: DragEndEvent): void => {
    const { active, over } = ev
    if (!over || active.id === over.id) return
    const oldIndex = bookmarks.findIndex((b) => b.id === active.id)
    const newIndex = bookmarks.findIndex((b) => b.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(bookmarks, oldIndex, newIndex))
  }

  if (bookmarks.length === 0) {
    return (
      <div className="empty">
        <div className="empty__title">ブックマークがありません</div>
        <div>右上の「追加」から登録してください。</div>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={bookmarks.map((b) => b.id)} strategy={rectSortingStrategy}>
        <div className="bookmark-grid">
          {bookmarks.map((b) => (
            <SortableCard key={b.id} bookmark={b} onOpen={onOpen} onEdit={onEdit} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

interface CardProps {
  bookmark: Bookmark
  onOpen: (b: Bookmark) => void
  onEdit: (b: Bookmark) => void
}

function SortableCard({ bookmark, onOpen, onEdit }: CardProps): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bookmark.id
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bookmark-card${isDragging ? ' dragging' : ''}`}
      onClick={() => onOpen(bookmark)}
      {...attributes}
      {...listeners}
    >
      <span className="bookmark-card__icon">
        <BookmarkIcon filename={bookmark.iconFilename} />
      </span>
      <div className="bookmark-card__body">
        <div className="bookmark-card__name">{bookmark.name}</div>
        <div className="bookmark-card__url">{bookmark.url}</div>
      </div>
      <button
        className="bookmark-card__edit"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onEdit(bookmark)
        }}
        title="編集"
      >
        <IconEdit />
      </button>
    </div>
  )
}
