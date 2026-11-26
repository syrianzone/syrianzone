<?php

namespace App\Services\Governorates;

use App\Http\Controllers\PrayerController;
use App\Models\City;
use App\Models\GovtOfficial;
use App\Models\GovtTenure;
use App\Models\PhonebookEntry;
use App\Models\Place;
use App\Models\Population\PopulationDemographic;
use App\Services\Places\PlaceGovernorates;
use App\Services\Places\PlaceUrls;
use App\Services\Wildlife\WildlifeData;
use App\Support\ArabicSearch;
use App\Support\Facts;
use Illuminate\Support\Facades\Cache;

/**
 * Assembles server-rendered data for `/governorates` and `/governorates/{id}`
 * purely from existing site data sources (never duplicating them) plus the
 * sourced governor fallback in `resources/data/governorates/governors.json`.
 */
final class GovernorateDataService
{
    /**
     * Administrative centre city (مركز المحافظة) for each of the 14 governorates.
     *
     * @var array<string, string>
     */
    private const CENTRES_AR = [
        'damascus' => 'دمشق',
        'rural-damascus' => 'دوما',
        'aleppo' => 'حلب',
        'homs' => 'حمص',
        'hama' => 'حماة',
        'latakia' => 'اللاذقية',
        'tartus' => 'طرطوس',
        'idlib' => 'إدلب',
        'deir-ez-zor' => 'دير الزور',
        'raqqa' => 'الرقة',
        'hasakah' => 'الحسكة',
        'daraa' => 'درعا',
        'sweida' => 'السويداء',
        'quneitra' => 'القنيطرة',
    ];

    /**
     * Governorate landmark icon filenames under `public/syid-assets/icons/governorates/{with-frame,no-frame}/`,
     * matching `/syid` (`SyidClient.tsx`).
     *
     * @var array<string, array{file: string, landmark_ar: string}>
     */
    private const ICON_ARTWORK = [
        'damascus' => ['file' => 'damascus-sword.svg', 'landmark_ar' => 'السيف الدمشقي'],
        'rural-damascus' => ['file' => 'rif-dimashq-ghouta.svg', 'landmark_ar' => 'غوطة ريف دمشق'],
        'aleppo' => ['file' => 'aleppo-citadel.svg', 'landmark_ar' => 'قلعة حلب'],
        'homs' => ['file' => 'homs-clock.svg', 'landmark_ar' => 'ساعة حمص'],
        'hama' => ['file' => 'hama-norias.svg', 'landmark_ar' => 'نواعير حماة'],
        'latakia' => ['file' => 'latakia-triumph-arch.svg', 'landmark_ar' => 'قوس النصر'],
        'tartus' => ['file' => 'tartous-arwad.svg', 'landmark_ar' => 'جزيرة أرواد'],
        'idlib' => ['file' => 'idlib-ruweiha.svg', 'landmark_ar' => 'رويحة إدلب'],
        'deir-ez-zor' => ['file' => 'deir-ez-zor-bridge.svg', 'landmark_ar' => 'الجسر المعلق'],
        'raqqa' => ['file' => 'raqqa-baghdad-gate.svg', 'landmark_ar' => 'بوابة بغداد'],
        'hasakah' => ['file' => 'hasakah-ain-diwar.svg', 'landmark_ar' => 'جسر عين ديوار'],
        'daraa' => ['file' => 'daraa-omari-mosque.svg', 'landmark_ar' => 'المسجد العمري'],
        'sweida' => ['file' => 'sweida-qanawat.svg', 'landmark_ar' => 'قنوات السويداء'],
        'quneitra' => ['file' => 'quneitra-beit-saida.svg', 'landmark_ar' => 'بيت صيدا'],
    ];

    /**
     * Designer attribution for the governorate icons (matching `/syid`).
     *
     * @var array{name_ar: string, x_url: string, instagram_url: string}
     */
    public const ICON_CREDIT = [
        'name_ar' => 'ولاء',
        'x_url' => 'https://x.com/walaa_akdesign',
        'instagram_url' => 'https://www.instagram.com/walaa_akdesign/',
    ];

    public const PLACES_CACHE_KEY = 'governorates:places-by-governorate:v1';

    public function __construct(
        private readonly GovernorateGeometry $geometry,
        private readonly PlaceGovernorates $placeGovernorates,
        private readonly WildlifeData $wildlife,
    ) {}

    /**
     * Relative public path of a governorate's framed icon SVG, if the file exists.
     */
    public static function iconPath(string $governorateId, bool $framed = true): ?string
    {
        $art = self::ICON_ARTWORK[$governorateId] ?? null;
        if ($art === null) {
            return null;
        }

        $folder = $framed ? 'with-frame' : 'no-frame';
        $relative = "/syid-assets/icons/governorates/{$folder}/{$art['file']}";

        return is_file(public_path(ltrim($relative, '/'))) ? $relative : null;
    }

    /**
     * All 14 governorate icon entries for the image sitemap.
     *
     * @return array<string, string> governorate id => site-relative SVG path
     */
    public static function allIconPaths(): array
    {
        $paths = [];
        foreach (Facts::governorates() as $gov) {
            $id = (string) $gov['id'];
            $path = self::iconPath($id, true);
            if ($path !== null) {
                $paths[$id] = $path;
            }
        }

        return $paths;
    }

    public static function centreAr(string $governorateId): string
    {
        return self::CENTRES_AR[$governorateId] ?? (string) (Facts::governorate($governorateId)['name_ar'] ?? '');
    }

    /**
     * Payload for the `/governorates` hub page.
     *
     * @return array{
     *     governorates: list<array<string, mixed>>,
     *     populationMeta: ?array{year: ?string, source_url: ?string, note: ?string, total: int},
     *     svgMap: array<string, mixed>,
     *     iconCredit: array{name_ar: string, x_url: string, instagram_url: string}
     * }
     */
    public function forHub(): array
    {
        $populations = $this->populationMap();
        $ordered = Facts::governorates();
        usort($ordered, fn (array $a, array $b) => ((int) $a['sort_order']) <=> ((int) $b['sort_order']));

        $items = [];
        $totalPopulation = 0;
        $popYear = null;
        $popSourceUrl = null;
        $popNote = null;

        foreach ($ordered as $gov) {
            $id = (string) $gov['id'];
            $pop = $populations[$id] ?? null;
            if ($pop !== null) {
                $totalPopulation += $pop['value'];
                $popYear ??= $pop['year'];
                $popSourceUrl ??= $pop['source_url'];
                $popNote ??= $pop['note'];
            }

            $items[] = [
                'id' => $id,
                'name_ar' => (string) $gov['name_ar'],
                'name_en' => (string) $gov['name_en'],
                'pcode' => (string) $gov['pcode'],
                'centre_ar' => self::centreAr($id),
                'area_sqkm' => $this->geometry->areaSqKm($id),
                'icon_path' => self::iconPath($id, true),
                'landmark_ar' => self::ICON_ARTWORK[$id]['landmark_ar'] ?? null,
                'population' => $pop,
            ];
        }

        $populationMeta = $totalPopulation > 0
            ? [
                'year' => $popYear,
                'source_url' => $popSourceUrl,
                'note' => $popNote,
                'total' => $totalPopulation,
            ]
            : null;

        return [
            'governorates' => $items,
            'populationMeta' => $populationMeta,
            'svgMap' => $this->geometry->svgMap(),
            'iconCredit' => self::ICON_CREDIT,
        ];
    }

    /**
     * Payload for a single `/governorates/{id}` page, or null if unknown.
     *
     * @return array<string, mixed>|null
     */
    public function forGovernorate(string $id): ?array
    {
        $gov = Facts::governorate($id);
        if ($gov === null) {
            return null;
        }

        $canonicalId = (string) $gov['id'];
        $populations = $this->populationMap();
        $officials = $this->officialsFor($canonicalId, (string) $gov['name_ar']);

        $otherGovernorates = [];
        $ordered = Facts::governorates();
        usort($ordered, fn (array $a, array $b) => ((int) $a['sort_order']) <=> ((int) $b['sort_order']));
        foreach ($ordered as $other) {
            if ((string) $other['id'] === $canonicalId) {
                continue;
            }
            $otherGovernorates[] = [
                'id' => (string) $other['id'],
                'name_ar' => (string) $other['name_ar'],
                'centre_ar' => self::centreAr((string) $other['id']),
                'icon_path' => self::iconPath((string) $other['id'], true),
            ];
        }

        return [
            'governorate' => [
                'id' => $canonicalId,
                'name_ar' => (string) $gov['name_ar'],
                'name_en' => (string) $gov['name_en'],
                'pcode' => (string) $gov['pcode'],
                'lat' => (float) $gov['lat'],
                'lng' => (float) $gov['lng'],
                'centre_ar' => self::centreAr($canonicalId),
                'area_sqkm' => $this->geometry->areaSqKm($canonicalId),
                'icon_path' => self::iconPath($canonicalId, true),
                'landmark_ar' => self::ICON_ARTWORK[$canonicalId]['landmark_ar'] ?? null,
            ],
            'population' => $populations[$canonicalId] ?? null,
            'officials' => $officials,
            'prayer' => $this->prayerFor($canonicalId),
            'transit' => $this->transitFor($canonicalId),
            'crossings' => $this->crossingsFor($canonicalId),
            'places' => $this->placesFor($canonicalId),
            'wildlife' => $this->wildlife->forGovernorate($canonicalId),
            'phonebook' => $this->phonebookFor($canonicalId, (string) $gov['name_ar']),
            'otherGovernorates' => $otherGovernorates,
            'iconCredit' => self::ICON_CREDIT,
        ];
    }

    /**
     * Resolve the current governor summary for SEO JSON-LD (`Person` node).
     * Returns null unless the governor is well-sourced (published `GovtOfficial` or sourced `governors.json`).
     *
     * @return array{name_ar: string, title_ar: string, slug: ?string, portrait_url: ?string, source_url: ?string}|null
     */
    public function governorForSeo(string $id): ?array
    {
        $gov = Facts::governorate($id);
        if ($gov === null) {
            return null;
        }

        $officials = $this->officialsFor((string) $gov['id'], (string) $gov['name_ar']);
        $governor = $officials['governor'] ?? null;
        if ($governor === null) {
            return null;
        }

        if (empty($governor['slug']) && empty($governor['source_url'])) {
            return null;
        }

        return [
            'name_ar' => $governor['name_ar'],
            'title_ar' => $governor['title_ar'],
            'slug' => $governor['slug'],
            'portrait_url' => $governor['portrait_url'],
            'source_url' => $governor['source_url'],
        ];
    }

    /**
     * Governorate-level population from the existing `population_demographics` table
     * (reusing the population atlas data — never duplicating it).
     *
     * Prefers governorate-level rows (`note = 'Governorate populations'`, `source_id = 4`,
     * https://www.geo-ref.net/en/syr.htm); falls back to any `data_type = 'population'` row
     * only if no governorate-level row exists for that governorate.
     *
     * @return array<string, array{value: int, year: ?string, source_url: ?string, note: ?string}>
     */
    private function populationMap(): array
    {
        try {
            $rows = PopulationDemographic::query()
                ->where('data_type', 'population')
                ->get(['source_id', 'note', 'date', 'source_url', 'city_name', 'value']);
        } catch (\Throwable) {
            return [];
        }

        $preferred = [];
        $fallback = [];

        foreach ($rows as $row) {
            $gov = Facts::governorateByAnyName((string) $row->city_name);
            if ($gov === null || (int) $row->value <= 0) {
                continue;
            }

            $govId = (string) $gov['id'];
            $entry = [
                'value' => (int) $row->value,
                'year' => $row->date ? $row->date->format('Y') : null,
                'source_url' => filled($row->source_url) ? (string) $row->source_url : null,
                'note' => filled($row->note) ? (string) $row->note : null,
            ];

            $isGovernorateLevel = (int) $row->source_id === 4
                || stripos((string) $row->note, 'governorate') !== false;

            if ($isGovernorateLevel) {
                $preferred[$govId] = $entry;
            } elseif (! isset($fallback[$govId])) {
                $fallback[$govId] = $entry;
            }
        }

        return $preferred + $fallback;
    }

    /**
     * Resolve governor and deputies from `govt_officials`/`govt_tenures` first,
     * falling back to and supplementing with `resources/data/governorates/governors.json` (جَرد).
     *
     * @return array{
     *     governor: ?array{
     *         name_ar: string,
     *         title_ar: string,
     *         start_date: ?string,
     *         decree: ?string,
     *         notes_ar: ?string,
     *         slug: ?string,
     *         portrait_url: ?string,
     *         source_label_ar: string,
     *         source_url: ?string
     *     },
     *     deputies: list<array{
     *         name_ar: string,
     *         title_ar: string,
     *         role_kind: string,
     *         slug: ?string,
     *         portrait_url: ?string,
     *         source_label_ar: string,
     *         source_url: ?string
     *     }>,
     *     jard_credit: ?array{name_ar: string, url: string, as_of: string}
     * }
     */
    private function officialsFor(string $governorateId, string $governorateNameAr): array
    {
        $jardFile = Facts::governors();
        $jardMeta = $jardFile['meta'];
        $jardEntry = $jardFile['governorates'][$governorateId] ?? null;
        $usedJard = false;

        $dbGovernor = null;
        $dbDeputies = [];
        $dbByNameFold = [];

        try {
            $tenures = GovtTenure::query()
                ->where('status', 'current')
                ->where(function ($q) {
                    $q->where('tier', 'governor')
                        ->orWhere('role_title_ar', 'like', '%محافظ%');
                })
                ->whereHas('official', fn ($q) => $q->published())
                ->with(['official.officialEntity', 'official.candidate', 'official.promiseSpeaker', 'institution'])
                ->get();

            foreach ($tenures as $tenure) {
                $official = $tenure->official;
                if (! $official instanceof GovtOfficial) {
                    continue;
                }

                $institutionName = (string) ($tenure->institution?->name_ar
                    ?: $tenure->institution?->name
                    ?: $tenure->institution_name_ar
                    ?: '');
                $roleTitle = (string) $tenure->role_title_ar;

                if (! $this->matchesGovernorateText($roleTitle.' '.$institutionName, $governorateId, $governorateNameAr)) {
                    continue;
                }

                // Exclude military/security roles (e.g. قائد الأمن الداخلي في محافظة ...).
                $foldedRole = ArabicSearch::fold($roleTitle);
                $isDeputy = str_contains($foldedRole, ArabicSearch::fold('نائب محافظ'))
                    || str_contains($foldedRole, ArabicSearch::fold('معاون محافظ'));
                $isGovernor = ! $isDeputy && (
                    $tenure->tier === 'governor'
                    || str_starts_with($foldedRole, ArabicSearch::fold('محافظ'))
                );

                if (! $isGovernor && ! $isDeputy) {
                    continue;
                }

                $record = [
                    'name_ar' => (string) ($official->full_name_ar ?: $official->display_name_ar),
                    'title_ar' => $roleTitle !== '' ? $roleTitle : 'محافظ '.$governorateNameAr,
                    'start_date' => $tenure->started_at?->toDateString(),
                    'decree' => filled($tenure->start_decree_ref) ? (string) $tenure->start_decree_ref : null,
                    'notes_ar' => filled($tenure->notes_ar) ? (string) $tenure->notes_ar : null,
                    'slug' => (string) $official->slug,
                    'portrait_url' => $official->resolvedPortrait(),
                    'source_label_ar' => 'السير الذاتية للمسؤولين',
                    'source_url' => '/govtcvs/'.$official->slug,
                ];

                $dbByNameFold[ArabicSearch::fold($record['name_ar'])] = $record;
                if (filled($official->display_name_ar)) {
                    $dbByNameFold[ArabicSearch::fold((string) $official->display_name_ar)] = $record;
                }

                if ($isGovernor && $dbGovernor === null) {
                    $dbGovernor = $record;
                } elseif ($isDeputy) {
                    $dbDeputies[] = [
                        'name_ar' => $record['name_ar'],
                        'title_ar' => $record['title_ar'],
                        'role_kind' => str_contains($foldedRole, ArabicSearch::fold('معاون')) ? 'معاون' : 'نائب',
                        'slug' => $record['slug'],
                        'portrait_url' => $record['portrait_url'],
                        'source_label_ar' => $record['source_label_ar'],
                        'source_url' => $record['source_url'],
                    ];
                }
            }
        } catch (\Throwable) {
            // Fall through to sourced JSON when DB tables aren't available.
        }

        $governor = $dbGovernor;
        if ($governor === null && is_array($jardEntry['governor'] ?? null)) {
            $jg = $jardEntry['governor'];
            $usedJard = true;
            $governor = [
                'name_ar' => (string) $jg['name_ar'],
                'title_ar' => (string) $jg['title_ar'],
                'start_date' => $jg['start_date'] ?? null,
                'decree' => $jg['decree'] ?? null,
                'notes_ar' => $jg['notes_ar'] ?? null,
                'slug' => null,
                'portrait_url' => null,
                'source_label_ar' => (string) $jardMeta['source_short_ar'],
                'source_url' => (string) $jg['source_url'],
            ];
        } elseif ($governor !== null && is_array($jardEntry['governor'] ?? null)) {
            // Fill missing decree/start_date/notes from sourced jard entry if DB lacks them.
            $jg = $jardEntry['governor'];
            if ($governor['start_date'] === null && ! empty($jg['start_date'])) {
                $governor['start_date'] = (string) $jg['start_date'];
                $usedJard = true;
            }
            if ($governor['decree'] === null && ! empty($jg['decree'])) {
                $governor['decree'] = (string) $jg['decree'];
                $usedJard = true;
            }
            if ($governor['notes_ar'] === null && ! empty($jg['notes_ar'])) {
                $governor['notes_ar'] = (string) $jg['notes_ar'];
                $usedJard = true;
            }
        }

        $deputies = $dbDeputies;
        $seenDeputyNames = [];
        foreach ($deputies as $d) {
            $seenDeputyNames[ArabicSearch::fold($d['name_ar'])] = true;
        }

        foreach ($jardEntry['deputies'] ?? [] as $jd) {
            $folded = ArabicSearch::fold((string) $jd['name_ar']);
            if (isset($seenDeputyNames[$folded])) {
                continue;
            }
            $usedJard = true;
            $seenDeputyNames[$folded] = true;
            $matchedDb = $dbByNameFold[$folded] ?? null;
            $deputies[] = [
                'name_ar' => (string) $jd['name_ar'],
                'title_ar' => (string) $jd['title_ar'],
                'role_kind' => (string) $jd['role_kind'],
                'slug' => $matchedDb['slug'] ?? null,
                'portrait_url' => $matchedDb['portrait_url'] ?? null,
                'source_label_ar' => (string) $jardMeta['source_short_ar'],
                'source_url' => (string) $jd['source_url'],
            ];
        }

        return [
            'governor' => $governor,
            'deputies' => $deputies,
            'jard_credit' => $usedJard ? [
                'name_ar' => (string) $jardMeta['source_short_ar'],
                'url' => (string) $jardMeta['source_url'],
                'as_of' => (string) $jardMeta['as_of'],
            ] : null,
        ];
    }

    /**
     * Today's prayer times (cached via PrayerController) and imsakiya availability.
     *
     * @return array{
     *     timings: array<string, string>,
     *     hijri: ?array{day: string, month: string, year: string},
     *     today: array{iso: string, gregorian_ar: string},
     *     prayer_url: string,
     *     ramadan_url: ?string
     * }|null
     */
    private function prayerFor(string $governorateId): ?array
    {
        $timingsPayload = PrayerController::timingsForGovernorate($governorateId);
        if ($timingsPayload === null || empty($timingsPayload['timings'])) {
            return null;
        }

        $hasImsakiya = false;
        try {
            $imsakiya = Facts::imsakiya(1448);
            $hasImsakiya = is_array($imsakiya['governorates'][$governorateId] ?? null)
                && $imsakiya['governorates'][$governorateId] !== [];
        } catch (\Throwable) {
            $hasImsakiya = false;
        }

        return [
            'timings' => $timingsPayload['timings'],
            'hijri' => $timingsPayload['hijri'] ?? null,
            'today' => PrayerController::todaySyriaInfo(),
            'prayer_url' => '/muslim/prayer/'.$governorateId,
            'ramadan_url' => $hasImsakiya ? '/muslim/ramadan/'.$governorateId : null,
        ];
    }

    /**
     * Active transit city and its published routes for this governorate.
     * Returns null when the governorate has no active transit city with published routes.
     *
     * @return array{city_id: string, city_name_ar: string, routes_count: int, map_url: string, routes: list<array{id: string, name_ar: string, stops_count: ?int, price_new: ?int, url: string}>}|null
     */
    private function transitFor(string $governorateId): ?array
    {
        try {
            $cities = City::where('status', 'active')->get(['id', 'name_ar']);
        } catch (\Throwable) {
            return null;
        }

        $matchedCity = null;
        foreach ($cities as $city) {
            $gov = Facts::governorateByAnyName((string) $city->id)
                ?? Facts::governorateByAnyName((string) $city->name_ar);
            if ($gov !== null && (string) $gov['id'] === $governorateId) {
                $matchedCity = $city;
                break;
            }
        }

        if ($matchedCity === null) {
            return null;
        }

        $routes = $matchedCity->routes()
            ->where('status', 'published')
            ->orderBy('name_ar')
            ->get(['id', 'name_ar', 'price_new']);

        if ($routes->isEmpty()) {
            return null;
        }

        return [
            'city_id' => (string) $matchedCity->id,
            'city_name_ar' => (string) $matchedCity->name_ar,
            'routes_count' => $routes->count(),
            'map_url' => '/transit/city/'.$matchedCity->id,
            'routes' => $routes->take(12)->map(fn ($r) => [
                'id' => (string) $r->id,
                'name_ar' => (string) $r->name_ar,
                'stops_count' => null,
                'price_new' => $r->price_new !== null ? (int) $r->price_new : null,
                'url' => '/transit/city/'.$matchedCity->id.'?route='.$r->id,
            ])->values()->all(),
        ];
    }

    /**
     * Border crossings and maritime ports located in this governorate.
     *
     * @return list<array{n: int, slug: string, name: string, category: string, country: ?string, op_type: ?string, opening_soon: bool, url: string}>
     */
    private function crossingsFor(string $governorateId): array
    {
        $data = Facts::json('crossings');
        $matched = [];

        foreach ($data['crossings'] ?? [] as $crossing) {
            if (! isset($crossing['lat'], $crossing['lon'], $crossing['slug'])) {
                continue;
            }

            $pointGov = $this->geometry->governorateIdForPoint((float) $crossing['lat'], (float) $crossing['lon']);
            if ($pointGov !== $governorateId) {
                continue;
            }

            $matched[] = [
                'n' => (int) $crossing['n'],
                'slug' => (string) $crossing['slug'],
                'name' => (string) $crossing['name'],
                'category' => (string) ($crossing['category'] ?? 'crossing'),
                'country' => $crossing['country'] ?? null,
                'op_type' => $crossing['opType'] ?? null,
                'opening_soon' => (bool) ($crossing['openingSoon'] ?? false),
                'url' => '/crossings/'.$crossing['slug'],
            ];
        }

        return $matched;
    }

    /**
     * Approved Mishwar places grouped by the governorate polygon they fall in,
     * most-saved first. The point-in-polygon pass covers every place, so it is
     * cached rather than repeated on each page view.
     *
     * @return array<string, list<array{id: int, name: string, category: string, description: ?string}>>
     */
    private function placesByGovernorate(): array
    {
        return Cache::remember(self::PLACES_CACHE_KEY, now()->addMinutes(30), function (): array {
            try {
                $govByPlace = $this->placeGovernorates->map();
                if ($govByPlace === []) {
                    return [];
                }

                $places = Place::query()
                    ->where('status', 'approved')
                    ->whereNotNull('lat')
                    ->whereNotNull('lng')
                    ->orderByDesc('saves_count')
                    ->orderBy('id')
                    ->get(['id', 'name', 'category', 'description']);
            } catch (\Throwable) {
                return [];
            }

            $grouped = [];
            foreach ($places as $place) {
                $governorateId = $govByPlace[(int) $place->id] ?? null;
                if ($governorateId === null) {
                    continue;
                }
                $grouped[$governorateId][] = [
                    'id' => (int) $place->id,
                    'name' => (string) $place->name,
                    'category' => (string) $place->category,
                    'description' => $place->description !== null ? (string) $place->description : null,
                ];
            }

            return $grouped;
        });
    }

    /**
     * Approved Mishwar places within this governorate's polygon: counts per category + notable places.
     * Returns null when the governorate has 0 approved places.
     *
     * @return array{total: int, hub_url: string, categories: list<array{key: string, label: string, count: int}>, notable: list<array{id: int, name: string, category: string, category_label: string, description: ?string, url: string}>}|null
     */
    private function placesFor(string $governorateId): ?array
    {
        $inGov = $this->placesByGovernorate()[$governorateId] ?? [];

        if ($inGov === []) {
            return null;
        }

        $categoryLabels = [];
        foreach (Facts::places()['categories'] as $cat) {
            $categoryLabels[(string) $cat['key']] = (string) $cat['label'];
        }

        $counts = [];
        foreach ($inGov as $place) {
            $key = (string) $place['category'];
            $counts[$key] = ($counts[$key] ?? 0) + 1;
        }
        arsort($counts);

        $categories = [];
        foreach ($counts as $key => $count) {
            $categories[] = [
                'key' => $key,
                'label' => $categoryLabels[$key] ?? $key,
                'count' => $count,
            ];
        }

        $notable = array_map(fn (array $p) => [
            'id' => $p['id'],
            'name' => $p['name'],
            'category' => $p['category'],
            'category_label' => $categoryLabels[$p['category']] ?? $p['category'],
            'description' => filled($p['description']) ? mb_strimwidth(trim((string) $p['description']), 0, 120, '…') : null,
            'url' => PlaceUrls::path($p['id'], $p['name']),
        ], array_slice($inGov, 0, 6));

        return [
            'total' => count($inGov),
            'hub_url' => '/mishwar/'.$governorateId,
            'categories' => $categories,
            'notable' => $notable,
        ];
    }

    /**
     * Active phonebook entries belonging to this governorate (by category id or entry title).
     *
     * @return list<array{id: string, name_ar: string, category_ar: string, number: string, is_whatsapp: bool, source_url: ?string}>
     */
    private function phonebookFor(string $governorateId, string $governorateNameAr): array
    {
        try {
            $entries = PhonebookEntry::query()
                ->where('phonebook_entries.is_active', true)
                ->join('phonebook_categories', 'phonebook_categories.id', '=', 'phonebook_entries.category_id')
                ->where('phonebook_categories.is_active', true)
                ->orderBy('phonebook_categories.order_column')
                ->orderBy('phonebook_entries.order_column')
                ->get([
                    'phonebook_entries.id',
                    'phonebook_entries.category_id',
                    'phonebook_entries.name_ar',
                    'phonebook_entries.name_en',
                    'phonebook_entries.number',
                    'phonebook_entries.is_whatsapp',
                    'phonebook_entries.source_url',
                    'phonebook_categories.label_ar as category_ar',
                ]);
        } catch (\Throwable) {
            return [];
        }

        $matched = [];
        foreach ($entries as $entry) {
            $catId = (string) $entry->category_id;
            $directGovMatch = false;

            if (str_ends_with($catId, '_governorate')) {
                $catGov = Facts::governorateByAnyName(str_replace('_governorate', '', $catId));
                if ($catGov !== null) {
                    if ((string) $catGov['id'] !== $governorateId) {
                        continue;
                    }
                    $directGovMatch = true;
                }
            }

            if (! $directGovMatch) {
                $haystack = trim((string) $entry->name_ar.' '.(string) $entry->name_en);
                if (! $this->matchesGovernorateText($haystack, $governorateId, $governorateNameAr)) {
                    continue;
                }
            }

            $matched[] = [
                'id' => (string) $entry->id,
                'name_ar' => (string) $entry->name_ar,
                'category_ar' => (string) $entry->category_ar,
                'number' => (string) $entry->number,
                'is_whatsapp' => (bool) $entry->is_whatsapp,
                'source_url' => filled($entry->source_url) ? (string) $entry->source_url : null,
            ];
        }

        return $matched;
    }

    /**
     * Match Arabic/English text to a governorate without confusing دمشق and ريف دمشق.
     */
    private function matchesGovernorateText(string $text, string $governorateId, string $governorateNameAr): bool
    {
        $folded = ArabicSearch::fold($text);
        $rifFolded = ArabicSearch::fold('ريف دمشق');
        $damascusAndRifFolded = ArabicSearch::fold('دمشق وريفها');

        if ($governorateId === 'rural-damascus') {
            return str_contains($folded, $rifFolded)
                || str_contains($folded, $damascusAndRifFolded)
                || str_contains($folded, 'rif dimashq')
                || str_contains($folded, 'rural damascus');
        }

        if ($governorateId === 'damascus') {
            if (str_contains($folded, $damascusAndRifFolded)) {
                return true;
            }
            $withoutRif = str_replace([$rifFolded, 'rif dimashq', 'rural damascus'], '', $folded);

            return str_contains($withoutRif, ArabicSearch::fold('دمشق'))
                || str_contains($withoutRif, 'damascus');
        }

        $nameFolded = ArabicSearch::fold($governorateNameAr);
        if ($nameFolded !== '' && str_contains($folded, $nameFolded)) {
            return true;
        }

        $gov = Facts::governorate($governorateId);
        if ($gov !== null) {
            $nameEnFolded = ArabicSearch::fold((string) $gov['name_en']);
            if ($nameEnFolded !== '' && str_contains($folded, $nameEnFolded)) {
                return true;
            }
        }

        return false;
    }
}
