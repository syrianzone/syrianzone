<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Support\Facts;
use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Og\RecordCard;
use App\Support\Seo\Preview\DescribesCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use Illuminate\Http\Request;

/** /muslim/prayer/{city}: daily prayer times for one Syrian governorate. */
final class PrayerCityPreview implements CardSource, PreviewResolver
{
    use DescribesCards;

    private const SYRIAN_MONTHS_AR = [
        1 => 'كانون الثاني',
        2 => 'شباط',
        3 => 'آذار',
        4 => 'نيسان',
        5 => 'أيار',
        6 => 'حزيران',
        7 => 'تموز',
        8 => 'آب',
        9 => 'أيلول',
        10 => 'تشرين الأول',
        11 => 'تشرين الثاني',
        12 => 'كانون الأول',
    ];

    public static function cardType(): string
    {
        return 'prayer-city';
    }

    public static function fallbackCard(): string
    {
        return 'muslim-prayer';
    }

    public function resolve(Request $request, string $path): ?Preview
    {
        if (! preg_match('#^/muslim/prayer/([a-z0-9-]+)$#', $path, $m)) {
            return null;
        }

        $gov = Facts::governorate($m[1]);
        if ($gov === null) {
            return null;
        }

        $cityName = (string) $gov['name_ar'];
        $now = now()->timezone(Facts::syria()['timezone']);
        $monthName = self::SYRIAN_MONTHS_AR[(int) $now->format('n')] ?? '';
        $monthLabel = trim($monthName.' '.$now->format('Y'));

        return new Preview(
            title: 'مواقيت الصلاة في '.$cityName.' اليوم — '.$monthLabel.' | الركن الإسلامي',
            shareTitle: 'مواقيت الصلاة في '.$cityName.' — '.$monthLabel,
            description: 'مواقيت الصلاة اليومية والشهرية في '.$cityName.' لشهر '.$monthLabel.' (الفجر، الشروق، الظهر، العصر، المغرب، العشاء) بتوقيت سوريا مع اتجاه القبلة وعدّاد الصلاة القادمة.',
            canonicalPath: '/muslim/prayer/'.$gov['id'],
            image: $this->describe($gov)->url(),
            parent: ['/muslim/prayer', 'مواقيت الصلاة'],
        );
    }

    public function card(string $key): ?RecordCard
    {
        if ($key === '' || ! preg_match('/^[a-z0-9-]+$/', $key)) {
            return null;
        }

        $gov = Facts::governorate($key);

        return $gov === null ? null : $this->describe($gov);
    }

    /** @param  array<string, mixed>  $gov */
    private function describe(array $gov): RecordCard
    {
        return new RecordCard(self::cardType(), (string) $gov['id'], [
            'kind' => 'split',
            'url' => $this->address('/muslim/prayer/'.$gov['id']),
            'kicker' => ['icon' => 'muslim', 'label' => 'الركن الإسلامي'],
            'title' => 'مواقيت الصلاة في '.$gov['name_ar'],
            'subtitle' => 'الفجر · الشروق · الظهر · العصر · المغرب · العشاء',
            'art' => ['type' => 'icon', 'icon' => 'muslim'],
        ]);
    }
}
