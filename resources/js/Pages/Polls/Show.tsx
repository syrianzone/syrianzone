import React from 'react';
import { Link, usePage, Head } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Edit, BarChart3Icon } from 'lucide-react';
import TierBoard from "@/Components/poll/TierBoard";
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

interface PollShowProps {
    poll: Poll;
    candidates: Candidate[];
    groups: CandidateGroup[];
    voteDay: string;
}

export default function Show({ poll, candidates, groups, voteDay }: PollShowProps) {
    const { auth } = usePage().props as any;
    const isAdmin = !!auth?.user;

    return (
        <MainLayout>
            <Head>
                <title>{`${poll.title} | استطلاعات سوريا زون`}</title>
                <meta name="description" content={`شارك في استطلاع الرأي والتقييم المجتمعي لـ ${poll.title} وصوّت وشارك رأيك معنا.`} />
                <meta property="og:type" content="website" />
                <meta property="og:title" content={`${poll.title} | استطلاعات سوريا زون`} />
                <meta property="og:description" content={`شارك في استطلاع الرأي والتقييم المجتمعي لـ ${poll.title} وصوّت وشارك رأيك معنا.`} />
            </Head>
            <div className="min-h-screen bg-background pb-12">
                <main className="container mx-auto px-4 pt-6" dir="rtl">
                    <div className="max-w-screen-lg mx-auto mb-4 flex justify-between items-center">
                        {isAdmin && (
                            <Button asChild variant="outline" size="sm">
                                <Link href={`/admin/polls/${poll.id}/edit`}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Poll
                                </Link>
                            </Button>
                        )}
                        <Link href={`/polls/${poll.slug}/leaderboard`}>
                            <Button variant="outline" className="gap-2">
                                <BarChart3Icon className="h-4 w-4" />
                                النتائج
                            </Button>
                        </Link>
                    </div>

                    <h1 className="text-3xl font-extrabold text-center mb-8 text-foreground">{poll.title}</h1>

                    <TierBoard
                        initialCandidates={candidates}
                        groups={groups}
                        pollId={poll.id}
                        voteDay={voteDay}
                        submitApiPath="/api/submit"
                        pollSlug={poll.slug}
                    />
                </main>
            </div>
        </MainLayout>
    );
}
