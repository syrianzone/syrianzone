<?php

namespace App\Services\Wildlife;

use App\Support\Facts;
use App\Support\Seo\Preview\Resolvers\WildSpeciesPreview;

/**
 * The sourcing rules of docs/modules/wildlife.md that a machine can check,
 * applied to one species record. The editor runs them on every draft and again
 * on publish, and WildlifeDataTest runs them on the seed file, so there is one
 * statement of the rules for every way a record can enter the guide.
 *
 * What a machine cannot check (that a source really says what is cited, that
 * a hedge was kept) is the reviewer's job; that is why publishing is a
 * separate capability.
 */
final class WildlifeRules
{
    public const GROUPS = ['mammal', 'bird', 'reptile', 'amphibian', 'fish', 'invertebrate'];

    public const HABITATS = ['steppe', 'mountains', 'farmland', 'wetlands', 'coast'];

    public const SLUG = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

    /** CC0, public domain, and CC BY / BY-SA in any version or national port ("CC BY-SA 3.0 de"). */
    public const LICENSE = '/^(CC0 1\.0|Public domain|CC BY(-SA)? \d\.\d( [a-z]{2})?)$/';

    public const IUCN_URL = '#^https://www\.iucnredlist\.org/species/\d+/\d+$#';

    /** The Red List's "threatened" categories. */
    public const THREATENED = ['CR', 'EN', 'VU'];

    /** Statuses for which a species is gone from Syria. */
    public const GONE = ['possibly-extinct', 'extinct-in-syria'];

    /**
     * Every rule the record breaks, as sentences an editor or an agent can act
     * on. Empty when the record is valid.
     *
     * @param  array<string, mixed>  $record
     * @return list<string>
     */
    public function errors(array $record): array
    {
        $errors = [];
        $string = fn (string $key): bool => isset($record[$key]) && is_string($record[$key]) && trim($record[$key]) !== '';

        foreach (['slug', 'nameAr', 'nameEn', 'scientific', 'group', 'syriaStatus', 'summaryAr', 'lastReviewed'] as $key) {
            if (! $string($key)) {
                $errors[] = "{$key} is required and must be a non-empty string.";
            }
        }
        foreach (['subspecies', 'statusNoteAr', 'iucnNoteAr'] as $key) {
            if (array_key_exists($key, $record) && ! $string($key)) {
                $errors[] = "{$key}, when present, must be a non-empty string (omit it instead of sending an empty one).";
            }
        }

        if ($string('slug') && ! preg_match(self::SLUG, $record['slug'])) {
            $errors[] = 'slug must be lowercase English words joined by single dashes, e.g. "arabian-oryx".';
        }
        if ($string('group') && ! in_array($record['group'], self::GROUPS, true)) {
            $errors[] = 'group must be one of: '.implode(', ', self::GROUPS).'.';
        }
        $statuses = array_keys(WildSpeciesPreview::statusLabels());
        if ($string('syriaStatus') && ! in_array($record['syriaStatus'], $statuses, true)) {
            $errors[] = 'syriaStatus must be one of: '.implode(', ', $statuses).'.';
        }
        if ($string('lastReviewed')) {
            $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $record['lastReviewed']);
            if ($date === false || $date->format('Y-m-d') !== $record['lastReviewed']) {
                $errors[] = 'lastReviewed must be a date written YYYY-MM-DD.';
            } elseif ($date > new \DateTimeImmutable('tomorrow')) {
                $errors[] = 'lastReviewed cannot be in the future.';
            }
        }

        $errors = [...$errors, ...$this->listErrors($record), ...$this->iucnErrors($record), ...$this->imageErrors($record)];

        $sources = is_array($record['sources'] ?? null) ? $record['sources'] : [];
        if (count($sources) < 2) {
            $errors[] = 'sources must list at least two sources (the Red List assessment and at least one other).';
        }
        foreach ($sources as $i => $source) {
            if (! is_array($source) || trim((string) ($source['title'] ?? '')) === '' || ! str_starts_with((string) ($source['url'] ?? ''), 'https://')) {
                $errors[] = "sources[{$i}] needs a non-empty title and an https:// url.";
            }
        }

        return [...$errors, ...$this->citationErrors($record, count($sources))];
    }

    /**
     * @param  array<string, mixed>  $record
     * @return list<string>
     */
    private function listErrors(array $record): array
    {
        $errors = [];

        foreach (['altNamesAr', 'habitats', 'governorates'] as $key) {
            if (! is_array($record[$key] ?? null) || ! array_is_list($record[$key])) {
                $errors[] = "{$key} must be a list (it may be empty, except habitats).";

                continue;
            }
            foreach ($record[$key] as $value) {
                if (! is_string($value) || trim($value) === '') {
                    $errors[] = "{$key} may only hold non-empty strings.";

                    break;
                }
            }
        }

        $habitats = is_array($record['habitats'] ?? null) ? $record['habitats'] : [];
        if ($habitats === []) {
            $errors[] = 'habitats must name at least one habitat.';
        }
        foreach ($habitats as $habitat) {
            if (! in_array($habitat, self::HABITATS, true)) {
                $errors[] = 'habitats may only hold: '.implode(', ', self::HABITATS).'.';

                break;
            }
        }

        $known = array_column(Facts::governorates(), 'id');
        foreach (is_array($record['governorates'] ?? null) ? $record['governorates'] : [] as $id) {
            if (! in_array($id, $known, true)) {
                $errors[] = "governorates: \"{$id}\" is not a governorate id. Valid ids: ".implode(', ', $known).'.';
            }
        }

        return $errors;
    }

    /**
     * @param  array<string, mixed>  $record
     * @return list<string>
     */
    private function iucnErrors(array $record): array
    {
        $iucn = $record['iucn'] ?? null;
        if (! is_array($iucn)) {
            return ['iucn must be an object with category and url.'];
        }

        $errors = [];
        $categories = array_keys(WildSpeciesPreview::iucnLabels());
        if (! in_array($iucn['category'] ?? null, $categories, true)) {
            $errors[] = 'iucn.category must be one of: '.implode(', ', $categories).'.';
        }
        if (! preg_match(self::IUCN_URL, (string) ($iucn['url'] ?? ''))) {
            $errors[] = 'iucn.url must link the exact assessment: https://www.iucnredlist.org/species/{taxonId}/{assessmentId}.';
        }

        return $errors;
    }

    /**
     * @param  array<string, mixed>  $record
     * @return list<string>
     */
    private function imageErrors(array $record): array
    {
        $image = $record['image'] ?? null;
        if (! is_array($image)) {
            return ['image must be an object with commonsFile, author, license, licenseUrl, captionAr and r2Key.'];
        }

        $errors = [];
        $file = (string) ($image['commonsFile'] ?? '');
        if (trim($file) === '' || str_starts_with($file, 'File:')) {
            $errors[] = 'image.commonsFile must be the Commons file name without the "File:" prefix.';
        }
        if (trim((string) ($image['author'] ?? '')) === '') {
            $errors[] = 'image.author is required, copied exactly from the Commons file page.';
        }
        if (trim((string) ($image['captionAr'] ?? '')) === '') {
            $errors[] = 'image.captionAr is required, and says where the photo was taken when that was not Syria.';
        }
        $license = (string) ($image['license'] ?? '');
        if (! preg_match(self::LICENSE, $license)) {
            $errors[] = 'image.license must be CC0 1.0, Public domain, or a CC BY / CC BY-SA version, exactly as Commons writes it.';
        } elseif ($license === 'Public domain' && ($image['licenseUrl'] ?? null) !== null) {
            $errors[] = 'image.licenseUrl must be null for a public-domain photo.';
        } elseif ($license !== 'Public domain' && ! str_starts_with((string) ($image['licenseUrl'] ?? ''), 'https://')) {
            $errors[] = 'image.licenseUrl must be the https:// link of the license.';
        }
        if (! array_key_exists('r2Key', $image) || ($image['r2Key'] !== null && ! is_string($image['r2Key']))) {
            $errors[] = 'image.r2Key must be present: null until wildlife:mirror-images copies the photo.';
        }

        return $errors;
    }

    /**
     * Every statement cites at least one of the species' own sources.
     *
     * @param  array<string, mixed>  $record
     * @return list<string>
     */
    private function citationErrors(array $record, int $count): array
    {
        $errors = [];
        $statements = ['summaryAr' => [['text' => $record['summaryAr'] ?? '', 'sources' => $record['summarySources'] ?? null]]];
        foreach (['factsAr', 'threatsAr'] as $key) {
            if (! is_array($record[$key] ?? null) || ! array_is_list($record[$key])) {
                $errors[] = "{$key} must be a list of {text, sources} items.";

                continue;
            }
            $statements[$key] = $record[$key];
        }
        if (($statements['factsAr'] ?? []) === []) {
            $errors[] = 'factsAr must hold at least one fact.';
        }

        foreach ($statements as $key => $items) {
            foreach ($items as $i => $item) {
                $where = $key === 'summaryAr' ? 'summarySources' : "{$key}[{$i}]";
                if (! is_array($item) || ! is_string($item['text'] ?? null) || trim($item['text']) === '') {
                    $errors[] = "{$where}: the statement text is empty.";

                    continue;
                }
                $cited = $item['sources'] ?? null;
                if (! is_array($cited) || $cited === []) {
                    $errors[] = "{$where}: every statement must cite at least one source by its index.";

                    continue;
                }
                foreach ($cited as $index) {
                    if (! is_int($index) || $index < 0 || $index >= $count) {
                        $errors[] = "{$where}: source index ".json_encode($index).' does not exist (the species lists '.$count.' sources, indexed from 0).';
                    }
                }
            }
        }

        return $errors;
    }
}
