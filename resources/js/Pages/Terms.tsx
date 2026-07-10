import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { FileText, CheckCircle2, UserX, AlertTriangle, HelpCircle, Shield, Scale, Map, Info } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import { Separator } from '@/Components/ui/separator';

export default function Terms() {
    return (
        <MainLayout>
            <Head>
                <title>الشروط والأحكام | Terms & Conditions</title>
                <meta name="description" content="الشروط والأحكام لمنصة المساحة السورية - شروط الاستخدام، السلوك المقبول، وحدود المسؤولية." />
            </Head>

            <div className="container mx-auto px-4 py-12 max-w-4xl min-h-screen text-foreground">
                {/* Page Header */}
                <div className="text-center mb-10 space-y-4">
                    <div className="inline-flex p-3 bg-primary/10 rounded-full text-primary mb-2">
                        <FileText className="w-10 h-10" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">الشروط والأحكام | Terms & Conditions</h1>
                    <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
                        آخر تحديث: 10 يوليو 2026 | Last Updated: July 10, 2026
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
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Scale className="w-5 h-5 text-primary" />
                                    قبول الشروط والاستخدام العام
                                </CardTitle>
                                <CardDescription>شروط تصفح واستخدام منصة المساحة السورية</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    من خلال الوصول إلى منصة <strong>المساحة السورية (Syrian Zone)</strong> أو استخدام تطبيق الأندرويد التابع لها، فإنك توافق على الالتزام بهذه الشروط والأحكام بالكامل.
                                </p>
                                <p>
                                    نحن منصة مجتمعية، مفتوحة المصادر، وغير تجارية. جميع الأدوات والخدمات المقدمة مجانية بالكامل وتهدف لمساعدة المجتمع السوري وتسهيل وصوله للمعلومات.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Accounts and Bans */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <UserX className="w-5 h-5 text-primary" />
                                    حسابات المستخدمين والسلوك المقبول
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    عند إنشاء حساب عبر Google OAuth، فإنك توافق على أن تكون المسؤول الوحيد عن استخدام الحساب.
                                </p>
                                <ul className="list-disc list-inside space-y-2 mr-4">
                                    <li><strong>منع التلاعب والتصويت الوهمي:</strong> يمنع منعاً باتاً استخدام برمجيات الروبوت (Bots)، أو الحسابات المتعددة، أو أي نوع من السكربتات لتزييف نتائج التصويت أو تقييمات استطلاعات الرأي.</li>
                                    <li><strong>حظر الحسابات:</strong> تحتفظ المنصة بالحق الكامل في حظر أي مستخدم (`is_banned`) أو عنوان IP يتبين قيامه بأنشطة ضارة مثل محاولات الاختراق، إغراق الخادم بالطلبات (DDoS)، أو نشر محتوى مسيء عبر غرف ألعاب Guess Who أو استوديو الترانزيت.</li>
                                    <li><strong>دقة البيانات:</strong> في حال تقديمك معلومات في دليل الهاتف أو اقتراح مسارات في الترانزيت، يجب أن تكون هذه البيانات صحيحة وواقعية لمساعدة الآخرين.</li>
                                </ul>
                            </CardContent>
                        </Card>

                        {/* Transit Studio Rights */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Map className="w-5 h-5 text-primary" />
                                    استوديو الترانزيت وحقوق المساهمة
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    تتيح لك ميزة "استوديو الترانزيت" (Transit Studio) المساهمة في رسم وتعديل خطوط النقل والمواقف العامة في المدن السورية.
                                </p>
                                <p>
                                    بإرسالك لمسودة خط نقل أو موقف باص، فإنك تمنح <strong>المساحة السورية</strong> حقاً دائماً، وغير حصري، ومجانياً بالكامل لنشر هذه البيانات، تعديلها، ودمجها مع خرائط المواصلات العامة لتصبح متاحة لكافة المستخدمين تحت رخصة الموارد الحرة والمفتوحة.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Interactive Games (Guess Who) */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <HelpCircle className="w-5 h-5 text-primary" />
                                    ألعاب الأقران (Guess Who) والاتصالات
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    ميزة ألعاب التخمين (Guess Who) تستخدم بروتوكول WebRTC للاتصال الصوتي/المرئي المباشر بين اللاعبين.
                                </p>
                                <p>
                                    يجب على اللاعبين الالتزام بآداب الحوار العام. يمنع منعاً باتاً استخدام ميزة الاتصال المباشر لنقل محتوى يحث على الكراهية، أو التحرش، أو أي محتوى يخالف القوانين العامة. لا نتحمل أي مسؤولية عن تصرفات أو أقوال اللاعبين أثناء الاتصال نظراً لكونه مباشراً ولا يمر عبر خوادمنا.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Limitation of Liability */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-primary" />
                                    إخلاء المسؤولية وحدودها
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    يتم تقديم منصة <strong>المساحة السورية</strong> وأدواتها "كما هي" دون أي ضمانات من أي نوع، صريحة أو ضمنية.
                                </p>
                                <ul className="list-disc list-inside space-y-2 mr-4">
                                    <li><strong>دقة خرائط النقل ودليل الهاتف:</strong> نظراً لأن بيانات الترانزيت ودليل الأرقام تعتمد بشكل كبير على المساهمات المجتمعية والمعلومات الخارجية، فإننا لا نضمن دقة مواعيد باصات النقل أو صحة أرقام الهواتف أو ثبات الأسعار المعروضة.</li>
                                    <li><strong>انقطاع الخدمة:</strong> لا نتحمل المسؤولية عن أي انقطاع مؤقت أو دائم للخدمة أو فقدان للبيانات نتيجة مشاكل تقنية أو أعمال صيانة.</li>
                                </ul>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* English Content */}
                    <TabsContent value="en" className="space-y-6 text-left" dir="ltr">
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Scale className="w-5 h-5 text-primary" />
                                    Acceptance of Terms
                                </CardTitle>
                                <CardDescription>Terms for browsing and using the Syrian Zone platform</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    By accessing the <strong>Syrian Zone (المساحة السورية)</strong> platform or using its Android application, you agree to comply with and be bound by these Terms and Conditions in full.
                                </p>
                                <p>
                                    We are an open-source, non-commercial community portal. All tools, widgets, and services provided are entirely free of charge and are intended to assist the Syrian community and facilitate open access to information.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Accounts and Bans */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <UserX className="w-5 h-5 text-primary" />
                                    User Accounts & Acceptable Use
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    When creating an account via Google OAuth, you agree that you are solely responsible for all activities that occur under your account.
                                </p>
                                <ul className="list-disc list-inside space-y-2 ml-4">
                                    <li><strong>Anti-Manipulation:</strong> The use of bots, multiple accounts, scripts, or any form of automation to inflate poll results, vote counts, or public evaluations is strictly prohibited.</li>
                                    <li><strong>Suspension & Bans:</strong> We reserve the right to ban accounts (`is_banned`) or block IP addresses if we detect malicious actions, including security vulnerability exploits, DDoS attempts, or abusive postings in Transit Studio or Guess Who game rooms.</li>
                                    <li><strong>Accuracy of Community Content:</strong> If you add entries to the Phonebook or draw transit paths, you represent that the information is accurate and factual.</li>
                                </ul>
                            </CardContent>
                        </Card>

                        {/* Transit Studio Rights */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Map className="w-5 h-5 text-primary" />
                                    Transit Studio & Contribution Rights
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    The "Transit Studio" tool allows you to contribute to drawing and defining transit routes and bus stops in Syrian cities.
                                </p>
                                <p>
                                    By submitting a draft transit route or stop coordinates, you grant <strong>Syrian Zone</strong> a perpetual, non-exclusive, royalty-free, worldwide license to publish, distribute, modify, and integrate this data into the public transit maps for the benefit of all users.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Interactive Games (Guess Who) */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <HelpCircle className="w-5 h-5 text-primary" />
                                    P2P Games (Guess Who) and Conduct
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    The "Guess Who" game features WebRTC connectivity for direct communication between players.
                                </p>
                                <p>
                                    Players must maintain respectful communications. Utilizing the game rooms or signaling channels to broadcast hate speech, harassment, or illegal content is prohibited. We do not monitor or control Peer-to-Peer communications, and we assume no liability for the behavior of players.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Limitation of Liability */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-primary" />
                                    Disclaimers & Limitation of Liability
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    The <strong>Syrian Zone</strong> platform is provided on an "as is" and "as available" basis without warranties of any kind.
                                </p>
                                <ul className="list-disc list-inside space-y-2 ml-4">
                                    <li><strong>Information Accuracy:</strong> Because public transit routes, pricing, and phone directory items are community-generated, we make no guarantees about the constant accuracy of transport coordinates, schedules, prices, or listed phone numbers.</li>
                                    <li><strong>Service Availability:</strong> We are not liable for any temporary or permanent service downtime, server outages, or data loss.</li>
                                </ul>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <div className="mt-12 text-center text-xs text-muted-foreground">
                    <Separator className="my-6" />
                </div>
            </div>
        </MainLayout>
    );
}
