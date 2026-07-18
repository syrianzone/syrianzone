<?php

namespace App\Http\Controllers;

use App\Models\Place;
use App\Models\PlacePhoto;
use App\Services\PlaceImageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class PlaceController extends Controller
{
  // list shapes only read the first thumb, skip hydrating full photo rows
  public static function thumbPhotos(): array
  {
    // updated_at feeds the cache-busting ?v= in thumb_url
    return ['photos' => fn ($q) => $q->select('id', 'place_id', 'thumb_path', 'sort', 'updated_at')];
  }

  public function renderIndex()
  {
    return Inertia::render('Places/Index');
  }

  public function mapData()
  {
    $geojson = Cache::remember('places:map', 300, function () {
      $places = Place::where('status', 'approved')->with(self::thumbPhotos())->get();
      return [
        'type' => 'FeatureCollection',
        'features' => $places->map(fn ($p) => [
          'type' => 'Feature',
          'geometry' => ['type' => 'Point', 'coordinates' => [$p->lng, $p->lat]],
          'properties' => [
            'id' => $p->id,
            'name' => $p->name,
            'category' => $p->category,
            // user_id lets the client filter pins to one guide without a per-user cache
            'user_id' => (int) $p->user_id,
            'thumb_url' => $p->photos->first()?->thumb_url,
          ],
        ])->values()->all(),
      ];
    });

    // 60s of client-side staleness is accepted: moved or moderated pins may linger
    // one minute in browsers, same as approvals appearing; server cache busts instantly
    return response()->json($geojson)->header('Cache-Control', 'public, max-age=60');
  }

  public function index(Request $request)
  {
    $validated = $request->validate([
      'category' => 'sometimes|string|in:historical,natural,cultural,religious,abandoned,viewpoint,market,food,other',
      'q' => 'sometimes|string|max:100',
      'sort' => 'sometimes|in:newest,popular',
      'user_id' => 'sometimes|integer|min:1',
    ]);

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

    return response()->json($query->paginate(20)->through(fn ($p) => $this->listItem($p)));
  }

  // Google Places text search, proxied so the key stays server side. Results are
  // biased to the same Syria box the submit form enforces and cached per query.
  public function geocode(Request $request)
  {
    $validated = $request->validate(['q' => 'required|string|min:2|max:100']);
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
            'regionCode' => 'SY',
            'locationBias' => ['rectangle' => [
              'low' => ['latitude' => 32.0, 'longitude' => 35.5],
              'high' => ['latitude' => 37.5, 'longitude' => 42.5],
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

  public function nearby(Request $request)
  {
    $validated = $request->validate([
      'lat' => 'required|numeric|between:-90,90',
      'lng' => 'required|numeric|between:-180,180',
      'radius_km' => 'sometimes|numeric|between:0.05,25',
      // Strict boolean rule rejects the "true"/"false" strings axios puts in query params.
      'include_pending' => 'sometimes|in:0,1,true,false',
    ]);

    $lat = (float) $validated['lat'];
    $lng = (float) $validated['lng'];
    $radiusKm = (float) ($validated['radius_km'] ?? 2);
    // Only the requester's own pending places are included, or any account could
    // enumerate other users' unmoderated submissions that show deliberately 404s.
    $includePending = $request->boolean('include_pending') && $request->user();

    $latDelta = $radiusKm / 111.045;
    $lngDelta = $radiusKm / (111.045 * max(cos(deg2rad($lat)), 0.01));

    $candidates = Place::where(function ($q) use ($includePending, $request) {
        $q->where('status', 'approved');
        if ($includePending) {
          $q->orWhere(fn ($own) => $own->where('status', 'pending')->where('user_id', $request->user()->id));
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
      ->map(fn ($p) => $this->listItem($p) + ['distance_m' => $p->distance_m]);

    return response()->json(['places' => $places]);
  }

  public function show(Request $request, int $id)
  {
    $place = Place::with(['user', 'photos'])->findOrFail($id);
    $user = $request->user();

    if ($place->status !== 'approved') {
      $canSee = $user && ($user->id === $place->user_id || in_array($user->role, ['admin', 'superadmin']));
      if (!$canSee) {
        return response()->json(['message' => 'Not found'], 404);
      }
    }

    return response()->json($this->listItem($place) + [
      'status' => $place->status,
      'user' => ['id' => $place->user->id, 'name' => $place->user->name, 'avatar_url' => $place->user->avatar_url],
      'photos' => $place->photos->map(fn ($photo) => [
        'id' => $photo->id,
        'thumb_url' => $photo->thumb_url,
        'display_url' => $photo->display_url,
        'sort' => $photo->sort,
      ])->values(),
      'saved_by_me' => $user ? $place->saves()->where('user_id', $user->id)->exists() : false,
      'created_at' => $place->created_at,
    ]);
  }

  public function store(Request $request, PlaceImageService $images)
  {
    if ($request->user()->is_banned) {
      return response()->json(['message' => 'تم حظر حسابك من المساهمة'], 403);
    }

    // quota counts created places, not attempts (route throttle is only a coarse shield)
    $recentCount = Place::where('user_id', $request->user()->id)
      ->where('created_at', '>=', now()->subHour())
      ->count();
    if ($recentCount >= 5) {
      return response()->json(['message' => 'وصلت الحد الأقصى من المساهمات لهذه الساعة، حاول لاحقاً'], 429);
    }

    $validated = $request->validate([
      'name' => 'required|string|max:160',
      'category' => 'required|string|in:historical,natural,cultural,religious,abandoned,viewpoint,market,food,other',
      'description' => 'required|string|min:20|max:1000',
      'lat' => 'required|numeric|between:32.0,37.5',
      'lng' => 'required|numeric|between:35.5,42.5',
      'photos' => 'required|array|min:1|max:10',
      // max_width/max_height cap decompression bombs before GD allocates the bitmap
      'photos.*' => 'required|image|mimes:jpg,jpeg,png,webp|max:12288|dimensions:min_width=200,min_height=200,max_width=6000,max_height=6000',
    ], [
      'name.required' => 'أدخل اسم المكان',
      'name.string' => 'اسم المكان يجب أن يكون نصاً',
      'name.max' => 'اسم المكان يجب ألا يتجاوز 160 حرفاً',
      'category.required' => 'اختر التصنيف',
      'category.string' => 'التصنيف المختار غير صالح',
      'category.in' => 'التصنيف المختار غير صالح',
      'description.required' => 'أدخل وصف المكان',
      'description.string' => 'الوصف يجب أن يكون نصاً',
      'description.min' => 'الوصف يجب ألا يقل عن 20 حرفاً',
      'description.max' => 'الوصف يجب ألا يتجاوز 1000 حرف',
      'lat.required' => 'حدد موقع المكان على الخريطة',
      'lat.numeric' => 'خط العرض يجب أن يكون رقماً',
      'lat.between' => 'خط العرض يجب أن يكون بين 32.0 و 37.5 (داخل سوريا)',
      'lng.required' => 'حدد موقع المكان على الخريطة',
      'lng.numeric' => 'خط الطول يجب أن يكون رقماً',
      'lng.between' => 'خط الطول يجب أن يكون بين 35.5 و 42.5 (داخل سوريا)',
      'photos.required' => 'أضف صورة واحدة على الأقل',
      'photos.array' => 'صيغة الصور المرسلة غير صالحة',
      'photos.min' => 'أضف صورة واحدة على الأقل',
      'photos.max' => 'الحد الأقصى 10 صور',
      // implicit rule when PHP itself rejects the upload (e.g. over upload_max_filesize)
      'photos.*.uploaded' => 'تعذر رفع الصورة، تأكد أن حجمها لا يتجاوز 12 ميغابايت',
      'photos.*.required' => 'تعذر قراءة إحدى الصور، أعد اختيارها',
      'photos.*.image' => 'الملف يجب أن يكون صورة',
      'photos.*.mimes' => 'الصورة يجب أن تكون بصيغة JPG أو PNG أو WebP',
      'photos.*.max' => 'حجم الصورة يجب ألا يتجاوز 12 ميغابايت',
      'photos.*.dimensions' => 'أبعاد الصورة يجب أن تكون بين 200x200 و 6000x6000 بكسل',
    ]);

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

  public function mine(Request $request)
  {
    $places = Place::where('user_id', $request->user()->id)
      ->with(self::thumbPhotos())
      ->latest()
      ->paginate(20)
      ->through(fn ($p) => $this->listItem($p) + [
        'status' => $p->status,
        'rejection_reason' => $p->rejection_reason,
        'created_at' => $p->created_at,
      ]);

    return response()->json($places);
  }

  public function updateLocation(Request $request, int $id)
  {
    // Ownership scoping: strangers and unknown ids both get 404, no existence leak.
    $place = Place::where('user_id', $request->user()->id)->findOrFail($id);

    $validated = $request->validate([
      'lat' => 'required|numeric|between:32.0,37.5',
      'lng' => 'required|numeric|between:35.5,42.5',
    ], [
      'lat.required' => 'أدخل الإحداثيات',
      'lat.numeric' => 'خط العرض يجب أن يكون رقماً',
      'lat.between' => 'خط العرض يجب أن يكون بين 32.0 و 37.5 (داخل سوريا)',
      'lng.required' => 'أدخل الإحداثيات',
      'lng.numeric' => 'خط الطول يجب أن يكون رقماً',
      'lng.between' => 'خط الطول يجب أن يكون بين 35.5 و 42.5 (داخل سوريا)',
    ]);

    // Any moved pin re-enters the moderation queue, whatever its prior status.
    $this->backToPending($place, ['lat' => $validated['lat'], 'lng' => $validated['lng']]);

    return response()->json([
      'id' => $place->id,
      'lat' => $place->lat,
      'lng' => $place->lng,
      'status' => 'pending',
    ]);
  }

  public function updateDetails(Request $request, int $id)
  {
    $place = Place::where('user_id', $request->user()->id)->findOrFail($id);

    $validated = $request->validate([
      'name' => 'sometimes|required|string|max:160',
      'category' => 'sometimes|required|string|in:historical,natural,cultural,religious,abandoned,viewpoint,market,food,other',
      'description' => 'sometimes|required|string|min:20|max:1000',
    ], [
      'name.required' => 'أدخل اسم المكان',
      'name.string' => 'اسم المكان يجب أن يكون نصاً',
      'name.max' => 'اسم المكان يجب ألا يتجاوز 160 حرفاً',
      'category.required' => 'اختر التصنيف',
      'category.string' => 'التصنيف المختار غير صالح',
      'category.in' => 'التصنيف المختار غير صالح',
      'description.required' => 'أدخل وصف المكان',
      'description.string' => 'الوصف يجب أن يكون نصاً',
      'description.min' => 'الوصف يجب ألا يقل عن 20 حرفاً',
      'description.max' => 'الوصف يجب ألا يتجاوز 1000 حرف',
    ]);

    if ($validated === []) {
      return response()->json(['message' => 'لا توجد تعديلات'], 422);
    }

    // Edited content re-enters the moderation queue with any prior verdict cleared.
    $this->backToPending($place, $validated);

    return response()->json([
      'id' => $place->id,
      'name' => $place->name,
      'category' => $place->category,
      'description' => $place->description,
      'status' => 'pending',
    ]);
  }

  public function addPhoto(Request $request, int $id, PlaceImageService $images)
  {
    $place = Place::where('user_id', $request->user()->id)->findOrFail($id);

    $request->validate([
      'photo' => 'required|image|mimes:jpg,jpeg,png,webp|max:12288|dimensions:min_width=200,min_height=200,max_width=6000,max_height=6000',
    ], $this->photoMessages());

    // guard + store under a lock on the place row so two concurrent adds cannot
    // both read count 9 and end at 11 (sqlite ignores FOR UPDATE but serializes writes)
    $photo = DB::transaction(function () use ($place, $request, $images) {
      Place::whereKey($place->id)->lockForUpdate()->first();
      if ($place->photos()->count() >= 10) {
        return null;
      }
      $photo = $images->store($request->file('photo'), $place->id, (int) $place->photos()->max('sort') + 1);
      $place->update(['status' => 'pending', 'rejection_reason' => null, 'approved_at' => null]);
      return $photo;
    });
    if ($photo === null) {
      return response()->json(['message' => 'لا يمكن إضافة أكثر من 10 صور'], 422);
    }
    Cache::forget('places:map');

    return response()->json([
      'id' => $photo->id,
      'thumb_url' => $photo->thumb_url,
      'display_url' => $photo->display_url,
      'sort' => $photo->sort,
      'place_status' => 'pending',
    ], 201);
  }

  public function deletePhoto(Request $request, int $id, PlaceImageService $images)
  {
    $photo = PlacePhoto::whereHas('place', fn ($q) => $q->where('user_id', $request->user()->id))->findOrFail($id);

    // same lock as addPhoto: two concurrent deletes on a 2-photo place must not
    // both pass the min-1 guard and leave the place with zero photos
    $deleted = DB::transaction(function () use ($photo) {
      $place = Place::whereKey($photo->place_id)->lockForUpdate()->first();
      if (PlacePhoto::where('place_id', $photo->place_id)->count() <= 1) {
        return false;
      }
      $photo->delete();
      $place->update(['status' => 'pending', 'rejection_reason' => null, 'approved_at' => null]);
      return true;
    });
    if (!$deleted) {
      return response()->json(['message' => 'لا يمكن حذف الصورة الأخيرة'], 422);
    }

    // files go after the row commit so a rollback cannot orphan the photo row
    $images->deleteFiles($photo);
    Cache::forget('places:map');

    return response()->json(['id' => $photo->id, 'place_status' => 'pending']);
  }

  public function rotatePhoto(Request $request, int $id, PlaceImageService $images)
  {
    $photo = PlacePhoto::whereHas('place', fn ($q) => $q->where('user_id', $request->user()->id))->findOrFail($id);

    try {
      $images->rotateClockwise($photo);
    } catch (\RuntimeException $e) {
      return response()->json(['message' => 'ملف الصورة مفقود على الخادم'], 422);
    }
    // pixels only: approval status is deliberately KEPT, but the map cache embeds
    // versioned thumb urls so it must still be forgotten
    Cache::forget('places:map');

    return response()->json([
      'id' => $photo->id,
      'thumb_url' => $photo->thumb_url,
      'display_url' => $photo->display_url,
    ]);
  }

  public function destroy(Request $request, int $id, PlaceImageService $images)
  {
    $place = Place::where('user_id', $request->user()->id)->with('photos')->findOrFail($id);

    // owner deletion is immediate, no moderation round-trip
    foreach ($place->photos as $photo) {
      $images->deleteFiles($photo);
    }
    $place->delete();
    Cache::forget('places:map');

    return response()->json(null, 204);
  }

  public function resubmit(Request $request, int $id)
  {
    $place = Place::where('user_id', $request->user()->id)->findOrFail($id);

    if ($place->status !== 'rejected') {
      return response()->json(['message' => 'لا يمكن إعادة إرسال هذا المكان'], 400);
    }

    // nothing but the moderation state changes; photos and fields stay as-is
    $this->backToPending($place);

    return response()->json(['id' => $place->id, 'status' => 'pending']);
  }

  // Owner content mutations re-enter moderation: any prior rejection reason and
  // approval are cleared, and the (possibly approved) pin leaves the public map.
  private function backToPending(Place $place, array $extra = []): void
  {
    $place->update($extra + ['status' => 'pending', 'rejection_reason' => null, 'approved_at' => null]);
    Cache::forget('places:map');
  }

  private function photoMessages(): array
  {
    return [
      'photo.required' => 'أضف صورة',
      'photo.image' => 'الملف يجب أن يكون صورة',
      'photo.mimes' => 'الصورة يجب أن تكون بصيغة JPG أو PNG أو WebP',
      'photo.max' => 'حجم الصورة يجب ألا يتجاوز 12 ميغابايت',
      'photo.uploaded' => 'تعذر رفع الصورة، تأكد أن حجمها لا يتجاوز 12 ميغابايت',
      'photo.dimensions' => 'أبعاد الصورة يجب أن تكون بين 200x200 و 6000x6000 بكسل',
    ];
  }

  private function listItem(Place $p): array
  {
    return [
      'id' => $p->id,
      'name' => $p->name,
      'category' => $p->category,
      'description' => $p->description,
      'lat' => $p->lat,
      'lng' => $p->lng,
      'thumb_url' => $p->photos->first()?->thumb_url,
      'saves_count' => $p->saves_count,
    ];
  }
}
