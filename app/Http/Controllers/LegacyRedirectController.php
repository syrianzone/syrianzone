<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;

/**
 * 301 redirects for legacy asset and directory URLs that search engines still
 * index under `/syid/materials/*` and `/syofficial/images/*`.
 */
class LegacyRedirectController extends Controller
{
    private const SYID_MATERIALS_DIR = '/syid-assets/materials/';

    private const GOVERNORATE_ICONS_DIR = '/syid-assets/icons/governorates/with-frame/';

    /**
     * Legacy `/syid/materials/{file}` names mapped to their current filenames
     * under `public/syid-assets/materials/`. Includes historical Arabic names
     * renamed in commit `fd13cc8c` as well as current ASCII names.
     *
     * @var array<string, string>
     */
    private const SYID_MATERIALS = [
        'Blank_Syria_map.svg' => 'Blank_Syria_map.svg',
        'Syrian_logotype_black.svg' => 'Syrian_logotype_black.svg',
        'Syrian_logotype_darkgreen.svg' => 'Syrian_logotype_darkgreen.svg',
        'Syrian_logotype_off-white.svg' => 'Syrian_logotype_off-white.svg',
        'blackonwhite.png' => 'blackonwhite.png',
        'logo.ai.svg' => 'logo.ai.svg',
        'pattern.svg' => 'pattern.svg',
        'qomra2.webp' => 'qomra2.webp',
        'syrian-flag-guide.webp' => 'syrian-flag-guide.webp',
        'syrian-flag-proportions.png' => 'syrian-flag-proportions.png',
        'syrian-flag-proportions.svg' => 'syrian-flag-proportions.svg',
        'syrian-flag-proportions.webp' => 'syrian-flag-proportions.webp',
        'syrian-flag.dwg' => 'syrian-flag.dwg',
        'syrian-identity-wallpaper-desktop.png' => 'syrian-identity-wallpaper-desktop.png',
        'syrian-identity-wallpaper-desktop.svg' => 'syrian-identity-wallpaper-desktop.svg',
        'syrian-identity-wallpaper-mobile.png' => 'syrian-identity-wallpaper-mobile.png',
        'syrian-identity-wallpaper-mobile.svg' => 'syrian-identity-wallpaper-mobile.svg',
        'whiteonblack.png' => 'whiteonblack.png',
        // Historical Arabic filenames before English standardization
        'الدليل الإرشادي للعلم السوري.webp' => 'syrian-flag-guide.webp',
        'العلم السوري بالنسب الصحيحة.png' => 'syrian-flag-proportions.png',
        'العلم السوري بالنسب الصحيحة.svg' => 'syrian-flag-proportions.svg',
        'العلم السوري بالنسب الصحيحة.webp' => 'syrian-flag-proportions.webp',
        'علم سوريا.dwg' => 'syrian-flag.dwg',
        'الهوية السورية الجديدة - خلفية الكمبيوتر.png' => 'syrian-identity-wallpaper-desktop.png',
        'الهوية السورية الجديدة - خلفية الكمبيوتر.svg' => 'syrian-identity-wallpaper-desktop.svg',
        'الهوية السورية الجديدة - خلفية هاتف.png' => 'syrian-identity-wallpaper-mobile.png',
        'الهوية السورية الجديدة - خلفية هاتف.svg' => 'syrian-identity-wallpaper-mobile.svg',
    ];

    /**
     * Governorate slug (with optional `gov-` prefix stripped) to the current
     * SVG filename under `public/syid-assets/icons/governorates/with-frame/`.
     *
     * @var array<string, string>
     */
    private const GOVERNORATE_ICONS = [
        'aleppo' => 'aleppo-citadel.svg',
        'damascus' => 'damascus-sword.svg',
        'daraa' => 'daraa-omari-mosque.svg',
        'deir-ez-zor' => 'deir-ez-zor-bridge.svg',
        'deir-ezzor' => 'deir-ez-zor-bridge.svg',
        'hama' => 'hama-norias.svg',
        'hamah' => 'hama-norias.svg',
        'hasakah' => 'hasakah-ain-diwar.svg',
        'al-hasakah' => 'hasakah-ain-diwar.svg',
        'homs' => 'homs-clock.svg',
        'idlib' => 'idlib-ruweiha.svg',
        'idleb' => 'idlib-ruweiha.svg',
        'lattakia' => 'latakia-triumph-arch.svg',
        'latakia' => 'latakia-triumph-arch.svg',
        'quneitra' => 'quneitra-beit-saida.svg',
        'qunaitra' => 'quneitra-beit-saida.svg',
        'raqqa' => 'raqqa-baghdad-gate.svg',
        'ar-raqqah' => 'raqqa-baghdad-gate.svg',
        'rural-damascus' => 'rif-dimashq-ghouta.svg',
        'rif-dimashq' => 'rif-dimashq-ghouta.svg',
        'sweida' => 'sweida-qanawat.svg',
        'suwayda' => 'sweida-qanawat.svg',
        'as-suwayda' => 'sweida-qanawat.svg',
        'tartus' => 'tartous-arwad.svg',
        'tartous' => 'tartous-arwad.svg',
    ];

    public function syidMaterial(string $file): RedirectResponse
    {
        $target = self::SYID_MATERIALS[$file] ?? null;

        if ($target !== null && is_file(public_path(ltrim(self::SYID_MATERIALS_DIR, '/').$target))) {
            return redirect(self::SYID_MATERIALS_DIR.$target, 301);
        }

        return redirect('/syid', 301);
    }

    public function syofficialGovernorate(string $file): RedirectResponse
    {
        $key = strtolower($file);
        if (str_starts_with($key, 'gov-')) {
            $key = substr($key, 4);
        }

        $icon = self::GOVERNORATE_ICONS[$key] ?? null;

        if ($icon !== null && is_file(public_path(ltrim(self::GOVERNORATE_ICONS_DIR, '/').$icon))) {
            return redirect(self::GOVERNORATE_ICONS_DIR.$icon, 301);
        }

        return redirect('/syofficial', 301);
    }

    public function syofficialImage(): RedirectResponse
    {
        return redirect('/syofficial', 301);
    }

    /**
     * Exposed for tests to verify every mapped target exists on disk.
     *
     * @return array<string, string>
     */
    public static function syidMaterialTargets(): array
    {
        return array_map(
            fn (string $target): string => self::SYID_MATERIALS_DIR.$target,
            self::SYID_MATERIALS,
        );
    }

    /**
     * Exposed for tests to verify every mapped target exists on disk.
     *
     * @return array<string, string>
     */
    public static function governorateIconTargets(): array
    {
        return array_map(
            fn (string $icon): string => self::GOVERNORATE_ICONS_DIR.$icon,
            self::GOVERNORATE_ICONS,
        );
    }
}
