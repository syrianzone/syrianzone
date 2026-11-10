<?php

namespace App\Support\Seo\Preview;

/** Bits every resolver needs when it describes a card to the renderer. */
trait DescribesCards
{
    /** The address printed in a card's corner: the public host plus a path. */
    protected function address(string $path = ''): string
    {
        $host = parse_url((string) config('seo.base_url'), PHP_URL_HOST) ?: 'syrian.zone';

        return $host.($path === '/' ? '' : $path);
    }
}
