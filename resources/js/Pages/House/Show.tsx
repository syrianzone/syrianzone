import { Link } from '@inertiajs/react';
import { ArrowRight, ChevronLeft, ExternalLink, MapPin, Users } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Facebook, Twitter } from '@/Components/ui/icons';
import { OMran_SOURCE_URL, type Member2026 } from './members2026';

interface HouseMemberRecord extends Member2026 {
    governorate_display_ar?: string;
}

interface SameGovernoratePeer {
    member_number: string;
    name_ar: string;
    district: string;
    management_position: string;
    selection_method: string;
}

interface HouseShowProps {
    member: HouseMemberRecord;
    sameGovernorateMembers?: SameGovernoratePeer[];
    sourceUrl?: string;
}

const STATUS_LABEL: Record<string, string> = {
    active: 'نشط',
    resigned: 'مستقيل',
    dead: 'متوفى',
    inactive: 'غير نشط',
};

function safeExternalUrl(raw?: string | null): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

export default function HouseMemberShow({
    member,
    sameGovernorateMembers = [],
    sourceUrl = OMran_SOURCE_URL,
}: HouseShowProps) {
    const govName = member.governorate_display_ar || member.governorate_ar;
    const isFemale = member.gender === 'F';
    const roleLabel = isFemale ? 'عضوة مجلس الشعب السوري' : 'عضو مجلس الشعب السوري';
    const genderLabel = isFemale ? 'أنثى' : member.gender === 'M' ? 'ذكر' : '';
    const statusLabel = STATUS_LABEL[member.status] ?? member.status;

    const facebookUrl = safeExternalUrl(member.facebook_url);
    const twitterUrl = safeExternalUrl(member.twitter_url);

    const facts: Array<{ label: string; value: string }> = [
        { label: 'المحافظة', value: govName },
        member.district ? { label: 'المنطقة / الدائرة', value: member.district } : null,
        member.town ? { label: 'البلدة / القرية', value: member.town } : null,
        member.selection_method ? { label: 'طريقة الاختيار', value: member.selection_method } : null,
        member.category ? { label: 'الفئة', value: member.category } : null,
        member.management_position ? { label: 'المنصب الإداري', value: member.management_position } : null,
        { label: 'رقم العضوية', value: member.member_number },
        statusLabel ? { label: 'الحالة', value: statusLabel } : null,
        genderLabel ? { label: 'الجنس', value: genderLabel } : null,
        member.birth_year ? { label: 'سنة الميلاد (بحسب المصدر)', value: member.birth_year } : null,
        member.age ? { label: 'العمر عند النشر', value: `${member.age} عاماً` } : null,
    ].filter((item): item is { label: string; value: string } => item !== null && item.value !== '');

    return (
        <MainLayout>
            <div className="min-h-screen bg-background pb-16">
                <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
                    <nav
                        aria-label="مسار التنقل"
                        className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
                    >
                        <Link href="/" className="hover:text-foreground">
                            الرئيسية
                        </Link>
                        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <Link href="/house" className="hover:text-foreground">
                            أعضاء مجلس الشعب السوري 2026
                        </Link>
                        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="font-medium text-foreground" aria-current="page">
                            {member.name_ar}
                        </span>
                    </nav>

                    <Card className="border-border bg-card">
                        <CardContent className="space-y-5 p-6 sm:p-8">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">مجلس الشعب السوري 2026</Badge>
                                <Badge variant="outline" className="gap-1">
                                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span>{govName}</span>
                                </Badge>
                                {member.selection_method && (
                                    <Badge variant="outline">{member.selection_method}</Badge>
                                )}
                                {member.management_position && (
                                    <Badge>{member.management_position}</Badge>
                                )}
                            </div>

                            <div className="space-y-2">
                                <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                                    {member.name_ar}
                                </h1>
                                <p className="text-base text-muted-foreground">
                                    {roleLabel} عن محافظة {govName}
                                    {member.district ? ` (${member.district})` : ''}
                                </p>
                            </div>

                            {(facebookUrl || twitterUrl) && (
                                <div className="flex flex-wrap items-center gap-3 pt-1">
                                    {facebookUrl && (
                                        <a
                                            href={facebookUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
                                        >
                                            <Facebook className="h-4 w-4" aria-hidden="true" />
                                            <span>فيسبوك</span>
                                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                        </a>
                                    )}
                                    {twitterUrl && (
                                        <a
                                            href={twitterUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
                                        >
                                            <Twitter className="h-4 w-4" aria-hidden="true" />
                                            <span>إكس (تويتر)</span>
                                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                        </a>
                                    )}
                                </div>
                            )}

                            <dl className="grid grid-cols-1 gap-3 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-3">
                                {facts.map((fact) => (
                                    <div key={fact.label} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                        <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                                        <dd className="mt-1 text-sm font-semibold text-foreground">{fact.value}</dd>
                                    </div>
                                ))}
                            </dl>

                            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4 text-sm">
                                <p className="text-muted-foreground">
                                    المصدر:{' '}
                                    <a
                                        href={sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-semibold text-primary underline"
                                    >
                                        مركز عمران للدراسات الاستراتيجية — المخطط التفاعلي لمجلس الشعب السوري 2026
                                    </a>
                                </p>
                                <Link
                                    href="/house"
                                    className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                                >
                                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                    <span>العودة إلى قائمة أعضاء مجلس الشعب 2026</span>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {sameGovernorateMembers.length > 0 && (
                        <Card className="border-border bg-card">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                                    <Users className="h-5 w-5 text-primary" aria-hidden="true" />
                                    <span>أعضاء آخرون عن محافظة {govName} ({sameGovernorateMembers.length})</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                    {sameGovernorateMembers.map((peer) => (
                                        <li key={peer.member_number}>
                                            <Link
                                                href={`/house/members/${peer.member_number}`}
                                                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 text-sm transition hover:border-primary/40 hover:bg-muted/30"
                                            >
                                                <span className="font-medium text-foreground">{peer.name_ar}</span>
                                                {(peer.management_position || peer.district) && (
                                                    <span className="shrink-0 text-xs text-muted-foreground">
                                                        {peer.management_position || peer.district}
                                                    </span>
                                                )}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
