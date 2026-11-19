<?php

declare(strict_types=1);

use App\Models\Population\PopulationDemographic;
use App\Models\Population\PopulationRainfall;
use Illuminate\Support\Facades\DB;

/** Fictional numbers only. These are not Syrian population or climate estimates. */
function nativeFixtureAtlasRows(): array
{
    $demographics = [];
    foreach (['Damascus' => 120000, 'Aleppo' => 340000] as $city => $value) {
        $demographics[] = [
            'id' => 910001 + count($demographics), 'data_type' => 'population', 'source_id' => 910001,
            'city_name' => $city, 'value' => $value, 'source_url' => null, 'date' => '2025-01-01 00:00:00',
            'note' => 'بيانات اصطناعية للاختبار المحلي: ليست إحصاءات حقيقية',
            'created_at' => null, 'updated_at' => null,
        ];
    }
    $rainfall = [];
    foreach (['SY01' => [110.0, 130.0, 100.0], 'SY02' => [220.0, 260.0, 200.0]] as $pcode => [$first, $latest, $average]) {
        foreach ([2024 => $first, 2025 => $latest] as $year => $value) {
            $rainfall[] = [
                'id' => 910001 + count($rainfall), 'pcode' => $pcode, 'year' => $year,
                'rainfall' => $value, 'rainfall_avg' => $average, 'created_at' => null, 'updated_at' => null,
            ];
        }
    }

    return ['demographics' => $demographics, 'rainfall' => $rainfall];
}

/** Compute only missing rows. Any ID, source, or province/year collision fails. */
function nativeFixtureAtlasPlan(array $demographics, array $rainfall): array
{
    $expected = nativeFixtureAtlasRows();
    $missing = ['demographics' => [], 'rainfall' => []];
    foreach (['demographics' => $demographics, 'rainfall' => $rainfall] as $kind => $actual) {
        foreach ($actual as $row) {
            $owned = $kind === 'demographics' ? ($row['source_id'] ?? null) === 910001
                : count(array_filter($expected[$kind], fn (array $item): bool => ($row['pcode'] ?? null) === $item['pcode'] && ($row['year'] ?? null) === $item['year'])) > 0;
            $sameId = array_values(array_filter($expected[$kind], fn (array $item): bool => ($row['id'] ?? null) === $item['id']));
            if (! $owned && $sameId === []) {
                continue;
            }
            if (count($sameId) !== 1 || $row != $sameId[0] || array_keys($row) !== array_keys($sameId[0])) {
                throw new RuntimeException('Synthetic Atlas identity has conflicting content. No existing row may be overwritten.');
            }
        }
        foreach ($expected[$kind] as $row) {
            $found = array_values(array_filter($actual, fn (array $item): bool => ($item['id'] ?? null) === $row['id']));
            if ($found === []) {
                $missing[$kind][] = $row;
            } elseif (count($found) !== 1) {
                throw new RuntimeException('Synthetic Atlas identity is duplicated.');
            }
        }
    }

    return $missing;
}

function nativeFixtureEnsureAtlas(): array
{
    $runtime = dirname(__DIR__, 2).'/.expo/local-fixture';
    if (PHP_SAPI !== 'cli' || ! app()->environment('testing') || config('app.url') !== 'https://127.0.0.1:9443'
        || DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== $runtime.'/database.sqlite'
        || is_link($runtime.'/database.sqlite') || realpath($runtime.'/database.sqlite') !== $runtime.'/database.sqlite'
        || trim(file_get_contents($runtime.'/fixture-marker')) !== 'native-loopback-fixture-v1') {
        throw new RuntimeException('The synthetic Atlas requires the exact isolated local testing database.');
    }

    return DB::transaction(function (): array {
        $read = fn (string $table): array => DB::table($table)->orderBy('id')->lockForUpdate()->get()->map(fn ($row): array => (array) $row)->all();
        $plan = nativeFixtureAtlasPlan($read('pop_demographics'), $read('pop_rainfall'));
        foreach (['demographics' => PopulationDemographic::class, 'rainfall' => PopulationRainfall::class] as $kind => $model) {
            foreach ($plan[$kind] as $row) {
                $record = new $model;
                $record->timestamps = false;
                $record->forceFill($row);
                $record->saveQuietly();
            }
        }
        if (nativeFixtureAtlasPlan($read('pop_demographics'), $read('pop_rainfall')) !== ['demographics' => [], 'rainfall' => []]) {
            throw new RuntimeException('The synthetic Atlas insert did not produce the exact baseline.');
        }

        return ['populationSourceId' => 910001, 'demographicRowsCreated' => count($plan['demographics']), 'rainfallRowsCreated' => count($plan['rainfall'])];
    });
}
