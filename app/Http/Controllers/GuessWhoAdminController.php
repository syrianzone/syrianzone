<?php

namespace App\Http\Controllers;

use App\Models\GuessWhoCategory;
use App\Models\GuessWhoCharacter;
use App\Models\GuessWhoGame;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class GuessWhoAdminController extends Controller
{
    /**
     * Render the admin management page for Guess Who categories & characters.
     */
    public function renderIndex()
    {
        $categories = GuessWhoCategory::withCount('characters')->orderBy('id')->get();
        $characters = GuessWhoCharacter::with('category:id,name_ar')->orderBy('id')->get();

        return inertia('Admin/GuessWho/Index', [
            'categories' => $categories,
            'characters' => $characters,
        ]);
    }

    // ---------- Categories ----------

    public function storeCategory(Request $request)
    {
        $validated = $request->validate([
            'name_ar' => 'required|string|max:255',
            'name_en' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:guess_who_categories,slug|alpha_dash',
            'is_active' => 'boolean',
        ]);

        GuessWhoCategory::create([
            'name_ar' => $validated['name_ar'],
            'name_en' => $validated['name_en'],
            'slug' => $validated['slug'],
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return redirect()->back()->with('success', 'تم إضافة الفئة بنجاح');
    }

    public function updateCategory(Request $request, int $id)
    {
        $category = GuessWhoCategory::findOrFail($id);

        $validated = $request->validate([
            'name_ar' => 'required|string|max:255',
            'name_en' => 'required|string|max:255',
            'slug' => 'required|string|max:255|alpha_dash|unique:guess_who_categories,slug,' . $category->id,
            'is_active' => 'boolean',
        ]);

        $category->update([
            'name_ar' => $validated['name_ar'],
            'name_en' => $validated['name_en'],
            'slug' => $validated['slug'],
            'is_active' => $validated['is_active'] ?? $category->is_active,
        ]);

        return redirect()->back()->with('success', 'تم تحديث الفئة بنجاح');
    }

    public function destroyCategory(int $id)
    {
        $category = GuessWhoCategory::findOrFail($id);

        $characters = $category->characters()->get(['id', 'image_path']);
        $characterIds = $characters->pluck('id')->all();
        $imagePaths = $characters->pluck('image_path')->filter()->unique()->values()->all();

        DB::transaction(function () use ($category, $characterIds) {
            if (!empty($characterIds)) {
                GuessWhoGame::whereIn('player_1_character_id', $characterIds)
                    ->update(['player_1_character_id' => null]);
                GuessWhoGame::whereIn('player_2_character_id', $characterIds)
                    ->update(['player_2_character_id' => null]);
            }

            GuessWhoGame::where('category_id', $category->id)->delete();
            GuessWhoCharacter::where('category_id', $category->id)->delete();
            $category->delete();
        });

        foreach ($imagePaths as $imagePath) {
            $this->deleteImageIfUnused($imagePath);
        }

        return redirect()->back()->with('success', 'تم حذف الفئة وشخصياتها بنجاح');
    }

    // ---------- Characters ----------

    public function storeCharacter(Request $request)
    {
        $validated = $request->validate([
            'category_id' => 'required|exists:guess_who_categories,id',
            'name_ar' => 'required|string|max:255',
            'name_en' => 'required|string|max:255',
            'image_file' => 'required|image|max:5120',
            'attributes' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        GuessWhoCharacter::create([
            'category_id' => $validated['category_id'],
            'name_ar' => $validated['name_ar'],
            'name_en' => $validated['name_en'],
            'image_path' => $this->storeImage($request->file('image_file')),
            'attributes' => $validated['attributes'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return redirect()->back()->with('success', 'تم إضافة الشخصية بنجاح');
    }

    public function updateCharacter(Request $request, int $id)
    {
        $character = GuessWhoCharacter::findOrFail($id);

        $validated = $request->validate([
            'category_id' => 'required|exists:guess_who_categories,id',
            'name_ar' => 'required|string|max:255',
            'name_en' => 'required|string|max:255',
            'image_file' => 'nullable|image|max:5120',
            'attributes' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        $oldImagePath = $character->image_path;
        $imagePath = $oldImagePath;
        if ($request->hasFile('image_file')) {
            $imagePath = $this->storeImage($request->file('image_file'));
        }

        $character->update([
            'category_id' => $validated['category_id'],
            'name_ar' => $validated['name_ar'],
            'name_en' => $validated['name_en'],
            'image_path' => $imagePath,
            'attributes' => $validated['attributes'] ?? $character->attributes,
            'is_active' => $validated['is_active'] ?? $character->is_active,
        ]);

        if ($oldImagePath && $oldImagePath !== $imagePath) {
            $this->deleteImageIfUnused($oldImagePath);
        }

        return redirect()->back()->with('success', 'تم تحديث الشخصية بنجاح');
    }

    public function destroyCharacter(int $id)
    {
        $character = GuessWhoCharacter::findOrFail($id);
        $imagePath = $character->image_path;

        DB::transaction(function () use ($character) {
            GuessWhoGame::where('player_1_character_id', $character->id)
                ->update(['player_1_character_id' => null]);
            GuessWhoGame::where('player_2_character_id', $character->id)
                ->update(['player_2_character_id' => null]);
            $character->delete();
        });

        $this->deleteImageIfUnused($imagePath);

        return redirect()->back()->with('success', 'تم حذف الشخصية بنجاح');
    }

    /**
     * Store the uploaded image on the public disk under guesswho/characters
     * and return the relative path (game renders it via /storage/...).
     */
    private function storeImage($file): string
    {
        $name = Str::random(16) . '_' . time() . '.' . $file->getClientOriginalExtension();

        return $file->storeAs('guesswho/characters', $name, 'public');
    }

    private function deleteImage(?string $path): void
    {
        if (!$path) {
            return;
        }

        try {
            if (Storage::disk('public')->exists($path)) {
                Storage::disk('public')->delete($path);
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }

    private function deleteImageIfUnused(?string $path): void
    {
        if (!$path) {
            return;
        }

        if (GuessWhoCharacter::where('image_path', $path)->exists()) {
            return;
        }

        $this->deleteImage($path);
    }
}
