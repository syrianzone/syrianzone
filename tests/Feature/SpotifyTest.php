<?php

use App\Jobs\ExtractSongLyrics;
use App\Jobs\ProcessSongUpload;
use App\Models\Playlist;
use App\Models\Song;
use App\Models\User;
use App\Services\AudioMetadataService;
use App\Services\GeminiLyricsService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Sleep;

// UserFactory defaults role to admin; regular users must be explicit.
function spotifyAdmin(): User {
  return User::factory()->create(['role' => 'admin']);
}

function readySong(array $attrs = []): Song {
  $song = Song::create(array_merge([
    'title' => 'أغنية',
    'artist' => 'فنان',
    'slug' => Song::generateSlug(),
    'status' => 'ready',
    'duration_seconds' => 180,
  ], $attrs));

  if (!$song->audio_path) {
    $song->update(['audio_path' => "spotify/songs/{$song->id}/audio.mp3"]);
  }

  return $song;
}

function processingSong(): Song {
  return Song::create(['title' => 'قيد المعالجة', 'slug' => Song::generateSlug(), 'status' => 'processing']);
}

it('lists only ready songs on the public index, newest first', function () {
  $old = readySong();
  $old->created_at = now()->subMinute();
  $old->save();
  $new = readySong();
  processingSong();

  $this->get('/spotify')
    ->assertOk()
    ->assertInertia(fn ($page) => $page
      ->has('songs', 2)
      ->where('songs.0.id', $new->id)
      ->where('songs.1.id', $old->id)
      ->where('songs.0.audio_url', Storage::disk(config('filesystems.media_disk'))->url($new->audio_path))
      ->where('songs.0.has_lyrics', false));
});

it('renders the song page by slug and 404s for unknown or processing songs', function () {
  $song = readySong(['lyrics_lrc' => "[00:01.00] يا شام"]);

  $this->get("/spotify/song/{$song->slug}")
    ->assertOk()
    ->assertInertia(fn ($page) => $page
      ->where('song.slug', $song->slug)
      ->where('song.lyrics_lrc', "[00:01.00] يا شام")
      ->where('song.has_lyrics', true));

  $this->get('/spotify/song/nosuchslug1')->assertNotFound();
  $this->get('/spotify/song/' . processingSong()->slug)->assertNotFound();
});

it('creates a playlist with slug and edit_token, attaching only ready songs in order', function () {
  $first = readySong();
  $second = readySong();
  $pending = processingSong();

  $response = $this->postJson('/api/v1/spotify/playlists', [
    'name' => 'قائمتي',
    'song_ids' => [$second->id, $pending->id, $first->id],
  ])
    ->assertCreated()
    ->assertJsonStructure(['slug', 'edit_token', 'url']);

  expect(strlen($response->json('slug')))->toBe(10);
  expect($response->json('slug'))->toMatch('/^[a-z0-9]{10}$/');
  expect(strlen($response->json('edit_token')))->toBe(64);

  $playlist = Playlist::where('slug', $response->json('slug'))->firstOrFail();
  expect($playlist->songs()->pluck('songs.id')->all())->toBe([$second->id, $first->id]);

  $this->get("/spotify/playlist/{$playlist->slug}")
    ->assertOk()
    ->assertInertia(fn ($page) => $page
      ->where('playlist.name', 'قائمتي')
      ->has('songs', 2)
      ->where('songs.0.id', $second->id));
});

it('rejects playlist updates with a wrong edit_token and applies them with the right one', function () {
  $first = readySong();
  $second = readySong();
  $playlist = Playlist::create([
    'name' => 'قائمة',
    'slug' => Playlist::generateSlug(),
    'edit_token' => str_repeat('a', 64),
  ]);
  $playlist->songs()->sync([$first->id => ['position' => 0], $second->id => ['position' => 1]]);

  $this->putJson("/api/v1/spotify/playlists/{$playlist->slug}", [
    'edit_token' => 'wrong-token',
    'name' => 'اسم مخترق',
  ])->assertForbidden();

  expect($playlist->fresh()->name)->toBe('قائمة');

  $this->putJson("/api/v1/spotify/playlists/{$playlist->slug}", [
    'edit_token' => str_repeat('a', 64),
    'name' => 'اسم جديد',
    'song_ids' => [$second->id, $first->id],
  ])
    ->assertOk()
    ->assertJsonPath('name', 'اسم جديد');

  expect($playlist->fresh()->name)->toBe('اسم جديد');
  expect($playlist->songs()->pluck('songs.id')->all())->toBe([$second->id, $first->id]);
});

it('blocks guests and non-admins from the admin spotify routes', function () {
  $song = readySong();

  $this->getJson('/api/v1/admin/spotify/songs')->assertUnauthorized();

  $user = User::factory()->create(['role' => 'user']);
  $this->actingAs($user)->get('/admin/spotify')->assertForbidden();
  $this->actingAs($user)->getJson('/api/v1/admin/spotify/songs')->assertForbidden();
  $this->actingAs($user)->postJson('/api/v1/admin/spotify/songs')->assertForbidden();
  $this->actingAs($user)->putJson("/api/v1/admin/spotify/songs/{$song->id}")->assertForbidden();
  $this->actingAs($user)->deleteJson("/api/v1/admin/spotify/songs/{$song->id}")->assertForbidden();
  $this->actingAs($user)->postJson("/api/v1/admin/spotify/songs/{$song->id}/cover")->assertForbidden();
  $this->actingAs($user)->postJson("/api/v1/admin/spotify/songs/{$song->id}/extract-lyrics")->assertForbidden();
  $this->actingAs($user)->postJson("/api/v1/admin/spotify/songs/{$song->id}/retry")->assertForbidden();
});

it('renders the admin index for admins with the gemini flag', function () {
  config(['services.gemini.key' => null]);

  $this->actingAs(spotifyAdmin())
    ->get('/admin/spotify')
    ->assertOk()
    ->assertInertia(fn ($page) => $page->where('geminiEnabled', false));
});

it('lists all songs newest first with the admin shape', function () {
  $old = readySong();
  $old->created_at = now()->subMinute();
  $old->save();
  $failed = Song::create([
    'title' => 'فاشلة',
    'slug' => Song::generateSlug(),
    'status' => 'failed',
    'error' => 'no audio stream found in file',
  ]);

  $this->actingAs(spotifyAdmin())
    ->getJson('/api/v1/admin/spotify/songs')
    ->assertOk()
    ->assertJsonCount(2)
    ->assertJsonPath('0.id', $failed->id)
    ->assertJsonPath('0.error', 'no audio stream found in file')
    ->assertJsonPath('1.id', $old->id)
    ->assertJsonPath('1.error', null);
});

it('accepts an admin upload, stores the temp file and dispatches processing', function () {
  Queue::fake();
  Storage::fake('local');

  $response = $this->actingAs(spotifyAdmin())
    ->post('/api/v1/admin/spotify/songs', [
      'file' => UploadedFile::fake()->create('نشيد الحرية.mp3', 1024, 'audio/mpeg'),
    ], ['Accept' => 'application/json'])
    ->assertCreated()
    ->assertJsonPath('status', 'processing')
    ->assertJsonPath('title', 'نشيد الحرية')
    ->assertJsonPath('audio_url', null);

  $song = Song::findOrFail($response->json('id'));
  expect($song->slug)->toMatch('/^[a-z0-9]{10}$/');
  expect($song->temp_path)->toStartWith('spotify-incoming/');
  Storage::disk('local')->assertExists($song->temp_path);

  Queue::assertPushed(ProcessSongUpload::class, fn ($job) => $job->songId === $song->id && $job->tempPath === $song->temp_path);
});

it('rejects an upload that is not an mp3', function () {
  Queue::fake();
  Storage::fake('local');

  $this->actingAs(spotifyAdmin())
    ->post('/api/v1/admin/spotify/songs', [
      'file' => UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf'),
    ], ['Accept' => 'application/json'])
    ->assertStatus(422);

  expect(Song::count())->toBe(0);
  Queue::assertNothingPushed();
});

it('processes an upload onto the media disk and marks the song ready', function () {
  Storage::fake('public');
  Storage::fake('local');
  Storage::disk('local')->put('spotify-incoming/temp.mp3', 'mp3-bytes');

  // tiny real jpeg to exercise the embedded-art cover path
  $im = imagecreatetruecolor(10, 10);
  ob_start();
  imagejpeg($im);
  $jpeg = ob_get_clean();
  imagedestroy($im);

  $this->instance(AudioMetadataService::class, new class($jpeg) extends AudioMetadataService {
    public function __construct(private string $jpeg) {}
    public function analyze(string $path): array
    {
      return [
        'duration_seconds' => 213,
        'title' => 'عنوان من الوسوم',
        'artist' => 'فنان من الوسوم',
        'picture' => ['data' => $this->jpeg, 'mime' => 'image/jpeg'],
      ];
    }
  });

  $song = Song::create([
    'title' => 'من اسم الملف',
    'slug' => Song::generateSlug(),
    'status' => 'processing',
    'temp_path' => 'spotify-incoming/temp.mp3',
  ]);

  (new ProcessSongUpload($song->id, 'spotify-incoming/temp.mp3'))
    ->handle(app(AudioMetadataService::class), app(GeminiLyricsService::class));

  $fresh = $song->fresh();
  expect($fresh->status)->toBe('ready');
  expect($fresh->error)->toBeNull();
  expect($fresh->duration_seconds)->toBe(213);
  expect($fresh->title)->toBe('من اسم الملف');
  expect($fresh->artist)->toBe('فنان من الوسوم');
  expect($fresh->audio_path)->toStartWith("spotify/songs/{$song->id}/");
  expect($fresh->cover_path)->toStartWith("spotify/covers/{$song->id}/");
  expect($fresh->temp_path)->toBeNull();
  Storage::disk('public')->assertExists([$fresh->audio_path, $fresh->cover_path]);
  Storage::disk('local')->assertMissing('spotify-incoming/temp.mp3');
});

it('runs a real mp3 end to end: real getid3 metadata then synced lyrics', function () {
  Storage::fake('public');
  Storage::fake('local');
  config(['services.gemini.key' => 'test-key']);
  // only the gemini network call is stubbed; metadata uses the real getID3 path
  Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
    'candidates' => [['content' => ['parts' => [[
      'text' => "[00:00.50] السطر الأول\n[00:01.20] السطر الثاني\n[00:01.90] السطر الثالث",
    ]]]]],
  ])]);

  $bytes = file_get_contents(base_path('tests/fixtures/sample.mp3'));
  Storage::disk('local')->put('spotify-incoming/real.mp3', $bytes);

  $song = Song::create([
    'title' => 'من اسم الملف',
    'slug' => Song::generateSlug(),
    'status' => 'processing',
    'temp_path' => 'spotify-incoming/real.mp3',
  ]);

  // real AudioMetadataService (real getID3), real GeminiLyricsService (faked http).
  // the sync test queue runs the chained ExtractSongLyrics inline, so this one
  // call exercises the whole production path: upload -> metadata -> transcribe
  (new ProcessSongUpload($song->id, 'spotify-incoming/real.mp3'))
    ->handle(app(AudioMetadataService::class), app(GeminiLyricsService::class));

  $done = $song->fresh();
  expect($done->status)->toBe('ready');
  expect($done->duration_seconds)->toBe(2); // getID3 reads the real 2.085s stream
  expect($done->artist)->toBe('مطرب تجريبي'); // real id3v2 artist tag
  expect($done->audio_path)->toStartWith("spotify/songs/{$song->id}/");
  Storage::disk('public')->assertExists($done->audio_path);

  expect($done->lyrics_status)->toBe('ready');
  expect($done->lyrics_lrc)->toBe("[00:00.50] السطر الأول\n[00:01.20] السطر الثاني\n[00:01.90] السطر الثالث");

  // the stored lrc parses under the same grammar the frontend player enforces
  $stamped = preg_match_all('/^\[(\d{1,3}):([0-5]\d)(?:[.:]\d{1,3})?\]\s*\S/m', $done->lyrics_lrc);
  expect($stamped)->toBe(3);
});

it('marks the song failed when metadata analysis throws', function () {
  Storage::fake('public');
  Storage::fake('local');
  Storage::disk('local')->put('spotify-incoming/bad.mp3', 'not really audio');

  $this->instance(AudioMetadataService::class, new class extends AudioMetadataService {
    public function analyze(string $path): array
    {
      throw new RuntimeException('no audio stream found in file');
    }
  });

  $song = Song::create([
    'title' => 'ملف مزيف',
    'slug' => Song::generateSlug(),
    'status' => 'processing',
    'temp_path' => 'spotify-incoming/bad.mp3',
  ]);

  (new ProcessSongUpload($song->id, 'spotify-incoming/bad.mp3'))
    ->handle(app(AudioMetadataService::class), app(GeminiLyricsService::class));

  $fresh = $song->fresh();
  expect($fresh->status)->toBe('failed');
  expect($fresh->error)->toContain('no audio stream');
  expect($fresh->audio_path)->toBeNull();
  // temp file survives a failure so the admin retry endpoint can reprocess it
  Storage::disk('local')->assertExists('spotify-incoming/bad.mp3');
});

it('saves gemini lrc output and strips code fences', function () {
  Storage::fake('public');
  config(['services.gemini.key' => 'test-key']);
  // three lines because normalization now rejects transcriptions shorter than that
  Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
    'candidates' => [['content' => ['parts' => [[
      'text' => "```\n[00:01.00] يا شام\n[00:05.50] سطر ثانٍ\n[00:09.00] سطر ثالث\n```",
    ]]]]],
  ])]);

  $song = readySong(['lyrics_status' => 'pending']);
  Storage::disk('public')->put($song->audio_path, 'mp3-bytes');

  (new ExtractSongLyrics($song->id))->handle(app(GeminiLyricsService::class));

  $fresh = $song->fresh();
  expect($fresh->lyrics_status)->toBe('ready');
  expect($fresh->lyrics_lrc)->toBe("[00:01.00] يا شام\n[00:05.50] سطر ثانٍ\n[00:09.00] سطر ثالث");
});

it('normalizes gemini output: sorts by timestamp and drops junk lines', function () {
  Storage::fake('public');
  config(['services.gemini.key' => 'test-key']);
  Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
    'candidates' => [['content' => ['parts' => [[
      'text' => "```lrc\n[ar:فنان]\n[00:10.50] سطر ثالث\nتعليق بلا توقيت\n[00:01.00] سطر أول\n\n[00:05.5] سطر ثانٍ\n```",
    ]]]]],
  ])]);

  $song = readySong(['lyrics_status' => 'pending']);
  Storage::disk('public')->put($song->audio_path, 'mp3-bytes');

  (new ExtractSongLyrics($song->id))->handle(app(GeminiLyricsService::class));

  $fresh = $song->fresh();
  expect($fresh->lyrics_status)->toBe('ready');
  expect($fresh->lyrics_lrc)->toBe("[00:01.00] سطر أول\n[00:05.5] سطر ثانٍ\n[00:10.50] سطر ثالث");
});

it('drops lrc lines whose seconds field is 60 or more', function () {
  Storage::fake('public');
  config(['services.gemini.key' => 'test-key']);
  Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
    'candidates' => [['content' => ['parts' => [[
      'text' => "[00:01.00] أول\n[00:61.00] توقيت فاسد\n[00:05.00] ثانٍ\n[00:09.00] ثالث",
    ]]]]],
  ])]);

  $song = readySong(['lyrics_status' => 'pending']);
  Storage::disk('public')->put($song->audio_path, 'mp3-bytes');

  (new ExtractSongLyrics($song->id))->handle(app(GeminiLyricsService::class));

  $fresh = $song->fresh();
  expect($fresh->lyrics_status)->toBe('ready');
  expect($fresh->lyrics_lrc)->toBe("[00:01.00] أول\n[00:05.00] ثانٍ\n[00:09.00] ثالث");
});

it('marks lyrics failed when fewer than three valid lines survive normalization', function () {
  Storage::fake('public');
  config(['services.gemini.key' => 'test-key']);
  Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
    'candidates' => [['content' => ['parts' => [[
      'text' => "[00:01.00] وحيد\n[00:02.00] اثنان",
    ]]]]],
  ])]);

  $song = readySong(['lyrics_status' => 'pending']);
  Storage::disk('public')->put($song->audio_path, 'mp3-bytes');

  (new ExtractSongLyrics($song->id))->handle(app(GeminiLyricsService::class));

  $fresh = $song->fresh();
  expect($fresh->lyrics_status)->toBe('failed');
  expect($fresh->lyrics_lrc)->toBeNull();
});

it('retries generateContent on a transient 503 and succeeds', function () {
  Storage::fake('public');
  config(['services.gemini.key' => 'test-key']);
  Sleep::fake();
  Http::fake(['generativelanguage.googleapis.com/*' => Http::sequence()
    ->push(['error' => ['message' => 'unavailable']], 503)
    ->push([
      'candidates' => [['content' => ['parts' => [[
        'text' => "[00:01.00] أول\n[00:05.00] ثانٍ\n[00:09.00] ثالث",
      ]]]]],
    ])]);

  $song = readySong(['lyrics_status' => 'pending']);
  Storage::disk('public')->put($song->audio_path, 'mp3-bytes');

  (new ExtractSongLyrics($song->id))->handle(app(GeminiLyricsService::class));

  $fresh = $song->fresh();
  expect($fresh->lyrics_status)->toBe('ready');
  expect($fresh->lyrics_lrc)->toBe("[00:01.00] أول\n[00:05.00] ثانٍ\n[00:09.00] ثالث");
});

it('transcribes audio above the inline cap through the gemini files api', function () {
  Storage::fake('public');
  config(['services.gemini.key' => 'test-key']);
  Sleep::fake();
  Http::preventStrayRequests();
  Http::fake([
    'generativelanguage.googleapis.com/upload/v1beta/files' => Http::response('', 200, [
      'X-Goog-Upload-URL' => 'https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=sess1',
    ]),
    'generativelanguage.googleapis.com/upload/v1beta/files?upload_id=*' => Http::response([
      'file' => [
        'name' => 'files/abc123',
        'uri' => 'https://generativelanguage.googleapis.com/v1beta/files/abc123',
        'state' => 'ACTIVE',
      ],
    ]),
    'generativelanguage.googleapis.com/v1beta/models/*' => Http::response([
      'candidates' => [['content' => ['parts' => [[
        'text' => "[00:01.00] أول\n[00:05.00] ثانٍ\n[00:09.00] ثالث",
      ]]]]],
    ]),
    'generativelanguage.googleapis.com/v1beta/files/*' => Http::response(['state' => 'ACTIVE']),
  ]);

  $song = readySong(['lyrics_status' => 'pending']);
  Storage::disk('public')->put($song->audio_path, str_repeat('a', 16 * 1024 * 1024));

  (new ExtractSongLyrics($song->id))->handle(app(GeminiLyricsService::class));

  $fresh = $song->fresh();
  expect($fresh->lyrics_status)->toBe('ready');
  expect($fresh->lyrics_lrc)->toBe("[00:01.00] أول\n[00:05.00] ثانٍ\n[00:09.00] ثالث");

  Http::assertSent(fn ($request) => str_contains($request->url(), 'generateContent')
    && isset($request['contents'][0]['parts'][1]['file_data'])
    && !isset($request['contents'][0]['parts'][1]['inline_data']));
});

it('marks lyrics failed when the uploaded file never becomes active', function () {
  Storage::fake('public');
  config(['services.gemini.key' => 'test-key']);
  Sleep::fake();
  Http::preventStrayRequests();
  Http::fake([
    'generativelanguage.googleapis.com/upload/v1beta/files' => Http::response('', 200, [
      'X-Goog-Upload-URL' => 'https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=sess1',
    ]),
    'generativelanguage.googleapis.com/upload/v1beta/files?upload_id=*' => Http::response([
      'file' => [
        'name' => 'files/abc123',
        'uri' => 'https://generativelanguage.googleapis.com/v1beta/files/abc123',
        'state' => 'PROCESSING',
      ],
    ]),
    // faked so a regression that reaches generateContent is recorded (and caught
    // by assertNotSent) instead of escaping as a stray request
    'generativelanguage.googleapis.com/v1beta/models/*' => Http::response(['candidates' => []]),
    'generativelanguage.googleapis.com/v1beta/files/*' => Http::response(['state' => 'PROCESSING']),
  ]);

  $song = readySong(['lyrics_status' => 'pending']);
  Storage::disk('public')->put($song->audio_path, str_repeat('a', 16 * 1024 * 1024));

  (new ExtractSongLyrics($song->id))->handle(app(GeminiLyricsService::class));

  $fresh = $song->fresh();
  expect($fresh->lyrics_status)->toBe('failed');
  expect($fresh->lyrics_lrc)->toBeNull();
  Http::assertNotSent(fn ($request) => str_contains($request->url(), 'generateContent'));
});

it('strips a closing fence glued to an arabic letter without corrupting it', function () {
  Storage::fake('public');
  config(['services.gemini.key' => 'test-key']);
  // regression: \R without /u in the fence strip matched byte 0x85 inside م and
  // produced invalid utf-8
  Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
    'candidates' => [['content' => ['parts' => [[
      'text' => "```\n[00:01.00] أول\n[00:05.00] ثانٍ\n[00:09.00] سلام```",
    ]]]]],
  ])]);

  $song = readySong(['lyrics_status' => 'pending']);
  Storage::disk('public')->put($song->audio_path, 'mp3-bytes');

  (new ExtractSongLyrics($song->id))->handle(app(GeminiLyricsService::class));

  $fresh = $song->fresh();
  expect($fresh->lyrics_status)->toBe('ready');
  expect($fresh->lyrics_lrc)->toBe("[00:01.00] أول\n[00:05.00] ثانٍ\n[00:09.00] سلام");
});

it('keeps lyric lines prefixed with a bom or nbsp', function () {
  Storage::fake('public');
  config(['services.gemini.key' => 'test-key']);
  Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
    'candidates' => [['content' => ['parts' => [[
      'text' => "\u{FEFF}[00:01.00] أول\n\u{A0}[00:05.00] ثانٍ\n[00:09.00] ثالث",
    ]]]]],
  ])]);

  $song = readySong(['lyrics_status' => 'pending']);
  Storage::disk('public')->put($song->audio_path, 'mp3-bytes');

  (new ExtractSongLyrics($song->id))->handle(app(GeminiLyricsService::class));

  $fresh = $song->fresh();
  expect($fresh->lyrics_status)->toBe('ready');
  expect($fresh->lyrics_lrc)->toBe("[00:01.00] أول\n[00:05.00] ثانٍ\n[00:09.00] ثالث");
});

it('marks lyrics failed when gemini returns nothing usable', function () {
  Storage::fake('public');
  config(['services.gemini.key' => 'test-key']);
  Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
    'candidates' => [['content' => ['parts' => [['text' => 'عذراً، لا أستطيع تمييز الكلمات.']]]]],
  ])]);

  $song = readySong(['lyrics_status' => 'pending']);
  Storage::disk('public')->put($song->audio_path, 'mp3-bytes');

  (new ExtractSongLyrics($song->id))->handle(app(GeminiLyricsService::class));

  $fresh = $song->fresh();
  expect($fresh->lyrics_status)->toBe('failed');
  expect($fresh->lyrics_lrc)->toBeNull();
});

it('reports gemini disabled without a key and refuses extraction requests', function () {
  config(['services.gemini.key' => null]);
  Http::fake();

  expect(app(GeminiLyricsService::class)->enabled())->toBeFalse();

  $song = readySong();
  $this->actingAs(spotifyAdmin())
    ->postJson("/api/v1/admin/spotify/songs/{$song->id}/extract-lyrics")
    ->assertStatus(422);

  expect($song->fresh()->lyrics_status)->toBe('none');
  Http::assertNothingSent();
});

it('deletes the stored objects and the row on destroy', function () {
  Storage::fake('public');

  $song = readySong();
  $song->update(['cover_path' => "spotify/covers/{$song->id}/cover.webp"]);
  Storage::disk('public')->put($song->audio_path, 'a');
  Storage::disk('public')->put($song->cover_path, 'c');

  $this->actingAs(spotifyAdmin())
    ->deleteJson("/api/v1/admin/spotify/songs/{$song->id}")
    ->assertNoContent();

  $this->assertDatabaseMissing('songs', ['id' => $song->id]);
  Storage::disk('public')->assertMissing([$song->audio_path, $song->cover_path]);
});

it('marks a worker-killed processing job failed via the failed hook', function () {
  $song = readySong(['status' => 'processing']);

  (new ProcessSongUpload($song->id, 'spotify-incoming/temp.mp3'))->failed(null);

  expect($song->fresh()->status)->toBe('failed');
});

it('marks worker-killed lyrics extraction failed via the failed hook', function () {
  $song = readySong(['lyrics_status' => 'pending']);

  (new ExtractSongLyrics($song->id))->failed(null);

  expect($song->fresh()->lyrics_status)->toBe('failed');
});

it('refuses deleting a song that is still processing', function () {
  Storage::fake('public');
  $song = readySong(['status' => 'processing']);

  $this->actingAs(spotifyAdmin())
    ->deleteJson("/api/v1/admin/spotify/songs/{$song->id}")
    ->assertStatus(422);

  $this->assertDatabaseHas('songs', ['id' => $song->id]);
});

it('refuses a second extraction while one is pending', function () {
  config(['services.gemini.key' => 'test-key']);
  Queue::fake();
  $song = readySong(['lyrics_status' => 'pending']);

  $this->actingAs(spotifyAdmin())
    ->postJson("/api/v1/admin/spotify/songs/{$song->id}/extract-lyrics")
    ->assertStatus(422);

  Queue::assertNothingPushed();
});
