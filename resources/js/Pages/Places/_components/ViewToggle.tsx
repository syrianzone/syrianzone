import { LayoutGrid, Map as MapIcon } from 'lucide-react';

export function ViewToggle(props: { view: 'map' | 'grid'; onChange: (v: 'map' | 'grid') => void }) {
  const { view, onChange } = props;

  const item = (value: 'map' | 'grid', label: string, Icon: typeof MapIcon) => (
    <button
      type="button"
      aria-pressed={view === value}
      onClick={() => onChange(value)}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors ${
        view === value
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  return (
    <div dir="rtl" className="flex justify-center">
      <div className="flex gap-1 rounded-full border border-border bg-card/90 p-1 shadow-sm">
        {item('map', 'خريطة', MapIcon)}
        {item('grid', 'معرض', LayoutGrid)}
      </div>
    </div>
  );
}
