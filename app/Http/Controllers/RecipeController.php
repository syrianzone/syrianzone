<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class RecipeController extends Controller
{
    // Server-side proxy for food.syrian.zone, the sibling "وصفاتنا" app. Same rule
    // as the weather worker: a browser call to another origin is not ours to
    // control, so we fetch here, normalize, and serve our own JSON.
    //
    // Upstream exposes `GET /api/recipes?page=N` with 12 items a page and a
    // `pagination` object carrying `current_page`, `last_page` and `total`. There
    // is no random endpoint (`/api/recipes/random` and `/api/v1/recipes` both
    // 404), so the pick is ours to make.
    private const PATH = '/api/recipes';

    private const MESSAGE = 'تعذر تحميل وصفة اليوم';

    public function ofTheDay()
    {
        $day = now()->format('Y-m-d');
        $key = "recipe-of-the-day:{$day}";

        $cached = Cache::get($key);
        if ($cached !== null) {
            return $this->respond($cached);
        }

        try {
            $recipe = $this->pickForDay($day);
        } catch (\Throwable $e) {
            return response()->json(['message' => self::MESSAGE], 502);
        }

        if ($recipe === null) {
            // not cached: an upstream blip or an empty pool must not stick all day
            return response()->json(['message' => self::MESSAGE], 502);
        }

        // expires with the day, so the pick rolls over at midnight on its own
        Cache::put($key, $recipe, now()->endOfDay());

        return $this->respond($recipe);
    }

    private function respond(array $recipe)
    {
        return response()->json(['recipe' => $recipe])
            ->header('Cache-Control', 'public, max-age=1800');
    }

    /**
     * Deterministic for a given date: the same day always yields the same recipe
     * for every visitor, and it changes at midnight. crc32 over the date string is
     * enough here, we want a stable spread and not a secret.
     *
     * Costs one upstream call on most days and two when the seed lands off page 1.
     * That is a per-day cost, not per request: everything after the first hit of
     * the day is served from cache. Widening the pool from 12 to all ~90 recipes
     * is worth one extra call a day.
     */
    private function pickForDay(string $day): ?array
    {
        $first = $this->fetchPage(1);
        if ($first === null) {
            return null;
        }

        $lastPage = (int) data_get($first, 'pagination.last_page', 1);
        $lastPage = max(1, $lastPage);

        $page = (int) (crc32("recipe-page:{$day}") % $lastPage) + 1;

        $body = $page === 1 ? $first : $this->fetchPage($page);
        if ($body === null) {
            return null;
        }

        $recipes = data_get($body, 'recipes');
        if (! is_array($recipes) || $recipes === []) {
            // a page that went empty under us (upstream shrank between the two calls)
            $recipes = data_get($first, 'recipes');
        }

        if (! is_array($recipes) || $recipes === []) {
            return null;
        }

        $recipes = array_values($recipes);
        $index = (int) (crc32("recipe-index:{$day}") % count($recipes));

        return $this->normalize($recipes[$index]);
    }

    private function fetchPage(int $page): ?array
    {
        $base = rtrim((string) config('services.recipes.url'), '/');

        $response = Http::timeout(6)->acceptJson()->get($base.self::PATH, ['page' => $page]);

        if (! $response->successful()) {
            return null;
        }

        $body = $response->json();

        return is_array($body) ? $body : null;
    }

    private function normalize(mixed $raw): ?array
    {
        if (! is_array($raw)) {
            return null;
        }

        $slug = data_get($raw, 'slug');
        $name = data_get($raw, 'name');
        if (! is_string($slug) || $slug === '' || ! is_string($name) || $name === '') {
            return null;
        }

        $base = rtrim((string) config('services.recipes.url'), '/');

        $city = data_get($raw, 'city');
        // upstream stores an unset city as the literal "غير محدد"; the widget should
        // show nothing rather than repeat that back at the reader
        if (! is_string($city) || $city === '' || $city === 'غير محدد') {
            $city = null;
        }

        return [
            'id' => data_get($raw, 'id'),
            'name' => $name,
            // verified against the live app: /recipes/{slug} renders Recipes/Show and
            // self-references as the canonical url, an unknown slug 404s
            'url' => "{$base}/recipes/{$slug}",
            'image_url' => $this->absoluteImage(data_get($raw, 'image_url'), $base),
            'city' => $city,
            'time_needed' => $this->flattenTimes(data_get($raw, 'time_needed')),
            'difficulty' => is_string(data_get($raw, 'difficulty')) ? data_get($raw, 'difficulty') : null,
            'tags' => $this->flattenTags(data_get($raw, 'tags')),
        ];
    }

    private function absoluteImage(mixed $url, string $base): ?string
    {
        if (! is_string($url) || $url === '') {
            return null;
        }

        if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
            return $url;
        }

        return $base.'/'.ltrim($url, '/');
    }

    /**
     * Upstream sends `time_needed` as either null or a label => duration map, both
     * in Arabic. Flattened to a list so the widget renders it without caring.
     *
     * @return list<array{label: string, value: string}>
     */
    private function flattenTimes(mixed $times): array
    {
        if (! is_array($times)) {
            return [];
        }

        $out = [];
        foreach ($times as $label => $value) {
            if (! is_scalar($value)) {
                continue;
            }
            $out[] = ['label' => trim((string) $label), 'value' => trim((string) $value)];
        }

        return $out;
    }

    /** @return list<string> */
    private function flattenTags(mixed $tags): array
    {
        if (! is_array($tags)) {
            return [];
        }

        $out = [];
        foreach ($tags as $tag) {
            $name = is_array($tag) ? ($tag['name'] ?? null) : $tag;
            if (is_string($name) && $name !== '') {
                $out[] = $name;
            }
        }

        return $out;
    }
}
