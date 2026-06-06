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

    // Custom endpoint to authorize WebSocket broadcasting for both authenticated and guest users
    public function authenticateBroadcasting(Request $request)
    {
        $socketId = $request->input('socket_id');
        $channelName = $request->input('channel_name');

        if (!$socketId || !$channelName) {
            return response()->json(['error' => 'البيانات غير صالحة.'], 400);
        }

        // Retrieve guest session ID from headers or inputs
        $sessionId = $request->header('X-Guess-Who-Session-ID')
            ?? $request->input('session_id')
            ?? 'guest-' . Str::uuid();

        // Retrieve authenticated user
        $user = $request->user();

        // Build the presence channel user details block
        $channelData = json_encode([
            'user_id' => $sessionId,
            'user_info' => [
                'id' => $sessionId,
                'session_id' => $sessionId,
                'name' => $user ? $user->name : 'لاعب ضيف',
            ]
        ]);

        // Generate HMAC signature using Pusher/Reverb App Secret
        $stringToSign = $socketId . ':' . $channelName . ':' . $channelData;
        $appSecret = env('REVERB_APP_SECRET') ?: env('PUSHER_APP_SECRET');
        $appKey = env('REVERB_APP_KEY') ?: env('PUSHER_APP_KEY');

        if (!$appSecret) {
            return response()->json(['error' => 'لم يتم إعداد Reverb App Secret.'], 500);
        }

        $signature = hash_hmac('sha256', $stringToSign, $appSecret);

        return response()->json([
            'auth' => $appKey . ':' . $signature,
            'channel_data' => $channelData,
        ]);
    }
}
