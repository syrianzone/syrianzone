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
  Gamepad2,
  MoonStar,
  Clock,
  BookOpen,
  Radio,
  Calendar,
} from 'lucide-react';

import { useAuth } from '@/Contexts/AuthContext';
import { useAppShell } from '@/Lib/appShell';
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
import { DesktopSearchTrigger } from './DesktopSearchTrigger';
import { Logo } from '@/Components/brand/Logo';
import { Node } from '@/Components/brand/Node';
import { groupSiteLinks, useSiteNavigation, type SiteLink } from '@/Lib/siteLinks';
import { isActive, pathnameOf, routeFamily, routeSegment } from '@/Lib/routes';
import { siteModule, type SiteModuleGroup } from '@/Lib/siteModules';

/**
 * The mobile menu's search panel carries the whole search engine (results
 * renderer, Quran/crossings/games catalogues, cmdk). The sheet only mounts it
 * once opened, so it loads on demand instead of with the layout every page
 * renders. Opening the menu starts the download; the idle-mounted command
 * palette usually has it cached already.
 */
const loadMobileMenuSearch = () =>
  import('./GlobalSearch').then((m) => ({ default: m.MobileMenuSearchSection }));
const MobileMenuSearchSection = React.lazy(loadMobileMenuSearch);

/** Columns for the desktop mega menu, matching the homepage's tile grid. */
const MEGA_GRID = 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-10';

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
  'group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-2.5 xl:px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[state=open]:text-accent-foreground data-[state=open]:bg-accent/50 data-[state=open]:hover:bg-accent data-[state=open]:focus:bg-accent';


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
    imageDark?: string;
    isFlag?: boolean;
    compact?: boolean;
    current?: boolean;
    external?: boolean;
    onNavigate?: () => void;
  }
>(function NavTile({ href, text, icon: Icon, image, imageDark, isFlag, compact, current, external, onNavigate, ...rest }, ref) {
  const iconSize = compact ? 'h-9 w-9' : 'h-12 w-12';
  const className =
    'group flex h-full select-none flex-col items-center gap-1.5 rounded-lg px-1 py-2 text-center no-underline outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring';
  const body = (
    <>
      {isFlag ? (
        <img
          src="/flag-replacer/1f1f8-1f1fe.svg"
          alt=""
          loading="lazy"
          decoding="async"
          className={cn(iconSize, 'shrink-0 object-contain transition-transform group-hover:scale-110')}
        />
      ) : image && imageDark ? (
        <>
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn(iconSize, 'shrink-0 object-contain transition-transform group-hover:scale-110 dark:hidden')}
          />
          <img
            src={imageDark}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn(iconSize, 'hidden shrink-0 object-contain transition-transform group-hover:scale-110 dark:block')}
          />
        </>
      ) : image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn(iconSize, 'shrink-0 object-contain transition-transform group-hover:scale-110')}
        />
      ) : Icon ? (
        <Icon
          className={cn(
            iconSize,
            'shrink-0 transition-all group-hover:scale-110',
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
function TileGrid({
  links,
  pathname,
  onNavigate,
  className,
  compact,
}: {
  links: SiteLink[];
  pathname: string;
  onNavigate?: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <ul className={cn('grid grid-cols-3 gap-1', className)}>
      {links.map(({ id, href, text, icon, image, imageDark, isFlag, external }) => (
        <li key={id || href}>
          <NavTile
            href={href}
            text={text}
            icon={icon ?? undefined}
            image={image}
            imageDark={imageDark}
            isFlag={isFlag}
            compact={compact}
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
 * The "more" panel, shared by the contextual hub navbars (Transit, Muslim
 * Corner, Games) so every hub gets the exact same 6-group bento as the
 * homepage.
 */
function MorePanel({
  links,
  groups,
  pathname,
  onNavigate,
  header,
  showAboutLinks,
}: {
  links: SiteLink[];
  groups: readonly SiteModuleGroup[];
  pathname: string;
  onNavigate?: () => void;
  header?: React.ReactNode;
  showAboutLinks: boolean;
}) {
  const grouped = groupSiteLinks(links, groups);
  const byId = new Map(grouped.map((g) => [g.id, g]));
  const bentoSlots: Array<{ id: string; span: string; cols: string }> = [
    { id: 'daily', span: 'lg:col-span-7', cols: 'grid-cols-3 sm:grid-cols-4' },
    { id: 'maps', span: 'lg:col-span-5', cols: 'grid-cols-3' },
    { id: 'state', span: 'lg:col-span-6', cols: 'grid-cols-3' },
    { id: 'interactive', span: 'lg:col-span-6', cols: 'grid-cols-3' },
    { id: 'community', span: 'lg:col-span-8', cols: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-7' },
    { id: 'external', span: 'lg:col-span-4', cols: 'grid-cols-3' },
  ];
  const knownIds = new Set(bentoSlots.map((s) => s.id));
  const others = grouped.filter((g) => !knownIds.has(g.id));

  return (
    <div
      id="sz-more-panel"
      role="region"
      aria-label="أقسام الموقع"
      className="w-[min(1100px,92vw)] max-h-[calc(100dvh-5.5rem)] overflow-y-auto rounded-xl border bg-popover text-popover-foreground shadow-lg"
    >
      {header}
      <div className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {bentoSlots.map(({ id, span, cols }) => {
            const group = byId.get(id);
            if (!group) return null;
            return (
              <div key={group.id} className={cn('rounded-xl border border-border/60 bg-muted/25 p-3', span)}>
                <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-extrabold text-foreground">
                  <span aria-hidden="true" className="inline-block size-1.5 shrink-0 rounded-[2px] bg-sz-node" />
                  {group.title}
                </p>
                <TileGrid
                  links={group.links}
                  pathname={pathname}
                  onNavigate={onNavigate}
                  compact
                  className={cols}
                />
              </div>
            );
          })}
          {others.map((group) => (
            <div key={group.id} className="lg:col-span-12 rounded-xl border border-border/60 bg-muted/25 p-3">
              <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-extrabold text-foreground">
                <span aria-hidden="true" className="inline-block size-1.5 shrink-0 rounded-[2px] bg-sz-node" />
                {group.title}
              </p>
              <TileGrid
                links={group.links}
                pathname={pathname}
                onNavigate={onNavigate}
                compact
                className={MEGA_GRID}
              />
            </div>
          ))}
        </div>

        <Separator className="my-3" />
        <div className="flex flex-wrap justify-center gap-4 py-1 text-xs text-muted-foreground">
          {FOOTER_LINKS.filter((link) => showAboutLinks || !link.about).map(
            (link, index) => (
              <React.Fragment key={link.href}>
                {index > 0 && <span>•</span>}
                <Link href={link.href} onClick={onNavigate} className="flex items-center gap-1 transition-colors hover:text-primary">
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

/**
 * Focused dropdown panel for a single domain group on standard pages:
 * 2-column rich list (icon + title + 1-line subtitle) so every module is easy
 * to scan without opening a giant 34-item wall.
 */
function DomainPanel({
  id,
  title,
  links,
  pathname,
  onNavigate,
  footer,
}: {
  id: string;
  title: string;
  links: SiteLink[];
  pathname: string;
  onNavigate: () => void;
  footer?: React.ReactNode;
}) {
  return (
      <div
      id={`sz-nav-panel-${id}`}
      role="region"
      aria-label={title}
      className="w-[min(620px,92vw)] max-h-[calc(100dvh-5.5rem)] overflow-y-auto rounded-lg border border-border bg-popover p-3.5 text-popover-foreground shadow-md"
      dir="rtl"
    >
      <p className="mb-2.5 flex items-center gap-2 px-1.5 font-display text-sm font-bold text-foreground">
        <Node size="sm" />
        {title}
      </p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {links.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href, pathname);
          const itemClass = cn(
            'group flex items-start gap-2.5 rounded-md px-2.5 py-2 text-start transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            active && 'bg-accent text-primary',
          );
          const body = (
            <>
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center">
                {link.image && link.imageDark ? (
                  <>
                    <img src={link.image} alt="" loading="lazy" decoding="async" className="h-5 w-5 object-contain dark:hidden" />
                    <img src={link.imageDark} alt="" loading="lazy" decoding="async" className="hidden h-5 w-5 object-contain dark:block" />
                  </>
                ) : link.image ? (
                  <img src={link.image} alt="" loading="lazy" decoding="async" className="h-5 w-5 object-contain" />
                ) : Icon ? (
                  <Icon className="h-5 w-5 shrink-0" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm font-semibold leading-snug', active ? 'text-primary' : 'text-foreground group-hover:text-primary')}>
                  {link.text}
                </span>
                {link.subtitle && (
                  <span className="mt-0.5 block line-clamp-1 text-xs text-muted-foreground">
                    {link.subtitle}
                  </span>
                )}
              </span>
            </>
          );
          return (
            <li key={link.id || link.href}>
              {link.external ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-current={active ? 'page' : undefined}
                  className={itemClass}
                >
                  {body}
                </a>
              ) : (
                <Link
                  href={link.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={itemClass}
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {footer}
    </div>
  );
}

/**
 * The «المدار» brand lockup, coloured from the active theme's CSS tokens
 * (--foreground, --sz-orbit, --sz-bowl, --sz-node) so it adapts to every
 * light and dark palette without swapping images after hydration.
 */
function SiteLogo({ className }: { className: string }) {
  return <Logo className={cn(className, 'w-auto')} title="المساحة السورية" />;
}

/** A desktop top-level nav link: inline icon + label, sharing the trigger look. */
function NavTopLink({
  href,
  label,
  icon: Icon,
  image,
  imageDark,
  external,
  active,
}: {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  image?: string;
  imageDark?: string;
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
      {image && imageDark ? (
        <>
          <img src={image} alt="" loading="lazy" decoding="async" className="h-4 w-4 me-2 object-contain dark:hidden" />
          <img src={imageDark} alt="" loading="lazy" decoding="async" className="hidden h-4 w-4 me-2 object-contain dark:block" />
        </>
      ) : image ? (
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
 * The click-only menu trigger (no hover intent): optional grid icon, label, and
 * a chevron spaced with a logical inline-start margin so it sits right in RTL.
 */
const MoreTrigger = React.forwardRef<
  HTMLButtonElement,
  { label: string; open: boolean; active?: boolean; showGridIcon?: boolean; controlsId?: string; onToggle: () => void }
>(function MoreTrigger({ label, open, active, showGridIcon = true, controlsId = 'sz-more-panel', onToggle }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controlsId}
      className={cn(
        NAV_TRIGGER_CLASS,
        'bg-transparent px-3 hover:bg-accent/50',
        (open || active) && 'text-primary bg-accent/50',
      )}
    >
      {showGridIcon && <Grip className="h-4 w-4 me-1.5" />}
      {label}
      <ChevronDown className={cn('h-3 w-3 ms-1 transition-transform duration-200', open && 'rotate-180')} />
    </button>
  );
});

const MUSLIM_HUB_LINKS = [
  { href: '/muslim', label: 'الركن الإسلامي', icon: MoonStar, exact: true },
  { href: '/muslim/prayer', label: 'المواقيت', icon: Clock },
  { href: '/muslim/quran', label: 'القرآن', icon: BookOpen },
  { href: '/muslim/ramadan', label: 'رمضان', icon: Calendar },
  { href: '/muslim/radio', label: 'الإذاعة', icon: Radio },
] as const;

const GAMES_HUB_LINKS = [
  { href: '/games', label: 'كل الألعاب', icon: Gamepad2, exact: true },
  { href: '/games/tarneeb', label: 'طرنيب' },
  { href: '/games/trix', label: 'تركس' },
  { href: '/guesswho', label: 'من هو؟' },
  { href: '/games/solitare', label: 'سوليتير' },
  { href: '/games/2048', label: '2048' },
] as const;

/**
 * Memoized: every page renders its own MainLayout, so any page state change
 * (a keystroke in a filter, a toggle) re-renders the layout. The navbar's only
 * prop is a boolean and everything else it reads comes from stores and
 * contexts, so it can skip those renders and keep its large mega menu still.
 */
const Navbar = React.memo(function Navbar({ sticky = true }: { sticky?: boolean }) {
  const { url } = usePage();
  const pathname = pathnameOf(url);
  const family = routeFamily(pathname);
  const isTransitPage = family === 'transit';
  const isMuslimPage = family === 'muslim';
  const isGamesPage = family === 'games' || pathname === '/guesswho';
  const isHubPage = isTransitPage || isMuslimPage || isGamesPage;

  // The transit section keeps its own two links in the top bar; their paths are
  // the catalogue's, so renaming the route is one edit.
  const transitModule = siteModule('transit');
  const transitHref = transitModule?.href ?? '/transit';
  const studioPath = transitModule?.subCategories.find((sub) => sub.id === 'transit_studio')?.href ?? '/transit/studio';
  const transitCityId = routeSegment(pathname, `${transitHref}/city`);
  const studioHref = transitCityId ? `${studioPath}?city=${transitCityId}` : studioPath;
  const [isOpen, setIsOpen] = React.useState(false);
  const { user } = useAuth();
  const { navbarLinks, groups } = useSiteNavigation();

  // Option A: 4 focused top-level domain dropdowns (daily, maps, state,
  // interactive) + a single "المزيد" dropdown holding community & external.
  const allGrouped = React.useMemo(() => groupSiteLinks(navbarLinks, groups), [navbarLinks, groups]);
  const primaryGroupIds = React.useMemo(() => new Set(['daily', 'maps', 'state', 'interactive']), []);
  const domainGroups = React.useMemo(() => allGrouped.filter((g) => primaryGroupIds.has(g.id)), [allGrouped, primaryGroupIds]);
  const moreGroups = React.useMemo(() => allGrouped.filter((g) => !primaryGroupIds.has(g.id)), [allGrouped, primaryGroupIds]);
  const moreLinks = React.useMemo(() => moreGroups.flatMap((g) => g.links), [moreGroups]);

  const groupIsActive = React.useCallback(
    (links: SiteLink[]) =>
      links.some(
        (l) =>
          isActive(l.href, pathname) ||
          (l.subCategories?.some((sub) => isActive(sub.href, pathname)) ?? false),
      ),
    [pathname],
  );

  // Where the mobile menu reveals from: the trigger's centre, in viewport
  // coordinates (the sheet is fixed to the viewport, so these line up).
  const menuBtnRef = React.useRef<HTMLButtonElement>(null);
  const [menuOrigin, setMenuOrigin] = React.useState({ x: 0, y: 0 });
  const openMenu = () => {
    void loadMobileMenuSearch();
    const r = menuBtnRef.current?.getBoundingClientRect();
    if (r) setMenuOrigin({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
  };

  // Desktop click-only menus (domain dropdowns on standard pages, or full
  // bento "أقسام الموقع" on hub pages). Closes on outside click, Escape, focus
  // leaving the nav + panel, or any navigation.
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const navRef = React.useRef<HTMLElement>(null);
  const panelHostRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!openMenuId) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelHostRef.current?.contains(t) || navRef.current?.contains(t)) return;
      setOpenMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuId(null);
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as Node;
      if (panelHostRef.current?.contains(t) || navRef.current?.contains(t)) return;
      setOpenMenuId(null);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [openMenuId]);
  React.useEffect(() => {
    setOpenMenuId(null);
  }, [pathname]);

  const toggleMenu = (id: string) => setOpenMenuId((cur) => (cur === id ? null : id));

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
      <div className="container relative flex h-16 max-w-[76rem] mx-auto items-center px-4 md:px-8 justify-between lg:justify-normal" dir="rtl">
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
              <SheetHeader className="flex-row items-center justify-between gap-2 space-y-0 h-14 border-b border-border px-4 text-start shrink-0">
                <SheetTitle className="flex h-9 items-center">
                  <Link href="/" className="flex items-center" onClick={() => setIsOpen(false)}>
                    <SiteLogo className="h-7" />
                  </Link>
                </SheetTitle>
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    title="إغلاق"
                    aria-label="إغلاق القائمة"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </SheetClose>
              </SheetHeader>

              <div className="flex flex-1 flex-col justify-between gap-4 px-4 pt-3 pb-6">
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

                  {isMuslimPage && (
                    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                      {MUSLIM_HUB_LINKS.map((item) => {
                        const active = 'exact' in item && item.exact ? pathname === item.href : isActive(item.href, pathname);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                              'flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary',
                              active ? 'text-primary' : 'text-muted-foreground',
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {isGamesPage && (
                    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                      {GAMES_HUB_LINKS.map((item) => {
                        const active = 'exact' in item && item.exact ? pathname === item.href : isActive(item.href, pathname);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                              'flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary',
                              active ? 'text-primary' : 'text-muted-foreground',
                            )}
                          >
                            {'icon' in item && item.icon && <item.icon className="h-4 w-4" />}
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {/* Always-on Mobile Search Bar + Searchable Panel */}
                  <React.Suspense fallback={null}>
                    <MobileMenuSearchSection
                      pathname={pathname}
                      onNavigate={() => setIsOpen(false)}
                    />
                  </React.Suspense>
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
        <div className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 flex shrink-0 lg:me-3 xl:me-6">
          <Link href="/" className="flex items-center gap-2">
            <SiteLogo className="h-8 sm:h-10" />
          </Link>
        </div>

        {/* Desktop Navigation — click-only domain dropdowns on standard pages,
            and focused sibling links + full bento "أقسام الموقع" on hub families
            (Transit, Muslim Corner, Games). */}
        <nav ref={navRef} aria-label="التنقل الرئيسي" className="hidden lg:flex items-center gap-0.5" dir="rtl">
          {isTransitPage ? (
            <>
              <NavTopLink href={transitHref} icon={Bus} label="الرئيسية" active={pathname === transitHref} />
              <NavTopLink href={studioHref} icon={Sparkles} label="إضافة خط / الاستوديو" active={isActive(studioPath, pathname)} />
              <MoreTrigger label="أقسام الموقع" open={openMenuId === 'hub-more'} onToggle={() => toggleMenu('hub-more')} />
            </>
          ) : isMuslimPage ? (
            <>
              {MUSLIM_HUB_LINKS.map((item) => (
                <NavTopLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={'exact' in item && item.exact ? pathname === item.href : isActive(item.href, pathname)}
                />
              ))}
              <MoreTrigger label="أقسام الموقع" open={openMenuId === 'hub-more'} onToggle={() => toggleMenu('hub-more')} />
            </>
          ) : isGamesPage ? (
            <>
              {GAMES_HUB_LINKS.map((item) => (
                <NavTopLink
                  key={item.href}
                  href={item.href}
                  icon={'icon' in item ? item.icon : undefined}
                  label={item.label}
                  active={'exact' in item && item.exact ? pathname === item.href : isActive(item.href, pathname)}
                />
              ))}
              <MoreTrigger label="أقسام الموقع" open={openMenuId === 'hub-more'} onToggle={() => toggleMenu('hub-more')} />
            </>
          ) : (
            <>
              {domainGroups.map((group) => (
                <MoreTrigger
                  key={group.id}
                  label={group.title}
                  showGridIcon={false}
                  controlsId={`sz-nav-panel-${group.id}`}
                  open={openMenuId === group.id}
                  active={groupIsActive(group.links)}
                  onToggle={() => toggleMenu(group.id)}
                />
              ))}
              <MoreTrigger
                label="المزيد"
                controlsId="sz-nav-panel-more"
                open={openMenuId === 'more'}
                active={groupIsActive(moreLinks)}
                onToggle={() => toggleMenu('more')}
              />
            </>
          )}
        </nav>

        {/* Always in the document, hidden until opened: the panels hold the
            only links to most sections, and a crawler follows links it finds
            in the HTML, not ones a click would add. */}
        <div ref={panelHostRef}>
          {isHubPage ? (
            <div className={cn('fixed inset-x-0 top-16 z-50 justify-center', openMenuId === 'hub-more' ? 'flex' : 'hidden')}>
              <div className="sz-menu-pop">
                <MorePanel
                  links={navbarLinks}
                  groups={groups}
                  pathname={pathname}
                  showAboutLinks={!isTransitPage}
                  onNavigate={() => setOpenMenuId(null)}
                />
              </div>
            </div>
          ) : (
            <>
              {domainGroups.map((group) => (
                <div
                  key={group.id}
                  className={cn('fixed inset-x-0 top-16 z-50 justify-center', openMenuId === group.id ? 'flex' : 'hidden')}
                >
                  <div className="sz-menu-pop">
                    <DomainPanel
                      id={group.id}
                      title={group.title}
                      links={group.links}
                      pathname={pathname}
                      onNavigate={() => setOpenMenuId(null)}
                    />
                  </div>
                </div>
              ))}
              <div className={cn('fixed inset-x-0 top-16 z-50 justify-center', openMenuId === 'more' ? 'flex' : 'hidden')}>
                <div className="sz-menu-pop">
                  <DomainPanel
                    id="more"
                    title="الهوية والمجتمع والشركاء"
                    links={moreLinks}
                    pathname={pathname}
                    onNavigate={() => setOpenMenuId(null)}
                    footer={
                      <>
                        <Separator className="my-3" />
                        <div className="flex flex-wrap justify-center gap-4 py-1 text-xs text-muted-foreground">
                          {FOOTER_LINKS.map((link, index) => (
                            <React.Fragment key={link.href}>
                              {index > 0 && <span>•</span>}
                              <Link
                                href={link.href}
                                onClick={() => setOpenMenuId(null)}
                                className="flex items-center gap-1 transition-colors hover:text-primary"
                              >
                                <link.icon className="h-3.5 w-3.5" />
                                {link.label}
                              </Link>
                            </React.Fragment>
                          ))}
                        </div>
                      </>
                    }
                  />
                </div>
              </div>
            </>
          )}
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
});

export default Navbar;
