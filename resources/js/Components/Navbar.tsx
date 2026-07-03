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

const navLinks = [
  { href: '/syofficial', text: 'الحسابات الرسمية', icon: CheckCircle2 },
  { href: '/roznama', text: 'الروزنامة', icon: Calendar },
  { href: '/phonebook', text: 'دليل الهاتف', icon: Phone },
  { href: '/syid', text: 'الهوية البصرية', icon: Palette },
  { href: '/tierlist', text: 'تقييم الحكومة', icon: ListOrdered },
  { href: '/syrian-contributors', text: 'المساهمون', icon: Code2 },
  { href: '/sites', text: 'دليل المواقع', icon: LinkIcon },
  { href: '/population', text: 'أطلس', icon: Globe },
  { href: '/party', text: 'دليل الأحزاب', icon: Users2 },
  { href: '/house', text: 'المجلس التشريعي', icon: Landmark },
  { href: '/compass', text: 'البوصلة السياسية', icon: Compass },
  { href: '/priorities', text: 'أولويات سوريا', icon: Sliders },
  { href: '/alignment', text: 'بوصلة مخصصة', icon: Crosshair },
  { href: '/govapps', text: 'تطبيقات الحكومة', icon: Smartphone },
  { href: '/transit', text: 'ترانزيت', icon: Bus },
  { href: '/shawarma', text: 'تير ليست الشاورما', icon: Sandwich },
  { href: '/justice', text: 'العدالة الانتقالية', icon: Scale },
];

const externalLinks = [
  { href: 'https://news.jard.chat', text: 'أخبار سوريا', icon: Newspaper },
  { href: 'https://wrraq.com', text: 'المنتدى', icon: MessageSquare },
  { href: 'https://food.syrian.zone', text: 'وصفاتنا', icon: Utensils },
  { href: 'https://discord.gg/NqE8849VzA', text: 'مجتمع كوديكس', icon: MessageSquareCode },
  { href: 'https://chromewebstore.google.com/detail/syrian-flag-replacer/dngipobppehfhfggmbdiiiodgcibdeog', text: 'مبدل العلم', isFlag: true },
];

export default function Navbar() {
  const { url } = usePage();
  const pathname = url.split('?')[0];
  const [isOpen, setIsOpen] = React.useState(false);
  const [theme, setTheme] = React.useState('dark');
  const { user } = useAuth();

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
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
                    src={theme === 'light' ? '/assets/logo-lightmode.svg' : '/assets/logo-darkmode.svg'}
                    className="h-8"
                    alt="Syrian Zone"
                  />
                </Link>
              </SheetTitle>
            </SheetHeader>
            <Separator className="my-4" />
            <div className="flex flex-col gap-4 px-10 overflow-y-auto max-h-[calc(100vh-8rem)]">
              {navLinks.map(({ href, text, icon: Icon }) => (
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
              <Separator className="my-2" />
              {externalLinks.map(({ href, text, icon: Icon, isFlag }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  {isFlag ? (
                    <img src="/flag-replacer/1f1f8-1f1fe.svg" alt="Flag" className="w-4 h-4 ml-2" />
                  ) : Icon ? (
                    <Icon className="h-4 w-4" />
                  ) : null}
                  {text}
                  <ExternalLink className="h-3 w-3 mr-auto" />
                </a>
              ))}
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background flex items-center justify-end">
              <UserNav />
            </div>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 flex shrink-0 lg:ml-12">
          <Link href="/" className="flex items-center gap-2">
            <img
              src={theme === 'light' ? '/assets/logo-lightmode.svg' : '/assets/logo-darkmode.svg'}
              className="h-10"
              alt="Syrian Zone"
            />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <NavigationMenu className="hidden lg:flex" dir="rtl">
          <NavigationMenuList className="gap-1">
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
                  {externalLinks.map(({ href, text, icon: Icon, isFlag }) => (
                    <li key={href} className="col-span-1">
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-md p-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        {isFlag ? (
                          <img src="/flag-replacer/1f1f8-1f1fe.svg" alt="Flag" className="w-4 h-4 ml-1" />
                        ) : Icon ? (
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        ) : null}
                        {text}
                        <ExternalLink className="h-3 w-3 mr-auto opacity-50" />
                      </a>
                    </li>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex flex-1 items-center justify-end gap-2">
          <ThemeToggle />
          <div className="hidden md:flex items-center gap-2">
            {user && <div className="h-6 w-[1px] bg-border/50 mx-2" />}
            <UserNav />
          </div>
          {/* Mobile UserNav if not using sidebar, but here it's in the sidebar bottom bar */}
        </div>
      </div>
    </header>
  );
}
