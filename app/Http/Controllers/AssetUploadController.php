<?php

namespace App\Http\Controllers;

use Aws\S3\S3Client;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AssetUploadController extends Controller
{
    /**
     * Render the Asset Manager page for SuperAdmins.
     */
    public function index()
    {
        return inertia('Admin/AssetManager/Index');
    }

    /**
     * Build an S3Client pointed at the R2 bucket.
     */
    private function r2Client(): S3Client
    {
        $cfg = config('filesystems.disks.r2');

        if (empty($cfg['endpoint']) || empty($cfg['key']) || empty($cfg['secret']) || empty($cfg['bucket'])) {
            abort(503, 'R2 storage is not configured.');
        }

        return new S3Client([
            'version'                 => 'latest',
            'region'                  => $cfg['region'] ?? 'auto',
            'endpoint'                => $cfg['endpoint'],
            'use_path_style_endpoint' => $cfg['use_path_style_endpoint'] ?? true,
            'credentials'             => [
                'key'    => $cfg['key'],
                'secret' => $cfg['secret'],
            ],
        ]);
    }

    /**
     * Cache key for the first page (no cursor).
     */
    private const FIRST_PAGE_CACHE_KEY = 'r2_files_page_first_v2';

    /**
     * List assets from Cloudflare R2 with cursor-based pagination.
     * Uses S3 ListObjectsV2 directly so we never fetch the whole bucket.
     */
    public function list(Request $request)
    {
        $validated = $request->validate([
            'cursor' => 'nullable|string|max:2048',
            'per_page' => 'nullable|integer|min:1|max:200',
            'refresh' => 'nullable|boolean',
        ]);
        $cursor  = $validated['cursor'] ?? null;
        $perPage = min((int) ($validated['per_page'] ?? 50), 200);
        $refresh = (bool) ($validated['refresh'] ?? false);

        // Only cache the first page (no cursor); deep pages are cheap anyway.
        $isFirstPage = empty($cursor);
        $cacheKey    = $isFirstPage ? self::FIRST_PAGE_CACHE_KEY : null;

        if ($isFirstPage && $refresh) {
            Cache::forget($cacheKey);
        }

        $fetch = function () use ($cursor, $perPage) {
            $cfg    = config('filesystems.disks.r2');
            $client = $this->r2Client();
            $disk   = Storage::disk('r2');

            $params = [
                'Bucket'  => $cfg['bucket'],
                'MaxKeys' => $perPage,
            ];
            if (!empty($cursor)) {
                $params['ContinuationToken'] = $cursor;
            }

            $response = $client->listObjectsV2($params);

            $files = [];
            foreach ($response['Contents'] ?? [] as $object) {
                $path = $object['Key'];

                if (Str::startsWith(basename($path), '.')) {
                    continue;
                }

                $parts    = explode('/', $path);
                $folder   = count($parts) > 1
                    ? implode('/', array_slice($parts, 0, -1))
                    : 'root';
                $filename = basename($path);

                $files[] = [
                    'path'          => $path,
                    'filename'      => $filename,
                    'folder'        => $folder,
                    'size'          => (int) ($object['Size'] ?? 0),
                    'last_modified' => isset($object['LastModified'])
                        ? $object['LastModified']->getTimestamp()
                        : null,
                    'url'           => $disk->url($path),
                ];
            }

            return [
                'files'       => $files,
                'next_cursor' => $response['NextContinuationToken'] ?? null,
                'has_more'    => (bool) ($response['IsTruncated'] ?? false),
            ];
        };

        // Cache only the first page for 5 minutes.
        try {
            $result = $isFirstPage
                ? Cache::remember($cacheKey, 300, $fetch)
                : $fetch();
        } catch (\Throwable $e) {
            // A tampered cursor (ContinuationToken) throws inside the SDK —
            // surface a 422, not a 500.
            report($e);
            return response()->json(['success' => false, 'message' => 'Invalid cursor.'], 422);
        }

        return response()->json([
            'success'     => true,
            'files'       => $result['files'],
            'next_cursor' => $result['next_cursor'],
            'has_more'    => $result['has_more'],
            'total_size'  => array_sum(array_column($result['files'], 'size')),
        ]);
    }

    /**
     * Upload an asset file to Cloudflare R2 storage.
     */
    public function store(Request $request)
    {
        $request->validate([
            'file'   => 'required|file|max:51200', // 50MB max file size
            'folder' => 'nullable|string|max:50',
        ]);

        $file   = $request->file('file');
        $folder = trim($request->input('folder', 'uploads'), '/');

        // Sanitize folder path
        $folder = preg_replace('/[^a-zA-Z0-9_\-\/]/', '', $folder) ?: 'uploads';

        // Keep original filename if clean, otherwise generate safe name
        $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        $cleanName    = Str::slug($originalName);
        $extension    = $file->getClientOriginalExtension();
        $filename     = $cleanName . '-' . Str::random(6) . '.' . $extension;

        $path = $folder . '/' . $filename;

        // Upload to R2 disk
        $disk = Storage::disk('r2');
        $disk->putFileAs($folder, $file, $filename, 'public');

        $url = $disk->url($path);

        // Invalidate the first-page cache so the new file appears immediately.
        Cache::forget(self::FIRST_PAGE_CACHE_KEY);

        return response()->json([
            'success'  => true,
            'url'      => $url,
            'path'     => $path,
            'filename' => $filename,
            'size'     => $file->getSize(),
        ]);
    }

    /**
     * Delete an asset from Cloudflare R2 storage.
     */
    public function destroy(Request $request)
    {
        $request->validate([
            'path' => 'required|string|max:1024',
        ]);

        $path = trim($request->input('path'), '/');

        // Allowlist: keys must live under a known top-level folder and must
        // not traverse. Without this any superadmin session (or CSRF'd browser)
        // could delete avatars, entity icons, or the brandkit zip.
        $allowed = ['uploads', 'downloads', 'tierlist', 'syofficial', 'govapps', 'avatars', 'guesswho', 'places'];
        $top = explode('/', $path)[0] ?? '';
        if (str_contains($path, '..') || !in_array($top, $allowed, true)) {
            return response()->json(['success' => false, 'message' => 'This path cannot be deleted.'], 422);
        }

        $disk = Storage::disk('r2');

        if ($disk->exists($path)) {
            $disk->delete($path);
            Cache::forget(self::FIRST_PAGE_CACHE_KEY);
            \Illuminate\Support\Facades\Log::info('R2 asset deleted', [
                'path' => $path,
                'by' => $request->user()?->id,
            ]);
            return response()->json(['success' => true, 'message' => 'تم حذف الملف بنجاح']);
        }

        return response()->json(['success' => false, 'message' => 'الملف غير موجود'], 404);
    }

    /**
     * Server-side manifest of all R2 keys (paginated through S3, no browser
     * N-fetch). The Asset Manager "Download all" currently fetches every file
     * body in the tab and zips with JSZip — OOM on large buckets. Clients
     * should use this manifest to cap the selection (e.g. first 200) or drive
     * a future server-side streaming zip.
     */
    public function manifest(Request $request)
    {
        $validated = $request->validate([
            'prefix' => 'nullable|string|max:100',
            'max_keys' => 'nullable|integer|min:1|max:2000',
        ]);
        $prefix = preg_replace('/[^a-zA-Z0-9_\-\/]/', '', $validated['prefix'] ?? '') ?: null;
        $maxKeys = $validated['max_keys'] ?? 1000;

        try {
            $cfg = config('filesystems.disks.r2');
            $client = $this->r2Client();
            $disk = Storage::disk('r2');

            $keys = [];
            $token = null;
            do {
                $params = ['Bucket' => $cfg['bucket'], 'MaxKeys' => 1000];
                if ($prefix) $params['Prefix'] = $prefix;
                if ($token) $params['ContinuationToken'] = $token;
                $res = $client->listObjectsV2($params);
                foreach ($res['Contents'] ?? [] as $o) {
                    $keys[] = ['path' => $o['Key'], 'size' => (int) ($o['Size'] ?? 0), 'url' => $disk->url($o['Key'])];
                    if (count($keys) >= $maxKeys) break 2;
                }
                $token = ($res['IsTruncated'] ?? false) ? ($res['NextContinuationToken'] ?? null) : null;
            } while ($token);

            return response()->json(['success' => true, 'count' => count($keys), 'files' => $keys]);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['success' => false, 'message' => 'Failed to build manifest.'], 503);
        }
    }
}

