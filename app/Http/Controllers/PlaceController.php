<?php

namespace App\Http\Controllers;

use App\Models\Place;
use App\Models\PlacePhoto;
use App\Services\GuideLevelService;
use App\Services\PlaceImageService;
use App\Services\Places\PlaceModerationService;
use App\Services\Places\PlacePresenter;
use App\Services\Places\PlaceRules;
use App\Support\Facts;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class PlaceController extends Controller
{
  // List shapes only read the first thumb, so only the cover photo (lowest sort)
  // of each place is loaded, and only the columns thumb_url needs. A place can
  // carry up to ten photos; the map alone was pulling every one of them.
  public static function thumbPhotos(): array
  {
    // updated_at feeds the cache-busting ?v= in thumb_url
    return ['photos' => fn ($q) => $q
      ->select('id', 'place_id', 'thumb_path', 'sort', 'updated_at')
      ->whereRaw('place_photos.sort = (select min(cover.sort) from place_photos as cover where cover.place_id = place_photos.place_id)')];
  }

  public function renderIndex()
  {
    return Inertia::render('Places/Index');
  }

  public function mapData()
  {
    $geojson = Cache::remember(PlaceModerationService::MAP_CACHE_KEY, 300, function () {
      // Every approved place is a pin, so this is the largest read in the
      // module and it is rebuilt after any moderation or photo change. Plain
      // rows instead of a model per place and per photo, with only the pin's
      // columns (no description, no moderation fields) and only the cover.
      $covers = DB::table('place_photos')
        ->join('places', 'places.id', '=', 'place_photos.place_id')
        ->where('places.status', 'approved')
        ->whereRaw('place_photos.sort = (select min(cover.sort) from place_photos as cover where cover.place_id = place_photos.place_id)')
        ->orderBy('place_photos.id')
        ->get(['place_photos.place_id', 'place_photos.thumb_path', 'place_photos.updated_at']);

      $timezone = new \DateTimeZone(config('app.timezone'));
      $thumbs = [];
      foreach ($covers as $cover) {
        // first row wins when two photos share the lowest sort, as before
        $thumbs[$cover->place_id] ??= PlacePhoto::versionedUrlFor(
          $cover->thumb_path,
          $cover->updated_at ? (new \DateTimeImmutable($cover->updated_at, $timezone))->getTimestamp() : null,
        );
      }

      $features = [];
      $places = DB::table('places')->where('status', 'approved')->orderBy('id')
        ->get(['id', 'name', 'category', 'lat', 'lng', 'user_id']);
      foreach ($places as $p) {
        $features[] = [
          'type' => 'Feature',
          'geometry' => ['type' => 'Point', 'coordinates' => [(float) $p->lng, (float) $p->lat]],
          'properties' => [
            'id' => (int) $p->id,
            'name' => $p->name,
            'category' => $p->category,
            // user_id lets the client filter pins to one guide without a per-user cache
            'user_id' => (int) $p->user_id,
            'thumb_url' => $thumbs[$p->id] ?? null,
          ],
        ];
      }

      return ['type' => 'FeatureCollection', 'features' => $features];
    });

    // 60s of client-side staleness is accepted: moved or moderated pins may linger
    // one minute in browsers, same as approvals appearing; server cache busts instantly
    return response()->json($geojson)->header('Cache-Control', 'public, max-age=60');
  }

  public function index(Request $request, PlacePresenter $presenter, PlaceRules $rules)
  {
    $validated = $request->validate($rules->listFilters());

    $query = Place::where('status', 'approved')->with(self::thumbPhotos());

    if (!empty($validated['user_id'])) {
      $query->where('user_id', $validated['user_id']);
    }

    if (!empty($validated['category'])) {
      $query->where('category', $validated['category']);
    }
    if (!empty($validated['q'])) {
      $q = $validated['q'];
      $query->where(fn ($w) => $w->where('name', 'LIKE', "%{$q}%")->orWhere('description', 'LIKE', "%{$q}%"));
    }
    if (($validated['sort'] ?? 'newest') === 'popular') {
      $query->orderByDesc('saves_count')->latest();
    } else {
      $query->latest();
    }

    return response()->json($query->paginate(20)->through(fn ($p) => $presenter->publicListItem($p)));
  }

  // Google Places text search, proxied so the key stays server side. Results are
  // biased to the same Syria box the submit form enforces and cached per query.
  public function geocode(Request $request, PlaceRules $rules)
  {
    $validated = $request->validate($rules->geocode());
    $key = config('services.google_places.key');
    if (!$key) {
      return response()->json(['suggestions' => []]);
    }

    $cacheKey = 'places:geo:' . md5($validated['q']);
    $suggestions = Cache::get($cacheKey);
    if ($suggestions === null) {
      try {
        $response = Http::timeout(5)
          ->withHeaders([
            'X-Goog-Api-Key' => $key,
            'X-Goog-FieldMask' => 'places.displayName,places.formattedAddress,places.location',
          ])
          ->post('https://places.googleapis.com/v1/places:searchText', [
            'textQuery' => $validated['q'],
            'languageCode' => 'ar',
            'regionCode' => Facts::syria()['country_code'],
            'locationBias' => ['rectangle' => [
              'low' => ['latitude' => (float) PlaceRules::latMin(), 'longitude' => (float) PlaceRules::lngMin()],
              'high' => ['latitude' => (float) PlaceRules::latMax(), 'longitude' => (float) PlaceRules::lngMax()],
            ]],
            'maxResultCount' => 5,
          ]);
      } catch (\Throwable $e) {
        return response()->json(['suggestions' => []]);
      }
      if (!$response->successful()) {
        // failures are not cached so a transient error does not stick for a day
        return response()->json(['suggestions' => []]);
      }
      $suggestions = collect($response->json('places') ?? [])
        ->map(fn ($p) => [
          'name' => $p['displayName']['text'] ?? '',
          'address' => $p['formattedAddress'] ?? '',
          'lat' => $p['location']['latitude'] ?? null,
          'lng' => $p['location']['longitude'] ?? null,
        ])
        ->filter(fn ($p) => $p['name'] !== '' && $p['lat'] !== null && $p['lng'] !== null)
        ->values()
        ->all();
      Cache::put($cacheKey, $suggestions, 86400);
    }

    return response()->json(['suggestions' => $suggestions])->header('Cache-Control', 'public, max-age=3600');
  }

  public function nearby(Request $request, PlacePresenter $presenter, PlaceRules $rules)
  {
    $validated = $request->validate($rules->nearby());

    $lat = (float) $validated['lat'];
    $lng = (float) $validated['lng'];
    $radiusKm = (float) ($validated['radius_km'] ?? Facts::places()['nearby']['radius_km_default']);
    $user = $request->user();
    // Only the requester's own pending places are included, or any account could
    // enumerate other users' unmoderated submissions that show deliberately 404s.
    $includePending = $request->boolean('include_pending') && $user;

    $latDelta = $radiusKm / 111.045;
    $lngDelta = $radiusKm / (111.045 * max(cos(deg2rad($lat)), 0.01));

    $candidates = Place::where(function ($q) use ($includePending, $user) {
        $q->where('status', 'approved');
        if ($includePending) {
          $q->orWhere(fn ($own) => $own->where('status', 'pending')->where('user_id', $user->id));
        }
      })
      ->whereBetween('lat', [$lat - $latDelta, $lat + $latDelta])
      ->whereBetween('lng', [$lng - $lngDelta, $lng + $lngDelta])
      ->with(self::thumbPhotos())
      ->get();

    $radiusM = $radiusKm * 1000;
    $places = $candidates
      ->map(function ($p) use ($lat, $lng) {
        $dLat = deg2rad($p->lat - $lat);
        $dLng = deg2rad($p->lng - $lng);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat)) * cos(deg2rad($p->lat)) * sin($dLng / 2) ** 2;
        $p->distance_m = (int) round(6371000 * 2 * asin(sqrt($a)));
        return $p;
      })
      ->filter(fn ($p) => $p->distance_m <= $radiusM)
      ->sortBy('distance_m')
      ->take(20)
      ->values()
      ->map(fn ($p) => $presenter->publicListItem($p) + ['distance_m' => $p->distance_m]);

    return response()->json(['places' => $places]);
  }

  public function show(Request $request, GuideLevelService $levels, PlacePresenter $presenter, int $id)
  {
    $place = Place::with(['user', 'photos'])->findOrFail($id);
    $user = $request->user();

    if ($place->status !== 'approved') {
      // Owner, or staff with a places capability. User::hasAnyPermission()
      // already resolves superadmin, so no separate role check is needed.
      $canSee = $user && ($user->id === $place->user_id
          || $user->hasAnyPermission(PermissionCatalogue::forModule('places')));
      if (!$canSee) {
        return response()->json(['message' => 'العنصر غير موجود.'], 404);
      }
    }

    $guide = $levels->forUser($place->user_id);
    $savedByMe = $user ? $place->saves()->where('user_id', $user->id)->exists() : false;

    return response()->json($presenter->publicDetail($place, $guide, $savedByMe));
  }

  public function store(Request $request, PlaceImageService $images, PlaceRules $rules)
  {
    if ($request->user()->is_banned) {
      return response()->json(['message' => 'تم حظر حسابك من المساهمة'], 403);
    }

    $validated = $request->validate($rules->store(), $rules->messages());

    $stored = [];
    try {
      $place = DB::transaction(function () use ($request, $validated, $images, &$stored) {
        $place = Place::create([
          'user_id' => $request->user()->id,
          'name' => $validated['name'],
          'category' => $validated['category'],
          'description' => $validated['description'],
          'lat' => $validated['lat'],
          'lng' => $validated['lng'],
          'status' => 'pending',
        ]);
        foreach ($request->file('photos') as $sort => $file) {
          $stored[] = $images->store($file, $place->id, $sort);
        }
        return $place;
      });
    } catch (\Throwable $e) {
      // rollback erases the rows but not the disk: drop earlier photos' files too
      foreach ($stored as $photo) {
        $images->deleteFiles($photo);
      }
      throw $e;
    }

    return response()->json(['id' => $place->id, 'status' => 'pending'], 201);
  }

  public function mine(Request $request, PlacePresenter $presenter)
  {
    $places = Place::where('user_id', $request->user()->id)
      ->with(self::thumbPhotos())
      ->latest()
      ->paginate(20)
      ->through(fn ($p) => $presenter->ownerListItem($p));

    return response()->json($places);
  }

  public function updateLocation(Request $request, PlaceRules $rules, PlaceModerationService $places, int $id)
  {
    // Ownership scoping: strangers and unknown ids both get 404, no existence leak.
    $place = Place::where('user_id', $request->user()->id)->findOrFail($id);

    $validated = $request->validate($rules->location(), $rules->locationMessages());

    // Any moved pin re-enters the moderation queue, whatever its prior status.
    $places->returnToModeration($place, ['lat' => $validated['lat'], 'lng' => $validated['lng']]);

    return response()->json([
      'id' => $place->id,
      'lat' => $place->lat,
      'lng' => $place->lng,
      'status' => 'pending',
    ]);
  }

  public function updateDetails(Request $request, PlaceRules $rules, PlaceModerationService $places, int $id)
  {
    $place = Place::where('user_id', $request->user()->id)->findOrFail($id);

    $validated = $request->validate($rules->details(), $rules->messages());

    if ($validated === []) {
      return response()->json(['message' => 'لا توجد تعديلات'], 422);
    }

    // Edited content re-enters the moderation queue with any prior verdict cleared.
    $places->returnToModeration($place, $validated);

    return response()->json([
      'id' => $place->id,
      'name' => $place->name,
      'category' => $place->category,
      'description' => $place->description,
      'status' => 'pending',
    ]);
  }

  public function addPhoto(Request $request, PlaceRules $rules, PlaceModerationService $places, PlacePresenter $presenter, int $id)
  {
    $place = Place::where('user_id', $request->user()->id)->findOrFail($id);

    $request->validate($rules->photo(), $rules->messages());

    // The owner surface is the one that sends the place back to review.
    $photo = $places->addPhoto($place->id, $request->file('photo'), reentersModeration: true);

    return response()->json($presenter->photo($photo) + ['place_status' => 'pending'], 201);
  }

  public function deletePhoto(Request $request, PlaceModerationService $places, int $id)
  {
    $photo = PlacePhoto::whereHas('place', fn ($q) => $q->where('user_id', $request->user()->id))->findOrFail($id);

    $places->deletePhoto($photo->id, reentersModeration: true);

    return response()->json(['id' => $photo->id, 'place_status' => 'pending']);
  }

  public function rotatePhoto(Request $request, PlaceModerationService $places, PlacePresenter $presenter, int $id)
  {
    $photo = PlacePhoto::whereHas('place', fn ($q) => $q->where('user_id', $request->user()->id))->findOrFail($id);

    // pixels only: approval status is deliberately KEPT
    $photo = $places->rotatePhoto($photo->id, withRecoveryHint: false);

    return response()->json($presenter->photoUrls($photo));
  }

  public function destroy(Request $request, PlaceModerationService $places, int $id)
  {
    $place = Place::where('user_id', $request->user()->id)->findOrFail($id);

    $places->delete($place->id);

    return response()->json(null, 204);
  }

  public function resubmit(Request $request, PlaceModerationService $places, int $id)
  {
    $place = Place::where('user_id', $request->user()->id)->findOrFail($id);

    if ($place->status !== 'rejected') {
      return response()->json(['message' => 'لا يمكن إعادة إرسال هذا المكان'], 400);
    }

    // nothing but the moderation state changes; photos and fields stay as-is
    $places->returnToModeration($place);

    return response()->json(['id' => $place->id, 'status' => 'pending']);
  }
}
