<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserSettingsController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.', 'error' => 'Unauthenticated'], 401);
        }

        $validated = $request->validate([
            'settings' => 'required|array|max:30',
            'settings.theme' => 'nullable|string|max:64',
            'settings.fontFamily' => 'nullable|string|in:ibm-plex,system',
            'settings.language' => 'nullable|string|in:ar,en',
            'settings.governorate' => 'nullable|string|max:64',
            'settings.eventsGovernorate' => 'nullable|string|max:64',
            'settings.clockFormat' => 'nullable|string|in:12,24',
            'settings.searchEngine' => 'nullable|string|in:duckduckgo,google,bing,searx,custom',
            'settings.showClock' => 'nullable|boolean',
            'settings.showWeather' => 'nullable|boolean',
            'settings.showPrayerTimes' => 'nullable|boolean',
            'settings.muslimCity' => 'nullable|string|max:64',
            'settings.muslimMethod' => 'nullable|integer|in:0,1,2,3,4,5,7,8,9,10,11,12,13,14,15,16',
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
            'settings.showEvents' => 'nullable|boolean',
            'settings.showSearch' => 'nullable|boolean',
            'settings.useCustomCoords' => 'nullable|boolean',
            'settings.customLat' => 'nullable|numeric|between:-90,90',
            'settings.customLon' => 'nullable|numeric|between:-180,180',
            'settings.customSearchUrl' => 'nullable|string|max:2048|starts_with:http://,https://',
            'settings.customLinks' => 'nullable|array|max:50',
            'settings.customLinks.*.id' => 'required|string|max:64',
            'settings.customLinks.*.label' => 'nullable|string|max:100',
            'settings.customLinks.*.name' => 'nullable|string|max:100',
            'settings.customLinks.*.title' => 'nullable|string|max:100',
            'settings.customLinks.*.url' => 'required|string|max:2048|starts_with:http://,https://',
        ]);

        $newSettings = $validated['settings'] ?? [];
        // customLinks replaces wholesale; cap JSON size so one client cannot bloat the row.
        if (isset($newSettings['customLinks']) && strlen(json_encode($newSettings['customLinks'])) > 20000) {
            return response()->json(['message' => 'Too many links.', 'error' => 'Too many links.'], 422);
        }

        $currentSettings = $user->settings ?? [];

        $mergedSettings = array_merge($currentSettings, $newSettings);
        if (strlen(json_encode($mergedSettings)) > 40000) {
            return response()->json(['message' => 'Settings too large.', 'error' => 'Settings too large.'], 422);
        }
        $user->settings = $mergedSettings;
        $user->save();

        return response()->json(['status' => 'ok', 'settings' => $user->settings]);
    }
}
