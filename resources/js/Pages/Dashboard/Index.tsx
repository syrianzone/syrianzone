import React, { useEffect, useRef, useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import {
  ArrowUpLeft,
  Ban,
  BookOpen,
  Bookmark,
  Compass,
  FileText,
  LayoutGrid,
  Loader2,
  MapPin,
  MessageSquarePlus,
  Route,
  Save,
  Settings,
  Shield,
  Sparkles,
  Trash2,
} from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { PageHeader } from '@/Components/layout/PageHeader';
import { PageBody } from '@/Components/layout/PageShell';
import { useAuth } from '@/Contexts/AuthContext';
import { apiErrorMessage, apiFieldErrors } from '@/Lib/api';
import { confirmDialog } from '@/Lib/confirm';
import { notify } from '@/Lib/notify';
import { formatGregorianSyrianShort } from '@/Lib/syrian-date';
import { useTabList } from '@/Lib/useTabList';
import { cn } from '@/Lib/utils';
import { transitAdminApi } from '@/Domain/transit/api';
import type { RouteDraftRow } from '@/Domain/transit/types';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import FieldError, { fieldA11y } from '@/Components/ui/field-error';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { accountApi } from './_lib/api';

type DashboardTab = 'overview' | 'contributions' | 'saved' | 'account';

const TAB_IDS: readonly DashboardTab[] = ['overview', 'contributions', 'saved', 'account'] as const;

interface MyPlaceRow {
  id: number;
  name: string;
  category: string | null;
  status: 'pending' | 'approved' | 'rejected' | string;
  rejection_reason: string | null;
  public_path: string | null;
  created_at: string | null;
}

interface MySuggestionRow {
  id: number;
  module: string;
  kind: 'add' | 'edit' | string;
  target_label: string | null;
  title: string | null;
  status: 'pending' | 'accepted' | 'dismissed' | string;
  resolution_note: string | null;
  created_at: string | null;
}

interface SavedPlaceRow {
  id: number;
  place_id: number;
  created_at: string | null;
  place: {
    id: number;
    name: string;
    category: string | null;
    status: string;
    public_path: string;
  };
}

interface QuranBookmarkRow {
  id: number;
  surah: number;
  ayah: number;
  page: number | null;
  juz: number | null;
  created_at: string | null;
}

interface CompassResultRow {
  id: number;
  share_id: string | null;
  top_figure: string | null;
  top_score: number | null;
  spectrum: string | null;
  answered: number | null;
  created_at: string | null;
}

interface DashboardProps {
  auth: {
    user: {
      id: number;
      name: string;
      email: string;
      role: string;
      is_banned?: boolean;
      avatar_url: string | null;
      effective_permissions?: string[];
    };
  };
  role: string;
  hasAdminAccess?: boolean;
  incomingSuggestionsCount?: number;
  canSubmitTransit: boolean;
  myDrafts?: RouteDraftRow[];
  myPlaces?: MyPlaceRow[];
  mySuggestions?: MySuggestionRow[];
  savedPlaces?: SavedPlaceRow[];
  quranBookmarks?: QuranBookmarkRow[];
  compassResults?: CompassResultRow[];
}

const MODULE_LABELS: Record<string, string> = {
  govtcvs: 'السير الذاتية',
  syofficial: 'الدليل الرسمي',
  govapps: 'التطبيقات الحكومية',
  phonebook: 'دليل الهواتف',
};

const KIND_LABELS: Record<string, string> = {
  add: 'اقتراح إضافة',
  edit: 'اقتراح تعديل',
};

function renderStatusBadge(status: string) {
  if (status === 'approved' || status === 'accepted') {
    return (
      <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400">
        مقبول
      </Badge>
    );
  }
  if (status === 'rejected' || status === 'dismissed') {
    return <Badge variant="destructive">مرفوض</Badge>;
  }
  return (
    <Badge
      variant="secondary"
      className="border-amber-500/30 bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
    >
      قيد المراجعة
    </Badge>
  );
}

// Rendered inside <MainLayout> children so the AuthProvider mounted by
// MainLayout is an ancestor; calling useAuth() in the page component body
// would run above the provider and throw.
function AvatarUploader({ user }: { user: { name: string; avatar_url: string | null } }) {
  const { refreshUser } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar_url ?? null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    setAvatarMessage(null);
    try {
      const res = await accountApi.uploadAvatar(file);
      setAvatarUrl(res.avatar_url);
      setAvatarBroken(false);
      setAvatarMessage({ type: 'success', text: 'تم تحديث الصورة الشخصية' });
      await refreshUser();
    } catch (err) {
      setAvatarMessage({ type: 'error', text: apiErrorMessage(err, 'تعذر رفع الصورة') });
    } finally {
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      setAvatarLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {avatarUrl && !avatarBroken ? (
          <img
            src={avatarUrl}
            alt={user.name}
            onError={() => setAvatarBroken(true)}
            className="h-16 w-16 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-muted text-xl font-bold text-foreground">
            {user.name.charAt(0)}
          </div>
        )}
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleAvatarPick}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => avatarInputRef.current?.click()}
          disabled={avatarLoading}
        >
          {avatarLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              جارٍ الرفع
            </>
          ) : (
            'تغيير الصورة'
          )}
        </Button>
      </div>

      {avatarMessage && (
        <div
          role={avatarMessage.type === 'error' ? 'alert' : 'status'}
          className={cn(
            'rounded-lg p-3 text-sm',
            avatarMessage.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
              : 'bg-destructive/15 text-destructive',
          )}
        >
          {avatarMessage.text}
        </div>
      )}
    </div>
  );
}

function resolveInitialTab(pageUrl: string): DashboardTab {
  const query = pageUrl.includes('?') ? pageUrl.slice(pageUrl.indexOf('?')) : '';
  const tab = new URLSearchParams(query).get('tab');
  if (tab === 'account' || tab === 'profile') return 'account';
  if (tab === 'contributions' || tab === 'submissions') return 'contributions';
  if (tab === 'saved') return 'saved';
  return 'overview';
}

export default function Dashboard({
  auth,
  role,
  hasAdminAccess = false,
  incomingSuggestionsCount = 0,
  canSubmitTransit,
  myDrafts = [],
  myPlaces = [],
  mySuggestions = [],
  savedPlaces = [],
  quranBookmarks = [],
  compassResults = [],
}: DashboardProps) {
  const { url: pageUrl } = usePage();
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => resolveInitialTab(pageUrl));

  const tabs = useTabList<DashboardTab>({
    ids: TAB_IDS,
    active: activeTab,
    onChange: setActiveTab,
    dir: 'rtl',
  });

  const [localMyDrafts, setLocalMyDrafts] = useState<RouteDraftRow[]>(myDrafts);

  const [profileName, setProfileName] = useState(auth.user.name);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const profileFormRef = useRef<HTMLFormElement>(null);
  const [profileFailedSubmit, setProfileFailedSubmit] = useState(0);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!profileFailedSubmit) return;
    profileFormRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [profileFailedSubmit]);

  const showAdminWorkspace = hasAdminAccess || role === 'superadmin';
  const totalContributions = localMyDrafts.length + myPlaces.length + mySuggestions.length;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage(null);
    setProfileErrors({});
    try {
      await accountApi.updateProfile({ name: profileName, email: auth.user.email });
      setProfileMessage({ type: 'success', text: 'تم تحديث معلومات الحساب بنجاح.' });
      notify.success('تم تحديث معلومات الحساب بنجاح');
    } catch (err) {
      const fields = apiFieldErrors(err, { arabicOnly: true });
      const fieldErrors = Object.fromEntries(
        Object.keys(apiFieldErrors(err)).map((field) => [field, fields[field] ?? 'تحقق من هذه القيمة']),
      );
      if (Object.keys(fieldErrors).length > 0) {
        setProfileErrors(fieldErrors);
        setProfileFailedSubmit((n) => n + 1);
      } else {
        setProfileMessage({ type: 'error', text: apiErrorMessage(err, 'تعذر تحديث الحساب.') });
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = await confirmDialog({
      title: 'حذف الحساب نهائياً؟',
      description: 'سيتم تعطيل حسابك وإزالة صورتك الشخصية وتسجيل خروجك فوراً. لا يمكن التراجع عن هذه الخطوة.',
      destructive: true,
      confirmText: 'حذف الحساب',
    });
    if (!confirmed) return;

    setDeleteLoading(true);
    try {
      await accountApi.deleteAccount();
      window.location.href = '/';
    } catch (err) {
      notify.error(apiErrorMessage(err, 'تعذر حذف الحساب حالياً.'));
      setDeleteLoading(false);
    }
  };

  const handleCancelMySubmission = async (id: number) => {
    const confirmed = await confirmDialog({
      title: 'سحب هذا الاقتراح؟',
      description: 'سيتم إلغاء الاقتراح ولا يمكن التراجع.',
      destructive: true,
      confirmText: 'سحب',
    });
    if (!confirmed) return;

    try {
      await transitAdminApi.deleteStudioRoute(id);
      setLocalMyDrafts((prev) => prev.filter((d) => d.id !== id));
      notify.success('تم سحب الاقتراح');
    } catch (err) {
      notify.error(apiErrorMessage(err, 'تعذر سحب الاقتراح'));
    }
  };

  const tabItems: Array<{
    id: DashboardTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'overview', label: 'نظرة عامة', icon: LayoutGrid },
    { id: 'contributions', label: 'مساهماتي', icon: FileText, count: totalContributions },
    { id: 'saved', label: 'محفوظاتي', icon: Bookmark, count: savedPlaces.length + quranBookmarks.length + compassResults.length },
    { id: 'account', label: 'الحساب', icon: Settings },
  ];

  return (
    <MainLayout>
      <div className="min-h-screen bg-background font-sans text-foreground antialiased" dir="rtl">
        <PageHeader
          width="default"
          divider
          title="حسابي"
          description={`مرحباً ${auth.user.name} — تابع مساهماتك ومحفوظاتك وإعدادات حسابك من مكان واحد.`}
          actions={
            showAdminWorkspace ? (
              <Button asChild>
                <Link href="/admin" className="gap-2">
                  <Shield className="h-4 w-4" aria-hidden="true" />
                  <span>لوحة الإدارة</span>
                  {incomingSuggestionsCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ms-1 bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/25 tabular-nums"
                      dir="ltr"
                    >
                      {incomingSuggestionsCount}
                    </Badge>
                  )}
                </Link>
              </Button>
            ) : undefined
          }
        />

        <PageBody width="default" className="space-y-6 pt-6">
          {auth.user.is_banned && (
            <div
              role="alert"
              className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
            >
              <Ban className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>تم حظر حسابك من المساهمة — لا يمكنك إرسال مسارات نقل أو أماكن جديدة حالياً.</span>
            </div>
          )}

          <div
            {...tabs.tabListProps}
            aria-label="أقسام الحساب"
            className="flex items-center gap-1.5 overflow-x-auto border-b border-border pb-2"
          >
            {tabItems.map(({ id, label, icon: Icon, count }) => {
              const selected = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  {...tabs.tabProps(id)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{label}</span>
                  {typeof count === 'number' && count > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                        selected
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                      dir="ltr"
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {activeTab === 'overview' && (
            <div {...tabs.panelProps('overview')} className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">مساهماتي</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold tabular-nums">{totalContributions}</p>
                    <p className="mt-1 text-xs text-muted-foreground">خطوط، أماكن، واقتراحات</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">المحفوظات</CardTitle>
                    <Bookmark className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold tabular-nums">{savedPlaces.length}</p>
                    <p className="mt-1 text-xs text-muted-foreground">أماكن محفوظة في مشوار</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">علامات القرآن</CardTitle>
                    <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold tabular-nums">{quranBookmarks.length}</p>
                    <p className="mt-1 text-xs text-muted-foreground">مواضع محفوظة للتلاوة</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">بوصلة سوريا</CardTitle>
                    <Compass className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold tabular-nums">{compassResults.length}</p>
                    <p className="mt-1 text-xs text-muted-foreground">نتائج محفوظة للبوصلة</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">إجراءات سريعة</CardTitle>
                  <CardDescription>انتقل مباشرةً إلى أكثر الأدوات والخدمات استخداماً.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Link
                    href="/board"
                    className="group flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4 transition-colors hover:border-primary/40 hover:bg-muted/60"
                  >
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">لوحة الإعلانات</p>
                        <p className="text-xs text-muted-foreground">تصفّح وساهم في السبورة</p>
                      </div>
                    </div>
                    <ArrowUpLeft className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                  </Link>

                  <Link
                    href="/mishwar"
                    className="group flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4 transition-colors hover:border-primary/40 hover:bg-muted/60"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">مشوار</p>
                        <p className="text-xs text-muted-foreground">استكشف الأماكن وأضف جديداً</p>
                      </div>
                    </div>
                    <ArrowUpLeft className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                  </Link>

                  {canSubmitTransit && (
                    <a
                      href="/transit/studio"
                      className="group flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4 transition-colors hover:border-primary/40 hover:bg-muted/60"
                    >
                      <div className="flex items-center gap-3">
                        <Route className="h-5 w-5 text-primary" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">استوديو التنقل</p>
                          <p className="text-xs text-muted-foreground">اقترح خط نقل جديد</p>
                        </div>
                      </div>
                      <ArrowUpLeft className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                    </a>
                  )}

                  {showAdminWorkspace && (
                    <Link
                      href="/admin"
                      className="group flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:border-primary/50 hover:bg-primary/10"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">لوحة الإدارة</p>
                          <p className="text-xs text-muted-foreground">
                            {incomingSuggestionsCount > 0
                              ? `${incomingSuggestionsCount} عنصر بانتظار المراجعة`
                              : 'إدارة المحتوى والمراجعات'}
                          </p>
                        </div>
                      </div>
                      <ArrowUpLeft className="h-4 w-4 text-primary transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                    </Link>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'contributions' && (
            <div {...tabs.panelProps('contributions')} className="space-y-6">
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Route className="h-5 w-5 text-primary" aria-hidden="true" />
                      مسودات خطوط النقل
                    </CardTitle>
                    <CardDescription>خطوط النقل التي اقترحتها أو عدّلتها في استوديو التنقل.</CardDescription>
                  </div>
                  {canSubmitTransit && (
                    <Button asChild variant="outline" size="sm" className="w-fit">
                      <a href="/transit/studio">اقتراح خط جديد</a>
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {localMyDrafts.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      لم تقدّم أي مسودات لخطوط النقل بعد.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {localMyDrafts.map((draft) => (
                        <div
                          key={draft.id}
                          className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4 md:flex-row md:items-center"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-foreground">{draft.name_ar}</span>
                              {draft.name_en && (
                                <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                                  ({draft.name_en})
                                </span>
                              )}
                              {renderStatusBadge(draft.status)}
                              {draft.route_id && (
                                <Badge variant="outline">تعديل لخط منشور</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              المدينة: {draft.city?.name_ar ?? draft.city_id} · {formatGregorianSyrianShort(draft.created_at)}
                            </p>
                            {draft.status === 'rejected' && draft.rejection_reason && (
                              <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                                <span className="font-bold">سبب الرفض:</span> {draft.rejection_reason}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {draft.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelMySubmission(draft.id)}
                                className="border-destructive/40 text-destructive hover:text-destructive"
                              >
                                سحب الاقتراح
                              </Button>
                            )}
                            {!auth.user.is_banned && (
                              <Button asChild variant="outline" size="sm">
                                <a href={`/transit/studio?edit=${draft.id}`}>تعديل</a>
                              </Button>
                            )}
                            {draft.status === 'approved' && draft.route_id && (
                              <Button asChild variant="outline" size="sm">
                                <a href={`/transit/city/${draft.city_id}?route=${draft.route_id}`}>عرض الخط</a>
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
                      أماكن مشوار المقترحة
                    </CardTitle>
                    <CardDescription>الأماكن التي أضفتها إلى دليل مشوار وحالة مراجعتها.</CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-fit">
                    <Link href="/mishwar">تصفّح مشوار</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {myPlaces.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      لم تضف أي أماكن في مشوار بعد.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {myPlaces.map((place) => (
                        <div
                          key={place.id}
                          className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-foreground">{place.name}</span>
                              {renderStatusBadge(place.status)}
                              {place.category && (
                                <Badge variant="outline">{place.category}</Badge>
                              )}
                            </div>
                            {place.created_at && (
                              <p className="text-xs text-muted-foreground">
                                تاريخ الإضافة: {formatGregorianSyrianShort(place.created_at)}
                              </p>
                            )}
                            {place.status === 'rejected' && place.rejection_reason && (
                              <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                                <span className="font-bold">سبب الرفض:</span> {place.rejection_reason}
                              </div>
                            )}
                          </div>
                          {place.public_path && (
                            <Button asChild variant="outline" size="sm" className="w-fit shrink-0">
                              <Link href={place.public_path}>عرض المكان</Link>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquarePlus className="h-5 w-5 text-primary" aria-hidden="true" />
                    اقتراحات الأدلة
                  </CardTitle>
                  <CardDescription>اقتراحات الإضافة والتعديل التي أرسلتها لأدلة المساحة السورية.</CardDescription>
                </CardHeader>
                <CardContent>
                  {mySuggestions.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      لم ترسل أي اقتراحات للأدلة بعد.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {mySuggestions.map((suggestion) => (
                        <div
                          key={suggestion.id}
                          className="space-y-1.5 rounded-xl border border-border bg-muted/30 p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-foreground">
                              {suggestion.title || suggestion.target_label || `اقتراح #${suggestion.id}`}
                            </span>
                            {renderStatusBadge(suggestion.status)}
                            <Badge variant="outline">
                              {MODULE_LABELS[suggestion.module] ?? suggestion.module}
                            </Badge>
                            <Badge variant="secondary">
                              {KIND_LABELS[suggestion.kind] ?? suggestion.kind}
                            </Badge>
                          </div>
                          {suggestion.created_at && (
                            <p className="text-xs text-muted-foreground">
                              تاريخ الإرسال: {formatGregorianSyrianShort(suggestion.created_at)}
                            </p>
                          )}
                          {suggestion.resolution_note && (
                            <div className="mt-2 rounded-lg border border-border bg-background/70 p-2 text-xs text-muted-foreground">
                              <span className="font-semibold text-foreground">ملاحظة المراجعة:</span>{' '}
                              {suggestion.resolution_note}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'saved' && (
            <div {...tabs.panelProps('saved')} className="space-y-6">
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Bookmark className="h-5 w-5 text-primary" aria-hidden="true" />
                      الأماكن المحفوظة
                    </CardTitle>
                    <CardDescription>الأماكن التي حفظتها للعودة إليها في مشوار.</CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-fit">
                    <Link href="/mishwar">استكشاف مشوار</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {savedPlaces.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      لا توجد أماكن محفوظة حالياً.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {savedPlaces.map((save) => (
                        <Link
                          key={save.id}
                          href={save.place.public_path}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4 transition-colors hover:border-primary/40 hover:bg-muted/60"
                        >
                          <div className="min-w-0 space-y-1">
                            <p className="truncate font-semibold text-foreground">{save.place.name}</p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {save.place.category && <span>{save.place.category}</span>}
                              {save.created_at && (
                                <span>· حفظ بتاريخ {formatGregorianSyrianShort(save.created_at)}</span>
                              )}
                            </div>
                          </div>
                          <ArrowUpLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
                      علامات القرآن الكريم
                    </CardTitle>
                    <CardDescription>الآيات والمواضع التي حفظتها أثناء القراءة.</CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-fit">
                    <Link href="/muslim/quran">فتح المصحف</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {quranBookmarks.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      لم تحفظ أي علامات تلاوة بعد.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {quranBookmarks.map((bookmark) => (
                        <Link
                          key={bookmark.id}
                          href="/muslim/quran"
                          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4 transition-colors hover:border-primary/40 hover:bg-muted/60"
                        >
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">
                              سورة {bookmark.surah} — آية {bookmark.ayah}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {[
                                bookmark.page ? `صفحة ${bookmark.page}` : null,
                                bookmark.juz ? `الجزء ${bookmark.juz}` : null,
                                bookmark.created_at ? formatGregorianSyrianShort(bookmark.created_at) : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          <ArrowUpLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Compass className="h-5 w-5 text-primary" aria-hidden="true" />
                      نتائج بوصلة سوريا
                    </CardTitle>
                    <CardDescription>سجل نتائجك المحفوظة في اختبار بوصلة سوريا.</CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-fit">
                    <Link href="/compass">فتح البوصلة</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {compassResults.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      لا توجد نتائج محفوظة في بوصلة سوريا بعد.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {compassResults.map((result) => (
                        <Link
                          key={result.id}
                          href={result.share_id ? `/compass/s/${result.share_id}` : '/compass'}
                          className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4 transition-colors hover:border-primary/40 hover:bg-muted/60"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-foreground">
                                {result.top_figure || result.spectrum || `نتيجة #${result.id}`}
                              </span>
                              {typeof result.top_score === 'number' && (
                                <Badge variant="secondary" className="tabular-nums" dir="ltr">
                                  {Math.round(result.top_score)}%
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {[
                                typeof result.answered === 'number' ? `${result.answered} إجابة` : null,
                                result.created_at ? formatGregorianSyrianShort(result.created_at) : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          <ArrowUpLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'account' && (
            <div {...tabs.panelProps('account')} className="max-w-2xl space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">الصورة الشخصية</CardTitle>
                  <CardDescription>تظهر صورتك بجانب اسمك في حسابك ومشاركاتك.</CardDescription>
                </CardHeader>
                <CardContent>
                  <AvatarUploader user={auth.user} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">معلومات الحساب</CardTitle>
                  <CardDescription>يمكنك تعديل اسم العرض الخاص بك في أي وقت.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form ref={profileFormRef} onSubmit={handleUpdateProfile} noValidate className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="profile-name">الاسم</Label>
                      <Input
                        id="profile-name"
                        type="text"
                        value={profileName}
                        onChange={(e) => {
                          setProfileName(e.target.value);
                          setProfileErrors((prev) => {
                            if (!prev.name) return prev;
                            const next = { ...prev };
                            delete next.name;
                            return next;
                          });
                        }}
                        {...fieldA11y('profile-name', profileErrors.name)}
                        required
                      />
                      <FieldError id="profile-name-error" message={profileErrors.name} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profile-email">البريد الإلكتروني</Label>
                      <Input
                        id="profile-email"
                        type="email"
                        value={auth.user.email}
                        readOnly
                        disabled
                        dir="ltr"
                        className="text-start opacity-80"
                      />
                      <p className="text-xs text-muted-foreground">
                        البريد الإلكتروني مرتبط بحساب Google المستخدم لتسجيل الدخول ولا يمكن تغييره.
                      </p>
                    </div>

                    {profileMessage && (
                      <div
                        role={profileMessage.type === 'error' ? 'alert' : 'status'}
                        className={cn(
                          'rounded-lg p-3 text-sm',
                          profileMessage.type === 'success'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : 'bg-destructive/15 text-destructive',
                        )}
                      >
                        {profileMessage.text}
                      </div>
                    )}

                    <Button type="submit" disabled={profileLoading}>
                      {profileLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          جارٍ الحفظ...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" aria-hidden="true" />
                          حفظ التغييرات
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-destructive/30">
                <CardHeader>
                  <CardTitle className="text-lg text-destructive">حذف الحساب</CardTitle>
                  <CardDescription>
                    يؤدي حذف الحساب إلى تعطيله وإزالة صورتك الشخصية وتسجيل خروجك فوراً.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        جارٍ الحذف...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        حذف الحساب نهائياً
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </PageBody>
      </div>
    </MainLayout>
  );
}
