"use client"

import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Separator } from "@/components/sycn/separator"
import { useT } from "@/app/sycn/i18n"

export default function SeparatorPage() {
  const { t } = useT()
  return (
    <div className="space-y-8">
      <DocHeader title="Separator" component="separator" />
      <InstallCommand name="separator" />
      <h2 className="text-xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <div className="max-w-sm">
          <div className="space-y-1">
            <h4 className="text-sm font-medium leading-none">{t("profile")}</h4>
            <p className="text-sm text-muted-foreground">{t("makeChanges")}</p>
          </div>
          <Separator className="my-4" />
          <div className="space-y-1">
            <h4 className="text-sm font-medium leading-none">{t("settings")}</h4>
            <p className="text-sm text-muted-foreground">{t("editProfile")}</p>
          </div>
        </div>
      </ComponentPreview>
      <h2 className="text-xl font-semibold">{t("vertical")}</h2>
      <ComponentPreview>
        <div className="flex h-5 items-center gap-4 text-sm">
          <div>{t("home")}</div>
          <Separator orientation="vertical" />
          <div>{t("docs")}</div>
          <Separator orientation="vertical" />
          <div>{t("settings")}</div>
        </div>
      </ComponentPreview>
    </div>
  )
}
