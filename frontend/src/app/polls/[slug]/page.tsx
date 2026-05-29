'use client';



import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Edit, BarChart3Icon } from 'lucide-react';
import Link from 'next/link';
import TierBoard from "@/components/poll/TierBoard";
import { Card, CardContent } from "@/components/ui/card";

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

export default function SinglePollPage() {
    const params = useParams();
    const { slug } = params;
    const { isAdmin } = useAuth();

    const [data, setData] = useState<PollData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!slug) return;

        axios.get(`/polls/${slug}`)
            .then(response => {
                const responseData = response.data.data || response.data;

                // Normalize candidate imageUrl field and safeguard against undefined/null
                const rawCandidates = responseData.candidates || [];
                const candidates = rawCandidates.map((c: any) => ({
                    ...c,
                    imageUrl: c.imageUrl || c.image_url || null,
                }));

                // Handle groups - merge from response if available
                const groups = responseData.groups || [];

                setData({
                    poll: responseData.poll,
                    candidates,
                    groups,
                    voteDay: responseData.voteDay,
                });
                setLoading(false);
            })
            .catch(error => {
                console.error('Error fetching poll:', error);
                setError(true);
                setLoading(false);
            });
    }, [slug]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center text-muted-foreground">Poll not found.</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-12">
            <main className="container mx-auto px-4 pt-6" dir="rtl">
                <div className="max-w-screen-lg mx-auto mb-4 flex justify-between items-center">
                    {isAdmin && (
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/polls/${data.poll.id}/edit`}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Poll
                            </Link>
                        </Button>
                    )}
                    <Link href={`/tierlist/leaderboard`}>
                        <Button variant="outline" className="gap-2">
                            <BarChart3Icon className="h-4 w-4" />
                            النتائج
                        </Button>
                    </Link>
                </div>

                <h1 className="text-3xl font-extrabold text-center mb-8 text-foreground">{data.poll.title}</h1>

                <TierBoard
                    initialCandidates={data.candidates}
                    groups={data.groups}
                    pollId={data.poll.id}
                    voteDay={data.voteDay}
                    submitApiPath="/submit"
                    pollSlug={data.poll.slug}
                />
            </main>
        </div>
    );
}
