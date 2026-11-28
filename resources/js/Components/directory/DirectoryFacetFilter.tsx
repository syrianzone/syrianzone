import { useState } from 'react';
import { Check, PlusCircle, X } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/Components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/Components/ui/command';
import { Separator } from '@/Components/ui/separator';
import { cn } from '@/Lib/utils';
import type { DirectoryFacetOption } from './useDirectory';

interface DirectoryFacetFilterProps {
    label: string;
    options: readonly DirectoryFacetOption[];
    value: readonly string[];
    onChange: (next: string[]) => void;
    multiple?: boolean;
    className?: string;
}

/**
 * Shadcn DataTable faceted filter popover (RTL-native, flat, zero shadows).
 * Replaces multi-row pill walls on directories with many categories.
 */
export function DirectoryFacetFilter({
    label,
    options,
    value,
    onChange,
    multiple = false,
    className,
}: DirectoryFacetFilterProps) {
    const [open, setOpen] = useState(false);

    const selectedOptions = options.filter((o) => value.includes(o.value));

    const toggle = (optionValue: string) => {
        if (!multiple) {
            onChange(value.includes(optionValue) ? [] : [optionValue]);
            setOpen(false);
            return;
        }
        onChange(
            value.includes(optionValue)
                ? value.filter((v) => v !== optionValue)
                : [...value, optionValue],
        );
    };

    return (
        <div className={cn('flex items-center gap-1.5', className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 border-dashed bg-card px-3 font-medium shadow-none hover:bg-accent"
                    >
                        <PlusCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        <span>{label}</span>
                        {selectedOptions.length > 0 && (
                            <>
                                <Separator orientation="vertical" className="mx-1 h-4" />
                                <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold text-primary">
                                    {selectedOptions.length === 1
                                        ? selectedOptions[0].label
                                        : `${selectedOptions.length} محدد`}
                                </span>
                            </>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-0">
                    <Command>
                        <CommandInput placeholder={`ابحث في ${label}...`} className="h-9 text-sm" />
                        <CommandList className="max-h-64">
                            <CommandEmpty>لا توجد نتائج.</CommandEmpty>
                            <CommandGroup>
                                {options.map((option) => {
                                    const active = value.includes(option.value);
                                    return (
                                        <CommandItem
                                            key={option.value}
                                            value={option.label}
                                            onSelect={() => toggle(option.value)}
                                            className="flex cursor-pointer items-center gap-2"
                                        >
                                            <span
                                                aria-hidden="true"
                                                className={cn(
                                                    'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                                                    active
                                                        ? 'border-primary bg-primary text-primary-foreground'
                                                        : 'border-input bg-background',
                                                )}
                                            >
                                                {active && <Check className="h-3 w-3" />}
                                            </span>
                                            <span className="truncate text-sm">{option.label}</span>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                            {value.length > 0 && (
                                <>
                                    <Separator />
                                    <CommandGroup>
                                        <CommandItem
                                            onSelect={() => {
                                                onChange([]);
                                                setOpen(false);
                                            }}
                                            className="justify-center text-center text-xs font-medium text-muted-foreground"
                                        >
                                            مسح التصفية
                                        </CommandItem>
                                    </CommandGroup>
                                </>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {value.length > 0 && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange([])}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                    <span>مسح</span>
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
            )}
        </div>
    );
}
