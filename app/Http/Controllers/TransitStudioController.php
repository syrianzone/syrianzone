<?php

namespace App\Http\Controllers;

use App\Models\RouteDraft;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

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
            'price' => 'nullable|integer',
            'notes' => 'nullable|string',
            'geojson' => 'required|array',
            'geojson.features' => 'required|array|min:1',
            'geojson.features.*.geometry.type' => 'required|string',
        ]);

        $draft = RouteDraft::create([
            'user_id' => Auth::id(),
            'city_id' => $validated['city_id'],
            'name_ar' => $validated['name_ar'],
            'name_en' => $validated['name_en'],
            'price' => $validated['price'],
            'notes' => $validated['notes'],
            'geojson' => $validated['geojson'],
            'status' => 'pending',
        ]);

        return response()->json($draft, 201);
    }
}
