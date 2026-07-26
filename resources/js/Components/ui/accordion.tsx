import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface AccordionItemContextProps {
  value: string
  open: boolean
  toggle: () => void
}

const AccordionItemContext = React.createContext<AccordionItemContextProps | null>(null)

interface AccordionProps {
  type?: "single" | "multiple"
  defaultValue?: string | string[]
  value?: string | string[]
  onValueChange?: (value: any) => void
  children: React.ReactNode
  className?: string
}

export function Accordion({
  defaultValue,
  value: valueProp,
  onValueChange,
  children,
  className,
}: AccordionProps) {
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
    let next: string[]
    if (selectedValues.includes(val)) {
      next = selectedValues.filter((v) => v !== val)
    } else {
      next = [val]
    }
    setSelectedValues(next)
    onValueChange?.(next[0] || "")
  }

  return (
    <div className={cn("space-y-2", className)}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null
        const itemValue = (child.props as any).value as string
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

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-xs transition-all duration-200 overflow-hidden",
        isOpen && "border-primary/40 ring-1 ring-primary/20",
        className
      )}
    >
      {children}
    </div>
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

  return (
    <button
      type="button"
      onClick={ctx.toggle}
      className={cn(
        "flex w-full items-center justify-between px-3.5 py-3 text-right text-sm font-semibold text-foreground transition-colors hover:bg-muted/50 focus:outline-none",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">{children}</div>
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ms-2",
          ctx.open && "rotate-180 text-primary"
        )}
      />
    </button>
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
  if (!ctx || !ctx.open) return null

  return (
    <div className={cn("px-3.5 pb-3.5 pt-1 text-xs leading-relaxed text-muted-foreground border-t border-border/40 animate-in fade-in-50 duration-200 space-y-3", className)}>
      {children}
    </div>
  )
}
