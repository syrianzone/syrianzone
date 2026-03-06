"use client"

import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Label } from "@/components/sycn/label"
import { Input } from "@/components/sycn/input"
import { useT } from "@/app/sycn/i18n"

export default function LabelPage() {
  const { t } = useT()
  return (
    <div className="space-y-8">
      <DocHeader title="Label" component="label" />
      <InstallCommand name="label" />
      <h2 className="text-xl font-semibold">{t("usage")}</h2>
      <ComponentPreview code={`import { Label } from "@/components/sycn/label"\nimport { Input } from "@/components/sycn/input"\n\n<Label htmlFor="email">Email</Label>\n<Input id="email" placeholder="Email" />`}>
        <div className="grid w-full max-w-sm gap-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" placeholder={t("email")} />
        </div>
      </ComponentPreview>
    </div>
  )
}
