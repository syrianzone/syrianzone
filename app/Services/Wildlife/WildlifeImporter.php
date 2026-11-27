<?php

namespace App\Services\Wildlife;

use App\Models\WildlifeSpecies;
use App\Support\Facts;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Moves species between resources/data/wildlife.json and the `wildlife_species`
 * table. The table is the source of truth; the file is the seed a fresh
 * database starts from and a reviewable snapshot of what is published.
 */
final class WildlifeImporter
{
    public function __construct(
        private readonly WildlifeRules $rules,
        private readonly WildlifeData $data,
    ) {}

    /**
     * Load the seed file as published species, when the table is empty.
     * Refuses a seed that breaks the rules rather than publishing it.
     *
     * @return int how many species were imported
     */
    public function importIfEmpty(): int
    {
        if (WildlifeSpecies::query()->exists()) {
            return 0;
        }

        $species = Facts::json('wildlife')['species'] ?? [];
        foreach ($species as $record) {
            $errors = $this->rules->errors($record);
            if ($errors !== []) {
                throw new RuntimeException('resources/data/wildlife.json: '.($record['slug'] ?? '?').': '.implode(' ', $errors));
            }
        }

        DB::transaction(function () use ($species) {
            foreach (array_values($species) as $position => $record) {
                WildlifeSpecies::create([
                    'slug' => $record['slug'],
                    'position' => $position,
                    'record' => $record,
                    'is_hidden' => false,
                    'version' => 1,
                    'published_at' => now(),
                ]);
            }
        });
        $this->data->forget();

        return count($species);
    }

    /**
     * The seed file rewritten with what is published now, keeping its `meta`.
     * Drafts and hidden species are left out: the file is what the public sees.
     */
    public function exportJson(): string
    {
        $file = Facts::json('wildlife');
        $file['species'] = $this->data->all();

        return json_encode($file, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n";
    }
}
