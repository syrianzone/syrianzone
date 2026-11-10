<?php

namespace App\Support\Seo\Og;

/** A drawn card on disk, and whether it is the card's final drawing. */
final readonly class StoredCard
{
    public function __construct(
        public string $file,
        public bool $complete,
    ) {}
}
