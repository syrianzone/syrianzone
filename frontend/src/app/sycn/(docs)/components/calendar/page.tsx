"use client"
import { useState } from "react"
import { useT } from "@/app/sycn/i18n"
import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Calendar } from "@/components/sycn/calendar"

export default function CalendarPage() {
  const { t } = useT()
  const [date, setDate] = useState<Date | undefined>(new Date())

  return (
    <div className="space-y-6">
      <DocHeader title="Calendar" component="calendar" />
      <InstallCommand command="npx shadcn@latest add calendar" />
      <h2 className="text-2xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <Calendar
          selected={date}
          onSelect={setDate}
          className="rounded-md border"
        />
      </ComponentPreview>
    </div>
  )
}
