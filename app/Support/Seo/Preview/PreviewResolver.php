<?php

namespace App\Support\Seo\Preview;

use Illuminate\Http\Request;

/**
 * Describes one kind of database-backed page (a promise, a poll, a place...).
 *
 * This is the one place a record type's title, description, canonical URL and
 * share card are decided. To give a new kind of page its own link preview,
 * write a resolver and add it to Previews::RESOLVERS.
 */
interface PreviewResolver
{
    /**
     * The preview for this request, or null when the request is not one of this
     * resolver's pages or the record does not exist or is not public.
     *
     * @param  string  $path  the request path, with a leading slash
     */
    public function resolve(Request $request, string $path): ?Preview;
}
