"use client"
import { useT } from "@/app/sycn/i18n"
import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from "@/components/sycn/menubar"

export default function MenubarPage() {
  const { t } = useT()
  return (
    <div className="space-y-6">
      <DocHeader title="Menubar" component="menubar" />
      <InstallCommand command="npx shadcn@latest add menubar" />
      <h2 className="text-2xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>{t("file")}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>{t("newFile")}</MenubarItem>
              <MenubarItem>{t("open")}</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>{t("save")}</MenubarItem>
              <MenubarItem>{t("exit")}</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>{t("edit")}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>{t("undo")}</MenubarItem>
              <MenubarItem>{t("redo")}</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>{t("cut")}</MenubarItem>
              <MenubarItem>{t("copy")}</MenubarItem>
              <MenubarItem>{t("paste")}</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>{t("view")}</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>{t("zoomIn")}</MenubarItem>
              <MenubarItem>{t("zoomOut")}</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>{t("fullscreen")}</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </ComponentPreview>
    </div>
  )
}
