"use client"
import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/sycn/dialog"
import { Button } from "@/components/sycn/button"
import { useT } from "@/app/sycn/i18n"

export default function DialogPage() {
  const { t } = useT()
  return (
    <div className="space-y-6">
      <DocHeader title="Dialog" component="dialog" />
      <InstallCommand command="npx shadcn@latest add dialog" />
      <h2 className="text-2xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{t("open")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("dialogTitle")}</DialogTitle>
              <DialogDescription>{t("dialogDesc")}</DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{t("dialogContent")}</p>
          </DialogContent>
        </Dialog>
      </ComponentPreview>
    </div>
  )
}
