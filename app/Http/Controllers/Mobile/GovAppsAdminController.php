<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Models\GovApp;
use App\Services\DirectoryAdminAccess;
use App\Services\DirectoryImageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Throwable;

final class GovAppsAdminController extends Controller
{
    private const LINK_KEYS = ['official', 'android', 'apple'];

    public function __construct(
        private readonly DirectoryAdminAccess $access,
        private readonly DirectoryImageService $images,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->access->authorizeRead($request, 'govapps');
        $apps = GovApp::query()
            ->orderBy('order_column')
            ->orderBy('id')
            ->get()
            ->map(fn (GovApp $app): array => $this->resource($app))
            ->values();

        return response()->json(['data' => $apps]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->access->authorizeAction($request, 'govapps', 'create');
        $data = $this->validateApp($request, true);
        $icon = $request->file('icon_file');
        $storedIcon = $icon instanceof UploadedFile
            ? $this->images->store($icon, 'directories/govapps')
            : null;

        try {
            $app = DB::transaction(function () use ($data, $storedIcon): GovApp {
                return GovApp::create([
                    'description' => $data['description'] ?? null,
                    'description_ar' => $data['description_ar'] ?? null,
                    'icon' => $storedIcon?->url,
                    'id' => $data['id'],
                    'images' => [],
                    'is_active' => $data['is_active'],
                    'links' => $this->cleanUrls($data['links'] ?? []),
                    'name' => $data['name'],
                    'name_ar' => $data['name_ar'],
                    'order_column' => ((int) GovApp::query()->max('order_column')) + 1,
                ]);
            });
        } catch (Throwable $error) {
            if ($storedIcon !== null) {
                $this->images->discard($storedIcon);
            }

            throw $error;
        }
        $this->flushCache();

        return response()->json(['data' => $this->resource($app)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $this->access->authorizeAction($request, 'govapps', 'edit');
        GovApp::query()->findOrFail($id);
        $data = $this->validateApp($request, false);
        $icon = $request->file('icon_file');
        $storedIcon = $icon instanceof UploadedFile
            ? $this->images->store($icon, 'directories/govapps')
            : null;

        try {
            $app = DB::transaction(function () use ($data, $id, $storedIcon): GovApp {
                $locked = GovApp::query()->lockForUpdate()->findOrFail($id);
                $oldIcon = $locked->icon;
                $locked->update([
                    'description' => $data['description'] ?? null,
                    'description_ar' => $data['description_ar'] ?? null,
                    'icon' => $storedIcon?->url ?? $oldIcon,
                    'is_active' => $data['is_active'],
                    'links' => $this->cleanUrls($data['links'] ?? []),
                    'name' => $data['name'],
                    'name_ar' => $data['name_ar'],
                ]);
                if ($storedIcon !== null) {
                    $this->queueIconDeletion($oldIcon, $locked->id);
                }

                return $locked;
            });
        } catch (Throwable $error) {
            if ($storedIcon !== null) {
                $this->images->discard($storedIcon);
            }

            throw $error;
        }
        $this->flushCache();

        return response()->json(['data' => $this->resource($app->fresh())]);
    }

    public function updateVisibility(Request $request, string $id): JsonResponse
    {
        $this->access->authorizeAction($request, 'govapps', 'toggle');
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $app = GovApp::query()->findOrFail($id);
        $app->update(['is_active' => $data['is_active']]);
        $this->flushCache();

        return response()->json(['data' => $this->resource($app->fresh())]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->access->authorizeAction($request, 'govapps', 'delete');
        DB::transaction(function () use ($id): void {
            $app = GovApp::query()->lockForUpdate()->findOrFail($id);
            $icon = $app->icon;
            $app->delete();
            $this->queueIconDeletion($icon, $app->id);
        });
        $this->flushCache();

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function reorder(Request $request): JsonResponse
    {
        $this->access->authorizeAction($request, 'govapps', 'reorder');
        $data = $request->validate([
            'orders' => ['required', 'array', 'min:1'],
            'orders.*.id' => ['required', 'string', 'distinct', 'exists:gov_apps,id'],
            'orders.*.order_column' => ['required', 'integer', 'min:0'],
        ]);
        DB::transaction(function () use ($data): void {
            foreach ($data['orders'] as $order) {
                GovApp::query()
                    ->whereKey($order['id'])
                    ->update(['order_column' => $order['order_column']]);
            }
        });
        $this->flushCache();

        return response()->json(['data' => ['success' => true]]);
    }

    private function validateApp(Request $request, bool $creating): array
    {
        $rules = [
            'description' => ['nullable', 'string', 'max:5000'],
            'description_ar' => ['nullable', 'string', 'max:5000'],
            'icon_file' => $this->images->rules(),
            'is_active' => ['required', 'boolean'],
            'links' => ['sometimes', 'array:'.implode(',', self::LINK_KEYS)],
            'links.*' => ['nullable', 'url:http,https', 'max:2048'],
            'name' => ['required', 'string', 'max:255'],
            'name_ar' => ['required', 'string', 'max:255'],
        ];
        if ($creating) {
            $rules['id'] = [
                'required',
                'string',
                'max:128',
                'alpha_dash',
                Rule::unique('gov_apps', 'id'),
            ];
        }

        return $request->validate($rules);
    }

    private function cleanUrls(array $urls): array
    {
        return array_map(
            static fn (string $url): string => trim($url),
            array_filter($urls, static fn (mixed $url): bool => is_string($url) && trim($url) !== ''),
        );
    }

    private function resource(GovApp $app): array
    {
        return [
            'description' => $app->description,
            'description_ar' => $app->description_ar,
            'icon' => $app->icon,
            'id' => $app->id,
            'images' => array_values($app->images ?? []),
            'is_active' => (bool) $app->is_active,
            'links' => (object) ($app->links ?? []),
            'name' => $app->name,
            'name_ar' => $app->name_ar ?: $app->name,
            'order_column' => (int) $app->order_column,
        ];
    }

    private function flushCache(): void
    {
        Cache::forget('govapps:db_apps_v1');
    }

    private function queueIconDeletion(?string $url, string $id): void
    {
        $this->images->queueManagedUrlDeletion($url, 'directories/govapps');
        $this->images->queueLegacyWebUrlDeletion($url, 'govapps', $id);
    }
}
