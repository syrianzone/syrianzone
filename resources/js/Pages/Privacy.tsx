import React from 'react';
import { Link } from '@inertiajs/react';
import { Eye, Users, MapPin, Activity, Database, Lock, Globe, KeyRound } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Card, CardContent, CardHeader, CardDescription } from '@/Components/ui/card';
import { Separator } from '@/Components/ui/separator';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';
import {
    setConsent,
    useAnalyticsConsent,
    useMeasurementId,
    usePrivacySignal,
} from '@/Lib/analyticsConsent';
import { PageHeader, ReaderLayout } from '@/Components/layout';

export default function Privacy() {
    // Analytics controls only exist where analytics could run at all.
    const analyticsId = useMeasurementId();
    const analyticsConsent = useAnalyticsConsent();
    const privacySignal = usePrivacySignal();

    return (
        <MainLayout>
            <PageHeader
                width="narrow"
                divider
                title="سياسة الخصوصية"
                description="آخر تحديث: 26 تشرين الثاني 2026"
            />

            <ReaderLayout>
                <div className="space-y-6" dir="rtl">
                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <Eye className="w-5 h-5 text-primary" aria-hidden="true" />
                                مقدمة عامة
                            </h2>
                            <CardDescription>لمحة عن الخصوصية في منصة المساحة السورية</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                            <p>
                                تلتزم منصة <strong>المساحة السورية (Syrian Zone)</strong> بحماية خصوصية مستخدميها. نحن منصة مجتمعية مفتوحة المصدر وغير تجارية، تهدف إلى تقديم أدوات تفاعلية وموارد مفتوحة للسوريين.
                            </p>
                            <p>
                                توضّح هذه السياسة البيانات التي نجمعها، وكيفية استخدامها، والخيارات المتاحة لك للتحكم ببياناتك عند استخدام خدماتنا التفاعلية مثل «مشوار» و«ترانزيت» و«عداد الوعود» و«بوصلة سوريا» و«الركن الإسلامي» و«لوح» والأدلة العامة والألعاب وواجهات البيانات المفتوحة.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <Users className="w-5 h-5 text-primary" aria-hidden="true" />
                                حسابات المستخدمين والمصادقة (Google OAuth)
                            </h2>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                            <p>
                                لا يتطلب تصفح المنصة أو البحث في الخرائط والأدلة والاستطلاعات تسجيل الدخول. ولتسهيل مساهمتك في «استوديو ترانزيت» واقتراحات الأدلة و«عداد الوعود» وحفظ الأماكن في «مشوار» ومزامنة إعداداتك، نتيح تسجيل الدخول الاختياري عبر حساب Google (Google OAuth).
                            </p>
                            <ul className="list-disc list-inside space-y-2 ms-4">
                                <li><strong>البيانات التي نجمعها:</strong> الاسم الكامل، والبريد الإلكتروني، ومعرّف Google الفريد (Google ID)، ورابط الصورة الشخصية (Avatar URL).</li>
                                <li><strong>الغرض:</strong> التحقق من الهوية، وحفظ تفضيلاتك ومساهماتك، وإدارة مسودات النقل والأماكن واقتراحات الأدلة.</li>
                                <li>
                                    <strong>حذف الحساب والبيانات:</strong> يمكنك في أي وقت الانتقال إلى{' '}
                                    <Link href="/dashboard" className="text-primary hover:underline font-semibold">
                                        لوحة التحكم
                                    </Link>{' '}
                                    لحذف حسابك. يؤدي الحذف إلى تعطيل الحساب وإزالته من الاستخدام النشط (حذف ناعم)، وإلغاء جميع رموز الوصول (Sanctum) المرتبطة به، وحذف صورتك الشخصية المخزَّنة على Cloudflare R2. أما استطلاعات الرأي ومسارات النقل العام التي ساهمت بها فتُفصل عن حسابك وتُنقل ملكيتها للحفاظ على توفرها للمجتمع.
                                </li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <Database className="w-5 h-5 text-primary" aria-hidden="true" />
                                البيانات التي نخزّنها
                            </h2>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                            <p>
                                نخزّن الحد الأدنى من البيانات اللازمة لتشغيل الخدمات التفاعلية:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                                <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                    <h3 className="font-bold text-foreground mb-1.5 text-sm">استطلاعات الرأي والتقييمات</h3>
                                    <p className="text-xs">لا تتطلب المشاركة في التصويت تسجيل الدخول. ولحماية النتائج من التكرار، نولّد مفتاح تعريف فريداً في المتصفح وبصمة مجزأة مؤقتة لعنوان IP دون ربطها بهويتك.</p>
                                </div>
                                <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                    <h3 className="font-bold text-foreground mb-1.5 text-sm">مسودات «استوديو ترانزيت»</h3>
                                    <p className="text-xs">عند اقتراح مسارات أو مواقف جديدة للنقل العام، نحفظ المسودة في قاعدة البيانات ليراجعها المشرفون ويعتمدوها.</p>
                                </div>
                                <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                    <h3 className="font-bold text-foreground mb-1.5 text-sm">دليل الأماكن (مشوار)</h3>
                                    <p className="text-xs">نحفظ اقتراحات الأماكن والأماكن المحفوظة في حسابك، وتُرفع الصور المرفقة وتُخزَّن بأمان على Cloudflare R2.</p>
                                </div>
                                <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                    <h3 className="font-bold text-foreground mb-1.5 text-sm">اقتراحات الأدلة</h3>
                                    <p className="text-xs">عند اقتراح إضافة أو تعديل في «السير الذاتية للمسؤولين» أو «الحسابات الرسمية» أو «التطبيقات الحكومية» أو «دليل الهاتف»، نحفظ نص الاقتراح والمصدر وربطه بحسابك لمراجعته تحريرياً.</p>
                                </div>
                                <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                    <h3 className="font-bold text-foreground mb-1.5 text-sm">عداد الوعود</h3>
                                    <p className="text-xs">نحفظ اقتراحات الوعود الجديدة والبلاغات والتحديثات المرتبطة بها لمراجعتها، كما نسجّل أصوات التأييد والرفض لحساب النسب المجمَّعة ومنع التكرار.</p>
                                </div>
                                <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                    <h3 className="font-bold text-foreground mb-1.5 text-sm">تفضيلات المظهر والخط</h3>
                                    <p className="text-xs">تُحفظ اختياراتك من بين 14 مظهراً متاحاً ونوع الخط محلياً في <span dir="ltr">localStorage</span>، وتُزامَن مع إعدادات حسابك تلقائياً عند تسجيل الدخول.</p>
                                </div>
                                <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                    <h3 className="font-bold text-foreground mb-1.5 text-sm">الركن الإسلامي</h3>
                                    <p className="text-xs">للمستخدم المسجَّل، تُحفظ علامات الآيات وتفضيلات القارئ (المدينة وطريقة الحساب وآخر صفحة والقارئ) في حسابه لمزامنتها بين أجهزته، إلى جانب عدّادات استهلاك بيانات التلاوة. أما للزائر غير المسجَّل فتبقى هذه البيانات على جهازه وحده.</p>
                                </div>
                                <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                    <h3 className="font-bold text-foreground mb-1.5 text-sm">بوصلة سوريا</h3>
                                    <p className="text-xs">تُحفظ إجابات الاختبار لحساب نتيجتك. يمكنك اختيار مشاركة نتيجتك عبر رابط عام، كما نعرض إحصاءات مجمَّعة مجهولة الهوية لا تكشف أي نتيجة فردية.</p>
                                </div>
                                <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                    <h3 className="font-bold text-foreground mb-1.5 text-sm">الألعاب</h3>
                                    <p className="text-xs">تُحفظ نتائج الألعاب الفردية (2048 وسوليتير وطرنيب وتركس) على جهازك وحده. وتسجّل لعبة «هل تميّزها؟» عدّادات مجمَّعة مجهولة للإجابات والنتائج دون ربطها بحسابك أو بعنوان IP. أما لعبة «من هو؟» فتُدار على خوادمنا مؤقتاً وتُحذف غرفها القديمة يومياً.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <KeyRound className="w-5 h-5 text-primary" aria-hidden="true" />
                                الواجهات البرمجية ورموز الوصول (API وMCP)
                            </h2>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                            <ul className="list-disc list-inside space-y-2 ms-4">
                                <li>
                                    <strong>الواجهات العامة للقراءة فقط (<span dir="ltr">/api/v1/*</span> و<span dir="ltr">/mcp/public</span>):</strong> متاحة للجميع دون تسجيل دخول أو جمع بيانات شخصية، وتخضع لحدود معدل الطلبات (Rate Limiting) لحماية الخدمة من الإغراق.
                                </li>
                                <li>
                                    <strong>رموز وصول الوكلاء (<span dir="ltr">Sanctum</span> و<span dir="ltr">/mcp/admin</span>):</strong> تُصدر حصراً للمحررين والمشرفين المخوَّلين؛ نحفظ بصمة الرمز وصلاحياته وتاريخ آخر استخدام له لتأمين الوصول، ويمكن لصاحب الحساب أو الإدارة إلغاء أي رمز في أي وقت.
                                </li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <Activity className="w-5 h-5 text-primary" aria-hidden="true" />
                                ميزات خاصة وصلاحيات المتصفح
                            </h2>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                            <p>
                                تتطلب بعض أجزاء المنصة استخدام أدوات وصلاحيات خاصة في المتصفح:
                            </p>
                            <div className="space-y-4">
                                <div className="border-s-2 border-primary/50 ps-4">
                                    <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                                        <MapPin className="w-4 h-4 text-primary" aria-hidden="true" />
                                        صلاحيات الموقع الجغرافي (Geolocation API) وتحديد المدينة عبر IP
                                    </h3>
                                    <p className="text-xs mt-1">
                                        تطلب أقسام «ترانزيت» و«مشوار» صلاحية الموقع الجغرافي لعرض موقعك الحالي والمواقف والأماكن القريبة منك، وتُعالَج هذه البيانات محلياً في جهازك. أما في «الركن الإسلامي» وأداة الطقس، فيحصل المتصفح على إحداثيات جهازك (عبر GPS) أو مدينتك التقريبية مباشرة من خدمة <span dir="ltr">ipwho.is</span>، ثم يرسل الإحداثيات إلى خادم المساحة السورية حصراً لتمرير الطلب إلى واجهات AlAdhan وOpen-Meteo وOpenWeatherMap دون تخزين تلك الإحداثيات على خوادمنا.
                                    </p>
                                </div>

                                <div className="border-s-2 border-primary/50 ps-4">
                                    <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                                        <Globe className="w-4 h-4 text-primary" aria-hidden="true" />
                                        الاتصال اللحظي (Laravel Reverb) ولعبة «من هو؟»
                                    </h3>
                                    <p className="text-xs mt-1">
                                        تستخدم لعبة «من هو؟» (Guess Who) خادم Laravel Reverb لبثّ حالة اللعبة لحظياً. تُعالَج الأدوار والأسرار والاستبعادات على خوادمنا دون اتصال مباشر بين الأجهزة (Peer-to-Peer) ودون نقل صوت أو صورة. تُحفظ بيانات الغرفة مؤقتاً، وتُحذف الغرف القديمة يومياً.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <Lock className="w-5 h-5 text-primary" aria-hidden="true" />
                                أدوات الطرف الثالث ومعالجة البيانات
                            </h2>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                            <p>
                                نستعين بعدد من الخدمات الخارجية الموثوقة لتقديم تجربة متكاملة:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ms-4">
                                <li><strong>Google OAuth:</strong> لإدارة تسجيل الدخول الآمن.</li>
                                <li><strong>Laravel Reverb (WebSockets):</strong> لبثّ حالة لعبة «من هو؟» والتحديثات اللحظية عبر خادم مستضاف ذاتياً.</li>
                                <li><strong>خرائط MapLibre GL JS وOpenStreetMap:</strong> لتوفير خرائط تفاعلية متجهة في «ترانزيت» و«مشوار».</li>
                                <li><strong>تخزين Cloudflare R2:</strong> لتخزين صور الأماكن وملفات الهوية البصرية والصور الشخصية بأمان وسرعة عالية.</li>
                                <li><strong>بوابة F3alia:</strong> لجلب الفعاليات والأنشطة المحلية.</li>
                                <li><strong>مواقيت الصلاة (AlAdhan API):</strong> لحساب أوقات الصلاة بدقة عبر خادمنا الوسيط استناداً إلى الإحداثيات المرسلة، دون تخزينها.</li>
                                <li><strong>التلاوة الصوتية (MP3Quran v4 وEveryAyah):</strong> لبثّ ملفات التلاوة من شبكات توصيل المحتوى التابعة لهما، مع بيانات توقيتات الآيات والكلمات والحروف.</li>
                                <li><strong>تحديد الموقع التقريبي (ipwho.is):</strong> يستعلم المتصفح مباشرة من <span dir="ltr">ipwho.is</span> لتقدير المدينة والإحداثيات عند اختيار التحديد التلقائي، وتُرسل الإحداثيات إلى خادمنا لتمريرها إلى خدمات المواقيت والطقس فقط دون تخزين.</li>
                                <li><strong>خدمات الطقس والمناخ (Open-Meteo وOpenWeatherMap وNASA POWER وWorld Bank Climate API):</strong> لجلب حالة الطقس المحلية والبيانات المناخية التاريخية للمحافظات والمواقع.</li>
                                <li><strong>أيقونات المواقع (Google Favicons):</strong> لعرض أيقونات المواقع الخارجية في «دليل المواقع».</li>
                                <li><strong>واجهة GitHub API:</strong> لجلب قائمة المساهمين وإحصاءات المشاريع مفتوحة المصدر في صفحة «عن المنصة» وصفحة المساهمين.</li>
                                <li>
                                    <strong>إحصاءات الزيارات (Google Analytics 4):</strong> لقياس الزيارات وفهم استخدام الأقسام عبر بيانات مجمَّعة و11 حدثاً هيكلياً خالياً تماماً من أي معلومات تعريف شخصية (Zero-PII). لا تُحمَّل الإحصاءات ولا يُرسَل أي شيء إلى Google قبل موافقتك، ونحترم إشارة الخصوصية في متصفحك (Global Privacy Control). تُرسَل مسارات الصفحات وحدها دون سلاسل الاستعلام (أي ما يأتي بعد علامة «?» في رابط الصفحة)، ويمكنك تغيير اختيارك من هنا في أي وقت. راجع{' '}
                                    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">
                                        سياسة خصوصية Google
                                    </a>{' '}
                                    لمزيد من التفاصيل.
                                    {analyticsId && (
                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                                            <Switch
                                                id="analytics-consent"
                                                checked={analyticsConsent === 'granted'}
                                                disabled={privacySignal}
                                                onCheckedChange={(checked) => setConsent(checked ? 'granted' : 'denied')}
                                            />
                                            <Label htmlFor="analytics-consent" className="cursor-pointer text-xs font-semibold">
                                                إحصاءات الزيارات
                                            </Label>
                                            <span className="text-xs text-muted-foreground">
                                                {privacySignal
                                                    ? 'أوقفتها إشارة الخصوصية في متصفحك (Global Privacy Control).'
                                                    : analyticsConsent === 'granted'
                                                        ? 'مفعّلة'
                                                        : analyticsConsent === 'denied'
                                                            ? 'متوقفة'
                                                            : 'لم تختر بعد'}
                                            </span>
                                        </div>
                                    )}
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>

                <div className="mt-8 text-center text-xs text-muted-foreground">
                    <Separator className="my-6" />
                </div>
            </ReaderLayout>
        </MainLayout>
    );
}
