<?php

namespace App\Support;

use App\Http\Controllers\PrayerController;
use Carbon\CarbonImmutable;

/**
 * Server-side snapshot for `/roznama` so the first HTML always contains
 * today's Gregorian and Hijri dates and the days remaining until Ramadan.
 */
final class RoznamaToday
{
    /**
     * @return array{
     *     serverYear: int,
     *     serverToday: array{iso: string, gregorianAr: string, hijriAr: string},
     *     ramadan: array{hijriYear: int, expectedStartDate: string, expectedEndDate: string, daysLeft: int, status: 'upcoming'|'during'|'after'}
     * }
     */
    public static function props(): array
    {
        $tz = Facts::syria()['timezone'];
        $now = CarbonImmutable::now($tz);
        $todayInfo = PrayerController::todaySyriaInfo();
        $iso = $todayInfo['iso'];

        $imsakiya = Facts::imsakiya(1448)['meta'];
        $startDate = (string) $imsakiya['expected_start_date'];
        $endDate = (string) $imsakiya['expected_end_date'];

        $todayStart = CarbonImmutable::createFromFormat('Y-m-d', $iso, $tz)->startOfDay();
        $start = CarbonImmutable::createFromFormat('Y-m-d', $startDate, $tz)->startOfDay();
        $daysLeft = max(0, (int) $todayStart->diffInDays($start, false));

        $status = match (true) {
            $iso >= $startDate && $iso <= $endDate => 'during',
            $iso > $endDate => 'after',
            default => 'upcoming',
        };

        return [
            'serverYear' => (int) $now->format('Y'),
            'serverToday' => [
                'iso' => $iso,
                'gregorianAr' => $todayInfo['gregorian_ar'],
                'hijriAr' => self::hijriLabel($now, $tz),
            ],
            'ramadan' => [
                'hijriYear' => (int) ($imsakiya['hijri_year'] ?? 1448),
                'expectedStartDate' => $startDate,
                'expectedEndDate' => $endDate,
                'daysLeft' => $daysLeft,
                'status' => $status,
            ],
        ];
    }

    private static function hijriLabel(CarbonImmutable $now, string $tz): string
    {
        if (! class_exists(\IntlDateFormatter::class)) {
            return '';
        }

        try {
            $formatter = new \IntlDateFormatter(
                'ar@calendar=islamic-umalqura;numbers=latn',
                \IntlDateFormatter::LONG,
                \IntlDateFormatter::NONE,
                $tz,
                \IntlDateFormatter::TRADITIONAL,
                'd MMMM y',
            );
            $formatted = $formatter->format($now);
            if (! is_string($formatted) || $formatted === '') {
                return '';
            }

            return str_contains($formatted, 'هـ') ? $formatted : $formatted.' هـ';
        } catch (\Throwable) {
            return '';
        }
    }
}
