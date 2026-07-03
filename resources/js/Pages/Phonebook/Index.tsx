import React, { useState, useMemo, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import {
    Phone, MessageSquare, Copy, Check, ExternalLink, Search, X, LayoutGrid, Table as TableIcon, PhoneCall, Info
} from 'lucide-react';
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Badge } from "@/Components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import MainLayout from '@/Layouts/MainLayout';

interface PhonebookEntry {
    id: string;
    category_ar: string;
    category_en: string;
    name_ar: string;
    name_en: string;
    number: string;
    is_whatsapp: boolean;
    source_url: string;
}

interface PhonebookProps {
    initialData: PhonebookEntry[];
}

export default function Index({ initialData }: PhonebookProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentCategory, setCurrentCategory] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Get dynamic categories list from data
    const categories = useMemo(() => {
        const cats = new Map<string, string>(); // category_en -> category_ar
        initialData.forEach(item => {
            if (item.category_en) {
                cats.set(item.category_en, item.category_ar);
            }
        });

        const list = Array.from(cats.entries()).map(([en, ar]) => ({
            key: en.toLowerCase().replace(/\s+/g, '_'),
            labelAr: ar,
            labelEn: en
        }));

        return [{ key: 'all', labelAr: 'الكل', labelEn: 'All' }, ...list];
    }, [initialData]);

    // Filter data based on search and category
    const filteredData = useMemo(() => {
        let items = initialData;

        if (currentCategory !== 'all') {
            items = items.filter(item => 
                item.category_en.toLowerCase().replace(/\s+/g, '_') === currentCategory
            );
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            items = items.filter(item => 
                item.name_ar.toLowerCase().includes(term) ||
                item.name_en.toLowerCase().includes(term) ||
                item.category_ar.toLowerCase().includes(term) ||
                item.category_en.toLowerCase().includes(term) ||
                item.number.replace(/[\s\-\(\)\+]/g, '').includes(term.replace(/[\s\-\(\)\+]/g, ''))
            );
        }

        // Sort so that three-digit numbers are always on top
        return [...items].sort((a, b) => {
            const cleanA = a.number.replace(/[\s\-\(\)\+]/g, '');
            const cleanB = b.number.replace(/[\s\-\(\)\+]/g, '');
            const isThreeDigitA = cleanA.length === 3 && /^\d+$/.test(cleanA);
            const isThreeDigitB = cleanB.length === 3 && /^\d+$/.test(cleanB);

            if (isThreeDigitA && !isThreeDigitB) return -1;
            if (!isThreeDigitA && isThreeDigitB) return 1;
            return 0; // maintain original database order otherwise
        });
    }, [initialData, searchTerm, currentCategory]);

    // Copy to clipboard helper
    const handleCopy = (number: string, id: string) => {
        navigator.clipboard.writeText(number);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Clean number for tel: protocol
    const getTelUrl = (number: string) => {
        return `tel:${number.replace(/[\s\-\(\)]/g, '')}`;
    };

    // Clean number for WhatsApp wa.me link
    const getWhatsAppUrl = (number: string) => {
        let cleaned = number.replace(/[\s\-\(\)]/g, '');
        if (cleaned.startsWith('00')) {
            cleaned = cleaned.substring(2);
        } else if (cleaned.startsWith('+')) {
            cleaned = cleaned.substring(1);
        }
        if (cleaned.startsWith('09') && cleaned.length === 10) {
            cleaned = '963' + cleaned.substring(1);
        }
        return `https://wa.me/${cleaned}`;
    };

    if (!mounted) return null;

    return (
        <MainLayout>
            <Head>
                <title>دليل الهاتف والواتساب الخدمي | Syrian Zone</title>
                <meta name="description" content="دليل أرقام الهواتف وخطوط الواتساب الرسمية للجهات الحكومية والخدمية السورية. أرقام الطوارئ، الشكاوى، والمؤسسات الرسمية." />
                
                {/* Open Graph / Facebook */}
                <meta property="og:type" content="website" />
                <meta property="og:title" content="دليل الهاتف والواتساب الخدمي | Syrian Zone" />
                <meta property="og:description" content="دليل أرقام الهواتف وخطوط الواتساب الرسمية للجهات الحكومية والخدمية السورية. أرقام الطوارئ، الشكاوى، والمؤسسات الرسمية." />
                <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : '/phonebook'} />
                <meta property="og:site_name" content="المساحة السورية | Syrian Zone" />
                
                {/* Twitter */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="دليل الهاتف والواتساب الخدمي | Syrian Zone" />
                <meta name="twitter:description" content="دليل أرقام الهواتف وخطوط الواتساب الرسمية للجهات الحكومية والخدمية السورية. أرقام الطوارئ، الشكاوى، والمؤسسات الرسمية." />
            </Head>

            <div 
                className="min-h-screen text-foreground transition-colors" 
                dir="rtl"
                style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
            >
                
                {/* Hero Header (Styled like SyOfficial) */}
                <section className="bg-card py-10 shadow-sm border-b border-border">
                    <div className="container mx-auto px-4 text-center max-w-4xl">
                        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">دليل الهاتف والواتساب</h1>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                            أرقام التواصل والشكاوى والطوارئ للجهات الرسمية والخدمية السورية.
                        </p>

                        {/* Search Bar */}
                        <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto items-center">
                            <div className="relative w-full">
                                <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="ابحث بالجهة، القسم، أو رقم الهاتف..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-4 pr-12 h-14 text-lg bg-card border-border rounded-xl shadow-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Categories List */}
                        <div className="mt-6 flex flex-wrap justify-center gap-2">
                            {categories.map(cat => (
                                <Button
                                    key={cat.key}
                                    variant={currentCategory === cat.key ? "default" : "outline"}
                                    onClick={() => setCurrentCategory(cat.key)}
                                    className="rounded-full"
                                    size="sm"
                                >
                                    {cat.labelAr}
                                </Button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Content Section */}
                <div className="container mx-auto px-4 py-8 max-w-7xl">
                    
                    {/* Visual Controls */}
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                        <div className="text-sm text-muted-foreground font-medium">
                            {filteredData.length > 0 ? (
                                `عرض ${filteredData.length} رقم تواصل رسمي`
                            ) : (
                                "لم يتم العثور على أرقام تطابق البحث"
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">طريقة العرض:</span>
                            <div className="bg-card rounded-lg p-1 shadow-sm border border-border flex">
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`p-1.5 rounded transition-all ${viewMode === 'table' ? 'bg-accent text-primary' : 'text-muted-foreground'}`}
                                    title="عرض كجدول"
                                >
                                    <TableIcon className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-accent text-primary' : 'text-muted-foreground'}`}
                                    title="عرض كبطاقات"
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {filteredData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-lg shadow-sm border border-dashed border-border">
                            <Search className="h-16 w-16 text-muted-foreground/30 mb-4" />
                            <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد نتائج</h3>
                            <p className="text-muted-foreground text-sm">جرب تعديل كلمات البحث أو الفلاتر.</p>
                        </div>
                    ) : viewMode === 'grid' ? (
                        
                        // Card Grid View
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredData.map(item => (
                                <Card key={item.id} className="overflow-hidden hover:shadow-md transition-all border border-border/80 bg-card flex flex-col justify-between">
                                    <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                                        <div>
                                            <div className="flex justify-between items-start gap-2 mb-2">
                                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] font-semibold py-0.5 px-2">
                                                    {item.category_ar}
                                                </Badge>
                                                {item.is_whatsapp && (
                                                    <Badge className="bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 text-[9px] font-bold py-0.2 px-1.5">
                                                        واتساب
                                                    </Badge>
                                                )}
                                            </div>
                                            <h3 className="font-bold text-foreground text-base leading-snug">
                                                {item.name_ar}
                                            </h3>
                                            {item.name_en && (
                                                <p className="text-xs text-muted-foreground mt-0.5 font-normal">
                                                    {item.name_en}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            {/* Number display */}
                                            <div className="text-center py-2 bg-muted/40 rounded-xl border border-border/40 font-mono text-lg font-extrabold text-foreground tracking-wide">
                                                {item.number}
                                            </div>

                                            {/* Actions */}
                                            <div className="grid grid-cols-4 gap-2 pt-1">
                                                {/* Copy */}
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleCopy(item.number, item.id)}
                                                    className="w-full flex items-center justify-center gap-1.5 text-xs h-9"
                                                    title="نسخ الرقم"
                                                >
                                                    {copiedId === item.id ? (
                                                        <Check className="h-4 w-4 text-emerald-500" />
                                                    ) : (
                                                        <Copy className="h-4 w-4" />
                                                    )}
                                                </Button>

                                                {/* Call */}
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                    className="w-full flex items-center justify-center gap-1.5 text-xs h-9"
                                                    title="اتصال هاتفي"
                                                >
                                                    <a href={getTelUrl(item.number)}>
                                                        <Phone className="h-4 w-4 text-primary" />
                                                    </a>
                                                </Button>

                                                {/* WhatsApp */}
                                                {item.is_whatsapp ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        asChild
                                                        className="w-full flex items-center justify-center gap-1.5 text-xs h-9 border-emerald-500/20 hover:bg-emerald-500/5"
                                                        title="مراسلة عبر واتساب"
                                                    >
                                                        <a href={getWhatsAppUrl(item.number)} target="_blank" rel="noopener noreferrer">
                                                            <MessageSquare className="h-4 w-4 text-emerald-500" />
                                                        </a>
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled
                                                        className="w-full opacity-40 cursor-not-allowed h-9"
                                                    >
                                                        <MessageSquare className="h-4 w-4" />
                                                    </Button>
                                                )}

                                                {/* Source */}
                                                {item.source_url ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        asChild
                                                        className="w-full flex items-center justify-center gap-1.5 text-xs h-9"
                                                        title="رابط المصدر"
                                                    >
                                                        <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                                                            <ExternalLink className="h-4 w-4" />
                                                        </a>
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled
                                                        className="w-full opacity-40 cursor-not-allowed h-9"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        
                        // Table View (Styled like SyOfficial)
                        <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted">
                                    <TableRow>
                                        <TableHead className="text-right font-bold text-foreground">الجهة / القسم</TableHead>
                                        <TableHead className="text-right font-bold text-foreground">الرقم</TableHead>
                                        <TableHead className="text-right font-bold text-foreground">النوع</TableHead>
                                        <TableHead className="text-right font-bold text-foreground">المصدر</TableHead>
                                        <TableHead className="text-right font-bold text-foreground">الإجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.map(item => (
                                        <TableRow key={item.id} className="hover:bg-muted/50">
                                            <TableCell className="font-medium">
                                                <div>
                                                    <span className="text-foreground font-bold text-sm block">{item.name_ar}</span>
                                                    <span className="text-[10px] text-muted-foreground font-normal">{item.category_ar}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm font-extrabold text-foreground">{item.number}</TableCell>
                                            <TableCell>
                                                {item.is_whatsapp ? (
                                                    <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-semibold">
                                                        اتصال + واتساب
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="font-normal text-[10px] bg-muted/80">
                                                        اتصال فقط
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {item.source_url ? (
                                                    <a 
                                                        href={item.source_url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-semibold"
                                                    >
                                                        <span>عرض المصدر</span>
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground font-normal">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    
                                                    {/* Copy */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleCopy(item.number, item.id)}
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                        title="نسخ الرقم"
                                                    >
                                                        {copiedId === item.id ? (
                                                            <Check className="h-4 w-4 text-emerald-500" />
                                                        ) : (
                                                            <Copy className="h-4 w-4" />
                                                        )}
                                                    </Button>

                                                    {/* Call */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        asChild
                                                        className="h-8 w-8 text-primary hover:text-primary/80"
                                                        title="اتصال هاتفي"
                                                    >
                                                        <a href={getTelUrl(item.number)}>
                                                            <Phone className="h-4 w-4" />
                                                        </a>
                                                    </Button>

                                                    {/* WhatsApp */}
                                                    {item.is_whatsapp && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            asChild
                                                            className="h-8 w-8 text-emerald-500 hover:text-emerald-600"
                                                            title="مراسلة عبر واتساب"
                                                        >
                                                            <a href={getWhatsAppUrl(item.number)} target="_blank" rel="noopener noreferrer">
                                                                <MessageSquare className="h-4 w-4" />
                                                            </a>
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Combined and Simplified Notes */}
                    <Card className="border-border bg-muted/20 shadow-sm p-5 mt-8">
                        <div className="flex gap-3.5 items-start text-xs text-muted-foreground leading-relaxed">
                            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <span className="font-bold text-foreground block mb-1">ملاحظات حول أرقام الدليل الخدمي:</span>
                                تم جمع وتدقيق هذا الدليل من القرارات والبيانات الرسمية الصادرة عن الوزارات ومجالس المحافظات السورية. يرجى الملاحظة أن بعض الأرقام مخصصة للتواصل عبر قنوات المراسلة الفورية (مثل واتساب)، بينما تعمل الأرقام المختصرة وخطوط الهاتف الأرضي للاستجابة السريعة على مستوى الشبكات المحلية.
                            </div>
                        </div>
                    </Card>

                </div>

            </div>
        </MainLayout>
    );
}
