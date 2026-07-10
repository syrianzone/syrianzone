import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { Shield, Eye, Users, MapPin, Activity, Database, Lock, Globe, Trash2 } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import { Separator } from '@/Components/ui/separator';

export default function Privacy() {
    return (
        <MainLayout>
            <Head>
                <title>سياسة الخصوصية | Privacy Policy</title>
                <meta name="description" content="سياسة الخصوصية لمنصة المساحة السورية - تعرف على كيفية حماية بياناتك والتقنيات المستخدمة." />
            </Head>

            <div className="container mx-auto px-4 py-12 max-w-4xl min-h-screen text-foreground">
                {/* Page Header */}
                <div className="text-center mb-10 space-y-4">
                    <div className="inline-flex p-3 bg-primary/10 rounded-full text-primary mb-2">
                        <Shield className="w-10 h-10" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">سياسة الخصوصية | Privacy Policy</h1>
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
                                    <Eye className="w-5 h-5 text-primary" />
                                    مقدمة عامة
                                </CardTitle>
                                <CardDescription>لمحة عن الخصوصية في منصة المساحة السورية</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    تلتزم منصة <strong>المساحة السورية (Syrian Zone)</strong> بحماية خصوصية مستخدميها. نحن منصة مفتوحة المصادر وغير تجارية، نهدف إلى تقديم أدوات تفاعلية وموارد مفتوحة للشعب السوري.
                                </p>
                                <p>
                                    توضح هذه السياسة نوع البيانات التي نجمعها، وكيفية استخدامها، والتحكم الذي تمتلكه في بياناتك عند استخدام ميزاتنا التفاعلية مثل نظام التصويت (الاستطلاعات)، الترانزيت، وألعاب الأقران (Guess Who).
                                </p>
                            </CardContent>
                        </Card>

                        {/* Account Data & Google OAuth */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Users className="w-5 h-5 text-primary" />
                                    حسابات المستخدمين والمصادقة (Google OAuth)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    لتسهيل مساهمتك في "استوديو الترانزيت" (Transit Studio) واقتراح مسارات ومواقف حافلات جديدة، نتيح تسجيل الدخول الاختياري عبر حساب Google (Google OAuth). لا يتطلب تصفح الموقع أو المشاركة في استطلاعات الرأي وتقييمات الأداء (التيير ليست) تسجيل الدخول أو إنشاء أي حساب.
                                </p>
                                <ul className="list-disc list-inside space-y-2 mr-4">
                                    <li><strong>البيانات التي نجمعها:</strong> الاسم الكامل، البريد الإلكتروني، معرف جوجل الفريد (Google ID)، ورابط الصورة الشخصية (Avatar URL).</li>
                                    <li><strong>الغرض:</strong> مصادقة الهوية، السماح لك بمتابعة وإدارة حسابك، وإرسال ومراجعة مسودات خطوط النقل والمواقف في "استوديو الترانزيت".</li>
                                    <li><strong>حذف الحساب والبيانات:</strong> يمكنك في أي وقت الانتقال إلى <Link href="/dashboard" className="text-primary hover:underline font-semibold">لوحة التحكم</Link> وحذف حسابك بشكل نهائي وفوري. يؤدي ذلك إلى مسح كافة بيانات ملفك الشخصي بالكامل من قاعدة بياناتنا.</li>
                                </ul>
                            </CardContent>
                        </Card>

                        {/* Stored Data */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Database className="w-5 h-5 text-primary" />
                                    البيانات التي نقوم بتخزينها
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    نقوم بتخزين كمية محدودة جداً من البيانات لضمان تشغيل الخدمات التفاعلية:
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                    <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                        <h4 className="font-bold text-foreground mb-1.5 text-sm">استطلاعات الرأي والتقييمات (التيير ليست)</h4>
                                        <p className="text-xs">المشاركة في التصويتات لا تتطلب تسجيل الدخول. لحماية نزاهة النتائج ومنع التصويت المتكرر، نقوم بتوليد مفتاح تعريف فريد يُحفظ في متصفحك (Cookies/LocalStorage) بالإضافة إلى بصمة مجزأة لعنوان الـ IP (hashed IP) ونوع المتصفح بشكل مؤقت. لا ترتبط هذه المعلومات بهويتك الحقيقية أبداً.</p>
                                    </div>
                                    <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                        <h4 className="font-bold text-foreground mb-1.5 text-sm">مسودات الترانزيت (Transit Studio)</h4>
                                        <p className="text-xs">عند اقتراحك لمسارات أو مواقف باصات جديدة، نقوم بحفظ المسودة في قاعدة البيانات ليتسنى لمشرفي النظام مراجعتها واعتمادها.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Special Features & APIs */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-primary" />
                                    ميزات خاصة وصلاحيات المتصفح
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    تحتوي بعض أجزاء الموقع والتطبيق على ميزات متقدمة تتطلب استخدام أدوات وصلاحيات خاصة:
                                </p>
                                <div className="space-y-4">
                                    <div className="border-r-2 border-primary/50 pr-4">
                                        <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                                            <MapPin className="w-4 h-4 text-primary" />
                                            صلاحيات الموقع الجغرافي (Geolocation API)
                                        </h4>
                                        <p className="text-xs mt-1">
                                            يطلب قسم "ترانزيت" صلاحية الوصول لموقعك الجغرافي لعرض موقعك الحالي على خريطة المواصلات وحساب المسارات القريبة منك. 
                                            <strong className="text-foreground"> لا يتم إرسال أو تخزين إحداثيات موقعك الجغرافي على خوادمنا أبداً</strong>، حيث تتم معالجة بيانات الموقع بالكامل محلياً داخل جهازك.
                                        </p>
                                    </div>

                                    <div className="border-r-2 border-primary/50 pr-4">
                                        <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                                            <Globe className="w-4 h-4 text-primary" />
                                            اتصال الأقران (WebRTC) ولعبة "Guess Who"
                                        </h4>
                                        <p className="text-xs mt-1">
                                            تستخدم لعبة "Guess Who" تقنية WebRTC لربط اللاعبين مباشرة ببعضهم (Peer-to-Peer). نقوم بتشغيل خادم إشارات (Signaling) مؤقت لتنسيق الاتصال فقط. 
                                            بيانات اللعب والاتصال الصوتي/المرئي تعبر مباشرة بين أجهزة اللاعبين ولا يتم تسجيلها أو تمريرها عبر خوادمنا.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Third-Party Tools */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Lock className="w-5 h-5 text-primary" />
                                    أدوات الطرف الثالث ومعالجة البيانات
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    نستعين ببعض الخدمات الخارجية لتقديم تجربة مستخدم متكاملة:
                                </p>
                                <ul className="list-disc list-inside space-y-2 mr-4">
                                    <li><strong>Google OAuth:</strong> لإدارة تسجيل الدخول الآمن.</li>
                                    <li><strong>Pusher / WebSockets:</strong> لإرسال إشارات الربط اللحظية للاعبي Guess Who وبث التحديثات الفورية.</li>
                                    <li><strong>خرائط Leaflet و OpenStreetMap:</strong> لتوفير خرائط تفاعلية في قسم الترانزيت.</li>
                                    <li><strong>بوابة F3alia:</strong> لجلب الفعاليات والأنشطة المحلية.</li>
                                    <li><strong>مواقيت الصلاة (AlAdhan API):</strong> لحساب أوقات الصلاة بدقة بناءً على الموقع الجغرافي المرسل، دون تخزين الإحداثيات على خوادمنا.</li>
                                    <li><strong>خدمة الطقس (OpenWeather / Cloudflare Workers):</strong> لجلب وعرض حالة الطقس المحلية بناءً على محافظتك أو إحداثياتك التقريبية.</li>
                                    <li><strong>محركات البحث (Google, DuckDuckGo, Bing, SearX):</strong> عند استخدام شريط البحث، يتم توجيه الاستعلام مباشرة إلى المحرك المختار دون تخزينه أو تسجيله من طرفنا.</li>
                                </ul>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* English Content */}
                    <TabsContent value="en" className="space-y-6 text-left" dir="ltr">
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Eye className="w-5 h-5 text-primary" />
                                    Introduction
                                </CardTitle>
                                <CardDescription>Overview of privacy at Syrian Zone</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    The <strong>Syrian Zone (المساحة السورية)</strong> platform is committed to protecting the privacy of its users. We are an open-source, non-commercial platform designed to provide interactive tools and open resources for the Syrian community.
                                </p>
                                <p>
                                    This Privacy Policy explains what data we collect, how we use it, and the controls you have over your information when using our interactive features, such as our voting system (polls), Transit navigation, and peer-to-peer games (Guess Who).
                                </p>
                            </CardContent>
                        </Card>

                        {/* Account Data & Google OAuth */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Users className="w-5 h-5 text-primary" />
                                    User Accounts & Authentication (Google OAuth)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    To facilitate contributions to the Transit Studio (proposing new routes and bus stops), we support secure sign-in via Google (Google OAuth). Browsing the website or participating in polls and tierlist evaluations does NOT require creating an account or logging in.
                                </p>
                                <ul className="list-disc list-inside space-y-2 ml-4">
                                    <li><strong>Data we collect:</strong> Full name, email address, unique Google ID, and profile picture URL (Avatar URL).</li>
                                    <li><strong>Purpose:</strong> Authenticating identity, allowing you to manage your profile, and submitting/tracking route and stop drafts in the Transit Studio.</li>
                                    <li><strong>Account & Data Deletion:</strong> You can permanently and immediately delete your account at any time by going to your <Link href="/dashboard" className="text-primary hover:underline font-semibold">Dashboard</Link>. This action wipes all of your profile details entirely from our database.</li>
                                </ul>
                            </CardContent>
                        </Card>

                        {/* Stored Data */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Database className="w-5 h-5 text-primary" />
                                    Data We Store
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    We store a very limited amount of information to run our interactive features:
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                    <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                        <h4 className="font-bold text-foreground mb-1.5 text-sm">Polls & Evaluations (Tierlists)</h4>
                                        <p className="text-xs">Participating in polls and evaluations does not require signing in. To protect results against spam, we generate a unique token stored in your browser (Cookies/LocalStorage) alongside a secure hashed representation of your IP address (hashed IP) and User-Agent. This data is never linked to your identity.</p>
                                    </div>
                                    <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                        <h4 className="font-bold text-foreground mb-1.5 text-sm">Transit Drafts (Transit Studio)</h4>
                                        <p className="text-xs">When proposing new routes or stops, your submission details are stored as a draft in our database for administrators to review and approve.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Special Features & APIs */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-primary" />
                                    Special Features & Browser Permissions
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    Certain parts of our website and mobile app utilize advanced features that require specific system permissions:
                                </p>
                                <div className="space-y-4">
                                    <div className="border-l-2 border-primary/50 pl-4">
                                        <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                                            <MapPin className="w-4 h-4 text-primary" />
                                            Geolocation Access (HTML5 / Android GPS)
                                        </h4>
                                        <p className="text-xs mt-1">
                                            The Transit tool requests access to your location to center the map on your position and show nearby bus/transit lines. 
                                            <strong className="text-foreground"> We never send or store your coordinates on our servers</strong>. All location-based math is done locally in your browser.
                                        </p>
                                    </div>

                                    <div className="border-l-2 border-primary/50 pl-4">
                                        <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                                            <Globe className="w-4 h-4 text-primary" />
                                            Peer-to-Peer Connection (WebRTC) in "Guess Who"
                                        </h4>
                                        <p className="text-xs mt-1">
                                            The "Guess Who" game uses WebRTC to establish direct connections between players. We run a temporary signaling server to coordinate connections. 
                                            Game media streams and P2P data flow directly between you and your opponent and never pass through or get recorded on our servers.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Third-Party Tools */}
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Lock className="w-5 h-5 text-primary" />
                                    Third-Party Services
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                <p>
                                    We integrate with the following trusted third-party providers to enhance site features:
                                </p>
                                <ul className="list-disc list-inside space-y-2 ml-4">
                                    <li><strong>Google OAuth:</strong> For secure authentication.</li>
                                    <li><strong>Pusher / WebSockets:</strong> To handle real-time signaling for game coordination and live notifications.</li>
                                    <li><strong>Leaflet & OpenStreetMap:</strong> For rendering interactive maps on the Transit subpages.</li>
                                    <li><strong>F3alia API:</strong> To populate local events dynamically.</li>
                                    <li><strong>Prayer Times (AlAdhan API):</strong> To calculate accurate prayer times based on approximate location coordinates. No coordinates are stored on our servers.</li>
                                    <li><strong>Weather Integration (OpenWeather / Cloudflare Workers):</strong> To retrieve and present real-time local weather reports based on your location/governorate selection.</li>
                                    <li><strong>Search Engines (Google, DuckDuckGo, Bing, SearX):</strong> When utilizing the homepage search tool, your query is forwarded directly to your chosen provider and is never stored by Syrian Zone.</li>
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
