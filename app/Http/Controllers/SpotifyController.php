<?php

namespace App\Http\Controllers;

use App\Models\Playlist;
use App\Models\Song;
use App\Services\AudioMetadataService;
use Illuminate\Support\Facades\Storage;
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

    return Inertia::render('Spotify/Index', ['songs' => $songs])
      ->withViewData(['meta' => [
        'title' => 'أناشيد | Syrian Zone',
        'description' => 'استمع إلى أغانٍ سورية مع كلمات متزامنة، وأنشئ قوائم تشغيل وشاركها مع أصدقائك.',
        'type' => 'website',
        'url' => url('/syriafy'),
        'image' => url('/assets/thumbnail.jpg'),
      ]]);
  }

  public function song(string $slug): Response
  {
    $song = Song::where('slug', $slug)->where('status', 'ready')->firstOrFail();
    $title = $song->artist ? "{$song->title} - {$song->artist}" : $song->title;

    return Inertia::render('Spotify/Song', ['song' => $song->toFullArray()])
      ->withViewData(['meta' => array_filter([
        'title' => "{$title} | أناشيد",
        'description' => "استمع إلى {$song->title} مع الكلمات المتزامنة على Syrian Zone.",
        'type' => 'music.song',
        'url' => url("/syriafy/song/{$song->slug}"),
        'image' => $this->shareImageUrl($song),
        'audio' => $song->audioUrl(),
      ])]);
  }

  // link-preview crawlers do not run js, so share thumbnails must come from
  // server-rendered meta; whatsapp additionally rejects webp, hence this jpeg
  public function coverJpeg(string $slug, AudioMetadataService $metadata): \Symfony\Component\HttpFoundation\Response
  {
    $song = Song::where('slug', $slug)->where('status', 'ready')->firstOrFail();
    if (!$song->cover_path) {
      return redirect('/assets/thumbnail.jpg');
    }

    $webp = Storage::disk(config('filesystems.media_disk'))->get($song->cover_path);
    $jpeg = $webp === null ? null : $metadata->coverJpeg($webp);
    if ($jpeg === null) {
      return redirect('/assets/thumbnail.jpg');
    }

    // no server cache on purpose: cloudflare caches .jpg paths, conversion is cheap
    return response($jpeg, 200, [
      'Content-Type' => 'image/jpeg',
      'Cache-Control' => 'public, max-age=86400',
    ]);
  }

  private function shareImageUrl(Song $song): string
  {
    return $song->cover_path ? url("/syriafy/song/{$song->slug}/cover.jpg") : url('/assets/thumbnail.jpg');
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

    // first cover in the list becomes the share thumbnail
    $withCover = $playlist->songs()->where('status', 'ready')->whereNotNull('cover_path')->first();

    return Inertia::render('Spotify/Playlist', [
      'playlist' => ['name' => $playlist->name, 'slug' => $playlist->slug],
      'songs' => $songs,
    ])->withViewData(['meta' => [
      'title' => "{$playlist->name} | أناشيد",
      'description' => "استمع إلى قائمة تشغيل {$playlist->name} على Syrian Zone.",
      'type' => 'music.playlist',
      'url' => url("/syriafy/playlist/{$playlist->slug}"),
      'image' => $withCover ? $this->shareImageUrl($withCover) : url('/assets/thumbnail.jpg'),
    ]]);
  }
}
