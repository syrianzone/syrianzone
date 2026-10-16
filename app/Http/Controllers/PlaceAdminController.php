<?php

namespace App\Http\Controllers;

use App\Services\Places\PlaceModerationService;
use App\Services\Places\PlacePresenter;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * HTTP adapter for places moderation.
 *
 * Every write delegates to PlaceModerationService, which is also what the agent
 * MCP tools call. Domain refusals (PlaceActionException) are rendered into
 * standardized JSON error responses by the global exception handler in
 * bootstrap/app.php.
 */
class PlaceAdminController extends Controller
{
    public function renderIndex()
    {
        return Inertia::render('Admin/Places/Index');
    }

    public function index(Request $request, PlacePresenter $presenter)
    {
        $validated = $request->validate(['status' => 'sometimes|in:pending,approved,rejected,all']);
        $status = $validated['status'] ?? 'pending';

        $page = $presenter
            ->paginate($status, 20, $request->user()->id)
            ->through(fn ($p) => $presenter->item($p));

        return response()->json($page);
    }

    public function update(int $id, Request $request, PlaceModerationService $places, PlacePresenter $presenter)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:160',
            'category' => 'sometimes|required|string|in:historical,natural,cultural,religious,abandoned,viewpoint,market,food,other',
            'description' => 'sometimes|required|string|min:20|max:1000',
            'lat' => 'sometimes|required|numeric|between:32.0,37.5',
            'lng' => 'sometimes|required|numeric|between:35.5,42.5',
        ]);

        $places->update($id, $validated);

        return response()->json(
            $presenter->item($presenter->present($places->findOrFail($id), $request->user()->id))
        );
    }

    public function addPhoto(int $id, Request $request, PlaceModerationService $places)
    {
        $request->validate([
            'photo' => 'required|image|mimes:jpg,jpeg,png,webp|max:12288|dimensions:min_width=200,min_height=200,max_width=6000,max_height=6000',
        ], $this->photoMessages());

        $photo = $places->addPhoto($id, $request->file('photo'));

        return response()->json([
            'id' => $photo->id,
            'thumb_url' => $photo->thumb_url,
            'display_url' => $photo->display_url,
            'sort' => $photo->sort,
        ], 201);
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
        $validated = $request->validate(['reason' => 'nullable|string|max:1000']);

        $place = $places->reject($id, $validated['reason'] ?? null);

        return response()->json(['id' => $place->id, 'status' => 'rejected']);
    }

    public function destroy(int $id, PlaceModerationService $places)
    {
        $places->delete($id);

        return response()->json(null, 204);
    }

    public function rotatePhoto(int $id, PlaceModerationService $places)
    {
        $photo = $places->rotatePhoto($id);

        return response()->json([
            'id' => $photo->id,
            'thumb_url' => $photo->thumb_url,
            'display_url' => $photo->display_url,
        ]);
    }

    public function replacePhoto(int $id, Request $request, PlaceModerationService $places)
    {
        $request->validate([
            'photo' => 'required|image|mimes:jpg,jpeg,png,webp|max:12288|dimensions:min_width=200,min_height=200,max_width=6000,max_height=6000',
        ], $this->photoMessages());

        $photo = $places->replacePhoto($id, $request->file('photo'));

        return response()->json([
            'id' => $photo->id,
            'thumb_url' => $photo->thumb_url,
            'display_url' => $photo->display_url,
        ]);
    }

    private function photoMessages(): array
    {
        return [
            'photo.required' => 'أضف صورة',
            'photo.image' => 'الملف يجب أن يكون صورة',
            'photo.mimes' => 'الصورة يجب أن تكون بصيغة JPG أو PNG أو WebP',
            'photo.max' => 'حجم الصورة يجب ألا يتجاوز 12 ميغابايت',
            'photo.uploaded' => 'تعذر رفع الصورة، تأكد أن حجمها لا يتجاوز 12 ميغابايت',
            'photo.dimensions' => 'أبعاد الصورة يجب أن تكون بين 200x200 و 6000x6000 بكسل',
        ];
    }
}
