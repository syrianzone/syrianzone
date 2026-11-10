<?php

namespace App\Http\Controllers;

use App\Support\Seo\LlmsTxt;

class LlmsTxtController extends Controller
{
    /**
     * Serve /llms.txt. Built from constants and config only, so there is
     * nothing to cache on this side; the header lets the CDN keep it.
     */
    public function show(LlmsTxt $llms)
    {
        return response($llms->render(), 200)
            ->header('Content-Type', 'text/plain; charset=UTF-8')
            ->header('Cache-Control', 'public, max-age=3600');
    }
}
