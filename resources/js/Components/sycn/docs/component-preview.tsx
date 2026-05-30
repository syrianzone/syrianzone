"use client"

import { useState, useEffect, ReactNode } from "react"

export function ComponentPreview({
  children,
  code,
}: {
  children: ReactNode
  code?: string
}) {
  const [tab, setTab] = useState<"preview" | "code">("preview")
  const [dir, setDir] = useState("rtl")

  useEffect(() => {
    const check = () => setDir(document.documentElement.dir || "rtl")
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["dir"] })
    return () => observer.disconnect()
  }, [])

  const isRtl = dir === "rtl"

  return (
    <div className="border rounded-lg overflow-hidden">
      {code && (
        <div className="flex border-b">
          <button
            onClick={() => setTab("preview")}
            className={`px-4 py-2 text-sm font-medium ${
              tab === "preview" ? "border-b-2 border-primary" : ""
            }`}
          >
            {isRtl ? "معاينة" : "Preview"}
          </button>
          <button
            onClick={() => setTab("code")}
            className={`px-4 py-2 text-sm font-medium ${
              tab === "code" ? "border-b-2 border-primary" : ""
            }`}
          >
            {isRtl ? "الكود" : "Code"}
          </button>
        </div>
      )}
      {tab === "preview" || !code ? (
        <div className="flex items-center justify-center p-8 bg-background">
          {children}
        </div>
      ) : (
        <pre className="bg-[#1e1e1e] text-[#d4d4d4] overflow-x-auto p-4 text-sm font-mono">
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}
