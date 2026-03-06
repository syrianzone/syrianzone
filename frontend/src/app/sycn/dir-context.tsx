"use client"

import { createContext, useContext, useState, useEffect } from "react"

type Dir = "rtl" | "ltr"

const DirContext = createContext<{ dir: Dir; setDir: (d: Dir) => void }>({
  dir: "rtl",
  setDir: () => {},
})

export const useDir = () => useContext(DirContext)

export function DirProvider({ children }: { children: React.ReactNode }) {
  const [dir, setDirState] = useState<Dir>("rtl")

  useEffect(() => {
    const saved = localStorage.getItem("dir") as Dir | null
    if (saved === "ltr" || saved === "rtl") {
      setDirState(saved)
      document.documentElement.dir = saved
      document.documentElement.lang = saved === "rtl" ? "ar" : "en"
    }
  }, [])

  const setDir = (d: Dir) => {
    setDirState(d)
    localStorage.setItem("dir", d)
    document.documentElement.dir = d
    document.documentElement.lang = d === "rtl" ? "ar" : "en"
  }

  return (
    <DirContext.Provider value={{ dir, setDir }}>
      {children}
    </DirContext.Provider>
  )
}
