<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use App\Services\CandidateImageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CandidateController extends Controller
{
    public function __construct(private readonly CandidateImageService $images) {}

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

        $candidate = DB::transaction(function () use ($data): Candidate {
            $candidate = Candidate::create([
                'id' => (string) Str::uuid(),
                'category' => 'minister',
                'sort' => 0,
                ...$data,
            ]);
            $this->images->adopt($candidate->image_url);

            return $candidate;
        });

        return response()->json($candidate, 201);
    }

    public function update(Request $request, $id)
    {
        Candidate::findOrFail($id);
        $data = $request->validate([
            'candidate_group_id' => 'nullable|exists:candidate_groups,id',
            'name' => 'string|max:255',
            'title' => 'nullable|string|max:255',
            'image_url' => 'nullable|string',
            'category' => 'nullable|string',
            'sort' => 'integer',
        ]);
        $candidate = DB::transaction(function () use ($data, $id): Candidate {
            $candidate = Candidate::query()->lockForUpdate()->findOrFail($id);
            $oldImage = $candidate->image_url;
            $candidate->update($data);
            if (array_key_exists('image_url', $data)) {
                $this->images->replace($oldImage, $candidate->image_url);
            }

            return $candidate;
        });

        return response()->json($candidate);
    }

    public function destroy($id)
    {
        DB::transaction(function () use ($id): void {
            $candidate = Candidate::query()->lockForUpdate()->findOrFail($id);
            $image = $candidate->image_url;
            $candidate->delete();
            $this->images->release($image);
        });

        return response()->json(null, 204);
    }

    public function archive(Request $request, $id)
    {
        $candidate = Candidate::findOrFail($id);

        $data = $request->validate([
            'term_ended_at' => 'nullable|date',
            'archive_reason' => 'nullable|string|max:200',
            'successor_id' => 'nullable|exists:candidates,id|different:'.$id,
        ]);

        $termEnd = $data['term_ended_at'] ?? now()->toDateString();

        $candidate->update([
            'status' => 'archived',
            'term_ended_at' => $termEnd,
            'archive_reason' => $data['archive_reason'] ?? null,
            'successor_id' => $data['successor_id'] ?? null,
        ]);

        if (! empty($data['successor_id'])) {
            $successor = Candidate::find($data['successor_id']);
            if ($successor && ! $successor->term_started_at) {
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
