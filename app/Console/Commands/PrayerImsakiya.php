<?php

namespace App\Console\Commands;

use App\Support\Facts;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;

class PrayerImsakiya extends Command
{
    protected $signature = 'prayer:imsakiya {hijriYear=1448}';

    protected $description = 'Fetch Ramadan imsakiya timetable for all Syrian governorates from AlAdhan and write resources/data/imsakiya/{hijriYear}.json';

    private const WEEKDAYS_AR = [
        0 => 'الأحد',
        1 => 'الاثنين',
        2 => 'الثلاثاء',
        3 => 'الأربعاء',
        4 => 'الخميس',
        5 => 'الجمعة',
        6 => 'السبت',
    ];

    public function handle(): int
    {
        $hijriYear = (int) $this->argument('hijriYear');
        if ($hijriYear < 1400 || $hijriYear > 1600) {
            $this->error("Invalid Hijri year: {$hijriYear}");

            return self::FAILURE;
        }

        $method = (int) Facts::prayer()['default_method'];
        $timezone = Facts::syria()['timezone'];
        $baseUrl = $this->calendarBaseUrl();
        $endpoint = "{$baseUrl}/hijriCalendar/{$hijriYear}/9";

        $governoratesData = [];
        $expectedStartDate = null;
        $expectedEndDate = null;
        $daysCount = 0;

        foreach (Facts::governorates() as $gov) {
            $id = (string) $gov['id'];
            $this->info("Fetching Ramadan {$hijriYear} timetable for {$id}...");

            $response = Http::timeout(15)->get($endpoint, [
                'latitude' => (float) $gov['lat'],
                'longitude' => (float) $gov['lng'],
                'method' => $method,
                'timezonestring' => $timezone,
            ]);

            if (! $response->successful() || $response->json('code') !== 200) {
                $this->error("Failed to fetch imsakiya for {$id}: HTTP {$response->status()}");

                return self::FAILURE;
            }

            $days = $response->json('data');
            if (! is_array($days) || $days === []) {
                $this->error("Empty calendar data for {$id}");

                return self::FAILURE;
            }

            $rows = [];
            foreach ($days as $day) {
                $row = $this->normalizeDay($day);
                if ($row === null) {
                    $this->error("Malformed day entry for {$id}");

                    return self::FAILURE;
                }
                $rows[] = $row;
            }

            $governoratesData[$id] = $rows;

            if ($expectedStartDate === null && $rows !== []) {
                $expectedStartDate = $rows[0]['date'];
                $expectedEndDate = $rows[count($rows) - 1]['date'];
                $daysCount = count($rows);
            }
        }

        $payload = [
            'meta' => [
                'hijri_year' => $hijriYear,
                'method' => $method,
                'source' => $endpoint,
                'timezone' => $timezone,
                'generated_at' => now()->toIso8601String(),
                'expected_start_date' => $expectedStartDate,
                'expected_end_date' => $expectedEndDate,
                'days_count' => $daysCount,
                'day_offset' => 0,
                'minute_offset' => 0,
                'official_source_url' => null,
            ],
            'governorates' => $governoratesData,
        ];

        $dir = resource_path('data/imsakiya');
        File::ensureDirectoryExists($dir);
        $target = "{$dir}/{$hijriYear}.json";
        File::put(
            $target,
            json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n",
        );

        $this->info("Wrote {$target} ({$daysCount} days × ".count($governoratesData).' governorates).');

        return self::SUCCESS;
    }

    private function calendarBaseUrl(): string
    {
        $timingsUrl = rtrim((string) config('services.prayer.url', 'https://api.aladhan.com/v1/timings'), '/');

        return str_ends_with($timingsUrl, '/timings')
            ? substr($timingsUrl, 0, -strlen('/timings'))
            : 'https://api.aladhan.com/v1';
    }

    /**
     * @return array{hijri_day:int,date:string,weekday_ar:string,imsak:string,fajr:string,sunrise:string,dhuhr:string,asr:string,maghrib:string,isha:string}|null
     */
    private function normalizeDay(mixed $day): ?array
    {
        if (! is_array($day)) {
            return null;
        }

        $timings = $day['timings'] ?? null;
        $gregorianDate = $day['date']['gregorian']['date'] ?? null;
        $hijriDay = $day['date']['hijri']['day'] ?? null;

        if (! is_array($timings) || ! is_string($gregorianDate) || $hijriDay === null) {
            return null;
        }

        try {
            $parsedDate = Carbon::createFromFormat('d-m-Y', $gregorianDate);
        } catch (\Throwable) {
            return null;
        }

        $imsak = $this->stripTime($timings['Imsak'] ?? null);
        $fajr = $this->stripTime($timings['Fajr'] ?? null);
        $sunrise = $this->stripTime($timings['Sunrise'] ?? null);
        $dhuhr = $this->stripTime($timings['Dhuhr'] ?? null);
        $asr = $this->stripTime($timings['Asr'] ?? null);
        $maghrib = $this->stripTime($timings['Maghrib'] ?? null);
        $isha = $this->stripTime($timings['Isha'] ?? null);

        if (in_array(null, [$imsak, $fajr, $sunrise, $dhuhr, $asr, $maghrib, $isha], true)) {
            return null;
        }

        return [
            'hijri_day' => (int) $hijriDay,
            'date' => $parsedDate->format('Y-m-d'),
            'weekday_ar' => self::WEEKDAYS_AR[$parsedDate->dayOfWeek] ?? '',
            'imsak' => $imsak,
            'fajr' => $fajr,
            'sunrise' => $sunrise,
            'dhuhr' => $dhuhr,
            'asr' => $asr,
            'maghrib' => $maghrib,
            'isha' => $isha,
        ];
    }

    private function stripTime(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        if (preg_match('/(\d{2}:\d{2})/', trim($value), $m) !== 1) {
            return null;
        }

        return $m[1];
    }
}
