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
        $cursor  = $request->input('cursor');          // null = first page
        $perPage = min((int) $request->input('per_page', 50), 200);
        $refresh = $request->boolean('refresh');

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
        $result = $isFirstPage
            ? Cache::remember($cacheKey, 300, $fetch)
            : $fetch();

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
            'path' => 'required|string',
        ]);

        $path = $request->input('path');
        $disk = Storage::disk('r2');

        if ($disk->exists($path)) {
            $disk->delete($path);
            Cache::forget(self::FIRST_PAGE_CACHE_KEY);
            return response()->json(['success' => true, 'message' => 'تم حذف الملف بنجاح']);
        }

        return response()->json(['success' => false, 'message' => 'الملف غير موجود'], 404);
    }
}

