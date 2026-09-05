"use client";

import { useState, useEffect, useMemo } from 'react';
import { HouseRow, PROVINCES, Mode } from './types';
import { fetchHouseData } from './data';
import { Search, RotateCcw, ChartBar, Users, Gavel, Filter, Sparkles } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface HouseClientProps {
    initialData: HouseRow[];
    initialHeaders: string[];
    initialMode: Mode;
}

const COLORS = {
    male: '#556A4E',
    female: '#A73F46',
    maleDim: 'rgba(85, 106, 78, 0.3)',
    femaleDim: 'rgba(167, 63, 70, 0.3)'
};

export default function HouseClient({ initialData, initialHeaders, initialMode }: HouseClientProps) {
    const [mode, setMode] = useState<Mode>(initialMode);
    const [province, setProvince] = useState('damascus');
    const [data, setData] = useState<HouseRow[]>(initialData);
    const [headers, setHeaders] = useState<string[]>(initialHeaders);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Filters
    const [searchInput, setSearchInput] = useState('');
    const [sexFilter, setSexFilter] = useState('');
    const [ageFilter, setAgeFilter] = useState('');
    const [appealFilter, setAppealFilter] = useState('');
    const [resultFilter, setResultFilter] = useState(''); // 'winner' | 'notWinner'
    const [districtFilter, setDistrictFilter] = useState('all'); // specific or 'all'

    // Sorting
    const [sortColumn, setSortColumn] = useState('Name'); // or 'الاسم'
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Fetch data when mode or province changes
    useEffect(() => {
        // Skip first render if data is already passed (handled by initialData logic? No, simpler to just fetch)
        // Actually, initialData is for the initial render.
        // We need to fetch if constraints change.

        let active = true;
        const fetchData = async () => {
            setLoading(true);
            setLoadError(null);
            try {
                const res = await fetchHouseData(mode, province);
                if (active) {
                    setData(res.rows);
                    setHeaders(res.headers);
                    if (res.rows.length === 0) {
                        setLoadError('تعذر تحميل البيانات (المصدر فارغ أو غير متاح). حاول مجدداً لاحقاً.');
                    }
                }
            } catch (err) {
                console.error(err);
                if (active) setLoadError('تعذر تحميل البيانات. تحقق من الاتصال وحاول مجدداً.');
            } finally {
                if (active) setLoading(false);
            }
        };

        // If it's the very first mount and matches initial props, we might skip, but logic is simpler if we just treat initial as seed
        // BUT we want to avoid double fetch on mount.
        // We'll trust initialData for the specified initial params, but if state changes, we fetch.
        // For simplicity: We ONLY fetch here if parameters differ from initial OR if we navigated.

        // Actually, easiest way: 
        // 1. Initial render uses initialData.
        // 2. Changing tabs/province triggers fetch.
        if (mode === initialMode && province === 'damascus' && data === initialData && data.length > 0) {
            // Do nothing, data is fresh
        } else {
            fetchData();
        }

        return () => { active = false; };
    }, [mode, province]);

    // Derived Data: Districts (for Winners mode)
    const districts = useMemo(() => {
        if (mode !== 'winners') return [];
        const key = 'Electoral District (الدائرة الانتخابية)';
        const d = new Set(data.map(r => r[key]).filter(Boolean));
        return Array.from(d).sort();
    }, [data, mode]);

    // Filtering Logic
    const filteredData = useMemo(() => {
        return data.filter(row => {
            // Text Search
            const q = searchInput.toLowerCase();
            if (q) {
                const hay = `${row.__nameNorm} ${row.__placeNorm}`;
                if (!hay.includes(q)) return false;
            }

            // Common Filters
            if (sexFilter && row.__sexNorm !== sexFilter) return false;
            if (ageFilter && row.__ageGroup !== ageFilter) return false;

            // Mode specific
            if (mode === 'voters') {
                if (appealFilter === 'appealed' && row.__appealStatus !== 'مطعون') return false;
                if (appealFilter === 'notAppealed' && row.__appealStatus === 'مطعون') return false;
            }

            if (mode === 'candidates') {
                const isWinner = (row['النتيجة'] || row['Result'] || '').trim() === 'فائز';
                if (resultFilter === 'winner' && !isWinner) return false;
                if (resultFilter === 'notWinner' && isWinner) return false;
            }

            if (mode === 'winners') {
                if (districtFilter !== 'all') {
                    const d = (row['Electoral District (الدائرة الانتخابية)'] || '').trim();
                    if (d !== districtFilter) return false;
                }
            }

            return true;
        });
    }, [data, searchInput, sexFilter, ageFilter, appealFilter, resultFilter, districtFilter, mode]);

    // Sorting Logic
    const sortedData = useMemo(() => {
        if (!sortColumn) return filteredData;
        return [...filteredData].sort((a, b) => {
            const aVal = a[sortColumn];
            const bVal = b[sortColumn];

            // Null handling
            if (!aVal && !bVal) return 0;
            if (!aVal) return 1;
            if (!bVal) return -1;

            let res = 0;
            // Numeric check for BirthYear/Age
            if (sortColumn.includes('Year') || sortColumn.includes('Age') || sortColumn === 'سنة الميلاد') {
                const aNum = Number(aVal.replace(/\D/g, '')) || 0;
                const bNum = Number(bVal.replace(/\D/g, '')) || 0;
                res = aNum - bNum;
            } else {
                res = String(aVal).localeCompare(String(bVal), 'ar');
            }
            return sortDirection === 'asc' ? res : -res;
        });
    }, [filteredData, sortColumn, sortDirection]);

    // Statistics
    const stats = useMemo(() => {
        const total = filteredData.length;
        const male = filteredData.filter(r => r.__sexNorm === 'ذكر').length;
        const female = filteredData.filter(r => r.__sexNorm === 'أنثى').length;
        const appealed = filteredData.filter(r => r.__appealStatus === 'مطعون').length;

        const ageGroups = {
            lt30: filteredData.filter(r => r.__ageGroup === 'lt30').length,
            '30s': filteredData.filter(r => r.__ageGroup === '30s').length,
            '40s': filteredData.filter(r => r.__ageGroup === '40s').length,
            '50s': filteredData.filter(r => r.__ageGroup === '50s').length,
            '60p': filteredData.filter(r => r.__ageGroup === '60p').length,
        };

        return { total, male, female, appealed, ageGroups };
    }, [filteredData]);

    // Chart Data
    const sexChartData = [
        { name: 'ذكر', value: stats.male },
        { name: 'أنثى', value: stats.female }
    ];

    const ageChartData = [
        { name: '<30', value: stats.ageGroups.lt30 },
        { name: '30-39', value: stats.ageGroups['30s'] },
        { name: '40-49', value: stats.ageGroups['40s'] },
        { name: '50-59', value: stats.ageGroups['50s'] },
        { name: '60+', value: stats.ageGroups['60p'] }
    ];

    const handleSort = (col: string) => {
        if (sortColumn === col) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(col);
            setSortDirection('asc');
        }
    };

    const resetFilters = () => {
        setSearchInput('');
        setSexFilter('');
        setAgeFilter('');
        setAppealFilter('');
        setResultFilter('');
        setDistrictFilter('all');
        if (mode === 'voters') setProvince('damascus');
    };

    // Columns to Display
    const displayColumns = useMemo(() => {
        const blacklist = ['__nameNorm', '__placeNorm', '__sexNorm', '__ageGroup', '__appealStatus', 'أسماء جديدة', 'الفائزين'];
        if (mode !== 'candidates') {
            // For non-candidates, maybe hide result?
        }
        return headers.filter(h => !blacklist.includes(h) && (
            // Heuristic to hide empty cols
            filteredData.some(r => r[h] && r[h].trim())
        ));
    }, [headers, filteredData, mode]);

    // Specific logic for "New Names"
    const newNames = useMemo(() => {
        if (mode !== 'voters') return [];
        const newNamesKey = headers.find(k => k.includes('أسماء جديدة'));
        if (!newNamesKey) return [];

        return filteredData.flatMap(r => {
            const val = r[newNamesKey];
            return val ? val.split(/[,،]+/).map(s => s.trim()).filter(Boolean) : [];
        });
    }, [filteredData, headers, mode]);

    return (
        <div className="space-y-6">
            {/* Header / Tabs */}
            <div className="flex flex-col items-center mb-8">
                <h1 className="text-3xl font-bold mb-2 text-foreground">المجلس التشريعي</h1>
                <p className="text-muted-foreground mb-6 text-center max-w-2xl">
                    {mode === 'candidates' ? 'المرشحون لانتخابات المجلس التشريعي، يمكن التصفية والبحث' :
                        mode === 'winners' ? 'الفائزون في انتخابات المجلس التشريعي' :
                            mode === 'presidential' ? 'الثلث الرئاسي: الأعضاء المعينون في المجلس التشريعي، يمكن التصفية والبحث وعرض إحصاءات' :
                                'أعضاء الهيئات الناخبة للمجلس التشريعي، يمكن التصفية والبحث وعرض إحصاءات'}
                </p>

                <div className="flex bg-muted p-1 rounded-lg">
                    {[
                        { id: 'voters', label: 'الهيئات الناخبة' },
                        { id: 'candidates', label: 'المرشحون' },
                        { id: 'winners', label: 'الفائزون' },
                        { id: 'presidential', label: 'الثلث الرئاسي' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setMode(tab.id as Mode)}
                            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${mode === tab.id
                                ? 'bg-card shadow text-primary'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Disclaimer */}
            <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4 rounded-r shadow-sm">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                    هذه مبادرة فردية غير حكومية. البيانات مجمعة من موقع اللجنة العليا للانتخابات:
                    <a href="https://hcepa.gov.sy" target="_blank" className="underline ml-1 font-bold hover:text-amber-700">hcepa.gov.sy</a>
                </p>
            </div>

            {/* Controls */}
            <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Province Selector (Voters/Winners). Presidential is a single national list. */}
                    {(mode === 'voters' || mode === 'winners') && (
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                                {mode === 'winners' ? 'الدائرة الانتخابية' : 'المحافظة'}
                            </label>
                            {mode === 'winners' ? (
                                <select
                                    className="w-full h-10 px-3 bg-muted border border-border rounded-md outline-none focus:ring-2 focus:ring-primary text-sm text-foreground"
                                    value={districtFilter}
                                    onChange={e => setDistrictFilter(e.target.value)}
                                >
                                    <option value="all" className="bg-card">الكل</option>
                                    {districts.map(d => <option key={d} value={d} className="bg-card">{d}</option>)}
                                </select>
                            ) : (
                                <select
                                    className="w-full h-10 px-3 bg-muted border border-border rounded-md outline-none focus:ring-2 focus:ring-primary text-sm text-foreground"
                                    value={province}
                                    onChange={e => setProvince(e.target.value)}
                                >
                                    {PROVINCES.map(p => <option key={p.key} value={p.key} className="bg-card">{p.label}</option>)}
                                </select>
                            )}
                        </div>
                    )}

                    {/* Search */}
                    <div className={mode === 'candidates' ? "md:col-span-2" : "md:col-span-1"}>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">بحث</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="ابحث بالاسم..."
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                className="w-full h-10 pl-3 pr-10 bg-muted border border-border rounded-md outline-none focus:ring-2 focus:ring-primary text-sm text-foreground"
                            />
                            <Search className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />
                        </div>
                    </div>

                    {/* Filters Group */}
                    <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">الجنس</label>
                            <select
                                className="w-full h-10 px-2 bg-muted border border-border rounded-md outline-none focus:ring-2 focus:ring-primary text-sm text-foreground"
                                value={sexFilter}
                                onChange={e => setSexFilter(e.target.value)}
                            >
                                <option value="" className="bg-card">الكل</option>
                                <option value="ذكر" className="bg-card">ذكر</option>
                                <option value="أنثى" className="bg-card">أنثى</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">العمر</label>
                            <select
                                className="w-full h-10 px-2 bg-muted border border-border rounded-md outline-none focus:ring-2 focus:ring-primary text-sm text-foreground"
                                value={ageFilter}
                                onChange={e => setAgeFilter(e.target.value)}
                            >
                                <option value="" className="bg-card">الكل</option>
                                <option value="lt30" className="bg-card">أقل من 30</option>
                                <option value="30s" className="bg-card">30-39</option>
                                <option value="40s" className="bg-card">40-49</option>
                                <option value="50s" className="bg-card">50-59</option>
                                <option value="60p" className="bg-card">+60</option>
                            </select>
                        </div>

                        {mode === 'voters' && (
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">حالة الطعن</label>
                                <select
                                    className="w-full h-10 px-2 bg-muted border border-border rounded-md outline-none focus:ring-2 focus:ring-primary text-sm text-foreground"
                                    value={appealFilter}
                                    onChange={e => setAppealFilter(e.target.value)}
                                >
                                    <option value="" className="bg-card">الكل</option>
                                    <option value="appealed" className="bg-card">مطعون</option>
                                    <option value="notAppealed" className="bg-card">سليم</option>
                                </select>
                            </div>
                        )}

                        {mode === 'candidates' && (
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">النتيجة</label>
                                <select
                                    className="w-full h-10 px-2 bg-muted border border-border rounded-md outline-none focus:ring-2 focus:ring-primary text-sm text-foreground"
                                    value={resultFilter}
                                    onChange={e => setResultFilter(e.target.value)}
                                >
                                    <option value="" className="bg-card">الكل</option>
                                    <option value="winner" className="bg-card">فائز</option>
                                    <option value="notWinner" className="bg-card">غير فائز</option>
                                </select>
                            </div>
                        )}

                        <div className="flex items-end">
                            <button
                                onClick={resetFilters}
                                className="w-full h-10 flex items-center justify-center gap-2 bg-muted hover:bg-accent text-muted-foreground rounded-md transition border border-border"
                            >
                                <RotateCcw className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            {(mode === 'voters' || mode === 'winners' || mode === 'presidential') && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-card p-4 rounded-lg shadow-sm border border-border text-center">
                        <div className="text-xs text-muted-foreground mb-1">الإجمالي</div>
                        <div className="text-2xl font-bold text-primary">{stats.total}</div>
                    </div>
                    <div className="bg-card p-4 rounded-lg shadow-sm border border-border text-center">
                        <div className="text-xs text-muted-foreground mb-1">ذكور</div>
                        <div className="text-2xl font-bold text-foreground">{stats.male}</div>
                        <div className="text-xs text-muted-foreground/60">{stats.total > 0 ? ((stats.male / stats.total) * 100).toFixed(1) : '0.0'}%</div>
                    </div>
                    <div className="bg-card p-4 rounded-lg shadow-sm border border-border text-center">
                        <div className="text-xs text-muted-foreground mb-1">إناث</div>
                        <div className="text-2xl font-bold text-foreground">{stats.female}</div>
                        <div className="text-xs text-muted-foreground/60">{stats.total > 0 ? ((stats.female / stats.total) * 100).toFixed(1) : '0.0'}%</div>
                    </div>
                    {mode === 'voters' && (
                        <div className="bg-card p-4 rounded-lg shadow-sm border border-border text-center">
                            <div className="text-xs text-muted-foreground mb-1">مطعونين</div>
                            <div className="text-2xl font-bold text-destructive">{stats.appealed}</div>
                            <div className="text-xs text-muted-foreground/60">{stats.total > 0 ? ((stats.appealed / stats.total) * 100).toFixed(1) : '0.0'}%</div>
                        </div>
                    )}
                </div>
            )}

            {/* Charts Row */}
            {(mode === 'voters' || mode === 'winners' || mode === 'presidential') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-card p-6 rounded-lg shadow-sm border border-border flex flex-col items-center">
                        <h3 className="text-sm font-semibold mb-4 text-foreground flex items-center gap-2">
                            <Users className="h-4 w-4" /> توزيع الجنس
                        </h3>
                        <div className="w-48">
                            <ResponsiveContainer width="100%" height={192}>
                                <PieChart>
                                    <Pie
                                        data={sexChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {sexChartData.map((entry, index) => (
                                            <Cell key={entry.name} fill={index === 0 ? COLORS.male : COLORS.female} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="bg-card p-6 rounded-lg shadow-sm border border-border flex flex-col items-center">
                        <h3 className="text-sm font-semibold mb-4 text-foreground flex items-center gap-2">
                            <ChartBar className="h-4 w-4" /> توزيع الأعمار
                        </h3>
                        <div className="w-full h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ageChartData}>
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar
                                        dataKey="value"
                                        fill={sexFilter === 'أنثى' ? COLORS.female : COLORS.male}
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* New Names Section */}
            {newNames.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-primary mb-2 flex items-center gap-2">
                        <Sparkles className="h-5 w-5" /> أسماء جديدة
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        وردت في القوائم النهائية ولكنها لم تظهر في القوائم الأولية ({newNames.length})
                    </p>
                    <div className="bg-card rounded border border-border max-h-60 overflow-y-auto">
                        <table className="min-w-full divide-y divide-border">
                            <tbody className="divide-y divide-border text-sm">
                                {newNames.map((name, i) => (
                                    <tr key={i}><td className="px-4 py-2 text-foreground">{name}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Main Table */}
            <div className={`bg-card rounded-lg shadow-sm border border-border overflow-hidden ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="px-6 py-4 border-b border-border bg-muted/50 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-foreground">القائمة الرئيسية</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            عرض {sortedData.length} سجل
                        </p>
                    </div>
                    {loading && <div className="text-sm text-primary font-medium animate-pulse">جاري التحميل...</div>}
                </div>

                {loadError && sortedData.length === 0 && !loading && (
                    <div className="px-6 py-4 bg-destructive/10 border-b border-destructive/30 text-destructive text-sm flex items-center justify-between gap-3">
                        <span>{loadError}</span>
                        <button onClick={() => window.location.reload()} className="underline font-bold">إعادة المحاولة</button>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted">
                            <tr>
                                {displayColumns.map(col => (
                                    <th
                                        key={col}
                                        className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-accent transition select-none"
                                        onClick={() => handleSort(col)}
                                    >
                                        <div className="flex items-center gap-1">
                                            {col}
                                            {sortColumn === col && (
                                                <span className="text-primary">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border">
                            {sortedData.length > 0 ? (
                                sortedData.map((row, idx) => {
                                    const isAppealed = row.__appealStatus === 'مطعون';
                                    const isWinner = (row['النتيجة'] || row['Result'] || '').trim() === 'فائز';

                                    return (
                                        <tr
                                            key={idx}
                                            className={`
                                                transition hover:bg-muted/50
                                                ${isAppealed ? 'bg-destructive/10 hover:bg-destructive/20' : ''}
                                                ${isWinner ? 'bg-primary/10 hover:bg-primary/20' : ''}
                                            `}
                                        >
                                            {displayColumns.map(col => (
                                                <td key={col} className="px-6 py-4 text-sm text-foreground whitespace-nowrap">
                                                    {row[col]}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={displayColumns.length} className="px-6 py-12 text-center text-muted-foreground">
                                        لا توجد بيانات مطابقة
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
