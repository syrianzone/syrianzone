<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeminiLyricsService
{
  // Inline base64 cap: bigger files would need the Gemini Files API, not worth it yet.
  private const MAX_BYTES = 15 * 1024 * 1024;

  private const PROMPT = 'Transcribe the Arabic lyrics of this song and return them as pure LRC: '
    . 'one line per sung phrase, each prefixed with a [mm:ss.xx] timestamp marking when the phrase starts. '
    . 'Output only the LRC lines. No code fences, no commentary, no metadata tags, no translation.';

  public function enabled(): bool
  {
    return filled(config('services.gemini.key'));
  }

  public function extractLrc(string $audioBytes): ?string
  {
    if (!$this->enabled()) {
      return null;
    }

    if (strlen($audioBytes) > self::MAX_BYTES) {
      Log::info('gemini lyrics skipped: audio exceeds the inline size cap');
      return null;
    }

    $model = config('services.gemini.model');
    $key = config('services.gemini.key');

    // key goes in a header, not the query string: guzzle exception messages
    // include the full URI and land in laravel.log via the job's catch
    $response = Http::timeout(180)->withHeaders(['x-goog-api-key' => $key])->post(
      "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent",
      [
        'contents' => [[
          'parts' => [
            ['text' => self::PROMPT],
            ['inline_data' => ['mime_type' => 'audio/mpeg', 'data' => base64_encode($audioBytes)]],
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

    // defensive: models wrap output in fences no matter how firmly the prompt forbids it
    $text = trim($text);
    $text = preg_replace('/^```[a-zA-Z]*\R?/', '', $text);
    $text = preg_replace('/\R?```$/', '', $text);
    $text = trim($text);

    return preg_match('/^\[\d{1,2}:\d{2}/m', $text) === 1 ? $text : null;
  }
}
