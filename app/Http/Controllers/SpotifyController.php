<?php

namespace App\Http\Controllers;

use App\Models\Playlist;
use App\Models\Song;
use Inertia\Inertia;
use Inertia\Response;

class SpotifyController extends Controller
{
  public function index(): Response
  {
    $songs = Song::where('status', 'ready')
      ->orderByDesc('created_at')
      ->orderByDesc('id')
      ->get()
      ->map(fn (Song $song) => $song->toSummaryArray())
      ->values();

    return Inertia::render('Spotify/Index', ['songs' => $songs]);
  }

  public function song(string $slug): Response
  {
    $song = Song::where('slug', $slug)->where('status', 'ready')->firstOrFail();

    return Inertia::render('Spotify/Song', ['song' => $song->toFullArray()]);
  }

  public function songJson(string $slug): \Illuminate\Http\JsonResponse
  {
    $song = Song::where('slug', $slug)->where('status', 'ready')->firstOrFail();

    return response()->json($song->toFullArray());
  }

  public function playlist(string $slug): Response
  {
    $playlist = Playlist::where('slug', $slug)->firstOrFail();

    $songs = $playlist->songs()
      ->where('status', 'ready')
      ->get()
      ->map(fn (Song $song) => $song->toSummaryArray())
      ->values();

    return Inertia::render('Spotify/Playlist', [
      'playlist' => ['name' => $playlist->name, 'slug' => $playlist->slug],
      'songs' => $songs,
    ]);
  }
}
