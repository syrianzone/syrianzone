<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Where a promise was said or reported. One statement may have many.
 *
 * The types are the record's: `resources/data/promises.json` holds them with
 * their Arabic labels, read through `Facts::promiseSourceTypes()`. This constant
 * is the validation mirror the importer and the MCP tools call;
 * `tests/Feature/PromiseVocabularyTest.php` fails when the two disagree.
 */
class PromiseSource extends Model
{
    public const TYPES = [
        'x_post', 'facebook_post', 'telegram_post', 'tv_interview', 'press_conference',
        'official_statement', 'news_article', 'video',
    ];

    protected $fillable = [
        'promise_id', 'url', 'outlet', 'type', 'published_date', 'language',
        'archive_url', 'screenshot_url', 'video_timestamp', 'is_primary', 'sort',
    ];

    protected $casts = [
        'published_date' => 'date:Y-m-d',
        'is_primary' => 'boolean',
        'sort' => 'integer',
    ];

    public function promise(): BelongsTo
    {
        return $this->belongsTo(Promise::class);
    }

    /** @return array<string, mixed> */
    public function toPayload(): array
    {
        return [
            'id' => $this->id,
            'url' => $this->url,
            'outlet' => $this->outlet,
            'type' => $this->type,
            'publishedDate' => $this->published_date?->format('Y-m-d'),
            'language' => $this->language,
            'archiveUrl' => $this->archive_url,
            'screenshotUrl' => $this->screenshot_url,
            'videoTimestamp' => $this->video_timestamp,
            'isPrimary' => (bool) $this->is_primary,
        ];
    }
}
