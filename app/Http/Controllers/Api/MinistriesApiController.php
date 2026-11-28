<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Ministries\MinistryDirectoryService;
use App\Support\ArabicSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public read-only JSON API for Syrian ministries and sovereign bodies.
 */
class MinistriesApiController extends Controller
{
    public function __construct(
        private readonly MinistryDirectoryService $directory,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $index = $this->directory->indexPayload();
        $all = is_array($index['all_ministries'] ?? null) ? $index['all_ministries'] : [];

        $kind = trim((string) $request->query('kind', ''));
        $status = trim((string) $request->query('status', ''));
        $query = mb_substr(trim((string) $request->query('q', '')), 0, 120);

        $filtered = $all;

        if ($kind !== '') {
            $filtered = array_values(array_filter(
                $filtered,
                fn (array $m): bool => (string) ($m['kind'] ?? '') === $kind,
            ));
        }

        if ($status !== '') {
            $filtered = array_values(array_filter(
                $filtered,
                fn (array $m): bool => (string) ($m['status'] ?? '') === $status,
            ));
        }

        $folded = ArabicSearch::fold($query);
        if ($folded !== '') {
            $filtered = array_values(array_filter($filtered, function (array $m) use ($folded): bool {
                $haystack = ArabicSearch::fold(implode(' ', [
                    (string) ($m['slug'] ?? ''),
                    (string) ($m['name_ar'] ?? ''),
                    (string) ($m['name_en'] ?? ''),
                    (string) ($m['current_minister']['name_ar'] ?? ''),
                ]));

                return str_contains($haystack, $folded);
            }));
        }

        $index['all_ministries'] = $filtered;

        $payload = [
            'data' => $index,
            'meta' => [
                'count' => count($filtered),
                'filters' => [
                    'kind' => $kind !== '' ? $kind : null,
                    'status' => $status !== '' ? $status : null,
                    'q' => $query !== '' ? $query : null,
                ],
            ],
        ];

        return $this->cachedJson($request, $payload, 300);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $detail = $this->directory->showPayload($slug);
        abort_if($detail === null, 404);

        $payload = [
            'data' => $detail,
            'meta' => [
                'slug' => $slug,
            ],
        ];

        return $this->cachedJson($request, $payload, 300);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function cachedJson(Request $request, array $payload, int $maxAge): JsonResponse
    {
        $etag = '"'.sha1((string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)).'"';
        $headers = [
            'Cache-Control' => "public, max-age={$maxAge}",
            'ETag' => $etag,
        ];

        if ($request->header('If-None-Match') === $etag) {
            return response()->json(null, 304, $headers);
        }

        return response()->json($payload, 200, $headers);
    }
}
