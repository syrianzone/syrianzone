<?php

namespace App\Models\Concerns;

use App\Support\ArabicSearch;
use App\Support\SearchFold;
use Illuminate\Database\Eloquent\Model;

/**
 * Keeps the `*_fold` search columns in step with the Arabic text they fold.
 *
 * Every writer (admin panel, import, MCP tool, seeder, moderation service) goes
 * through the model, so filling the fold on `saving` means no call site has to
 * know the column exists. `SearchFold::COLUMNS` decides which columns a table
 * folds.
 */
trait FoldsSearchColumns
{
    public static function bootFoldsSearchColumns(): void
    {
        static::saving(function (Model $model): void {
            foreach (SearchFold::columnsFor($model->getTable()) as $column) {
                $value = $model->getAttribute($column);
                // setAttribute, not fill: a fold column is derived, so it is in
                // no model's $fillable.
                $model->setAttribute(
                    SearchFold::column($column),
                    $value === null ? null : ArabicSearch::fold((string) $value),
                );
            }
        });
    }
}
