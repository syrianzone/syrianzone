"use client"
import { useT } from "@/app/sycn/i18n"
import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"

export default function SidebarPage() {
  const { t } = useT()
  return (
    <div className="space-y-6">
      <DocHeader title="Sidebar" component="sidebar" />
      <InstallCommand command="npx shadcn@latest add sidebar" />
      <h2 className="text-2xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <div className="flex h-[200px] w-[400px] items-center justify-center rounded-md border border-dashed">
          <p className="text-sm text-muted-foreground">{t("sidebarNote")}</p>
        </div>
      </ComponentPreview>
    </div>
  )
}
