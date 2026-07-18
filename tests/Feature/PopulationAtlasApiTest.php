<?php

namespace Tests\Feature;

use App\Models\Population\PopulationDemographic;
use App\Models\Population\PopulationEnvironmentalLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class PopulationAtlasApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
    }

    public function test_master_contract_keeps_empty_groups_and_rainfall_as_objects(): void
    {
        Cache::put('population_master', ['legacy' => true], 3600);
        PopulationDemographic::query()->create([
            'city_name' => 'Damascus',
            'data_type' => 'unsupported',
            'date' => null,
            'note' => null,
            'source_id' => 99,
            'source_url' => null,
            'value' => 1,
        ]);

        $response = $this->getJson('/api/population/master');

        $response->assertOk()
            ->assertJsonPath('groups.population', [])
            ->assertJsonPath('groups.idp', [])
            ->assertJsonPath('groups.idp_returnees', [])
            ->assertJsonPath('groups.rainfall', [])
            ->assertJsonPath('groups.environmental', []);

        $response->assertJsonMissingPath('groups.unsupported');

        $this->assertStringContainsString('"rainfall_data":{}', $response->getContent());
    }

    public function test_environment_contract_keeps_city_measurements_as_objects(): void
    {
        Cache::put('population_env_report', ['legacy' => true], 3600);
        PopulationEnvironmentalLog::query()->create([
            'air_quality' => [],
            'city_name' => 'Damascus',
            'climate_trends' => [],
            'current_conditions' => [],
            'drought_risk' => [],
            'forecast_summary' => [],
            'historical_summary' => [],
            'last_updated_at' => now(),
            'lat' => 33.51,
            'lon' => 36.29,
            'population_ref' => 2103000,
        ]);

        $response = $this->getJson('/api/population/env-report');

        $response->assertOk()
            ->assertJsonPath('cities.Damascus.coordinates.latitude', 33.51)
            ->assertJsonPath('cities.Damascus.population', 2103000);

        $content = $response->getContent();
        $this->assertStringContainsString('"current_conditions":{}', $content);
        $this->assertStringContainsString('"air_quality":{}', $content);
        $this->assertStringContainsString('"drought_risk":{}', $content);

        Cache::flush();
        $this->getJson('/api/population/master')
            ->assertOk()
            ->assertJsonStructure([
                'groups' => [
                    'environmental' => [
                        '*' => ['cities', 'date', 'note', 'source_id', 'source_url'],
                    ],
                ],
            ])
            ->assertJsonPath('groups.environmental.0.source_id', 1)
            ->assertJsonPath('groups.environmental.0.date', null)
            ->assertJsonPath('groups.environmental.0.note', null)
            ->assertJsonPath('groups.environmental.0.source_url', null);
    }
}
