<?php

namespace App\Support\Seo\Og;

/**
 * The share card of one record: what to draw, and the address it is served at.
 *
 * `model` is the description the renderer draws (see scripts/og/lib/cards.mjs).
 * Images in it are still plain URLs here; they are fetched when the card is
 * actually drawn, so building a RecordCard for a page view costs no I/O.
 */
final readonly class RecordCard
{
    /**
     * @param  array<string, mixed>  $model
     * @param  'png'|'jpg'  $format  photographs are served as JPEG to stay small
     */
    public function __construct(
        public string $type,
        public string $key,
        public array $model,
        public string $format = 'png',
    ) {}

    /**
     * Changes whenever the card would look different: any field of the record
     * shown on it, or the templates and artwork every card is drawn from.
     */
    public function version(): string
    {
        $model = json_encode($this->model, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return substr(sha1($model.'|'.StaticCards::recipe()), 0, 10);
    }

    /** Site-relative, versioned URL of the card. */
    public function url(): string
    {
        return sprintf('/og/r/%s/%s.%s?v=%s', $this->type, $this->key, $this->format, $this->version());
    }
}
