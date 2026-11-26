<?php

namespace App\Http\Controllers;

use App\Services\Ministries\MinistryDirectoryService;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Public hub and per-ministry pages (`/ministries` and `/ministries/{slug}`):
 * current cabinet, four-era government timeline, mergers & splits, official
 * accounts, gov apps, and related promises.
 */
class MinistryController extends Controller
{
    public function __construct(
        private readonly MinistryDirectoryService $directory,
    ) {}

    public function index(): Response
    {
        return Inertia::render('Ministries/Index', $this->directory->indexPayload());
    }

    public function show(string $slug): Response
    {
        $payload = $this->directory->showPayload($slug);
        abort_if($payload === null, 404);

        return Inertia::render('Ministries/Show', $payload);
    }
}
