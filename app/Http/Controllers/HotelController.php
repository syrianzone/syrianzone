<?php

namespace App\Http\Controllers;

use App\Models\Hotel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class HotelController extends Controller
{
  public function mapData()
  {
    $geojson = Cache::remember('hotels:map', 300, function () {
      $hotels = Hotel::all();
      return [
        'type' => 'FeatureCollection',
        'features' => $hotels->map(fn ($h) => [
          'type' => 'Feature',
          'geometry' => ['type' => 'Point', 'coordinates' => [$h->lng, $h->lat]],
          'properties' => [
            'id' => $h->id,
            'name' => $h->name,
            'name_ar' => $h->name_ar,
            'type' => 'hotel',
            'star_rating' => $h->star_rating,
            'now_show_rate' => $h->now_show_rate,
            'city' => $h->city,
            'city_ar' => $h->city_ar,
            'thumb_url' => $h->thumb_url,
            'slug' => $h->slug,
          ],
        ])->values()->all(),
      ];
    });

    return response()->json($geojson)->header('Cache-Control', 'public, max-age=60');
  }

  public function index(Request $request)
  {
    $validated = $request->validate([
      'city' => 'sometimes|string|max:100',
      'q' => 'sometimes|string|max:100',
      'min_stars' => 'sometimes|integer|min:1|max:5',
      'max_price' => 'sometimes|numeric|min:0',
      'page' => 'sometimes|integer|min:1',
    ]);

    $query = Hotel::query();

    if (!empty($validated['city'])) {
      $query->where('city', $validated['city']);
    }
    if (!empty($validated['q'])) {
      $q = $validated['q'];
      $query->where(fn ($w) => $w->where('name', 'LIKE', "%{$q}%")->orWhere('name_ar', 'LIKE', "%{$q}%"));
    }
    if (!empty($validated['min_stars'])) {
      $query->where('star_rating', '>=', $validated['min_stars']);
    }
    if (!empty($validated['max_price'])) {
      $query->where('now_show_rate', '<=', $validated['max_price']);
    }

    $hotels = $query->orderBy('name')
      ->paginate(20)
      ->through(fn ($h) => [
        'id' => $h->id,
        'name' => $h->name,
        'name_ar' => $h->name_ar,
        'city' => $h->city,
        'city_ar' => $h->city_ar,
        'slug' => $h->slug,
        'lat' => $h->lat,
        'lng' => $h->lng,
        'star_rating' => $h->star_rating,
        'now_show_rate' => $h->now_show_rate,
        'currency' => $h->currency,
        'thumb_url' => $h->thumb_url,
        'source_url' => $h->source_url,
      ]);

    return response()->json($hotels);
  }

  public function show(int $id)
  {
    $hotel = Hotel::findOrFail($id);

    return response()->json([
      'id' => $hotel->id,
      'name' => $hotel->name,
      'name_ar' => $hotel->name_ar,
      'city' => $hotel->city,
      'city_ar' => $hotel->city_ar,
      'city_slug' => $hotel->city_slug,
      'slug' => $hotel->slug,
      'lat' => $hotel->lat,
      'lng' => $hotel->lng,
      'star_rating' => $hotel->star_rating,
      'rating' => $hotel->rating,
      'review_count' => $hotel->review_count,
      'now_show_rate' => $hotel->now_show_rate,
      'currency' => $hotel->currency,
      'address' => $hotel->address,
      'address_ar' => $hotel->address_ar,
      'phone' => $hotel->phone,
      'email' => $hotel->email,
      'description' => $hotel->description,
      'description_ar' => $hotel->description_ar,
      'images' => $hotel->images,
      'has_restaurant' => $hotel->has_restaurant,
      'has_swimming_pool' => $hotel->has_swimming_pool,
      'has_spa' => $hotel->has_spa,
      'has_fitness_center' => $hotel->has_fitness_center,
      'has_parking' => $hotel->has_parking,
      'has_airport_shuttle' => $hotel->has_airport_shuttle,
      'has_bar' => $hotel->has_bar,
      'has_room_service' => $hotel->has_room_service,
      'source_url' => $hotel->source_url,
    ]);
  }
}
