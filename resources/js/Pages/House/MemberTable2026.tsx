import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { Badge } from '@/Components/ui/badge';
import type { Member2026 } from './members2026';
import { AGE_LABEL, ageGroupOf } from './ParliamentChart2026';

const STATUS_LABEL: Record<string, string> = { active: 'نشط', resigned: 'مستقيل', dead: 'متوفى', inactive: 'غير نشط' };

interface TableFilters {
    gov: string;
    gender: string;
    selection: string;
    age: string;
    onGov: (v: string) => void;
    onGender: (v: string) => void;
    onSelection: (v: string) => void;
    onAge: (v: string) => void;
}

export default function MemberTable2026({ members, filters }: { members: Member2026[]; filters: TableFilters }) {
    const [q, setQ] = useState('');
    const [status, setStatus] = useState('active');
    const { gov, gender, selection, age, onGov, onGender, onSelection, onAge } = filters;

    const govs = useMemo(() => Array.from(new Set(members.map((m) => m.governorate_ar).filter(Boolean))).sort(), [members]);

    const filtered = useMemo(
        () =>
            members.filter((m) => {
                if ((m.status || 'active') !== status) return false;
                if (gov !== 'all' && m.governorate_ar !== gov) return false;
                if (gender !== 'all' && m.gender !== gender) return false;
                if (selection !== 'all' && m.selection_method !== selection) return false;
                if (age !== 'all' && ageGroupOf(m) !== age) return false;
                if (q && !m.name_ar.includes(q.trim())) return false;
                return true;
            }),
        [members, q, gov, gender, selection, age, status],
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
                    <CardTitle>قائمة الأعضاء ({filtered.length})</CardTitle>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(STATUS_LABEL).map(([k, l]) => (
                            <Badge key={k} className="cursor-pointer" variant={status === k ? 'default' : 'outline'} onClick={() => setStatus(k)}>{l} ({counts[k] || 0})</Badge>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Input placeholder="بحث بالاسم..." value={q} onChange={(e) => setQ(e.target.value)} />
                        <Select value={gov} onValueChange={onGov}>
                            <SelectTrigger><SelectValue placeholder="المحافظة" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">كل المحافظات</SelectItem>{govs.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={gender} onValueChange={onGender}>
                            <SelectTrigger><SelectValue placeholder="الجنس" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">الكل</SelectItem><SelectItem value="M">ذكر</SelectItem><SelectItem value="F">أنثى</SelectItem></SelectContent>
                        </Select>
                        <Select value={selection} onValueChange={onSelection}>
                            <SelectTrigger><SelectValue placeholder="طريقة التعيين" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">انتخاب + تعيين</SelectItem><SelectItem value="انتخابات">انتخابات</SelectItem><SelectItem value="تعيين">تعيين</SelectItem></SelectContent>
                        </Select>
                        <Select value={age} onValueChange={onAge}>
                            <SelectTrigger><SelectValue placeholder="الفئة العمرية" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">كل الأعمار</SelectItem>{Object.entries(AGE_LABEL).filter(([k]) => k !== 'غير محدد').map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger><SelectValue placeholder="الحالة" /></SelectTrigger>
                            <SelectContent>{Object.entries(STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="overflow-x-auto rounded-md border border-border">
                        <Table>
                            <TableHeader><TableRow><TableHead className="text-right">الاسم</TableHead><TableHead className="text-right">المحافظة</TableHead><TableHead className="text-right">الجنس</TableHead><TableHead className="text-right">سنة الميلاد</TableHead><TableHead className="text-right">طريقة التعيين</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {filtered.map((m) => (
                                    <TableRow key={m.member_number || m.name_ar}>
                                        <TableCell className="font-medium">{m.name_ar}{m.management_position ? ` — ${m.management_position}` : ''}</TableCell>
                                        <TableCell>{m.governorate_ar} {m.district ? `· ${m.district}` : ''}</TableCell>
                                        <TableCell>{m.gender === 'F' ? 'أنثى' : 'ذكر'}</TableCell>
                                        <TableCell>{m.birth_year}</TableCell>
                                        <TableCell><Badge variant="outline">{m.selection_method || '—'}</Badge></TableCell>
                                    </TableRow>
                                ))}
                                {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">لا توجد نتائج</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
