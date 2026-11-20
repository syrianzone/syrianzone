<?php

namespace App\Http\Controllers;

use App\Services\Admin\IncomingSuggestionsOverviewService;
use Illuminate\Http\JsonResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Superadmin cross-section inbox aggregating incoming suggestions, community
 * submissions, reports, and drafts from every module in one place.
 */
class IncomingSuggestionsAdminController extends Controller
{
    public function __construct(
        private readonly IncomingSuggestionsOverviewService $overview,
    ) {}

    public function renderIndex(): Response
    {
        return Inertia::render('Admin/Suggestions/Index', [
            'initialOverview' => $this->overview->overview(),
        ]);
    }

    public function index(): JsonResponse
    {
        return response()->json($this->overview->overview());
    }
}
