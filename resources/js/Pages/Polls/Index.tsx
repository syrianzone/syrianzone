import React from 'react';
import { Link, Head } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Edit } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';

interface Poll {
    id: string;
    slug: string;
    title: string;
    is_active: boolean;
}

interface PollsPageProps {
    polls: Poll[];
}

export default function Index({ polls = [] }: PollsPageProps) {
    return (
        <MainLayout>
            <Head>
                <title>الاستبيانات واستطلاعات الرأي</title>
                <meta name="description" content="شارك في الاستبيانات واستطلاعات الرأي المجتمعية حول مختلف القضايا والشؤون السورية." />
            </Head>
            <div className="min-h-screen bg-background text-foreground">
                <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-3xl font-bold">Active Polls</h1>
                        <Button asChild>
                            <Link href="/admin/polls/create">
                                Create New Poll
                            </Link>
                        </Button>
                    </div>

                    {polls.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">No active polls found.</div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {polls.map((poll) => (
                                <div key={poll.id} className="relative bg-card overflow-hidden shadow border border-border rounded-lg hover:shadow-md transition-shadow duration-200">
                                    <Link href={`/polls/${poll.slug}`} className="block p-6">
                                        <h3 className="text-lg font-medium hover:text-primary mb-2 transition-colors">
                                            {poll.title}
                                        </h3>
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${poll.is_active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                {poll.is_active ? 'Active' : 'Closed'}
                                            </span>
                                        </div>
                                    </Link>
                                    <div className="absolute top-4 right-4 group">
                                        <Button asChild variant="outline" size="sm" className="h-8 w-8 p-0">
                                            <Link href={`/admin/polls/${poll.id}/edit`}>
                                                <Edit className="h-4 w-4" />
                                                <span className="sr-only">Edit</span>
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </MainLayout>
    );
}
