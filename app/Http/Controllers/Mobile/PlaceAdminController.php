<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Place;
use App\Models\PlaceReport;
use App\Services\PlaceImageService;
use App\Services\PlacePresenter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class PlaceAdminController extends Controller
{
    public function __construct(
        private readonly PlacePresenter $presenter,
    ) {}

    public function index(Request $request)
    {
        $validated = $request->validate([
            'page' => 'sometimes|integer|min:1',
            'status' => 'sometimes|string|in:pending,approved,rejected,all',
        ]);
        $status = $validated['status'] ?? 'pending';
        $userId = $request->user()->id;
        $query = Place::query()
            ->with(['photos', 'user'])
            ->withCount('reports')
            ->withExists([
                'likes as liked_by_me' => fn ($likes) => $likes->where('user_id', $userId),
                'saves as saved_by_me' => fn ($saves) => $saves->where('user_id', $userId),
            ]);

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $places = $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(20)
            ->through(fn (Place $place) => $this->presenter->adminItem($place, $userId));

        return response()->json($places);
    }

    public function approve(int $id)
    {
        $place = DB::transaction(function () use ($id) {
            $place = Place::query()->lockForUpdate()->findOrFail($id);

            if ($place->status !== 'pending') {
                abort(400, "Place is already {$place->status}");
            }

            $place->update([
                'approved_at' => now(),
                'rejection_reason' => null,
                'status' => 'approved',
            ]);

            return $place;
        });
        Cache::forget('places:map');

        return response()->json(['id' => $place->id, 'status' => $place->status]);
    }

    public function reject(Request $request, int $id)
    {
        $validated = $request->validate([
            'reason' => 'nullable|string|max:1000',
        ]);
        $place = DB::transaction(function () use ($id, $validated) {
            $place = Place::query()->lockForUpdate()->findOrFail($id);

            if ($place->status !== 'pending') {
                abort(400, "Place is already {$place->status}");
            }

            $place->update([
                'approved_at' => null,
                'rejection_reason' => isset($validated['reason']) ? trim($validated['reason']) : null,
                'status' => 'rejected',
            ]);

            return $place;
        });

        return response()->json(['id' => $place->id, 'status' => $place->status]);
    }

    public function destroy(int $id, PlaceImageService $images)
    {
        DB::transaction(function () use ($id, $images) {
            $place = Place::query()->lockForUpdate()->findOrFail($id);
            $images->deletePlaceFiles($place->id);
            $place->delete();
        });
        Cache::forget('places:map');

        return response()->json(null, 204);
    }

    public function reports(Request $request)
    {
        $validated = $request->validate([
            'page' => 'sometimes|integer|min:1',
            'status' => 'sometimes|string|in:open,resolved,dismissed,all',
        ]);
        $status = $validated['status'] ?? 'open';
        $query = PlaceReport::query()->with(['place', 'user']);

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $reports = $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(20)
            ->through(fn (PlaceReport $report) => $this->presenter->report($report));

        return response()->json($reports);
    }

    public function resolveReport(Request $request, int $id)
    {
        $validated = $request->validate([
            'action' => 'required|string|in:resolve,dismiss',
        ]);
        $report = DB::transaction(function () use ($id, $validated) {
            $report = PlaceReport::query()->lockForUpdate()->findOrFail($id);
            $report->update([
                'status' => $validated['action'] === 'resolve' ? 'resolved' : 'dismissed',
            ]);

            return $report;
        });

        return response()->json(['id' => $report->id, 'status' => $report->status]);
    }
}
