<?php

namespace App\Http\Controllers;

use App\Models\RouteDraft;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TransitStudioController extends Controller
{
    public function store(Request $request)
    {
        if ($request->user() && $request->user()->is_banned) {
            return response()->json(['message' => 'Your account has been banned from submitting route drafts.'], 403);
        }

        // Linked-edit auth must run BEFORE creating the draft: otherwise an
        // anonymous POST with route_id leaves an orphan pending draft and no
        // unpublish, and could take routes offline at will.
        if ($request->filled('route_id') && !Auth::check()) {
            return response()->json(['message' => 'Authentication is required to suggest edits to published routes.'], 401);
        }

        $validated = $request->validate([
            'city_id' => 'required|exists:cities,id',
            'name_ar' => 'required|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'price' => 'nullable|integer',
            'color_index' => 'nullable|integer|min:0|max:20',
            'notes' => 'nullable|string',
            'geojson' => 'required|array',
            'geojson.features' => 'required|array|min:1|max:500',
            'geojson.features.*.geometry' => 'required|array',
            'geojson.features.*.geometry.type' => 'required|string|in:LineString,MultiLineString,Point',
            'geojson.features.*.geometry.coordinates' => 'required|array|min:1',
            'route_id' => 'nullable|exists:routes,id',
        ]);

        // A linked edit must target a route in the same city, otherwise the
        // draft would unpublish an unrelated live route on approve.
        if (!empty($validated['route_id'])) {
            $linked = \App\Models\Route::find($validated['route_id']);
            if (!$linked || $linked->city_id !== $validated['city_id']) {
                return response()->json(['message' => 'Linked route must belong to the same city.'], 422);
            }
        }

        $draft = RouteDraft::create([
            'user_id' => Auth::id(),
            'city_id' => $validated['city_id'],
            'name_ar' => $validated['name_ar'],
            'name_en' => $validated['name_en'],
            'price' => $validated['price'],
            'color_index' => $validated['color_index'] ?? null,
            'notes' => $validated['notes'],
            'geojson' => $request->input('geojson'),
            'route_id' => $validated['route_id'] ?? null,
            'status' => 'pending',
        ]);

        // If this submission is an edit suggestion for an already-published route,
        // unpublish that route immediately so the live map reflects the pending
        // state.
        if ($draft->route_id) {
            $this->unpublishLinkedRoute($draft->route_id, $draft->id);
        }

        return response()->json($draft, 201);
    }

    public function show(Request $request, $id)
    {
        $draft = RouteDraft::with(['user:id,name', 'city:id,name_ar,name_en', 'linkedRoute:id,name_ar,name_en'])->findOrFail($id);

        if (! $this->canEditDraft($request, $draft)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json($draft);
    }

    public function showForEdit(Request $request, $routeId)
    {
        if (! $request->user()) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $route = \App\Models\Route::with(['city:id,name_ar,name_en'])->findOrFail($routeId);

        // Get geometry
        $geomJson = \Illuminate\Support\Facades\DB::table('route_geometries')
            ->selectRaw('ST_AsGeoJSON(geometry) as geojson')
            ->where('route_id', $route->id)
            ->value('geojson');

        $features = [];
        if ($geomJson) {
            $decoded = json_decode($geomJson, true);
            $features[] = [
                'type' => 'Feature',
                'properties' => ['type' => 'route'],
                'geometry' => $decoded,
            ];
        }

        // Get stops
        $stops = $route->stops()->orderBy('pivot_order')->get();
        foreach ($stops as $s) {
            $stopGeom = \Illuminate\Support\Facades\DB::table('stops')
                ->selectRaw('ST_AsGeoJSON(geometry) as geojson')
                ->where('id', $s->id)
                ->value('geojson');
            if ($stopGeom) {
                $features[] = [
                    'type' => 'Feature',
                    'properties' => ['type' => 'stop', 'nameAr' => $s->name_ar],
                    'geometry' => json_decode($stopGeom, true),
                ];
            }
        }

        return response()->json([
            'id' => $route->id,
            'route_id' => $route->id,
            'city_id' => $route->city_id,
            'name_ar' => $route->name_ar,
            'name_en' => $route->name_en,
            'price' => $route->price_new,
            'notes' => null,
            'geojson' => [
                'type' => 'FeatureCollection',
                'features' => $features,
            ],
            'status' => 'published',
            'user' => ['name' => ''],
            'city' => $route->city,
            'is_published_route' => true,
        ]);
    }

    public function update(Request $request, $id)
    {
        $draft = RouteDraft::findOrFail($id);

        if (! $this->canEditDraft($request, $draft)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'city_id' => 'sometimes|exists:cities,id',
            'name_ar' => 'sometimes|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'price' => 'nullable|integer',
            'color_index' => 'nullable|integer|min:0|max:20',
            'notes' => 'nullable|string',
            'geojson' => 'sometimes|array',
            'geojson.features' => 'required_with:geojson|array|min:1|max:500',
            'geojson.features.*.geometry' => 'required_with:geojson|array',
            'geojson.features.*.geometry.type' => 'required_with:geojson|string|in:LineString,MultiLineString,Point',
            'geojson.features.*.geometry.coordinates' => 'required_with:geojson|array|min:1',
        ]);

        $updateData = [];
        if ($request->has('city_id')) {
            $updateData['city_id'] = $validated['city_id'];
        }
        if ($request->has('name_ar')) {
            $updateData['name_ar'] = $validated['name_ar'];
        }
        if ($request->has('name_en')) {
            $updateData['name_en'] = $validated['name_en'];
        }
        if ($request->has('price')) {
            $updateData['price'] = $validated['price'];
        }
        if ($request->has('color_index')) {
            $updateData['color_index'] = $validated['color_index'];
        }
        if ($request->has('notes')) {
            $updateData['notes'] = $validated['notes'];
        }
        if ($request->has('geojson')) {
            $updateData['geojson'] = $request->input('geojson');
        }

        $user = $request->user();

        // Any edit submission is a resubmission for review: the draft always goes
        // back to the pending queue (even when an admin edits someone else's draft
        // or an anonymous submission). If the draft is linked to a published route
        // we also take that live route offline until the edit is reviewed.
        if ($draft->status !== 'pending' || $draft->route_id) {
            $updateData['status'] = 'pending';
            $updateData['rejection_reason'] = null;
        }

        if ($draft->route_id) {
            $this->unpublishLinkedRoute($draft->route_id, $draft->id);
        }

        $draft->update($updateData);

        return response()->json($draft);
    }

    private function canEditDraft(Request $request, RouteDraft $draft): bool
    {
        $user = $request->user();
        if (! $user) {
            return false;
        }

        // Admin can edit any draft
        if (in_array($user->role, ['admin', 'superadmin', 'transit_admin'])) {
            return true;
        }

        // Owner can edit their own draft
        return $draft->user_id === $user->id;
    }

    /**
     * Withdraw (delete) an own pending draft. Admins may withdraw any draft.
     * Only pending drafts can be withdrawn — approved/rejected rows are history.
     */
    public function destroy(Request $request, $id)
    {
        $draft = RouteDraft::findOrFail($id);

        if (! $this->canEditDraft($request, $draft)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($draft->status !== 'pending') {
            return response()->json(['message' => 'Only pending drafts can be withdrawn.'], 422);
        }

        $draft->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Unpublish a route that is being edited via a draft submission.
     *
     * The live (published) route is taken offline immediately so the public map
     * does not show stale geometry/data while the edit is pending review. The
     * route is set to 'disapproved' (the same off-map status used elsewhere) and
     * a log entry records why it was withdrawn.
     */
    private function unpublishLinkedRoute($routeId, $draftId)
    {
        if (! $routeId) {
            return;
        }

        $route = \App\Models\Route::find($routeId);
        if (! $route || $route->status !== 'published') {
            return;
        }

        $route->status = 'disapproved';
        $route->save();

        \App\Models\TransitRouteLog::create([
            'route_id' => $route->id,
            'action' => 'unpublished_for_edit',
            'description' => "سحب الخط '{$route->name_ar}' مؤقتاً من الخريطة بانتظار مراجعة التعديلات (مساهمة #{$draftId})",
            'user_id' => auth()->id(),
        ]);

        $this->clearCityMapCache($route->city_id);
    }

    private function clearCityMapCache(string $cityId): void
    {
        \Illuminate\Support\Facades\Cache::forget("transit:map-data:{$cityId}");
        \Illuminate\Support\Facades\Cache::forget("transit:routes:{$cityId}");
        if ($cityId === 'damascus' || $cityId === 'rif-dimashq') {
            \Illuminate\Support\Facades\Cache::forget('transit:map-data:damascus');
            \Illuminate\Support\Facades\Cache::forget('transit:map-data:rif-dimashq');
            \Illuminate\Support\Facades\Cache::forget('transit:routes:damascus');
            \Illuminate\Support\Facades\Cache::forget('transit:routes:rif-dimashq');
            \Illuminate\Support\Facades\Cache::forget('transit:routes:damascus+rif-dimashq');
        }
        \Illuminate\Support\Facades\Cache::forget('transit:cities');
    }
}
