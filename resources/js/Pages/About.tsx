import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { Info, Heart, Code2, Shield, Globe, Sparkles, Download, Layers, Users, ExternalLink } from 'lucide-react';
import { Github } from '@/Components/ui/icons';
import MainLayout from '@/Layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import { Separator } from '@/Components/ui/separator';
import { Button } from '@/Components/ui/button';

export default function About() {
    return (
        <MainLayout>
            <Head>
                <title>عن المنصة | About Syrian Zone</title>
                <meta name="description" content="تعرف على منصة المساحة السورية (Syrian Zone) - مشروع تفاعلي غير تجاري ومفتوح المصدر يقدم أدوات وموارد بالشأن السوري." />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="عن المنصة | About Syrian Zone" />
                <meta property="og:description" content="تعرف على منصة المساحة السورية (Syrian Zone) - مشروع تفاعلي غير تجاري ومفتوح المصدر يقدم أدوات وموارد بالشأن السوري." />
            </Head>

            <div className="container mx-auto px-4 py-12 max-w-4xl min-h-screen text-foreground">
                {/* Page Header */}
                <div className="text-center mb-10 space-y-4">
                    <div className="inline-flex p-3 bg-primary/10 rounded-full text-primary mb-2">
                        <Info className="w-10 h-10" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">عن المنصة | About Syrian Zone</h1>
                    <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
                        منصة تفاعلية مفتوحة المصدر للشعب السوري | Open-source interactive space for Syria
                    </p>
                </div>

                <Tabs defaultValue="ar" className="w-full" dir="rtl">
                    <div className="flex justify-center mb-8">
                        <TabsList className="grid w-[240px] grid-cols-2">
                            <TabsTrigger value="ar" className="font-bold">العربية</TabsTrigger>
                            <TabsTrigger value="en" className="font-bold">English</TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Arabic Content */}
                    <TabsContent value="ar" className="space-y-6 text-right" dir="rtl">
                        {/* Overview Card */}
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
                                <ul className="list-disc list-inside space-y-1.5 mr-2">
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

                        {/* Founders Card */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Users className="w-5 h-5 text-primary" />
                                    الفريق المؤسس
                                </CardTitle>
                                <CardDescription>بدأ المشروع بمبادرة وتطوير شخصي من</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex flex-col justify-between">
                                    <div>
                                        <h4 className="font-bold text-foreground text-base">هادي الأحمد</h4>
                                        <p className="text-xs text-muted-foreground mt-1">مؤسس ومطور رئيسي</p>
                                    </div>
                                    <a
                                        href="https://twitter.com/hadealahmad"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline mt-3"
                                    >
                                        @hadealahmad <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>

                                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex flex-col justify-between">
                                    <div>
                                        <h4 className="font-bold text-foreground text-base">نور صوفناتي</h4>
                                        <p className="text-xs text-muted-foreground mt-1">مؤسس ومطور رئيسي</p>
                                    </div>
                                    <a
                                        href="https://twitter.com/Nour_Sofanati"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline mt-3"
                                    >
                                        @Nour_Sofanati <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Contributors & Credits Card */}
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
                                        <span className="font-bold text-foreground block mb-0.5">يوري دندشي (@yuri.dandashi)</span>
                                        <span className="text-muted-foreground">تصميم الشعار وأيقونة الموقع والهوية البصرية العامة.</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Open Source & License Card */}
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

                        {/* Resource Attributions */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-primary" />
                                    حقوق الموارد والأيقونات (Attributions)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-xs leading-relaxed text-muted-foreground space-y-2">
                                <p>الأيقونات المستعملة في أدوات ومشاريع المنصة مأخوذة من مجموعات Streamline Icons ومتاحة بموجب رخصة Creative Commons Attribution 4.0 International (CC BY 4.0).</p>
                                <p>بيانات الخرائط التفاعلية في الترانزيت ومشوار مستندة إلى OpenStreetMap وMapLibre GL JS بموجب رخصة ODbL / Open Data Commons.</p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* English Content */}
                    <TabsContent value="en" className="space-y-6 text-left" dir="ltr">
                        {/* Overview Card */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-primary" />
                                    About Syrian Zone
                                </CardTitle>
                                <CardDescription>Non-commercial open-source community platform</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    Welcome to <strong>Syrian Zone (المساحة السورية)</strong>! This project is an open-source collaborative effort aimed at building open resources, interactive tools, and data hubs for the Syrian community.
                                </p>
                                <p>
                                    Key platform features include:
                                </p>
                                <ul className="list-disc list-inside space-y-1.5 ml-2">
                                    <li><strong>Mishwar:</strong> Interactive community guide for local places, hotels, and guides across Syrian governorates.</li>
                                    <li><strong>Transit & Navigation:</strong> Interactive maps for public microbus lines, stops, and collaborative route studio drawing.</li>
                                    <li><strong>Population Atlas:</strong> Interactive demographic maps and administrative divisions.</li>
                                    <li><strong>Community Evaluations & Official Accounts:</strong> Cabinet performance tierlists, public polls, and official directory hub.</li>
                                </ul>
                                <p>
                                    We aim to create high-value, accessible, and lightweight open software solutions for Syrians locally and across the diaspora.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Founders Card */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Users className="w-5 h-5 text-primary" />
                                    Founders
                                </CardTitle>
                                <CardDescription>Initiated and maintained by</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex flex-col justify-between">
                                    <div>
                                        <h4 className="font-bold text-foreground text-base">Hadi Alahmad</h4>
                                        <p className="text-xs text-muted-foreground mt-1">Co-founder & Lead Developer</p>
                                    </div>
                                    <a
                                        href="https://twitter.com/hadealahmad"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline mt-3"
                                    >
                                        @hadealahmad <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>

                                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex flex-col justify-between">
                                    <div>
                                        <h4 className="font-bold text-foreground text-base">Nour Sofanati</h4>
                                        <p className="text-xs text-muted-foreground mt-1">Co-founder & Lead Developer</p>
                                    </div>
                                    <a
                                        href="https://twitter.com/Nour_Sofanati"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline mt-3"
                                    >
                                        @Nour_Sofanati <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Contributors & Credits Card */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Heart className="w-5 h-5 text-rose-500 fill-rose-500/20" />
                                    Contributors & Credits
                                </CardTitle>
                                <CardDescription>Special thanks to our awesome community contributors</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">Makdoos (@macdoos)</span>
                                        <span className="text-muted-foreground">Developed the complete Cabinet Tierlist & evaluation feature.</span>
                                    </div>

                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">Al-Harith Al-Mousa (@tirh25)</span>
                                        <span className="text-muted-foreground">Populated official Syrian government accounts database.</span>
                                    </div>

                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">Abdulrahman Haddad (@abd_hmh)</span>
                                        <span className="text-muted-foreground">Supplied Syrian flag proportion specifications and guidelines manual.</span>
                                    </div>

                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">
                                            <a href="https://www.instagram.com/walaa_akdesign/" target="_blank" rel="noreferrer" className="hover:text-primary underline">
                                                Walaa (@walaa_akdesign)
                                            </a>
                                        </span>
                                        <span className="text-muted-foreground">Designed the Syrian governorates visual landmark icons package in SyId.</span>
                                    </div>

                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">haiueida (@haiueida)</span>
                                        <span className="text-muted-foreground">Provided Kurdish translations for SyOfficial.</span>
                                    </div>

                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">Waleed Khamees (@WaleedKhamees)</span>
                                        <span className="text-muted-foreground">Optimized image compression & performance.</span>
                                    </div>

                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">SourceM7</span>
                                        <span className="text-muted-foreground">Contributed to Population Atlas & homepage redesign.</span>
                                    </div>

                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">Waheed Shaar (@WaheedShaar)</span>
                                        <span className="text-muted-foreground">Provided DWG CAD engineering vector files for the flag.</span>
                                    </div>

                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <span className="font-bold text-foreground block mb-0.5">Yuri Dandashi (@yuri.dandashi)</span>
                                        <span className="text-muted-foreground">Designed the logo, brand identity, and site icons.</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Open Source & License Card */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Code2 className="w-5 h-5 text-primary" />
                                    Open Source Software (MIT License)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    This software is licensed under the permissive <strong>MIT License</strong>. All codebase repositories are publicly accessible on GitHub.
                                </p>
                                <div className="flex flex-wrap gap-3 pt-2">
                                    <Button variant="outline" asChild size="sm" className="gap-2">
                                        <a href="https://github.com/syrianzone/syrianzone" target="_blank" rel="noreferrer">
                                            <Github className="w-4 h-4" />
                                            GitHub Repository
                                        </a>
                                    </Button>
                                    <Button variant="outline" asChild size="sm" className="gap-2">
                                        <a href="https://pub-1d51b625c56e4fd085c58a79672e1b15.r2.dev/downloads/brandkit-y5sZMu.zip" target="_blank" rel="noreferrer">
                                            <Download className="w-4 h-4" />
                                            Download Brand Kit
                                        </a>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Resource Attributions */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-primary" />
                                    Resource Attributions
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-xs leading-relaxed text-muted-foreground space-y-2">
                                <p>Tool and project icons are derived from Streamline Icons via Icones under Creative Commons Attribution 4.0 International (CC BY 4.0).</p>
                                <p>Interactive transit and place map data is powered by OpenStreetMap contributors and MapLibre GL JS under Open Data Commons (ODbL).</p>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <div className="mt-12 text-center text-xs text-muted-foreground">
                    <Separator className="my-6" />
                    <div className="flex justify-center gap-6">
                        <Link href="/privacy" className="hover:text-primary transition-colors">سياسة الخصوصية | Privacy Policy</Link>
                        <span>•</span>
                        <Link href="/terms" className="hover:text-primary transition-colors">الشروط والأحكام | Terms & Conditions</Link>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
