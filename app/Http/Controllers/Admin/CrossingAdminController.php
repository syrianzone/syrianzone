<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Crossing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CrossingAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Crossing::query()->ordered();

        if ($request->filled('type')) {
            $query->where('type', (string) $request->query('type'));
        }
        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }
        if ($request->has('is_active') && $request->query('is_active') !== '') {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }
        if ($request->filled('q')) {
            $q = '%'.trim((string) $request->query('q')).'%';
            $query->where(function ($sub) use ($q) {
                $sub->where('name_ar', 'like', $q)
                    ->orWhere('name_en', 'like', $q)
                    ->orWhere('slug', 'like', $q)
                    ->orWhere('country', 'like', $q)
                    ->orWhere('governorate', 'like', $q);
            });
        }

        $crossings = $query->get();

        return response()->json([
            'success' => true,
            'crossings' => $crossings,
            'total' => $crossings->count(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());

        $slug = trim((string) ($data['slug'] ?? ''));
        if ($slug === '') {
            $slug = Str::slug((string) ($data['name_en'] ?: $data['name_ar'])) ?: 'crossing-'.Str::lower(Str::random(6));
        }

        $crossing = Crossing::create([
            'slug' => $slug,
            'name_ar' => $data['name_ar'],
            'name_en' => $data['name_en'] ?? null,
            'country' => $data['country'] ?? null,
            'governorate' => $data['governorate'] ?? null,
            'type' => $data['type'] ?? 'crossing',
            'status' => $data['status'] ?? 'open',
            'hours_ar' => $data['hours_ar'] ?? null,
            'notes_ar' => $data['notes_ar'] ?? null,
            'phone' => $data['phone'] ?? null,
            'lat' => $data['lat'] ?? null,
            'lng' => $data['lng'] ?? null,
            'sort_order' => (int) ($data['sort_order'] ?? ((int) Crossing::max('sort_order')) + 1),
            'is_active' => (bool) ($data['is_active'] ?? true),
            'meta' => $data['meta'] ?? null,
        ]);

        Crossing::forgetPublicCache();

        return response()->json([
            'success' => true,
            'crossing' => $crossing,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $crossing = Crossing::findOrFail($id);
        $data = $request->validate($this->rules($crossing, isUpdate: true));

        $crossing->fill($data);
        $crossing->save();

        Crossing::forgetPublicCache();

        return response()->json([
            'success' => true,
            'crossing' => $crossing->fresh(),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $crossing = Crossing::findOrFail($id);
        $crossing->delete();

        Crossing::forgetPublicCache();

        return response()->json(['success' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(?Crossing $crossing = null, bool $isUpdate = false): array
    {
        $required = $isUpdate ? 'sometimes' : 'required';

        return [
            'slug' => [
                $isUpdate ? 'sometimes' : 'nullable',
                'string',
                'max:128',
                'regex:/^[a-z0-9-]+$/',
                Rule::unique('crossings', 'slug')->ignore($crossing?->id),
            ],
            'name_ar' => [$required, 'string', 'max:255'],
            'name_en' => ['nullable', 'string', 'max:255'],
            'country' => ['nullable', 'string', 'max:128'],
            'governorate' => ['nullable', 'string', 'max:128'],
            'type' => ['sometimes', 'string', Rule::in(['crossing', 'port'])],
            'status' => ['sometimes', 'string', Rule::in(['open', 'closed', 'opening_soon', 'unknown'])],
            'hours_ar' => ['nullable', 'string', 'max:500'],
            'notes_ar' => ['nullable', 'string', 'max:5000'],
            'phone' => ['nullable', 'string', 'max:64'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'meta' => ['nullable', 'array'],
        ];
    }
}
