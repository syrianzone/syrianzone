<?php

namespace App\Support\Seo\Preview;

use Carbon\CarbonInterface;

/** Small Arabic wording helpers shared by the preview resolvers. */
final class Arabic
{
    /** Levantine month names, as used in Syria and across the site. */
    private const MONTHS = [
        'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
        'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول',
    ];

    /** "10 أيلول 2025", with Western digits like the rest of the site. */
    public static function date(CarbonInterface $date): string
    {
        return $date->day.' '.self::MONTHS[$date->month - 1].' '.$date->year;
    }

    /**
     * The form of a counted noun that follows a number written in digits.
     *
     * @param  array{one:string,two:string,few:string,many:string}  $forms
     *                                                                      one: after 1 and whole hundreds (خط),
     *                                                                      two: exactly 2 (خطّان), few: 3-10 (خطوط),
     *                                                                      many: 11-99 (خطاً)
     */
    public static function counted(int $count, array $forms): string
    {
        $rest = $count % 100;

        return match (true) {
            $count === 2 => $forms['two'],
            $rest >= 3 && $rest <= 10 => $forms['few'],
            $rest >= 11 => $forms['many'],
            default => $forms['one'],
        };
    }

    /** One line of plain text, trimmed to a length that suits a description. */
    public static function excerpt(?string $text, int $limit = 160): string
    {
        $text = trim((string) preg_replace('/\s+/u', ' ', (string) $text));

        return mb_strlen($text) <= $limit ? $text : rtrim(mb_substr($text, 0, $limit - 1)).'…';
    }
}
