<?php

namespace App\Http\Controllers;

use App\Models\CompassResult;
use Inertia\Inertia;

class CompassController extends Controller
{
    /** The compass test page. */
    public function index()
    {
        return Inertia::render('Compass/Index');
    }

    /** Public shared-result page: reconstructs the card from stored answers. */
    public function shared($shareId)
    {
        $row = CompassResult::where('share_id', $shareId)->first();
        if (! $row) {
            abort(404);
        }

        return Inertia::render('Compass/Shared', [
            'version' => $row->version,
            'answers' => $row->answers,
            'shareId' => $shareId,
        ]);
    }
}
