import React from 'react';
import { Link, Head } from '@inertiajs/react';
import TierBoard from "@/Components/poll/TierBoard";
import { Card, CardContent } from "@/Components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/Components/ui/alert";
import { AlertCircleIcon, BarChart3Icon } from "lucide-react";
import { Button } from "@/Components/ui/button";
import MainLayout from '@/Layouts/MainLayout';

interface Candidate {
    id: string;
    name: string;
    title?: string | null;
    imageUrl: string | null;
    category?: string | null;
    candidate_group_id?: string | null;
}

interface CandidateGroup {
    id: string;
    name: string;
    key?: string | null;
}

interface Poll {
    id: string;
    slug: string;
    title: string;
}

interface TierListPageProps {
    poll: Poll;
    candidates: Candidate[];
    groups: CandidateGroup[];
    voteDay: string;
}

export default function Index({ poll, candidates = [], groups = [], voteDay }: TierListPageProps) {
    return (
        <MainLayout>
            <Head>
                <title>تير ليست الحكومة السورية | Syrian Zone</title>
                <meta name="description" content="شارك في تقييم وتصنيف أداء أعضاء الحكومة السورية الجديدة عبر منصة تير ليست تفاعلية وشاركه مع الآخرين." />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="تير ليست الحكومة السورية | Syrian Zone" />
                <meta property="og:description" content="شارك في تقييم وتصنيف أداء أعضاء الحكومة السورية الجديدة عبر منصة تير ليست تفاعلية وشاركه مع الآخرين." />
            </Head>
            <main className="container mx-auto px-4 pt-6 pb-8" dir="rtl">
                {/* Results Link */}
                <div className="max-w-screen-lg mx-auto mb-4 flex justify-end">
                    <Link href="/tierlist/leaderboard">
                        <Button variant="outline" className="gap-2">
                            <BarChart3Icon className="h-4 w-4" />
                            عرض النتائج
                        </Button>
                    </Link>
                </div>

                <div className="max-w-screen-lg mx-auto mb-4">
                    <Alert>
                        <AlertCircleIcon className="h-5 w-5" />
                        <div>
                            <AlertTitle>تنويه</AlertTitle>
                            <AlertDescription>
                                هذه منصّة تصويت مجتمعيّة ذات طابع ساخر، وغايتها الترفيه والمناقشة فحسب. وما يُنشر من نتائج ليس استطلاعاً علميّاً، ولا يُمثّل رأياً رسميّاً، ولا يرتبط بأي جهة حكوميّة.
                            </AlertDescription>
                        </div>
                    </Alert>
                </div>

                <h1 className="text-3xl font-extrabold text-center mb-4 text-foreground">تير ليست الحكومة السورية الجديدة</h1>
                <p className="text-center text-muted-foreground mb-6">
                    يمكن حفظ صورة جاهزة لمشاركتها على السوشال ميديا بسهولة من خلال الزر الموجود في آخر الصفحة
                </p>

                <Card className="max-w-screen-lg mx-auto mb-6">
                    <CardContent className="p-4">
                        <p className="text-center text-muted-foreground mb-3">
                            في نسخة الكمبيوتر: يمكنك سحب وافلات اسم الوزير في القائمة
                        </p>
                        <p className="text-center text-muted-foreground">
                            في نسخة الموبايل: يمكنك النقر على اسم الوزير ثم النقر على المكان في القائمة لنقله
                        </p>
                    </CardContent>
                </Card>

                {poll ? (
                    <TierBoard
                        initialCandidates={candidates}
                        groups={groups}
                        pollId={poll.id}
                        voteDay={voteDay}
                        submitApiPath="/api/submit"
                        pollSlug="best-ministers"
                    />
                ) : (
                    <Card className="max-w-screen-lg mx-auto">
                        <CardContent className="p-6 text-center text-gray-600 dark:text-gray-400">
                            لم يتم تهيئة الاستبيان بعد. يرجى إعادة المحاولة لاحقًا.
                        </CardContent>
                    </Card>
                )}
            </main>
        </MainLayout>
    );
}
