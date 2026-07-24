<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Services\CandidateImageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminUploadController extends Controller
{
    public function __construct(private readonly CandidateImageService $images) {}

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'image' => ['required', ...$this->images->rules()],
        ]);
        $stored = $this->images->store($data['image']);

        return response()->json([
            'data' => ['url' => $stored->url],
        ], 201);
    }
}
