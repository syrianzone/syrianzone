<?php

namespace App\Http\Controllers;

use App\Models\RouteDraft;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TransitStudioController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'city_id' => 'required|exists:cities,id',
            'name_ar' => 'required|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'price' => 'nullable|integer',
            'notes' => 'nullable|string',
            'geojson' => 'required|array',
        ]);

        $draft = RouteDraft::create([
            'user_id' => Auth::id() ?? 1, // fallback to 1 if auth is missing for now, per open question
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
