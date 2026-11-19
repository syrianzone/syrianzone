<?php

namespace App\Http\Controllers;

use App\Models\GovtOfficeSlot;
use App\Models\GovtOfficial;
use App\Services\Directories\DirectorySuggestionService;
use App\Services\GovtCvs\GovtCvPresenter;
use App\Services\GovtCvs\GovtCvRules;
use App\Services\GovtCvs\GovtOfficialDirectory;
use App\Services\GovtCvs\GovtOfficialEditor;
use App\Services\GovtCvs\GovtTenureTracker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Response;

/**
 * Admin controller for Government CVs & Tenure Tracker (`السير الذاتية للمسؤولين`).
 *
 * A thin transport adapter over `App\Services\GovtCvs\*` for both Inertia admin
 * pages and admin JSON endpoints.
 */
class GovtCvAdminController extends Controller
{
    public function __construct(
        private readonly GovtOfficialDirectory $directory,
        private readonly GovtOfficialEditor $editor,
        private readonly GovtTenureTracker $tracker,
        private readonly GovtCvPresenter $presenter,
        private readonly GovtCvRules $rules,
    ) {}

    // ── Inertia Pages ──────────────────────────────────────────────────

    public function renderIndex(Request $request): Response
    {
        return inertia('Admin/GovtCvs/Index', [
            'officials' => $this->directory->adminList($request->only([
                'q', 'status', 'tier', 'institution_id', 'phase', 'cv_completeness', 'publish_status',
            ])),
            'stats' => $this->directory->stats(),
            'options' => $this->directory->options(forAdmin: true),
            'pendingSuggestionsCount' => app(DirectorySuggestionService::class)->pendingCount('govtcvs'),
        ]);
    }

    public function renderEditor(?string $id = null): Response
    {
        $official = $id ? $this->editor->findOfficial($id) : null;
        $options = $this->directory->options(forAdmin: true);

        return inertia('Admin/GovtCvs/Edit', [
            'official' => $official ? $this->presenter->adminDetail($official) : null,
            'institutions' => $options['institutions'],
            'slots' => $options['office_slots'],
            'options' => $options + ['slots' => $options['office_slots']],
        ]);
    }

    public function renderSlots(): Response
    {
        $slots = GovtOfficeSlot::query()
            ->with(['institution', 'replacedBy', 'tenures.official'])
            ->withCount('tenures')
            ->orderBy('title_ar')
            ->get();
        $options = $this->directory->options(forAdmin: true);

        return inertia('Admin/GovtCvs/Slots', [
            'slots' => $slots->map(fn (GovtOfficeSlot $s) => $this->presenter->slotItem($s))->values()->all(),
            'institutions' => $options['institutions'],
            'options' => $options,
        ]);
    }

    // ── Admin JSON API: Officials ──────────────────────────────────────

    public function listOfficials(Request $request): JsonResponse
    {
        return response()->json([
            'officials' => $this->directory->adminList($request->only([
                'q', 'status', 'tier', 'institution_id', 'phase', 'cv_completeness', 'publish_status',
            ])),
            'stats' => $this->directory->stats(),
        ]);
    }

    public function getOfficial(string $id): JsonResponse
    {
        $official = $this->editor->findOfficial($id);

        return $this->officialResponse($official);
    }

    public function options(): JsonResponse
    {
        return response()->json($this->directory->options(forAdmin: true));
    }

    public function storeOfficial(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules->official(), $this->rules->messages());
        $official = $this->editor->saveOfficial(null, $data, $request->user());

        return $this->officialResponse($official, 201);
    }

    public function updateOfficial(Request $request, string $id): JsonResponse
    {
        $official = $this->editor->findOfficial($id);
        $data = $request->validate($this->rules->official($official, partial: true), $this->rules->messages());
        $official = $this->editor->saveOfficial($official, $data, $request->user());

        return $this->officialResponse($official);
    }

    public function destroyOfficial(string $id): JsonResponse
    {
        $official = $this->editor->findOfficial($id);
        $this->editor->deleteOfficial($official);

        return response()->json(['success' => true]);
    }

    public function publishOfficial(Request $request, string $id): JsonResponse
    {
        $official = $this->editor->findOfficial($id);
        $requested = (string) $request->input('publish_status', 'published');

        $official = match ($requested) {
            'archived' => $this->editor->archive($official),
            'draft' => $this->editor->saveOfficial($official, ['publish_status' => 'draft'], $request->user()),
            default => $this->editor->publish($official),
        };

        return $this->officialResponse($official);
    }

    public function archiveOfficial(string $id): JsonResponse
    {
        $official = $this->editor->findOfficial($id);
        $official = $this->editor->archive($official);

        return $this->officialResponse($official);
    }

    public function uploadPortrait(Request $request, ?string $id = null): JsonResponse
    {
        $request->validate($this->rules->portraitUpload(), $this->rules->messages());
        $officialId = $id ?: (string) $request->input('official_id', '');
        $official = $this->editor->findOfficial($officialId);

        $official = $this->editor->uploadPortrait($official, $request->file('image'));

        return response()->json([
            'success' => true,
            'url' => $official->portrait_url,
            'official' => $this->presenter->adminDetail($official),
        ]);
    }

    // ── Admin JSON API: Tenures ────────────────────────────────────────

    public function storeTenure(Request $request, string $id): JsonResponse
    {
        $official = $this->editor->findOfficial($id);
        $data = $request->validate($this->rules->tenure(), $this->rules->messages());
        $tenure = $this->tracker->saveTenure($official, null, $data);

        return response()->json([
            'success' => true,
            'tenure' => $this->presenter->tenureItem($tenure),
            'official' => $this->presenter->adminDetail($official->fresh()),
        ], 201);
    }

    public function updateTenure(Request $request, string $id, ?string $tenureId = null): JsonResponse
    {
        // Support both `/officials/{id}/tenures/{tenureId}` and `/tenures/{tenureId}` route bindings
        if ($tenureId === null) {
            $tenure = $this->tracker->findTenure($id);
            $official = $tenure->official;
        } else {
            $official = $this->editor->findOfficial($id);
            $tenure = $this->tracker->findTenure($tenureId, $official);
        }

        $data = $request->validate($this->rules->tenure(partial: true), $this->rules->messages());
        $tenure = $this->tracker->saveTenure($official, $tenure, $data);

        return response()->json([
            'success' => true,
            'tenure' => $this->presenter->tenureItem($tenure),
            'official' => $this->presenter->adminDetail($official->fresh()),
        ]);
    }

    public function destroyTenure(string $id, ?string $tenureId = null): JsonResponse
    {
        if ($tenureId === null) {
            $tenure = $this->tracker->findTenure($id);
            $official = $tenure->official;
        } else {
            $official = $this->editor->findOfficial($id);
            $tenure = $this->tracker->findTenure($tenureId, $official);
        }

        $this->tracker->deleteTenure($tenure);

        return response()->json([
            'success' => true,
            'official' => $official ? $this->presenter->adminDetail($official->fresh()) : null,
        ]);
    }

    // ── Admin JSON API: CV Entries ─────────────────────────────────────

    public function storeCvEntry(Request $request, string $id): JsonResponse
    {
        $official = $this->editor->findOfficial($id);
        $data = $request->validate($this->rules->cvEntry(), $this->rules->messages());
        $entry = $this->editor->saveCvEntry($official, null, $data);

        return response()->json([
            'success' => true,
            'cv_entry' => $this->presenter->cvEntryItem($entry),
            'official' => $this->presenter->adminDetail($official->fresh()),
        ], 201);
    }

    public function updateCvEntry(Request $request, string $id, ?string $entryId = null): JsonResponse
    {
        if ($entryId === null) {
            $entry = $this->editor->findCvEntry($id);
            $official = $entry->official;
        } else {
            $official = $this->editor->findOfficial($id);
            $entry = $this->editor->findCvEntry($entryId, $official);
        }

        $data = $request->validate($this->rules->cvEntry(partial: true), $this->rules->messages());
        $entry = $this->editor->saveCvEntry($official, $entry, $data);

        return response()->json([
            'success' => true,
            'cv_entry' => $this->presenter->cvEntryItem($entry),
            'official' => $this->presenter->adminDetail($official->fresh()),
        ]);
    }

    public function destroyCvEntry(string $id, ?string $entryId = null): JsonResponse
    {
        if ($entryId === null) {
            $entry = $this->editor->findCvEntry($id);
            $official = $entry->official;
        } else {
            $official = $this->editor->findOfficial($id);
            $entry = $this->editor->findCvEntry($entryId, $official);
        }

        $this->editor->deleteCvEntry($entry);

        return response()->json([
            'success' => true,
            'official' => $official ? $this->presenter->adminDetail($official->fresh()) : null,
        ]);
    }

    public function reorderCvEntries(Request $request, string $id): JsonResponse
    {
        $official = $this->editor->findOfficial($id);
        $data = $request->validate($this->rules->cvEntryOrder(), $this->rules->messages());
        $this->editor->reorderCvEntries($official, $data['ids']);

        return $this->officialResponse($official->fresh());
    }

    // ── Admin JSON API: Evidence Links ─────────────────────────────────

    public function storeEvidence(Request $request, string $id): JsonResponse
    {
        $official = $this->editor->findOfficial($id);
        $data = $request->validate($this->rules->evidenceLink(), $this->rules->messages());
        $evidence = $this->editor->saveEvidenceLink($official, null, $data);

        return response()->json([
            'success' => true,
            'evidence' => $this->presenter->evidenceItem($evidence),
            'official' => $this->presenter->adminDetail($official->fresh()),
        ], 201);
    }

    public function destroyEvidence(string $id, ?string $evidenceId = null): JsonResponse
    {
        if ($evidenceId === null) {
            $evidence = $this->editor->findEvidenceLink($id);
            $official = $evidence->official;
        } else {
            $official = $this->editor->findOfficial($id);
            $evidence = $this->editor->findEvidenceLink($evidenceId, $official);
        }

        $this->editor->deleteEvidenceLink($evidence);

        return response()->json([
            'success' => true,
            'official' => $official ? $this->presenter->adminDetail($official->fresh()) : null,
        ]);
    }

    // ── Admin JSON API: Office Slots ───────────────────────────────────

    public function listSlots(): JsonResponse
    {
        $slots = GovtOfficeSlot::query()
            ->with(['institution', 'replacedBy', 'tenures.official'])
            ->withCount('tenures')
            ->orderBy('title_ar')
            ->get();

        return response()->json([
            'slots' => $slots->map(fn (GovtOfficeSlot $s) => $this->presenter->slotItem($s))->values()->all(),
        ]);
    }

    public function storeSlot(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules->officeSlot(), $this->rules->messages());
        $slot = $this->tracker->saveSlot(null, $data);

        return response()->json([
            'success' => true,
            'slot' => $this->presenter->slotItem($slot),
        ], 201);
    }

    public function updateSlot(Request $request, string $id): JsonResponse
    {
        $slot = $this->tracker->findSlot($id);
        $data = $request->validate($this->rules->officeSlot($slot, partial: true), $this->rules->messages());
        $slot = $this->tracker->saveSlot($slot, $data);

        return response()->json([
            'success' => true,
            'slot' => $this->presenter->slotItem($slot),
        ]);
    }

    public function destroySlot(string $id): JsonResponse
    {
        $slot = $this->tracker->findSlot($id);
        $this->tracker->deleteSlot($slot);

        return response()->json(['success' => true]);
    }

    private function officialResponse(GovtOfficial $official, int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'official' => $this->presenter->adminDetail($official),
        ], $status);
    }
}
