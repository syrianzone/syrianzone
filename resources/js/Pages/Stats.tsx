import { Link } from '@inertiajs/react';
import { ExternalLink, Sparkles } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { PageBody, PageHeader } from '@/Components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import { CompassIcon, TierlistIcon } from '@/Components/Icons/ProjectIcons';

// The only place the Data Studio report id is known.
const ANALYTICS_REPORT_URL = "https://datastudio.google.com/embed/reporting/65f1f763-c5ab-4841-bfba-bd7403d76645/page/KGHXF";

export default function Stats() {
    return (
        <MainLayout>
            <PageHeader
                title="إحصائيات المنصة"
                description="تقارير وإحصائيات تفاعلية حول التفاعل والنشاط في المساحة السورية."
                divider
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
                            <Link href="/tierlist/leaderboard">
                                <TierlistIcon className="h-4 w-4" aria-hidden="true" />
                                <span>تير ليست الحكومة</span>
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
                            <Link href="/compass/stats">
                                <CompassIcon className="h-4 w-4" aria-hidden="true" />
                                <span>بوصلة سوريا</span>
                            </Link>
                        </Button>
                    </div>
                }
            />
            <PageBody className="pt-6 space-y-6">

                <div className="space-y-6" dir="rtl">
                    <Card className="border-border bg-card">
                        <CardHeader className="flex flex-row items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
                                    تقرير الإحصائيات التفاعلي
                                </CardTitle>
                                <CardDescription>
                                    بيانات مباشرة ومحدّثة تعكس التفاعل وحركة الزوار عبر أدوات المنصة
                                </CardDescription>
                            </div>
                            <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
                                <a href={ANALYTICS_REPORT_URL} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4" aria-hidden="true" />
                                    <span>فتح في نافذة جديدة</span>
                                </a>
                            </Button>
                        </CardHeader>
                        <CardContent className="p-2 md:p-4">
                            <div className="relative w-full rounded-lg overflow-hidden border border-border bg-background">
                                <iframe
                                    src={ANALYTICS_REPORT_URL}
                                    width="100%"
                                    height="750"
                                    frameBorder="0"
                                    style={{ border: 0 }}
                                    allowFullScreen
                                    sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                                    className="w-full min-h-[600px] md:min-h-[750px]"
                                    title="Syrian Zone Analytics Report"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </PageBody>
        </MainLayout>
    );
}
