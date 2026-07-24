<?php

namespace Database\Seeders\Staging;

use App\Models\City;
use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\TransitRouteLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Transit demo data: 3 cities, 12 routes, ~110 stops, plus a review queue of
 * route drafts for the transit-admin panel.
 *
 * Four things about this module are not obvious:
 *
 * 1. GEOMETRY IS MYSQL SPATIAL, NOT JSON. cities.center/bounds, stops.geometry
 *    and route_geometries.geometry are real spatial columns. Eloquent has no
 *    cast for them (see App\Models\City / Stop / RouteGeometry: the columns are
 *    fillable but plain), so an updateOrCreate would bind the WKT/GeoJSON as a
 *    literal string and MySQL would reject it. Every geometry write here goes
 *    through raw SQL, exactly like App\Console\Commands\ImportTransitGeoJson,
 *    which is the only other producer of these rows.
 *
 * 2. SRID MATTERS FOR STOPS. The importer writes stops and route geometries
 *    with ST_GeomFromGeoJSON (SRID 4326) and cities with ST_GeomFromText
 *    (SRID 0). /api/v1/stops/nearby builds its comparison point with
 *    ST_GeomFromGeoJSON precisely because ST_Distance_Sphere errors on an SRID
 *    mismatch, so stops seeded through ST_GeomFromText would break that
 *    endpoint. We mirror the importer's choice per table, byte for byte.
 *
 * 3. STOPS AND THE LINE ARE THE SAME CURVE. Each route carries a short list of
 *    real corridor anchors. Stops are sampled at equal arc length along that
 *    polyline, and the LineString is sampled from the same polyline at 3x the
 *    resolution, so line point 3i is stop i. The drawn line provably threads
 *    through its stops in order instead of merely passing nearby.
 *
 * 4. CITIES ARE THE ONE UN-NAMESPACED KEY, SO THEY ARE INSERT-ONLY. Routes,
 *    stops and users all live behind a 'staging-' prefix and are rewritten
 *    freely on every boot. City ids cannot be prefixed (see seedCity), so the
 *    city write never updates an existing row. Everything else here is a
 *    deliberate reset back to the fixture state on each boot.
 *
 * Route ids are lowercase-and-hyphen only: routes/web.php constrains
 * /transit/city/{id}/route/{routeId} with [a-z0-9\-]+, so anything else 404s.
 */
class StagingTransitSeeder extends StagingSeed
{
    /** [id, name_ar, name_en, center [lng,lat], bounds [[minLng,minLat],[maxLng,maxLat]], zoom] */
    private const CITIES = [
        ['damascus', 'دمشق', 'Damascus', [36.2765, 33.5138], [[35.80, 33.30], [36.80, 33.70]], 12],
        ['aleppo', 'حلب', 'Aleppo', [37.1343, 36.2021], [[36.90, 36.00], [37.50, 36.45]], 12],
        ['homs', 'حمص', 'Homs', [36.7163, 34.7324], [[36.50, 34.55], [36.95, 34.95]], 12],
    ];

    /**
     * Four microbus/servees corridors per city. 'path' is the real-ish road
     * corridor as [lng, lat] anchors; 'stops' names are laid along it in order.
     */
    private const ROUTES = [
        'damascus' => [
            [
                'slug' => 'mezzeh-bab-touma',
                'name_ar' => 'المزة - باب توما',
                'name_en' => 'Mezzeh - Bab Touma',
                'color_index' => 1,
                'status' => 'published',
                'path' => [[36.2405, 33.5085], [36.2560, 33.5060], [36.2680, 33.5010], [36.2870, 33.5060], [36.2970, 33.5080], [36.3020, 33.5120], [36.3130, 33.5170]],
                'stops' => ['المزة فيلات غربية', 'المزة أوتوستراد', 'دوار كفرسوسة', 'جسر الرئيس', 'البرامكة', 'جامعة دمشق', 'الحجاز', 'المرجة', 'باب شرقي', 'باب توما'],
            ],
            [
                'slug' => 'rukn-eddin-hariqa',
                'name_ar' => 'ركن الدين - الحريقة',
                'name_en' => 'Rukn al-Din - Hariqa',
                'color_index' => 3,
                'status' => 'published',
                'path' => [[36.2985, 33.5340], [36.2940, 33.5250], [36.2905, 33.5180], [36.2960, 33.5140], [36.3040, 33.5105]],
                'stops' => ['ركن الدين', 'شيخ محي الدين', 'المهاجرين', 'الصالحية', 'شارع الحمرا', 'ساحة عرنوس', 'سبع بحرات', 'البحصة', 'الحريقة'],
            ],
            [
                'slug' => 'jaramana-abbasiyyin',
                'name_ar' => 'جرمانا - العباسيين',
                'name_en' => 'Jaramana - Abbasiyyin',
                'color_index' => 5,
                'status' => 'published',
                'path' => [[36.3470, 33.4870], [36.3400, 33.4960], [36.3320, 33.5060], [36.3250, 33.5140], [36.3190, 33.5200]],
                'stops' => ['دوار جرمانا', 'جرمانا البلد', 'المطاحن', 'الدويلعة', 'جسر الزبلطاني', 'كراجات الزبلطاني', 'مشفى ابن النفيس', 'ملعب العباسيين', 'كراجات العباسيين', 'ساحة العباسيين'],
            ],
            [
                'slug' => 'qudsaya-salhieh',
                'name_ar' => 'قدسيا - الصالحية',
                'name_en' => 'Qudsaya - Salhieh',
                'color_index' => 7,
                // hidden: gives the transit-admin panel a route to restore
                'status' => 'hidden',
                'path' => [[36.2170, 33.5500], [36.2350, 33.5410], [36.2600, 33.5250], [36.2760, 33.5130], [36.2900, 33.5180]],
                'stops' => ['ساحة قدسيا', 'مفرق الهامة', 'دمر البلد', 'دمر الشرقي', 'مشروع دمر', 'أوتوستراد المزة', 'ساحة الأمويين', 'شارع الجلاء', 'الصالحية'],
            ],
        ],
        'aleppo' => [
            [
                'slug' => 'suryan-jamiliyah',
                'name_ar' => 'السريان - الجميلية',
                'name_en' => 'Suryan - Jamiliyah',
                'color_index' => 0,
                'status' => 'published',
                'path' => [[37.1150, 36.2150], [37.1220, 36.2120], [37.1300, 36.2080], [37.1420, 36.2020], [37.1520, 36.2005]],
                'stops' => ['السريان الجديدة', 'السريان القديمة', 'شارع الفرقان', 'دوار الفرقان', 'محطة بغداد', 'العزيزية', 'الجميلية', 'ساحة سعد الله الجابري'],
            ],
            [
                'slug' => 'new-aleppo-bab-alfaraj',
                'name_ar' => 'حلب الجديدة - باب الفرج',
                'name_en' => 'New Aleppo - Bab al-Faraj',
                'color_index' => 2,
                'status' => 'published',
                'path' => [[37.0930, 36.2110], [37.1080, 36.1960], [37.1250, 36.2010], [37.1400, 36.2020], [37.1520, 36.2015]],
                'stops' => ['حلب الجديدة', 'الفرقان الغربي', 'الحمدانية', 'جامعة حلب', 'شارع النيل', 'العزيزية', 'الجميلية', 'التلل', 'باب الفرج'],
            ],
            [
                'slug' => 'shahba-citadel',
                'name_ar' => 'الشهباء - القلعة',
                'name_en' => 'Shahba - Citadel',
                'color_index' => 4,
                'status' => 'published',
                'path' => [[37.1000, 36.2280], [37.1150, 36.2200], [37.1300, 36.2120], [37.1480, 36.2030], [37.1628, 36.1990]],
                'stops' => ['الشهباء', 'الشهباء الجديدة', 'الموكامبو', 'الجامعة', 'السبيل', 'العزيزية', 'باب الفرج', 'الجديدة', 'باب النصر', 'القلعة'],
            ],
            [
                'slug' => 'midan-sakhour',
                'name_ar' => 'الميدان - الصاخور',
                'name_en' => 'Midan - Sakhour',
                'color_index' => 6,
                // disapproved: the other half of the admin status workflow
                'status' => 'disapproved',
                'path' => [[37.1470, 36.2100], [37.1560, 36.2160], [37.1680, 36.2250], [37.1760, 36.2330]],
                'stops' => ['الميدان', 'السليمانية', 'باب الحديد', 'الشعار', 'الهلك', 'بعيدين', 'الصاخور', 'دوار الصاخور'],
            ],
        ],
        'homs' => [
            [
                'slug' => 'waer-new-clock',
                'name_ar' => 'الوعر - الساعة الجديدة',
                'name_en' => 'Waer - New Clock',
                'color_index' => 1,
                'status' => 'published',
                'path' => [[36.6600, 34.7360], [36.6800, 34.7330], [36.7000, 34.7320], [36.7180, 34.7330]],
                'stops' => ['حي الوعر', 'الوعر القديم', 'دوار الوعر', 'حي القصور', 'شارع الدبلان', 'الملعب البلدي', 'النزهة', 'دوار الساعة الجديدة'],
            ],
            [
                'slug' => 'karm-alloz-baath-university',
                'name_ar' => 'كرم اللوز - جامعة البعث',
                'name_en' => 'Karm al-Loz - Baath University',
                'color_index' => 3,
                'status' => 'published',
                'path' => [[36.7280, 34.7420], [36.7220, 34.7300], [36.7180, 34.7250], [36.7350, 34.7150], [36.7500, 34.7080]],
                'stops' => ['كرم اللوز', 'جب الجندلي', 'باب السباع', 'الساعة القديمة', 'شارع القوتلي', 'الساعة الجديدة', 'حي الغوطة', 'عكرمة الجديدة', 'دوار الطلائع', 'جامعة البعث'],
            ],
            [
                'slug' => 'bab-tadmor-baba-amr',
                'name_ar' => 'باب تدمر - بابا عمرو',
                'name_en' => 'Bab Tadmor - Baba Amr',
                'color_index' => 5,
                'status' => 'published',
                'path' => [[36.7420, 34.7360], [36.7300, 34.7300], [36.7180, 34.7270], [36.7050, 34.7180], [36.6950, 34.7080]],
                'stops' => ['باب تدمر', 'كرم الزيتون', 'الحميدية', 'الساعة القديمة', 'شارع الستين', 'الإنشاءات', 'جورة الشياح', 'بابا عمرو'],
            ],
            [
                'slug' => 'zahra-akrama',
                'name_ar' => 'الزهراء - عكرمة',
                'name_en' => 'Zahra - Akrama',
                'color_index' => 8,
                'status' => 'published',
                'path' => [[36.7050, 34.7500], [36.7150, 34.7400], [36.7250, 34.7300], [36.7350, 34.7200], [36.7420, 34.7130]],
                'stops' => ['حي الزهراء', 'دوار الزهراء', 'المحطة', 'كرم اللوز', 'الغوطة', 'عكرمة القديمة', 'عكرمة الجديدة', 'دوار عكرمة', 'مشفى الزهراوي'],
            ],
        ],
    ];

    /** Pre-devaluation fares, in SYP. */
    private const OLD_FARES = [25, 50, 75, 100];

    /** Current fares, in SYP. */
    private const NEW_FARES = [1000, 1500, 2000, 2500, 3000];

    public function run(): void
    {
        $this->seedRandom('staging-transit');

        $out = $this->command?->getOutput();

        $users = StagingUsersSeeder::guides();
        $transitAdmin = $users->firstWhere('email', 'transit'.StagingUsersSeeder::DOMAIN);
        $owners = $users->whereIn('role', ['user'])->values();

        // Route is Searchable. If a staging box ever points SCOUT_DRIVER at a real
        // engine, an unguarded save would try to talk to it mid-seed; the seeder is
        // supposed to be network-free, so index syncing is off for the whole run.
        Route::withoutSyncingToSearch(function () use ($out, $owners, $transitAdmin) {
            foreach (self::CITIES as [$id, $nameAr, $nameEn, $center, $bounds, $zoom]) {
                $created = $this->seedCity($id, $nameAr, $nameEn, $center, $bounds, $zoom);
                $out?->writeln(sprintf(
                    '  <fg=gray>city</> %-10s %-8s %s',
                    $id,
                    $nameAr,
                    $created ? '' : '<fg=gray>(kept existing row)</>'
                ));

                foreach (self::ROUTES[$id] as $spec) {
                    $stopCount = $this->seedRoute($id, $spec, $owners);
                    $out?->writeln(sprintf(
                        '  <fg=gray>route</> %-34s %-12s %2d stops',
                        self::routeId($id, $spec['slug']),
                        $spec['status'],
                        $stopCount
                    ));
                }
            }

            $this->seedDrafts($transitAdmin, $owners, $out);
            $this->seedLogs($transitAdmin, $out);
        });

        // The city list and every map-data payload are cached for 10-60 minutes.
        // Without this, a fresh seed is invisible on /transit for the next hour.
        Cache::forget('transit:cities');
        foreach (self::CITIES as [$id]) {
            Cache::forget("transit:map-data:{$id}");
        }
    }

    /**
     * cities.center is a POINT and cities.bounds a POLYGON, both NOT NULL, so the
     * insert has to carry them: an updateOrCreate would try to INSERT without
     * them and hit "field has no default value". ST_GeomFromText matches the
     * importer, and the ring order matters because both TransitController and
     * routes/web.php read the north-east corner as coordinates[0][2].
     *
     * INSERT-ONLY, unlike every other write in this file. 'damascus', 'aleppo'
     * and 'homs' are the REAL production city ids: they are the ids in
     * resources/js/Pages/Transit/_data/cities.json and the ids
     * App\Console\Commands\ImportTransitGeoJson writes. They are the one set of
     * keys this module cannot namespace, because /transit/city/{id}/route/{...}
     * looks the city up in cities.json by that exact id, so a 'staging-damascus'
     * row would render a city page with no matching entry. So instead of an
     * upsert we fill the row in only when it is missing: a staging box restored
     * from a production dump keeps its imported name, centre, bounds and zoom,
     * and only gains cities it did not already have.
     *
     * The no-op ON DUPLICATE KEY UPDATE (rather than a read-then-insert) keeps
     * this a single atomic statement, and drops the VALUES(col) form that MySQL
     * has deprecated since 8.0.20.
     *
     * @return bool true when the row was created, false when one already existed
     */
    private function seedCity(string $id, string $nameAr, string $nameEn, array $center, array $bounds, int $zoom): bool
    {
        [$minLng, $minLat] = $bounds[0];
        [$maxLng, $maxLat] = $bounds[1];

        $polygon = "POLYGON(($minLng $minLat, $maxLng $minLat, $maxLng $maxLat, $minLng $maxLat, $minLng $minLat))";
        $point = "POINT({$center[0]} {$center[1]})";

        return DB::affectingStatement(
            'INSERT INTO cities (id, name_ar, name_en, center, bounds, zoom, status, created_at, updated_at) '
            .'VALUES (?, ?, ?, ST_GeomFromText(?), ST_GeomFromText(?), ?, ?, ?, ?) '
            .'ON DUPLICATE KEY UPDATE id = cities.id',
            [$id, $nameAr, $nameEn, $point, $polygon, $zoom, 'active', now(), now()]
        ) > 0;
    }

    /** @return int number of stops attached */
    private function seedRoute(string $cityId, array $spec, Collection $owners): int
    {
        $routeId = self::routeId($cityId, $spec['slug']);
        $names = $spec['stops'];
        $count = count($names);

        $owner = $owners->isEmpty() ? null : $owners[$this->int(0, $owners->count() - 1)];

        // DELIBERATE RESET. This rewrites 'status' every boot, so a tester who
        // hid or disapproved a staging route through the transit-admin panel gets
        // it back as published on the next container start. That is the intent:
        // these are demo fixtures and staging boots want a known starting state,
        // one route hidden and one disapproved so the panel always has something
        // to act on. Only ids under the 'staging-' prefix are touched, so real
        // imported routes are never reverted. Nothing is orphaned by the reset;
        // the pivot and stop cleanup below picks up whatever the panel created.
        Route::updateOrCreate(
            ['id' => $routeId],
            [
                'city_id' => $cityId,
                'name_ar' => $spec['name_ar'],
                'name_en' => $spec['name_en'],
                'color_index' => $spec['color_index'],
                'price_old' => $this->pick(self::OLD_FARES),
                'price_new' => $this->pick(self::NEW_FARES),
                'status' => $spec['status'],
                'user_id' => $owner?->id,
            ]
        );

        // Stops at equal arc length along the corridor; the line is the same curve
        // at 3x resolution, so line[3i] === stops[i] to the rounded digit.
        $stopPoints = $this->pointsAlong($spec['path'], $count);
        $linePoints = $this->pointsAlong($spec['path'], ($count - 1) * 3 + 1);

        $stopIds = [];

        foreach ($names as $i => $nameAr) {
            $stopId = sprintf('%s-s%02d', $routeId, $i + 1);
            $stopIds[] = $stopId;

            $geojson = json_encode(
                ['type' => 'Point', 'coordinates' => $stopPoints[$i]],
                JSON_UNESCAPED_UNICODE
            );

            DB::statement(
                'INSERT INTO stops (id, city_id, name_ar, geometry, created_at, updated_at) '
                .'VALUES (?, ?, ?, ST_GeomFromGeoJSON(?), ?, ?) '
                .'ON DUPLICATE KEY UPDATE city_id = VALUES(city_id), name_ar = VALUES(name_ar), '
                .'geometry = VALUES(geometry), updated_at = VALUES(updated_at)',
                [$stopId, $cityId, $nameAr, $geojson, now(), now()]
            );

            // route_stop has no unique index on (route_id, stop_id), so a plain
            // insert would pile up duplicates on the second run. updateOrInsert
            // keys on the pair by hand and keeps the pivot at one row per stop.
            DB::table('route_stop')->updateOrInsert(
                ['route_id' => $routeId, 'stop_id' => $stopId],
                ['order' => $i + 1, 'created_at' => now(), 'updated_at' => now()]
            );
        }

        // Drop pivot rows this route should no longer have: leftovers from an
        // older, longer version of the fixture, and the stop-<uuid> rows
        // TransitAdminController::approve substitutes when a tester approves the
        // linked draft (it wipes route_stop for the route and inserts fresh stops).
        // Clearing only the pivot would leave those stops behind forever, one set
        // per approval, so anything left unreferenced afterwards goes too.
        $strayIds = DB::table('route_stop')
            ->where('route_id', $routeId)
            ->whereNotIn('stop_id', $stopIds)
            ->pluck('stop_id')
            ->all();

        if ($strayIds !== []) {
            DB::table('route_stop')
                ->where('route_id', $routeId)
                ->whereIn('stop_id', $strayIds)
                ->delete();

            // Scoped to stops that were on this staging route and are now on no
            // route at all, so a stop shared with a real imported route survives.
            DB::table('stops')
                ->whereIn('stops.id', $strayIds)
                ->whereNotExists(function ($query) {
                    $query->select(DB::raw(1))
                        ->from('route_stop')
                        ->whereColumn('route_stop.stop_id', 'stops.id');
                })
                ->delete();
        }

        $this->writeGeometry($routeId, [
            'type' => 'LineString',
            'coordinates' => $linePoints,
        ]);

        return $count;
    }

    /**
     * route_geometries keys on an autoincrement id with only a plain FK on
     * route_id, so there is nothing for ON DUPLICATE KEY to catch. Rewrite in
     * place when a row already exists.
     */
    private function writeGeometry(string $routeId, array $geometry): void
    {
        $json = json_encode($geometry);

        $exists = DB::table('route_geometries')->where('route_id', $routeId)->exists();

        if ($exists) {
            DB::statement(
                'UPDATE route_geometries SET geometry = ST_GeomFromGeoJSON(?), updated_at = ? WHERE route_id = ?',
                [$json, now(), $routeId]
            );

            return;
        }

        DB::statement(
            'INSERT INTO route_geometries (route_id, geometry, created_at, updated_at) VALUES (?, ST_GeomFromGeoJSON(?), ?, ?)',
            [$routeId, $json, now(), now()]
        );
    }

    /**
     * The transit-admin review queue. Covers all three enum values, a submission
     * with no user (route_drafts.user_id went nullable for anonymous studio
     * submissions), a rejection carrying its reason, and an edit-of-existing
     * draft that links back through route_id.
     */
    private function seedDrafts(?User $transitAdmin, Collection $owners, $out): void
    {
        $contributor = $owners->isEmpty() ? null : $owners->first();

        $drafts = [
            [
                'city_id' => 'damascus',
                'name_ar' => 'مقترح: التضامن - الزاهرة',
                'name_en' => 'Proposed: Tadamon - Zahira',
                'status' => 'pending',
                'user' => $contributor,
                'route_id' => null,
                'rejection_reason' => null,
                'notes' => 'خط جديد يخدم المنطقة الجنوبية، مقترح من السائقين.',
                'path' => [[36.3120, 33.4790], [36.3060, 33.4880], [36.2990, 33.4960]],
                'stops' => ['التضامن', 'نهر عيشة', 'الزاهرة'],
            ],
            [
                'city_id' => 'aleppo',
                'name_ar' => 'مقترح: الأشرفية - الليرمون',
                'name_en' => 'Proposed: Ashrafieh - Layramoun',
                'status' => 'pending',
                // anonymous studio submission: user_id stays null
                'user' => null,
                'route_id' => null,
                'rejection_reason' => null,
                'notes' => 'مساهمة من زائر غير مسجل، بحاجة إلى تدقيق المسار.',
                'path' => [[37.1180, 36.2350], [37.1050, 36.2300], [37.0930, 36.2260]],
                'stops' => ['الأشرفية', 'بستان الباشا', 'الليرمون'],
            ],
            [
                'city_id' => 'homs',
                'name_ar' => 'تعديل: الوعر - الساعة الجديدة',
                'name_en' => 'Edit: Waer - New Clock',
                'status' => 'pending',
                'user' => null,
                // edit of a live route: the panel shows this as an update, not a new line
                'route_id' => self::routeId('homs', 'waer-new-clock'),
                'rejection_reason' => null,
                'notes' => 'إضافة موقفين جديدين قرب الملعب البلدي.',
                'path' => [[36.6600, 34.7360], [36.6900, 34.7325], [36.7180, 34.7330]],
                'stops' => ['حي الوعر', 'دوار الوعر', 'دوار الساعة الجديدة'],
            ],
            [
                'city_id' => 'damascus',
                'name_ar' => 'مقترح: برزة - القابون',
                'name_en' => 'Proposed: Barzeh - Qaboun',
                'status' => 'approved',
                'user' => $transitAdmin,
                'route_id' => null,
                'rejection_reason' => null,
                'notes' => 'تمت الموافقة بعد التحقق من المسار ميدانياً.',
                'path' => [[36.3210, 33.5410], [36.3280, 33.5310], [36.3340, 33.5230]],
                'stops' => ['برزة البلد', 'تشرين', 'القابون'],
            ],
            [
                'city_id' => 'aleppo',
                'name_ar' => 'مقترح: صلاح الدين - الزهراء',
                'name_en' => 'Proposed: Salah al-Din - Zahra',
                'status' => 'rejected',
                'user' => $transitAdmin,
                'route_id' => null,
                'rejection_reason' => 'المسار مكرر مع خط قائم، والإحداثيات لا تتبع الطريق الفعلي.',
                'notes' => 'أعيد للمساهم مع طلب تصحيح.',
                'path' => [[37.1300, 36.1900], [37.1200, 36.1850], [37.1100, 36.1800]],
                'stops' => ['صلاح الدين', 'السكري', 'الزهراء'],
            ],
        ];

        foreach ($drafts as $draft) {
            $stopPoints = $this->pointsAlong($draft['path'], count($draft['stops']));
            $linePoints = $this->pointsAlong($draft['path'], (count($draft['stops']) - 1) * 3 + 1);

            $features = [[
                'type' => 'Feature',
                'properties' => ['type' => 'route'],
                'geometry' => ['type' => 'LineString', 'coordinates' => $linePoints],
            ]];

            foreach ($draft['stops'] as $i => $stopName) {
                $features[] = [
                    'type' => 'Feature',
                    'properties' => ['type' => 'stop', 'nameAr' => $stopName],
                    'geometry' => ['type' => 'Point', 'coordinates' => $stopPoints[$i]],
                ];
            }

            // DELIBERATE RESET, same reasoning as the routes above: 'status' goes
            // back to the fixture value on every boot, so approving or rejecting a
            // pending draft in the panel does not survive a container restart and
            // the review queue always has three pending items to work through.
            // The rows these drafts are matched on (city_id + name_ar) all carry a
            // 'مقترح:'/'تعديل:' prefix no real submission uses, so a re-seed cannot
            // reach a genuine contributor's draft.
            $row = RouteDraft::updateOrCreate(
                ['city_id' => $draft['city_id'], 'name_ar' => $draft['name_ar']],
                [
                    'user_id' => $draft['user']?->id,
                    'route_id' => $draft['route_id'],
                    'name_en' => $draft['name_en'],
                    'price' => $this->pick(self::NEW_FARES),
                    'notes' => $draft['notes'],
                    'geojson' => ['type' => 'FeatureCollection', 'features' => $features],
                    'status' => $draft['status'],
                    'rejection_reason' => $draft['rejection_reason'],
                ]
            );

            // created_at is not in RouteDraft::$fillable, so mass assignment drops it
            // silently. Backdate only on first insert: the review queue sorts by age
            // and a re-seed should not shuffle it.
            $this->backdate($row);

            $out?->writeln(sprintf(
                '  <fg=gray>draft</> %-34s %-9s %s',
                $draft['city_id'].'/'.$draft['status'],
                $draft['status'],
                $draft['user'] ? $draft['user']->email : '(anonymous)'
            ));
        }
    }

    /** A little history so the admin panel's activity log is not empty. */
    private function seedLogs(?User $transitAdmin, $out): void
    {
        $logs = [
            [self::routeId('damascus', 'qudsaya-salhieh'), 'hidden', "إخفاء الخط 'قدسيا - الصالحية' مؤقتاً لمراجعة المسار"],
            [self::routeId('aleppo', 'midan-sakhour'), 'disapproved', "تغيير حالة الخط 'الميدان - الصاخور' من 'منشور' إلى 'غير معتمد'"],
            [self::routeId('damascus', 'mezzeh-bab-touma'), 'admin_updated', "تحديث أجرة الخط 'المزة - باب توما'"],
            [self::routeId('homs', 'waer-new-clock'), 'approved', "اعتماد الخط 'الوعر - الساعة الجديدة' بعد التحقق"],
        ];

        foreach ($logs as [$routeId, $action, $description]) {
            $row = TransitRouteLog::updateOrCreate(
                ['route_id' => $routeId, 'action' => $action],
                [
                    'description' => $description,
                    'user_id' => $transitAdmin?->id,
                ]
            );

            $this->backdate($row);
        }

        $out?->writeln(sprintf('  <fg=gray>logs</>  %d transit route log entries', count($logs)));
    }

    /**
     * Push a freshly inserted row into the past. Timestamps are outside
     * $fillable on these models, so this cannot go through updateOrCreate, and
     * it only fires on insert so repeated seeds leave existing rows alone.
     */
    private function backdate(Model $row): void
    {
        // Drawn before the early return on purpose: the PRNG must advance the same
        // number of steps on a re-seed as on a first seed, or every value after
        // this point shifts.
        $when = $this->pastDate(60, 2);

        if (! $row->wasRecentlyCreated) {
            return;
        }

        $row->forceFill(['created_at' => $when, 'updated_at' => $when])->saveQuietly();
    }

    /**
     * Sample $count points at equal arc length along a [lng, lat] polyline.
     * Longitude is scaled by cos(lat) so spacing is even on the ground rather
     * than even in degrees, which at Syrian latitudes is a ~20% difference.
     *
     * @param  array<int, array{0: float, 1: float}>  $path
     * @return array<int, array{0: float, 1: float}>
     */
    private function pointsAlong(array $path, int $count): array
    {
        $segments = count($path) - 1;
        $lengths = [];
        $total = 0.0;

        for ($i = 0; $i < $segments; $i++) {
            $dx = ($path[$i + 1][0] - $path[$i][0]) * cos(deg2rad($path[$i][1]));
            $dy = $path[$i + 1][1] - $path[$i][1];
            $length = sqrt($dx * $dx + $dy * $dy);
            $lengths[] = $length;
            $total += $length;
        }

        $points = [];

        for ($k = 0; $k < $count; $k++) {
            $target = $count > 1 ? $total * ($k / ($count - 1)) : 0.0;
            $accumulated = 0.0;
            $point = $path[$segments];

            for ($i = 0; $i < $segments; $i++) {
                $isLast = $i === $segments - 1;

                if ($target <= $accumulated + $lengths[$i] || $isLast) {
                    $t = $lengths[$i] > 0 ? ($target - $accumulated) / $lengths[$i] : 0.0;
                    $t = max(0.0, min(1.0, $t));
                    $point = [
                        round($path[$i][0] + ($path[$i + 1][0] - $path[$i][0]) * $t, 6),
                        round($path[$i][1] + ($path[$i + 1][1] - $path[$i][1]) * $t, 6),
                    ];
                    break;
                }

                $accumulated += $lengths[$i];
            }

            $points[] = $point;
        }

        return $points;
    }

    private static function routeId(string $cityId, string $slug): string
    {
        return 'staging-'.$cityId.'-'.$slug;
    }
}
