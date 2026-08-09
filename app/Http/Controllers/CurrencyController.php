<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class CurrencyController extends Controller
{
    private const BASE_CURRENCY = 'SYP';

    private const CACHE_KEY = 'currency-rates:syp';

    private const CACHE_TTL_SECONDS = 3600;

    private const ERROR_MESSAGE = 'تعذر تحميل أسعار الصرف';

    /**
     * Return the latest Frankfurter reference rates with the Syrian pound as
     * the fixed base currency. Each quote keeps its own observation date
     * because the latest available date may differ between currency pairs.
     */
    public function index(): JsonResponse
    {
        $cached = Cache::get(self::CACHE_KEY);
        if (is_array($cached)) {
            return $this->respond($cached);
        }

        try {
            $baseUrl = rtrim((string) config('services.frankfurter.url'), '/');
            $response = Http::acceptJson()
                ->connectTimeout(3)
                ->timeout(5)
                ->get($baseUrl.'/v2/rates', [
                    'base' => self::BASE_CURRENCY,
                ]);
        } catch (\Throwable) {
            return $this->failedResponse();
        }

        if (! $response->successful()) {
            return $this->failedResponse();
        }

        $rows = $response->json();
        if (! is_array($rows)) {
            return $this->failedResponse();
        }

        $rates = [];

        foreach ($rows as $row) {
            if (! is_array($row)
                || ($row['base'] ?? null) !== self::BASE_CURRENCY
                || ! is_string($row['quote'] ?? null)
                || ! preg_match('/^[A-Z]{3}$/', $row['quote'])
                || ! is_numeric($row['rate'] ?? null)
                || (float) $row['rate'] <= 0
                || ! is_string($row['date'] ?? null)
                || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $row['date'])) {
                continue;
            }

            $quote = $row['quote'];
            if ($quote === self::BASE_CURRENCY) {
                continue;
            }

            $rates[$quote] = [
                'rate' => (float) $row['rate'],
                'date' => $row['date'],
            ];
        }

        if ($rates === []) {
            return $this->failedResponse();
        }

        ksort($rates);

        $payload = [
            'base' => self::BASE_CURRENCY,
            'rates' => $rates,
            'source' => 'Frankfurter',
        ];

        Cache::put(self::CACHE_KEY, $payload, self::CACHE_TTL_SECONDS);

        return $this->respond($payload);
    }

    private function respond(array $payload): JsonResponse
    {
        return response()->json($payload)
            ->header('Cache-Control', 'public, max-age=300');
    }

    private function failedResponse(): JsonResponse
    {
        return response()->json(['message' => self::ERROR_MESSAGE], 502);
    }
}
