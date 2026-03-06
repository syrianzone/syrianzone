"use client"
import { useT } from "@/app/sycn/i18n"
import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/sycn/tabs"

export default function TabsPage() {
  const { t } = useT()
  return (
    <div className="space-y-6">
      <DocHeader title="Tabs" component="tabs" />
      <InstallCommand command="npx shadcn@latest add tabs" />
      <h2 className="text-2xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <Tabs defaultValue="account" className="w-[400px]">
          <TabsList>
            <TabsTrigger value="account">{t("tab1")}</TabsTrigger>
            <TabsTrigger value="password">{t("tab2")}</TabsTrigger>
            <TabsTrigger value="settings">{t("tab3")}</TabsTrigger>
          </TabsList>
          <TabsContent value="account" className="p-4 text-sm">{t("content1")}</TabsContent>
          <TabsContent value="password" className="p-4 text-sm">{t("content2")}</TabsContent>
          <TabsContent value="settings" className="p-4 text-sm">{t("content3")}</TabsContent>
        </Tabs>
      </ComponentPreview>
    </div>
  )
}
