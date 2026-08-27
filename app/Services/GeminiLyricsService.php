<?php

namespace App\Services;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Sleep;

class GeminiLyricsService
{
  // Inline base64 cap: bigger files go through the Gemini Files API instead.
  private const MAX_BYTES = 15 * 1024 * 1024;

  // Files API cap: upload validation stops at 50MB, this leaves slack above it.
  private const MAX_FILE_BYTES = 60 * 1024 * 1024;

  // ~90s of ACTIVE polling at 5s per attempt: files near the size cap can take
  // gemini well over a minute to process server-side.
  private const POLL_ATTEMPTS = 18;

  private const POLL_SECONDS = 5;

  private const PROMPT = 'Transcribe the Arabic lyrics of this song and return them as pure LRC: '
    . 'one line per sung phrase, each prefixed with a [mm:ss.xx] timestamp marking when the phrase starts. '
    . 'Output only the LRC lines. No code fences, no commentary, no metadata tags, no translation. '
    . 'Timestamps must be in ascending order and must not exceed the duration of the song.';

  // frontend parser grammar (resources/js/Pages/Spotify/_lib/lrc.ts): minutes
  // 1-3 digits, seconds strictly 00-59, optional 1-3 digit fraction after . or :
  private const TIME_TAG = '\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]';

  public function enabled(): bool
  {
    return filled(config('services.gemini.key'));
  }

  public function extractLrc(string $audioBytes): ?string
  {
    if (!$this->enabled()) {
      return null;
    }

    if (strlen($audioBytes) > self::MAX_FILE_BYTES) {
      Log::info('gemini lyrics skipped: audio exceeds the files api size cap');
      return null;
    }

    if (strlen($audioBytes) <= self::MAX_BYTES) {
      return $this->generate([
        'inline_data' => ['mime_type' => 'audio/mpeg', 'data' => base64_encode($audioBytes)],
      ]);
    }

    $file = $this->uploadFile($audioBytes);
    if ($file === null) {
      return null;
    }

    try {
      return $this->generate([
        'file_data' => ['mime_type' => 'audio/mpeg', 'file_uri' => $file['uri']],
      ]);
    } finally {
      // best effort: uploaded files auto-expire after 48h, a failed delete is non-fatal
      rescue(fn () => Http::withHeaders(['x-goog-api-key' => config('services.gemini.key')])
        ->delete("https://generativelanguage.googleapis.com/v1beta/{$file['name']}"), report: false);
    }
  }

  private function generate(array $audioPart): ?string
  {
    $model = config('services.gemini.model');
    $key = config('services.gemini.key');

    // key goes in a header, not the query string: guzzle exception messages
    // include the full URI and land in laravel.log via the job's catch.
    // retry only transient http statuses, never connection timeouts: a 180s
    // timeout retried would blow past the job timeout
    $response = Http::timeout(180)
      ->withHeaders(['x-goog-api-key' => $key])
      ->retry(3, 5000, function (\Throwable $e) {
        return $e instanceof RequestException
          && in_array($e->response->status(), [429, 500, 502, 503, 504], true);
      }, throw: false)
      ->post(
        "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent",
        [
          'contents' => [[
            'parts' => [
              ['text' => self::PROMPT],
              $audioPart,
            ],
          ]],
        ]
      );

    if (!$response->successful()) {
      Log::warning('gemini lyrics request failed', ['status' => $response->status()]);
      return null;
    }

    $text = $response->json('candidates.0.content.parts.0.text');
    if (!is_string($text)) {
      return null;
    }

    // defensive: models wrap output in fences no matter how firmly the prompt
    // forbids it. explicit newlines, not \R: without /u it matches byte 0x85,
    // the trailing byte of common arabic letters, and corrupts them
    $text = trim($text);
    $text = preg_replace('/^```[a-zA-Z]*(?:\r\n|\r|\n)?/', '', $text);
    $text = preg_replace('/(?:\r\n|\r|\n)?```$/', '', $text);

    return $this->normalizeLrc($text);
  }

  // uploads via the resumable Files API and waits until the file is ACTIVE;
  // returns ['name' => 'files/abc', 'uri' => ...] or null on any failure
  private function uploadFile(string $bytes): ?array
  {
    // NOTE: timeouts are tuned for the realistic path; if every request hits its
    // cap the worker kills the job at 300s and ExtractSongLyrics::failed() marks
    // the song failed, which the admin can retry
    $key = config('services.gemini.key');

    $start = Http::timeout(30)->withHeaders([
      'x-goog-api-key' => $key,
      'X-Goog-Upload-Protocol' => 'resumable',
      'X-Goog-Upload-Command' => 'start',
      'X-Goog-Upload-Header-Content-Length' => (string) strlen($bytes),
      'X-Goog-Upload-Header-Content-Type' => 'audio/mpeg',
    ])->post('https://generativelanguage.googleapis.com/upload/v1beta/files', [
      'file' => ['display_name' => 'song'],
    ]);

    $uploadUrl = $start->header('X-Goog-Upload-URL');
    if (!$start->successful() || $uploadUrl === '') {
      Log::warning('gemini file upload start failed', ['status' => $start->status()]);
      return null;
    }

    $upload = Http::timeout(120)->withHeaders([
      'X-Goog-Upload-Command' => 'upload, finalize',
      'X-Goog-Upload-Offset' => '0',
    ])->withBody($bytes, 'application/octet-stream')->post($uploadUrl);

    $name = $upload->json('file.name');
    $uri = $upload->json('file.uri');
    $state = $upload->json('file.state');
    if (!$upload->successful() || !is_string($name) || !is_string($uri)) {
      Log::warning('gemini file upload failed', ['status' => $upload->status()]);
      return null;
    }

    // the file must finish server-side processing before generateContent accepts it
    for ($i = 0; $state === 'PROCESSING' && $i < self::POLL_ATTEMPTS; $i++) {
      Sleep::for(self::POLL_SECONDS)->seconds();
      $state = Http::timeout(10)->withHeaders(['x-goog-api-key' => $key])
        ->get("https://generativelanguage.googleapis.com/v1beta/{$name}")
        ->json('state');
    }

    if ($state !== 'ACTIVE') {
      Log::warning('gemini file never became active', ['state' => $state]);
      return null;
    }

    return ['name' => $name, 'uri' => $uri];
  }

  // keeps only lines the frontend parser accepts, sorted by first timestamp:
  // the parser preserves file order, so out-of-order model output is fixed here
  private function normalizeLrc(string $text): ?string
  {
    $lines = [];
    // explicit newlines, not \R: without /u it matches byte 0x85, which also
    // appears inside utf-8 arabic letters and would split them apart
    foreach (preg_split("/\r\n|\r|\n/", $text) as $line) {
      // unicode-aware trim: a BOM or NBSP prefix must not hide a valid stamp
      // (the frontend trims those too, so parity matters)
      $line = preg_replace('/^[\s\x{FEFF}\x{A0}]+|[\s\x{FEFF}\x{A0}]+$/u', '', $line);
      // consume leading stamps exactly like the frontend does, then require text
      $rest = $line;
      $first = null;
      while (preg_match('/^' . self::TIME_TAG . '/', $rest, $m) === 1) {
        $first ??= $m;
        $rest = preg_replace('/^[\s\x{FEFF}\x{A0}]+/u', '', substr($rest, strlen($m[0])));
      }
      if ($first === null || $rest === '') {
        continue;
      }
      $frac = isset($first[3]) && $first[3] !== '' ? (int) $first[3] / (10 ** strlen($first[3])) : 0;
      $lines[] = ['key' => (int) $first[1] * 60 + (int) $first[2] + $frac, 'text' => $line];
    }

    // a garbage transcription must fail rather than publish two stray lines
    if (count($lines) < 3) {
      return null;
    }

    usort($lines, fn ($a, $b) => $a['key'] <=> $b['key']);

    return implode("\n", array_column($lines, 'text'));
  }
}
