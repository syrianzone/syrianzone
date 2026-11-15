<?php

declare(strict_types=1);

// CLI entry for the gated loopback Prayer handler.
try {
    if (PHP_SAPI !== 'cli') throw new RuntimeException('CLI required.');
    $input = stream_get_contents(STDIN, 2049);
    if ($input === false || strlen($input) > 2048) throw new RuntimeException('Bounded command required.');
    $command = json_decode($input, true, 16, JSON_THROW_ON_ERROR);
    if (! is_array($command) || array_diff(array_keys($command), ['nonce', 'day', 'action', 'index'])
        || ! isset($command['nonce'], $command['day'], $command['action']) || ! is_string($command['nonce'])
        || ! is_string($command['day']) || ! is_string($command['action']) || (isset($command['index']) && ! is_int($command['index']))) {
        throw new RuntimeException('Closed command required.');
    }
    $ios = dirname(__DIR__, 2);
    $runtime = $ios.'/.expo/local-fixture';
    $app = require $ios.'/native-tests/local-server/bootstrap.php';
    $connection = Illuminate\Support\Facades\DB::connection();
    if (! $app->environment('testing') || config('app.url') !== 'https://127.0.0.1:9443'
        || $connection->getDriverName() !== 'sqlite' || $connection->getDatabaseName() !== $runtime.'/database.sqlite'
        || $connection->transactionLevel() !== 0 || is_link($runtime.'/database.sqlite')
        || realpath($runtime.'/database.sqlite') !== $runtime.'/database.sqlite'
        || trim(file_get_contents($runtime.'/fixture-marker')) !== 'native-loopback-fixture-v1') {
        throw new RuntimeException('Exact isolated runtime required.');
    }
    if ($command['action'] === 'arm' && $command['day'] !== (new DateTimeImmutable('now', new DateTimeZone('Asia/Damascus')))->format('Y-m-d')) {
        throw new RuntimeException('Current Damascus day required at arm.');
    }
    require_once __DIR__.'/prayer-settings-journal.php';
    if (! defined('NATIVE_PRAYER_SCHEMA_VERSION') || NATIVE_PRAYER_SCHEMA_VERSION !== 2
        || ! defined('NATIVE_PRAYER_CODEC_VERSION') || NATIVE_PRAYER_CODEC_VERSION !== 2) {
        throw new RuntimeException('Matching version-two Prayer policy and codec are required before arming.');
    }
    $result = nativePrayerJournal($connection->getPdo(), $runtime.'/prayer-sync', $command['nonce'], $command['day'], $command['action'], $command['index'] ?? null);
    echo json_encode(['status' => 200, ...$result], JSON_THROW_ON_ERROR);
} catch (Throwable) {
    // Never print request details, SQL bindings, settings, fixture credentials or exception traces.
    echo json_encode(['status' => 409, 'message' => 'The bounded Prayer fixture operation was refused.']);
}
