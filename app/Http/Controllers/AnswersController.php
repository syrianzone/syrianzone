<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class AnswersController extends Controller
{
  // Server-side proxy for the Apache Answer instance at answers.syrian.zone.
  // Same reasoning as WeatherController: the browser never talks to a
  // third-party host, and proxying gives us caching plus a payload we control.
  //
  // The upstream item is a large blob (operator, vote counts, collection counts,
  // accepted answer ids). We normalize to the handful of fields the widget
  // renders, so an upstream shape change cannot reach the client verbatim.
  private const TTL = 300;

  private const DEFAULT_LIMIT = 8;

  private const MAX_LIMIT = 20;

  public function index(Request $request)
  {
    $validated = $request->validate([
      'limit' => 'sometimes|integer|min:1|max:'.self::MAX_LIMIT,
    ], [
      'limit.integer' => 'الحد يجب أن يكون رقماً',
      'limit.min' => 'الحد أصغر من المسموح',
      'limit.max' => 'الحد أكبر من المسموح',
    ]);

    $limit = (int) ($validated['limit'] ?? self::DEFAULT_LIMIT);

    $cached = Cache::get("answers:{$limit}");
    if ($cached !== null) {
      return response()->json($cached)->header('Cache-Control', 'public, max-age=300');
    }

    $base = rtrim((string) config('services.answers.url'), '/');

    try {
      $response = Http::timeout(5)->get("{$base}/answer/api/v1/question/page", [
        'page' => 1,
        'page_size' => $limit,
        'order' => 'newest',
      ]);
    } catch (\Throwable $e) {
      return $this->failed();
    }

    if (! $response->successful()) {
      // not cached: a transient upstream error must not stick for the whole ttl
      return $this->failed();
    }

    // upstream answers 200 with a `code` in the body, so an HTTP 200 is not
    // enough on its own to call this a success
    if ($response->json('code') !== 200) {
      return $this->failed();
    }

    $list = $response->json('data.list');
    if (! is_array($list)) {
      return $this->failed();
    }

    $payload = ['items' => array_values(array_map(
      fn (array $q) => $this->normalize($q, $base),
      array_filter($list, 'is_array'),
    ))];

    Cache::put("answers:{$limit}", $payload, self::TTL);

    return response()->json($payload)->header('Cache-Control', 'public, max-age=300');
  }

  private function normalize(array $q, string $base): array
  {
    $id = (string) ($q['id'] ?? '');

    return [
      'id' => $id,
      'title' => (string) ($q['title'] ?? ''),
      // `/questions/{id}` is the canonical permalink and resolves on its own.
      // The upstream `url_title` is the literal placeholder "topic" on every
      // row, so it is deliberately not used to build a slug.
      'url' => "{$base}/questions/{$id}",
      'tags' => array_values(array_filter(array_map(
        fn ($t) => is_array($t) ? (string) ($t['display_name'] ?? $t['slug_name'] ?? '') : '',
        is_array($q['tags'] ?? null) ? $q['tags'] : [],
      ))),
      'answer_count' => (int) ($q['answer_count'] ?? 0),
      'created_at' => (int) ($q['created_at'] ?? 0),
    ];
  }

  private function failed()
  {
    return response()->json(['message' => 'تعذر تحميل الأسئلة'], 502);
  }
}
