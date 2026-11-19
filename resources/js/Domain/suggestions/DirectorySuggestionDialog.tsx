import { useEffect, useMemo, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import { Switch } from '@/Components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/Components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import FieldError, { fieldA11y } from '@/Components/ui/field-error';
import { CheckCircle2, Loader2, LogIn, PencilLine, PlusCircle, Search, X } from 'lucide-react';
import { normalizeArabic } from '@/Lib/arabic';
import { apiErrorMessage, apiFieldErrors } from '@/Lib/api';
import { notify } from '@/Lib/notify';
import { cn } from '@/Lib/utils';
import { suggestionsApi } from '@/Domain/suggestions/api';
import type {
    DirectorySuggestionPayload,
    SuggestionCategoryOption,
    SuggestionKind,
    SuggestionModule,
    SuggestionTargetOption,
} from '@/Domain/suggestions/types';

interface ModuleCopy {
    dialogTitleAdd: string;
    dialogTitleEdit: string;
    dialogDescription: string;
    addTabLabel: string;
    editTabLabel: string;
    addTitleLabel: string;
    addTitlePlaceholder: string;
    editTitleLabel: string;
    editTitlePlaceholder: string;
    targetPickerLabel: string;
    targetSearchPlaceholder: string;
    detailsPlaceholderAdd: string;
    detailsPlaceholderEdit: string;
    sourceLabel: string;
}

const MODULE_COPY: Record<SuggestionModule, ModuleCopy> = {
    govtcvs: {
        dialogTitleAdd: 'إضافة مسؤول أو اقتراح تعديل',
        dialogTitleEdit: 'اقتراح تعديل على ملف المسؤول',
        dialogDescription:
            'شاركنا معلومة موثّقة عن تعيين جديد أو تعديل في سيرة ومنصب مسؤول حكومي، وسيراجعها فريق التحرير قبل نشرها.',
        addTabLabel: 'إضافة مسؤول جديد',
        editTabLabel: 'تعديل ملف موجود',
        addTitleLabel: 'الاسم الكامل للمسؤول',
        addTitlePlaceholder: 'مثال: المهندس أحمد رواد رمضان',
        editTitleLabel: 'ملخص التعديل المقترح (اختياري)',
        editTitlePlaceholder: 'مثال: تحديث المنصب الحالي أو تصحيح السيرة الذاتية',
        targetPickerLabel: 'اختر المسؤول المراد تعديل ملفه (اختياري)',
        targetSearchPlaceholder: 'ابحث باسم المسؤول...',
        detailsPlaceholderAdd: 'اذكر السيرة الذاتية، المنصب، تاريخ التعيين، أو أي معلومات موثّقة...',
        detailsPlaceholderEdit: 'وضّح التعديل المطلوب (تغيير منصب، تصحيح اسم، معلومة ناقصة في السيرة)...',
        sourceLabel: 'رابط المصدر الرسمي (سانا، الإخبارية، موقع الوزارة...) (اختياري)',
    },
    syofficial: {
        dialogTitleAdd: 'إضافة حساب رسمي أو اقتراح تعديل',
        dialogTitleEdit: 'اقتراح تعديل على الحسابات الرسمية',
        dialogDescription:
            'أضف جهة أو حساباً رسمياً موثّقاً أو أبلغ عن رابط معطّل أو تغيير في الحسابات الرسمية ليراجعه المحررون.',
        addTabLabel: 'إضافة جهة / حساب جديد',
        editTabLabel: 'تعديل جهة موجودة',
        addTitleLabel: 'اسم الجهة أو الشخصية الرسمية',
        addTitlePlaceholder: 'مثال: وزارة الاقتصاد والتجارة الخارجية',
        editTitleLabel: 'ملخص التعديل المقترح (اختياري)',
        editTitlePlaceholder: 'مثال: إضافة قناة تيليغرام الرسمية أو تصحيح رابط X',
        targetPickerLabel: 'اختر الجهة المراد تعديلها (اختياري)',
        targetSearchPlaceholder: 'ابحث باسم الجهة أو الشخصية...',
        detailsPlaceholderAdd: 'اذكر تفاصيل الجهة وروابط حساباتها الرسمية على المنصات المختلفة...',
        detailsPlaceholderEdit: 'وضّح الرابط الجديد أو الرابط المعطّل أو التصحيح المطلوب...',
        sourceLabel: 'رابط مصدر يثبت رسمية الحساب (اختياري)',
    },
    govapps: {
        dialogTitleAdd: 'إضافة تطبيق حكومي أو اقتراح تعديل',
        dialogTitleEdit: 'اقتراح تعديل على تطبيق حكومي',
        dialogDescription:
            'اقترح تطبيقاً حكومياً سورياً رسمياً جديداً أو أبلغ عن تحديث في روابط المتاجر والموقع الرسمي.',
        addTabLabel: 'إضافة تطبيق جديد',
        editTabLabel: 'تعديل تطبيق موجود',
        addTitleLabel: 'اسم التطبيق الحكومي',
        addTitlePlaceholder: 'مثال: تطبيق شام كاش أو بوابة الخدمات الحكومية',
        editTitleLabel: 'ملخص التعديل المقترح (اختياري)',
        editTitlePlaceholder: 'مثال: تحديث رابط App Store أو تصحيح الوصف',
        targetPickerLabel: 'اختر التطبيق المراد تعديله (اختياري)',
        targetSearchPlaceholder: 'ابحث باسم التطبيق...',
        detailsPlaceholderAdd: 'اشرح وظيفة التطبيق والجهة الحكومية المطوّرة له...',
        detailsPlaceholderEdit: 'وضّح التعديل المطلوب على التطبيق أو روابط التحميل...',
        sourceLabel: 'رابط الإعلان الرسمي عن التطبيق (اختياري)',
    },
    phonebook: {
        dialogTitleAdd: 'إضافة رقم رسمي أو اقتراح تعديل',
        dialogTitleEdit: 'اقتراح تعديل على رقم في الدليل',
        dialogDescription:
            'ساهم بإضافة رقم طوارئ أو خدمة رسمية أو واتساب حكومي، أو أبلغ عن رقم تغيّر أو لم يعد يعمل.',
        addTabLabel: 'إضافة رقم جديد',
        editTabLabel: 'تعديل رقم موجود',
        addTitleLabel: 'اسم الجهة أو الخدمة',
        addTitlePlaceholder: 'مثال: شكاوى كهرباء دمشق',
        editTitleLabel: 'ملخص التعديل المقترح (اختياري)',
        editTitlePlaceholder: 'مثال: تحديث الرقم الجديد أو إضافة دعم واتساب',
        targetPickerLabel: 'اختر الجهة المراد تعديل رقمها (اختياري)',
        targetSearchPlaceholder: 'ابحث باسم الجهة أو الرقم...',
        detailsPlaceholderAdd: 'اذكر أوقات العمل أو نطاق التغطية أو أي ملاحظات مفيدة للمواطنين...',
        detailsPlaceholderEdit: 'وضّح الرقم الجديد أو سبب التعديل (رقم مغلق، تغيّر التحويلة...)...',
        sourceLabel: 'رابط المصدر الرسمي للرقم (اختياري)',
    },
};

export interface DirectorySuggestionDialogProps {
    module: SuggestionModule;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultKind?: SuggestionKind;
    fixedTarget?: SuggestionTargetOption | null;
    targets?: readonly SuggestionTargetOption[];
    categories?: readonly SuggestionCategoryOption[];
}

export default function DirectorySuggestionDialog({
    module,
    open,
    onOpenChange,
    defaultKind = 'add',
    fixedTarget = null,
    targets = [],
    categories = [],
}: DirectorySuggestionDialogProps) {
    const page = usePage<{ auth?: { user?: { id: number; name?: string } | null } }>();
    const user = page.props.auth?.user ?? null;
    const copy = MODULE_COPY[module];

    const [kind, setKind] = useState<SuggestionKind>(fixedTarget ? 'edit' : defaultKind);
    const [selectedTargetId, setSelectedTargetId] = useState<string>(fixedTarget?.id ?? '');
    const [targetQuery, setTargetQuery] = useState('');
    const [title, setTitle] = useState('');
    const [details, setDetails] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');

    // Module-specific structured payload fields
    const [roleTitleAr, setRoleTitleAr] = useState('');
    const [institutionNameAr, setInstitutionNameAr] = useState('');
    const [decreeRef, setDecreeRef] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [nameEn, setNameEn] = useState('');
    const [accountUrl, setAccountUrl] = useState('');
    const [officialUrl, setOfficialUrl] = useState('');
    const [androidUrl, setAndroidUrl] = useState('');
    const [appleUrl, setAppleUrl] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isWhatsapp, setIsWhatsapp] = useState(false);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
    const doneRef = useRef<HTMLDivElement>(null);

    const resetFields = (nextKind: SuggestionKind, nextTargetId: string) => {
        setKind(nextKind);
        setSelectedTargetId(nextTargetId);
        setTargetQuery('');
        setTitle('');
        setDetails('');
        setSourceUrl('');
        setRoleTitleAr('');
        setInstitutionNameAr('');
        setDecreeRef('');
        setCategoryId('');
        setNameEn('');
        setAccountUrl('');
        setOfficialUrl('');
        setAndroidUrl('');
        setAppleUrl('');
        setPhoneNumber('');
        setIsWhatsapp(false);
        setErrors({});
        setSubmittedMessage(null);
    };

    useEffect(() => {
        if (!open) return;
        resetFields(fixedTarget ? 'edit' : defaultKind, fixedTarget?.id ?? '');
    }, [open, fixedTarget, defaultKind]);

    useEffect(() => {
        if (submittedMessage) {
            doneRef.current?.focus();
        }
    }, [submittedMessage]);

    const filteredTargets = useMemo(() => {
        if (!targets.length) return [];
        const needle = normalizeArabic(targetQuery);
        if (!needle) return targets.slice(0, 30);
        return targets
            .filter((item) =>
                normalizeArabic([item.label, item.subtitle].filter(Boolean).join(' ')).includes(
                    needle,
                ),
            )
            .slice(0, 30);
    }, [targets, targetQuery]);

    const selectedTarget = useMemo(() => {
        if (fixedTarget) return fixedTarget;
        if (!selectedTargetId) return null;
        return targets.find((t) => t.id === selectedTargetId) ?? null;
    }, [fixedTarget, selectedTargetId, targets]);

    const buildPayload = (): DirectorySuggestionPayload => {
        if (module === 'govtcvs') {
            return {
                role_title_ar: roleTitleAr.trim() || undefined,
                institution_name_ar: institutionNameAr.trim() || undefined,
                decree_ref: decreeRef.trim() || undefined,
            };
        }
        if (module === 'syofficial') {
            return {
                category_id: categoryId || undefined,
                name_en: nameEn.trim() || undefined,
                account_url: accountUrl.trim() || undefined,
            };
        }
        if (module === 'govapps') {
            return {
                official_url: officialUrl.trim() || undefined,
                android_url: androidUrl.trim() || undefined,
                apple_url: appleUrl.trim() || undefined,
            };
        }
        return {
            category_id: categoryId || undefined,
            number: phoneNumber.trim() || undefined,
            is_whatsapp: isWhatsapp,
        };
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});

        const effectiveKind: SuggestionKind = fixedTarget ? 'edit' : kind;
        const effectiveTargetId =
            effectiveKind === 'edit' ? (fixedTarget?.id ?? (selectedTargetId || null)) : null;

        try {
            const res = await suggestionsApi.submit(module, {
                kind: effectiveKind,
                target_id: effectiveTargetId,
                title: title.trim() || selectedTarget?.label || '',
                details,
                source_url: sourceUrl.trim() || null,
                payload: buildPayload(),
            });
            notify.success(res.message);
            setSubmittedMessage(res.message);
        } catch (err) {
            setErrors(apiFieldErrors(err));
            notify.error(apiErrorMessage(err, 'تعذّر إرسال الاقتراح، يرجى التحقق من الحقول.'));
        } finally {
            setSaving(false);
        }
    };

    const loginHref = `/auth/google?redirect=${encodeURIComponent(page.url || '/')}`;
    const effectiveKind: SuggestionKind = fixedTarget ? 'edit' : kind;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>
                        {fixedTarget ? copy.dialogTitleEdit : copy.dialogTitleAdd}
                    </DialogTitle>
                    <DialogDescription>{copy.dialogDescription}</DialogDescription>
                </DialogHeader>

                {!user ? (
                    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-5 text-center">
                        <p className="text-sm leading-relaxed text-foreground">
                            إرسال الإضافات واقتراحات التعديل يتطلب تسجيل الدخول بحسابك لضمان موثوقية
                            المساهمات ومتابعتها من قبل فريق التحرير.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <Button asChild className="gap-2">
                                <a href={loginHref}>
                                    <LogIn className="h-4 w-4" aria-hidden="true" />
                                    تسجيل الدخول عبر Google
                                </a>
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                إلغاء
                            </Button>
                        </div>
                    </div>
                ) : submittedMessage ? (
                    <div
                        ref={doneRef}
                        tabIndex={-1}
                        role="status"
                        className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center focus:outline-none"
                    >
                        <CheckCircle2
                            className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400"
                            aria-hidden="true"
                        />
                        <div className="space-y-1">
                            <h3 className="text-base font-bold text-foreground">
                                تم استلام اقتراحك بنجاح
                            </h3>
                            <p className="text-sm text-muted-foreground">{submittedMessage}</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    resetFields(fixedTarget ? 'edit' : defaultKind, fixedTarget?.id ?? '')
                                }
                            >
                                إرسال اقتراح آخر
                            </Button>
                            <Button type="button" onClick={() => onOpenChange(false)}>
                                إغلاق
                            </Button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-4" noValidate>
                        {/* Mode Toggle (hidden when opened for a specific item) */}
                        {fixedTarget ? (
                            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-sm">
                                <span className="text-muted-foreground">العنصر المحدد: </span>
                                <strong className="font-bold text-foreground">
                                    {fixedTarget.label}
                                </strong>
                            </div>
                        ) : (
                            <div
                                role="group"
                                aria-label="نوع الاقتراح"
                                className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/30 p-1"
                            >
                                <button
                                    type="button"
                                    aria-pressed={effectiveKind === 'add'}
                                    onClick={() => {
                                        setKind('add');
                                        setSelectedTargetId('');
                                        setErrors({});
                                    }}
                                    className={cn(
                                        'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm',
                                        effectiveKind === 'add'
                                            ? 'bg-background text-foreground shadow-xs'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <PlusCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    {copy.addTabLabel}
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={effectiveKind === 'edit'}
                                    onClick={() => {
                                        setKind('edit');
                                        setErrors({});
                                    }}
                                    className={cn(
                                        'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm',
                                        effectiveKind === 'edit'
                                            ? 'bg-background text-foreground shadow-xs'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <PencilLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    {copy.editTabLabel}
                                </button>
                            </div>
                        )}

                        {/* Searchable Target Picker when editing from index */}
                        {effectiveKind === 'edit' && !fixedTarget && targets.length > 0 && (
                            <div className="space-y-2 rounded-xl border border-border/80 bg-muted/20 p-3">
                                <Label htmlFor="suggestion-target-search">
                                    {copy.targetPickerLabel}
                                </Label>
                                {selectedTarget ? (
                                    <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/25 bg-background px-3 py-2 text-sm">
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-foreground">
                                                {selectedTarget.label}
                                            </p>
                                            {selectedTarget.subtitle && (
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {selectedTarget.subtitle}
                                                </p>
                                            )}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 shrink-0"
                                            aria-label="تغيير العنصر المحدد"
                                            onClick={() => setSelectedTargetId('')}
                                        >
                                            <X className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <div className="relative">
                                            <Search
                                                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                                aria-hidden="true"
                                            />
                                            <Input
                                                id="suggestion-target-search"
                                                value={targetQuery}
                                                onChange={(e) => setTargetQuery(e.target.value)}
                                                placeholder={copy.targetSearchPlaceholder}
                                                className="bg-background ps-9"
                                            />
                                        </div>
                                        <div className="max-h-36 overflow-y-auto rounded-lg border border-border/70 bg-background">
                                            {filteredTargets.length === 0 ? (
                                                <p className="p-3 text-center text-xs text-muted-foreground">
                                                    لا توجد نتائج مطابقة
                                                </p>
                                            ) : (
                                                filteredTargets.map((item) => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedTargetId(item.id);
                                                            setTargetQuery('');
                                                        }}
                                                        className="flex w-full items-center justify-between gap-2 border-b border-border/40 px-3 py-2 text-start text-sm transition-colors last:border-b-0 hover:bg-muted/60"
                                                    >
                                                        <span className="truncate font-medium text-foreground">
                                                            {item.label}
                                                        </span>
                                                        {item.subtitle && (
                                                            <span className="shrink-0 truncate text-xs text-muted-foreground max-w-[45%]">
                                                                {item.subtitle}
                                                            </span>
                                                        )}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                                <FieldError id="suggestion-target-error" message={errors.target_id} />
                            </div>
                        )}

                        {/* Title / Name */}
                        <div className="space-y-1.5">
                            <Label htmlFor="suggestion-title">
                                {effectiveKind === 'add' ? copy.addTitleLabel : copy.editTitleLabel}
                            </Label>
                            <Input
                                id="suggestion-title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={
                                    effectiveKind === 'add'
                                        ? copy.addTitlePlaceholder
                                        : copy.editTitlePlaceholder
                                }
                                maxLength={200}
                                {...fieldA11y('suggestion-title-error', errors.title)}
                            />
                            <FieldError id="suggestion-title-error" message={errors.title} />
                        </div>

                        {/* Module-specific structured fields */}
                        {module === 'govtcvs' && (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="sg-role">المنصب (اختياري)</Label>
                                    <Input
                                        id="sg-role"
                                        value={roleTitleAr}
                                        onChange={(e) => setRoleTitleAr(e.target.value)}
                                        placeholder="مثال: وزير الاقتصاد والتجارة الخارجية"
                                        maxLength={200}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="sg-inst">الجهة / الوزارة (اختياري)</Label>
                                    <Input
                                        id="sg-inst"
                                        value={institutionNameAr}
                                        onChange={(e) => setInstitutionNameAr(e.target.value)}
                                        placeholder="مثال: وزارة الاقتصاد"
                                        maxLength={200}
                                    />
                                </div>
                                <div className="space-y-1.5 sm:col-span-2">
                                    <Label htmlFor="sg-decree">رقم المرسوم أو القرار (اختياري)</Label>
                                    <Input
                                        id="sg-decree"
                                        value={decreeRef}
                                        onChange={(e) => setDecreeRef(e.target.value)}
                                        placeholder="مثال: المرسوم الرئاسي رقم 203 لعام 2026"
                                        maxLength={200}
                                    />
                                </div>
                            </div>
                        )}

                        {module === 'syofficial' && (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {categories.length > 0 && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="sg-syofficial-cat">التصنيف (اختياري)</Label>
                                        <Select value={categoryId} onValueChange={setCategoryId}>
                                            <SelectTrigger id="sg-syofficial-cat">
                                                <SelectValue placeholder="اختر التصنيف" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map((cat) => (
                                                    <SelectItem key={cat.id} value={cat.id}>
                                                        {cat.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <Label htmlFor="sg-name-en">الاسم بالإنكليزية (اختياري)</Label>
                                    <Input
                                        id="sg-name-en"
                                        dir="ltr"
                                        value={nameEn}
                                        onChange={(e) => setNameEn(e.target.value)}
                                        placeholder="Ministry of ..."
                                        maxLength={200}
                                    />
                                </div>
                                <div className="space-y-1.5 sm:col-span-2">
                                    <Label htmlFor="sg-account-url">
                                        رابط الحساب الرسمي المقترح (اختياري)
                                    </Label>
                                    <Input
                                        id="sg-account-url"
                                        type="url"
                                        dir="ltr"
                                        inputMode="url"
                                        placeholder="https://"
                                        value={accountUrl}
                                        onChange={(e) => setAccountUrl(e.target.value)}
                                        {...fieldA11y(
                                            'sg-account-url-error',
                                            errors['payload.account_url'],
                                        )}
                                    />
                                    <FieldError
                                        id="sg-account-url-error"
                                        message={errors['payload.account_url']}
                                    />
                                </div>
                            </div>
                        )}

                        {module === 'govapps' && (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="sg-android">رابط Google Play (اختياري)</Label>
                                    <Input
                                        id="sg-android"
                                        type="url"
                                        dir="ltr"
                                        inputMode="url"
                                        placeholder="https://play.google.com/..."
                                        value={androidUrl}
                                        onChange={(e) => setAndroidUrl(e.target.value)}
                                        {...fieldA11y(
                                            'sg-android-error',
                                            errors['payload.android_url'],
                                        )}
                                    />
                                    <FieldError
                                        id="sg-android-error"
                                        message={errors['payload.android_url']}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="sg-apple">رابط App Store (اختياري)</Label>
                                    <Input
                                        id="sg-apple"
                                        type="url"
                                        dir="ltr"
                                        inputMode="url"
                                        placeholder="https://apps.apple.com/..."
                                        value={appleUrl}
                                        onChange={(e) => setAppleUrl(e.target.value)}
                                        {...fieldA11y(
                                            'sg-apple-error',
                                            errors['payload.apple_url'],
                                        )}
                                    />
                                    <FieldError
                                        id="sg-apple-error"
                                        message={errors['payload.apple_url']}
                                    />
                                </div>
                                <div className="space-y-1.5 sm:col-span-2">
                                    <Label htmlFor="sg-official-url">
                                        الموقع الرسمي للتطبيق (اختياري)
                                    </Label>
                                    <Input
                                        id="sg-official-url"
                                        type="url"
                                        dir="ltr"
                                        inputMode="url"
                                        placeholder="https://"
                                        value={officialUrl}
                                        onChange={(e) => setOfficialUrl(e.target.value)}
                                        {...fieldA11y(
                                            'sg-official-url-error',
                                            errors['payload.official_url'],
                                        )}
                                    />
                                    <FieldError
                                        id="sg-official-url-error"
                                        message={errors['payload.official_url']}
                                    />
                                </div>
                            </div>
                        )}

                        {module === 'phonebook' && (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="sg-phone-number">
                                        {effectiveKind === 'add'
                                            ? 'رقم الهاتف أو الواتساب'
                                            : 'الرقم الجديد (اختياري)'}
                                    </Label>
                                    <Input
                                        id="sg-phone-number"
                                        dir="ltr"
                                        inputMode="tel"
                                        placeholder="+963 ... أو 112"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        maxLength={64}
                                        {...fieldA11y(
                                            'sg-phone-number-error',
                                            errors['payload.number'],
                                        )}
                                    />
                                    <FieldError
                                        id="sg-phone-number-error"
                                        message={errors['payload.number']}
                                    />
                                </div>
                                {categories.length > 0 && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="sg-phone-cat">التصنيف (اختياري)</Label>
                                        <Select value={categoryId} onValueChange={setCategoryId}>
                                            <SelectTrigger id="sg-phone-cat">
                                                <SelectValue placeholder="اختر التصنيف" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map((cat) => (
                                                    <SelectItem key={cat.id} value={cat.id}>
                                                        {cat.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 sm:col-span-2">
                                    <Label htmlFor="sg-whatsapp" className="cursor-pointer text-sm">
                                        الرقم متاح عبر واتساب
                                    </Label>
                                    <Switch
                                        id="sg-whatsapp"
                                        checked={isWhatsapp}
                                        onCheckedChange={setIsWhatsapp}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Details */}
                        <div className="space-y-1.5">
                            <Label htmlFor="suggestion-details">التفاصيل</Label>
                            <Textarea
                                id="suggestion-details"
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                placeholder={
                                    effectiveKind === 'add'
                                        ? copy.detailsPlaceholderAdd
                                        : copy.detailsPlaceholderEdit
                                }
                                rows={4}
                                maxLength={2000}
                                {...fieldA11y('suggestion-details-error', errors.details)}
                            />
                            <FieldError id="suggestion-details-error" message={errors.details} />
                        </div>

                        {/* Official Source URL */}
                        <div className="space-y-1.5">
                            <Label htmlFor="suggestion-source">{copy.sourceLabel}</Label>
                            <Input
                                id="suggestion-source"
                                type="url"
                                dir="ltr"
                                inputMode="url"
                                placeholder="https://"
                                value={sourceUrl}
                                onChange={(e) => setSourceUrl(e.target.value)}
                                {...fieldA11y('suggestion-source-error', errors.source_url)}
                            />
                            <FieldError id="suggestion-source-error" message={errors.source_url} />
                        </div>

                        <DialogFooter className="gap-2 pt-2 sm:justify-start">
                            <Button type="submit" disabled={saving} className="gap-2">
                                {saving && (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                )}
                                إرسال للمراجعة
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                إلغاء
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
