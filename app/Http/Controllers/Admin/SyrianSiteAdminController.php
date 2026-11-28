<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SyrianSite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SyrianSiteAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = SyrianSite::query()->ordered();

        if ($request->filled('category')) {
            $query->where('category', (string) $request->query('category'));
        }
        if ($request->has('is_active') && $request->query('is_active') !== '') {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }
        if ($request->filled('q')) {
            $q = '%'.trim((string) $request->query('q')).'%';
            $query->where(function ($sub) use ($q) {
                $sub->where('name', 'like', $q)
                    ->orWhere('slug', 'like', $q)
                    ->orWhere('description', 'like', $q)
                    ->orWhere('url', 'like', $q)
                    ->orWhere('category', 'like', $q);
            });
        }

        $sites = $query->get();

        return response()->json([
            'success' => true,
            'sites' => $sites,
            'total' => $sites->count(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());

        $slug = trim((string) ($data['slug'] ?? ''));
        if ($slug === '') {
            $base = Str::slug((string) $data['name']) ?: 'site';
            $slug = $base.'-'.substr(sha1($data['name'].'|'.$data['url']), 0, 8);
        }

        $site = SyrianSite::create([
            'slug' => $slug,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'url' => $data['url'],
            'category' => $data['category'] ?? null,
            'tags' => $data['tags'] ?? [],
            'icon_url' => $data['icon_url'] ?? null,
            'is_active' => (bool) ($data['is_active'] ?? true),
            'sort_order' => (int) ($data['sort_order'] ?? ((int) SyrianSite::max('sort_order')) + 1),
        ]);

        SyrianSite::forgetPublicCache();

        return response()->json([
            'success' => true,
            'site' => $site,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $site = SyrianSite::findOrFail($id);
        $data = $request->validate($this->rules($site, isUpdate: true));

        $site->fill($data);
        $site->save();

        SyrianSite::forgetPublicCache();

        return response()->json([
            'success' => true,
            'site' => $site->fresh(),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $site = SyrianSite::findOrFail($id);
        $site->delete();

        SyrianSite::forgetPublicCache();

        return response()->json(['success' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(?SyrianSite $site = null, bool $isUpdate = false): array
    {
        $required = $isUpdate ? 'sometimes' : 'required';

        return [
            'slug' => [
                $isUpdate ? 'sometimes' : 'nullable',
                'string',
                'max:128',
                'regex:/^[a-z0-9-]+$/',
                Rule::unique('syrian_sites', 'slug')->ignore($site?->id),
            ],
            'name' => [$required, 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'url' => [$required, 'string', 'max:2048', 'starts_with:http://,https://'],
            'category' => ['nullable', 'string', 'max:128'],
            'tags' => ['nullable', 'array', 'max:30'],
            'tags.*' => ['string', 'max:64'],
            'icon_url' => ['nullable', 'string', 'max:2048', 'starts_with:http://,https://'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
