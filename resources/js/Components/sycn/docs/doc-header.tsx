"use client"

import { useT } from "@/app/sycn/i18n"

export function DocHeader({
  title,
  description,
  component,
}: {
  title: string
  description?: string
  component?: string
}) {
  const { desc, title: getTitle } = useT()
  const resolvedDesc = component ? desc(component) : description || ""
  const resolvedTitle = component ? getTitle(component) : title

  return (
    <div className="space-y-2">
      <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">{resolvedTitle}</h1>
      <p className="text-lg text-muted-foreground">{resolvedDesc}</p>
    </div>
  )
}
