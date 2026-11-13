import { useState } from 'react';
import { router } from '@inertiajs/react';
import {
    DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { notify } from '@/Lib/notify';

export interface SortableListItem {
    id: string;
    label: string;
    subtitle?: string;
    /** A ready-to-use image URL; the caller formats it. */
    image?: string;
}

interface Props {
    items: SortableListItem[];
    /** The module's reorder route; the payload is `{ orders: [{ id, order_column }] }`. */
    endpoint: string;
    /** Whether the viewer holds the module's reorder capability. */
    canReorder?: boolean;
    /** The capability id named in the read-only hint. */
    capability: string;
    /** Runs after a successful save (a page that has to refetch). */
    onSaved?: () => void;
}

/**
 * Reorder a directory resource's rows. Dragging works with a pointer and with
 * the keyboard (space to pick up, arrows to move, space to drop); the arrow
 * buttons are the same operation without a drag affordance.
 */
export default function SortableList({ items: initialItems, endpoint, canReorder = true, capability, onSaved }: Props) {
    const [items, setItems] = useState<SortableListItem[]>(initialItems);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const move = (from: number, to: number) => {
        if (!canReorder) return;
        if (to < 0 || to >= items.length) return;
        setItems(arrayMove(items, from, to));
        setHasChanges(true);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        move(items.findIndex((item) => item.id === active.id), items.findIndex((item) => item.id === over.id));
    };

    const save = () => {
        if (!canReorder) return;
        setSaving(true);
        router.post(endpoint, {
            orders: items.map((item, index) => ({ id: item.id, order_column: index + 1 })),
        }, {
            onSuccess: () => {
                setHasChanges(false);
                notify.success('تم حفظ الترتيب الجديد');
                onSaved?.();
            },
            onError: () => notify.error('تعذّر حفظ الترتيب'),
            onFinish: () => setSaving(false),
        });
    };

    return (
        <div className="space-y-4" dir="rtl">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">
                    {canReorder
                        ? 'اسحب العنصر أو استخدم الأسهم لتغيير ترتيب ظهوره.'
                        : `يحتاج تغيير الترتيب صلاحية ${capability}`}
                </p>
                {canReorder && hasChanges && (
                    <Button type="button" size="sm" onClick={save} disabled={saving} className="gap-1.5 font-bold">
                        {saving ? 'جاري الحفظ...' : 'حفظ الترتيب الجديد'}
                    </Button>
                )}
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                        {items.map((item, index) => (
                            <SortableRow
                                key={item.id}
                                item={item}
                                index={index}
                                count={items.length}
                                canReorder={canReorder}
                                onMove={move}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );
}

function SortableRow({ item, index, count, canReorder, onMove }: {
    item: SortableListItem;
    index: number;
    count: number;
    canReorder: boolean;
    onMove: (from: number, to: number) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !canReorder });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 shadow-2xs ${isDragging ? 'opacity-60' : ''}`}
        >
            <div className="flex min-w-0 items-center gap-3">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`إعادة ترتيب ${item.label}`}
                    title="إعادة الترتيب"
                    disabled={!canReorder}
                    className="h-8 w-8 shrink-0 cursor-grab touch-none text-muted-foreground/60"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-5 w-5" aria-hidden="true" />
                </Button>
                {item.image && (
                    <img src={item.image} alt="" className="h-8 w-8 shrink-0 rounded-lg bg-muted object-cover" />
                )}
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
                    {item.subtitle && <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>}
                </div>
            </div>

            {canReorder && (
                <div className="flex shrink-0 items-center gap-1">
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`تحريك ${item.label} للأعلى`}
                        title="تحريك للأعلى"
                        className="h-8 w-8"
                        disabled={index === 0}
                        onClick={() => onMove(index, index - 1)}
                    >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`تحريك ${item.label} للأسفل`}
                        title="تحريك للأسفل"
                        className="h-8 w-8"
                        disabled={index === count - 1}
                        onClick={() => onMove(index, index + 1)}
                    >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </div>
            )}
        </div>
    );
}
