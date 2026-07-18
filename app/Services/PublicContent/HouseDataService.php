<?php

declare(strict_types=1);

namespace App\Services\PublicContent;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

final class HouseDataService
{
    private const SHEET_ID = '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc';

    public const CANDIDATES_URL = 'https://docs.google.com/spreadsheets/d/'.self::SHEET_ID.'/export?format=csv&gid=109132918';

    public const WINNERS_URL = 'https://docs.google.com/spreadsheets/d/'.self::SHEET_ID.'/export?format=csv&gid=385944900';

    public const PRESIDENTIAL_URL = 'https://docs.google.com/spreadsheets/d/'.self::SHEET_ID.'/export?format=csv&gid=1851445664';

    /** @var array<string, string> */
    public const PROVINCE_URLS = [
        'all' => 'https://docs.google.com/spreadsheets/d/'.self::SHEET_ID.'/export?format=csv&gid=125118455',
        'qunaitra' => 'https://docs.google.com/spreadsheets/d/'.self::SHEET_ID.'/export?format=csv&gid=522040139',
        'idlib' => 'https://docs.google.com/spreadsheets/d/'.self::SHEET_ID.'/export?format=csv&gid=0',
        'hama' => 'https://docs.google.com/spreadsheets/d/'.self::SHEET_ID.'/export?format=csv&gid=694979899',
        'damascus' => 'https://docs.google.com/spreadsheets/d/'.self::SHEET_ID.'/export?format=csv&gid=1923715976',
        'rif-damascus' => 'https://docs.google.com/spreadsheets/d/'.self::SHEET_ID.'/export?format=csv&gid=1677791143',
        'daraa' => 'https://docs.google.com/spreadsheets/d/'.self::SHEET_ID.'/export?format=csv&gid=1028853845',
        'latakia' => 'https://docs.google.com/spreadsheets/d/'.self::SHEET_ID.'/export?format=csv&gid=638432279',
        'tartus' => 'https://docs.google.com/spreadsheets/d/'.self::SHEET_ID.'/export?format=csv&gid=1926010966',
        'homs' => 'https://docs.google.com/spreadsheets/d/'.self::SHEET_ID.'/export?format=csv&gid=252895295',
        'aleppo' => 'https://docs.google.com/spreadsheets/d/'.self::SHEET_ID.'/export?format=csv&gid=1121899715',
        'deir-ez-zor' => 'https://docs.google.com/spreadsheets/d/'.self::SHEET_ID.'/export?format=csv&gid=1166128088',
        'raqqa' => 'https://docs.google.com/spreadsheets/d/'.self::SHEET_ID.'/export?format=csv&gid=137630647',
        'hasakah' => 'https://docs.google.com/spreadsheets/d/'.self::SHEET_ID.'/export?format=csv&gid=2031427715',
    ];

    public function __construct(private readonly CsvDocument $csv) {}

    /**
     * @return array{rows: list<array<string, string>>, headers: list<string>}
     */
    public function get(string $mode, string $province): array
    {
        $url = match ($mode) {
            'candidates' => self::CANDIDATES_URL,
            'winners' => self::WINNERS_URL,
            'presidential' => self::PRESIDENTIAL_URL,
            default => self::PROVINCE_URLS[$province] ?? self::PROVINCE_URLS['damascus'],
        };

        return Cache::remember(
            "external_house_data:{$mode}:{$province}",
            3600,
            fn (): array => $this->fetch($url),
        );
    }

    /**
     * @return array{rows: list<array<string, string>>, headers: list<string>}
     */
    private function fetch(string $url): array
    {
        try {
            $response = Http::timeout(10)->get($url);
            if (! $response->successful() || str_contains($response->body(), '<!DOCTYPE html>')) {
                return ['rows' => [], 'headers' => []];
            }

            return $this->parse($response->body());
        } catch (Throwable $error) {
            Log::warning('Failed to fetch house data.', [
                'url' => $url,
                'error' => $error->getMessage(),
            ]);

            return ['rows' => [], 'headers' => []];
        }
    }

    /**
     * @return array{rows: list<array<string, string>>, headers: list<string>}
     */
    private function parse(string $body): array
    {
        $rows = [];

        foreach ($this->csv->rows($body) as $csvRow) {
            $row = $csvRow['values'];
            $appealStatus = $row['حالة الطعن'] ?? $row['AppealStatus'] ?? '';
            $sex = $this->normalizeSex($row['Sex'] ?? $row['الجنس'] ?? '');
            $age = $this->computeAge($row);
            $row['Age'] = (string) $age;
            $row['__nameNorm'] = $this->normalizeString($row['Name'] ?? $row['الاسم'] ?? '');
            $row['__placeNorm'] = $this->normalizeString($row['Place'] ?? $row['المكان'] ?? '');
            $row['__sexNorm'] = $sex;
            $row['__ageGroup'] = $this->ageGroup($age);
            $row['__appealStatus'] = trim($appealStatus);

            if ($row['__nameNorm'] === '' && $row['__placeNorm'] === '') {
                continue;
            }

            $rows[] = $row;
        }

        $headers = $rows === []
          ? []
          : array_values(array_filter(
              array_keys($rows[0]),
              fn (string $header): bool => ! str_starts_with($header, '__'),
          ));

        return [
            'rows' => $rows,
            'headers' => $headers,
        ];
    }

    /** @param array<string, string> $row */
    private function computeAge(array $row): int
    {
        $age = $this->number($row['Age'] ?? $row['العمر'] ?? $row['السن'] ?? '');
        if ($age > 0 && $age <= 120) {
            return (int) round($age);
        }

        $birthYear = $this->number($row['BirthYear'] ?? $row['سنة الميلاد'] ?? $row['سنة_الميلاد'] ?? '');
        if ($birthYear > 1900 && $birthYear < 2100) {
            return max(0, min(120, (int) date('Y') - (int) round($birthYear)));
        }

        return 0;
    }

    private function number(string $value): float
    {
        if (! preg_match('/-?\d+(?:[\.,]\d+)?/', $value, $matches)) {
            return 0;
        }

        return (float) str_replace(',', '.', $matches[0]);
    }

    private function normalizeString(string $value): string
    {
        $value = preg_replace('/[\x{064B}-\x{0652}\x{0670}\x{0640}]/u', '', $value) ?? '';

        return strtolower(trim(str_replace(
            ['أ', 'إ', 'آ', 'ة', 'ى'],
            ['ا', 'ا', 'ا', 'ه', 'ي'],
            $value,
        )));
    }

    private function normalizeSex(string $value): string
    {
        return match ($this->normalizeString($value)) {
            'ذكر' => 'ذكر',
            'انثى', 'انثي' => 'أنثى',
            default => '',
        };
    }

    private function ageGroup(int $age): string
    {
        return match (true) {
            $age < 30 => 'lt30',
            $age < 40 => '30s',
            $age < 50 => '40s',
            $age < 60 => '50s',
            default => '60p',
        };
    }
}
