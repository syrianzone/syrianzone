<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Facts;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * `POST|PATCH|PUT /api/user/settings` — the account half of the device
 * preferences.
 *
 * Only the keys listed in `rules()` reach `users.settings`; anything else in
 * the envelope is dropped by validation. The key list is the same one
 * `resources/js/Domain/settings/accountSettings.ts` declares as
 * `AccountSettingsPatch`, and `tests/Feature/UserSettingsTest.php` posts every
 * key of that contract so a half-finished addition fails the build instead of
 * silently losing a preference.
 */
class UserSettingsController extends Controller
{
    /** The whole `users.settings` blob, merged, may not exceed this many bytes. */
    private const SETTINGS_BYTES_MAX = 40000;

    /** `settings.customLinks` alone may not exceed this many bytes as JSON. */
    private const CUSTOM_LINKS_BYTES_MAX = 20000;

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.', 'error' => 'Unauthenticated'], 401);
        }

        $validated = $request->validate($this->rules($user));

        $newSettings = $validated['settings'] ?? [];

        $user->settings = array_merge($user->settings ?? [], $newSettings);
        $user->save();

        return response()->json(['status' => 'ok', 'settings' => $user->settings]);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(User $user): array
    {
        return [
            'settings' => [
                'required', 'array', 'max:30',
                $this->mergedSizeLimit($user),
            ],
            'settings.theme' => 'nullable|string|max:64',
            'settings.fontFamily' => 'nullable|string|in:ibm-plex,system',
            'settings.governorate' => 'nullable|string|max:64',
            'settings.eventsGovernorate' => 'nullable|string|max:64',
            'settings.showWeather' => 'nullable|boolean',
            'settings.showPrayerTimes' => 'nullable|boolean',
            'settings.showEvents' => 'nullable|boolean',
            'settings.useCustomCoords' => 'nullable|boolean',
            'settings.customLat' => 'nullable|numeric|between:-90,90',
            'settings.customLon' => 'nullable|numeric|between:-180,180',
            'settings.muslimCity' => 'nullable|string|max:64',
            // The accepted set is the one `resources/data/prayer.json` defines:
            // the methods the pickers offer plus the ids the timings proxy has
            // always accepted, so a stored choice can always be written back.
            'settings.muslimMethod' => 'nullable|integer|in:'.implode(',', Facts::prayerMethodIds()),
            'settings.muslimUseCustomCoords' => 'nullable|boolean',
            'settings.muslimLat' => 'nullable|numeric|between:-90,90',
            'settings.muslimLon' => 'nullable|numeric|between:-180,180',
            'settings.prayerLog' => 'nullable|array|max:31',
            'settings.prayerLog.*' => 'nullable|array|max:5',
            'settings.prayerLog.*.*' => 'boolean',
            'settings.quranLastPage' => 'nullable|integer|min:1|max:604',
            'settings.quranLastJuz' => 'nullable|integer|min:1|max:30',
            'settings.quranPageAt' => 'nullable|integer|min:0',
            'settings.quranReciterId' => 'nullable|string|max:64',
            'settings.quranRadioBytes' => 'nullable|integer|min:0',
            'settings.quranRadioSeconds' => 'nullable|integer|min:0',
            'settings.customLinks' => [
                'nullable', 'array', 'max:50',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (is_array($value) && strlen((string) json_encode($value)) > self::CUSTOM_LINKS_BYTES_MAX) {
                        $fail('روابط الشاشة الرئيسية كبيرة جداً. احذف بعض الروابط ثم أعد المحاولة.');
                    }
                },
            ],
            'settings.customLinks.*.id' => 'required|string|max:64',
            'settings.customLinks.*.label' => 'nullable|string|max:100',
            'settings.customLinks.*.name' => 'nullable|string|max:100',
            'settings.customLinks.*.title' => 'nullable|string|max:100',
            'settings.customLinks.*.url' => 'required|string|max:2048|starts_with:http://,https://',
        ];
    }

    /**
     * The merged blob is what makes the row unbounded: `customLinks` replaces
     * wholesale, but every other key accumulates, so the check has to look at
     * the stored settings too.
     */
    private function mergedSizeLimit(User $user): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($user): void {
            if (! is_array($value)) {
                return;
            }

            if (strlen((string) json_encode(array_merge($user->settings ?? [], $value))) > self::SETTINGS_BYTES_MAX) {
                $fail('حجم إعدادات حسابك أكبر من الحد المسموح. احذف بعض العناصر ثم أعد المحاولة.');
            }
        };
    }
}
