<?php

use App\Support\Facts;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;

function imsakiyaDayPayload(int $hijriDay, string $gregorianDate): array
{
    return [
        'timings' => [
            'Imsak' => '05:52 (+03)',
            'Fajr' => '06:02 (+03)',
            'Sunrise' => '07:26 (+03)',
            'Dhuhr' => '12:49 (+03)',
            'Asr' => '15:49 (+03)',
            'Maghrib' => '18:13 (+03)',
            'Isha' => '19:32 (+03)',
        ],
        'date' => [
            'gregorian' => [
                'date' => $gregorianDate,
            ],
            'hijri' => [
                'day' => (string) $hijriDay,
            ],
        ],
    ];
}

test('prayer:imsakiya command writes normalized timetable JSON for all 14 governorates', function () {
    $testYear = 1499;
    $targetPath = resource_path("data/imsakiya/{$testYear}.json");
    File::delete($targetPath);

    try {
        Http::fake([
            '*' => Http::response([
                'code' => 200,
                'data' => [
                    imsakiyaDayPayload(1, '08-02-2027'),
                    imsakiyaDayPayload(2, '09-02-2027'),
                ],
            ], 200),
        ]);

        $this->artisan("prayer:imsakiya {$testYear}")
            ->assertExitCode(0);

        expect(File::exists($targetPath))->toBeTrue();

        $written = json_decode((string) File::get($targetPath), true, flags: JSON_THROW_ON_ERROR);

        expect($written['meta']['hijri_year'])->toBe($testYear)
            ->and($written['meta']['method'])->toBe((int) Facts::prayer()['default_method'])
            ->and($written['meta']['day_offset'])->toBe(0)
            ->and($written['meta']['minute_offset'])->toBe(0)
            ->and($written['meta']['official_source_url'])->toBeNull()
            ->and($written['meta']['expected_start_date'])->toBe('2027-02-08')
            ->and($written['meta']['days_count'])->toBe(2)
            ->and(array_keys($written['governorates']))->toHaveCount(count(Facts::governorates()));

        $damascusDay1 = $written['governorates']['damascus'][0];
        expect($damascusDay1)->toBe([
            'hijri_day' => 1,
            'date' => '2027-02-08',
            'weekday_ar' => 'الاثنين',
            'imsak' => '05:52',
            'fajr' => '06:02',
            'sunrise' => '07:26',
            'dhuhr' => '12:49',
            'asr' => '15:49',
            'maghrib' => '18:13',
            'isha' => '19:32',
        ]);

        Http::assertSentCount(count(Facts::governorates()));
    } finally {
        File::delete($targetPath);
    }
});

test('prayer:imsakiya command fails cleanly on upstream failure', function () {
    $testYear = 1498;
    $targetPath = resource_path("data/imsakiya/{$testYear}.json");
    File::delete($targetPath);

    Http::fake(['*' => Http::response(['code' => 500], 500)]);

    $this->artisan("prayer:imsakiya {$testYear}")
        ->assertExitCode(1);

    expect(File::exists($targetPath))->toBeFalse();
});
