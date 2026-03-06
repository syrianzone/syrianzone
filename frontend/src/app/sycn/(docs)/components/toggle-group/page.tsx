"use client"

import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { ToggleGroup, ToggleGroupItem } from "@/components/sycn/toggle-group"
import { useT } from "@/app/sycn/i18n"

export default function ToggleGroupPage() {
  const { t } = useT()
  return (
    <div className="space-y-8">
      <DocHeader title="Toggle Group" component="toggle-group" />
      <InstallCommand name="toggle-group" />
      <h2 className="text-xl font-semibold">{t("usage")}</h2>
      <ComponentPreview code={`import { ToggleGroup, ToggleGroupItem } from "@/components/sycn/toggle-group"\n\n<ToggleGroup type="multiple">\n  <ToggleGroupItem value="bold">Bold</ToggleGroupItem>\n  <ToggleGroupItem value="italic">Italic</ToggleGroupItem>\n  <ToggleGroupItem value="underline">Underline</ToggleGroupItem>\n</ToggleGroup>`}>
        <ToggleGroup type="multiple">
          <ToggleGroupItem value="bold">{t("bold")}</ToggleGroupItem>
          <ToggleGroupItem value="italic">{t("italic")}</ToggleGroupItem>
          <ToggleGroupItem value="underline">{t("underline")}</ToggleGroupItem>
        </ToggleGroup>
      </ComponentPreview>
    </div>
  )
}
