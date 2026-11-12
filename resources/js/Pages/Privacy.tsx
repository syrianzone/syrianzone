import React from 'react';
import { Link } from '@inertiajs/react';
import { Shield, Eye, Users, MapPin, Activity, Database, Lock, Globe } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Separator } from '@/Components/ui/separator';

export default function Privacy() {
    return (
        <MainLayout>
            

            <div className="container mx-auto px-4 py-12 max-w-4xl min-h-screen text-foreground">
                {/* Page Header */}
                <div className="text-center mb-10 space-y-4">
                    <div className="inline-flex p-3 bg-primary/10 rounded-full text-primary mb-2">
                        <Shield className="w-10 h-10" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">سياسة الخصوصية</h1>
                    <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
                        آخر تحديث: 12 نوفمبر 2026
                    </p>
                </div>

                <div className="space-y-6" dir="rtl">
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
                                    توضح هذه السياسة نوع البيانات التي نجمعها، وكيفية استخدامها، والتحكم الذي تمتلكه في بياناتك عند استخدام ميزاتنا التفاعلية مثل دليل الأماكن (مشوار)، وخرائط النقل (الترانزيت)، ونظام التصويت (الاستطلاعات)، والركن الإسلامي (مواقيت الصلاة وقارئ القرآن)، وبوصلة سوريا، ولوح، والألعاب ومنها لعبة «من هو؟» (Guess Who).
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
                                    لتسهيل مساهمتك في "استوديو الترانزيت" (Transit Studio) وإضافة الأماكن أو الفنادق المحفوظة في "مشوار" (Mishwar)، نتيح تسجيل الدخول الاختياري عبر حساب Google (Google OAuth). لا يتطلب تصفح الموقع أو البحث في الخرائط والاستطلاعات تسجيل الدخول.
                                </p>
                                <ul className="list-disc list-inside space-y-2 ms-4">
                                    <li><strong>البيانات التي نجمعها:</strong> الاسم الكامل، البريد الإلكتروني، معرف جوجل الفريد (Google ID)، ورابط الصورة الشخصية (Avatar URL).</li>
                                    <li><strong>الغرض:</strong> مصادقة الهوية، حفظ أفعالك ومساهماتك الشخصية، وإدارة مسودات النقل والأماكن المقترحة.</li>
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
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                                    <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                        <h2 className="font-bold text-foreground mb-1.5 text-sm">استطلاعات الرأي والتقييمات</h2>
                                        <p className="text-xs">المشاركة في التصويتات لا تتطلب تسجيل الدخول. لحماية النتائج من التكرار، نقوم بتوليد مفتاح تعريف فريد في المتصفح وبصمة مجزأة لعنوان الـ IP بشكل مؤقت دون ربطها بهويتك.</p>
                                    </div>
                                    <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                        <h2 className="font-bold text-foreground mb-1.5 text-sm">مسودات الترانزيت (Transit Studio)</h2>
                                        <p className="text-xs">عند اقتراح مسارات أو مواقف جديدة، نحفظ المسودة في قاعدة البيانات ليتسنى للمشرفين مراجعتها واعتمادها.</p>
                                    </div>
                                    <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                        <h2 className="font-bold text-foreground mb-1.5 text-sm">دليل الأماكن (مشوار)</h2>
                                        <p className="text-xs">نحفظ اقتراحات الأماكن والأماكن المحفوظة الخاصة بحسابك، ويتم رفع وتخزين الصور المرفقة بأمان على Cloudflare R2.</p>
                                    </div>
                                    <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                        <h2 className="font-bold text-foreground mb-1.5 text-sm">الركن الإسلامي (العلامات والإعدادات)</h2>
                                        <p className="text-xs">للمستخدم المسجَّل، تُحفظ علامات الآيات وتفضيلات القارئ (المدينة، وطريقة الحساب، وآخر صفحة، والقارئ) في حسابه لمزامنتها بين أجهزته، إلى جانب عدّادات استهلاك بيانات التلاوة. وللزائر غير المسجَّل تبقى هذه البيانات على جهازه وحده.</p>
                                    </div>
                                    <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                        <h2 className="font-bold text-foreground mb-1.5 text-sm">بوصلة سوريا (النتائج والإحصاءات)</h2>
                                        <p className="text-xs">تُحفظ إجابات اختبار بوصلة سوريا لحساب نتيجتك. ويمكنك أن تختار مشاركة نتيجتك عبر رابط عام، كما نعرض إحصاءات مجمَّعة مجهولة الهوية لا تكشف أي نتيجة فردية.</p>
                                    </div>
                                    <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                        <h2 className="font-bold text-foreground mb-1.5 text-sm">الألعاب (من هو؟ والألعاب الفردية)</h2>
                                        <p className="text-xs">تُحفظ نتائج الألعاب الفردية (2048، وسوليتير، وطرنيب، وتركس) على جهازك وحده. أما لعبة «من هو؟» فتُدار على خوادمنا مؤقتاً (الغرف، والأدوار، والأسرار، والاستبعادات)، وتُحذف غرفها القديمة يومياً.</p>
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
                                    <div className="border-s-2 border-primary/50 ps-4">
                                        <h2 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                                            <MapPin className="w-4 h-4 text-primary" />
                                            صلاحيات الموقع الجغرافي (Geolocation API)
                                        </h2>
                                        <p className="text-xs mt-1">
                                            تطلب أقسام «الترانزيت» و«مشوار» صلاحية الوصول لموقعك الجغرافي لعرض موقعك الحالي وحساب الفنادق والمواقف والأماكن القريبة منك، وتُعالَج هذه البيانات محلياً داخل جهازك دون إرسالها إلى خوادمنا. أما الركن الإسلامي فيستخدم موقعك (عبر GPS أو تقدير تقريبي من عنوان IP) لحساب مواقيت الصلاة، فتُرسَل الإحداثيات إلى خادمنا ثم إلى واجهة AlAdhan لحساب المواقيت فقط، دون تخزينها.
                                        </p>
                                    </div>

                                    <div className="border-s-2 border-primary/50 ps-4">
                                        <h2 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                                            <Globe className="w-4 h-4 text-primary" />
                                            الاتصال اللحظي (Laravel Reverb) ولعبة «من هو؟»
                                        </h2>
                                        <p className="text-xs mt-1">
                                            تستخدم لعبة «من هو؟» (Guess Who) خادم Laravel Reverb لبثّ حالة اللعبة لحظياً. تُعالَج الأدوار والأسرار والاستبعادات على خوادمنا، ولم يعد هناك اتصال مباشر بين الأجهزة (Peer-to-Peer) ولا نقل للصوت أو الصورة. تُحفظ بيانات الغرفة مؤقتاً، وتُحذف الغرف القديمة يومياً.
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
                                <ul className="list-disc list-inside space-y-2 ms-4">
                                    <li><strong>Google OAuth:</strong> لإدارة تسجيل الدخول الآمن.</li>
                                    <li><strong>Laravel Reverb (WebSockets):</strong> لبثّ حالة لعبة «من هو؟» والتحديثات اللحظية عبر خادم مستضاف ذاتياً.</li>
                                    <li><strong>خرائط MapLibre GL JS و OpenStreetMap:</strong> لتوفير خرائط تفاعلية متجهة في قسمي الترانزيت ومشوار.</li>
                                    <li><strong>تخزين Cloudflare R2:</strong> لتخزين الصور والوسائط الخاصة بالأماكن والهوية البصرية بأمان وسرعة عالية.</li>
                                    <li><strong>بوابة F3alia:</strong> لجلب الفعاليات والأنشطة المحلية.</li>
                                    <li><strong>مواقيت الصلاة (AlAdhan API):</strong> لحساب أوقات الصلاة بدقة بناءً على الموقع الجغرافي المرسل، دون تخزين الإحداثيات على خوادمنا.</li>
                                    <li><strong>التلاوة الصوتية (MP3Quran v4 وEveryAyah):</strong> لبثّ ملفات التلاوة من شبكات توصيل المحتوى التابعة لهما، مع بيانات توقيتات الآيات والكلمات والحروف.</li>
                                    <li><strong>تحديد الموقع (GPS / عنوان IP عبر ipwho.is):</strong> عند اختيار التحديد التلقائي للموقع، تُستخدم إحداثيات جهازك أو مدينتك التقريبية من عنوان IP لحساب المواقيت فقط — تبقى على جهازك ولا تُرسل لخوادمنا.</li>
                                    <li><strong>خدمة الطقس (Open-Meteo وOpenWeatherMap):</strong> لجلب وعرض حالة الطقس المحلية بناءً على محافظتك أو إحداثياتك التقريبية.</li>
                                    <li><strong>محركات البحث (Google, DuckDuckGo, Bing, SearX):</strong> عند استخدام شريط البحث، يتم توجيه الاستعلام مباشرة إلى المحرك المختار دون تخزينه أو تسجيله من طرفنا.</li>
                                    <li><strong>إحصاءات الزيارات (Google Analytics):</strong> لقياس عدد الزيارات وتحديد الصفحات الأكثر استخداماً عبر بيانات مجمَّعة. تُرسَل مسارات الصفحات وحدها دون سلاسل الاستعلام (أي ما يأتي بعد علامة «?» في رابط الصفحة). التفاصيل في <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">سياسة خصوصية Google</a>.</li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>

                <div className="mt-12 text-center text-xs text-muted-foreground">
                    <Separator className="my-6" />
                </div>
            </div>
        </MainLayout>
    );
}
