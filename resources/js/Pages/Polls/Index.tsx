import React from 'react';
import { Link } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Settings2 } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { useCanModule } from '@/Lib/useCan';
import type { Poll } from '@/Domain/polls/types';

interface PollsPageProps {
    polls: Poll[];
}

export default function Index({ polls = [] }: PollsPageProps) {
    // Capability-based, not role-based: the polls_admin middleware accepts any
    // of polls.*, so a user holding them can manage polls but would not see
    // the controls under a role-string check.
    const canManage = useCanModule()('polls');

    return (
        <MainLayout>
            <div className="min-h-screen bg-background text-foreground">
                <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-3xl font-bold">الاستبيانات واستطلاعات الرأي</h1>
                        {canManage && (
                            <Button asChild variant="outline">
                                <Link href="/dashboard">
                                    <Settings2 className="h-4 w-4 me-2" />
                                    إدارة الاستبيانات في لوحة التحكم
                                </Link>
                            </Button>
                        )}
                    </div>

                    {polls.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">لا توجد استطلاعات رأي نشطة حالياً.</div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {polls.map((poll) => (
                                <Link
                                    key={poll.id}
                                    href={`/polls/${poll.slug}`}
                                    className="block bg-card overflow-hidden shadow border border-border rounded-lg hover:shadow-md transition-shadow duration-200 p-6"
                                >
                                    <h2 className="text-lg font-medium hover:text-primary mb-2 transition-colors">
                                        {poll.title}
                                    </h2>
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${poll.is_active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                            {poll.is_active ? 'نشط' : 'مغلق'}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
