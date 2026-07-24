<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
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

        return response()->json([
            'success' => true,
            'url' => $url,
            'path' => $path,
            'filename' => $filename,
            'size' => $file->getSize(),
        ]);
    }
}
