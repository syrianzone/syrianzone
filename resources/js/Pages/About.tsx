import React from 'react';
import { Link } from '@inertiajs/react';
import { Heart, Code2, Sparkles, Download, Layers, Users, ExternalLink } from 'lucide-react';
import { Github } from '@/Components/ui/icons';
import MainLayout from '@/Layouts/MainLayout';
import { Card, CardContent, CardHeader, CardDescription } from '@/Components/ui/card';
import { Separator } from '@/Components/ui/separator';
import { Button } from '@/Components/ui/button';
import { MEDIA_BASE } from '@/Domain/govapps/media';
import { PageHeader, ReaderLayout } from '@/Components/layout';

interface Contributor {
    login: string;
    avatar: string;
    url: string;
    contributions: number;
}

export default function About({ contributors = [] }: { contributors?: Contributor[] }) {
    return (
        <MainLayout>
            <PageHeader
                width="narrow"
                divider
                title="عن المساحة السورية"
                description="مبادرة مجتمعية مفتوحة المصدر وغير تجارية تجمع الأدوات والبيانات السورية في مكان واحد."
            />

            <ReaderLayout>
                <div className="space-y-6" dir="rtl">
                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-primary" aria-hidden="true" />
                                عن المساحة السورية (Syrian Zone)
                            </h2>
                            <CardDescription>مبادرة تفاعلية مفتوحة وغير تجارية</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                            <p>
                                أهلاً بكم في <strong>المساحة السورية (Syrian Zone)</strong>. هذا المشروع جهد تعاوني مفتوح المصدر يهدف إلى توفير أدوات رقمية وبيانات موثّقة وموارد مفيدة للمجتمع السوري.
                            </p>
                            <p>
                                تجمع المنصة أقساماً وأدوات متعددة في تجربة واحدة:
                            </p>
                            <ul className="list-disc list-inside space-y-1.5 ms-2">
                                <li><strong>الدولة والمرصد:</strong> عداد الوعود، والسير الذاتية للمسؤولين، ووزارات سوريا، ومجلس الشعب 2026، والحسابات الرسمية، وبوصلة سوريا، والعدالة الانتقالية.</li>
                                <li><strong>الخرائط والجغرافيا:</strong> مشوار للأماكن والفنادق، وترانزيت لخطوط النقل العام واستوديو الرسم التشاركي، ومحافظات سوريا، وأطلس السكان، والحياة البرية.</li>
                                <li><strong>اليوم والخدمات:</strong> الروزنامة، والركن الإسلامي (مواقيت الصلاة والقرآن الكريم وإذاعة القرآن)، والمنافذ الحدودية، ومحوّل الليرة، ودليل الهاتف، والتطبيقات الحكومية، ولوح الأدوات اليومية.</li>
                                <li><strong>التفاعل والهوية:</strong> الألعاب الجماعية والفردية ومنها «من هو؟» و«هل تميّزها؟»، وتقييم الحكومة، وأولويات سوريا، ودليل الهوية البصرية السورية، مع 14 مظهراً قابلاً للتخصيص.</li>
                                <li><strong>البيانات المفتوحة:</strong> واجهات برمجية عامة للقراءة فقط (<span dir="ltr">/api/v1/*</span>) وخادم MCP عام (<span dir="ltr">/mcp/public</span>) للمطورين والباحثين.</li>
                            </ul>
                            <p>
                                نسعى من خلال هذا المشروع إلى بناء مساحة رقمية تتسم بالبساطة والقيمة العالية وسهولة الوصول، وإطلاق أدوات مفتوحة تخدم السوريين في الداخل وفي الاغتراب.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <Users className="w-5 h-5 text-primary" aria-hidden="true" />
                                الفريق المؤسس
                            </h2>
                            <CardDescription>بدأ المشروع بمبادرة شخصية وتطوير من</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex flex-col">
                                <div className="flex items-center gap-3">
                                    <img
                                        src="https://github.com/hadealahmad.png?size=160"
                                        alt="هادي الأحمد"
                                        loading="lazy"
                                        className="h-14 w-14 shrink-0 rounded-full border border-border bg-muted object-cover"
                                    />
                                    <div>
                                        <h3 className="font-bold text-foreground text-base">هادي الأحمد</h3>
                                        <p className="text-xs text-muted-foreground mt-1">مؤسس ومطور رئيسي</p>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                                    <a
                                        href="https://github.com/hadealahmad"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                                    >
                                        <Github className="w-3.5 h-3.5" aria-hidden="true" /> hadealahmad
                                    </a>
                                    <a
                                        href="https://twitter.com/hadealahmad"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-semibold hover:text-primary"
                                    >
                                        @hadealahmad <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                    </a>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex flex-col">
                                <div className="flex items-center gap-3">
                                    <img
                                        src="https://github.com/sb-nour.png?size=160"
                                        alt="نور صوفناتي"
                                        loading="lazy"
                                        className="h-14 w-14 shrink-0 rounded-full border border-border bg-muted object-cover"
                                    />
                                    <div>
                                        <h3 className="font-bold text-foreground text-base">نور صوفناتي</h3>
                                        <p className="text-xs text-muted-foreground mt-1">مؤسس ومطور رئيسي</p>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                                    <a
                                        href="https://github.com/sb-nour"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                                    >
                                        <Github className="w-3.5 h-3.5" aria-hidden="true" /> sb-nour
                                    </a>
                                    <a
                                        href="https://twitter.com/Nour_Sofanati"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-semibold hover:text-primary"
                                    >
                                        @Nour_Sofanati <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                    </a>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <Heart className="w-5 h-5 text-rose-500 fill-rose-500/20" aria-hidden="true" />
                                المساهمون والإسنادات (Contributors)
                            </h2>
                            <CardDescription>نخص بالذكر والشكر جميع المساهمين في هذا المشروع</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                    <span className="font-bold text-foreground block mb-0.5">مكدوس (@macdoos)</span>
                                    <span className="text-muted-foreground">أسهم في تطوير قسم تقييم الوزراء والمسؤولين بالكامل.</span>
                                </div>

                                <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                    <span className="font-bold text-foreground block mb-0.5">الحارث الموسى (@tirh25)</span>
                                    <span className="text-muted-foreground">أضاف قاعدة بيانات الحسابات الرسمية السورية ووثّقها.</span>
                                </div>

                                <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                    <span className="font-bold text-foreground block mb-0.5">haiueida (@haiueida)</span>
                                    <span className="text-muted-foreground">وفّر الترجمة الكردية لصفحة الحسابات الرسمية.</span>
                                </div>

                                <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                    <span className="font-bold text-foreground block mb-0.5">Waleed Khamees (@WaleedKhamees)</span>
                                    <span className="text-muted-foreground">أسهم في ضغط الصور وتحسين سرعة الموقع وأدائه.</span>
                                </div>

                                <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                    <span className="font-bold text-foreground block mb-0.5">SourceM7</span>
                                    <span className="text-muted-foreground">أسهم في تطوير أطلس سوريا، وتطوير الصفحة الرئيسية وتصميمها.</span>
                                </div>

                                <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                    <span className="font-bold text-foreground block mb-0.5">وحيد شعّار (@WaheedShaar)</span>
                                    <span className="text-muted-foreground">وفّر النسخة الهندسية DWG للعلم السوري في الهوية البصرية.</span>
                                </div>

                                <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                    <span className="font-bold text-foreground block mb-0.5">عبد الرحمن حداد (@abd_hmh)</span>
                                    <span className="text-muted-foreground">وفّر الدليل الإرشادي لتفاصيل العلم السوري وأبعاده.</span>
                                </div>

                                <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                    <span className="font-bold text-foreground block mb-0.5">ولاء (@walaa_akdesign)</span>
                                    <span className="text-muted-foreground">
                                        صمّمت حزمة أيقونات المعالم البصرية للمحافظات السورية (تابعها على{' '}
                                        <a href="https://x.com/walaa_akdesign" target="_blank" rel="noreferrer" className="hover:text-primary underline">X</a>
                                        {' و'}
                                        <a href="https://www.instagram.com/walaa_akdesign/" target="_blank" rel="noreferrer" className="hover:text-primary underline">Instagram</a>
                                        ).
                                    </span>
                                </div>

                                <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                    <span className="font-bold text-foreground block mb-0.5">يوري دندشي (@yuri.dandashi)</span>
                                    <span className="text-muted-foreground">صمّم الشعار وأيقونة الموقع والهوية البصرية العامة.</span>
                                </div>

                                <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                    <span className="font-bold text-foreground block mb-0.5">عمر البيك (@omaralbeik)</span>
                                    <span className="text-muted-foreground">
                                        طوّر عداد الوعود، وحسّن أداء الموقع وأمانه وظهوره في محركات البحث (تابعه على{' '}
                                        <a href="https://x.com/omaralbeik" target="_blank" rel="noreferrer" className="hover:text-primary underline">X</a>
                                        {' و'}
                                        <a href="https://omaralbeik.com" target="_blank" rel="noreferrer" className="hover:text-primary underline">موقعه الشخصي</a>
                                        ).
                                    </span>
                                </div>

                                <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                    <span className="font-bold text-foreground block mb-0.5">
                                        <a href="https://www.verify-sy.com/ar" target="_blank" rel="noopener noreferrer" className="hover:text-primary underline">منصة تأكد (Verify-Sy)</a>
                                    </span>
                                    <span className="text-muted-foreground">تستند غالبية مواد التحقّق في لعبة «هل تميّزها؟» إلى تقاريرها المنشورة.</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {contributors.length > 0 && (
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                    <Github className="w-5 h-5 text-primary" aria-hidden="true" />
                                    مساهمو GitHub
                                </h2>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-3">
                                    {contributors.map((c) => (
                                        <a
                                            key={c.login}
                                            href={c.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={`${c.login}: ${c.contributions} مساهمة`}
                                            className="group flex items-center gap-2.5 rounded-full border border-border/50 bg-muted/20 py-1.5 pe-3 ps-1.5 transition-colors hover:border-primary/40 hover:bg-muted/40"
                                        >
                                            <img
                                                src={c.avatar}
                                                alt={c.login}
                                                loading="lazy"
                                                className="h-8 w-8 shrink-0 rounded-full border border-border bg-muted object-cover"
                                            />
                                            <span className="text-xs font-semibold text-foreground transition-colors group-hover:text-primary" dir="ltr">
                                                {c.login}
                                            </span>
                                            <span className="text-[11px] tabular-nums text-muted-foreground">{c.contributions}</span>
                                        </a>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <Code2 className="w-5 h-5 text-primary" aria-hidden="true" />
                                مشروع مفتوح المصدر (MIT License)
                            </h2>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                            <p>
                                هذا المشروع مرخّص برخصة <strong>MIT License</strong> الحرة، وشيفرته المصدرية متاحة للجميع على منصة GitHub.
                            </p>
                            <div className="flex flex-wrap gap-3 pt-2">
                                <Button variant="outline" asChild size="sm" className="gap-2">
                                    <a href="https://github.com/syrianzone/syrianzone" target="_blank" rel="noopener noreferrer">
                                        <Github className="w-4 h-4" aria-hidden="true" />
                                        المستودع على GitHub
                                    </a>
                                </Button>
                                <Button variant="outline" asChild size="sm" className="gap-2">
                                    <a href={`${MEDIA_BASE}/downloads/brandkit-y5sZMu.zip`} target="_blank" rel="noopener noreferrer">
                                        <Download className="w-4 h-4" aria-hidden="true" />
                                        تنزيل الهوية البصرية (Brand Kit)
                                    </a>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <Layers className="w-5 h-5 text-primary" aria-hidden="true" />
                                حقوق الموارد والأيقونات (Attributions)
                            </h2>
                        </CardHeader>
                        <CardContent className="text-xs leading-relaxed text-muted-foreground space-y-2">
                            <p>الأيقونات المستعملة في أدوات المنصة ومشاريعها مأخوذة من مجموعات Streamline Icons ومتاحة بموجب رخصة Creative Commons Attribution 4.0 International (CC BY 4.0).</p>
                            <p>أيقونات واجهة المستخدم مأخوذة من Lucide عبر lucide-react بموجب رخصة ISC.</p>
                            <p>صور شخصيات «بوصلة سوريا» مصدرها Wikimedia Commons وWikipedia، أغلبها في الملكية العامة، وبعضها بموجب رخص CC BY وCC BY-SA. القائمة الكاملة بالمصادر والرخص محفوظة في ملف credits.json ضمن مجلد الصور.</p>
                            <p>بيانات الخرائط التفاعلية في «ترانزيت» و«مشوار» مستندة إلى OpenStreetMap وMapLibre GL JS بموجب رخصة ODbL / Open Data Commons.</p>
                            <p>نص مصحف المدينة بخط حفص والرسم العثماني في الركن الإسلامي من مجمع الملك فهد لطباعة المصحف الشريف، وعلامة نهاية الآية من مشروع quranpedia/ayah-markers.</p>
                            <p>التلاوات الصوتية وتوقيتات الآيات والكلمات والحروف مقدَّمة عبر واجهة MP3Quran v4 (ملفات الصوت من cdn.mp3quran.net) مع EveryAyah مصدراً احتياطياً، ومواقيت الصلاة عبر AlAdhan API، وبيانات الطقس والمناخ من Open-Meteo وOpenWeatherMap وNASA POWER وWorld Bank Climate API، وتحديد الموقع التقريبي عبر ipwho.is.</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="mt-12 text-center text-xs text-muted-foreground">
                    <Separator className="my-6" />
                    <div className="flex justify-center gap-6">
                        <Link href="/privacy" className="hover:text-primary transition-colors">سياسة الخصوصية</Link>
                        <span>•</span>
                        <Link href="/terms" className="hover:text-primary transition-colors">الشروط والأحكام</Link>
                    </div>
                </div>
            </ReaderLayout>
        </MainLayout>
    );
}
