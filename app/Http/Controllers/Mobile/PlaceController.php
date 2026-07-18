<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Place;
use App\Models\User;
use App\Services\PlaceImageService;
use App\Services\PlacePresenter;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class PlaceController extends Controller
{
    public function __construct(
        private readonly PlacePresenter $presenter,
    ) {}

    public function mapData()
    {
        $geojson = Cache::remember('places:map', 300, function () {
            $places = Place::query()
                ->where('status', 'approved')
                ->with('photos')
                ->get();

            return [
                'type' => 'FeatureCollection',
                'features' => $places->map(function (Place $place) {
                    $photo = $place->photos->first();

                    return [
                        'type' => 'Feature',
                        'geometry' => [
                            'type' => 'Point',
                            'coordinates' => [$place->lng, $place->lat],
                        ],
                        'properties' => [
                            'id' => $place->id,
                            'name' => $place->name,
                            'category' => $place->category,
                            'thumb_url' => $photo
                              ? Storage::disk('public')->url($photo->thumb_path)
                              : null,
                        ],
                    ];
                })->values()->all(),
            ];
        });

        return response()->json($geojson)->header('Cache-Control', 'public, max-age=60');
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'category' => 'sometimes|string|in:'.implode(',', Place::CATEGORIES),
            'page' => 'sometimes|integer|min:1',
            'q' => 'sometimes|string|max:100',
            'sort' => 'sometimes|string|in:newest,popular',
        ]);

        $query = Place::query()
            ->where('status', 'approved')
            ->with('photos');

        if (isset($validated['category'])) {
            $query->where('category', $validated['category']);
        }

        if (isset($validated['q']) && trim($validated['q']) !== '') {
            $term = trim($validated['q']);
            $query->where(function ($where) use ($term) {
                $where
                    ->where('name', 'like', "%{$term}%")
                    ->orWhere('description', 'like', "%{$term}%");
            });
        }

        if (($validated['sort'] ?? 'newest') === 'popular') {
            $query->orderByDesc('likes_count');
        }

        $places = $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(20)
            ->through(fn (Place $place) => $this->presenter->listItem($place));

        return response()->json($places);
    }

    public function nearby(Request $request)
    {
        $validated = $request->validate([
            'include_pending' => 'sometimes|in:0,1,true,false',
            'lat' => 'required|numeric|between:32.0,37.5',
            'lng' => 'required|numeric|between:35.5,42.5',
            'radius_km' => 'sometimes|numeric|between:0.05,25',
        ]);
        $lat = (float) $validated['lat'];
        $lng = (float) $validated['lng'];
        $radiusKm = (float) ($validated['radius_km'] ?? 2);
        $viewer = $this->verifiedViewer($request);
        $includePending = $request->boolean('include_pending') && $viewer;
        $latDelta = $radiusKm / 111.045;
        $lngDelta = $radiusKm / (111.045 * max(cos(deg2rad($lat)), 0.01));

        $query = Place::query()
            ->where(function ($where) use ($includePending, $viewer) {
                $where->where('status', 'approved');

                if (! $includePending || ! $viewer) {
                    return;
                }

                $where->orWhere(function ($pending) use ($viewer) {
                    $pending->where('status', 'pending');

                    if (! in_array($viewer->role, ['admin', 'superadmin'], true)) {
                        $pending->where('user_id', $viewer->id);
                    }
                });
            })
            ->whereBetween('lat', [$lat - $latDelta, $lat + $latDelta])
            ->whereBetween('lng', [$lng - $lngDelta, $lng + $lngDelta])
            ->with('photos');

        $radiusM = $radiusKm * 1000;
        $places = $query
            ->get()
            ->map(function (Place $place) use ($lat, $lng) {
                $latDifference = deg2rad($place->lat - $lat);
                $lngDifference = deg2rad($place->lng - $lng);
                $a = sin($latDifference / 2) ** 2
                  + cos(deg2rad($lat))
                  * cos(deg2rad($place->lat))
                  * sin($lngDifference / 2) ** 2;
                $place->distance_m = (int) round(6_371_000 * 2 * asin(min(1, sqrt($a))));

                return $place;
            })
            ->filter(fn (Place $place) => $place->distance_m <= $radiusM)
            ->sortBy('distance_m')
            ->take(20)
            ->values()
            ->map(fn (Place $place) => $this->presenter->listItem($place) + [
                'distance_m' => $place->distance_m,
            ])
            ->all();

        return response()->json(['places' => $places]);
    }

    public function show(Request $request, int $id)
    {
        $place = Place::query()->with(['photos', 'user'])->findOrFail($id);
        $viewer = $this->verifiedViewer($request);

        if ($place->status !== 'approved' && ! $this->mayViewUnpublished($place, $viewer)) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json($this->presenter->detail($place, $viewer?->id));
    }

    public function store(Request $request, PlaceImageService $images)
    {
        $request->merge([
            'description' => is_string($request->input('description'))
              ? trim($request->input('description'))
              : $request->input('description'),
            'name' => is_string($request->input('name'))
              ? trim($request->input('name'))
              : $request->input('name'),
        ]);
        $validated = $request->validate([
            'category' => 'required|string|in:'.implode(',', Place::CATEGORIES),
            'description' => 'required|string|min:20|max:1000',
            'lat' => 'required|numeric|between:32.0,37.5',
            'lng' => 'required|numeric|between:35.5,42.5',
            'name' => 'required|string|max:160',
            'photos' => 'required|array|min:1|max:5',
            'photos.*' => [
                'bail',
                'required',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:8192',
                function (string $attribute, mixed $value, callable $fail) use ($images) {
                    if (! $value instanceof UploadedFile || ! $images->dimensionsAreSafe($value)) {
                        $fail('The image dimensions are not supported.');
                    }
                },
            ],
        ]);

        $placeId = null;

        try {
            $place = DB::transaction(function () use ($request, $validated, $images, &$placeId) {
                $place = Place::create([
                    'user_id' => $request->user()->id,
                    'name' => $validated['name'],
                    'category' => $validated['category'],
                    'description' => $validated['description'],
                    'lat' => $validated['lat'],
                    'lng' => $validated['lng'],
                    'status' => 'pending',
                ]);
                $placeId = $place->id;

                foreach ($request->file('photos') as $sort => $file) {
                    $images->store($file, $place->id, $sort);
                }

                return $place;
            });
        } catch (Throwable $error) {
            if ($placeId) {
                $images->deletePlaceFiles($placeId);
            }

            throw $error;
        }

        return response()->json(['id' => $place->id, 'status' => 'pending'], 201);
    }

    public function mine(Request $request)
    {
        $request->validate(['page' => 'sometimes|integer|min:1']);
        $places = Place::query()
            ->where('user_id', $request->user()->id)
            ->with('photos')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(20)
            ->through(fn (Place $place) => $this->presenter->listItem($place) + [
                'status' => $place->status,
                'rejection_reason' => $place->rejection_reason,
                'created_at' => $place->created_at->toISOString(),
            ]);

        return response()->json($places);
    }

    private function verifiedViewer(Request $request): ?User
    {
        return $request->bearerToken() && $request->user() instanceof User
          ? $request->user()
          : null;
    }

    private function mayViewUnpublished(Place $place, ?User $viewer): bool
    {
        return $viewer && (
            $viewer->id === $place->user_id
            || in_array($viewer->role, ['admin', 'superadmin'], true)
        );
    }
}
