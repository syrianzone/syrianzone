import React, { useMemo, useState } from 'react';
import MainLayout from '@/Layouts/MainLayout';
import HouseClient from './HouseClient';
import Hero2026 from './Hero2026';
import ParliamentChart2026, { type Dim } from './ParliamentChart2026';
import MemberTable2026 from './MemberTable2026';
import { MEMBERS_2026, type Member2026 } from './members2026';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/Components/ui/accordion';
import { Head } from '@inertiajs/react';

interface Props {
    members2026?: Member2026[];
}

export default function HousePage({ members2026 }: Props) {
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [dim, setDim] = useState<Dim>('selection');
    const [gov, setGov] = useState('all');
    const [gender, setGender] = useState('all');
    const [selection, setSelection] = useState('all');
    const [age, setAge] = useState('all');

    const members = useMemo(
        () => (members2026 && members2026.length > 0 ? members2026 : MEMBERS_2026),
        [members2026],
    );
    const counts = useMemo(() => {
        const active = members.filter((m) => (m.status || 'active') === 'active');
        return {
            total: members.length,
            female: active.filter((m) => m.gender === 'F').length,
            male: active.filter((m) => m.gender !== 'F').length,
        };
    }, [members]);

    // Clicking a chart legend item filters the table below (toggle off on re-click)
    const handleLegendClick = (d: Dim, key: string) => {
        if (d === 'governorate') setGov((v) => (v === key ? 'all' : key));
        else if (d === 'gender') setGender((v) => (v === key ? 'all' : key));
        else if (d === 'selection') setSelection((v) => (v === key ? 'all' : key));
        else setAge((v) => (v === key ? 'all' : key));
    };
    const selectedKey = dim === 'governorate' ? gov : dim === 'gender' ? gender : dim === 'selection' ? selection : age;

    return (
        <MainLayout>
            <Head>
                <title>المجلس التشريعي السوري 2026 | Syrian Zone</title>
                <meta name="description" content="التشكيلة النهائية لمجلس الشعب السوري 2026: مخطط القاعة، إحصائيات، وقائمة الأعضاء. المصدر: مركز عمران للدراسات الاستراتيجية." />
            </Head>
            <div className="min-h-screen bg-background pb-16">
                <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
                    <Hero2026 total={counts.total} female={counts.female} male={counts.male} />
                    <ParliamentChart2026
                        members={members}
                        dim={dim}
                        onDimChange={setDim}
                        selectedKey={selectedKey}
                        onLegendClick={handleLegendClick}
                    />
                    <MemberTable2026
                        members={members}
                        filters={{ gov, gender, selection, age, onGov: setGov, onGender: setGender, onSelection: setSelection, onAge: setAge }}
                    />

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
