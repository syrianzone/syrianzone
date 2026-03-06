"use client"
import { useT } from "@/app/sycn/i18n"
import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/sycn/context-menu"

export default function ContextMenuPage() {
  const { t } = useT()
  return (
    <div className="space-y-6">
      <DocHeader title="Context Menu" component="context-menu" />
      <InstallCommand command="npx shadcn@latest add context-menu" />
      <h2 className="text-2xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <ContextMenu>
          <ContextMenuTrigger className="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
            {t("rightClickHere")}
          </ContextMenuTrigger>
          <ContextMenuContent className="w-64">
            <ContextMenuItem>{t("back")}</ContextMenuItem>
            <ContextMenuItem>{t("forward")}</ContextMenuItem>
            <ContextMenuItem>{t("reload")}</ContextMenuItem>
            <ContextMenuItem>{t("saveAs")}</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </ComponentPreview>
    </div>
  )
}
