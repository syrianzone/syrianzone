import React from 'react';
import { Head } from '@inertiajs/react';
import { Scale, User, X } from 'lucide-react';
import { Card, CardContent } from '@/Components/ui/card';
import { cn } from '@/lib/utils';
import MainLayout from '@/Layouts/MainLayout';
import data from './_data/detainees.json';

type Rank = { ar: string; count: number };
type Individual = { name: string; role: string; photo: string | null };
type Member = { name: string; role?: string; photo?: string };
type Group = { title: string; members: Member[] };

const { meta, ranks, individuals, hierarchy } = data as {
    meta: { source: string; sourceHandle: string; sourceUrl: string; asOf: string; totalDetainees: number; rankedTotal: number };
    ranks: Rank[];
    individuals: Individual[];
    hierarchy: { source: string; sourceUrl: string; root: Member; groups: Group[] };
};

const fmt = (n: number) => n.toLocaleString('en-US');

const updatedArabic = new Date().toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' });

// names already announced as detained by the MoI; matched members get a cross
const detainedNames = new Set(individuals.map((p) => p.name));
const anyDetained = [hierarchy.root, ...hierarchy.groups.flatMap((g) => g.members)].some((m) => detainedNames.has(m.name));

function MemberCard({ member, root = false }: { member: Member; root?: boolean }) {
    const detained = detainedNames.has(member.name);
    return (
        <div
            className={cn(
                'relative flex items-center gap-3 rounded-xl border bg-card p-3',
                detained ? 'border-red-500/60 ring-1 ring-red-500/40' : 'border-border',
                root && 'shadow-sm'
            )}
            title={detained ? 'مدرج في قائمة الموقوفين' : undefined}
        >
            {detained && (
                <span className="absolute -top-2.5 -left-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow ring-2 ring-background">
                    <X className="h-4 w-4" strokeWidth={3} />
                </span>
            )}
            {member.photo ? (
                <img
                    src={member.photo}
                    alt={member.name}
                    loading="lazy"
                    className={cn('shrink-0 rounded-xl object-cover border border-border bg-muted', root ? 'h-16 w-16' : 'h-12 w-12')}
                />
            ) : (
                <div
                    className={cn(
                        'shrink-0 rounded-xl border border-border bg-muted flex items-center justify-center text-muted-foreground',
                        root ? 'h-16 w-16' : 'h-12 w-12'
                    )}
                >
                    <User className={root ? 'h-7 w-7' : 'h-6 w-6'} />
                </div>
            )}
            <div className="min-w-0">
                <div className={cn('font-bold text-foreground leading-snug', root && 'text-lg')}>{member.name}</div>
                {member.role && (
                    <div className={cn('text-xs leading-snug text-muted-foreground', root && 'text-primary')}>{member.role}</div>
                )}
            </div>
        </div>
    );
}

export default function JusticePage() {
    return (
        <MainLayout>
            <Head>
                <title>العدالة الانتقالية | Syrian Zone</title>
                <meta name="description" content="العدالة الانتقالية - قوائم وإحصائيات رموز نظام الأسد والمجرمين الموقوفين لدى وزارة الداخلية السورية وهيكل القيادة العسكرية والأمنية." />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="العدالة الانتقالية | Syrian Zone" />
                <meta property="og:description" content="العدالة الانتقالية - قوائم وإحصائيات رموز نظام الأسد والمجرمين الموقوفين لدى وزارة الداخلية السورية وهيكل القيادة العسكرية والأمنية." />
            </Head>
            <main className="container mx-auto max-w-screen-xl px-4 pt-6 pb-16" dir="rtl">
                {/* Header */}
                <header className="text-center mb-10">
                    <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 text-primary mb-4">
                        <Scale className="h-7 w-7" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">العدالة الانتقالية</h1>
                    <p className="mt-3 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
                        قائمة بأبرز مجرمي نظام الأسد الموقوفين لدى وزارة الداخلية السورية ضمن حملة &quot;المخطط يليق بك&quot;
                    </p>
                    <p className="mt-4 text-xs text-muted-foreground">محدّث حتى {updatedArabic}</p>
                </header>

                {/* Command hierarchy */}
                <section aria-labelledby="tree-heading" className="mb-12">
                    <h2 id="tree-heading" className="text-2xl md:text-3xl font-bold text-foreground text-center mb-6">القائمة السوداء</h2>
                    {anyDetained && (
                        <p className="text-xs text-muted-foreground text-center">
                            الإشارة <span className="text-red-500 font-semibold">✕</span> تعني أن الاسم مدرج ضمن قائمة الموقوفين.
                        </p>
                    )}

                    {/* root */}
                    <div className="flex flex-col items-center">
                        <div className="w-full max-w-xs">
                            <MemberCard member={hierarchy.root} root />
                        </div>
                        <div className="h-6 w-px bg-border" />
                    </div>

                    {/* branches */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
                        {hierarchy.groups.map((group) => (
                            <div key={group.title} className="rounded-2xl border border-border bg-muted/30 p-4">
                                <h3 className="text-center text-sm font-bold text-foreground mb-4">{group.title}</h3>
                                <div className="space-y-3">
                                    {group.members.map((member, i) => (
                                        <MemberCard key={`${member.name}-${i}`} member={member} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Stats dashboard */}
                <section aria-labelledby="stats-heading" className="mb-12">
                    <Card className="overflow-hidden">
                        <CardContent className="p-6 md:p-8">
                            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                                <div>
                                    <h2 id="stats-heading" className="text-lg font-bold text-foreground">إجمالي الموقوفين</h2>
                                    <p className="text-sm text-muted-foreground">منهم {fmt(meta.rankedTotal)} من أصحاب الرتب العسكرية</p>
                                </div>
                                <div className="text-4xl md:text-5xl font-extrabold text-primary tabular-nums">{fmt(meta.totalDetainees)}</div>
                            </div>

                            <h3 className="text-sm font-semibold text-muted-foreground mb-3">أصحاب الرتب العسكرية من الموقوفين</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                {ranks.map((rank) => (
                                    <div key={rank.ar} className="rounded-xl border border-border bg-muted/40 p-3 text-center">
                                        <div className="text-2xl font-extrabold text-foreground tabular-nums">{fmt(rank.count)}</div>
                                        <div className="mt-1 text-xs text-muted-foreground">{rank.ar}</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Individuals */}
                <section aria-labelledby="people-heading">
                    <h2 id="people-heading" className="text-lg font-bold text-foreground mb-1">أبرز الموقوفين</h2>
                    <p className="text-sm text-muted-foreground mb-5">{fmt(individuals.length)} من رموز النظام</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {individuals.map((person) => (
                            <Card key={person.name} className="overflow-hidden">
                                <CardContent className="flex items-start gap-4 p-4">
                                    {person.photo ? (
                                        <img
                                            src={person.photo}
                                            alt={person.name}
                                            loading="lazy"
                                            className="h-20 w-20 shrink-0 rounded-xl object-cover border border-border bg-muted"
                                        />
                                    ) : (
                                        <div className="h-20 w-20 shrink-0 rounded-xl border border-border bg-muted flex items-center justify-center text-muted-foreground">
                                            <User className="h-8 w-8" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-foreground leading-snug">{person.name}</h3>
                                        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{person.role}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>
            </main>
        </MainLayout>
    );
}
