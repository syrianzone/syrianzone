"use client"
import { useT } from "@/app/sycn/i18n"
import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/sycn/alert-dialog"
import { Button } from "@/components/sycn/button"

export default function AlertDialogPage() {
  const { t } = useT()
  return (
    <div className="space-y-6">
      <DocHeader title="Alert Dialog" component="alert-dialog" />
      <InstallCommand command="npx shadcn@latest add alert-dialog" />
      <h2 className="text-2xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">{t("delete")}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("areYouSure")}</AlertDialogTitle>
              <AlertDialogDescription>{t("cannotBeUndone")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction>{t("continue")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ComponentPreview>
    </div>
  )
}
