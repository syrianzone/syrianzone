import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import SmartFilterSearch from '@/Components/SmartFilterSearch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { Badge } from '@/Components/ui/badge';
import { FilterChip } from '@/Components/ui/filter-chip';
import { Facebook, Twitter } from '@/Components/ui/icons';
import { matchesFilterText, type SmartFilterFacet, type SmartFilterValue } from '@/Lib/smartFilterSearch';
import type { Member2026 } from './members2026';
import { AGE_LABEL, ageGroupOf, SOCIAL_LABEL, socialGroupOf } from './ParliamentChart2026';

const STATUS_LABEL: Record<string, string> = { active: 'نشط', resigned: 'مستقيل', dead: 'متوفى', inactive: 'غير نشط' };

interface TableFilters {
    gov: string;
    gender: string;
    selection: string;
    age: string;
    social: string;
    onGov: (v: string) => void;
    onGender: (v: string) => void;
    onSelection: (v: string) => void;
    onAge: (v: string) => void;
    onSocial: (v: string) => void;
}

export default function MemberTable2026({ members, filters }: { members: Member2026[]; filters: TableFilters }) {
    const [q, setQ] = useState('');
    const [status, setStatus] = useState('active');
    const { gov, gender, selection, age, social, onGov, onGender, onSelection, onAge, onSocial } = filters;

    const govs = useMemo(() => Array.from(new Set(members.map((m) => m.governorate_ar).filter(Boolean))).sort(), [members]);
    const facets = useMemo<SmartFilterFacet[]>(() => [
        { key: 'gov', label: 'المحافظة', aliases: ['محافظة'], options: govs.map((g) => ({ value: g, label: g })) },
        { key: 'gender', label: 'الجنس', options: [{ value: 'M', label: 'ذكر' }, { value: 'F', label: 'أنثى' }] },
        { key: 'selection', label: 'طريقة التعيين', aliases: ['التعيين'], options: [{ value: 'انتخابات', label: 'انتخابات' }, { value: 'تعيين', label: 'تعيين' }] },
        { key: 'age', label: 'الفئة العمرية', aliases: ['العمر'], options: Object.entries(AGE_LABEL).map(([value, label]) => ({ value, label })) },
        { key: 'social', label: 'التواصل الاجتماعي', aliases: ['الحسابات'], options: Object.entries(SOCIAL_LABEL).map(([value, label]) => ({ value, label })) },
    ], [govs]);
    const searchValue: SmartFilterValue = {
        search: q,
        filters: Object.fromEntries(Object.entries({ gov, gender, selection, age, social })
            .filter(([, value]) => value !== 'all').map(([key, value]) => [key, [value]])),
        sort: '',
    };

    function changeSearch(next: SmartFilterValue) {
        setQ(next.search);
        onGov(next.filters.gov?.[0] ?? 'all');
        onGender(next.filters.gender?.[0] ?? 'all');
        onSelection(next.filters.selection?.[0] ?? 'all');
        onAge(next.filters.age?.[0] ?? 'all');
        onSocial(next.filters.social?.[0] ?? 'all');
    }

    const filtered = useMemo(
        () =>
            members.filter((m) => {
                if ((m.status || 'active') !== status) return false;
                if (gov !== 'all' && m.governorate_ar !== gov) return false;
                if (gender !== 'all' && m.gender !== gender) return false;
                if (selection !== 'all' && m.selection_method !== selection) return false;
                if (age !== 'all' && ageGroupOf(m) !== age) return false;
                if (social !== 'all' && socialGroupOf(m) !== social) return false;
                if (q && !matchesFilterText(m.name_ar, q)) return false;
                return true;
            }),
        [members, q, gov, gender, selection, age, social, status],
    );



    const counts = useMemo(() => {
        const c: Record<string, number> = { active: 0, resigned: 0, dead: 0, inactive: 0 };
        members.forEach((m) => { c[m.status || 'active'] = (c[m.status || 'active'] || 0) + 1; });
        return c;
    }, [members]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row flex-wrap gap-2 items-center justify-between">
                    <CardTitle aria-live="polite" aria-atomic="true">قائمة الأعضاء ({filtered.length})</CardTitle>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(STATUS_LABEL).map(([k, l]) => (
                            <FilterChip key={k} active={status === k} onClick={() => setStatus(k)}>{l} ({counts[k] || 0})</FilterChip>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <SmartFilterSearch
                        mobileFiltersScroll
                        facets={facets} value={searchValue} onChange={changeSearch}
                        placeholder="ابحث بالاسم أو اختر تصفية..." ariaLabel="ابحث في قائمة الأعضاء"
                    />
                    <div className="overflow-x-auto rounded-md border border-border">
                        <Table>
                            <TableHeader><TableRow><TableHead className="text-right">الاسم</TableHead><TableHead className="text-right">المحافظة</TableHead><TableHead className="text-right">الجنس</TableHead><TableHead className="text-right">سنة الميلاد</TableHead><TableHead className="text-right">طريقة التعيين</TableHead><TableHead className="text-right">التواصل الاجتماعي</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {filtered.map((m) => (
                                    <TableRow key={m.member_number || m.name_ar}>
                                        <TableCell className="font-medium">{m.name_ar}{m.management_position ? ` — ${m.management_position}` : ''}</TableCell>
                                        <TableCell>{m.governorate_ar} {m.district ? `· ${m.district}` : ''}</TableCell>
                                        <TableCell>{m.gender === 'F' ? 'أنثى' : 'ذكر'}</TableCell>
                                        <TableCell>{m.birth_year}</TableCell>
                                        <TableCell><Badge variant="outline">{m.selection_method || '—'}</Badge></TableCell>
                                        <TableCell>
                                            {(m.facebook_url && m.facebook_url.trim()) || (m.twitter_url && m.twitter_url.trim()) ? (
                                                <div className="flex items-center gap-1">
                                                    {m.facebook_url && m.facebook_url.trim() && (
                                                        <a
                                                            href={m.facebook_url.trim()}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title={`فيسبوك — ${m.name_ar}`}
                                                            aria-label={`صفحة فيسبوك للعضو ${m.name_ar}`}
                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition"
                                                        >
                                                            <Facebook className="h-4 w-4" />
                                                        </a>
                                                    )}
                                                    {m.twitter_url && m.twitter_url.trim() && (
                                                        <a
                                                            href={m.twitter_url.trim()}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title={`إكس (تويتر) — ${m.name_ar}`}
                                                            aria-label={`حساب إكس (تويتر) للعضو ${m.name_ar}`}
                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition"
                                                        >
                                                            <Twitter className="h-4 w-4" />
                                                        </a>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">لا توجد نتائج</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
