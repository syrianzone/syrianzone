"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "@/lib/axios";
import TierBoard from "@/components/poll/TierBoard";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, BarChart3Icon } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";

interface Candidate {
    id: string;
    name: string;
    title?: string | null;
    imageUrl: string | null;
    image_url?: string | null;
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
    timezone?: string;
}

interface PollData {
    poll: Poll;
    candidates: Candidate[];
    groups: CandidateGroup[];
    voteDay: string;
}

export default function TierListPage() {
    const [data, setData] = useState<PollData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        axios
            .get("/polls/best-ministers")
            .then((response) => {
                const responseData = response.data.data || response.data;

                // Normalize candidate imageUrl field and safeguard against undefined/null
                const rawCandidates = responseData.candidates || [];
                const candidates = rawCandidates.map((c: any) => ({
                    ...c,
                    imageUrl: c.imageUrl || c.image_url || null,
                }));
                setData({
                    poll: responseData.poll,
                    candidates,
                    groups: responseData.groups || [],
                    voteDay: responseData.voteDay,
                });
                setLoading(false);
            })
            .catch((err) => {
                console.error("Error fetching poll:", err);
                setError(true);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <main className="container mx-auto px-4 pt-10 pb-8">
                <div className="text-center text-muted-foreground">جاري التحميل...</div>
            </main>
        );
    }

    return (
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
            {data && !error ? (
                <TierBoard
                    initialCandidates={data.candidates}
                    groups={data.groups}
                    pollId={data.poll.id}
                    voteDay={data.voteDay}
                    submitApiPath="/submit"
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
    );
}

