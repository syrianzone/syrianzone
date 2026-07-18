<?php

namespace App\Http\Controllers;

use App\Models\RouteDraft;
use App\Services\TransitDraftGeoJson;
use Illuminate\Http\Request;

class TransitStudioController extends Controller
{
    public function store(Request $request)
    {
        if ($request->user() && $request->user()->is_banned) {
            return response()->json(['message' => 'Your account has been banned from submitting route drafts.'], 403);
        }

        $validated = $request->validate([
            'city_id' => 'required|exists:cities,id',
            'name_ar' => 'required|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'price' => 'nullable|integer|min:0',
            'notes' => 'nullable|string|max:5000',
            'geojson' => 'required|array',
        ]);

        $geojson = TransitDraftGeoJson::validate($validated['geojson']);

        $draft = RouteDraft::create([
            'user_id' => $request->user()?->id,
            'city_id' => $validated['city_id'],
            'name_ar' => $validated['name_ar'],
            'name_en' => $validated['name_en'] ?? null,
            'price' => $validated['price'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'geojson' => $geojson,
            'status' => 'pending',
        ]);

        return response()->json($draft, 201);
    }
}
