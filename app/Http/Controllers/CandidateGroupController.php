<?php

namespace App\Http\Controllers;

use App\Models\CandidateGroup;
use App\Models\Poll;
use App\Services\TierlistLeaderboard;
use Illuminate\Http\Request;

class CandidateGroupController extends Controller
{
    public function __construct(private readonly TierlistLeaderboard $leaderboard) {}

    public function index(Request $request)
    {
        $request->validate(['poll_id' => 'required|exists:polls,id']);

        return CandidateGroup::where('poll_id', $request->poll_id)->orderBy('sort_order')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'poll_id' => 'required|exists:polls,id',
            'name' => 'required|string|max:255',
        ]);

        $group = CandidateGroup::create([
            ...$data,
            'sort_order' => (CandidateGroup::where('poll_id', $data['poll_id'])->max('sort_order') ?? -1) + 1,
        ]);

        $this->forgetLeaderboard($group->poll_id);

        return response()->json($group, 201);
    }

    public function show($id)
    {
        return CandidateGroup::findOrFail($id);
    }

    /**
     * Rename, reorder, or enable/disable a category.
     *
     * `is_active = false` is the non-destructive alternative to DELETE: the
     * category and its candidates stay in the database, but it leaves the
     * public tierlist, the leaderboard and the vote path. A disabled category
     * also stops being the default one, since "default" means "what a guest
     * lands on".
     */
    public function update(Request $request, $id)
    {
        $group = CandidateGroup::findOrFail($id);
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'sort_order' => 'sometimes|integer',
            'is_active' => 'sometimes|boolean',
        ]);

        if (array_key_exists('is_active', $data) && $data['is_active'] === false) {
            $data['is_default'] = false;
        }

        $group->update($data);

        $this->forgetLeaderboard($group->poll_id);

        return response()->json($group);
    }

    public function destroy($id)
    {
        $group = CandidateGroup::findOrFail($id);
        $pollId = $group->poll_id;
        $group->delete();

        $this->forgetLeaderboard($pollId);

        return response()->json(['message' => 'Group deleted']);
    }

    public function reorder(Request $request)
    {
        $data = $request->validate([
            'groups' => 'required|array',
            'groups.*.id' => 'required|exists:candidate_groups,id',
            'groups.*.sort_order' => 'required|integer',
        ]);

        // Ensure all group IDs belong to the same poll
        $groupIds = collect($data['groups'])->pluck('id');
        $pollIds = CandidateGroup::whereIn('id', $groupIds)->pluck('poll_id')->unique();

        if ($pollIds->count() > 1) {
            return response()->json(['message' => 'All groups must belong to the same poll.'], 422);
        }

        foreach ($data['groups'] as $item) {
            CandidateGroup::where('id', $item['id'])->update(['sort_order' => $item['sort_order']]);
        }

        $this->forgetLeaderboard($pollIds->first());

        return response()->json(['message' => 'Groups reordered']);
    }

    public function setDefault($id)
    {
        $group = CandidateGroup::findOrFail($id);

        if (! $group->isActive()) {
            return response()->json([
                'message' => 'A disabled category cannot be the default one.',
            ], 422);
        }

        CandidateGroup::where('poll_id', $group->poll_id)->update(['is_default' => false]);
        $group->update(['is_default' => true]);

        $this->forgetLeaderboard($group->poll_id);

        return response()->json($group);
    }

    /**
     * The leaderboard payload is cached per poll + status for a minute. A
     * category change has to drop it, or a disabled category would keep its
     * tab (and its ranks) until the TTL expires.
     */
    private function forgetLeaderboard(?string $pollId): void
    {
        if ($pollId === null) {
            return;
        }

        $poll = Poll::find($pollId);

        if ($poll !== null) {
            $this->leaderboard->forgetCache($poll);
        }
    }
}
