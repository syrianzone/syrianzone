<?php

namespace App\Http\Controllers;

use App\Models\StaticSite;
use Illuminate\Http\Request;

class SiteController extends Controller
{
    public function index(Request $request)
    {
        return $request->user() ? StaticSite::all() : StaticSite::where('is_visible', true)->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:200',
            'slug' => 'required|string|max:100|unique:static_sites',
            'path' => 'required|string|max:255',
            'is_visible' => 'boolean',
        ]);

        return response()->json(StaticSite::create(['is_visible' => true, ...$data]), 201);
    }

    public function update(Request $request, $id)
    {
        $site = StaticSite::findOrFail($id);
        $site->update($request->validate([
            'name' => 'string|max:200',
            'slug' => 'string|max:100|unique:static_sites,slug,' . $id,
            'path' => 'string|max:255',
            'is_visible' => 'boolean',
        ]));
        return response()->json($site);
    }

    public function destroy($id)
    {
        StaticSite::findOrFail($id)->delete();
        return response()->json(null, 204);
    }
}
