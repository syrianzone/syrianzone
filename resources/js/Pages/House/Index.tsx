import React, { useEffect, useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import HouseClient from './HouseClient';
import Hero2026 from './Hero2026';
import ParliamentChart2026, { type Dim } from './ParliamentChart2026';
import MemberTable2026 from './MemberTable2026';
import { MEMBERS_2026, type Member2026 } from './members2026';
import { governorateByAnyName } from '@/Domain/geography/governorates';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/Components/ui/accordion';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';

interface Props {
    members2026?: Member2026[];
}

export default function HousePage({ members2026 }: Props) {
    const [archiveOpen, setArchiveOpen] = useState(false);
    // A link to #historical-archive (the hero's, or a shared URL) opens the section.
    useEffect(() => {
        const sync = () => {
            if (window.location.hash === '#historical-archive') setArchiveOpen(true);
        };
        sync();
        window.addEventListener('hashchange', sync);
        return () => window.removeEventListener('hashchange', sync);
    }, []);
    const [dim, setDim] = useState<Dim>('selection');
    const [gov, setGov] = useState('all');
    const [gender, setGender] = useState('all');
    const [selection, setSelection] = useState('all');
    const [age, setAge] = useState('all');
    const [social, setSocial] = useState('all');

    const members = useMemo(() => {
        if (!members2026 || members2026.length === 0) return MEMBERS_2026;
        const byName = new Map(MEMBERS_2026.map((m) => [m.name_ar.trim(), m]));
        return members2026.map((m) => {
            if (m.facebook_url || m.twitter_url) return m;
            const fallback = byName.get((m.name_ar || '').trim());
            if (!fallback) return m;
            return {
                ...m,
                facebook_url: m.facebook_url ?? fallback.facebook_url,
                twitter_url: m.twitter_url ?? fallback.twitter_url,
            };
        });
    }, [members2026]);
    const counts = useMemo(() => {
        const active = members.filter((m) => (m.status || 'active') === 'active');
        return {
            total: members.length,
            female: active.filter((m) => m.gender === 'F').length,
            male: active.filter((m) => m.gender !== 'F').length,
        };
    }, [members]);

    const handleLegendClick = (d: Dim, key: string) => {
        if (d === 'governorate') setGov((v) => (v === key ? 'all' : key));
        else if (d === 'gender') setGender((v) => (v === key ? 'all' : key));
        else if (d === 'selection') setSelection((v) => (v === key ? 'all' : key));
        else if (d === 'social') setSocial((v) => (v === key ? 'all' : key));
        else setAge((v) => (v === key ? 'all' : key));
    };
    const selectedKey = dim === 'governorate' ? gov : dim === 'gender' ? gender : dim === 'selection' ? selection : dim === 'social' ? social : age;

    const groupedByGovernorate = useMemo(() => {
        const groups = new Map<string, { label: string; sortOrder: number; items: Member2026[] }>();
        for (const m of members) {
            const govInfo = governorateByAnyName(m.governorate_ar || '');
            const label = govInfo?.nameAr ?? (m.governorate_ar || 'غير محدد');
            const sortOrder = govInfo?.sortOrder ?? 999;
            const existing = groups.get(label);
            if (existing) {
                existing.items.push(m);
            } else {
                groups.set(label, { label, sortOrder, items: [m] });
            }
        }
        return Array.from(groups.values())
            .map((group) => ({
                ...group,
                items: [...group.items].sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar')),
            }))
            .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'ar'));
    }, [members]);

    return (
        <MainLayout>
            
            <div className="min-h-screen bg-background pb-16">
                <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
                    <Hero2026 total={counts.total} female={counts.female} male={counts.male} onOpenArchive={() => setArchiveOpen(true)} />
                    <ParliamentChart2026
                        members={members}
                        dim={dim}
                        onDimChange={setDim}
                        selectedKey={selectedKey}
                        onLegendClick={handleLegendClick}
                    />
                    <MemberTable2026
                        members={members}
                        filters={{ gov, gender, selection, age, social, onGov: setGov, onGender: setGender, onSelection: setSelection, onAge: setAge, onSocial: setSocial }}
                    />

                    <section aria-labelledby="house-by-governorate" className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 id="house-by-governorate" className="text-2xl font-bold text-foreground">
                                أسماء أعضاء مجلس الشعب السوري حسب المحافظة
                            </h2>
                            <span className="text-sm text-muted-foreground">{groupedByGovernorate.length} محافظة</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {groupedByGovernorate.map((group) => (
                                <Card key={group.label} className="border-border bg-card/70">
                                    <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                                        <CardTitle className="text-base font-bold text-foreground">{group.label}</CardTitle>
                                        <Badge variant="secondary" className="text-xs">{group.items.length} عضو</Badge>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="space-y-1.5 text-sm">
                                            {group.items.map((m) => (
                                                <li key={m.member_number || m.name_ar} className="flex items-baseline justify-between gap-2">
                                                    {m.member_number ? (
                                                        <Link
                                                            href={`/house/members/${m.member_number}`}
                                                            className="font-medium text-primary hover:underline"
                                                        >
                                                            {m.name_ar}
                                                        </Link>
                                                    ) : (
                                                        <span className="font-medium text-foreground">{m.name_ar}</span>
                                                    )}
                                                    {(m.management_position || m.selection_method) && (
                                                        <span className="text-xs text-muted-foreground shrink-0">
                                                            {m.management_position || m.selection_method}
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </section>

                    <div id="historical-archive" className="scroll-mt-24">
                        <Accordion type="single" value={archiveOpen ? 'archive' : ''} onValueChange={(v) => setArchiveOpen(v === 'archive')}>
                            <AccordionItem value="archive">
                                <AccordionTrigger>البيانات التاريخية (الهيئات الناخبة / المرشحون / الفائزون / الثلث الرئاسي)</AccordionTrigger>
                                <AccordionContent>
                                    {archiveOpen ? (
                                        <HouseClient initialData={[]} initialHeaders={[]} initialMode="voters" />
                                    ) : (
                                        <p className="text-sm text-muted-foreground">افتح هذا القسم لتحميل البيانات التاريخية عند الطلب فقط.</p>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                </div>

                <footer className="py-8 bg-card text-center text-sm text-muted-foreground border-t border-border mt-12">
                    <p>&copy; 2025 syrian.zone — المصدر: مركز عمران للدراسات الاستراتيجية</p>
                    <div className="flex justify-center gap-4 mt-2">
                        <a href="https://hadealahmad.com" target="_blank" className="hover:text-primary transition">الموقع الشخصي</a>
                        <a href="https://x.com/hadealahmad" target="_blank" className="hover:text-primary transition">Twitter</a>
                    </div>
                </footer>
            </div>
        </MainLayout>
    );
}
