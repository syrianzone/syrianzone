"use client"

import { useState, useEffect } from "react"

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const [dir, setDir] = useState("rtl")

  useEffect(() => {
    const check = () => setDir(document.documentElement.dir || "rtl")
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["dir"] })
    return () => observer.disconnect()
  }, [])

  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isRtl = dir === "rtl"

  return (
    <button
      onClick={copy}
      className="absolute top-2 end-2 px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-white transition-colors"
    >
      {copied ? (isRtl ? "تم!" : "Copied!") : (isRtl ? "نسخ" : "Copy")}
    </button>
  )
}
