import React from 'react';
import { Link, usePage } from '@inertiajs/react';
import {
  Grip,
  X,
  ChevronDown,
  Bus,
  Sparkles,
  Shield,
  Bookmark,
  Settings,
  Info,
  BarChart3,
  FileText,
} from 'lucide-react';

import { useAuth } from '@/Contexts/AuthContext';
import { useMuslimNav } from '@/Pages/Muslim/_lib/nav';
import { isDarkTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { navigationMenuTriggerStyle } from '@/components/ui/navigation-menu';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

import UserNav from './UserNav';
import AppearanceMenu from './AppearanceMenu';
import { DesktopSearchTrigger, MobileMenuSearchSection } from './GlobalCommandPalette';
import { useSiteNavigation, type SiteLink } from '@/Lib/siteLinks';

/** Columns for the desktop mega menu, matching the homepage's tile grid. */
const MEGA_GRID = 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9';


/**
 * Icon over label, the home page's borderless app-tile shape. Forwarded as a
 * component so Radix's `asChild` can hand it a ref inside a navigation menu.
 */
const NavTile = React.forwardRef<
  HTMLAnchorElement,
  {
    href: string;
    text: string;
    icon?: React.ComponentType<{ className?: string }>;
    image?: string;
    isFlag?: boolean;
    isActive?: boolean;
    external?: boolean;
    onNavigate?: () => void;
  }
>(function NavTile({ href, text, icon: Icon, image, isFlag, isActive, external, onNavigate, ...rest }, ref) {
  const className =
    'group flex h-full select-none flex-col items-center gap-2 rounded-lg px-1 py-2 text-center no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const body = (
    <>
      {isFlag ? (
        <img
          src="/flag-replacer/1f1f8-1f1fe.svg"
          alt=""
          className="h-12 w-12 shrink-0 object-contain transition-transform group-hover:scale-110"
        />
      ) : image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-12 w-12 shrink-0 object-contain transition-transform group-hover:scale-110"
        />
      ) : Icon ? (
        <Icon
          className={cn(
            'h-12 w-12 shrink-0 transition-all group-hover:scale-110',
            isActive ? 'text-primary' : 'text-foreground group-hover:text-primary',
          )}
        />
      ) : null}
      <span
        className={cn(
          'line-clamp-2 text-xs font-medium leading-tight transition-colors',
          isActive ? 'text-primary' : 'text-foreground group-hover:text-primary',
        )}
      >
        {text}
      </span>
    </>
  );
  if (external) {
    return (
      <a ref={ref} href={href} target="_blank" rel="noreferrer" className={className} {...rest}>
        {body}
      </a>
    );
  }
  return (
    <Link ref={ref} href={href} onClick={onNavigate} className={className} {...rest}>
      {body}
    </Link>
  );
});

/** Columns of borderless tiles; the caller sets the breakpoint columns. */
function TileGrid({ links, pathname, onNavigate, className }: { links: SiteLink[]; pathname: string; onNavigate?: () => void; className?: string }) {
  return (
    <ul className={cn('grid grid-cols-3 gap-1', className)}>
      {links.map(({ id, href, text, icon, image, isFlag, external }) => (
        <li key={id || href}>
          <NavTile
            href={href}
            text={text}
            icon={icon ?? undefined}
            image={image}
            isFlag={isFlag}
            external={external}
            isActive={pathname === href}
            onNavigate={onNavigate}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * The "more" panel, shared by the desktop menu and the transit variant so the
 * two cannot drift apart. A wide mega menu of the site's tools, in the same
 * order as the homepage grid — one flat grid, no sections.
 */
function MorePanel({
  links,
  pathname,
  onNavigate,
  header,
  showAboutLinks,
}: {
  links: SiteLink[];
  pathname: string;
  onNavigate?: () => void;
  header?: React.ReactNode;
  showAboutLinks: boolean;
}) {
  return (
    <div
      id="sz-more-panel"
      role="region"
      aria-label="المزيد من أقسام الموقع"
      className="w-[min(1152px,92vw)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow"
    >
      {header}
      <div className="p-4">
        <TileGrid links={links} pathname={pathname} onNavigate={onNavigate} className={MEGA_GRID} />

        <Separator className="my-4" />
        <div className="flex flex-wrap justify-center gap-4 py-1 text-xs text-muted-foreground">
          {showAboutLinks && (
            <>
              <Link href="/about" className="flex items-center gap-1 transition-colors hover:text-primary">
                <Info className="h-3.5 w-3.5" />
                عن المنصة
              </Link>
              <span>•</span>
              <Link href="/stats" className="flex items-center gap-1 transition-colors hover:text-primary">
                <BarChart3 className="h-3.5 w-3.5" />
                الإحصائيات
              </Link>
              <span>•</span>
            </>
          )}
          <Link href="/privacy" className="flex items-center gap-1 transition-colors hover:text-primary">
            <Shield className="h-3.5 w-3.5" />
            سياسة الخصوصية
          </Link>
          <span>•</span>
          <Link href="/terms" className="flex items-center gap-1 transition-colors hover:text-primary">
            <FileText className="h-3.5 w-3.5" />
            الشروط والأحكام
          </Link>
        </div>
      </div>
    </div>
  );
}

/** A desktop top-level nav link: inline icon + label, sharing the trigger look. */
function NavTopLink({
  href,
  label,
  icon: Icon,
  image,
  external,
  active,
  gold,
}: {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  image?: string;
  external?: boolean;
  active?: boolean;
  gold?: boolean;
}) {
  const cls = cn(
    navigationMenuTriggerStyle(),
    'bg-transparent hover:bg-accent/50',
    active && 'text-primary bg-accent/50',
  );
  const content = (
    <>
      {image ? (
        <img src={image} alt="" className="h-4 w-4 me-2 object-contain" />
      ) : Icon ? (
        <Icon className={cn('h-4 w-4 me-2', gold && 'text-[var(--gold)]')} />
      ) : null}
      {label}
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={cls}>
      {content}
    </Link>
  );
}

/**
 * The click-only menu trigger (no hover intent): grid icon, label, and a chevron
 * spaced with a logical inline-start margin so it sits right in RTL.
 */
const MoreTrigger = React.forwardRef<
  HTMLButtonElement,
  { label: string; open: boolean; onToggle: () => void }
>(function MoreTrigger({ label, open, onToggle }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="sz-more-panel"
      className={cn(
        navigationMenuTriggerStyle(),
        'bg-transparent hover:bg-accent/50',
        open && 'text-accent-foreground bg-accent/50',
      )}
    >
      <Grip className="h-4 w-4 me-2" />
      {label}
      <ChevronDown className={cn('h-3 w-3 ms-1 transition-transform duration-200', open && 'rotate-180')} />
    </button>
  );
});

export default function Navbar({ sticky = true }: { sticky?: boolean }) {
  const { url } = usePage();
  const pathname = url.split('?')[0];
  const isTransitPage = pathname.startsWith('/transit');
  const transitCityId = pathname.match(/^\/transit\/city\/([^/]+)/)?.[1] ?? null;
  const studioHref = transitCityId ? `/transit/studio?city=${transitCityId}` : '/transit/studio';
  const [isOpen, setIsOpen] = React.useState(false);
  const [theme, setTheme] = React.useState('dark');
  const { user } = useAuth();
  const { navbarLinks, navbarTopLinks, navbarMoreLinks } = useSiteNavigation();

  // Where the mobile menu reveals from: the trigger's centre, in viewport
  // coordinates (the sheet is fixed to the viewport, so these line up).
  const menuBtnRef = React.useRef<HTMLButtonElement>(null);
  const [menuOrigin, setMenuOrigin] = React.useState({ x: 0, y: 0 });
  const openMenu = () => {
    const r = menuBtnRef.current?.getBoundingClientRect();
    if (r) setMenuOrigin({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
  };

  // Desktop "المزيد" menu: click-only (no hover intent). Closes on an outside
  // click, Escape, or any navigation.
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreBtnRef = React.useRef<HTMLButtonElement>(null);
  const morePanelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (morePanelRef.current?.contains(t) || moreBtnRef.current?.contains(t)) return;
      setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreOpen(false);
        moreBtnRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);
  React.useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const isDark = isDarkTheme(theme, false);

  React.useEffect(() => {
    const savedTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(savedTheme);

    const observer = new MutationObserver(() => {
      const newTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      setTheme(newTheme);
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Navbar hidden on homepage (Startpage) on desktop; on mobile it stays fixed at the top
  const isHomepage = pathname === '/';

  // Quran reader (mobile): bookmarks shortcut opens the saved-ayahs modal.
  // The reader's own top row carries back + bookmarks on PC.
  const setBookmarksOpen = useMuslimNav((s) => s.setBookmarksOpen);
  const setRoznamaSettingsOpen = useMuslimNav((s) => s.setRoznamaSettingsOpen);
  const setMuslimPrayerSettingsOpen = useMuslimNav((s) => s.setMuslimPrayerSettingsOpen);
  const setHomeSettingsOpen = useMuslimNav((s) => s.setHomeSettingsOpen);
  const showQuranBookmarks = pathname === '/muslim/quran';
  const quranFocus = useMuslimNav((s) => s.quranFocus);
  const showRoznamaSettings = pathname === '/roznama';
  const showMuslimPrayerSettings = pathname === '/muslim/prayer';

  return (
    quranFocus && pathname === '/muslim/quran' ? null :
    <header className={`${sticky ? 'sticky top-0' : 'relative'} z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${isHomepage ? 'lg:hidden' : ''}`}>
      <div className="container relative flex h-16 max-w-7xl mx-auto items-center px-4 md:px-8 lg:px-6 xl:px-8 justify-between lg:justify-normal" dir="rtl">
        {/* Mobile Menu / Settings */}
        <div className="flex items-center lg:hidden">
          {isHomepage ? (
            <Button aria-label="الإعدادات"
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-10 sm:w-10"
              onClick={() => setHomeSettingsOpen(true)}
              title="الإعدادات"
            >
              <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          ) : (
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                ref={menuBtnRef}
                aria-label="فتح القائمة"
                variant="ghost"
                size="icon"
                className="h-9 w-9 sm:h-10 sm:w-10"
                onClick={openMenu}
              >
                <Grip className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              showClose={false}
              className="sz-menu-reveal sz-scroll flex flex-col w-full max-w-full border-0 bg-background p-0 overflow-y-auto sm:max-w-full"
              dir="rtl"
              style={{ '--sz-menu-x': `${menuOrigin.x}px`, '--sz-menu-y': `${menuOrigin.y}px` } as React.CSSProperties}
            >
              <SheetHeader className="flex-row items-center justify-between gap-2 space-y-0 px-4 pt-4 pb-2 text-right shrink-0">
                <SheetTitle className="flex h-10 items-center">
                  <Link href="/" className="flex items-center" onClick={() => setIsOpen(false)}>
                    <img
                      src={isDark ? '/assets/logo-darkmode.svg' : '/assets/logo-lightmode.svg'}
                      className="h-8"
                      alt="Syrian Zone"
                    />
                  </Link>
                </SheetTitle>
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    title="إغلاق"
                    aria-label="إغلاق القائمة"
                  >
                    <X className="h-6 w-6" />
                  </Button>
                </SheetClose>
              </SheetHeader>

              <div className="flex flex-1 flex-col justify-between gap-4 px-6 sm:px-10 pb-6">
                <div className="flex flex-col gap-4">
                  {isTransitPage && (
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                      <Link
                        href="/transit"
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                          pathname === '/transit' ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        <Bus className="h-4 w-4" />
                        الرئيسية
                      </Link>
                      <span className="text-muted-foreground/40">·</span>
                      <Link
                        href={studioHref}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                          pathname === '/transit/studio' ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        <Sparkles className="h-4 w-4 text-[var(--gold)]" />
                        إضافة خط / الاستوديو
                      </Link>
                    </div>
                  )}

                  {/* Always-on Mobile Search Bar + Searchable Panel */}
                  <MobileMenuSearchSection
                    pathname={pathname}
                    onNavigate={() => setIsOpen(false)}
                  />
                </div>

                {/* Always-visible Footer Links (About / Stats / Privacy / Terms) */}
                <div>
                  <Separator className="my-2" />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-2 pt-2 pb-2 text-xs text-muted-foreground">
                    <Link
                      href="/about"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-1.5 hover:text-primary transition-colors"
                    >
                      <Info className="h-3.5 w-3.5" />
                      عن المنصة
                    </Link>
                    <Link
                      href="/stats"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-1.5 hover:text-primary transition-colors"
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                      الإحصائيات
                    </Link>
                    <Link
                      href="/privacy"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-1.5 hover:text-primary transition-colors"
                    >
                      <Shield className="h-3.5 w-3.5" />
                      سياسة الخصوصية
                    </Link>
                    <Link
                      href="/terms"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-1.5 hover:text-primary transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      الشروط والأحكام
                    </Link>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          )}
        </div>

        {/* Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 flex shrink-0 lg:me-3 xl:me-10">
          <Link href="/" className="flex items-center gap-2">
            <img
              src={isDark ? '/assets/logo-darkmode.svg' : '/assets/logo-lightmode.svg'}
              className="h-8 sm:h-10"
              alt="Syrian Zone"
            />
          </Link>
        </div>

        {/* Desktop Navigation — click-only menu (no hover intent). */}
        <nav aria-label="التنقل الرئيسي" className="hidden lg:flex items-center gap-1" dir="rtl">
          {isTransitPage ? (
            <>
              <NavTopLink href="/transit" icon={Bus} label="الرئيسية" active={pathname === '/transit'} />
              <NavTopLink href={studioHref} icon={Sparkles} label="إضافة خط / الاستوديو" active={pathname === '/transit/studio'} gold />
              <MoreTrigger ref={moreBtnRef} label="أقسام الموقع" open={moreOpen} onToggle={() => setMoreOpen((o) => !o)} />
            </>
          ) : (
            <>
              {navbarTopLinks.map(({ id, href, text, icon: Icon, image, external }) => (
                <NavTopLink
                  key={id || href}
                  href={href}
                  icon={Icon ?? undefined}
                  image={image}
                  external={external}
                  label={text}
                  active={pathname === href}
                />
              ))}
              {navbarMoreLinks.length > 0 && (
                <MoreTrigger ref={moreBtnRef} label="المزيد" open={moreOpen} onToggle={() => setMoreOpen((o) => !o)} />
              )}
            </>
          )}
        </nav>

        {moreOpen && (
          <div ref={morePanelRef} className="fixed inset-x-0 top-16 z-50 flex justify-center">
            <div className="sz-menu-pop">
              {isTransitPage ? (
                <MorePanel
                  links={navbarLinks}
                  pathname={pathname}
                  showAboutLinks={false}
                  onNavigate={() => setMoreOpen(false)}
                  header={
                    <div className="space-y-1 border-b border-border p-3">
                      <Link
                        href="/transit"
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
                          pathname === '/transit' ? 'text-primary' : 'text-muted-foreground'
                        )}
                      >
                        <Bus className="h-4 w-4" />
                        الرئيسية
                      </Link>
                      <Link
                        href={studioHref}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
                          pathname === '/transit/studio' ? 'text-primary' : 'text-muted-foreground'
                        )}
                      >
                        <Sparkles className="h-4 w-4 text-[var(--gold)]" />
                        إضافة خط / الاستوديو
                      </Link>
                      <p className="px-3 pt-1 text-xs font-bold text-muted-foreground/60">أقسام الموقع الأخرى</p>
                    </div>
                  }
                />
              ) : (
                <MorePanel links={navbarMoreLinks} pathname={pathname} showAboutLinks onNavigate={() => setMoreOpen(false)} />
              )}
            </div>
          </div>
        )}

        {/* Controls: search (desktop), appearance, page-scoped settings, separator, account/login */}
        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
          <DesktopSearchTrigger />
          <AppearanceMenu />
          {showQuranBookmarks && (
            <Button aria-label="علامات الآيات"
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9 sm:h-10 sm:w-10"
              onClick={() => setBookmarksOpen(true)}
              title="علامات الآيات"
            >
              <Bookmark className="h-5 w-5" />
            </Button>
          )}
          {showRoznamaSettings && (
            <Button aria-label="إعدادات الروزنامة"
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-10 sm:w-10"
              onClick={() => setRoznamaSettingsOpen(true)}
              title="إعدادات الروزنامة"
            >
              <Settings className="h-5 w-5" />
            </Button>
          )}
          {showMuslimPrayerSettings && (
            <Button aria-label="إعدادات المواقيت"
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-10 sm:w-10"
              onClick={() => setMuslimPrayerSettingsOpen(true)}
              title="إعدادات المواقيت"
            >
              <Settings className="h-5 w-5" />
            </Button>
          )}
          <div className="w-px h-6 bg-border shrink-0" />
          {user ? (
            <UserNav />
          ) : (
            // Icon-only until xl: the nav row is already tight at the lg
            // breakpoint, and the label is redundant next to the Google mark.
            <Button
              asChild
              variant="outline"
              className="h-9 w-9 gap-2 px-0 sm:h-10 sm:w-10 xl:w-auto xl:px-4"
            >
              <a href="/auth/google" aria-label="تسجيل الدخول" className="flex items-center gap-2">
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span className="sr-only xl:not-sr-only">تسجيل الدخول</span>
              </a>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
