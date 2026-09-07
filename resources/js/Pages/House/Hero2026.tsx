import { Card, CardContent } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import { OMran_SOURCE_URL } from './members2026';

export default function Hero2026({ total, female, male }: { total: number; female: number; male: number }) {
    return (
        <Card className="overflow-hidden">
            <CardContent className="p-6 md:p-8 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">مجلس الشعب السوري 2026</Badge>
                    <Badge variant="outline">{total} عضواً</Badge>
                    <Badge variant="outline">ذكور {male}</Badge>
                    <Badge variant="outline">إناث {female}</Badge>
                </div>
                <h1 className="text-3xl font-bold text-foreground">التشكيلة النهائية لمجلس الشعب 2026</h1>
                <p className="text-muted-foreground leading-relaxed">
                    عرض تفاعلي لتوزيع أعضاء المجلس داخل القاعة بحسب المحافظة والجنس وسنة الميلاد، مع إمكانية البحث والتصفية.
                    البيانات الأساسية (الاسم، المحافظة، الجنس، سنة الميلاد) مأخوذة من المخطط التفاعلي لمركز عمران للدراسات الاستراتيجية.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    المصدر: <a href={OMran_SOURCE_URL} target="_blank" rel="noreferrer" className="underline font-semibold text-primary">مركز عمران — المخطط التفاعلي لمجلس الشعب السوري 2026</a>.
                    تجدون هناك أيضاً بيانات إضافية لكل عضو: طريقة التعيين، صفة العضوية، العرق والديانة والمذهب، الفئة العمرية، القطاع والفصيل، والتحصيل العلمي.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    ملاحظة: أبقينا بيانات المرحلة الانتقالية (الهيئات الناخبة، المرشحون، الفائزون) في <a href="#historical-archive" className="underline font-semibold text-primary">قسم البيانات التاريخية أسفل الصفحة</a> للرجوع إليها عند الحاجة.
                </p>
            </CardContent>
        </Card>
    );
}
