<?php

namespace App\Http\Controllers;

use App\Models\Playlist;
use App\Models\Song;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SpotifyPlaylistController extends Controller
{
  public function store(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'name' => 'required|string|max:100',
      'song_ids' => 'required|array|max:200',
      // existence is checked by the single whereIn in positionedReady, not 200 exists queries
      'song_ids.*' => 'integer',
    ]);

    $playlist = Playlist::create([
      'name' => $validated['name'],
      'slug' => Playlist::generateSlug(),
      'edit_token' => Str::random(64),
    ]);

    $playlist->songs()->sync($this->positionedReady($validated['song_ids']));

    // the edit_token is shown once; the client keeps it in localStorage
    return response()->json([
      'slug' => $playlist->slug,
      'edit_token' => $playlist->edit_token,
      'url' => url("/spotify/playlist/{$playlist->slug}"),
    ], 201);
  }

  public function update(Request $request, string $slug): JsonResponse
  {
    $playlist = Playlist::where('slug', $slug)->firstOrFail();

    $validated = $request->validate([
      'edit_token' => 'required|string',
      'name' => 'sometimes|string|max:100',
      'song_ids' => 'sometimes|array|max:200',
      // existence is checked by the single whereIn in positionedReady, not 200 exists queries
      'song_ids.*' => 'integer',
    ]);

    if (!hash_equals($playlist->edit_token, $validated['edit_token'])) {
      return response()->json(['message' => 'رمز التعديل غير صحيح'], 403);
    }

    if (array_key_exists('name', $validated)) {
      $playlist->update(['name' => $validated['name']]);
    }

    // full replacement: the client always sends the complete ordered list
    if (array_key_exists('song_ids', $validated)) {
      $playlist->songs()->sync($this->positionedReady($validated['song_ids']));
    }

    return response()->json(['slug' => $playlist->slug, 'name' => $playlist->name]);
  }

  /** @return array<int, array{position: int}> ready songs only, positions follow the request order */
  private function positionedReady(array $songIds): array
  {
    $ready = array_flip(
      Song::whereIn('id', $songIds)->where('status', 'ready')->pluck('id')->all()
    );

    $attach = [];
    $position = 0;
    foreach (array_values(array_unique($songIds)) as $id) {
      if (isset($ready[$id])) {
        $attach[$id] = ['position' => $position++];
      }
    }

    return $attach;
  }
}
