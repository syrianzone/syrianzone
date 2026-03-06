"use client"

import { useEffect } from "react"
import { DirProvider } from "./dir-context"
import "./sycn.css"

export default function SycnLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Hide the main site navbar when inside sycn
    const navbar = document.querySelector("body > header, body > div > header") as HTMLElement | null
    if (navbar) navbar.style.display = "none"
    return () => {
      if (navbar) navbar.style.display = ""
    }
  }, [])

  return (
    <DirProvider>
      <div className="sycn-scope">
        {children}
      </div>
    </DirProvider>
  )
}
