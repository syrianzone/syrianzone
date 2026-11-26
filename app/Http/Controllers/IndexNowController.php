<?php

namespace App\Http\Controllers;

use App\Services\IndexNow\IndexNow;

class IndexNowController extends Controller
{
    /**
     * Serve the IndexNow ownership verification key file at /{key}.txt.
     *
     * Answers only when the requested filename matches the configured key
     * exactly; everything else returns 404. Outside the `web` middleware group
     * so no session cookie is attached.
     */
    public function key(string $key, IndexNow $indexNow)
    {
        $configured = $indexNow->key();

        abort_if($configured === '' || ! hash_equals($configured, $key), 404);

        return response($configured, 200)
            ->header('Content-Type', 'text/plain; charset=UTF-8')
            ->header('Cache-Control', 'public, max-age=3600');
    }
}
