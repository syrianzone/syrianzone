'use client'
import { Link } from '@inertiajs/react'
import { useAuth } from '@/Contexts/AuthContext'
import { useTransitTheme } from './TransitThemeContext'
import { Bus, PlusCircle, Sun, Moon, Menu } from 'lucide-react'

export function TransitHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTransitTheme()

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-full items-center justify-between px-4">
        <button
          onClick={onMenuClick}
          className="sm:hidden p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
          aria-label="فتح القائمة"
        >
          <Menu className="h-6 w-6" />
        </button>

        <Link
          href="/transit"
          className="flex items-center gap-2 font-bold text-[var(--gold)] hover:opacity-80 transition-opacity"
          aria-label="ترانزيت - الصفحة الرئيسية"
        >
          <Bus className="h-5 w-5" />
          <span className="hidden sm:inline">ترانزيت</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            aria-label={theme === 'jasmine' ? 'الوضع الداكن' : 'الوضع الفاتح'}
            title={theme === 'jasmine' ? 'الوضع الداكن' : 'الوضع الفاتح'}
          >
            {theme === 'jasmine' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>

          {user && (
            <Link
              href="/transit/studio"
              className="flex items-center gap-1.5 rounded-lg bg-[var(--gold)] px-3 py-1.5 text-sm font-bold text-[var(--bg)] hover:bg-[var(--gold)]/90 transition-colors"
              title="إضافة مسار جديد"
            >
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">إضافة مسار</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}