<?php

namespace App\Http\Controllers;

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
     * List all assets stored in Cloudflare R2 storage.
     */
    public function list(Request $request)
    {
        $refresh = $request->boolean('refresh');
        
        $cacheKey = 'r2_asset_files_list';
        if ($refresh) {
            Cache::forget($cacheKey);
        }

        $filesData = Cache::remember($cacheKey, 60, function () {
            $disk = Storage::disk('r2');
            $files = $disk->allFiles();
            
            $result = [];
            foreach ($files as $file) {
                // Ignore hidden system files if any
                if (Str::startsWith(basename($file), '.')) {
                    continue;
                }

                $parts = explode('/', $file);
                $folder = count($parts) > 1 ? implode('/', array_slice($parts, 0, -1)) : 'root';
                $filename = basename($file);
                
                $size = 0;
                $lastModified = null;
                try {
                    $size = $disk->size($file);
                    $lastModified = $disk->lastModified($file);
                } catch (\Throwable $e) {
                    // Fallback gracefully if metadata call fails
                }

                $result[] = [
                    'path' => $file,
                    'filename' => $filename,
                    'folder' => $folder,
                    'size' => $size,
                    'last_modified' => $lastModified,
                    'url' => $disk->url($file),
                ];
            }

            // Sort by folder and filename
            usort($result, function ($a, $b) {
                return strcmp($a['path'], $b['path']);
            });

            return $result;
        });

        return response()->json([
            'success' => true,
            'files' => $filesData,
            'total_files' => count($filesData),
            'total_size' => array_sum(array_column($filesData, 'size')),
        ]);
    }

    /**
     * Upload an asset file to Cloudflare R2 storage.
     */
    public function store(Request $request)
    {
        $request->validate([
            'file' => 'required|file|max:51200', // 50MB max file size
            'folder' => 'nullable|string|max:50',
        ]);

        $file = $request->file('file');
        $folder = trim($request->input('folder', 'uploads'), '/');
        
        // Sanitize folder path
        $folder = preg_replace('/[^a-zA-Z0-9_\-\/]/', '', $folder) ?: 'uploads';

        // Keep original filename if clean, otherwise generate safe name
        $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        $cleanName = Str::slug($originalName);
        $extension = $file->getClientOriginalExtension();
        $filename = $cleanName . '-' . Str::random(6) . '.' . $extension;

        $path = $folder . '/' . $filename;

        // Upload to R2 disk
        $disk = Storage::disk('r2');
        $disk->putFileAs($folder, $file, $filename, 'public');

        $url = $disk->url($path);

        // Clear file list cache
        Cache::forget('r2_asset_files_list');

        return response()->json([
            'success' => true,
            'url' => $url,
            'path' => $path,
            'filename' => $filename,
            'size' => $file->getSize(),
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
            Cache::forget('r2_asset_files_list');
            return response()->json(['success' => true, 'message' => 'تم حذف الملف بنجاح']);
        }

        return response()->json(['success' => false, 'message' => 'الملف غير موجود'], 404);
    }
}
