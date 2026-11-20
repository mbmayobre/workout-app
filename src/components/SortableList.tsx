/**
 * A vertical list whose items can be reordered by dragging a handle.
 *
 * Built on the dnd-kit library, which handles mouse, touch, and keyboard.
 * Each item gets a grip handle (⋮⋮); only the handle starts a drag, so
 * scrolling the page with your thumb still works normally everywhere else.
 *
 * Keyboard: focus a handle, press Space to pick the item up, use the arrow
 * keys to move it, Space again to drop, or Escape to cancel.
 *
 * Usage:
 *
 *   <SortableList
 *     ids={picks.map((pick) => pick.exerciseId)}
 *     onMove={(from, to) => movePick(day.id, from, to)}
 *     renderItem={(id, handle) => <Row>{handle} …</Row>}
 *   />
 *
 * `ids` must be unique. `onMove` receives positions in the `ids` array.
 */
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cx } from './ui'

/** Keeps a dragged item in its column: it can move up and down, not sideways. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/** `items` with the entry at `from` moved to `to`. */
function moved<T>(items: T[], from: number, to: number): T[] {
  const result = [...items]
  const [item] = result.splice(from, 1)
  result.splice(to, 0, item)
  return result
}

export function SortableList({
  ids,
  onMove,
  renderItem,
}: {
  ids: string[]
  onMove: (from: number, to: number) => void
  /** Draw one item. Put `handle` where the grip should appear. */
  renderItem: (id: string, handle: ReactNode) => ReactNode
}) {
  const sensors = useSensors(
    // A small movement threshold, so tapping the handle does not count as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Show the new order the instant an item is dropped. The saved order
  // arrives from the database a moment later; without this, the item would
  // briefly jump back to where it started. When `ids` changes (the save
  // landed, or something else changed the list), the saved order wins.
  const key = ids.join('|')
  const [shown, setShown] = useState({ key, order: ids })
  if (shown.key !== key) setShown({ key, order: ids })
  const order = shown.key === key ? shown.order : ids

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    setShown({ key, order: moved(order, order.indexOf(String(active.id)), order.indexOf(String(over.id))) })
    onMove(from, to)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[verticalOnly]} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        {/* Own container, so `last:` styles see only the items and not the
            screen-reader helpers dnd-kit adds next to them. */}
        <div>
          {order.map((id) => (
            <SortableItem key={id} id={id} renderItem={renderItem} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableItem({ id, renderItem }: { id: string; renderItem: (id: string, handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      aria-label="Drag to reorder"
      // `touch-none` stops the browser from scrolling the page when a drag
      // starts on the handle; everywhere else, touch scrolls as usual.
      className="-ml-2 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-faint active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical size={18} />
    </button>
  )

  return (
    <div
      ref={setNodeRef}
      // Translate (not Transform) so items never get stretched while moving.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // The divider between items lives here, on the item wrapper. (A Row
      // inside is the wrapper's only child, so its own `last:` rule removes
      // its divider.)
      className={cx(
        'relative border-b border-line bg-page last:border-b-0',
        isDragging && 'z-10 rounded-xl border-b-0 bg-raised shadow-lg',
      )}
    >
      {renderItem(id, handle)}
    </div>
  )
}
