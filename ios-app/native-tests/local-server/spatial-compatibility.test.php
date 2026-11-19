<?php

declare(strict_types=1);

require_once __DIR__.'/spatial-compatibility.php';
require_once dirname(__DIR__, 3).'/vendor/autoload.php';
require_once __DIR__.'/user-admin-city.php';

$connection = (new Illuminate\Database\Connectors\SQLiteConnector)->connect(['database' => ':memory:']);
$connection->exec('CREATE TABLE cities (id TEXT PRIMARY KEY, center TEXT, bounds TEXT)');
$city = nativeFixtureUserAdminCityData();
$connection->prepare('INSERT INTO cities(id,center,bounds) VALUES (?,?,?)')->execute([$city['id'], $city['center'], $city['bounds']]);
$original = $connection->query('SELECT * FROM cities')->fetchAll(PDO::FETCH_ASSOC);
$changes = (int) $connection->query('SELECT total_changes()')->fetchColumn();
$connection->exec('PRAGMA query_only=ON');
$checks = 0;
$check = static function (bool $condition, string $message) use (&$checks): void {
    if (! $condition) throw new RuntimeException($message);
    $checks++;
};
$missing = false;
try {
    $connection->query('SELECT ST_AsGeoJSON(center) FROM cities');
} catch (PDOException $error) {
    $missing = str_contains($error->getMessage(), 'no such function: ST_AsGeoJSON');
}
$check($missing, 'A fresh fixture SQLite connection must reproduce the missing spatial function.');

nativeFixtureRegisterGeoJson($connection);
$row = $connection->query('SELECT ST_AsGeoJSON(center) AS center_geojson, ST_AsGeoJSON(bounds) AS bounds_geojson FROM cities WHERE id=\'damascus\'')->fetch(PDO::FETCH_ASSOC);
$check($row === ['center_geojson' => $city['center'], 'bounds_geojson' => $city['bounds']], 'The actual seeded Point and Polygon bytes must pass through unchanged.');
$check(json_decode($row['center_geojson'], true, flags: JSON_THROW_ON_ERROR) === ['type' => 'Point', 'coordinates' => [36.2765, 33.5138]], 'The original Damascus coordinates must remain intact.');
$check(json_decode($row['bounds_geojson'], true, flags: JSON_THROW_ON_ERROR) === json_decode($city['bounds'], true, flags: JSON_THROW_ON_ERROR), 'The original seeded closed polygon must remain intact.');
$check($connection->query('SELECT ST_AsGeoJSON(NULL)')->fetchColumn() === null, 'Absent geometry must remain absent.');
$check($connection->query('SELECT * FROM cities')->fetchAll(PDO::FETCH_ASSOC) === $original
    && (int) $connection->query('SELECT total_changes()')->fetchColumn() === $changes
    && (int) $connection->query('PRAGMA query_only')->fetchColumn() === 1, 'Registration and reads must not change any seed bytes or disable read-only mode.');
echo "Fixture GeoJSON compatibility: {$checks} checks passed.\n";
