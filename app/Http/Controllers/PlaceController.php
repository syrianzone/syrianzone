<?php

namespace App\Http\Controllers;

use App\Models\Place;
use App\Services\PlaceImageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
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
            'thumb_url' => $p->photos->first()?->thumb_url,
          ],
        ])->values()->all(),
      ];
    });

    return response()->json($geojson)->header('Cache-Control', 'public, max-age=60');
  }

  public function index(Request $request)
  {
    $validated = $request->validate([
      'category' => 'sometimes|string|in:historical,natural,cultural,religious,abandoned,viewpoint,market,food,other',
      'q' => 'sometimes|string|max:100',
      'sort' => 'sometimes|in:newest,popular',
    ]);

    $query = Place::where('status', 'approved')->with(self::thumbPhotos());

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
      'photos' => 'required|array|min:1|max:5',
      // max_width/max_height cap decompression bombs before GD allocates the bitmap
      'photos.*' => 'required|image|mimes:jpg,jpeg,png,webp|max:8192|dimensions:min_width=200,min_height=200,max_width=6000,max_height=6000',
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
