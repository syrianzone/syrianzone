import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/Lib/utils"

interface AccordionItemContextProps {
  value: string
  open: boolean
  toggle: () => void
}

const AccordionItemContext = React.createContext<AccordionItemContextProps | null>(null)

export type AccordionType = "single" | "multiple"

interface AccordionBaseProps {
  defaultValue?: string | string[]
  value?: string | string[]
  children: React.ReactNode
  className?: string
}

/**
 * A closing accordion keeps one panel open at a time and reports a string; a
 * multiple one lets several open at once and reports the array, so the callback
 * a caller writes is checked against the mode it asked for.
 */
type AccordionProps =
  | (AccordionBaseProps & { type?: "single"; onValueChange?: (value: string) => void })
  | (AccordionBaseProps & { type: "multiple"; onValueChange?: (value: string[]) => void })

/**
 * The open items after one is clicked: `single` replaces the open panel,
 * `multiple` toggles the clicked one and keeps its siblings open.
 */
export function nextSelection(type: AccordionType, open: readonly string[], value: string): string[] {
  if (open.includes(value)) return open.filter((entry) => entry !== value)
  return type === "multiple" ? [...open, value] : [value]
}

export function Accordion(props: AccordionProps) {
  const { defaultValue, value: valueProp, children, className } = props
  const [selectedValues, setSelectedValues] = React.useState<string[]>(() => {
    if (Array.isArray(valueProp)) return valueProp
    if (typeof valueProp === "string") return [valueProp]
    if (Array.isArray(defaultValue)) return defaultValue
    if (typeof defaultValue === "string") return [defaultValue]
    return []
  })

  React.useEffect(() => {
    if (Array.isArray(valueProp)) setSelectedValues(valueProp)
    else if (typeof valueProp === "string") setSelectedValues([valueProp])
  }, [valueProp])

  const toggleItem = (val: string) => {
    const next = nextSelection(props.type ?? "single", selectedValues, val)
    setSelectedValues(next)
    if (props.type === "multiple") props.onValueChange?.(next)
    else props.onValueChange?.(next[0] || "")
  }

  return (
    <div className={cn("space-y-2", className)}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement<{ value?: string }>(child)) return null
        const itemValue = child.props.value ?? ""
        const isOpen = selectedValues.includes(itemValue)
        return (
          <AccordionItemContext.Provider
            value={{ value: itemValue, open: isOpen, toggle: () => toggleItem(itemValue) }}
          >
            {child}
          </AccordionItemContext.Provider>
        )
      })}
    </div>
  )
}

export function AccordionItem({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const ctx = React.useContext(AccordionItemContext)
  const isOpen = ctx?.open ?? false

  // Native <details>: collapsed content stays in the DOM (find-in-page, in-page
  // anchors) and the browser expands it natively when a match is inside. The
  // `open` attribute is rendered from React state so controlled usage keeps
  // working; `toggle` reports back. React also flips the attribute when the
  // group closes this item, which fires `toggle` too — ignore any event whose
  // DOM state already agrees with React state so the two never feed each other.
  const handleToggle = (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (!ctx) return
    if (event.currentTarget.open === ctx.open) return
    ctx.toggle()
  }

  return (
    <details
      open={isOpen}
      onToggle={handleToggle}
      className={cn(
        "rounded-xl border border-border bg-card shadow-xs transition-all duration-200 overflow-hidden",
        isOpen && "border-primary/40 ring-1 ring-primary/20",
        className
      )}
    >
      {children}
    </details>
  )
}

export function AccordionTrigger({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ctx = React.useContext(AccordionItemContext)
  if (!ctx) return null

  // <summary> is the native trigger: it is focusable, Enter/Space work, and it
  // exposes expanded state itself, so no aria-expanded/aria-controls here.
  return (
    <summary
      className={cn(
        "flex w-full cursor-pointer list-none items-center justify-between px-3.5 py-3 text-start text-sm font-semibold text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">{children}</div>
      <ChevronDown
        aria-hidden="true"
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ms-2",
          ctx.open && "rotate-180 text-primary"
        )}
      />
    </summary>
  )
}

export function AccordionContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ctx = React.useContext(AccordionItemContext)
  if (!ctx) return null

  // Always rendered: <details> hides it while closed, but keeps it in the DOM.
  return (
    <div className={cn("px-3.5 pb-3.5 pt-1 text-xs leading-relaxed text-muted-foreground border-t border-border/40 animate-in fade-in-50 duration-200 space-y-3", className)}>
      {children}
    </div>
  )
}
