<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Support\HouseMembers;
use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Og\RecordCard;
use App\Support\Seo\Preview\Arabic;
use App\Support\Seo\Preview\DescribesCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use Illuminate\Http\Request;

/** /house/members/{member_number}: profile page for one 2026 Syrian People's Assembly member. */
final class HouseMemberPreview implements CardSource, PreviewResolver
{
    use DescribesCards;

    public static function cardType(): string
    {
        return 'house-member';
    }

    public static function fallbackCard(): string
    {
        return 'house';
    }

    public function resolve(Request $request, string $path): ?Preview
    {
        if (! preg_match('#^/house/members/([0-9]+)$#', $path, $m)) {
            return null;
        }

        $member = HouseMembers::find($m[1]);
        if ($member === null) {
            return null;
        }

        $roleWord = ($member['gender'] ?? '') === 'F' ? 'عضوة' : 'عضو';
        $govName = (string) ($member['governorate_display_ar'] ?: $member['governorate_ar']);
        $shareTitle = "{$member['name_ar']} — {$roleWord} مجلس الشعب السوري عن محافظة {$govName}";

        $details = array_filter([
            $member['management_position'] !== '' ? $member['management_position'] : null,
            $member['district'] !== '' ? "الدائرة: {$member['district']}" : null,
            $member['selection_method'] !== '' ? "طريقة التعيين: {$member['selection_method']}" : null,
            $member['category'] !== '' ? "الفئة: {$member['category']}" : null,
        ]);
        $description = Arabic::excerpt(
            $shareTitle.($details !== [] ? ' — '.implode(' · ', $details) : '').'. البيانات من مركز عمران للدراسات الاستراتيجية.',
        );

        return new Preview(
            title: $shareTitle.' | مجلس الشعب 2026',
            shareTitle: $shareTitle,
            description: $description,
            canonicalPath: '/house/members/'.$member['member_number'],
            image: $this->describe($member)->url(),
            type: 'profile',
            schema: 'ProfilePage',
            parent: ['/house', 'مجلس الشعب السوري 2026'],
            mainEntity: $this->personEntity($member, $roleWord, $description),
        );
    }

    public function card(string $key): ?RecordCard
    {
        $member = HouseMembers::find($key);

        return $member === null ? null : $this->describe($member);
    }

    /**
     * @param  array<string, mixed>  $member
     * @return array<string, mixed>
     */
    private function personEntity(array $member, string $roleWord, string $description): array
    {
        $sameAs = [];
        foreach ([$member['facebook_url'] ?? '', $member['twitter_url'] ?? ''] as $url) {
            $trimmed = trim((string) $url);
            if ($trimmed !== ''
                && (str_starts_with($trimmed, 'https://') || str_starts_with($trimmed, 'http://'))
                && filter_var($trimmed, FILTER_VALIDATE_URL) !== false) {
                $sameAs[] = $trimmed;
            }
        }

        return array_filter([
            '@type' => 'Person',
            'name' => $member['name_ar'],
            'jobTitle' => $member['management_position'] !== '' ? $member['management_position'] : "{$roleWord} مجلس الشعب السوري",
            'memberOf' => [
                '@type' => 'GovernmentOrganization',
                'name' => 'مجلس الشعب السوري',
            ],
            'description' => $description !== '' ? $description : null,
            'sameAs' => $sameAs !== [] ? array_values(array_unique($sameAs)) : null,
        ], fn (mixed $value): bool => $value !== null && $value !== '' && $value !== []);
    }

    /** @param  array<string, mixed>  $member */
    private function describe(array $member): RecordCard
    {
        $govName = (string) ($member['governorate_display_ar'] ?: $member['governorate_ar']);
        $roleWord = ($member['gender'] ?? '') === 'F' ? 'عضوة' : 'عضو';

        $pills = [
            ['label' => $govName, 'glyph' => 'MapPin'],
        ];
        if (($member['selection_method'] ?? '') !== '') {
            $pills[] = ['label' => (string) $member['selection_method']];
        }

        $subtitleParts = array_filter([
            $member['management_position'] !== '' ? $member['management_position'] : "{$roleWord} مجلس الشعب السوري",
            $member['district'] !== '' ? $member['district'] : null,
        ]);

        return new RecordCard(self::cardType(), (string) $member['member_number'], [
            'kind' => 'split',
            'url' => $this->address('/house/members/'.$member['member_number']),
            'kicker' => ['icon' => 'house', 'label' => 'مجلس الشعب 2026'],
            'pills' => $pills,
            'title' => (string) $member['name_ar'],
            'subtitle' => implode(' · ', $subtitleParts),
            'art' => ['type' => 'icon', 'icon' => 'house'],
        ]);
    }
}
