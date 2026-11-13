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
import { useAppShell } from '@/Lib/appShell';
import { useColorScheme } from '@/Lib/theme';
import { cn } from '@/Lib/utils';
import { Button } from '@/Components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/Components/ui/sheet';
import { Separator } from '@/Components/ui/separator';

import UserNav from './UserNav';
import AppearanceMenu from './AppearanceMenu';
import { DesktopSearchTrigger, MobileMenuSearchSection } from './GlobalSearch';
import { useSiteNavigation, type SiteLink } from '@/Lib/siteLinks';
import { isActive, pathnameOf, routeFamily, routeSegment } from '@/Lib/routes';
import { siteModule } from '@/Lib/siteModules';

/** Columns for the desktop mega menu, matching the homepage's tile grid. */
const MEGA_GRID = 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9';

/**
 * The page links the navbar shows twice — in the "more" panel and in the mobile
 * sheet. They are not site modules (`about: true` marks the two the transit
 * variant of the panel leaves out).
 */
const FOOTER_LINKS = [
  { href: '/about', label: 'عن المنصة', icon: Info, about: true },
  { href: '/stats', label: 'الإحصائيات', icon: BarChart3, about: true },
  { href: '/privacy', label: 'سياسة الخصوصية', icon: Shield, about: false },
  { href: '/terms', label: 'الشروط والأحكام', icon: FileText, about: false },
] as const;

/**
 * The desktop top-level trigger look, shared by the nav links and the "more"
 * button.
 */
const NAV_TRIGGER_CLASS =
  'group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=open]:text-accent-foreground data-[state=open]:bg-accent/50 data-[state=open]:hover:bg-accent data-[state=open]:focus:bg-accent';


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
    current?: boolean;
    external?: boolean;
    onNavigate?: () => void;
  }
>(function NavTile({ href, text, icon: Icon, image, isFlag, current, external, onNavigate, ...rest }, ref) {
  const className =
    'group flex h-full select-none flex-col items-center gap-2 rounded-lg px-1 py-2 text-center no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const body = (
    <>
      {isFlag ? (
        <img
          src="/flag-replacer/1f1f8-1f1fe.svg"
          alt=""
          loading="lazy"
          decoding="async"
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
            current ? 'text-primary' : 'text-foreground group-hover:text-primary',
          )}
        />
      ) : null}
      <span
        className={cn(
          'line-clamp-2 text-xs font-medium leading-tight transition-colors',
          current ? 'text-primary' : 'text-foreground group-hover:text-primary',
        )}
      >
        {text}
      </span>
    </>
  );
  if (external) {
    return (
      <a
        ref={ref}
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-current={current ? 'page' : undefined}
        className={className}
        {...rest}
      >
        {body}
      </a>
    );
  }
  return (
    <Link
      ref={ref}
      href={href}
      onClick={onNavigate}
      aria-current={current ? 'page' : undefined}
      className={className}
      {...rest}
    >
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
            current={isActive(href, pathname)}
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
          {FOOTER_LINKS.filter((link) => showAboutLinks || !link.about).map(
            (link, index) => (
              <React.Fragment key={link.href}>
                {index > 0 && <span>•</span>}
                <Link href={link.href} className="flex items-center gap-1 transition-colors hover:text-primary">
                  <link.icon className="h-3.5 w-3.5" />
                  {link.label}
                </Link>
              </React.Fragment>
            ),
          )}
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
}: {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  image?: string;
  external?: boolean;
  active?: boolean;
}) {
  const cls = cn(
    NAV_TRIGGER_CLASS,
    'bg-transparent hover:bg-accent/50',
    active && 'text-primary bg-accent/50',
  );
  const content = (
    <>
      {image ? (
        <img src={image} alt="" className="h-4 w-4 me-2 object-contain" />
      ) : Icon ? (
        <Icon className="h-4 w-4 me-2" />
      ) : null}
      {label}
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" aria-current={active ? 'page' : undefined} className={cls}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} aria-current={active ? 'page' : undefined} className={cls}>
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
        NAV_TRIGGER_CLASS,
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
  const pathname = pathnameOf(url);
  const isTransitPage = routeFamily(pathname) === 'transit';
  // The transit section keeps its own two links in the top bar; their paths are
  // the catalogue's, so renaming the route is one edit.
  const transitModule = siteModule('transit');
  const transitHref = transitModule?.href ?? '/transit';
  const studioPath = transitModule?.subCategories.find((sub) => sub.id === 'transit_studio')?.href ?? '/transit/studio';
  const transitCityId = routeSegment(pathname, `${transitHref}/city`);
  const studioHref = transitCityId ? `${studioPath}?city=${transitCityId}` : studioPath;
  const [isOpen, setIsOpen] = React.useState(false);
  const isDark = useColorScheme() === 'dark';
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

  // Navbar hidden on homepage (Startpage) on desktop; on mobile it stays fixed at the top
  const isHomepage = pathname === '/';

  // The buttons the navbar carries for one page's own dialog. The page owns the
  // dialog; the shell only knows which route shows which trigger.
  const setBookmarksOpen = useAppShell((s) => s.setBookmarksOpen);
  const openPageDialog = useAppShell((s) => s.openPageDialog);
  const quranFocus = useAppShell((s) => s.quranFocus);
  const pageActions = [
    // Quran reader (mobile): bookmark access. The reader's own top row
    // carries back + bookmarks on PC.
    {
      href: '/muslim/quran',
      label: 'علامات الآيات',
      icon: Bookmark,
      className: 'lg:hidden h-9 w-9 sm:h-10 sm:w-10',
      open: () => setBookmarksOpen(true),
    },
    {
      href: '/roznama',
      label: 'إعدادات الروزنامة',
      icon: Settings,
      className: 'h-9 w-9 sm:h-10 sm:w-10',
      open: () => openPageDialog('roznama-settings'),
    },
    {
      href: '/muslim/prayer',
      label: 'إعدادات المواقيت',
      icon: Settings,
      className: 'h-9 w-9 sm:h-10 sm:w-10',
      open: () => openPageDialog('muslim-prayer-settings'),
    },
  ].filter((action) => isActive(action.href, pathname));

  return (
    quranFocus && isActive('/muslim/quran', pathname) ? null :
    <header className={`${sticky ? 'sticky top-0' : 'relative'} z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${isHomepage ? 'lg:hidden' : ''}`}>
      {/* This row plus the border of the header is `--sz-navbar-h`
          (resources/css/app.css), which the full-viewport pages subtract. */}
      <div className="container relative flex h-16 max-w-7xl mx-auto items-center px-4 md:px-8 lg:px-6 xl:px-8 justify-between lg:justify-normal" dir="rtl">
        {/* Mobile Menu / Settings */}
        <div className="flex items-center lg:hidden">
          {isHomepage ? (
            <Button aria-label="الإعدادات"
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-10 sm:w-10"
              onClick={() => openPageDialog('home-settings')}
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
                        href={transitHref}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                          isActive(transitHref, pathname) ? "text-primary" : "text-muted-foreground"
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
                          isActive(studioPath, pathname) ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        <Sparkles className="h-4 w-4 text-primary" />
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
                    {FOOTER_LINKS.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-1.5 hover:text-primary transition-colors"
                      >
                        <link.icon className="h-3.5 w-3.5" />
                        {link.label}
                      </Link>
                    ))}
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
              <NavTopLink href={transitHref} icon={Bus} label="الرئيسية" active={isActive(transitHref, pathname)} />
              <NavTopLink href={studioHref} icon={Sparkles} label="إضافة خط / الاستوديو" active={isActive(studioPath, pathname)} />
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
                  active={isActive(href, pathname)}
                />
              ))}
              {navbarMoreLinks.length > 0 && (
                <MoreTrigger ref={moreBtnRef} label="المزيد" open={moreOpen} onToggle={() => setMoreOpen((o) => !o)} />
              )}
            </>
          )}
        </nav>

        {/* Always in the document, hidden until opened: the panel holds the
            only links to most sections, and a crawler follows links it finds
            in the HTML, not ones a click would add. */}
        <div
          ref={morePanelRef}
          className={cn('fixed inset-x-0 top-16 z-50 justify-center', moreOpen ? 'flex' : 'hidden')}
        >
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
                      href={transitHref}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
                        isActive(transitHref, pathname) ? 'text-primary' : 'text-muted-foreground'
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
                        isActive(studioPath, pathname) ? 'text-primary' : 'text-muted-foreground'
                      )}
                    >
                      <Sparkles className="h-4 w-4 text-primary" />
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

        {/* Controls: search (desktop), appearance, page-scoped settings, separator, account/login */}
        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
          <DesktopSearchTrigger />
          <AppearanceMenu />
          {pageActions.map((action) => (
            <Button
              key={action.href}
              aria-label={action.label}
              variant="ghost"
              size="icon"
              className={action.className}
              onClick={action.open}
              title={action.label}
            >
              <action.icon className="h-5 w-5" />
            </Button>
          ))}
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
