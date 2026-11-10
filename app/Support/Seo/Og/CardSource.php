<?php

namespace App\Support\Seo\Og;

/**
 * A kind of record that has a share card of its own, drawn on demand.
 *
 * Implemented by the PreviewResolver of that record type, so the text of a
 * preview and its image are built from the same lookup and cannot disagree.
 */
interface CardSource
{
    /** The type segment of the card URL: /og/r/{type}/{key}.png */
    public static function cardType(): string;

    /** The fixed-page card served when a record is unknown or drawing fails. */
    public static function fallbackCard(): string;

    /** The card of one record, or null when it does not exist or is not public. */
    public function card(string $key): ?RecordCard;
}
