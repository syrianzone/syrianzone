<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Wildlife\WildlifeData;
use App\Support\ArabicSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public read-only JSON API for the Syrian wildlife guide (`/wild`).
 */
class WildlifeApiController extends Controller
{
    public function __construct(
        private readonly WildlifeData $data,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $hub = $this->data->forHub();
        $species = is_array($hub['species'] ?? null) ? $hub['species'] : [];

        $query = mb_substr(trim((string) $request->query('q', '')), 0, 120);
        $group = trim((string) $request->query('group', ''));
        $status = trim((string) $request->query('status', ''));

        $filtered = $species;

        if ($group !== '') {
            $filtered = array_values(array_filter(
                $filtered,
                fn (array $s): bool => (string) ($s['group'] ?? $s['taxon_group'] ?? '') === $group,
            ));
        }

        if ($status !== '') {
            $filtered = array_values(array_filter(
                $filtered,
                fn (array $s): bool => (string) ($s['iucn_status'] ?? $s['status'] ?? '') === $status,
            ));
        }

        $folded = ArabicSearch::fold($query);
        if ($folded !== '') {
            $filtered = array_values(array_filter($filtered, function (array $s) use ($folded): bool {
                $haystack = ArabicSearch::fold(implode(' ', [
                    (string) ($s['slug'] ?? ''),
                    (string) ($s['name_ar'] ?? ''),
                    (string) ($s['name_en'] ?? ''),
                    (string) ($s['scientific_name'] ?? ''),
                    (string) ($s['summary_ar'] ?? ''),
                ]));

                return str_contains($haystack, $folded);
            }));
        }

        $hub['species'] = $filtered;

        $payload = [
            'data' => $hub,
            'meta' => [
                'count' => count($filtered),
                'filters' => [
                    'q' => $query !== '' ? $query : null,
                    'group' => $group !== '' ? $group : null,
                    'status' => $status !== '' ? $status : null,
                ],
            ],
        ];

        return $this->cachedJson($request, $payload, 300);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $detail = $this->data->forSpecies($slug);
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
