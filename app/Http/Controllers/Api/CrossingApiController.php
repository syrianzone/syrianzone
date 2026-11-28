<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Crossing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CrossingApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $payload = Crossing::publicDataset();
        $items = $payload['crossings'];

        $type = trim((string) $request->query('type', ''));
        $country = trim((string) $request->query('country', ''));
        $governorate = trim((string) $request->query('governorate', ''));
        $status = trim((string) $request->query('status', ''));
        $direction = trim((string) $request->query('direction', ''));
        $q = trim((string) $request->query('q', ''));

        if ($type !== '') {
            $items = array_values(array_filter($items, fn (array $c) => ($c['type'] ?? null) === $type));
        }
        if ($country !== '') {
            $items = array_values(array_filter($items, fn (array $c) => ($c['country'] ?? null) === $country));
        }
        if ($governorate !== '') {
            $items = array_values(array_filter($items, fn (array $c) => ($c['governorate'] ?? null) === $governorate));
        }
        if ($status !== '') {
            $items = array_values(array_filter($items, fn (array $c) => ($c['status'] ?? null) === $status));
        }
        if ($direction !== '') {
            $items = array_values(array_filter($items, fn (array $c) => ($c['direction'] ?? null) === $direction));
        }
        if ($q !== '') {
            $needle = mb_strtolower($q);
            $items = array_values(array_filter($items, function (array $c) use ($needle): bool {
                $haystack = mb_strtolower(implode(' ', array_filter([
                    $c['name_ar'] ?? '',
                    $c['name_en'] ?? '',
                    $c['slug'] ?? '',
                    $c['country'] ?? '',
                    $c['governorate'] ?? '',
                    $c['notes_ar'] ?? '',
                ])));

                return str_contains($haystack, $needle);
            }));
        }

        return $this->cachedJson($request, [
            'meta' => $payload['meta'],
            'crossings' => $items,
            'total' => count($items),
        ]);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $payload = Crossing::publicDataset();

        foreach ($payload['crossings'] as $item) {
            if (($item['slug'] ?? null) === $slug) {
                return $this->cachedJson($request, [
                    'crossing' => $item,
                    'meta' => $payload['meta'],
                ]);
            }
        }

        abort(404);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function cachedJson(Request $request, array $data): JsonResponse
    {
        $response = response()->json($data);
        $response->setEtag(sha1($response->getContent() ?: ''));
        $response->setPublic();
        $response->setMaxAge(300);
        $response->setSharedMaxAge(300);
        $response->isNotModified($request);

        return $response;
    }
}
