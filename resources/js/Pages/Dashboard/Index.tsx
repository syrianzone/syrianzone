import React, { useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import axios from 'axios';
import {
  User as UserIcon,
  Settings,
  Shield,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Ban,
  Edit,
  Plus,
  Loader2,
  Megaphone,
  CloudUpload,
  Gamepad2,
  Eye,
  BarChart3,
  X,
  Save,
} from 'lucide-react';
import {
  TierlistIcon,
  TransitIcon,
  MishwarIcon,
  SyOfficialIcon,
  GovAppsIcon,
  PhonebookIcon,
} from '@/Components/Icons/ProjectIcons';
import MainLayout from '@/Layouts/MainLayout';
import { useAuth } from '@/Contexts/AuthContext';
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import { Switch } from '@/Components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/Components/ui/dialog';
import AdminPollManager from '@/Components/admin/AdminPollManager';
import { cn } from '@/lib/utils';

interface City {
  id: string;
  name_ar: string;
  name_en: string;
}

interface Draft {
  id: number;
  user_id: number | null;
  user: { id: number; name: string; email: string; is_banned: boolean } | null;
  city_id: string;
  city: City | null;
  name_ar: string;
  name_en: string | null;
  price: number | null;
  notes: string | null;
  geojson: any;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  route_id: string | null;
  created_at: string;
}

interface Poll {
  id: string;
  title: string;
  slug: string;
  timezone?: string;
  is_active: boolean;
  candidates_count: number;
}

interface PollCandidate {
  id: string;
  candidate_group_id?: string | null;
  name: string;
  title?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  status?: 'active' | 'archived';
  [key: string]: any;
}

interface PollGroup {
  id: string;
  poll_id: string;
  name: string;
  sort_order: number;
  is_default?: boolean;
  [key: string]: any;
}

const pollPublicUrl = (slug: string) =>
  slug === 'best-ministers' ? '/tierlist' : `/polls/${slug}`;

const pollLeaderboardUrl = (slug: string) =>
  slug === 'best-ministers' ? '/tierlist/leaderboard' : `/polls/${slug}/leaderboard`;

interface Route {
  id: string;
  name_ar: string;
  name_en: string | null;
  city: City | null;
  price_new: number | null;
}

interface DashboardProps {
  auth: {
    user: {
      id: number;
      name: string;
      email: string;
      role: string;
      avatar_url: string | null;
    };
  };
  role: string;
  cities: City[];
  myDrafts?: Draft[];
  polls?: Poll[];
  allDrafts?: Draft[];
  publishedRoutes?: Route[];
}

// Rendered inside the <MainLayout> children, where the AuthProvider that
// MainLayout mounts is an ancestor; calling useAuth() in the page component
// body would run above the provider and throw, white-screening /dashboard.
function AvatarUploader({ user }: { user: { name: string; avatar_url: string | null } }) {
  const { refreshUser } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar_url ?? null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // a dead avatar_url (lost file, stale Google url) falls back to the initial circle
  const [avatarBroken, setAvatarBroken] = useState(false);

  // Upload a new avatar as soon as a file is picked
  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    setAvatarMessage(null);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const res = await axios.post('/api/account/avatar', form);
      setAvatarUrl(res.data.avatar_url);
      setAvatarBroken(false);
      setAvatarMessage({ type: 'success', text: 'تم تحديث الصورة الشخصية' });
      await refreshUser();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setAvatarMessage({
        type: 'error',
        text: msg && /[\u0600-\u06FF]/.test(msg) ? msg : 'تعذر رفع الصورة'
      });
    } finally {
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      setAvatarLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-4">
        {avatarUrl && !avatarBroken ? (
          <img
            src={avatarUrl}
            alt={user.name}
            onError={() => setAvatarBroken(true)}
            className="h-16 w-16 rounded-full object-cover border border-border"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-muted border border-border flex items-center justify-center text-foreground text-xl font-bold">
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
              <Loader2 className="h-4 w-4 animate-spin" />
              جارٍ الرفع
            </>
          ) : (
            'تغيير الصورة'
          )}
        </Button>
      </div>

      {avatarMessage && (
        <div className={cn(
          'p-4 rounded-lg text-sm',
          avatarMessage.type === 'success' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/15 text-destructive'
        )}>
          {avatarMessage.text}
        </div>
      )}
    </>
  );
}

const statusBadge = (status: Draft['status']) => {
  if (status === 'approved')
    return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">تم القبول والنشر</Badge>;
  if (status === 'rejected')
    return <Badge variant="destructive">مرفوض</Badge>;
  return <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20">قيد المراجعة</Badge>;
};

export default function Dashboard({
  auth,
  role,
  cities,
  myDrafts = [],
  polls = [],
  allDrafts = [],
  publishedRoutes = []
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'submissions' | 'polls'>(() => {
    // ?tab=profile deep link from the navbar dropdown; profile is the only tab every role has
    if (new URLSearchParams(window.location.search).get('tab') === 'profile') return 'profile';
    return role === 'user' ? 'submissions' : (role === 'transit_admin' ? 'profile' : 'polls');
  });

  // Profile Form States
  const [profileName, setProfileName] = useState(auth.user.name);
  const [profileEmail, setProfileEmail] = useState(auth.user.email);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Account Deletion States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Rejection Dialog States
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectDraftId, setRejectDraftId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  // Ban Status states for dynamic list updates
  const [localDrafts, setLocalDrafts] = useState<Draft[]>(allDrafts);
  const [localPolls, setLocalPolls] = useState<Poll[]>(polls);
  const [localMyDrafts, setLocalMyDrafts] = useState<Draft[]>(myDrafts);

  const [apiLoading, setApiLoading] = useState<number | null>(null); // maps draft ID to loading state

  // Inline poll create states (replaces /admin/polls/create page)
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createActive, setCreateActive] = useState(true);
  const [creating, setCreating] = useState(false);

  // Inline poll edit states (replaces /admin/polls/{id}/edit page)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [editingCandidates, setEditingCandidates] = useState<PollCandidate[]>([]);
  const [editingGroups, setEditingGroups] = useState<PollGroup[]>([]);
  const [editingLoading, setEditingLoading] = useState(false);
  const [editingSaving, setEditingSaving] = useState(false);

  const canManagePolls = role === 'admin' || role === 'superadmin';

  const fetchPollDetails = async (id: string) => {
    setEditingLoading(true);
    try {
      const res = await axios.get(`/api/polls/${id}`, { params: { include_archived: 1 } });
      const data = res.data ?? {};
      if (data.poll) {
        setEditingPoll(data.poll);
        setLocalPolls(prev => prev.map(p => p.id === data.poll.id ? { ...p, ...data.poll, candidates_count: data.candidates?.length ?? p.candidates_count } : p));
      }
      if (data.candidates) setEditingCandidates(data.candidates);
      if (data.groups) setEditingGroups(data.groups);
    } catch (err: any) {
      alert('تعذر تحميل بيانات الاستبيان: ' + (err.response?.data?.message ?? err.message));
      setEditingId(null);
      setEditingPoll(null);
    } finally {
      setEditingLoading(false);
    }
  };

  const openPollEditor = (poll: Poll) => {
    setEditingId(poll.id);
    setEditingPoll(poll);
    setEditingCandidates([]);
    setEditingGroups([]);
    fetchPollDetails(poll.id);
    // keep URL shareable without leaving the dashboard
    const url = new URL(window.location.href);
    url.searchParams.set('edit-poll', poll.id);
    url.searchParams.delete('create-poll');
    window.history.replaceState({}, '', url.toString());
  };

  const closePollEditor = () => {
    setEditingId(null);
    setEditingPoll(null);
    setEditingCandidates([]);
    setEditingGroups([]);
    const url = new URL(window.location.href);
    url.searchParams.delete('edit-poll');
    url.searchParams.delete('edit');
    window.history.replaceState({}, '', url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''));
  };

  const handleRefreshEditor = async () => {
    if (!editingId) return;
    await fetchPollDetails(editingId);
  };

  // Deep links: legacy /admin/polls/* redirects (?edit-poll=, ?create-poll=1)
  // and poll pages (?edit=) land here so the dashboard is the single editor.
  useEffect(() => {
    if (!canManagePolls) return;
    const params = new URLSearchParams(window.location.search);
    const editParam = params.get('edit-poll') ?? params.get('edit');
    const createParam = params.get('create-poll') ?? params.get('create');
    if (editParam) {
      const target = localPolls.find(p => p.id === editParam || p.slug === editParam);
      if (target) {
        setActiveTab('polls');
        openPollEditor(target);
      } else {
        // ID not in the summary list (e.g. stale link) — still try to load it.
        setActiveTab('polls');
        setEditingId(editParam);
        setEditingPoll(null);
        fetchPollDetails(editParam);
      }
    } else if (createParam !== null && (createParam === '1' || createParam === '')) {
      setActiveTab('polls');
      setCreateOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Account details
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage(null);
    try {
      await axios.post('/api/account/update', {
        name: profileName,
        email: profileEmail
      });
      setProfileMessage({ type: 'success', text: 'تم تحديث معلومات الحساب بنجاح.' });
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'تعذر تحديث الحساب.';
      setProfileMessage({ type: 'error', text: msg });
    } finally {
      setProfileLoading(false);
    }
  };

  // Soft Delete Account
  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      await axios.post('/api/account/delete');
      window.location.href = '/';
    } catch (err) {
      alert('تعذر حذف الحساب حالياً.');
      setDeleteLoading(false);
    }
  };

  // Approve Transit Draft
  const handleApproveDraft = async (id: number) => {
    setApiLoading(id);
    try {
      const res = await axios.post(`/api/v1/admin/route-drafts/${id}/approve`);
      alert('تمت الموافقة على المسار بنجاح ونشره.');
      // Update local state status
      setLocalDrafts(prev => prev.map(d => d.id === id ? { ...d, status: 'approved' } : d));
    } catch (err: any) {
      alert('خطأ أثناء الموافقة: ' + (err.response?.data?.message ?? err.message));
    } finally {
      setApiLoading(null);
    }
  };

  // Reject Transit Draft (Open Modal)
  const openRejectDialog = (id: number) => {
    setRejectDraftId(id);
    setRejectReason('');
    setRejectOpen(true);
  };

  // Confirm Reject
  const handleConfirmReject = async () => {
    if (!rejectDraftId) return;
    setRejectLoading(true);
    try {
      await axios.post(`/api/v1/admin/route-drafts/${rejectDraftId}/reject`, {
        reason: rejectReason.trim() || null
      });
      setRejectOpen(false);
      setLocalDrafts(prev => prev.map(d => d.id === rejectDraftId ? { ...d, status: 'rejected', rejection_reason: rejectReason } : d));
      alert('تم رفض المسار بنجاح.');
    } catch (err: any) {
      alert('خطأ أثناء الرفض: ' + (err.response?.data?.message ?? err.message));
    } finally {
      setRejectLoading(false);
      setRejectDraftId(null);
    }
  };

  // Toggle Submitter Ban
  const handleToggleBan = async (userId: number, currentBanned: boolean) => {
    if (!confirm(currentBanned ? 'هل أنت متأكد من إلغاء حظر هذا المساهم؟' : 'هل أنت متأكد من حظر هذا المساهم من تقديم مسارات جديدة؟')) return;
    try {
      const res = await axios.post(`/api/admin/users/${userId}/toggle-ban`);
      const isBanned = res.data.is_banned;
      alert(res.data.message);

      // Update local draft user states
      setLocalDrafts(prev => prev.map(d => {
        if (d.user && d.user.id === userId) {
          return { ...d, user: { ...d.user, is_banned: isBanned } };
        }
        return d;
      }));
    } catch (err: any) {
      alert('خطأ أثناء تعديل حالة الحظر: ' + (err.response?.data?.message ?? err.message));
    }
  };

  // Delete Poll
  const handleDeletePoll = async (id: string, slug: string) => {
    if (slug === 'best-ministers') {
        alert('لا يمكن حذف استبيان تقييم الوزراء الرئيسي.');
        return;
    }
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا الاستبيان وجميع المرشحين التابعين له نهائياً؟')) return;

    try {
      await axios.delete(`/api/polls/${id}`);
      setLocalPolls(prev => prev.filter(p => p.id !== id));
      if (editingId === id) closePollEditor();
      alert('تم حذف الاستبيان بنجاح.');
    } catch (err: any) {
      alert('خطأ: ' + (err.response?.data?.message ?? 'تعذر الحذف.'));
    }
  };

  const handleCreatePoll = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!createTitle.trim() || !createSlug.trim()) return;
    setCreating(true);
    try {
      const res = await axios.post('/api/polls', {
        title: createTitle.trim(),
        slug: createSlug.trim(),
        timezone: 'Europe/Amsterdam',
        is_active: createActive,
      });
      const created: Poll = res.data;
      setLocalPolls(prev => [...prev, { ...created, candidates_count: 0 }]);
      setCreateOpen(false);
      setCreateTitle('');
      setCreateSlug('');
      setCreateActive(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('create-poll');
      url.searchParams.delete('create');
      window.history.replaceState({}, '', url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''));
      openPollEditor({ ...created, candidates_count: 0 });
    } catch (err: any) {
      alert('تعذر إنشاء الاستبيان: ' + (err.response?.data?.message ?? err.message));
    } finally {
      setCreating(false);
    }
  };

  const handleSavePollMetadata = async () => {
    if (!editingId || !editingPoll) return;
    setEditingSaving(true);
    try {
      const res = await axios.put(`/api/polls/${editingId}`, {
        title: editingPoll.title,
        slug: editingPoll.slug,
        is_active: editingPoll.is_active,
      });
      const updated: Poll = res.data;
      setEditingPoll(prev => prev ? { ...prev, ...updated } : prev);
      setLocalPolls(prev => prev.map(p => p.id === editingId ? { ...p, ...updated } : p));
    } catch (err: any) {
      alert('حدث خطأ أثناء حفظ الإعدادات: ' + (err.response?.data?.message ?? err.message));
    } finally {
      setEditingSaving(false);
    }
  };

  // Cancel/Delete own submission (Normal user)
  const handleCancelMySubmission = async (id: number) => {
    if (!confirm('هل تريد إلغاء وسحب هذا الاقتراح؟')) return;
    try {
      alert('تم سحب الاقتراح.');
      setLocalMyDrafts(prev => prev.filter(d => d.id !== id));
    } catch (err) {}
  };

  const navItemClass = (active: boolean) =>
    cn(
      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors duration-150 w-full whitespace-nowrap lg:whitespace-normal',
      active
        ? 'bg-primary text-primary-foreground'
        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    );

  return (
    <MainLayout>
      <div className="min-h-screen bg-background text-foreground font-sans antialiased" dir="rtl">
        <Head>
          <title>لوحة التحكم الموحدة</title>
          <meta name="description" content="إدارة الاستبيانات، خطوط النقل المشتركة المقترحة، وإعدادات الحساب الشخصي في المساحة السورية." />
        </Head>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {role === 'superadmin' && (
            <div className="flex justify-end mb-8">
              <a
                href="/superadmin"
                className="px-5 py-2.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg"
              >
                <Shield className="h-5 w-5" />
                لوحة الإدارة الفيدرالية (Filament)
              </a>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar / Tabs list */}
            <aside className="w-full lg:w-64 shrink-0">
              <nav className="flex flex-row lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-visible pb-3 lg:pb-0">
                {/* Conditional Submissions Tab (Normal Users) */}
                {role === 'user' && (
                  <button onClick={() => setActiveTab('submissions')} className={navItemClass(activeTab === 'submissions')}>
                    <TransitIcon className="h-5 w-5" />
                    اقتراحاتي للخطوط
                  </button>
                )}

                {/* Polls Tab (Admins and Superadmins) */}
                {(role === 'admin' || role === 'superadmin') && (
                  <button onClick={() => setActiveTab('polls')} className={navItemClass(activeTab === 'polls')}>
                    <TierlistIcon className="h-5 w-5" />
                    تير ليست
                  </button>
                )}

                {/* Transit review Tab (Admins, Transit Admins, Superadmins) */}
                {(role === 'admin' || role === 'transit_admin' || role === 'superadmin') && (
                  <Link
                    href="/transit/admin"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors duration-150 w-full whitespace-nowrap lg:whitespace-normal bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <TransitIcon className="h-5 w-5" />
                    ترانزيت
                  </Link>
                )}

                {/* Places moderation Tab (Admins, Superadmins) */}
                {(role === 'admin' || role === 'superadmin') && (
                  <Link
                    href="/admin/places"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors duration-150 w-full whitespace-nowrap lg:whitespace-normal bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <MishwarIcon className="h-5 w-5" />
                    مشوار
                  </Link>
                )}

                {/* SyOfficial Admin Tab (Admins, SyOfficial Admins, Superadmins) */}
                {(role === 'admin' || role === 'syofficial_admin' || role === 'superadmin') && (
                  <Link
                    href="/admin/syofficial"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors duration-150 w-full whitespace-nowrap lg:whitespace-normal bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <SyOfficialIcon className="h-5 w-5" />
                    الحسابات الرسمية
                  </Link>
                )}

                {/* GovApps Admin Tab (Admins, GovApps Admins, Superadmins) */}
                {(role === 'admin' || role === 'govapps_admin' || role === 'superadmin') && (
                  <Link
                    href="/admin/govapps"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors duration-150 w-full whitespace-nowrap lg:whitespace-normal bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <GovAppsIcon className="h-5 w-5" />
                    التطبيقات الحكومية
                  </Link>
                )}

                {/* GuessWho Admin Tab (Admins, Superadmins) — no ProjectIcon exists, use Gamepad2 from the same lucide set as the navbar fallbacks */}
                {(role === 'admin' || role === 'superadmin') && (
                  <Link
                    href="/admin/guesswho"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors duration-150 w-full whitespace-nowrap lg:whitespace-normal bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Gamepad2 className="h-5 w-5" />
                    من هو
                  </Link>
                )}

                {/* Phonebook Admin Tab */}
                {(role === 'admin' || role === 'superadmin' || (auth.user as any)?.permissions?.includes('phonebook.edit') || (auth.user as any)?.permissions?.includes('phonebook.create')) && (
                  <Link
                    href="/admin/phonebook"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors duration-150 w-full whitespace-nowrap lg:whitespace-normal bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <PhonebookIcon className="h-5 w-5" />
                    دليل الهاتف
                  </Link>
                )}

                {/* R2 Asset Manager Tab (Superadmin only) */}
                {role === 'superadmin' && (
                  <Link
                    href="/admin/assets"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors duration-150 w-full whitespace-nowrap lg:whitespace-normal bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <CloudUpload className="h-5 w-5" />
                    الملفات
                  </Link>
                )}

                {/* Site Popup Tab (Superadmin only) */}
                {role === 'superadmin' && (
                  <Link
                    href="/admin/site-popup"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors duration-150 w-full whitespace-nowrap lg:whitespace-normal bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Megaphone className="h-5 w-5" />
                    النافذة المنبثقة
                  </Link>
                )}

                {/* Profile/Settings Tab (All users) */}
                <button onClick={() => setActiveTab('profile')} className={navItemClass(activeTab === 'profile')}>
                  <Settings className="h-5 w-5" />
                  الحساب
                </button>
              </nav>
            </aside>

            {/* Tab Content Box */}
            <div className="flex-1 bg-card border border-border rounded-xl p-6 shadow-sm min-h-[480px]">
              {/* SUBMISSIONS TAB */}
              {activeTab === 'submissions' && role === 'user' && (
                <div>
                  <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <TransitIcon className="h-6 w-6" />
                    سجل اقتراحات المسارات الخاصة بك
                  </h2>

                  {localMyDrafts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <TransitIcon className="h-16 w-16 mx-auto mb-4 opacity-25" />
                      <p className="text-lg">لم تقم بتقديم أي اقتراحات مسارات للخطوط بعد.</p>
                      <p className="text-sm mt-1">اذهب إلى استوديو التنقل لاقتراح خط حافلة جديد للمجتمع.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {localMyDrafts.map(draft => (
                        <div key={draft.id} className="p-4 bg-muted/40 rounded-lg border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-foreground font-bold text-lg">{draft.name_ar}</span>
                              {draft.name_en && <span className="text-xs text-muted-foreground font-mono">({draft.name_en})</span>}
                              {statusBadge(draft.status)}
                              {draft.route_id && (
                                <Badge variant="outline" className="border-blue-500/40 text-blue-600 dark:text-blue-400">
                                  تعديل مقترح لخط منشور
                                </Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground text-xs mt-1">
                              المدينة: {draft.city?.name_ar ?? draft.city_id} · تاريخ التقديم: {new Date(draft.created_at).toLocaleDateString('ar-SY')}
                            </p>
                            {draft.status === 'rejected' && draft.rejection_reason && (
                              <div className="mt-2 p-2 bg-destructive/10 border border-destructive/30 rounded text-destructive text-xs">
                                <span className="font-bold">ملاحظات التدقيق:</span> {draft.rejection_reason}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {draft.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelMySubmission(draft.id)}
                                className="text-destructive hover:text-destructive border-destructive/40"
                              >
                                سحب الاقتراح
                              </Button>
                            )}
                            <a href={`/transit/studio?edit=${draft.id}`}>
                              <Button variant="outline" size="sm">تعديل</Button>
                            </a>
                            {draft.status === 'approved' && draft.route_id && (
                              <a href={`/transit/city/${draft.city_id}/route/${draft.route_id}`}>
                                <Button variant="outline" size="sm" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/40 hover:text-emerald-600">
                                  عرض الخط المنشور
                                </Button>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* POLLS TAB — single place for tierlist/poll management (replaces /admin/polls*) */}
              {activeTab === 'polls' && (role === 'admin' || role === 'superadmin') && (
                <div>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                      <TierlistIcon className="h-6 w-6" />
                      إدارة استبيانات التقييم
                    </h2>
                    <Button
                      onClick={() => setCreateOpen(true)}
                      className="w-fit"
                    >
                      <Plus className="h-4 w-4" />
                      إنشاء استبيان جديد
                    </Button>
                  </div>

                  {localPolls.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <AlertCircle className="h-16 w-16 mx-auto mb-4 opacity-25" />
                      <p className="text-lg">لا توجد استبيانات مسجلة في الوقت الحالي.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground text-xs">
                            <th className="pb-3 font-bold">اسم الاستبيان</th>
                            <th className="pb-3 font-bold">الرابط الفرعي (Slug)</th>
                            <th className="pb-3 font-bold text-center">المرشحين</th>
                            <th className="pb-3 font-bold text-center">الحالة</th>
                            <th className="pb-3 font-bold text-left">خيارات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {localPolls.map(poll => {
                            const isEditing = editingId === poll.id;
                            return (
                            <tr key={poll.id} className={cn("border-b border-border/60 hover:bg-muted/40 text-sm", isEditing && "bg-primary/5")}>
                              <td className="py-4 text-foreground font-bold">{poll.title}</td>
                              <td className="py-4 font-mono text-muted-foreground text-xs">{poll.slug}</td>
                              <td className="py-4 text-center">{poll.candidates_count} مرشحين</td>
                              <td className="py-4 text-center">
                                <Badge variant={poll.is_active ? 'default' : 'secondary'} className={poll.is_active ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' : ''}>
                                  {poll.is_active ? 'نشط' : 'معطل'}
                                </Badge>
                              </td>
                              <td className="py-4 text-left">
                                <div className="flex justify-end gap-2">
                                  <a
                                    href={pollPublicUrl(poll.slug)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 bg-muted hover:bg-accent text-muted-foreground hover:text-accent-foreground rounded border border-border transition-colors"
                                    title="عرض صفحة التصويت"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </a>
                                  <a
                                    href={pollLeaderboardUrl(poll.slug)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 bg-muted hover:bg-accent text-muted-foreground hover:text-accent-foreground rounded border border-border transition-colors"
                                    title="عرض النتائج"
                                  >
                                    <BarChart3 className="h-4 w-4" />
                                  </a>
                                  <button
                                    onClick={() => (isEditing ? closePollEditor() : openPollEditor(poll))}
                                    className={cn(
                                      "p-1.5 rounded border border-border transition-colors",
                                      isEditing
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-muted hover:bg-accent text-muted-foreground hover:text-accent-foreground"
                                    )}
                                    title={isEditing ? 'إغلاق المحرر' : 'تعديل'}
                                  >
                                    {isEditing ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                                  </button>
                                  {poll.slug !== 'best-ministers' ? (
                                    <button
                                      onClick={() => handleDeletePoll(poll.id, poll.slug)}
                                      className="p-1.5 bg-muted hover:bg-destructive/15 text-muted-foreground hover:text-destructive rounded border border-border hover:border-destructive/40 transition-colors"
                                      title="حذف"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  ) : (
                                    <span className="p-1.5 bg-muted text-muted-foreground/50 rounded border border-border cursor-not-allowed" title="استبيان غير قابل للحذف">
                                      <Ban className="h-4 w-4" />
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Inline editor (replaces /admin/polls/{id}/edit page) */}
                  {editingId && (
                    <Card className="mt-6 border-primary/30">
                      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Edit className="h-5 w-5 text-primary" />
                          {editingLoading ? 'جارٍ تحميل الاستبيان…' : `تحرير: ${editingPoll?.title ?? ''}`}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {editingPoll && (
                            <>
                              <a href={pollPublicUrl(editingPoll.slug)} target="_blank" rel="noreferrer">
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4 ml-1" />
                                  عرض
                                </Button>
                              </a>
                              <a href={pollLeaderboardUrl(editingPoll.slug)} target="_blank" rel="noreferrer">
                                <Button variant="outline" size="sm">
                                  <BarChart3 className="h-4 w-4 ml-1" />
                                  النتائج
                                </Button>
                              </a>
                            </>
                          )}
                          <Button variant="ghost" size="icon" onClick={closePollEditor} title="إغلاق">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {editingLoading || !editingPoll ? (
                          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            جارٍ تحميل بيانات الاستبيان…
                          </div>
                        ) : (
                          <>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="grid gap-2">
                                <Label htmlFor="edit-poll-title">العنوان</Label>
                                <Input
                                  id="edit-poll-title"
                                  value={editingPoll.title}
                                  onChange={e => setEditingPoll({ ...editingPoll, title: e.target.value })}
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="edit-poll-slug">المعرف (Slug)</Label>
                                <Input
                                  id="edit-poll-slug"
                                  value={editingPoll.slug}
                                  onChange={e => setEditingPoll({ ...editingPoll, slug: e.target.value })}
                                  className="text-left font-mono"
                                  dir="ltr"
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Switch
                                  id="edit-poll-active"
                                  checked={editingPoll.is_active}
                                  onCheckedChange={checked => setEditingPoll({ ...editingPoll, is_active: checked })}
                                />
                                <Label htmlFor="edit-poll-active">التصويت نشط</Label>
                              </div>
                              <Button onClick={handleSavePollMetadata} disabled={editingSaving}>
                                <Save className="h-4 w-4 ml-2" />
                                {editingSaving ? 'جاري الحفظ…' : 'حفظ الإعدادات'}
                              </Button>
                            </div>
                            <div className="border-t border-border pt-6">
                              <h3 className="font-bold mb-4">إدارة المجموعات والمرشحين</h3>
                              <AdminPollManager
                                pollId={editingId}
                                initialData={{ id: editingId, candidates: editingCandidates as any, groups: editingGroups as any }}
                                onRefresh={handleRefreshEditor}
                              />
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Inline create dialog (replaces /admin/polls/create page) */}
                  <Dialog open={createOpen} onOpenChange={(open) => {
                    setCreateOpen(open);
                    if (!open) {
                      const url = new URL(window.location.href);
                      url.searchParams.delete('create-poll');
                      url.searchParams.delete('create');
                      window.history.replaceState({}, '', url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''));
                    }
                  }}>
                    <DialogContent dir="rtl" className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>إنشاء استبيان جديد</DialogTitle>
                        <DialogDescription>
                          أنشئ الاستبيان هنا، ثم أضف المجموعات والمرشحين من نفس اللوحة.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleCreatePoll} className="space-y-4">
                        <div className="grid gap-2">
                          <Label htmlFor="create-poll-title">العنوان</Label>
                          <Input
                            id="create-poll-title"
                            placeholder="مثال: تقييم الأداء الحكومي"
                            value={createTitle}
                            onChange={e => setCreateTitle(e.target.value)}
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="create-poll-slug">المعرف (Slug)</Label>
                          <Input
                            id="create-poll-slug"
                            placeholder="مثال: govt-2025"
                            value={createSlug}
                            onChange={e => setCreateSlug(e.target.value)}
                            className="text-left font-mono"
                            dir="ltr"
                            required
                          />
                          <p className="text-[11px] text-muted-foreground">أحرف لاتينية صغيرة وأرقام وشرطات فقط. يُستخدم في رابط صفحة التصويت.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            id="create-poll-active"
                            checked={createActive}
                            onCheckedChange={setCreateActive}
                          />
                          <Label htmlFor="create-poll-active">تفعيل الاستبيان فور الإنشاء</Label>
                        </div>
                        <DialogFooter className="flex-row-reverse gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>إلغاء</Button>
                          <Button type="submit" size="sm" disabled={creating || !createTitle.trim() || !createSlug.trim()}>
                            {creating ? 'جاري الإنشاء…' : 'إنشاء ومتابعة التحرير'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              {/* PROFILE TAB */}
              {activeTab === 'profile' && (
                <div>
                  <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <Settings className="text-primary h-6 w-6" />
                    إعدادات الحساب الشخصي
                  </h2>

                  <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-lg mb-8 pb-8 border-b border-border">
                    <AvatarUploader user={auth.user} />

                    {profileMessage && (
                      <div className={cn(
                        'p-4 rounded-lg text-sm',
                        profileMessage.type === 'success' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/15 text-destructive'
                      )}>
                        {profileMessage.text}
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <Label className="text-sm font-bold text-muted-foreground">اسم المستخدم</Label>
                      <Input
                        type="text"
                        value={profileName}
                        onChange={e => setProfileName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label className="text-sm font-bold text-muted-foreground">البريد الإلكتروني</Label>
                      <Input
                        type="email"
                        value={profileEmail}
                        onChange={e => setProfileEmail(e.target.value)}
                        required
                      />
                    </div>

                    <Button type="submit" disabled={profileLoading}>
                      {profileLoading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                    </Button>
                  </form>

                  {/* Scary Red Delete Section */}
                  <div className="bg-destructive/10 border border-destructive/40 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-destructive mb-2">منطقة الخطر - حذف الحساب نهائياً</h3>
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                      حذف حسابك سيمسح هويتك من المنصة تماماً.{' '}
                      <span className="font-bold text-destructive">ولكن، لن يتم مسح اقتراحات مسارات خطوط النقل أو الاستبيانات التي قمت بإنشائها</span>؛ حيث سيتم تفويضها فوراً وبشكل آمن إلى حساب الإدارة العامة (Superadmin) كأرشيف عام لتجنب تعطيل الخدمة للمواطنين.
                    </p>
                    <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
                      حذف الحساب نهائياً
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Rejection Reason Modal */}
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent dir="rtl" className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة سبب الرفض الاقتراح</DialogTitle>
              <DialogDescription>
                يرجى كتابة شرح توضيحي لسبب رفض هذا المسار لمساعدة المساهم على تصحيحه وإعادة اقتراحه.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="اكتب سبب الرفض هنا..."
              rows={4}
            />
            <DialogFooter className="flex-row-reverse gap-2">
              <Button variant="outline" size="sm" onClick={() => setRejectOpen(false)}>إلغاء</Button>
              <Button variant="destructive" size="sm" disabled={rejectLoading} onClick={handleConfirmReject}>
                {rejectLoading ? 'جاري التحديث...' : 'تأكيد الرفض'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Account Confirmation Modal */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent dir="rtl" className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-6 w-6" />
                تأكيد حذف الحساب نهائياً؟
              </DialogTitle>
              <DialogDescription>
                أنت على وشك تعطيل وحذف حسابك من Syrian Zone. سيتم إخفاء جميع بياناتك الشخصية من العلن. كما سيتم تفويض كافة استبياناتك ومساراتك المنشورة إلى المدير العام (Superadmin) بشكل آمن.
              </DialogDescription>
            </DialogHeader>
            <p className="text-xs text-destructive font-bold">لا يمكن التراجع عن هذا الإجراء بمجرد تأكيده.</p>
            <DialogFooter className="flex-row-reverse gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(false)}>إلغاء وتراجع</Button>
              <Button variant="destructive" size="sm" disabled={deleteLoading} onClick={handleDeleteAccount}>
                {deleteLoading ? 'جاري حذف الحساب...' : 'تأكيد الحذف نهائياً'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
