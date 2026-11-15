<?php

declare(strict_types=1);

require_once __DIR__.'/prayer-settings-policy.php';
const NATIVE_PRAYER_CODEC_VERSION = 2;

function nativePrayerDecodeJournal(string $raw): array
{
    $object = fn (mixed $value): array => $value instanceof stdClass ? (array) $value : throw new RuntimeException('Typed v2 journal objects are required.');
    $record = $object(json_decode($raw, false, 32, JSON_THROW_ON_ERROR));
    $record['policy'] = $object($record['policy'] ?? null);
    $record['policy']['users'] = $object($record['policy']['users'] ?? null);
    foreach ([101, 102] as $id) {
        $snapshot = $object($record['policy']['users'][$id] ?? null);
        $snapshot['fields'] = $object($snapshot['fields'] ?? null);
        foreach (NATIVE_PRAYER_FIELDS as $key) $snapshot['fields'][$key] = $object($snapshot['fields'][$key] ?? null);
        $record['policy']['users'][$id] = $snapshot;
    }
    return $record;
}

function nativePrayerWriteJournal(string $path, array $record): void
{
    $temporary = $path.'.tmp-'.bin2hex(random_bytes(8));
    $file = @fopen($temporary, 'x+b');
    if (! $file) throw new RuntimeException('The exact private journal staging file could not be created.');
    try {
        chmod($temporary, 0600);
        $bytes = json_encode($record, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
        if (fwrite($file, $bytes) !== strlen($bytes) || ! fflush($file) || ! fsync($file)) throw new RuntimeException('The private journal must be durable before native mutation.');
        if (is_link($path) || ! rename($temporary, $path)) throw new RuntimeException('The exact private journal could not be replaced atomically.');
    } finally {
        fclose($file);
        if (is_file($temporary)) unlink($temporary);
    }
}

// Trusted caller supplies the fixed fixture directory. Transport accepts only action, UUID, day and a phase index.
function nativePrayerJournal(PDO $pdo, string $directory, string $nonce, string $day, string $action, ?int $index = null): array
{
    nativePrayerSnapshot($nonce, $day, null);
    if (! in_array($action, ['arm', 'context', 'intent', 'checkpoint', 'restore', 'close'], true)
        || (in_array($action, ['intent', 'checkpoint'], true) ? $index === null || $index < 1 || $index > 5 : $index !== null)) {
        throw new RuntimeException('Only fixed Prayer case actions and phase indices are accepted.');
    }
    if (! is_dir($directory) && ($action !== 'arm' || ! mkdir($directory, 0700))) throw new RuntimeException('Only arm may create the private Prayer journal directory.');
    if (is_link($directory) || realpath($directory) !== $directory || (fileperms($directory) & 0777) !== 0700) throw new RuntimeException('The exact private journal directory must be real and mode 0700.');
    $path = $directory.'/'.$nonce.'.json'; $lockPath = $directory.'/owner.lock';
    if (is_link($path) || is_link($lockPath)) throw new RuntimeException('Symlinked journals and locks are refused.');
    $createdLock = ! file_exists($lockPath);
    $lock = @fopen($lockPath, $action === 'arm' ? 'c+b' : 'r+b');
    if (! $lock) throw new RuntimeException('A fresh nonce or its exact existing journal lock is required.');
    try {
        if ($createdLock) chmod($lockPath, 0600);
        if ((fileperms($lockPath) & 0777) !== 0600 || ! flock($lock, LOCK_EX | LOCK_NB)) throw new RuntimeException('Concurrent or nonprivate journal access is refused.');
        rewind($lock); $owner = stream_get_contents($lock, 129);
        $expectedOwner = $nonce."\n".$day;
        if (($action === 'arm' && $owner !== '') || ($action !== 'arm' && $owner !== $expectedOwner && ! ($action === 'close' && $owner === ''))) {
            throw new RuntimeException('Only one active nonce may own the exact local user pair.');
        }
        if ($action === 'arm') {
            if (file_exists($path)) throw new RuntimeException('An existing nonce journal is never overwritten.');
            $policy = nativePrayerArm($pdo, $nonce, $day); nativePrayerPlan($policy);
            $record = ['version' => 2, 'nonce' => $nonce, 'day' => $day, 'phase' => 0, 'pending' => null, 'restored' => false, 'policy' => $policy];
            nativePrayerWriteJournal($path, $record);
            rewind($lock);
            if (! ftruncate($lock, 0) || fwrite($lock, $expectedOwner) !== strlen($expectedOwner) || ! fflush($lock) || ! fsync($lock)) {
                throw new RuntimeException('The exact pair ownership must be durable before native mutation.');
            }
        } else {
            if (! is_file($path) || (fileperms($path) & 0777) !== 0600 || filesize($path) > 128000) throw new RuntimeException('The exact bounded private journal is required.');
            try { $record = nativePrayerDecodeJournal(file_get_contents($path)); }
            catch (JsonException) { throw new RuntimeException('A malformed journal is retained without database mutation.'); }
            if (! is_array($record) || array_keys($record) !== ['version', 'nonce', 'day', 'phase', 'pending', 'restored', 'policy']
                || $record['version'] !== 2 || $record['nonce'] !== $nonce || $record['day'] !== $day
                || ! is_int($record['phase']) || $record['phase'] < 0 || $record['phase'] > 5 || ! is_bool($record['restored'])
                || ($record['pending'] !== null && (! is_int($record['pending']) || $record['pending'] !== $record['phase'] + 1 || $record['pending'] > 5))
                || ($record['policy']['nonce'] ?? null) !== $nonce || ($record['policy']['day'] ?? null) !== $day) {
                throw new RuntimeException('The closed journal schema, nonce, day and phase must match.');
            }
            $plans = nativePrayerPlan($record['policy']);
            $observed = nativePrayerObserved($pdo, $record['policy']);
            if ($action === 'context') {
                nativePrayerMatchStates($observed, nativePrayerRestoreStates($record['policy'], $record['phase'], $record['pending']));
            } elseif ($action === 'intent') {
                if ($record['restored'] || $record['pending'] !== null || $index !== $record['phase'] + 1) throw new RuntimeException('The next exact native action must be armed once.');
                nativePrayerMatchPlan($observed, $plans, [$record['phase']]);
                $record['pending'] = $index;
            } elseif ($action === 'checkpoint') {
                if ($record['restored'] || $record['pending'] !== $index) throw new RuntimeException('Only the armed exact native action can be confirmed.');
                nativePrayerMatchPlan($observed, $plans, [$index]);
                $record['phase'] = $index; $record['pending'] = null;
            } elseif ($action === 'restore') {
                // State zero also makes a committed rollback recoverable if its journal update was interrupted.
                $states = nativePrayerRestoreStates($record['policy'], $record['phase'], $record['pending']);
                nativePrayerMatchStates($observed, $states);
                nativePrayerRollback($pdo, $record['policy'], $observed);
                $record['restored'] = true; $record['phase'] = 0; $record['pending'] = null;
            } else {
                if (! $record['restored']) throw new RuntimeException('Only a verified restored journal can be closed.');
                nativePrayerMatchPlan($observed, $plans, [0]);
                rewind($lock);
                if (! ftruncate($lock, 0) || ! fflush($lock) || ! fsync($lock)) throw new RuntimeException('The restored exact pair ownership could not be released.');
                if (! unlink($path)) throw new RuntimeException('The exact restored journal could not be removed.');
            }
            if (! in_array($action, ['close', 'context'], true)) nativePrayerWriteJournal($path, $record);
        }
        return ['journalVersion' => 2, ...($action === 'context' ? ['context' => nativePrayerHomeContext($record['policy'])] : []), 'ok' => true, 'nonce' => $nonce, 'day' => $day, 'phase' => $record['phase'], 'pending' => $record['pending'], 'restored' => $record['restored'], 'closed' => $action === 'close'];
    } finally {
        flock($lock, LOCK_UN); fclose($lock);
    }
}
