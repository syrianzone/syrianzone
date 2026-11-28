import React from 'react';
import { UserX, AlertTriangle, HelpCircle, Scale, Map, Info, Compass, Code2 } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Card, CardContent, CardHeader, CardDescription } from '@/Components/ui/card';
import { Separator } from '@/Components/ui/separator';
import { PageHeader, ReaderLayout } from '@/Components/layout';

export default function Terms() {
    return (
        <MainLayout>
            <PageHeader
                width="narrow"
                divider
                title="الشروط والأحكام"
                description="آخر تحديث: 26 تشرين الثاني 2026"
            />

            <ReaderLayout>
                <div className="space-y-6" dir="rtl">
                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <Scale className="w-5 h-5 text-primary" aria-hidden="true" />
                                قبول الشروط والاستخدام العام
                            </h2>
                            <CardDescription>شروط تصفح منصة المساحة السورية واستخدامها</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                            <p>
                                بوصولك إلى منصة <strong>المساحة السورية (Syrian Zone)</strong> أو استخدامك تطبيق أندرويد التابع لها أو واجهاتها البرمجية العامة، فإنك توافق على الالتزام بهذه الشروط والأحكام كاملة.
                            </p>
                            <p>
                                المساحة السورية منصة مجتمعية مفتوحة المصدر وغير تجارية. جميع الأدوات والخدمات المقدَّمة مجانية وتهدف إلى خدمة المجتمع السوري وتيسير وصوله إلى المعلومات.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <UserX className="w-5 h-5 text-primary" aria-hidden="true" />
                                حسابات المستخدمين والسلوك المقبول
                            </h2>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                            <p>
                                عند إنشاء حساب عبر Google OAuth، تتحمّل وحدك مسؤولية استخدام الحساب والحفاظ على أمانه.
                            </p>
                            <ul className="list-disc list-inside space-y-2 ms-4">
                                <li><strong>منع التلاعب والتصويت الوهمي:</strong> يُمنع منعاً باتاً استخدام البرامج الآلية (Bots)، أو الحسابات المتعددة، أو أي سكربتات لتزييف نتائج التصويت أو استطلاعات الرأي أو تصويتات «عداد الوعود».</li>
                                <li><strong>تعليق الحسابات وحظرها:</strong> تحتفظ المنصة بالحق الكامل في حظر أي حساب أو عنوان IP يثبت تورطه في أنشطة ضارة مثل محاولات الاختراق، أو إغراق الخادم بالطلبات (DDoS)، أو نشر محتوى مسيء في غرف لعبة «من هو؟» أو المساهمات المجتمعية.</li>
                                <li><strong>دقة البيانات:</strong> عند اقتراح تعديل أو إضافة في أي دليل أو مسار نقل، يجب أن تكون المعلومات صحيحة وموثّقة قدر الإمكان لمساعدة الآخرين.</li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <Map className="w-5 h-5 text-primary" aria-hidden="true" />
                                المساهمات المجتمعية وحقوق النشر
                            </h2>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                            <p>
                                تتيح المنصة المساهمة المجتمعية في عدة أقسام: «استوديو ترانزيت» لرسم خطوط النقل والمواقف، ودليل «مشوار» للأماكن والفنادق والمرشدين المحليين، و«اقتراحات الأدلة» (السير الذاتية للمسؤولين، والحسابات الرسمية، والتطبيقات الحكومية، ودليل الهاتف)، و«عداد الوعود» لاقتراح الوعود والإبلاغ عن تحديثاتها.
                            </p>
                            <ul className="list-disc list-inside space-y-2 ms-4">
                                <li><strong>الترخيص المفتوح للمساهمات:</strong> بإرسالك مسودة خط نقل، أو مكان، أو اقتراح دليل، أو تحديث وعد، فإنك تمنح <strong>المساحة السورية</strong> حقاً دائماً وغير حصري ومجانياً لنشر هذه البيانات وتعديلها ودمجها وإتاحتها للعموم ضمن الموارد المفتوحة.</li>
                                <li><strong>معايير المحتوى والصور:</strong> يجب أن تكون النصوص والصور المرفقة دقيقة، ومناسبة للاستخدام العام، وخالية من المواد المسيئة أو المخالفة للقانون أو المنتهكة لحقوق الآخرين. وتحتفظ المنصة بحق مراجعة أي مساهمة أو تعديلها أو رفضها أو حذفها إذا خالفت معايير الدقة والجودة المجتمعية.</li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <Code2 className="w-5 h-5 text-primary" aria-hidden="true" />
                                الواجهات البرمجية المفتوحة ورموز الوكلاء
                            </h2>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                            <ul className="list-disc list-inside space-y-2 ms-4">
                                <li><strong>البيانات المفتوحة وحدود المعدل (<span dir="ltr">/api/v1/*</span> و<span dir="ltr">/mcp/public</span>):</strong> تتيح المنصة واجهات برمجية عامة للقراءة فقط للاستخدام البحثي والبرمجي والمجتمعي. يجب الالتزام بحدود معدل الطلبات (Rate Limits) وعدم التحايل عليها أو إثقال الخوادم باستعلامات آلية مفرطة، مع نسب المصدر إلى «المساحة السورية» عند إعادة النشر.</li>
                                <li><strong>رموز الوكلاء (<span dir="ltr">Sanctum</span> و<span dir="ltr">/mcp/admin</span>):</strong> تُمنح رموز الوصول الإدارية للمحررين المخوَّلين شخصياً. يلتزم حامل الرمز بالحفاظ على سريته وعدم مشاركته، وتحتفظ المنصة بحق إلغاء أي رمز فوراً عند انتهاء الصلاحية أو الاشتباه بتسريبه أو إساءة استخدامه.</li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <HelpCircle className="w-5 h-5 text-primary" aria-hidden="true" />
                                الألعاب والسلوك فيها
                            </h2>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                            <p>
                                تُدار لعبة «من هو؟» (Guess Who) على خوادم المنصة، حيث تُعالَج الأدوار والأسرار والاستبعادات، وتُبثّ حالتها لحظياً عبر Laravel Reverb، دون اتصال مباشر بين اللاعبين (Peer-to-Peer) ودون نقل للصوت أو الصورة. أما الألعاب الفردية (2048 وسوليتير وطرنيب وتركس) فتُحفظ نتائجها على جهازك وحده، فيما تعرض لعبة «هل تميّزها؟» إحصاءات مجمَّعة ومجهولة لمتوسط النتائج وأكثر الادّعاءات خداعاً استناداً إلى مصادر تحقّق منشورة.
                            </p>
                            <p>
                                يجب على اللاعبين الالتزام بآداب الحوار واختيار أسماء غير مسيئة. ويُمنع منعاً باتاً استخدام الألعاب لنشر محتوى يحضّ على الكراهية أو التحرش أو يخالف القوانين العامة. وتحتفظ المنصة بالحق في إنهاء أي غرفة أو حظر أي حساب يخالف هذه الشروط.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <Compass className="w-5 h-5 text-primary" aria-hidden="true" />
                                بوصلة سوريا والنتائج المشتركة
                            </h2>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                            <p>
                                يمنحك اختبار «بوصلة سوريا» نتيجة شخصية، ويمكنك اختيار مشاركتها عبر رابط عام يُظهر إجاباتك ونتيجتك لكل من يملك الرابط، فتكون مسؤولاً عن هذه المشاركة.
                            </p>
                            <p>
                                تعرض المنصة إحصاءات مجمَّعة مجهولة الهوية من النتائج التي اختار أصحابها مشاركتها للإحصاء، دون كشف أي نتيجة فردية أو معرّف.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader>
                            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-primary" aria-hidden="true" />
                                إخلاء المسؤولية وحدودها
                            </h2>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                            <p>
                                تُقدَّم منصة <strong>المساحة السورية</strong> وأدواتها «كما هي» دون أي ضمانات صريحة أو ضمنية.
                            </p>
                            <ul className="list-disc list-inside space-y-2 ms-4">
                                <li><strong>دقة خرائط النقل والأدلة:</strong> نظراً إلى اعتماد بيانات «ترانزيت» و«مشوار» ودليل الهاتف والمنافذ الحدودية على المساهمات المجتمعية والمصادر الخارجية، لا نضمن دقة مواعيد الحافلات أو استمرار عمل الأرقام أو ثبات الأسعار وحالة المعابر لحظياً.</li>
                                <li><strong>انقطاع الخدمة:</strong> لا نتحمل المسؤولية عن أي انقطاع مؤقت أو دائم للخدمة أو فقدان للبيانات نتيجة أعطال تقنية أو أعمال صيانة.</li>
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
