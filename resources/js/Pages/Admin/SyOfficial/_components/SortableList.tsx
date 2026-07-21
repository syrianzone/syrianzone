import React, { useState } from 'react';
import { ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import axios from 'axios';

export interface SortableItem {
    id: string;
    label: string;
    subtitle?: string;
    image?: string;
}

interface SortableListProps {
    items: SortableItem[];
    endpoint: string; // e.g. '/api/v1/admin/syofficial/reorder/categories'
    onSaveSuccess?: () => void;
}

export default function SortableList({ items: initialItems, endpoint, onSaveSuccess }: SortableListProps) {
    const [items, setItems] = useState<SortableItem[]>(initialItems);
    const [saving, setSaving] = useState(false);

    const moveItem = (index: number, direction: 'up' | 'down') => {
        const newItems = [...items];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newItems.length) return;

        const temp = newItems[index];
        newItems[index] = newItems[targetIndex];
        newItems[targetIndex] = temp;
        setItems(newItems);
    };

    const handleSaveOrder = async () => {
        setSaving(true);
        try {
            const orders = items.map((item, index) => ({
                id: item.id,
                order_column: index + 1,
            }));
            await axios.post(endpoint, { orders });
            if (onSaveSuccess) onSaveSuccess();
        } catch (e) {
            console.error('Failed to save order', e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-3" dir="rtl">
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-muted-foreground">استخدم أسهم الترتيب لتغيير تسلسل العرض</span>
                <Button size="sm" onClick={handleSaveOrder} disabled={saving}>
                    {saving ? 'جاري الحفظ...' : 'حفظ الترتيب الجديد'}
                </Button>
            </div>

            <div className="space-y-2">
                {items.map((item, idx) => (
                    <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-border bg-card shadow-2xs hover:border-primary/40 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <GripVertical className="w-5 h-5 text-muted-foreground/50 cursor-grab" />
                            {item.image && (
                                <img
                                    src={item.image.startsWith('http') || item.image.startsWith('/') ? item.image : `/syofficial-assets/${item.image}`}
                                    alt=""
                                    className="w-8 h-8 rounded-lg object-cover bg-muted"
                                />
                            )}
                            <div>
                                <h4 className="font-semibold text-sm text-foreground">{item.label}</h4>
                                {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                disabled={idx === 0}
                                onClick={() => moveItem(idx, 'up')}
                            >
                                <ArrowUp className="w-4 h-4" />
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                disabled={idx === items.length - 1}
                                onClick={() => moveItem(idx, 'down')}
                            >
                                <ArrowDown className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
