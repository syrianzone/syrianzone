"use client"
import { useT } from "@/app/sycn/i18n"
import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/sycn/dropdown-menu"
import { Button } from "@/components/sycn/button"

export default function DropdownMenuPage() {
  const { t } = useT()
  return (
    <div className="space-y-6">
      <DocHeader title="Dropdown Menu" component="dropdown-menu" />
      <InstallCommand command="npx shadcn@latest add dropdown-menu" />
      <h2 className="text-2xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">{t("open")}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>{t("myAccount")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{t("profile")}</DropdownMenuItem>
            <DropdownMenuItem>{t("settings")}</DropdownMenuItem>
            <DropdownMenuItem>{t("billing")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{t("logOut")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ComponentPreview>
    </div>
  )
}
