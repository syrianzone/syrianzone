"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect, useRef } from "react"
import { useDir } from "./dir-context"

const i18n = {
  rtl: {
    title: "نظام تصميم الهوية البصرية السورية",
    desc: "مكتبة عناصر واجهة مستخدم مبنية على الهوية البصرية السورية. قابلة للتخصيص والتوسيع.",
    viewComponents: "تصفّح العناصر",
  },
  ltr: {
    title: "Syrian Identity Design System",
    desc: "A component library built on the Syrian Visual Identity. Customizable, extensible, and open source.",
    viewComponents: "View Components",
  },
}

function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    setMounted(true)
    setIsDark(document.documentElement.getAttribute("data-theme")?.includes("dark") ?? false)
  }, [])
  if (!mounted) return null

  const toggle = () => {
    const next = isDark ? "light" : "dark"
    document.documentElement.setAttribute("data-theme", next)
    localStorage.setItem("sz-theme", next)
    setIsDark(!isDark)
  }

  return (
    <button
      onClick={toggle}
      className="rounded-md border p-2 transition-colors"
      style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
    >
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
      )}
    </button>
  )
}

function DirToggle() {
  const { dir, setDir } = useDir()
  return (
    <button
      onClick={() => setDir(dir === "rtl" ? "ltr" : "rtl")}
      className="rounded-md border p-2 transition-colors hover:bg-[var(--accent)]/50 text-sm font-medium"
      style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
    >
      {dir === "rtl" ? "EN" : "عربي"}
    </button>
  )
}

function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animId: number
    const dpr = window.devicePixelRatio || 1

    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = window.innerWidth + "px"
      canvas.style.height = window.innerHeight + "px"
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener("resize", resize)

    const isDark = document.documentElement.getAttribute("data-theme")?.includes("dark") ?? false
    const primary = { r: 66, g: 129, b: 119 }
    const accent = { r: 185, g: 167, b: 121 }

    const spacing = 50
    const cols = Math.ceil(window.innerWidth / spacing) + 2
    const rows = Math.ceil(window.innerHeight / spacing) + 2

    const loop = (time: number) => {
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const t = time * 0.001

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * spacing
          const y = row * spacing
          const cx = w / 2
          const cy = h / 2
          const dist = Math.hypot(x - cx, y - cy)
          const maxDist = Math.hypot(cx, cy)
          const wave = Math.sin(dist * 0.015 - t * 1.5) * 0.5 + 0.5
          const wave2 = Math.sin(dist * 0.008 - t * 0.8 + 2) * 0.5 + 0.5
          const combined = wave * 0.6 + wave2 * 0.4
          const edgeFade = 1 - Math.pow(dist / maxDist, 1.5)
          const alpha = combined * edgeFade * (isDark ? 0.4 : 0.3)
          const radius = 1.5 + combined * 2
          const c = {
            r: Math.round(primary.r + (accent.r - primary.r) * wave2),
            g: Math.round(primary.g + (accent.g - primary.g) * wave2),
            b: Math.round(primary.b + (accent.b - primary.b) * wave2),
          }
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`
          ctx.fill()
        }
      }

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * spacing
          const y = row * spacing
          const cx = w / 2
          const cy = h / 2
          const dist = Math.hypot(x - cx, y - cy)
          const maxDist = Math.hypot(cx, cy)
          const wave = Math.sin(dist * 0.015 - t * 1.5) * 0.5 + 0.5
          const edgeFade = 1 - Math.pow(dist / maxDist, 1.5)
          if (wave > 0.6 && edgeFade > 0.2) {
            const lineAlpha = (wave - 0.6) * 2.5 * edgeFade * (isDark ? 0.2 : 0.12)
            ctx.strokeStyle = `rgba(${primary.r},${primary.g},${primary.b},${lineAlpha})`
            ctx.lineWidth = 0.5
            if (col < cols - 1) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + spacing, y); ctx.stroke() }
            if (row < rows - 1) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + spacing); ctx.stroke() }
          }
        }
      }

      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
    }
  }, [mounted])

  if (!mounted) return null

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0"
      aria-hidden
    />
  )
}

export default function SycnHome() {
  const { dir } = useDir()
  const t = i18n[dir]

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <AnimatedBackground />
      <header className="sticky top-0 z-50 w-full border-fade-b" style={{ backgroundColor: "hsl(var(--background))", opacity: 0.95 }}>
        <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/sycn" className="text-xl font-bold">
            sycn
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DirToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        <section className="flex flex-col items-center justify-center gap-4 sm:gap-6 py-12 sm:py-20 md:py-28 lg:py-36 px-4 sm:px-6 text-center">
          <Image src="/sycn/emblem.svg" alt="sycn" width={120} height={120} className="mb-2 w-20 h-20 sm:w-[120px] sm:h-[120px]" />
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl max-w-3xl">
            {t.title}
          </h1>
          <p className="text-base sm:text-lg max-w-[600px] sm:text-xl" style={{ color: "hsl(var(--muted-foreground))" }}>
            {t.desc}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full sm:w-auto px-4 sm:px-0">
            <Link
              href="/sycn/components/button"
              className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium shadow transition-colors"
              style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            >
              {t.viewComponents}
            </Link>
            <a
              href="https://github.com/syrianzone/syrianzone"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border px-6 py-3 text-sm font-medium shadow-sm transition-colors"
              style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
              GitHub
            </a>
          </div>
        </section>
      </main>

      <footer className="relative z-10 py-6 text-center text-sm" style={{ color: "hsl(var(--muted-foreground))", backgroundImage: "linear-gradient(to right, transparent, hsl(var(--border)) 15%, hsl(var(--border)) 85%, transparent)", backgroundSize: "100% 1px", backgroundRepeat: "no-repeat", backgroundPosition: "top" }}>
        {dir === "rtl" ? (
          <>
            © {new Date().getFullYear()} نظام تصميم الهوية البصرية السورية - تم تطويرها بواسطة{" "}
            <a href="https://x.com/macdoos" target="_blank" rel="noopener noreferrer" className="underline transition-colors" style={{ color: "hsl(var(--muted-foreground))" }}>
              مكدوس
            </a>
          </>
        ) : (
          <>
            © {new Date().getFullYear()} sycn. Developed by{" "}
            <a href="https://x.com/macdoos" target="_blank" rel="noopener noreferrer" className="underline transition-colors" style={{ color: "hsl(var(--muted-foreground))" }}>
              @macdoos
            </a>
          </>
        )}
      </footer>
    </div>
  )
}
