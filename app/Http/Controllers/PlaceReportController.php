<?php

namespace App\Http\Controllers;

use App\Models\Place;
use App\Models\PlaceReport;
use App\Services\Places\PlaceModerationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Visitor reports on published places, and the moderation queue for them.
 *
 * Required by Google Play's user-generated-content policy for the mobile app,
 * which calls the same endpoint as the web.
 */
class PlaceReportController extends Controller
{
    public function store(Request $request, int $id)
    {
        $user = $request->user();
        if ($user->is_banned) {
            return response()->json(['message' => 'تم حظر حسابك من المساهمة'], 403);
        }

        // Only published places are visible to other users, so only those can be reported.
        $place = Place::where('status', 'approved')->find($id);
        if (! $place) {
            return response()->json(['message' => 'العنصر غير موجود.'], 404);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', Rule::in(PlaceReport::REASONS)],
            'details' => 'nullable|string|max:1000',
        ], [
            'reason.required' => 'اختر سبب البلاغ',
            'reason.in' => 'سبب البلاغ غير صالح',
            'details.max' => 'التفاصيل يجب ألا تتجاوز 1000 حرف',
        ]);

        $report = PlaceReport::firstOrCreate(
            ['place_id' => $place->id, 'user_id' => $user->id],
            ['reason' => $validated['reason'], 'details' => $validated['details'] ?? null],
        );

        if (! $report->wasRecentlyCreated) {
            return response()->json(['message' => 'تم استلام بلاغك عن هذا المكان مسبقاً']);
        }

        return response()->json(['message' => 'شكراً لك، سنراجع البلاغ قريباً'], 201);
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'status' => ['sometimes', Rule::in([...PlaceReport::STATUSES, 'all'])],
        ]);
        $status = $validated['status'] ?? 'open';

        $query = PlaceReport::with(['user', 'place'])->latest();
        if ($status !== 'all') {
            $query->where('status', $status);
        }

        return response()->json($query->paginate(20)->through(fn (PlaceReport $r) => [
            'id' => $r->id,
            'reason' => $r->reason,
            'details' => $r->details,
            'status' => $r->status,
            'created_at' => $r->created_at,
            'user' => ['id' => $r->user->id, 'name' => $r->user->name],
            'place' => [
                'id' => $r->place->id,
                'name' => $r->place->name,
                'status' => $r->place->status,
            ],
        ]));
    }

    /**
     * dismiss: the report is unfounded.
     * unpublish: uphold it, take the place off the map (back to pending review)
     *            and close every open report on that place.
     *
     * Only open reports can be acted on, so a stale admin tab cannot re-hide a
     * place that was re-approved after an earlier report was handled.
     */
    public function resolve(Request $request, int $id, PlaceModerationService $places)
    {
        $validated = $request->validate([
            'action' => 'required|string|in:dismiss,unpublish',
        ]);
        $action = $validated['action'];

        $report = DB::transaction(function () use ($id, $action) {
            $report = PlaceReport::lockForUpdate()->findOrFail($id);
            if ($report->status !== 'open') {
                return null;
            }

            if ($action === 'dismiss') {
                $report->update(['status' => 'dismissed']);
            } else {
                PlaceReport::where('place_id', $report->place_id)
                    ->where('status', 'open')
                    ->update(['status' => 'resolved']);
            }

            return $report;
        });

        if ($report === null) {
            return response()->json(['message' => 'تمت معالجة هذا البلاغ مسبقاً'], 409);
        }

        // Outside the transaction: unpublish() clears the map cache, which must
        // happen after the status change is committed or a concurrent map read
        // could re-cache the still-approved pin.
        if ($action === 'unpublish' && $report->place()->value('status') === 'approved') {
            $places->unpublish($report->place_id);
        }

        return response()->json([
            'id' => $report->id,
            'status' => $action === 'dismiss' ? 'dismissed' : 'resolved',
        ]);
    }
}
