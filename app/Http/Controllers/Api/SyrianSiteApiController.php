<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SyrianSite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class SyrianSiteApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $items = $this->loadActiveSites();

        $category = trim((string) $request->query('category', ''));
        $tag = trim((string) $request->query('tag', ''));
        $q = trim((string) $request->query('q', ''));

        if ($category !== '') {
            $items = array_values(array_filter($items, fn (array $s) => ($s['category'] ?? null) === $category));
        }
        if ($tag !== '') {
            $needleTag = mb_strtolower($tag);
            $items = array_values(array_filter($items, function (array $s) use ($needleTag): bool {
                foreach ($s['tags'] ?? [] as $t) {
                    if (mb_strtolower((string) $t) === $needleTag) {
                        return true;
                    }
                }

                return false;
            }));
        }
        if ($q !== '') {
            $needle = mb_strtolower($q);
            $items = array_values(array_filter($items, function (array $s) use ($needle): bool {
                $haystack = mb_strtolower(implode(' ', array_filter([
                    $s['name'] ?? '',
                    $s['slug'] ?? '',
                    $s['description'] ?? '',
                    $s['category'] ?? '',
                    $s['url'] ?? '',
                ])));

                return str_contains($haystack, $needle);
            }));
        }

        return $this->cachedJson($request, [
            'sites' => $items,
            'total' => count($items),
        ]);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        foreach ($this->loadActiveSites() as $site) {
            if (($site['slug'] ?? null) === $slug) {
                return $this->cachedJson($request, [
                    'site' => $site,
                ]);
            }
        }

        abort(404);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function loadActiveSites(): array
    {
        $cached = Cache::get(SyrianSite::CACHE_KEY);
        if (is_array($cached)) {
            return $cached;
        }

        try {
            $rows = SyrianSite::active()->ordered()->get();
            if ($rows->isNotEmpty()) {
                $list = $rows->map(fn (SyrianSite $s) => $s->toPublicPayload())->values()->all();
                Cache::put(SyrianSite::CACHE_KEY, $list, 300);

                return $list;
            }
        } catch (\Throwable $e) {
            Log::warning('syrian_sites DB read failed', ['error' => $e->getMessage()]);
        }

        return [];
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
