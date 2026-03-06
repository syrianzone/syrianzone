"use client"

import { DocHeader } from "@/components/sycn/docs/doc-header"
import { ComponentPreview } from "@/components/sycn/docs/component-preview"
import { InstallCommand } from "@/components/sycn/docs/install-command"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/sycn/avatar"
import { useT } from "@/app/sycn/i18n"

export default function AvatarPage() {
  const { t } = useT()
  return (
    <div className="space-y-8">
      <DocHeader title="Avatar" component="avatar" />
      <InstallCommand name="avatar" />
      <h2 className="text-xl font-semibold">{t("usage")}</h2>
      <ComponentPreview code={`import { Avatar, AvatarImage, AvatarFallback } from "@/components/sycn/avatar"\n\n<Avatar>\n  <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />\n  <AvatarFallback>CN</AvatarFallback>\n</Avatar>`}>
        <div className="flex gap-4">
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>AB</AvatarFallback>
          </Avatar>
        </div>
      </ComponentPreview>
    </div>
  )
}
