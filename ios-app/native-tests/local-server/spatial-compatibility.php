<?php

declare(strict_types=1);

function nativeFixtureRegisterGeoJson(PDO $connection): void
{
    if ($connection->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'sqlite') {
        throw new RuntimeException('The local geometry compatibility function requires SQLite.');
    }
    // Fixture geometry is already GeoJSON text, as in tests/Support/Fixtures.php.
    $identity = static fn (mixed $value): mixed => $value;
    $registered = $connection instanceof Pdo\Sqlite
        ? $connection->createFunction('ST_AsGeoJSON', $identity, 1)
        : $connection->sqliteCreateFunction('ST_AsGeoJSON', $identity, 1);
    if (! $registered) {
        throw new RuntimeException('The local GeoJSON read function could not be registered.');
    }
}
