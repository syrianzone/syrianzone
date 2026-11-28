<?php

namespace App\Http\Controllers;

use App\Services\Admin\IncomingSuggestionsOverviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Cross-section inbox aggregating incoming suggestions, community
 * submissions, reports, and drafts scoped to the authenticated user's
 * moderation capabilities.
 */
class IncomingSuggestionsAdminController extends Controller
{
    public function __construct(
        private readonly IncomingSuggestionsOverviewService $overview,
    ) {}

    public function renderIndex(Request $request): Response
    {
        $user = $request->user();

        if (! $user || ! $this->overview->canAccess($user)) {
            abort(403);
        }

        return Inertia::render('Admin/Suggestions/Index', [
            'initialOverview' => $this->overview->overviewFor($user),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! $this->overview->canAccess($user)) {
            abort(403);
        }

        return response()->json($this->overview->overviewFor($user));
    }
}
