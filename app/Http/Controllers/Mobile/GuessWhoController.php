<?php

namespace App\Http\Controllers\Mobile;

use App\Events\GuessWhoSignalingEvent;
use App\Http\Controllers\Controller;
use App\Models\GuessWhoCategory;
use App\Models\GuessWhoCharacter;
use App\Models\GuessWhoGame;
use App\Models\MobileGuessWhoSession;
use App\Services\GuessWhoSessionPruner;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class GuessWhoController extends Controller
{
    public function categories(): JsonResponse
    {
        $categories = GuessWhoCategory::query()
            ->where('is_active', true)
            ->withCount(['characters' => fn ($query) => $query->where('is_active', true)])
            ->get()
            ->filter(fn (GuessWhoCategory $category) => $category->characters_count >= 12)
            ->map(fn (GuessWhoCategory $category) => [
                'characters_count' => $category->characters_count,
                'id' => $category->id,
                'name_ar' => $category->name_ar,
                'name_en' => $category->name_en,
                'slug' => $category->slug,
            ])
            ->values();

        return response()->json(['data' => [
            'categories' => $categories,
            'total_characters' => GuessWhoCharacter::query()
                ->where('is_active', true)
                ->whereHas('category', fn ($query) => $query->where('is_active', true))
                ->count(),
        ]]);
    }

    public function issueSession(GuessWhoSessionPruner $pruner): JsonResponse
    {
        $pruner->pruneExpired();
        $credential = 'gw_'.Str::random(64);
        $session = MobileGuessWhoSession::create([
            'credential_hash' => hash('sha256', $credential),
            'expires_at' => now()->addMinutes(config('guess-who.session_ttl_minutes')),
        ]);

        return response()->json(['data' => [
            'credential' => $credential,
            'expires_at' => $session->expires_at->toIso8601String(),
            'session_id' => $session->id,
        ]], 201);
    }

    public function createRoom(Request $request): JsonResponse
    {
        $data = $request->validate(['category_id' => 'required']);
        $session = $this->session($request, false);
        $categoryId = $data['category_id'] === 'random' ? null : filter_var($data['category_id'], FILTER_VALIDATE_INT);
        if ($data['category_id'] !== 'random' && ! $categoryId) {
            return response()->json(['message' => 'الفئة غير صالحة.'], 422);
        }
        if ($categoryId && ! GuessWhoCategory::whereKey($categoryId)->where('is_active', true)->exists()) {
            return response()->json(['message' => 'الفئة غير متاحة.'], 422);
        }
        $characters = GuessWhoCharacter::query()
            ->when($categoryId, fn ($query) => $query->where('category_id', $categoryId))
            ->where('is_active', true)
            ->whereHas('category', fn ($query) => $query->where('is_active', true))
            ->inRandomOrder()
            ->limit(24)
            ->pluck('id');
        if ($characters->count() < 12) {
            return response()->json(['message' => 'لا توجد شخصيات كافية لبدء اللعبة.'], 422);
        }

        $binding = DB::transaction(function () use ($categoryId, $characters, $session): array {
            $locked = MobileGuessWhoSession::lockForUpdate()->findOrFail($session->id);
            $this->assertUnbound($locked);
            $roomCode = (string) Str::uuid();
            GuessWhoGame::create([
                'category_id' => $categoryId,
                'character_ids' => $characters->all(),
                'player_1_session' => $locked->id,
                'room_code' => $roomCode,
                'status' => 'lobby',
            ]);
            $locked->update(['role' => 'player_1', 'room_code' => $roomCode]);

            return $this->bindingResource($locked->fresh());
        });

        return response()->json(['data' => $binding], 201);
    }

    public function joinRoom(Request $request, string $roomCode): JsonResponse
    {
        $session = $this->session($request, false);
        $binding = DB::transaction(function () use ($roomCode, $session): array {
            $locked = MobileGuessWhoSession::lockForUpdate()->findOrFail($session->id);
            if ($locked->room_code) {
                if ($locked->room_code !== $roomCode) {
                    $this->conflict('session_already_bound', 'جلسة اللعب مرتبطة بغرفة أخرى.');
                }

                return $this->bindingResource($locked);
            }
            $game = GuessWhoGame::where('room_code', $roomCode)->lockForUpdate()->firstOrFail();
            if (! $game->player_2_session) {
                $game->update(['player_2_session' => $locked->id, 'status' => 'selecting']);
                $locked->update(['role' => 'player_2', 'room_code' => $roomCode]);

                return $this->bindingResource($locked->fresh());
            }
            $this->conflict('room_full', 'الغرفة ممتلئة بالكامل.');
        });

        return response()->json(['data' => $binding]);
    }

    public function room(Request $request, string $roomCode): JsonResponse
    {
        $session = $this->session($request, true, $roomCode);
        $game = GuessWhoGame::where('room_code', $roomCode)->firstOrFail();
        $characters = GuessWhoCharacter::whereIn('id', $game->character_ids ?? [])
            ->get()
            ->map(fn (GuessWhoCharacter $character) => [
                'id' => $character->id,
                'image_path' => $character->image_path,
                'name_ar' => $character->name_ar,
            ])
            ->values();

        return response()->json(['data' => [
            'category' => [
                'characters' => $characters,
                'name_ar' => $game->category?->name_ar ?? 'عشوائي من كل الفئات',
            ],
            'generation' => $session->generation,
            'role' => $session->role,
            'room_code' => $roomCode,
            'status' => $game->status === 'finished' ? 'ended' : $game->status,
        ]]);
    }

    public function signal(Request $request, string $roomCode): JsonResponse
    {
        $session = $this->session($request, true, $roomCode);
        $data = $request->validate([
            'data' => 'present',
            'generation' => 'required|integer|min:1|max:1000000',
            'target_session' => 'required|uuid',
            'type' => 'required|in:offer,answer,candidate',
        ]);
        $encodedData = json_encode($data['data']);
        if ($encodedData === false || strlen($encodedData) > 65_536) {
            return response()->json([
                'errors' => ['data' => ['The signaling payload may not exceed 64 KiB.']],
                'message' => 'The given data was invalid.',
            ], 422);
        }
        $game = GuessWhoGame::where('room_code', $roomCode)->firstOrFail();
        $players = array_filter([$game->player_1_session, $game->player_2_session]);
        if (! in_array($data['target_session'], $players, true) || $data['target_session'] === $session->id) {
            return response()->json(['message' => 'هدف الإشارة غير صالح.'], 422);
        }
        $session->update([
            'generation' => max($session->generation, $data['generation']),
            'last_used_at' => now(),
        ]);
        broadcast(new GuessWhoSignalingEvent(
            $roomCode,
            $data['target_session'],
            $session->id,
            $data['type'],
            $data['data'],
            $data['generation'],
        ))->toOthers();

        return response()->json(['data' => ['status' => 'signal_sent']]);
    }

    public function authenticateBroadcasting(Request $request): JsonResponse
    {
        $data = $request->validate([
            'channel_name' => ['required', 'string', 'max:120', 'regex:/^presence-guesswho\.([0-9a-f-]{36})$/i'],
            'socket_id' => ['required', 'string', 'max:100', 'regex:/^[0-9]+\.[0-9]+$/'],
        ]);
        preg_match('/^presence-guesswho\.([0-9a-f-]{36})$/i', $data['channel_name'], $matches);
        $session = $this->session($request, true, $matches[1]);
        $channelData = json_encode([
            'user_id' => $session->id,
            'user_info' => [
                'name' => 'لاعب ضيف',
                'session_id' => $session->id,
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $key = config('broadcasting.connections.reverb.key');
        $secret = config('broadcasting.connections.reverb.secret');
        if (! $key || ! $secret) {
            return response()->json(['message' => 'خدمة اللعب المباشر غير مهيأة.'], 503);
        }
        $signature = hash_hmac('sha256', "{$data['socket_id']}:{$data['channel_name']}:{$channelData}", $secret);

        return response()->json([
            'auth' => "{$key}:{$signature}",
            'channel_data' => $channelData,
        ]);
    }

    public function realtime(): JsonResponse
    {
        $connection = config('broadcasting.connections.reverb');
        $host = $connection['client']['host'] ?? $connection['options']['host'] ?? null;
        $scheme = $connection['client']['scheme'] ?? $connection['options']['scheme'] ?? 'https';
        $port = (int) ($connection['client']['port'] ?? $connection['options']['port'] ?? 443);
        if (! $connection['key'] || ! $host) {
            return response()->json(['message' => 'خدمة اللعب المباشر غير مهيأة.'], 503);
        }

        return response()->json(['data' => [
            'force_tls' => $scheme === 'https',
            'host' => $host,
            'key' => $connection['key'],
            'ws_port' => $scheme === 'http' ? $port : 80,
            'wss_port' => $scheme === 'https' ? $port : 443,
        ]]);
    }

    public function turnCredentials(Request $request): JsonResponse
    {
        $data = $request->validate(['room_code' => 'required|uuid']);
        $session = $this->session($request, true, $data['room_code']);
        $expiresAt = now()->addMinutes(config('guess-who.turn_ttl_minutes'));
        $servers = collect(config('guess-who.stun_urls'))->map(fn (string $url) => ['urls' => $url]);
        $turnUrls = config('guess-who.turn_urls');
        $turnSecret = config('guess-who.turn_secret');
        if ($turnUrls && $turnSecret) {
            $username = $expiresAt->timestamp.':'.$session->id;
            $servers->push([
                'credential' => base64_encode(hash_hmac('sha1', $username, $turnSecret, true)),
                'urls' => count($turnUrls) === 1 ? $turnUrls[0] : $turnUrls,
                'username' => $username,
            ]);
        }
        if ($servers->isEmpty()) {
            return response()->json(['message' => 'خدمة الاتصال المباشر غير مهيأة.'], 503);
        }

        return response()->json(['data' => [
            'expires_at' => $expiresAt->toIso8601String(),
            'ice_servers' => $servers->values(),
        ]]);
    }

    private function assertUnbound(MobileGuessWhoSession $session): void
    {
        if ($session->room_code) {
            $this->conflict('session_already_bound', 'جلسة اللعب مرتبطة بغرفة مسبقًا.');
        }
    }

    private function bindingResource(MobileGuessWhoSession $session): array
    {
        return [
            'generation' => $session->generation,
            'role' => $session->role,
            'room_code' => $session->room_code,
        ];
    }

    private function conflict(string $code, string $message): never
    {
        throw new HttpResponseException(response()->json(compact('code', 'message'), 409));
    }

    private function session(Request $request, bool $bound, ?string $roomCode = null): MobileGuessWhoSession
    {
        $credential = $request->header('X-Guess-Who-Session-ID');
        $session = $credential
          ? MobileGuessWhoSession::where('credential_hash', hash('sha256', $credential))->first()
          : null;
        if (! $session || $session->expires_at->isPast()) {
            throw new HttpResponseException(response()->json([
                'code' => 'invalid_room_session',
                'message' => 'جلسة اللعب غير صالحة أو منتهية.',
            ], 401));
        }
        if ($bound && (! $session->room_code || $session->room_code !== $roomCode)) {
            throw new HttpResponseException(response()->json([
                'code' => 'room_session_mismatch',
                'message' => 'جلسة اللعب غير مرتبطة بهذه الغرفة.',
            ], 403));
        }
        $session->forceFill(['last_used_at' => now()])->save();

        return $session;
    }
}
