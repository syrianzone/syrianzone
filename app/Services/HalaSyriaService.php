<?php

namespace App\Services;

use App\Models\Hotel;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class HalaSyriaService
{
  private string $apiKey;
  private string $baseUrl;

  public function __construct()
  {
    $this->apiKey = config('services.halasyria.api_key');
    $this->baseUrl = config('services.halasyria.base_url');
  }

  public function isConfigured(): bool
  {
    return !empty($this->apiKey);
  }

  public function fetchAll(): array
  {
    if (!$this->isConfigured()) {
      return [];
    }

    $hotels = [];
    $offset = 0;
    $limit = 100;

    do {
      $response = Http::withHeaders([
        'apikey' => $this->apiKey,
        'Authorization' => "Bearer {$this->apiKey}",
      ])->timeout(15)->get("{$this->baseUrl}/hotels", [
        'select' => '*',
        'visible' => 'eq.true',
        'limit' => $limit,
        'offset' => $offset,
      ]);

      if (!$response->successful()) {
        Log::warning('HalaSyria API returned status ' . $response->status());
        return [];
      }

      $batch = $response->json();
      $hotels = array_merge($hotels, $batch);
      $offset += $limit;
    } while (count($batch) === $limit);

    return $hotels;
  }

  public function sync(): int
  {
    if (!$this->isConfigured()) {
      Log::warning('HalaSyria API key not configured, skipping hotel sync');
      return 0;
    }

    $remoteHotels = $this->fetchAll();
    if ($remoteHotels === []) {
      return 0;
    }

    $synced = 0;
    $now = now();

    foreach ($remoteHotels as $remote) {
      $slug = $remote['slug'] ?? null;
      $citySlug = $remote['city_slug'] ?? null;
      if (!$slug || !$citySlug) {
        continue;
      }

      $sourceUrl = "https://halasyria.com/hotels/{$citySlug}/{$slug}";

      Hotel::updateOrCreate(
        ['hala_syria_id' => $remote['id']],
        [
          'name' => $remote['name'] ?? '',
          'name_ar' => $remote['name_ar'] ?? null,
          'city' => $remote['city'] ?? '',
          'city_ar' => $remote['city_ar'] ?? null,
          'city_slug' => $citySlug,
          'slug' => $slug,
          'lat' => $remote['lat'] ?? 0,
          'lng' => $remote['lng'] ?? 0,
          'star_rating' => $remote['star_rating'] ?? null,
          'rating' => $remote['rating'] ?? null,
          'review_count' => $remote['review_count'] ?? 0,
          'now_show_rate' => $remote['now_show_rate'] ?? null,
          'currency' => $remote['currency'] ?? 'USD',
          'address' => $remote['address'] ?? null,
          'address_ar' => $remote['address_ar'] ?? null,
          'phone' => $remote['phone'] ?? null,
          'email' => $remote['email'] ?? null,
          'description' => $remote['description'] ?? null,
          'description_ar' => $remote['description_ar'] ?? null,
          'images' => $remote['images'] ?? null,
          'has_restaurant' => $remote['has_restaurant'] ?? false,
          'has_swimming_pool' => $remote['has_swimming_pool'] ?? false,
          'has_spa' => $remote['has_spa'] ?? false,
          'has_fitness_center' => $remote['has_fitness_center'] ?? false,
          'has_parking' => $remote['has_parking'] ?? false,
          'has_airport_shuttle' => $remote['has_airport_shuttle'] ?? false,
          'has_bar' => $remote['has_bar'] ?? false,
          'has_room_service' => $remote['has_room_service'] ?? false,
          'source_url' => $sourceUrl,
          'last_synced_at' => $now,
        ]
      );
      $synced++;
    }

    return $synced;
  }
}
