<?php

namespace App\Support\Seo\Og;

/**
 * The result of drawing a card.
 *
 * `complete` is false when a photograph the card should show could not be
 * loaded and the card was drawn without it. Such a drawing is good enough to
 * serve, but must not be kept as the card's final version.
 */
final readonly class DrawnCard
{
    public function __construct(
        public string $bytes,
        public bool $complete = true,
    ) {}
}
