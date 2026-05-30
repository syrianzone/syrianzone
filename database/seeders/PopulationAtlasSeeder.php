<?php

namespace Database\Seeders;

use App\Models\Population\PopulationDemographic;
use App\Models\Population\PopulationRainfall;
use App\Models\Population\PopulationEnvironmentalLog;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

class PopulationAtlasSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedDemographics();
        $this->seedRainfall();
        $this->seedEnvironmentalLogs();
    }

    private function seedDemographics(): void
    {
        $csvPath = storage_path('app/seed_data/population.csv');

        if (!file_exists($csvPath)) {
            $this->command->warn('population.csv not found in storage/app/seed_data/');
            return;
        }

        $handle = fopen($csvPath, 'r');
        if ($handle === false) {
            $this->command->error('Could not open population.csv');
            return;
        }

        $header = fgetcsv($handle);
        if ($header === false) {
            fclose($handle);
            $this->command->error('Could not read CSV header');
            return;
        }

        $columnMap = array_flip($header);

        while (($row = fgetcsv($handle)) !== false) {
            $rawDate = $row[$columnMap['date']];
            $dateValue = null;

            if ($rawDate !== 'unknown' && !empty($rawDate)) {
                if (preg_match('/^\d{4}$/', $rawDate)) {
                    $dateValue = $rawDate . '-01-01';
                } else {
                    $dateValue = $rawDate;
                }
            }

            $data = [
                'data_type' => $row[$columnMap['data_type']],
                'source_id' => (int) $row[$columnMap['source_id']],
                'source_url' => $row[$columnMap['source_url']],
                'date' => $dateValue,
                'note' => $row[$columnMap['note']],
                'city_name' => $row[$columnMap['city_name']],
                'value' => (int) str_replace(',', '', $row[$columnMap['population']]),
            ];

            PopulationDemographic::firstOrCreate(
                [
                    'data_type' => $data['data_type'],
                    'source_id' => $data['source_id'],
                    'city_name' => $data['city_name'],
                ],
                $data
            );
        }

        fclose($handle);
        $this->command->info('Seeded demographics data');
    }

    private function seedRainfall(): void
    {
        $jsonPath = storage_path('app/seed_data/rainfall_yearly.json');

        if (!file_exists($jsonPath)) {
            $this->command->warn('rainfall_yearly.json not found in storage/app/seed_data/');
            return;
        }

        $jsonContent = file_get_contents($jsonPath);
        $data = json_decode($jsonContent, true);

        if ($data === null) {
            $this->command->error('Could not decode rainfall_yearly.json');
            return;
        }

        foreach ($data as $pcode => $years) {
            foreach ($years as $yearData) {
                PopulationRainfall::firstOrCreate(
                    [
                        'pcode' => $pcode,
                        'year' => $yearData['year'],
                    ],
                    [
                        'rainfall' => (float) $yearData['rainfall'],
                        'rainfall_avg' => (float) $yearData['rainfall_avg'],
                    ]
                );
            }
        }

        $this->command->info('Seeded rainfall data');
    }

    private function seedEnvironmentalLogs(): void
    {
        $cities = [
            ['name' => 'Damascus', 'lat' => 33.51, 'lon' => 36.29, 'population' => 2103000],
            ['name' => 'Aleppo', 'lat' => 36.20, 'lon' => 37.16, 'population' => 4118000],
            ['name' => 'Idlib', 'lat' => 35.933, 'lon' => 36.633, 'population' => 1172000],
            ['name' => 'Rif Dimashq', 'lat' => 33.5, 'lon' => 37.3833, 'population' => 3372000],
            ['name' => 'Homs', 'lat' => 34.73, 'lon' => 36.72, 'population' => 1790000],
            ['name' => 'Hama', 'lat' => 35.13, 'lon' => 36.76, 'population' => 2147000],
            ['name' => 'Daraa', 'lat' => 32.6264, 'lon' => 36.1033, 'population' => 966000],
            ['name' => 'Latakia', 'lat' => 35.53, 'lon' => 35.79, 'population' => 1346000],
            ['name' => 'Deir ez-Zor', 'lat' => 35.34, 'lon' => 40.14, 'population' => 1267000],
            ['name' => 'Quneitra', 'lat' => 33.0776, 'lon' => 35.8934, 'population' => 124000],
            ['name' => 'Raqqa', 'lat' => 35.95, 'lon' => 39.01, 'population' => 940000],
            ['name' => 'Al-Hasakah', 'lat' => 36.5079, 'lon' => 40.7463, 'population' => 1865000],
            ['name' => 'Tartus', 'lat' => 34.89, 'lon' => 35.89, 'population' => 1172000],
            ['name' => 'As-Suwayda', 'lat' => 32.709, 'lon' => 36.5695, 'population' => 540000],
        ];

        $yesterday = now()->subDay();

        foreach ($cities as $city) {
            PopulationEnvironmentalLog::updateOrCreate(
                ['city_name' => $city['name']],
                [
                    'lat' => $city['lat'],
                    'lon' => $city['lon'],
                    'population_ref' => $city['population'],
                    'current_conditions' => [],
                    'forecast_summary' => [],
                    'climate_trends' => [],
                    'air_quality' => [],
                    'drought_risk' => [],
                    'historical_summary' => [],
                    'last_updated_at' => $yesterday,
                ]
            );
        }

        $this->command->info('Seeded environmental logs for 14 cities');
    }
}
