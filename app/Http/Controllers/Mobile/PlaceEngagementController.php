<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Place;
use App\Models\PlaceComment;
use App\Services\PlacePresenter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PlaceEngagementController extends Controller
{
    public function __construct(
        private readonly PlacePresenter $presenter,
    ) {}

    public function comments(Request $request, int $id)
    {
        $request->validate(['page' => 'sometimes|integer|min:1']);
        $place = Place::query()->where('status', 'approved')->findOrFail($id);
        $comments = $place->comments()
            ->with('user')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(20)
            ->through(fn (PlaceComment $comment) => $this->presenter->comment($comment));

        return response()->json($comments);
    }

    public function storeComment(Request $request, int $id)
    {
        $request->merge([
            'body' => is_string($request->input('body'))
              ? trim($request->input('body'))
              : $request->input('body'),
        ]);
        $validated = $request->validate([
            'body' => 'required|string|max:500',
        ]);

        $comment = DB::transaction(function () use ($id, $request, $validated) {
            $place = $this->lockedApprovedPlace($id);
            $comment = PlaceComment::create([
                'place_id' => $place->id,
                'user_id' => $request->user()->id,
                'body' => $validated['body'],
            ]);
            $place->comments_count = PlaceComment::query()
                ->where('place_id', $place->id)
                ->count();
            $place->save();

            return $comment;
        });

        return response()->json($this->presenter->comment($comment->load('user')), 201);
    }

    public function destroyComment(Request $request, int $id)
    {
        DB::transaction(function () use ($id, $request) {
            $comment = PlaceComment::query()->lockForUpdate()->findOrFail($id);
            $user = $request->user();

            if ($user->id !== $comment->user_id && ! in_array($user->role, ['admin', 'superadmin'], true)) {
                abort(403, 'Forbidden');
            }

            $place = Place::query()->lockForUpdate()->findOrFail($comment->place_id);
            $comment->delete();
            $place->comments_count = PlaceComment::query()
                ->where('place_id', $place->id)
                ->count();
            $place->save();
        });

        return response()->json(null, 204);
    }

    public function like(Request $request, int $id)
    {
        $count = $this->setEngagement(
            placeId: $id,
            userId: $request->user()->id,
            table: 'place_likes',
            counter: 'likes_count',
            active: true,
        );

        return response()->json(['liked' => true, 'likes_count' => $count]);
    }

    public function unlike(Request $request, int $id)
    {
        $count = $this->setEngagement(
            placeId: $id,
            userId: $request->user()->id,
            table: 'place_likes',
            counter: 'likes_count',
            active: false,
        );

        return response()->json(['liked' => false, 'likes_count' => $count]);
    }

    public function save(Request $request, int $id)
    {
        $count = $this->setEngagement(
            placeId: $id,
            userId: $request->user()->id,
            table: 'place_saves',
            counter: 'saves_count',
            active: true,
        );

        return response()->json(['saved' => true, 'saves_count' => $count]);
    }

    public function unsave(Request $request, int $id)
    {
        $count = $this->setEngagement(
            placeId: $id,
            userId: $request->user()->id,
            table: 'place_saves',
            counter: 'saves_count',
            active: false,
        );

        return response()->json(['saved' => false, 'saves_count' => $count]);
    }

    public function report(Request $request, int $id)
    {
        $validated = $request->validate([
            'details' => 'nullable|string|max:1000',
            'reason' => 'required|string|in:spam,wrong_info,inappropriate,duplicate,other',
        ]);

        $created = DB::transaction(function () use ($id, $request, $validated) {
            $place = $this->lockedApprovedPlace($id);

            return DB::table('place_reports')->insertOrIgnore([
                'place_id' => $place->id,
                'user_id' => $request->user()->id,
                'reason' => $validated['reason'],
                'details' => $validated['details'] ?? null,
                'status' => 'open',
                'created_at' => now(),
                'updated_at' => now(),
            ]) === 1;
        });

        if (! $created) {
            return response()->json(['message' => 'تم استلام بلاغك مسبقاً']);
        }

        return response()->json(['message' => 'تم استلام البلاغ'], 201);
    }

    public function mySaves(Request $request)
    {
        $request->validate(['page' => 'sometimes|integer|min:1']);
        $places = Place::query()
            ->join('place_saves', 'place_saves.place_id', '=', 'places.id')
            ->where('place_saves.user_id', $request->user()->id)
            ->where('places.status', 'approved')
            ->select('places.*')
            ->with('photos')
            ->orderByDesc('place_saves.created_at')
            ->orderByDesc('place_saves.id')
            ->paginate(20)
            ->through(fn (Place $place) => $this->presenter->listItem($place));

        return response()->json($places);
    }

    private function lockedApprovedPlace(int $id): Place
    {
        return Place::query()
            ->where('status', 'approved')
            ->lockForUpdate()
            ->findOrFail($id);
    }

    private function setEngagement(
        int $placeId,
        int $userId,
        string $table,
        string $counter,
        bool $active,
    ): int {
        return DB::transaction(function () use ($placeId, $userId, $table, $counter, $active) {
            $place = $this->lockedApprovedPlace($placeId);

            if ($active) {
                DB::table($table)->insertOrIgnore([
                    'place_id' => $place->id,
                    'user_id' => $userId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                DB::table($table)
                    ->where('place_id', $place->id)
                    ->where('user_id', $userId)
                    ->delete();
            }

            $canonicalCount = DB::table($table)->where('place_id', $place->id)->count();
            if ($place->{$counter} !== $canonicalCount) {
                $place->{$counter} = $canonicalCount;
                $place->save();
            }

            return $canonicalCount;
        });
    }
}
