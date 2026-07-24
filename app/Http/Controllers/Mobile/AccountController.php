<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Poll;
use App\Models\RouteDraft;
use App\Models\User;
use App\Services\AvatarService;
use App\Services\UserDeletionService;
use App\Services\UserSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AccountController extends Controller
{
    private const MAX_SETTINGS_BYTES = 65_536;

    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->workspace($request->user())]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'name' => ['required', 'string', 'max:255'],
        ]);
        $user->update($data);

        return response()->json(['data' => ['user' => $this->userResource($user->fresh())]]);
    }

    public function updateAvatar(Request $request, AvatarService $avatars): JsonResponse
    {
        $request->validate([
            'avatar' => [
                'bail',
                'required',
                'max:4096',
                function (string $attribute, mixed $value, callable $fail) use ($avatars) {
                    if ($value instanceof UploadedFile && $avatars->dimensionsExceedBudget($value)) {
                        $fail('The image dimensions are not supported.');
                    }
                },
                'image',
                'mimes:jpg,jpeg,png,webp',
                function (string $attribute, mixed $value, callable $fail) use ($avatars) {
                    if (! $value instanceof UploadedFile || ! $avatars->dimensionsAreSafe($value)) {
                        $fail('The image dimensions are not supported.');
                    }
                },
            ],
        ]);

        $avatars->update($request->user(), $request->file('avatar'));

        return response()->json([
            'data' => ['user' => $this->userResource($request->user()->fresh())],
        ]);
    }

    public function updateSettings(
        Request $request,
        UserSettingsService $settings,
    ): JsonResponse {
        if (strlen($request->getContent()) > self::MAX_SETTINGS_BYTES) {
            return response()->json(['message' => 'The settings document is too large.'], 422);
        }

        $validated = $request->validate([
            'settings' => ['required', 'array'],
        ]);
        $merged = $settings->merge($request->user(), $validated['settings']);

        return response()->json(['data' => ['settings' => $merged]]);
    }

    public function destroy(Request $request, UserDeletionService $deletion): JsonResponse
    {
        $user = $request->user();
        if (! $deletion->deleteAccountAndTransferOwnership($user)) {
            return response()->json([
                'code' => 'last_superadmin',
                'message' => 'لا يمكن حذف آخر مشرف عام.',
            ], 409);
        }

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function destroyDraft(Request $request, int $id): JsonResponse
    {
        $status = DB::transaction(function () use ($id, $request): string {
            $draft = RouteDraft::query()
                ->where('user_id', $request->user()->id)
                ->whereKey($id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($draft->status !== 'pending') {
                return 'reviewed';
            }

            $draft->delete();

            return 'deleted';
        });

        if ($status === 'reviewed') {
            return response()->json([
                'code' => 'draft_not_pending',
                'message' => 'لا يمكن سحب اقتراح تمت مراجعته.',
            ], 409);
        }

        return response()->json(['data' => ['deleted' => true]]);
    }

    private function workspace(User $user): array
    {
        $data = [
            'myDrafts' => RouteDraft::query()
                ->where('user_id', $user->id)
                ->with('city:id,name_ar,name_en')
                ->latest()
                ->get()
                ->map(fn (RouteDraft $draft) => $this->draftResource($draft))
                ->values(),
            'role' => $user->role,
            'user' => $this->userResource($user),
        ];

        if (in_array($user->role, ['admin', 'superadmin'], true)) {
            $data['polls'] = Poll::query()
                ->withCount('candidates')
                ->orderBy('created_at')
                ->get()
                ->map(fn (Poll $poll) => [
                    'candidatesCount' => $poll->candidates_count,
                    'id' => $poll->id,
                    'isActive' => (bool) $poll->is_active,
                    'slug' => $poll->slug,
                    'title' => $poll->title,
                ])
                ->values();
        }

        if (in_array($user->role, ['admin', 'transit_admin', 'superadmin'], true)) {
            $data['allDrafts'] = RouteDraft::query()
                ->latest()
                ->get()
                ->map(fn (RouteDraft $draft) => $this->draftResource($draft))
                ->values();
        }

        return $data;
    }

    private function draftResource(RouteDraft $draft): array
    {
        return [
            'city' => $draft->city ? [
                'id' => $draft->city->id,
                'name_ar' => $draft->city->name_ar,
                'name_en' => $draft->city->name_en,
            ] : null,
            'city_id' => $draft->city_id,
            'created_at' => $draft->created_at?->toIso8601String(),
            'id' => $draft->id,
            'name_ar' => $draft->name_ar,
            'name_en' => $draft->name_en,
            'notes' => $draft->notes,
            'price' => $draft->price === null ? null : (float) $draft->price,
            'rejection_reason' => $draft->rejection_reason,
            'status' => $draft->status,
            'user_id' => $draft->user_id,
        ];
    }

    private function userResource(User $user): array
    {
        return [
            'avatar_url' => $user->avatar_url,
            'email' => $user->email,
            'id' => $user->id,
            'is_banned' => (bool) $user->is_banned,
            'name' => $user->name,
            'permissions' => array_values($user->permissions ?? []),
            'role' => $user->role,
            'settings' => (object) ($user->settings ?? []),
        ];
    }
}
