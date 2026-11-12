import { useEffect, useState } from 'react';
import axios from '@/Lib/axios';
import { Button } from '@/Components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/Components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/Components/ui/command';
import { Badge } from '@/Components/ui/badge';
import { ChevronsUpDown, Loader2 } from 'lucide-react';
import SpeakerAvatar from './SpeakerAvatar';
import { PENDING_SPEAKER_LABEL, SPEAKER_SOURCE_LABEL } from './status';
import type { SpeakerOption } from './types';

interface Props {
    /** `/api/v1/promises/speakers` (public) or the admin search endpoint. */
    endpoint: string;
    value: SpeakerOption | null;
    onChange: (speaker: SpeakerOption) => void;
    id?: string;
    invalid?: boolean;
    describedBy?: string;
}

/**
 * Searches every list of people the site already has (approved speakers,
 * tier-list officials, officials-directory people, People's Assembly members)
 * in one box. Picking someone not yet linked creates the link server-side on
 * save, so nobody is typed twice.
 */
export default function SpeakerPicker({ endpoint, value, onChange, id, invalid, describedBy }: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState<SpeakerOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            setLoading(true);
            setFailed(false);
            try {
                const res = await axios.get(endpoint, { params: { q: query } });
                if (!cancelled) setOptions(res.data.speakers ?? []);
            } catch {
                if (!cancelled) {
                    setOptions([]);
                    setFailed(true);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 250);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [endpoint, query, open]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    className="h-auto min-h-10 w-full justify-between gap-2 py-2 font-normal"
                >
                    {value ? (
                        <span className="flex min-w-0 items-center gap-2">
                            <SpeakerAvatar name={value.name} image={value.image} size={28} />
                            <span className="min-w-0 text-start">
                                <span className="block truncate font-medium">{value.name}</span>
                                {value.title && <span className="block truncate text-xs text-muted-foreground">{value.title}</span>}
                            </span>
                        </span>
                    ) : (
                        <span className="text-muted-foreground">اختر المسؤول...</span>
                    )}
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0" align="start">
                <Command shouldFilter={false} dir="rtl">
                    <CommandInput placeholder="ابحث بالاسم..." value={query} onValueChange={setQuery} aria-label="ابحث عن المسؤول بالاسم" />
                    <CommandList>
                        {loading && (
                            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />جارٍ البحث...
                            </div>
                        )}
                        {!loading && failed && (
                            <p role="alert" className="py-4 text-center text-sm text-destructive">تعذّر البحث، حاول مجدداً بعد قليل.</p>
                        )}
                        {!loading && !failed && <CommandEmpty>لا نتائج. جرّب جزءاً من الاسم.</CommandEmpty>}
                        {!loading && options.length > 0 && (
                            <CommandGroup>
                                {options.map((o) => (
                                    <CommandItem
                                        key={o.ref}
                                        value={o.ref}
                                        onSelect={() => {
                                            onChange(o);
                                            setOpen(false);
                                        }}
                                        className="gap-2"
                                    >
                                        <SpeakerAvatar name={o.name} image={o.image} size={28} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate">{o.name}</span>
                                            {o.title && <span className="block truncate text-xs text-muted-foreground">{o.title}</span>}
                                        </span>
                                        {o.pending ? (
                                            <Badge variant="outline" className="text-[10px]">{PENDING_SPEAKER_LABEL}</Badge>
                                        ) : (
                                            <span className="shrink-0 text-[10px] text-muted-foreground">{SPEAKER_SOURCE_LABEL[o.source]}</span>
                                        )}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
