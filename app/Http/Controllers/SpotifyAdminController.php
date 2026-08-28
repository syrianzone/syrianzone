<?php

namespace App\Http\Controllers;

use App\Jobs\ExtractSongLyrics;
use App\Jobs\ProcessSongUpload;
use App\Models\Song;
use App\Services\AudioMetadataService;
use App\Services\GeminiLyricsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SpotifyAdminController extends Controller
{
  public function renderIndex(GeminiLyricsService $gemini): \Inertia\Response
  {
    return inertia('Admin/Spotify/Index', ['geminiEnabled' => $gemini->enabled()]);
  }

  public function index(): JsonResponse
  {
    return response()->json(
      Song::orderByDesc('created_at')
        ->orderByDesc('id')
        ->get()
        ->map(fn (Song $song) => $song->toFullArray(forAdmin: true))
        ->values()
    );
  }

  public function store(Request $request): JsonResponse
  {
    $request->validate(['file' => ['required', 'file', 'max:51200']]);

    $file = $request->file('file');
    // NOTE: advisory gate only; content validation happens in the job via getID3,
    // so a fake mp3 ends up status failed rather than published.
    $extension = strtolower($file->getClientOriginalExtension());
    if ($extension !== 'mp3' && !str_starts_with((string) $file->getClientMimeType(), 'audio/')) {
      return response()->json(['message' => 'الملف يجب أن يكون بصيغة MP3'], 422);
    }

    $tempPath = $file->store('spotify-incoming', 'local');

    $song = Song::create([
      // not pathinfo(): its basename handling is locale-dependent and eats leading Arabic characters
      'title' => Str::limit(Str::beforeLast($file->getClientOriginalName(), '.'), 250, ''),
      'slug' => Song::generateSlug(),
      'status' => 'processing',
      // set explicitly: create() does not hydrate DB defaults, and the 201 body
      // is rendered directly as a table row
      'lyrics_status' => 'none',
      'temp_path' => $tempPath,
    ]);

    ProcessSongUpload::dispatch($song->id, $tempPath);

    return response()->json($song->toFullArray(forAdmin: true), 201);
  }

  public function update(Request $request, Song $song): JsonResponse
  {
    $validated = $request->validate([
      'title' => 'sometimes|string|max:255',
      'artist' => 'sometimes|nullable|string|max:255',
      'lyrics_lrc' => 'sometimes|nullable|string',
    ]);

    // manual paste counts as ready lyrics; clearing the field resets to none
    if (array_key_exists('lyrics_lrc', $validated)) {
      $validated['lyrics_status'] = filled($validated['lyrics_lrc']) ? 'ready' : 'none';
    }

    $song->update($validated);

    return response()->json($song->toFullArray(forAdmin: true));
  }

  public function destroy(Song $song): Response|JsonResponse
  {
    // deleting mid-processing would let the job finish uploading to R2 with no
    // row left to reference (permanent orphans); the job ends within minutes
    if ($song->status === 'processing') {
      return response()->json(['message' => 'الأغنية قيد المعالجة، انتظر انتهاءها ثم احذفها'], 422);
    }

    Storage::disk(config('filesystems.media_disk'))
      ->delete(array_filter([$song->audio_path, $song->cover_path]));

    if ($song->temp_path) {
      Storage::disk('local')->delete($song->temp_path);
    }

    $song->delete();

    return response()->noContent();
  }

  public function uploadCover(Request $request, Song $song, AudioMetadataService $metadata): JsonResponse
  {
    $request->validate(['image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120']]);

    $webp = $metadata->coverWebp(file_get_contents($request->file('image')->getRealPath()));
    if ($webp === null) {
      return response()->json(['message' => 'تعذر معالجة الصورة'], 422);
    }

    $media = Storage::disk(config('filesystems.media_disk'));
    $old = $song->cover_path;

    // fresh filename on purpose: CDN copies of the old path keep serving otherwise
    $coverPath = "spotify/covers/{$song->id}/" . Str::uuid() . '.webp';
    $media->put($coverPath, $webp, 'public');
    $song->update(['cover_path' => $coverPath]);

    if ($old) {
      $media->delete($old);
    }

    return response()->json($song->toFullArray(forAdmin: true));
  }

  public function extractLyrics(Song $song, GeminiLyricsService $gemini): JsonResponse
  {
    if (!$gemini->enabled()) {
      return response()->json(['message' => 'استخراج الكلمات غير مفعل: مفتاح Gemini غير مضبوط'], 422);
    }
    if ($song->status !== 'ready') {
      return response()->json(['message' => 'الأغنية غير جاهزة بعد'], 422);
    }
    if ($song->lyrics_status === 'pending') {
      return response()->json(['message' => 'الاستخراج قيد التنفيذ بالفعل'], 422);
    }

    $song->update(['lyrics_status' => 'pending']);
    ExtractSongLyrics::dispatch($song->id);

    return response()->json($song->toFullArray(forAdmin: true));
  }

  public function retry(Song $song): JsonResponse
  {
    if ($song->status !== 'failed') {
      return response()->json(['message' => 'لا يمكن إعادة المحاولة إلا للأغاني الفاشلة'], 422);
    }
    if (!$song->temp_path || !Storage::disk('local')->exists($song->temp_path)) {
      return response()->json(['message' => 'الملف الأصلي لم يعد موجوداً، أعد رفع الأغنية'], 422);
    }

    $song->update(['status' => 'processing', 'error' => null]);
    ProcessSongUpload::dispatch($song->id, $song->temp_path);

    return response()->json($song->toFullArray(forAdmin: true));
  }
}
