"use client"

import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Switch } from "@/components/sycn/switch"
import { Label } from "@/components/sycn/label"
import { useT } from "@/app/sycn/i18n"

export default function SwitchPage() {
  const { t } = useT()
  return (
    <div className="space-y-8">
      <DocHeader title="Switch" component="switch" />
      <InstallCommand name="switch" />
      <h2 className="text-xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <div className="flex items-center gap-2">
          <Switch id="airplane-mode" />
          <Label htmlFor="airplane-mode">{t("notifications")}</Label>
        </div>
      </ComponentPreview>
      <h2 className="text-xl font-semibold">{t("checked")}</h2>
      <ComponentPreview>
        <div className="flex items-center gap-2">
          <Switch id="checked-switch" defaultChecked />
          <Label htmlFor="checked-switch">{t("checked")}</Label>
        </div>
      </ComponentPreview>
    </div>
  )
}
