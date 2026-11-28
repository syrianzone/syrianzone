import React from 'react';
import { Link } from '@inertiajs/react';
import TierBoard from "@/Domain/polls/TierBoard";
import type { Candidate, CandidateGroup } from "@/Domain/polls/TierBoard";
import type { Poll } from "@/Domain/polls/types";
import { Card, CardContent } from "@/Components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/Components/ui/alert";
import { AlertCircleIcon, BarChart3Icon } from "lucide-react";
import { Button } from "@/Components/ui/button";
import MainLayout from '@/Layouts/MainLayout';
import { PageBody, PageHeader } from '@/Components/layout';
import { CORE_POLL_SLUG } from '@/Domain/polls/core';

interface TierListPageProps {
    poll: Poll;
    candidates: Candidate[];
    groups: CandidateGroup[];
    voteDay: string;
}

export default function Index({ poll, candidates = [], groups = [], voteDay }: TierListPageProps) {
    return (
        <MainLayout>
            <PageHeader
                title="تير ليست الحكومة السورية الجديدة"
                description="رتّب أداء الوزراء وشارك بطاقة تقييمك، أو استعرض النتائج الجماعية."
                divider
                actions={
                    <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
                        <Link href="/tierlist/leaderboard">
                            <BarChart3Icon className="h-4 w-4" aria-hidden="true" />
                            <span>عرض النتائج</span>
                        </Link>
                    </Button>
                }
            />

            <PageBody className="pt-5 space-y-5">

                <Alert>
                    <AlertCircleIcon className="h-4 w-4" aria-hidden="true" />
                    <div>
                        <AlertTitle>تنويه</AlertTitle>
                        <AlertDescription>
                            هذه منصة تصويت جماهيرية ذات طابع مجتمعي، وغايتها إتاحة مساحة للتعبير والمشاركة في القضايا المطروحة. وما يُنشر من نتائج يعكس أصوات المشاركين وتوجهاتهم، ولا يمثل رأياً رسمياً، ولا يرتبط بأي جهة حكومية.
                        </AlertDescription>
                    </div>
                </Alert>

                <p className="text-xs text-muted-foreground">
                    على الكمبيوتر: اسحب وأفلت اسم الوزير في القائمة · على الموبايل: انقر على اسم الوزير ثم انقر على الصف المطلوب.
                </p>

                {poll ? (
                    <TierBoard
                        initialCandidates={candidates}
                        groups={groups}
                        pollId={poll.id}
                        voteDay={voteDay}
                        pollSlug={CORE_POLL_SLUG}
                    />
                ) : (
                    <Card>
                        <CardContent className="p-6 text-center text-muted-foreground">
                            لم يتم تهيئة الاستبيان بعد. يرجى إعادة المحاولة لاحقًا.
                        </CardContent>
                    </Card>
                )}
            </PageBody>
        </MainLayout>
    );
}
