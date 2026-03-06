"use client"
import { useT } from "@/app/sycn/i18n"
import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/sycn/command"

export default function CommandPage() {
  const { t } = useT()
  return (
    <div className="space-y-6">
      <DocHeader title="Command" component="command" />
      <InstallCommand command="npx shadcn@latest add command" />
      <h2 className="text-2xl font-semibold">{t("usage")}</h2>
      <ComponentPreview>
        <Command className="rounded-lg border shadow-md w-[400px]">
          <CommandInput placeholder={t("search")} />
          <CommandList>
            <CommandEmpty>{t("loading")}</CommandEmpty>
            <CommandGroup heading={t("components")}>
              <CommandItem>{t("settings")}</CommandItem>
              <CommandItem>{t("profile")}</CommandItem>
              <CommandItem>{t("notifications")}</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </ComponentPreview>
    </div>
  )
}
