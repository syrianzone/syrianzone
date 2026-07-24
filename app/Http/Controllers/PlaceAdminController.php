<?php

namespace App\Http\Controllers;

use App\Models\Place;
use App\Models\PlacePhoto;
use App\Services\PlaceImageService;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Throwable;

class PlaceAdminController extends Controller
{
    public function renderIndex()
    {
        return Inertia::render('Admin/Places/Index');
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'page' => 'sometimes|integer|min:1',
            'status' => 'sometimes|in:pending,approved,rejected,all',
        ]);
        $status = $validated['status'] ?? 'pending';
        $userId = $request->user()->id;

        $query = Place::with(['user', 'photos'])
            ->withExists(['saves as saved_by_me' => fn ($q) => $q->where('user_id', $userId)])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        return response()->json($query->paginate(20)->through(fn ($p) => $this->adminItem($p)));
    }

    public function update(int $id, Request $request)
    {
        $place = Place::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:160',
            'category' => 'sometimes|required|string|in:historical,natural,cultural,religious,abandoned,viewpoint,market,food,other',
            'description' => 'sometimes|required|string|min:20|max:1000',
            'lat' => 'sometimes|required|numeric|between:32.0,37.5',
            'lng' => 'sometimes|required|numeric|between:35.5,42.5',
        ]);

        $place->update($validated);
        // name/category/coords are embedded in the map payload
        Cache::forget('places:map');

        $userId = $request->user()->id;
        $fresh = Place::with(['user', 'photos'])
            ->withExists(['saves as saved_by_me' => fn ($q) => $q->where('user_id', $userId)])
            ->findOrFail($id);

        return response()->json($this->adminItem($fresh));
    }

    public function addPhoto(int $id, Request $request, PlaceImageService $images)
    {
        $request->validate([
            'photo' => [
                'bail',
                'required',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:12288',
                function (string $attribute, mixed $value, callable $fail) use ($images) {
                    if (! $value instanceof UploadedFile || ! $images->dimensionsAreSafe($value)) {
                        $fail('أبعاد الصورة يجب أن تكون بين 200x200 و 6000x6000 بكسل');
                    }
                },
            ],
        ], $this->photoMessages());

        $place = Place::findOrFail($id);

        // guard + store under a lock on the place row so two concurrent adds cannot
        // both read count 9 and end at 11 (sqlite ignores FOR UPDATE but serializes writes)
        $photo = null;
        try {
            DB::transaction(function () use ($place, $request, $images, &$photo) {
                Place::whereKey($place->id)->lockForUpdate()->firstOrFail();
                if ($place->photos()->count() >= 10) {
                    return;
                }

                $maxSort = $place->photos()->max('sort');
                $photo = $images->store($request->file('photo'), $place->id, $maxSort === null ? 0 : (int) $maxSort + 1);
            });
        } catch (Throwable $error) {
            if ($photo) {
                $images->deleteFiles($photo);
            }

            throw $error;
        }
        if ($photo === null) {
            return response()->json(['message' => 'لا يمكن إضافة أكثر من 10 صور'], 422);
        }
        // a first-position thumb can change the map thumb_url; forget unconditionally
        Cache::forget('places:map');

        return response()->json([
            'id' => $photo->id,
            'thumb_url' => $photo->thumb_url,
            'display_url' => $photo->display_url,
            'sort' => $photo->sort,
        ], 201);
    }

    public function deletePhoto(int $id, PlaceImageService $images)
    {
        // same lock as addPhoto: two concurrent deletes on a 2-photo place must not
        // both pass the min-1 guard and leave the place with zero photos
        $photo = null;
        $deleted = DB::transaction(function () use ($id, $images, &$photo) {
            $candidate = PlacePhoto::findOrFail($id);
            Place::whereKey($candidate->place_id)->lockForUpdate()->firstOrFail();
            $photo = PlacePhoto::whereKey($id)->lockForUpdate()->firstOrFail();
            if (PlacePhoto::where('place_id', $photo->place_id)->count() <= 1) {
                return false;
            }
            $images->deleteFiles($photo);
            $photo->delete();

            return true;
        });
        if (! $deleted) {
            return response()->json(['message' => 'لا يمكن حذف الصورة الأخيرة'], 422);
        }

        Cache::forget('places:map');

        return response()->json(null, 204);
    }

    public function approve(int $id)
    {
        $place = DB::transaction(function () use ($id) {
            $place = Place::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($place->status !== 'pending') {
                abort(400, "Place is already {$place->status}");
            }

            $place->update([
                'approved_at' => now(),
                'rejection_reason' => null,
                'status' => 'approved',
            ]);

            return $place;
        });
        Cache::forget('places:map');

        return response()->json(['id' => $place->id, 'status' => 'approved']);
    }

    public function reject(Request $request, int $id)
    {
        $validated = $request->validate(['reason' => 'nullable|string|max:1000']);
        $place = DB::transaction(function () use ($id, $validated) {
            $place = Place::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($place->status !== 'pending') {
                abort(400, "Place is already {$place->status}");
            }

            $place->update([
                'approved_at' => null,
                'rejection_reason' => $validated['reason'] ?? null,
                'status' => 'rejected',
            ]);

            return $place;
        });

        return response()->json(['id' => $place->id, 'status' => 'rejected']);
    }

    public function destroy(int $id, PlaceImageService $images)
    {
        DB::transaction(function () use ($id, $images): void {
            $place = Place::whereKey($id)->lockForUpdate()->firstOrFail();
            foreach ($place->photos()->get() as $photo) {
                $images->deleteFiles($photo);
            }
            $place->delete();
        });
        Cache::forget('places:map');

        return response()->json(null, 204);
    }

    public function rotatePhoto(int $id, PlaceImageService $images)
    {
        $photo = PlacePhoto::findOrFail($id);
        try {
            $images->rotateClockwise($photo);
        } catch (\RuntimeException $e) {
            // the file is gone from disk (cdn may still show a ghost copy): only a re-upload helps
            return response()->json(['message' => 'ملف الصورة مفقود على الخادم، استخدم إعادة الرفع'], 422);
        }
        // the map cache embeds versioned thumb urls
        Cache::forget('places:map');

        return response()->json([
            'id' => $photo->id,
            'thumb_url' => $photo->thumb_url,
            'display_url' => $photo->display_url,
        ]);
    }

    public function replacePhoto(int $id, Request $request, PlaceImageService $images)
    {
        $request->validate([
            'photo' => [
                'bail',
                'required',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:12288',
                function (string $attribute, mixed $value, callable $fail) use ($images) {
                    if (! $value instanceof UploadedFile || ! $images->dimensionsAreSafe($value)) {
                        $fail('أبعاد الصورة يجب أن تكون بين 200x200 و 6000x6000 بكسل');
                    }
                },
            ],
        ], $this->photoMessages());

        $photo = PlacePhoto::findOrFail($id);
        $images->replace($photo, $request->file('photo'));
        Cache::forget('places:map');

        return response()->json([
            'id' => $photo->id,
            'thumb_url' => $photo->thumb_url,
            'display_url' => $photo->display_url,
        ]);
    }

    private function photoMessages(): array
    {
        return [
            'photo.required' => 'أضف صورة',
            'photo.image' => 'الملف يجب أن يكون صورة',
            'photo.mimes' => 'الصورة يجب أن تكون بصيغة JPG أو PNG أو WebP',
            'photo.max' => 'حجم الصورة يجب ألا يتجاوز 12 ميغابايت',
            'photo.uploaded' => 'تعذر رفع الصورة، تأكد أن حجمها لا يتجاوز 12 ميغابايت',
        ];
    }

    private function adminItem(Place $p): array
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
            'status' => $p->status,
            'user' => ['id' => $p->user->id, 'name' => $p->user->name, 'avatar_url' => $p->user->avatar_url],
            'photos' => $p->photos->map(fn ($photo) => [
                'id' => $photo->id,
                'thumb_url' => $photo->thumb_url,
                'display_url' => $photo->display_url,
                'sort' => $photo->sort,
            ])->values(),
            'saved_by_me' => (bool) $p->saved_by_me,
            'created_at' => $p->created_at,
            'rejection_reason' => $p->rejection_reason,
        ];
    }
}
