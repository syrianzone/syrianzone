<?php

namespace App\Http\Controllers;

use App\Models\Contributor;

class ContributorController extends Controller
{
    public function index()
    {
        return Contributor::orderBy('total_contributions', 'desc')->paginate(20);
    }

    public function show($id)
    {
        return Contributor::with('contributions')->findOrFail($id);
    }
}
