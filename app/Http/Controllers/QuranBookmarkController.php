<?php

namespace App\Http\Controllers;

use App\Models\QuranBookmark;
use Illuminate\Http\Request;

class QuranBookmarkController extends Controller
{
  // Ayah bookmarks for logged-in users. Mirrors
  // PlaceEngagementController::save/unsave/mySaves: updateOrCreate +
  // unique(user,surah,ayah), session + CSRF (lives in web.php auth group).
  public function index(Request $request)
  {
    $bookmarks = QuranBookmark::where('user_id', $request->user()->id)
      ->orderByDesc('created_at')
      ->limit(200)
      ->get(['surah', 'ayah', 'page', 'juz', 'created_at']);

    return response()->json(['bookmarks' => $bookmarks]);
  }

  public function store(Request $request)
  {
    $validated = $request->validate([
      'surah' => 'required|integer|min:1|max:114',
      'ayah' => 'required|integer|min:1|max:286',
      'page' => 'required|integer|min:1|max:604',
      'juz' => 'required|integer|min:1|max:30',
    ]);

    QuranBookmark::updateOrCreate(
      [
        'user_id' => $request->user()->id,
        'surah' => $validated['surah'],
        'ayah' => $validated['ayah'],
      ],
      ['page' => $validated['page'], 'juz' => $validated['juz']],
    );

    return response()->json(['saved' => true, 'surah' => $validated['surah'], 'ayah' => $validated['ayah']]);
  }

  public function destroy(Request $request, int $surah, int $ayah)
  {
    if ($surah < 1 || $surah > 114 || $ayah < 1 || $ayah > 286) {
      return response()->json(['message' => 'Not found'], 404);
    }

    QuranBookmark::where('user_id', $request->user()->id)
      ->where('surah', $surah)
      ->where('ayah', $ayah)
      ->delete();

    return response()->json(['saved' => false, 'surah' => $surah, 'ayah' => $ayah]);
  }
}
