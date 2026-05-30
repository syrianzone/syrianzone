<?php

namespace App\Http\Controllers;

use App\Models\CandidateGroup;
use Illuminate\Http\Request;

class CandidateGroupController extends Controller
{
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

        return response()->json(CandidateGroup::create([
            ...$data,
            'sort_order' => (CandidateGroup::where('poll_id', $data['poll_id'])->max('sort_order') ?? -1) + 1,
        ]), 201);
    }

    public function show($id)
    {
        return CandidateGroup::findOrFail($id);
    }

    public function update(Request $request, $id)
    {
        $group = CandidateGroup::findOrFail($id);
        $group->update($request->validate([
            'name' => 'sometimes|string|max:255',
            'sort_order' => 'sometimes|integer',
        ]));
        return response()->json($group);
    }

    public function destroy($id)
    {
        CandidateGroup::findOrFail($id)->delete();
        return response()->json(['message' => 'Group deleted']);
    }

    public function reorder(Request $request)
    {
        $data = $request->validate([
            'groups' => 'required|array',
            'groups.*.id' => 'required|exists:candidate_groups,id',
            'groups.*.sort_order' => 'required|integer',
        ]);

        foreach ($data['groups'] as $item) {
            CandidateGroup::where('id', $item['id'])->update(['sort_order' => $item['sort_order']]);
        }

        return response()->json(['message' => 'Groups reordered']);
    }

    public function setDefault($id)
    {
        $group = CandidateGroup::findOrFail($id);
        CandidateGroup::where('poll_id', $group->poll_id)->update(['is_default' => false]);
        $group->update(['is_default' => true]);
        return response()->json($group);
    }
}
