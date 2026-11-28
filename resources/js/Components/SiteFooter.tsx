import React from 'react';
import { Link } from '@inertiajs/react';
import { Logo } from '@/Components/brand/Logo';

const FOOTER_COLUMNS = [
    {
        title: 'اليوم والخدمات',
        links: [
            { href: '/roznama', label: 'الروزنامة' },
            { href: '/muslim', label: 'الركن الإسلامي' },
            { href: '/currency', label: 'محوّل الليرة' },
            { href: '/phonebook', label: 'دليل الهاتف' },
            { href: '/crossings', label: 'المنافذ الحدودية' },
        ],
    },
    {
        title: 'سوريا والخرائط',
        links: [
            { href: '/transit', label: 'ترانزيت' },
            { href: '/mishwar', label: 'مشوار' },
            { href: '/governorates', label: 'محافظات سوريا' },
            { href: '/atlas', label: 'أطلس السكان' },
            { href: '/wild', label: 'الحياة البرية' },
        ],
    },
    {
        title: 'الدولة والمرصد',
        links: [
            { href: '/ministries', label: 'وزارات سوريا' },
            { href: '/govtcvs', label: 'السير الذاتية' },
            { href: '/promises', label: 'عداد الوعود' },
            { href: '/house', label: 'مجلس الشعب 2026' },
            { href: '/syofficial', label: 'الحسابات الرسمية' },
        ],
    },
    {
        title: 'المنصة',
        links: [
            { href: '/about', label: 'عن المنصة' },
            { href: '/stats', label: 'الإحصائيات' },
            { href: '/syid', label: 'الهوية البصرية' },
            { href: '/privacy', label: 'سياسة الخصوصية' },
            { href: '/terms', label: 'الشروط والأحكام' },
        ],
    },
] as const;

const SiteFooter = React.memo(function SiteFooter() {
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
});

export default SiteFooter;
