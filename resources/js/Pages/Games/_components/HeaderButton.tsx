import React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: React.ComponentType<{ className?: string }>;
  /** A pressed/on look, for toggles like "أرقام" and "تركيز". */
  active?: boolean;
};

/**
 * One button in a game's header strip — the shape "القوانين" uses (icon and
 * label on one line), so the rules button, the focus toggle, and whatever a game
 * portals in all read as a single set. Forwards its ref so Radix can wrap it in
 * a `DialogTrigger asChild`.
 */
const HeaderButton = React.forwardRef<HTMLButtonElement, Props>(function HeaderButton(
  { icon: Icon, active, className = '', children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors disabled:pointer-events-none disabled:opacity-40 ${
        active
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      } ${className}`}
      {...props}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
});

export default HeaderButton;
