import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { Badge } from '@/Components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/card';
import { Plus, Search, Edit3, Trash2, HelpCircle, Users } from 'lucide-react';
import CategoryDialog, { GuessWhoCategoryData } from './_components/CategoryDialog';
import CharacterDialog, { GuessWhoCharacterData } from './_components/CharacterDialog';

interface AdminGuessWhoProps {
    categories: GuessWhoCategoryData[];
    characters: GuessWhoCharacterData[];
}

export default function GuessWhoAdminIndex({ categories, characters }: AdminGuessWhoProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<GuessWhoCategoryData | null>(null);

    const [characterDialogOpen, setCharacterDialogOpen] = useState(false);
    const [selectedCharacter, setSelectedCharacter] = useState<GuessWhoCharacterData | null>(null);

    const filteredCategories = categories.filter((c) => {
        const term = searchTerm.toLowerCase();
        return (
            !searchTerm ||
            c.name_ar.toLowerCase().includes(term) ||
            c.name_en.toLowerCase().includes(term) ||
            c.slug.toLowerCase().includes(term)
        );
    });

    const filteredCharacters = characters.filter((ch) => {
        const term = searchTerm.toLowerCase();
        return (
            !searchTerm ||
            ch.name_ar.toLowerCase().includes(term) ||
            ch.name_en.toLowerCase().includes(term) ||
            (ch.category?.name_ar && ch.category.name_ar.toLowerCase().includes(term))
        );
    });

    const handleDeleteCategory = (id: number) => {
        if (confirm('سيتم حذف الفئة وجميع شخصياتها. هل أنت متأكد؟')) {
            router.delete(`/api/v1/admin/guesswho/categories/${id}`);
        }
    };

    const handleDeleteCharacter = (id: number) => {
        if (confirm('هل أنت متأكد من حذف هذه الشخصية؟')) {
            router.delete(`/api/v1/admin/guesswho/characters/${id}`);
        }
    };

    return (
        <MainLayout>
            <Head title="إدارة لعبة من هو" />

            <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6" dir="rtl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border shadow-xs">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <HelpCircle className="w-7 h-7 text-primary" />
                            <span>إدارة لعبة من هو</span>
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            تحكم كامل في فئات اللعبة وشخصياتها وصورها.
                        </p>
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="بحث..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pr-9"
                        />
                    </div>
                </div>

                <Tabs defaultValue="characters" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="characters" className="gap-2">
                            <Users className="w-4 h-4" />
                            الشخصيات ({characters.length})
                        </TabsTrigger>
                        <TabsTrigger value="categories" className="gap-2">
                            <HelpCircle className="w-4 h-4" />
                            الفئات ({categories.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="categories">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>الفئات</CardTitle>
                                    <CardDescription>تحتاج الفئة 12 شخصية مفعّلة على الأقل لتظهر في اللعبة.</CardDescription>
                                </div>
                                <Button
                                    onClick={() => { setSelectedCategory(null); setCategoryDialogOpen(true); }}
                                    className="gap-2 font-bold"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>إضافة فئة</span>
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-right">الاسم (عربي)</TableHead>
                                            <TableHead className="text-right">الاسم (إنكليزي)</TableHead>
                                            <TableHead className="text-right">الشخصيات</TableHead>
                                            <TableHead className="text-right">الحالة</TableHead>
                                            <TableHead className="text-right">إجراءات</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredCategories.map((c) => (
                                            <TableRow key={c.id}>
                                                <TableCell className="font-bold">{c.name_ar}</TableCell>
                                                <TableCell className="text-muted-foreground" dir="ltr">{c.name_en}</TableCell>
                                                <TableCell>{c.characters_count ?? '—'}</TableCell>
                                                <TableCell>
                                                    <Badge variant={c.is_active ? 'default' : 'secondary'}>
                                                        {c.is_active ? 'مفعّلة' : 'مخفية'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => { setSelectedCategory(c); setCategoryDialogOpen(true); }}
                                                        >
                                                            <Edit3 className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => handleDeleteCategory(c.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="characters">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>الشخصيات</CardTitle>
                                    <CardDescription>الصور والسمات المستخدمة داخل غرف اللعب.</CardDescription>
                                </div>
                                <Button
                                    onClick={() => { setSelectedCharacter(null); setCharacterDialogOpen(true); }}
                                    className="gap-2 font-bold"
                                    disabled={categories.length === 0}
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>إضافة شخصية</span>
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-right">الصورة</TableHead>
                                            <TableHead className="text-right">الاسم (عربي)</TableHead>
                                            <TableHead className="text-right">الفئة</TableHead>
                                            <TableHead className="text-right">الحالة</TableHead>
                                            <TableHead className="text-right">إجراءات</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredCharacters.map((ch) => (
                                            <TableRow key={ch.id}>
                                                <TableCell>
                                                    <img
                                                        src={`/storage/${ch.image_path}`}
                                                        alt={ch.name_ar}
                                                        className="w-10 h-10 rounded-full object-cover border"
                                                    />
                                                </TableCell>
                                                <TableCell className="font-bold">{ch.name_ar}</TableCell>
                                                <TableCell className="text-muted-foreground">{ch.category?.name_ar ?? '—'}</TableCell>
                                                <TableCell>
                                                    <Badge variant={ch.is_active ? 'default' : 'secondary'}>
                                                        {ch.is_active ? 'مفعّلة' : 'مخفية'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => { setSelectedCharacter(ch); setCharacterDialogOpen(true); }}
                                                        >
                                                            <Edit3 className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => handleDeleteCharacter(ch.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <CategoryDialog
                    open={categoryDialogOpen}
                    onOpenChange={setCategoryDialogOpen}
                    category={selectedCategory}
                />
                <CharacterDialog
                    open={characterDialogOpen}
                    onOpenChange={setCharacterDialogOpen}
                    character={selectedCharacter}
                    categories={categories}
                />
            </div>
        </MainLayout>
    );
}
