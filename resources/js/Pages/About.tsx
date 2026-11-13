import React from 'react';
import { Link } from '@inertiajs/react';
import { Info, Heart, Code2, Sparkles, Download, Layers, Users, ExternalLink } from 'lucide-react';
import { Github } from '@/Components/ui/icons';
import MainLayout from '@/Layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Separator } from '@/Components/ui/separator';
import { Button } from '@/Components/ui/button';

interface Contributor {
    login: string;
    avatar: string;
    url: string;
    contributions: number;
}

export default function About({ contributors = [] }: { contributors?: Contributor[] }) {
    return (
        <MainLayout>
            

            <div className="container mx-auto px-4 py-12 max-w-4xl min-h-screen text-foreground">
                <div className="text-center mb-10 space-y-4">
                    <div className="inline-flex p-3 bg-primary/10 rounded-full text-primary mb-2">
                        <Info className="w-10 h-10" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">عن المنصة</h1>
                    <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
                        منصة تفاعلية مفتوحة المصدر للشعب السوري
                    </p>
                </div>

                <div className="space-y-6" dir="rtl">
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-primary" />
                                    عن المساحة السورية (Syrian Zone)
                                </CardTitle>
                                <CardDescription>مبادرة تفاعلية مفتوحة وغير تجارية</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    مرحبًا بكم في <strong>المساحة السورية (Syrian Zone)</strong>! هذا المشروع هو جهد تعاوني مفتوح المصدر يهدف إلى توفير أدوات وموارد متنوعة ومفيدة للمجتمع السوري.
                                </p>
                                <p>
                                    تضم المنصة مجموعة من المشاريع التفاعلية الأساسية:
                                </p>
                                <ul className="list-disc list-inside space-y-1.5 ms-2">
                                    <li><strong>مشوار (Mishwar):</strong> دليل مجتمعي تفاعلي للأماكن، الفنادق، والمرشدين المحليين في مختلف المحافظات.</li>
                                    <li><strong>النقل والمواصلات (Transit):</strong> خرائط تفاعلية لخطوط السرافيس والنقل الداخلي والمواقف واستوديو الرسم التشاركي.</li>
                                    <li><strong>أطلس السكان (Population Atlas):</strong> خرائط ومعلومات ديمغرافية تفاعلية للمحافظات والتقسيمات الإدارية.</li>
                                    <li><strong>تقييم الأداء والحسابات الرسمية:</strong> نظام استطلاعات الرأي (التيير ليست) ودليل الحسابات والأرقام الخدمية الرسمية.</li>
                                </ul>
                                <p>
                                    نهدف من خلال هذا المشروع إلى بناء مساحة برمجية تتميز بالبساطة والقيمة العالية، وسهولة الوصول، والإطلاق السريع للأدوات المفتوحة التي تهم السوريين في الداخل ودول الاغتراب.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Users className="w-5 h-5 text-primary" />
                                    الفريق المؤسس
                                </CardTitle>
                                <CardDescription>بدأ المشروع بمبادرة وتطوير شخصي من</CardDescription>
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
                                            <h2 className="font-bold text-foreground text-base">هادي الأحمد</h2>
                                            <p className="text-xs text-muted-foreground mt-1">مؤسس ومطور رئيسي</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                                        <a
                                            href="https://github.com/hadealahmad"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                                        >
                                            <Github className="w-3.5 h-3.5" /> hadealahmad
                                        </a>
                                        <a
                                            href="https://twitter.com/hadealahmad"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-semibold hover:text-primary"
                                        >
                                            @hadealahmad <ExternalLink className="w-3 h-3" />
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
                                            <h2 className="font-bold text-foreground text-base">نور صوفناتي</h2>
                                            <p className="text-xs text-muted-foreground mt-1">مؤسس ومطور رئيسي</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                                        <a
                                            href="https://github.com/sb-nour"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                                        >
                                            <Github className="w-3.5 h-3.5" /> sb-nour
                                        </a>
                                        <a
                                            href="https://twitter.com/Nour_Sofanati"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-semibold hover:text-primary"
                                        >
                                            @Nour_Sofanati <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Heart className="w-5 h-5 text-rose-500 fill-rose-500/20" />
                                    المساهمون والإسنادات (Contributors)
                                </CardTitle>
                                <CardDescription>نخص بالذكر والشكر جميع المساهمين الرائعين في هذا المشروع</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">مكدوس (@macdoos)</span>
                                        <span className="text-muted-foreground">ساهم بتطوير قسم تقييم الوزراء والمسؤولين بالكامل.</span>
                                    </div>

                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">الحارث الموسى (@tirh25)</span>
                                        <span className="text-muted-foreground">قام بإضافة وتوثيق قاعدة بيانات الحسابات الرسمية السورية.</span>
                                    </div>

                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">haiueida (@haiueida)</span>
                                        <span className="text-muted-foreground">وفر الترجمة الكردية لصفحة الحسابات الرسمية.</span>
                                    </div>

                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">Waleed Khamees (@WaleedKhamees)</span>
                                        <span className="text-muted-foreground">ساهم في ضغط الصور وتحسين أداء سرعة الموقع.</span>
                                    </div>

                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">SourceM7</span>
                                        <span className="text-muted-foreground">ساهم بتطوير أطلس سوريا وتطوير وتصميم الصفحة الرئيسية.</span>
                                    </div>

                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">وحيد شعّار (@WaheedShaar)</span>
                                        <span className="text-muted-foreground">وفر النسخة الهندسية DWG للعلم السوري في الهوية البصرية.</span>
                                    </div>

                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">عبدالرحمن حداد (@abd_hmh)</span>
                                        <span className="text-muted-foreground">وفر الدليل الإرشادي لتفاصيل وأبعاد العلم السوري.</span>
                                    </div>

                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">ولاء (@walaa_akdesign)</span>
                                        <span className="text-muted-foreground">
                                            قامت بتصميم حزمة أيقونات المعالم البصرية للمحافظات السورية (تابعها على{" "}
                                            <a href="https://x.com/walaa_akdesign" target="_blank" rel="noreferrer" className="hover:text-primary underline">X / Twitter</a>
                                            {" و "}
                                            <a href="https://www.instagram.com/walaa_akdesign/" target="_blank" rel="noreferrer" className="hover:text-primary underline">Instagram</a>
                                            ).
                                        </span>
                                    </div>

                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">يوري دندشي (@yuri.dandashi)</span>
                                        <span className="text-muted-foreground">تصميم الشعار وأيقونة الموقع والهوية البصرية العامة.</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {contributors.length > 0 && (
                            <Card className="border-border bg-card/50 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                                        <Github className="w-5 h-5 text-primary" />
                                        مساهمو GitHub
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-3">
                                        {contributors.map((c) => (
                                            <a
                                                key={c.login}
                                                href={c.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                title={`${c.login} — ${c.contributions} مساهمة`}
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
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Code2 className="w-5 h-5 text-primary" />
                                    مشروع مفتوح المصدر (MIT License)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    هذا المشروع مرخص تحت رخصة <strong>MIT License</strong> الحرة ومتاحة شفرته المصدرية للجميع على منصة GitHub.
                                </p>
                                <div className="flex flex-wrap gap-3 pt-2">
                                    <Button variant="outline" asChild size="sm" className="gap-2">
                                        <a href="https://github.com/syrianzone/syrianzone" target="_blank" rel="noreferrer">
                                            <Github className="w-4 h-4" />
                                            المستودع على GitHub
                                        </a>
                                    </Button>
                                    <Button variant="outline" asChild size="sm" className="gap-2">
                                        <a href="https://pub-1d51b625c56e4fd085c58a79672e1b15.r2.dev/downloads/brandkit-y5sZMu.zip" target="_blank" rel="noreferrer">
                                            <Download className="w-4 h-4" />
                                            تحميل الهوية البصرية (Brand Kit)
                                        </a>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-primary" />
                                    حقوق الموارد والأيقونات (Attributions)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-xs leading-relaxed text-muted-foreground space-y-2">
                                <p>الأيقونات المستعملة في أدوات ومشاريع المنصة مأخوذة من مجموعات Streamline Icons ومتاحة بموجب رخصة Creative Commons Attribution 4.0 International (CC BY 4.0).</p>
                                <p>أيقونات واجهة المستخدم مأخوذة من Lucide عبر lucide-react بموجب رخصة ISC.</p>
                                <p>صور شخصيات «بوصلة سوريا» مصدرها Wikimedia Commons وWikipedia — أغلبها في الملكية العامة، وبعضها بموجب رخص CC BY وCC BY-SA. القائمة الكاملة بالمصادر والرخص في ملف credits.json ضمن مجلد الصور.</p>
                                <p>بيانات الخرائط التفاعلية في الترانزيت ومشوار مستندة إلى OpenStreetMap وMapLibre GL JS بموجب رخصة ODbL / Open Data Commons.</p>
                                <p>نص مصحف المدينة بخط حفص والخط العثماني في الركن الإسلامي من مجمع الملك فهد لطباعة المصحف الشريف، وعلامة نهاية الآية من مشروع quranpedia/ayah-markers.</p>
                                <p>التلاوات الصوتية وتوقيتات الآيات والكلمات والحروف مقدَّمة عبر واجهة MP3Quran v4 (ملفات الصوت من cdn.mp3quran.net) مع EveryAyah كمصدر احتياطي، ومواقيت الصلاة عبر Aladhan API، وبيانات الطقس من Open-Meteo وOpenWeatherMap، وتحديد الموقع التقريبي عبر ipwho.is.</p>
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
            </div>
        </MainLayout>
    );
}
