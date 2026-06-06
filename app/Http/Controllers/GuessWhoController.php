<?php

namespace App\Http\Controllers;

use App\Models\GuessWhoCategory;
use App\Models\GuessWhoCharacter;
use App\Models\GuessWhoGame;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class GuessWhoController extends Controller
{
    // Render the lobby index with active categories and total characters
    public function index()
    {
        $categories = GuessWhoCategory::where('is_active', true)
            ->withCount(['characters' => function ($query) {
                $query->where('is_active', true);
            }])
            ->get()
            ->filter(function ($category) {
                return $category->characters_count >= 12; // Minimum characters to play
            })
            ->values();

        $totalActiveCharacters = GuessWhoCharacter::where('is_active', true)->count();

        return Inertia::render('GuessWho/Index', [
            'categories' => $categories,
            'total_characters' => $totalActiveCharacters
        ]);
    }

    // Create a new game room code
    public function createRoom(Request $request)
    {
        $request->validate([
            'category_id' => 'nullable|string', // Can be numeric category ID or 'random'
            'player_session' => 'required|string'
        ]);

        $roomCode = Str::uuid()->toString();
        $categoryId = null;
        $characterIds = [];

        if ($request->filled('category_id') && $request->category_id !== 'random') {
            $categoryId = (int) $request->category_id;
            // Fetch exactly 24 characters randomly from the chosen category
            $characterIds = GuessWhoCharacter::where('category_id', $categoryId)
                ->where('is_active', true)
                ->inRandomOrder()
                ->take(24)
                ->pluck('id')
                ->toArray();
        } else {
            // Mixed/Random game: Fetch exactly 24 characters randomly across all active categories
            $characterIds = GuessWhoCharacter::where('is_active', true)
                ->inRandomOrder()
                ->take(24)
                ->pluck('id')
                ->toArray();
        }

        if (count($characterIds) < 12) {
            return response()->json(['error' => 'لا توجد شخصيات كافية لبدء اللعبة.'], 400);
        }

        $game = GuessWhoGame::create([
            'room_code' => $roomCode,
            'category_id' => $categoryId,
            'character_ids' => $characterIds,
            'player_1_session' => $request->player_session,
            'status' => 'lobby'
        ]);

        return response()->json(['room_code' => $roomCode]);
    }

    // Show a specific game room
    public function showRoom($roomCode)
    {
        $game = GuessWhoGame::where('room_code', $roomCode)->firstOrFail();

        // Load exactly the 24 characters selected for this game
        $characters = GuessWhoCharacter::whereIn('id', $game->character_ids ?? [])
            ->where('is_active', true)
            ->get();

        $categoryName = $game->category ? $game->category->name_ar : 'عشوائي من كل الفئات';

        $gameData = [
            'room_code' => $game->room_code,
            'category' => [
                'name_ar' => $categoryName,
                'characters' => $characters,
            ]
        ];

        return Inertia::render('GuessWho/Room', [
            'game' => $gameData
        ]);
    }
}
