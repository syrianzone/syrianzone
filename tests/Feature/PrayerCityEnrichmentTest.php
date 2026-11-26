<?php

use App\Http\Controllers\PrayerController;
use App\Support\Facts;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Cache::flush();
});

afterEach(function () {
    Carbon::setTestNow();
});

function calendarPayload(): array
{
    return [
        'code' => 200,
        'data' => [
            [
                'timings' => [
                    'Fajr' => '05:27 (+03)',
                    'Sunrise' => '06:54 (+03)',
                    'Dhuhr' => '12:15 (+03)',
                    'Asr' => '15:14 (+03)',
                    'Maghrib' => '17:36 (+03)',
                    'Isha' => '18:57 (+03)',
                ],
                'date' => [
                    'gregorian' => ['date' => '26-11-2026'],
                    'hijri' => [
                        'day' => '16',
                        'month' => ['ar' => 'جُمادى الآخرة'],
                        'year' => '1448',
                    ],
                ],
            ],
            [
                'timings' => [
                    'Fajr' => '05:28 (+03)',
                    'Sunrise' => '06:55 (+03)',
                    'Dhuhr' => '12:15 (+03)',
                    'Asr' => '15:14 (+03)',
                    'Maghrib' => '17:36 (+03)',
                    'Isha' => '18:57 (+03)',
                ],
                'date' => [
                    'gregorian' => ['date' => '27-11-2026'],
                    'hijri' => [
                        'day' => '17',
                        'month' => ['ar' => 'جُمادى الآخرة'],
                        'year' => '1448',
                    ],
                ],
            ],
        ],
    ];
}

test('prayer city page receives monthly calendar, qibla, and date props', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-26 12:00:00', 'Asia/Damascus'));

    Http::fake([
        '*/timings/*' => Http::response([
            'code' => 200,
            'data' => [
                'timings' => [
                    'Fajr' => '05:49',
                    'Sunrise' => '07:19',
                    'Dhuhr' => '12:19',
                    'Asr' => '15:00',
                    'Maghrib' => '17:18',
                    'Isha' => '18:43',
                ],
                'date' => [
                    'hijri' => ['day' => '16', 'month' => ['ar' => 'جُمادى الآخرة'], 'year' => '1448'],
                ],
            ],
        ], 200),
        '*/calendar/*' => Http::response(calendarPayload(), 200),
    ]);

    $this->get('/muslim/prayer/aleppo')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Muslim/Prayer/Index')
            ->where('initialCity', 'aleppo')
            ->where('initialCityName', 'حلب')
            ->where('monthlyCalendar.month_ar', 'تشرين الثاني')
            ->has('monthlyCalendar.days', 2)
            ->where('qibla.direction_ar', 'الجنوب')
            ->where('todayInfo.iso', '2026-11-26'));
});

test('prayer city page degrades gracefully when monthly calendar fetch fails', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-26 12:00:00', 'Asia/Damascus'));

    Http::fake([
        '*/timings/*' => Http::response([
            'code' => 200,
            'data' => [
                'timings' => [
                    'Fajr' => '05:49',
                    'Sunrise' => '07:19',
                    'Dhuhr' => '12:19',
                    'Asr' => '15:00',
                    'Maghrib' => '17:18',
                    'Isha' => '18:43',
                ],
                'date' => [
                    'hijri' => ['day' => '16', 'month' => ['ar' => 'جُمادى الآخرة'], 'year' => '1448'],
                ],
            ],
        ], 200),
        '*/calendar/*' => Http::response(['code' => 500], 500),
    ]);

    $this->get('/muslim/prayer/homs')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Muslim/Prayer/Index')
            ->where('initialCity', 'homs')
            ->where('monthlyCalendar', null)
            ->where('initialPrayer.timings.Fajr', '05:49'));
});

test('qibla bearing is computed for every governorate within valid compass range', function () {
    foreach (Facts::governorates() as $gov) {
        $qibla = PrayerController::qiblaForGovernorate((string) $gov['id']);
        expect($qibla)->not->toBeNull()
            ->and($qibla['degrees'])->toBeGreaterThan(140.0)
            ->and($qibla['degrees'])->toBeLessThan(210.0)
            ->and($qibla['description_ar'])->toContain((string) $gov['name_ar']);
    }
});

test('prayer city preview includes city name and current Syrian month', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-26 12:00:00', 'Asia/Damascus'));
    $meta = SeoMeta::resolve(Request::create('/muslim/prayer/aleppo', 'GET'));

    expect($meta['title'])->toContain('حلب')
        ->and($meta['title'])->toContain('تشرين الثاني 2026')
        ->and($meta['description'])->toContain('حلب')
        ->and($meta['description'])->toContain('تشرين الثاني 2026');
});

test('a failed upstream fetch is remembered so the next view does not wait on it again', function () {
    Http::fake(['*' => Http::response(['code' => 500], 500)]);

    expect(PrayerController::monthlyCalendarForGovernorate('aleppo'))->toBeNull()
        ->and(PrayerController::timingsForGovernorate('aleppo'))->toBeNull();
    Http::assertSentCount(2);

    // Within the back-off window neither helper calls upstream again.
    expect(PrayerController::monthlyCalendarForGovernorate('aleppo'))->toBeNull()
        ->and(PrayerController::timingsForGovernorate('aleppo'))->toBeNull();
    Http::assertSentCount(2);
});
