<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Models\GovtOfficial;
use App\Services\GovtCvs\GovtCvVocabulary;
use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Og\RecordCard;
use App\Support\Seo\Preview\Arabic;
use App\Support\Seo\Preview\DescribesCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;

/** /govtcvs/{slug}: one published government official profile. */
final class GovtOfficialPreview implements CardSource, PreviewResolver
{
    use DescribesCards;

    /**
     * Label, pill tone and glyph per office status from resources/data/govtcvs.json.
     *
     * @return array<string, array{0: string, 1: string, 2: string}>
     */
    public static function states(): array
    {
        return GovtCvVocabulary::officeStatusCardStates();
    }

    public static function cardType(): string
    {
        return 'govtcv';
    }

    public static function fallbackCard(): string
    {
        return 'govtcvs';
    }

    public function resolve(Request $request, string $path): ?Preview
    {
        if (! preg_match('#^/govtcvs/([a-z0-9-]+)$#', $path, $m) || $m[1] === 'movements') {
            return null;
        }

        $slug = $m[1];
        $official = SeoMeta::remembered($request, 'govtcv') ?? $this->find($slug);
        if ($official === null) {
            return null;
        }

        $displayName = $official->display_name_ar ?: $official->full_name_ar;
        $primaryTenure = $official->tenures->firstWhere('status', 'current') ?? $official->tenures->first();
        $roleTitle = $primaryTenure?->role_title_ar;
        $institutionName = $primaryTenure?->institution?->name_ar
            ?: $primaryTenure?->institution?->name
            ?: $primaryTenure?->institution_name_ar;

        $titleParts = array_filter([$displayName, $roleTitle]);
        $pageTitle = implode(' — ', $titleParts).' | السير الذاتية للمسؤولين';

        $descriptionSource = $official->bio_summary_ar
            ?: implode(' · ', array_filter([
                $official->full_name_ar,
                $roleTitle,
                $institutionName,
            ]));
        $description = Arabic::excerpt($descriptionSource);

        return new Preview(
            title: $pageTitle,
            shareTitle: implode(' — ', $titleParts),
            description: $description,
            canonicalPath: '/govtcvs/'.$official->slug,
            image: $this->describe($official)->url(),
            type: 'profile',
            schema: 'ProfilePage',
            parent: ['/govtcvs', 'السير الذاتية للمسؤولين'],
            published: $official->published_at,
            modified: $official->updated_at,
            mainEntity: $this->personEntity($official, $displayName, $roleTitle, $institutionName, $description),
        );
    }

    public function card(string $key): ?RecordCard
    {
        if ($key === '' || $key === 'movements' || ! preg_match('/^[a-z0-9-]+$/', $key)) {
            return null;
        }

        $official = $this->find($key);

        return $official === null ? null : $this->describe($official);
    }

    private function find(string $slug): ?GovtOfficial
    {
        return GovtOfficial::published()
            ->where('slug', $slug)
            ->with(['tenures.institution', 'aliases', 'candidate', 'officialEntity', 'promiseSpeaker', 'houseMember'])
            ->first();
    }

    /**
     * Build the Schema.org `Person` node for `ProfilePage.mainEntity`.
     *
     * @return array<string, mixed>
     */
    private function personEntity(
        GovtOfficial $official,
        string $displayName,
        ?string $roleTitle,
        ?string $institutionName,
        string $description,
    ): array {
        $primaryName = trim((string) ($official->full_name_ar ?: $displayName));

        $alternateCandidates = [];
        if (filled($official->display_name_ar)) {
            $alternateCandidates[] = trim((string) $official->display_name_ar);
        }
        if (filled($official->full_name_en)) {
            $alternateCandidates[] = trim((string) $official->full_name_en);
        }
        if ($official->relationLoaded('aliases')) {
            foreach ($official->aliases->take(5) as $alias) {
                if (filled($alias->alias_ar)) {
                    $alternateCandidates[] = trim((string) $alias->alias_ar);
                }
            }
        }

        $alternateNames = array_values(array_unique(array_filter(
            $alternateCandidates,
            fn (string $name): bool => $name !== '' && $name !== $primaryName,
        )));

        $sameAs = [];
        foreach ($official->resolvedSocials() as $url) {
            if (! is_string($url)) {
                continue;
            }
            $trimmed = trim($url);
            if ((str_starts_with($trimmed, 'https://') || str_starts_with($trimmed, 'http://'))
                && filter_var($trimmed, FILTER_VALIDATE_URL) !== false) {
                $sameAs[] = $trimmed;
            }
        }
        $sameAs = array_values(array_unique($sameAs));

        return array_filter([
            '@type' => 'Person',
            'name' => $primaryName,
            'alternateName' => $alternateNames !== [] ? $alternateNames : null,
            'jobTitle' => filled($roleTitle) ? $roleTitle : null,
            'worksFor' => filled($institutionName) ? [
                '@type' => 'GovernmentOrganization',
                'name' => $institutionName,
            ] : null,
            'description' => $description !== '' ? $description : null,
            'image' => $official->resolvedPortrait(),
            'sameAs' => $sameAs !== [] ? $sameAs : null,
        ], fn (mixed $value): bool => $value !== null && $value !== '' && $value !== []);
    }

    private function describe(GovtOfficial $official): RecordCard
    {
        $states = self::states();
        [$statusLabel, $tone, $glyph] = $states[$official->office_status] ?? $states['in_office'] ?? ['في المنصب', 'primary', 'BadgeCheck'];

        $tierLabel = GovtCvVocabulary::label('tiers', $official->highest_tier);
        $completenessLabel = GovtCvVocabulary::label('cv_completeness', $official->cv_completeness);

        $pills = [
            ['label' => $statusLabel, 'tone' => $tone, 'glyph' => $glyph],
        ];
        if ($tierLabel) {
            $pills[] = ['label' => $tierLabel];
        }
        if ($completenessLabel) {
            $pills[] = ['label' => $completenessLabel];
        }

        $primaryTenure = $official->tenures->firstWhere('status', 'current') ?? $official->tenures->first();
        $institution = $primaryTenure?->institution?->name_ar
            ?: $primaryTenure?->institution?->name
            ?: $primaryTenure?->institution_name_ar;
        $role = implode(' · ', array_filter([$primaryTenure?->role_title_ar, $institution]));

        $displayName = $official->display_name_ar ?: $official->full_name_ar;

        $model = [
            'kind' => 'split',
            'url' => $this->address('/govtcvs/'.$official->slug),
            'kicker' => ['icon' => 'govtcvs', 'label' => 'السير الذاتية للمسؤولين'],
            'pills' => $pills,
            'title' => $role !== '' ? $displayName.' — '.$role : $displayName,
            'person' => array_filter([
                'name' => $official->full_name_ar,
                'role' => $role ?: $tierLabel,
                'image' => $official->resolvedPortrait(),
            ]),
        ];

        return new RecordCard(self::cardType(), $official->slug, $model);
    }
}
