<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CandidateController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'poll_id' => 'required|exists:polls,id',
            'candidate_group_id' => 'nullable|exists:candidate_groups,id',
            'name' => 'required|string|max:255',
            'title' => 'nullable|string|max:255',
            'image_url' => 'nullable|string',
            'category' => 'nullable|string',
        ]);

        return response()->json(Candidate::create([
            'id' => (string) Str::uuid(),
            'category' => 'minister',
            'sort' => 0,
            ...$data,
        ]), 201);
    }

    public function update(Request $request, $id)
    {
        $candidate = Candidate::findOrFail($id);
        $candidate->update($request->validate([
            'candidate_group_id' => 'nullable|exists:candidate_groups,id',
            'name' => 'string|max:255',
            'title' => 'nullable|string|max:255',
            'image_url' => 'nullable|string',
            'category' => 'nullable|string',
            'sort' => 'integer',
        ]));
        return response()->json($candidate);
    }

    public function destroy($id)
    {
        Candidate::findOrFail($id)->delete();
        return response()->json(null, 204);
    }

    public function archive(Request $request, $id)
    {
        $candidate = Candidate::findOrFail($id);

        $data = $request->validate([
            'term_ended_at' => 'nullable|date',
            'archive_reason' => 'nullable|string|max:200',
            'successor_id' => 'nullable|exists:candidates,id|different:' . $id,
        ]);

        $termEnd = $data['term_ended_at'] ?? now()->toDateString();

        $candidate->update([
            'status' => 'archived',
            'term_ended_at' => $termEnd,
            'archive_reason' => $data['archive_reason'] ?? null,
            'successor_id' => $data['successor_id'] ?? null,
        ]);

        if (!empty($data['successor_id'])) {
            $successor = Candidate::find($data['successor_id']);
            if ($successor && !$successor->term_started_at) {
                $successor->update(['term_started_at' => $termEnd]);
            }
        }

        return response()->json($candidate->fresh());
    }

    public function restore($id)
    {
        $candidate = Candidate::findOrFail($id);
        $candidate->update([
            'status' => 'active',
            'term_ended_at' => null,
            'archive_reason' => null,
            'successor_id' => null,
        ]);
        return response()->json($candidate->fresh());
    }
}
