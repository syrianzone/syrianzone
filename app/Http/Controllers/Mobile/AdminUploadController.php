<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdminUploadController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'image' => 'required|image|mimes:jpeg,png,webp|max:5120',
        ]);
        $path = $data['image']->storePublicly('candidates', 'public');

        return response()->json([
            'data' => ['url' => Storage::disk('public')->url($path)],
        ], 201);
    }
}
