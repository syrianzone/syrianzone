<?php

namespace App\Http\Controllers;

use App\Models\GovtOfficial;
use App\Services\GovtCvs\GovtCvPresenter;
use App\Services\GovtCvs\GovtOfficialDirectory;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Response;

/**
 * Public side of the Government CVs & Tenure Tracker (`السير الذاتية للمسؤولين`):
 * the directory index, chronological movements feed, official profile detail page,
 * and visitor JSON API endpoints.
 */
class GovtCvController extends Controller
{
    public function __construct(
        private readonly GovtOfficialDirectory $directory,
        private readonly GovtCvPresenter $presenter,
    ) {}

    public function index(): Response
    {
        return inertia('GovtCvs/Index', $this->directory->index(includeOptions: false, compact: true));
    }

    public function movements(): Response
    {
        return inertia('GovtCvs/Movements', $this->directory->movements(includeOptions: false, compact: true));
    }

    public function show(Request $request, string $slug): Response
    {
        $official = $this->findPublished($slug);
        SeoMeta::remember($request, 'govtcv', $official);

        $detail = $this->presenter->publicDetail($official);

        return inertia('GovtCvs/Show', [
            'official' => $detail,
            'related_promises' => $detail['related_promises'] ?? [],
            'tierlist_link' => $detail['tierlist_link'] ?? null,
            'official_entity_link' => $detail['official_entity_link'] ?? null,
            'house_link' => $detail['house_link'] ?? null,
            'ministry_links' => $detail['ministry_links'] ?? [],
        ]);
    }

    // ── Public JSON API ────────────────────────────────────────────────

    public function apiIndex(Request $request): JsonResponse
    {
        return response()->json($this->directory->index($this->extractFilters($request)));
    }

    public function apiShow(Request $request, string $slug): JsonResponse
    {
        $official = $this->findPublished($slug);
        $detail = $this->presenter->publicDetail($official);

        return response()->json([
            'official' => $detail,
            'related_promises' => $detail['related_promises'] ?? [],
            'tierlist_link' => $detail['tierlist_link'] ?? null,
            'official_entity_link' => $detail['official_entity_link'] ?? null,
            'house_link' => $detail['house_link'] ?? null,
        ]);
    }

    public function apiMovements(Request $request): JsonResponse
    {
        return response()->json($this->directory->movements($this->extractFilters($request)));
    }

    public function apiOptions(): JsonResponse
    {
        return response()->json($this->directory->options());
    }

    private function findPublished(string $slug): GovtOfficial
    {
        return GovtOfficial::published()
            ->with(GovtCvPresenter::PUBLIC_DETAIL_WITH)
            ->where('slug', $slug)
            ->first() ?? abort(404);
    }

    /**
     * @return array<string, mixed>
     */
    private function extractFilters(Request $request): array
    {
        return $request->only([
            'q',
            'status',
            'tier',
            'institution_id',
            'phase',
            'cv_completeness',
            'end_reason',
            'event_kind',
        ]);
    }
}
