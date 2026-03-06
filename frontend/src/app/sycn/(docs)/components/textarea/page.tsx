"use client"

import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Textarea } from "@/components/sycn/textarea"
import { useT } from "@/app/sycn/i18n"

export default function TextareaPage() {
  const { t } = useT()
  return (
    <div className="space-y-8">
      <DocHeader title="Textarea" component="textarea" />
      <InstallCommand name="textarea" />
      <h2 className="text-xl font-semibold">{t("usage")}</h2>
      <ComponentPreview code={`import { Textarea } from "@/components/sycn/textarea"\n\n<Textarea />`}>
        <Textarea />
      </ComponentPreview>
      <h2 className="text-xl font-semibold">{t("variants")}</h2>
      <ComponentPreview code={`<Textarea placeholder="Type your message here." />`}>
        <Textarea placeholder={t("placeholder")} className="max-w-sm" />
      </ComponentPreview>
    </div>
  )
}
