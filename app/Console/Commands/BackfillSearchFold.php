<?php

namespace App\Console\Commands;

use App\Support\SearchFold;
use Illuminate\Console\Command;

/**
 * Re-fold the stored `*_fold` search columns.
 *
 * The columns are written when a row is saved, so this is only needed after the
 * fold rules themselves change (`ArabicSearch::fold()`): existing rows still
 * carry the fold the old rules produced. It is chunked and idempotent, so a
 * re-run writes nothing, and it never touches `updated_at`.
 */
class BackfillSearchFold extends Command
{
    protected $signature = 'search:backfill-fold {--table= : Only this table}';

    protected $description = 'Recompute the stored *_fold search columns';

    public function handle(): int
    {
        $table = $this->option('table');

        if ($table !== null && SearchFold::columnsFor($table) === []) {
            $this->error(sprintf(
                'No folded columns for %s. Known tables: %s.',
                $table,
                implode(', ', array_keys(SearchFold::COLUMNS)),
            ));

            return self::FAILURE;
        }

        $written = SearchFold::backfill($table);

        $this->info(sprintf('%d row(s) re-folded.', $written));

        return self::SUCCESS;
    }
}
