import React from 'react';
import { Link, usePage } from '@inertiajs/react';
import {
  Menu,
  CheckCircle2,
  Palette,
  Users2,
  Landmark,
  Compass,
  Crosshair,
  Code2,
  MessageSquare,
  ExternalLink,
  Utensils,
  Globe,
  ListOrdered,
  Link as LinkIcon,
  Newspaper,
  Bus,
  Smartphone,
  MessageSquareCode,
  Sandwich,
  Sliders,
  Scale,
  Calendar,
  Phone,
  Sparkles,
  HelpCircle,
  Shield,
  MapPin,
  LayoutGrid,
} from 'lucide-react';

import { useAuth } from '@/Contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

import UserNav from './UserNav';
import { ThemeToggle } from './ThemeToggle';
import { isDarkTheme } from '@/lib/theme';
import {
  SyOfficialIcon,
  RoznamaIcon,
  PhonebookIcon,
  SyIdIcon,
  PartyIcon,
  TierlistIcon,
  HouseIcon,
  CompassIcon,
  PrioritiesIcon,
  SitesIcon,
  PopulationIcon,
  GovAppsIcon,
  TransitIcon,
  JusticeIcon,
  MishwarIcon,
  BoardIcon,
  RecipesIcon,
  NewsIcon,
  AnswersIcon,
  CodexCommunityIcon,
} from '@/Components/Icons/ProjectIcons';

const navLinks = [
  { href: '/syofficial', text: 'الحسابات الرسمية', icon: SyOfficialIcon },
  { href: '/roznama', text: 'الروزنامة', icon: RoznamaIcon },
  { href: '/phonebook', text: 'دليل الهاتف', icon: PhonebookIcon },
  { href: '/syid', text: 'الهوية البصرية', icon: SyIdIcon },
  { href: '/tierlist', text: 'تقييم الحكومة', icon: TierlistIcon },
  { href: '/syrian-contributors', text: 'المساهمون', icon: Code2 },
  { href: '/sites', text: 'دليل المواقع', icon: SitesIcon },
  { href: '/population', text: 'أطلس', icon: PopulationIcon },
  { href: '/party', text: 'دليل الأحزاب', icon: PartyIcon },
  { href: '/house', text: 'المجلس التشريعي', icon: HouseIcon },
  { href: '/compass', text: 'البوصلة السياسية', icon: CompassIcon },
  { href: '/priorities', text: 'أولويات سوريا', icon: PrioritiesIcon },
  { href: '/govapps', text: 'تطبيقات الحكومة', icon: GovAppsIcon },
  { href: '/transit', text: 'ترانزيت', icon: TransitIcon },
  { href: '/shawarma', text: 'تير ليست الشاورما', icon: Sandwich },
  { href: '/justice', text: 'العدالة الانتقالية', icon: JusticeIcon },
  { href: '/mishwar', text: 'مشوار', icon: MishwarIcon },
  { href: '/board', text: 'لوح', icon: BoardIcon },
];

const externalLinks = [
  { href: 'https://news.jard.chat', text: 'أخبار سوريا', icon: NewsIcon },
  { href: 'https://answers.syrian.zone', text: 'إجابات سوريا', icon: AnswersIcon },
  { href: 'https://joory.chat', text: 'جوري AI', image: 'https://joory.chat/favicon.svg' },
  { href: 'https://jard.chat', text: 'جرد', image: 'https://jard.chat/images/logo-light.svg' },
  { href: 'https://food.syrian.zone', text: 'وصفاتنا', icon: RecipesIcon },
  { href: 'https://discord.gg/NqE8849VzA', text: 'مجتمع كوديكس', icon: CodexCommunityIcon },
  { href: 'https://chromewebstore.google.com/detail/syrian-flag-replacer/dngipobppehfhfggmbdiiiodgcibdeog', text: 'مبدل العلم', isFlag: true },
];

export default function Navbar({ sticky = true }: { sticky?: boolean }) {
  const { url } = usePage();
  const pathname = url.split('?')[0];
  const isTransitPage = pathname.startsWith('/transit');
  const [isOpen, setIsOpen] = React.useState(false);
  const [theme, setTheme] = React.useState('dark');
  const { user } = useAuth();

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

  // Hide Navbar on homepage (Startpage)
  if (pathname === '/') return null;

  return (
    <header className={`${sticky ? 'sticky top-0' : 'relative'} z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60`}>
      <div className="container relative flex h-16 max-w-7xl mx-auto items-center px-4 md:px-8 justify-between lg:justify-normal" dir="rtl">
        {/* Mobile Menu */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-10 w-10"
            >
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="pr-0 bg-background" dir="rtl">
            <SheetHeader className="px-7 text-right">
              <SheetTitle>
                <Link href="/" className="flex items-center" onClick={() => setIsOpen(false)}>
                  <img
                    src={isDark ? '/assets/logo-darkmode.svg' : '/assets/logo-lightmode.svg'}
                    className="h-8"
                    alt="Syrian Zone"
                  />
                </Link>
              </SheetTitle>
            </SheetHeader>
            <Separator className="my-4" />
            <div className="flex flex-col gap-4 px-10 overflow-y-auto max-h-[calc(100vh-8rem)]">
              {isTransitPage ? (
                <>
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
                  <Link
                    href="/transit/studio"
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                      pathname === '/transit/studio' ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <Sparkles className="h-4 w-4 text-[var(--gold)]" />
                    إضافة خط / الاستوديو
                  </Link>

                  <Separator className="my-2" />
                  <p className="text-xs font-bold text-muted-foreground/60 px-1">أقسام الموقع الأخرى</p>
                  
                  {navLinks.filter(n => n.href !== '/transit').map(({ href, text, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                        pathname === href ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {text}
                    </Link>
                  ))}
                </>
              ) : (
                navLinks.map(({ href, text, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                      pathname === href ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {text}
                  </Link>
                ))
              )}
              <Separator className="my-2" />
              {externalLinks.map(({ href, text, icon: Icon, isFlag, image }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  {isFlag ? (
                    <img src="/flag-replacer/1f1f8-1f1fe.svg" alt="Flag" className="w-4 h-4 ml-2" />
                  ) : image ? (
                    <img src={image} alt={text} className="w-4 h-4 object-contain" />
                  ) : Icon ? (
                    <Icon className="h-4 w-4" />
                  ) : null}
                  {text}
                  <ExternalLink className="h-3 w-3 mr-auto" />
                </a>
              ))}
              <Separator className="my-2" />
              <div className="flex gap-4 justify-start text-xs text-muted-foreground px-2 pt-1 pb-4">
                <Link
                  href="/privacy"
                  onClick={() => setIsOpen(false)}
                  className="hover:text-primary transition-colors"
                >
                  سياسة الخصوصية
                </Link>
                <span>•</span>
                <Link
                  href="/terms"
                  onClick={() => setIsOpen(false)}
                  className="hover:text-primary transition-colors"
                >
                  الشروط والأحكام
                </Link>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background flex items-center justify-center">
              {user ? (
                <UserNav />
              ) : (
                <Button asChild variant="outline" className="w-full gap-2 justify-center">
                  <a href="/auth/google" className="flex items-center gap-2">
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
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
                    <span>تسجيل الدخول بواسطة جوجل</span>
                  </a>
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 flex shrink-0 lg:ml-12">
          <Link href="/" className="flex items-center gap-2">
            <img
              src={isDark ? '/assets/logo-darkmode.svg' : '/assets/logo-lightmode.svg'}
              className="h-10"
              alt="Syrian Zone"
            />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <NavigationMenu className="hidden lg:flex" dir="rtl">
          <NavigationMenuList className="gap-1">
            {isTransitPage ? (
              <>
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <Link
                      href="/transit"
                      className={cn(
                        navigationMenuTriggerStyle(),
                        "bg-transparent hover:bg-accent/50",
                        pathname === '/transit' && "text-primary bg-accent/50"
                      )}
                    >
                      <Bus className="h-4 w-4 ml-2" />
                      الرئيسية
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <Link
                      href="/transit/studio"
                      className={cn(
                        navigationMenuTriggerStyle(),
                        "bg-transparent hover:bg-accent/50",
                        pathname === '/transit/studio' && "text-primary bg-accent/50"
                      )}
                    >
                      <Sparkles className="h-4 w-4 ml-2 text-[var(--gold)]" />
                      إضافة خط / الاستوديو
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent hover:bg-accent/50">أقسام الموقع</NavigationMenuTrigger>
                  <NavigationMenuContent className="text-right">
                    <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                      {navLinks.map(({ href, text, icon: Icon }) => (
                        <li key={href}>
                          <NavigationMenuLink asChild>
                            <Link
                              href={href}
                              className={cn(
                                "group block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                                pathname === href ? "bg-accent/50 text-primary" : ""
                              )}
                            >
                              <div className="flex items-center gap-2 text-sm font-medium leading-none mb-1">
                                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                {text}
                              </div>
                              <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                                انتقل إلى صفحة {text} لمزيد من المعلومات.
                              </p>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      ))}
                      <Separator className="col-span-2 my-2" />
                      {externalLinks.map(({ href, text, icon: Icon, isFlag, image }) => (
                        <li key={href} className="col-span-1">
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 rounded-md p-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            {isFlag ? (
                              <img src="/flag-replacer/1f1f8-1f1fe.svg" alt="Flag" className="w-4 h-4 ml-1" />
                            ) : image ? (
                              <img src={image} alt={text} className="w-4 h-4 object-contain" />
                            ) : Icon ? (
                              <Icon className="h-4 w-4 text-muted-foreground" />
                            ) : null}
                            {text}
                            <ExternalLink className="h-3 w-3 mr-auto opacity-50" />
                          </a>
                        </li>
                      ))}
                      <Separator className="col-span-2 my-2" />
                      <li className="col-span-2 flex justify-center gap-6 text-xs text-muted-foreground py-1">
                        <Link
                          href="/privacy"
                          className="hover:text-primary transition-colors"
                        >
                          سياسة الخصوصية
                        </Link>
                        <span>•</span>
                        <Link
                          href="/terms"
                          className="hover:text-primary transition-colors"
                        >
                          الشروط والأحكام
                        </Link>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </>
            ) : (
              <>
                {navLinks.slice(0, 5).map(({ href, text, icon: Icon }) => (
                  <NavigationMenuItem key={href}>
                    <NavigationMenuLink asChild>
                      <Link
                        href={href}
                        className={cn(
                          navigationMenuTriggerStyle(),
                          "bg-transparent hover:bg-accent/50",
                          pathname === href && "text-primary bg-accent/50"
                        )}
                      >
                        <Icon className="h-4 w-4 ml-2" />
                        {text}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}

                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent hover:bg-accent/50">المزيد</NavigationMenuTrigger>
                  <NavigationMenuContent className="text-right">
                    <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                      {navLinks.slice(5).map(({ href, text, icon: Icon }) => (
                        <li key={href}>
                          <NavigationMenuLink asChild>
                            <Link
                              href={href}
                              className={cn(
                                "group block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                                pathname === href ? "bg-accent/50 text-primary" : ""
                              )}
                            >
                              <div className="flex items-center gap-2 text-sm font-medium leading-none mb-1">
                                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                {text}
                              </div>
                              <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                                انتقل إلى صفحة {text} لمزيد من المعلومات.
                              </p>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      ))}
                      <Separator className="col-span-2 my-2" />
                      {externalLinks.map(({ href, text, icon: Icon, isFlag, image }) => (
                        <li key={href} className="col-span-1">
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 rounded-md p-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            {isFlag ? (
                              <img src="/flag-replacer/1f1f8-1f1fe.svg" alt="Flag" className="w-4 h-4 ml-1" />
                            ) : image ? (
                              <img src={image} alt={text} className="w-4 h-4 object-contain" />
                            ) : Icon ? (
                              <Icon className="h-4 w-4 text-muted-foreground" />
                            ) : null}
                            {text}
                            <ExternalLink className="h-3 w-3 mr-auto opacity-50" />
                          </a>
                        </li>
                      ))}
                      <Separator className="col-span-2 my-2" />
                      <li className="col-span-2 flex justify-center gap-6 text-xs text-muted-foreground py-1">
                        <Link
                          href="/privacy"
                          className="hover:text-primary transition-colors"
                        >
                          سياسة الخصوصية
                        </Link>
                        <span>•</span>
                        <Link
                          href="/terms"
                          className="hover:text-primary transition-colors"
                        >
                          الشروط والأحكام
                        </Link>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </>
            )}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex flex-1 items-center justify-end gap-2">
          <ThemeToggle />
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <div className="h-6 w-[1px] bg-border/50 mx-2" />
                <UserNav />
              </>
            ) : (
              <Button asChild variant="outline" className="gap-2">
                <a href="/auth/google" className="flex items-center gap-2">
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
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
                  <span>تسجيل الدخول</span>
                </a>
              </Button>
            )}
          </div>
          {/* Mobile UserNav if not using sidebar, but here it's in the sidebar bottom bar */}
        </div>
      </div>
    </header>
  );
}
