<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Where the Arabic fold is stored.
 *
 * A `LIKE '%…%'` search over a runtime expression cannot use an index and
 * re-folds every row on every keystroke, so each searched Arabic text column
 * gets a `*_fold` twin: written by `App\Models\Concerns\FoldsSearchColumns` on
 * save, filled for existing rows by the migration that adds the columns, and
 * rebuilt by `search:backfill-fold` after a rule change in
 * `ArabicSearch::fold()`.
 *
 * `COLUMNS` is the one list of what is stored folded: the trait and the
 * backfill both read it, so a table cannot be given a fold column and then be
 * forgotten by the writers. Only Arabic text is listed — an English or numeric
 * column is matched with the raw pattern.
 */
final class SearchFold
{
    /** Searched Arabic text column per table. */
    public const COLUMNS = [
        'routes' => ['name_ar'],
        'stops' => ['name_ar'],
        'places' => ['name', 'description'],
        'phonebook_entries' => ['name_ar'],
        'official_entities' => ['name_ar', 'description_ar'],
        'gov_apps' => ['name_ar', 'description_ar'],
    ];

    /** The fold column that stores `$column`. */
    public static function column(string $column): string
    {
        return $column.'_fold';
    }

    /**
     * The searched Arabic columns of `$table`.
     *
     * @return array<int, string>
     */
    public static function columnsFor(string $table): array
    {
        return self::COLUMNS[$table] ?? [];
    }

    /**
     * Re-fold every row of one table or of all of them, in id order.
     *
     * Idempotent: a row whose fold columns already match is left untouched, so
     * a re-run writes nothing. Only the fold columns are written — `updated_at`
     * stays as it was, because re-folding is not an edit of the row (the
     * sitemap's lastmod reads it).
     *
     * A table or column that does not exist yet is skipped: the migration that
     * added the first ones calls this, and a later rule change adds more.
     *
     * @return int Number of rows written.
     */
    public static function backfill(?string $table = null): int
    {
        $written = 0;

        foreach ($table === null ? array_keys(self::COLUMNS) : [$table] as $name) {
            $written += self::backfillTable($name);
        }

        return $written;
    }

    private static function backfillTable(string $table): int
    {
        if (! Schema::hasTable($table)) {
            return 0;
        }

        $columns = array_values(array_filter(
            self::columnsFor($table),
            fn (string $column): bool => Schema::hasColumn($table, $column)
                && Schema::hasColumn($table, self::column($column)),
        ));

        if ($columns === []) {
            return 0;
        }

        $foldColumns = array_map(self::column(...), $columns);
        $written = 0;

        DB::table($table)
            ->select(['id', ...$columns, ...$foldColumns])
            ->orderBy('id')
            ->chunkById(500, function ($rows) use ($table, $columns, $foldColumns, &$written): void {
                foreach ($rows as $row) {
                    $folds = [];

                    foreach ($columns as $column) {
                        $value = $row->{$column};
                        $folds[self::column($column)] = $value === null
                            ? null
                            : ArabicSearch::fold((string) $value);
                    }

                    $stale = array_filter(
                        $foldColumns,
                        fn (string $fold): bool => ($row->{$fold} ?? null) !== $folds[$fold],
                    );

                    if ($stale === []) {
                        continue;
                    }

                    DB::table($table)->where('id', $row->id)->update($folds);
                    $written++;
                }
            });

        return $written;
    }
}
