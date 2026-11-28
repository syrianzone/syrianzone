import { Link } from '@inertiajs/react';
import { Logo } from '@/Components/brand/Logo';

const FOOTER_COLUMNS = [
    {
        title: 'أدوات يومية',
        links: [
            { href: '/roznama', label: 'الروزنامة السورية' },
            { href: '/currency', label: 'تحويل الليرة' },
            { href: '/muslim', label: 'الركن الإسلامي' },
            { href: '/board', label: 'لوحتي' },
        ],
    },
    {
        title: 'الدولة والشأن العام',
        links: [
            { href: '/promises', label: 'عداد الوعود' },
            { href: '/ministries', label: 'وزارات سوريا' },
            { href: '/govtcvs', label: 'السير الذاتية' },
            { href: '/house', label: 'مجلس الشعب 2026' },
        ],
    },
    {
        title: 'الأدلة والهوية',
        links: [
            { href: '/phonebook', label: 'دليل الهاتف والواتساب' },
            { href: '/syofficial', label: 'الحسابات الرسمية' },
            { href: '/govapps', label: 'تطبيقات حكومية' },
            { href: '/syid', label: 'الهوية البصرية' },
        ],
    },
    {
        title: 'المنصة',
        links: [
            { href: '/about', label: 'عن المنصة' },
            { href: '/stats', label: 'الإحصائيات' },
            { href: '/privacy', label: 'سياسة الخصوصية' },
            { href: '/terms', label: 'الشروط والأحكام' },
        ],
    },
] as const;

export default function SiteFooter() {
    return (
        <footer
            className="border-t border-border bg-background text-foreground"
            dir="rtl"
        >
            <div className="mx-auto w-full max-w-[76rem] px-4 py-10 md:px-8 md:py-12">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
                    <div className="space-y-3 md:col-span-4">
                        <Link href="/" className="inline-flex items-center">
                            <Logo className="h-8 w-auto" title="المساحة السورية" />
                        </Link>
                        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                            مبادرة مجتمعية مفتوحة المصدر وغير تجارية تجمع الأدوات والبيانات والخدمات السورية في مكان واحد.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 md:col-span-8">
                        {FOOTER_COLUMNS.map((col) => (
                            <nav key={col.title} aria-label={col.title} className="space-y-2.5">
                                <p className="font-display text-sm font-bold text-foreground">
                                    {col.title}
                                </p>
                                <ul className="space-y-1.5">
                                    {col.links.map((item) => (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                                            >
                                                {item.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </nav>
                        ))}
                    </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5 text-xs text-muted-foreground">
                    <span>المساحة السورية — مبادرة مجتمعية مفتوحة المصدر</span>
                    <span dir="ltr" className="font-mono text-[11px] tabular-nums">
                        syrian.zone
                    </span>
                </div>
            </div>
        </footer>
    );
}
