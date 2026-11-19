<?php

namespace App\Services\GovtCvs;

use App\Support\Facts;

/**
 * Single source of truth for the Government CVs (`السير الذاتية للمسؤولين`)
 * vocabularies, reading `resources/data/govtcvs.json` via `Facts::json('govtcvs')`.
 */
final class GovtCvVocabulary
{
    /**
     * @return array<string, mixed>
     */
    public static function all(): array
    {
        /** @var array<string, mixed> $data */
        $data = Facts::json('govtcvs');

        return $data;
    }

    public static function cutoffDate(): string
    {
        return (string) (self::all()['cutoff_date'] ?? '2024-12-08');
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function list(string $name): array
    {
        /** @var array<int, array<string, mixed>> $items */
        $items = self::all()[$name] ?? [];

        return $items;
    }

    /**
     * @return array<int, string>
     */
    public static function keys(string $name): array
    {
        return array_values(array_column(self::list($name), 'key'));
    }

    /**
     * @return array<string, string>
     */
    public static function labels(string $name): array
    {
        return array_column(self::list($name), 'label', 'key');
    }

    public static function label(string $name, ?string $key): ?string
    {
        if ($key === null || $key === '') {
            return null;
        }

        return self::labels($name)[$key] ?? $key;
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function item(string $name, ?string $key): ?array
    {
        if ($key === null || $key === '') {
            return null;
        }

        foreach (self::list($name) as $entry) {
            if (($entry['key'] ?? null) === $key) {
                return $entry;
            }
        }

        return null;
    }

    /** @return array<int, string> */
    public static function officeStatuses(): array
    {
        return self::keys('office_statuses');
    }

    /** @return array<int, string> */
    public static function tiers(): array
    {
        return self::keys('tiers');
    }

    /**
     * Numeric priority rank per tier (lower = higher seniority).
     *
     * @return array<string, int>
     */
    public static function tierRanks(): array
    {
        $ranks = [];
        foreach (self::list('tiers') as $index => $tier) {
            $ranks[(string) $tier['key']] = (int) ($tier['rank'] ?? ($index + 1));
        }

        return $ranks;
    }

    public static function tierRank(?string $tier): int
    {
        if ($tier === null) {
            return 999;
        }

        return self::tierRanks()[$tier] ?? 999;
    }

    /** @return array<int, string> */
    public static function governmentPhases(): array
    {
        return self::keys('government_phases');
    }

    /** @return array<int, string> */
    public static function tenureStatuses(): array
    {
        return self::keys('tenure_statuses');
    }

    /** @return array<int, string> */
    public static function endReasons(): array
    {
        return self::keys('end_reasons');
    }

    /** @return array<int, string> */
    public static function cvSections(): array
    {
        return self::keys('cv_sections');
    }

    /** @return array<int, string> */
    public static function cvCompleteness(): array
    {
        return self::keys('cv_completeness');
    }

    /** @return array<int, string> */
    public static function evidenceTypes(): array
    {
        return self::keys('evidence_types');
    }

    /** @return array<int, string> */
    public static function publishStatuses(): array
    {
        return self::keys('publish_statuses');
    }

    /** @return array<int, string> */
    public static function verificationLevels(): array
    {
        return self::keys('verification_levels');
    }

    /** @return array<int, string> */
    public static function aliasTypes(): array
    {
        return self::keys('alias_types');
    }

    /** @return array<int, string> */
    public static function datePrecisions(): array
    {
        $keys = self::keys('date_precisions');

        return $keys !== [] ? $keys : ['exact', 'month', 'year', 'first_seen', 'inferred_successor'];
    }

    /** @return array<int, string> */
    public static function slotStatuses(): array
    {
        $keys = self::keys('slot_statuses');

        return $keys !== [] ? $keys : ['active', 'merged', 'abolished'];
    }

    /**
     * Map of office_status => [label, card_tone, glyph] for OG preview cards.
     *
     * @return array<string, array{0: string, 1: string, 2: string}>
     */
    public static function officeStatusCardStates(): array
    {
        $out = [];
        foreach (self::list('office_statuses') as $entry) {
            $out[(string) $entry['key']] = [
                (string) $entry['label'],
                (string) ($entry['card_tone'] ?? 'primary'),
                (string) ($entry['glyph'] ?? 'BadgeCheck'),
            ];
        }

        return $out;
    }
}
