import React from 'react';
import { Link } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent } from '@/Components/ui/card';
import { Settings2 } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { PageBody, PageHeader } from '@/Components/layout';
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
            <div className="min-h-screen bg-background text-foreground" dir="rtl">
                <PageBody className="space-y-6">
                    <PageHeader
                        title="الاستبيانات واستطلاعات الرأي"
                        description="شارك برأيك في الاستطلاعات المفتوحة وتصفّح نتائج التصويت المجتمعي."
                        divider
                        actions={canManage ? (
                            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
                                <Link href="/dashboard">
                                    <Settings2 className="h-4 w-4" aria-hidden="true" />
                                    <span>إدارة الاستبيانات</span>
                                </Link>
                            </Button>
                        ) : undefined}
                    />

                    {polls.length === 0 ? (
                        <div className="rounded-lg border border-border bg-card py-12 text-center text-sm text-muted-foreground">
                            لا توجد استطلاعات رأي نشطة حالياً.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {polls.map((poll) => (
                                <Link
                                    key={poll.id}
                                    href={`/polls/${poll.slug}`}
                                    className="group block no-underline"
                                >
                                    <Card className="h-full transition-colors hover:border-primary/40">
                                        <CardContent className="p-5 flex flex-col justify-between gap-3 h-full">
                                            <h2 className="text-base font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
                                                {poll.title}
                                            </h2>
                                            <div className="flex items-center">
                                                <Badge variant={poll.is_active ? 'success' : 'secondary'}>
                                                    {poll.is_active ? 'نشط' : 'مغلق'}
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    )}
                </PageBody>
            </div>
        </MainLayout>
    );
}
