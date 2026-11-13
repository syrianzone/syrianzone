<?php

namespace App\Http\Controllers;

use App\Services\Places\PlaceModerationService;
use App\Services\Places\PlacePresenter;
use App\Services\Places\PlaceRules;
use App\Support\RejectionReason;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * HTTP adapter for places moderation.
 *
 * Every write delegates to PlaceModerationService, which is also what the agent
 * MCP tools call. Domain refusals (PlaceActionException) are rendered into
 * standardized JSON error responses by the global exception handler in
 * bootstrap/app.php. Validation rules and their Arabic messages come from
 * PlaceRules, shared with the public submission form.
 */
class PlaceAdminController extends Controller
{
    public function renderIndex()
    {
        return Inertia::render('Admin/Places/Index');
    }

    public function index(Request $request, PlacePresenter $presenter, PlaceRules $rules)
    {
        $validated = $request->validate(['status' => $rules->statusFilter()]);
        $status = $validated['status'] ?? 'pending';

        $page = $presenter
            ->paginate($status, 20, $request->user()->id)
            ->through(fn ($p) => $presenter->item($p));

        return response()->json($page);
    }

    public function update(int $id, Request $request, PlaceModerationService $places, PlacePresenter $presenter, PlaceRules $rules)
    {
        $validated = $request->validate($rules->edit(), $rules->messages());

        $places->update($id, $validated);

        return response()->json(
            $presenter->item($presenter->present($places->findOrFail($id), $request->user()->id))
        );
    }

    public function addPhoto(int $id, Request $request, PlaceModerationService $places, PlacePresenter $presenter, PlaceRules $rules)
    {
        $request->validate($rules->photo(), $rules->messages());

        $photo = $places->addPhoto($id, $request->file('photo'));

        return response()->json($presenter->photo($photo), 201);
    }

    public function deletePhoto(int $id, PlaceModerationService $places)
    {
        $places->deletePhoto($id);

        return response()->json(null, 204);
    }

    public function approve(int $id, PlaceModerationService $places)
    {
        $place = $places->approve($id);

        return response()->json(['id' => $place->id, 'status' => 'approved']);
    }

    public function reject(Request $request, int $id, PlaceModerationService $places)
    {
        $validated = $request->validate(['reason' => RejectionReason::rules()], RejectionReason::messages());

        $place = $places->reject($id, $validated['reason'] ?? null);

        return response()->json(['id' => $place->id, 'status' => 'rejected']);
    }

    public function destroy(int $id, PlaceModerationService $places)
    {
        $places->delete($id);

        return response()->json(null, 204);
    }

    public function rotatePhoto(int $id, PlaceModerationService $places, PlacePresenter $presenter)
    {
        $photo = $places->rotatePhoto($id);

        return response()->json($presenter->photoUrls($photo));
    }

    public function replacePhoto(int $id, Request $request, PlaceModerationService $places, PlacePresenter $presenter, PlaceRules $rules)
    {
        $request->validate($rules->photo(), $rules->messages());

        $photo = $places->replacePhoto($id, $request->file('photo'));

        return response()->json($presenter->photoUrls($photo));
    }
}
