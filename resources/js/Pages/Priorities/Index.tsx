import React from 'react';
import { Globe } from 'lucide-react';
import { Head } from '@inertiajs/react';
import PrioritiesApp from './PrioritiesApp';
import MainLayout from '@/Layouts/MainLayout';

export default function PrioritiesPage() {
    return (
        <MainLayout>
            <Head>
                <title>أولويات سوريا المستقبل | Syrian Zone</title>
                <meta name="description" content="رتب أولوياتك للجمهورية العربية السورية المستقبلية وشاركها مع المجتمع عبر بطاقات مخصصة وتفاعلية." />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="أولويات سوريا المستقبل | Syrian Zone" />
                <meta property="og:description" content="رتب أولوياتك للجمهورية العربية السورية المستقبلية وشاركها مع المجتمع عبر بطاقات مخصصة وتفاعلية." />
            </Head>
            <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
                {/* Hero Section */}
                <section className="bg-card py-12 shadow-sm border-b border-border relative z-0">
                    <div className="container mx-auto px-4 text-center">
                        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">أولويات سوريا المستقبل</h1>
                        <p className="text-xl text-muted-foreground">اصنع بطاقة تخبر الناس فيها عن أولوياتك لسوريا الحرة</p>
                    </div>
                </section>

                <main className="flex-1 container mx-auto px-4 py-8 relative z-10 max-w-7xl">
                    <PrioritiesApp />
                </main>

                <footer className="footer py-8 border-t border-border bg-card mt-auto">
                    <div className="container mx-auto px-4 text-center">

                        <p className="mt-2 text-sm text-muted-foreground">
                            تم التطوير بواسطة <span className="font-semibold text-foreground">هادي الأحمد</span>
                        </p>
                        <div className="mt-4 flex justify-center gap-6">
                            <a
                                href="http://hadealahmad.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="footer-link flex items-center hover:text-primary transition-colors text-muted-foreground text-xs"
                            >
                                <Globe className="w-4 h-4 ml-1" /> الموقع الشخصي
                            </a>
                            <a
                                href="https://x.com/hadealahmad"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="footer-link flex items-center hover:text-primary transition-colors text-muted-foreground text-xs"
                            >
                                <span className="ml-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                </span>
                                حساب X
                            </a>
                        </div>
                    </div>
                </footer>
            </div>
        </MainLayout>
    );
}
