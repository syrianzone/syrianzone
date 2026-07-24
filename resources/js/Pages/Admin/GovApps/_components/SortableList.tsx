import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { Card } from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import { GripVertical, Save, Smartphone, Globe } from 'lucide-react';
import { GovAppData } from './AppDialog';

interface SortableListProps {
    items: GovAppData[];
}

export default function SortableList({ items: initialItems }: SortableListProps) {
    const [items, setItems] = useState(initialItems);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newItems = [...items];
        const draggedItem = newItems[draggedIndex];
        newItems.splice(draggedIndex, 1);
        newItems.splice(index, 0, draggedItem);

        setDraggedIndex(index);
        setItems(newItems);
        setHasChanges(true);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const handleSaveOrder = () => {
        setSaving(true);
        const payload = items.map((item, idx) => ({
            id: item.id,
            order_column: idx + 1,
        }));

        router.post('/api/v1/admin/govapps/reorder', { orders: payload }, {
            onSuccess: () => {
                setSaving(false);
                setHasChanges(false);
            },
            onError: () => setSaving(false),
        });
    };

    return (
        <div className="space-y-4" dir="rtl">
            <div className="flex items-center justify-between bg-muted/40 p-4 rounded-xl border">
                <div>
                    <h3 className="font-bold text-sm">إعادة ترتيب التطبيقات الحكومية (Drag & Drop)</h3>
                    <p className="text-xs text-muted-foreground">اسحب العنصر من مقبض السحب لتغيير ترتيب ظهوره للعموم.</p>
                </div>
                {hasChanges && (
                    <Button onClick={handleSaveOrder} disabled={saving} size="sm" className="gap-1.5 font-bold">
                        <Save className="w-4 h-4" />
                        <span>{saving ? 'جاري الحفظ...' : 'حفظ الترتيب الجديد'}</span>
                    </Button>
                )}
            </div>

            <div className="space-y-2">
                {items.map((item, index) => (
                    <Card
                        key={item.id}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`p-3 transition-all cursor-move border flex items-center justify-between bg-card ${draggedIndex === index ? 'opacity-50 border-primary border-dashed' : 'hover:border-primary/50'}`}
                    >
                        <div className="flex items-center gap-3">
                            <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted flex items-center justify-center flex-shrink-0 border">
                                <img
                                    src={item.icon || 'https://pub-1d51b625c56e4fd085c58a79672e1b15.r2.dev/govapps/mofa/icon.webp'}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://pub-1d51b625c56e4fd085c58a79672e1b15.r2.dev/govapps/mofa/icon.webp';
                                    }}
                                />
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm text-foreground">{item.name_ar || item.name}</h4>
                                <span className="text-xs text-muted-foreground">{item.id}</span>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
