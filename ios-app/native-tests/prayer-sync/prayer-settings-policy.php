<?php

declare(strict_types=1);
const NATIVE_PRAYER_SCHEMA_VERSION = 2;

// Fixture-only rollback requires a persisted arm/checkpoint journal.
const NATIVE_PRAYER_TRACKING_FIELDS = ['prayerLog', 'muslimMethod', 'muslimCity'];
const NATIVE_PRAYER_HOME_FIELDS = ['theme', 'eventsGovernorate', 'showWeather', 'showPrayerTimes', 'showEvents', 'customLinks'];
const NATIVE_PRAYER_FIELDS = [...NATIVE_PRAYER_TRACKING_FIELDS, ...NATIVE_PRAYER_HOME_FIELDS];
const NATIVE_PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const NATIVE_PRAYER_IDENTITIES = [
    101 => ['names' => ['مستخدم اختبار محلي', 'مستخدم تحقق محلي'], 'email' => 'member@native-fixture.invalid', 'google_ids' => [null, 'local-google-member-101']],
    102 => ['names' => ['مستخدم اختبار ثان'], 'email' => 'other@native-fixture.invalid', 'google_ids' => [null]],
];

function nativePrayerHomeValue(string $key, mixed $value): void
{
    if ($key === 'theme' && in_array($value, ['light', 'dark'], true)) return;
    if (in_array($key, ['showWeather', 'showPrayerTimes', 'showEvents'], true) && is_bool($value)) return;
    if ($key === 'eventsGovernorate' && is_string($value) && mb_strlen($value) <= 64) return;
    if ($key !== 'customLinks' || ! is_array($value) || ! array_is_list($value) || count($value) > 50
        || strlen(json_encode($value, JSON_THROW_ON_ERROR)) > 32768) throw new RuntimeException('Supported typed Home preferences are required.');
    foreach ($value as $link) {
        if (! $link instanceof stdClass) throw new RuntimeException('Canonical native Home links are required.');
        $keys = array_keys(get_object_vars($link)); sort($keys);
        if ($keys !== ['icon', 'id', 'name', 'url'] || ! is_string($link->id) || $link->id === '' || mb_strlen($link->id) > 64
            || ! is_string($link->name) || trim($link->name) !== $link->name || $link->name === '' || mb_strlen($link->name) > 100
            || ! is_string($link->url) || strlen($link->url) > 2048 || trim($link->url) !== $link->url
            || ! is_string($link->icon) || trim($link->icon) !== $link->icon || mb_strlen($link->icon) > 32) throw new RuntimeException('Canonical bounded native Home links are required.');
        $url = parse_url($link->url);
        if (! is_array($url) || ! in_array($url['scheme'] ?? null, ['http', 'https'], true) || empty($url['host'])
            || isset($url['user']) || isset($url['pass'])) throw new RuntimeException('Native Home links must be public HTTP addresses.');
    }
}

function nativePrayerHomeFields(array $fields, bool $allowAbsent): ?array
{
    $home = []; $present = 0;
    foreach (NATIVE_PRAYER_HOME_FIELDS as $key) {
        $field = $fields[$key] ?? null;
        if ($field === ['present' => false]) continue;
        if (! is_array($field) || array_keys($field) !== ['present', 'value'] || $field['present'] !== true) throw new RuntimeException('Closed Home field snapshots are required.');
        nativePrayerHomeValue($key, $field['value']); $home[$key] = $field['value']; $present++;
    }
    if ($present === 0 && $allowAbsent) return null;
    if ($present !== 6) throw new RuntimeException('A complete six-field native Home seed is required before arming.');
    return $home;
}

function nativePrayerHomeHash(array $home): string
{
    unset($home['theme']);
    $sort = function (mixed $value) use (&$sort): mixed {
        if ($value instanceof stdClass) {
            $fields = get_object_vars($value); ksort($fields, SORT_STRING);
            return (object) array_map($sort, $fields);
        }
        return is_array($value) ? array_map($sort, $value) : $value;
    };
    // Home vectors contain only strings, booleans, arrays and fixed ASCII object keys.
    $bytes = json_encode($sort((object) $home), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_LINE_TERMINATORS);
    return hash('sha256', $bytes);
}

function nativePrayerHomeContext(array $journal): array
{
    nativePrayerPlan($journal);
    $first = nativePrayerHomeFields($journal['users'][101]['fields'], false);
    $second = nativePrayerHomeFields($journal['users'][102]['fields'], true) ?? $first;
    return ['version' => 2, 'home101' => nativePrayerHomeHash($first), 'home102' => nativePrayerHomeHash($second),
        'appearance101' => $first['theme'], 'appearance102' => $second['theme'], 'seed102' => $journal['users'][102]['empty']];
}

function nativePrayerAdoptionIntermediates(array $journal): array
{
    $plans = nativePrayerPlan($journal);
    if (! $journal['users'][102]['empty']) return [];
    $homeOnly = $plans[2]; $prayerOnly = $plans[2];
    foreach (NATIVE_PRAYER_HOME_FIELDS as $key) $homeOnly[102][$key] = $plans[3][102][$key];
    $prayerOnly[102]['prayerLog'] = $plans[3][102]['prayerLog'];
    return [$homeOnly, $prayerOnly];
}

function nativePrayerRestoreStates(array $journal, int $phase, ?int $pending): array
{
    $plans = nativePrayerPlan($journal);
    $states = [$plans[0], $plans[$phase]];
    if ($pending !== null) $states[] = $plans[$pending];
    if ($phase === 2 && $pending === 3) $states = [...$states, ...nativePrayerAdoptionIntermediates($journal)];
    return $states;
}

function nativePrayerMatchStates(array $observed, array $states): void
{
    $current = []; foreach ([101, 102] as $id) $current[$id] = $observed[$id]['state'];
    foreach ($states as $state) if (nativePrayerHash($current) === nativePrayerHash($state)) return;
    throw new RuntimeException('Current state is outside the fixed completed or interrupted Source transitions.');
}

function nativePrayerDay(string $day): void
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $day, new DateTimeZone('Asia/Damascus'));
    if (! $date || $date->format('Y-m-d') !== $day) throw new RuntimeException('A canonical Damascus calendar day is required.');
}

function nativePrayerHash(mixed $value): string
{
    $sort = function (mixed $item) use (&$sort): mixed {
        if ($item instanceof stdClass) {
            $entries = get_object_vars($item); ksort($entries, SORT_STRING);
            return (object) array_map($sort, $entries);
        }
        return is_array($item) ? array_map($sort, $item) : $item;
    };
    return hash('sha256', json_encode($sort($value), JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION));
}

function nativePrayerParse(?string $raw): stdClass
{
    if ($raw === null) return new stdClass;
    if (strlen($raw) > 40000) throw new RuntimeException('The source settings size bound is required.');
    try { $value = json_decode($raw, false, 32, JSON_THROW_ON_ERROR); }
    catch (JsonException) { throw new RuntimeException('Malformed settings cannot be journaled or restored.'); }
    if ($value === []) return new stdClass;
    if (! $value instanceof stdClass) throw new RuntimeException('Only a settings object, empty array, or SQL NULL is supported.');
    return $value;
}

function nativePrayerState(?string $raw, string $day): array
{
    nativePrayerDay($day);
    $settings = nativePrayerParse($raw); $fields = [];
    foreach (NATIVE_PRAYER_FIELDS as $key) {
        $present = property_exists($settings, $key);
        $fields[$key] = ['present' => $present];
        if (! $present) continue;
        $value = $settings->$key;
        if (in_array($key, NATIVE_PRAYER_HOME_FIELDS, true)) {
            nativePrayerHomeValue($key, $value); $fields[$key]['value'] = $value; continue;
        }
        if ($key !== 'prayerLog') {
            if ($value !== null && (($key === 'muslimMethod' && (! is_int($value) || $value < 1 || $value > 99))
                || ($key === 'muslimCity' && (! is_string($value) || strlen($value) > 64)))) {
                throw new RuntimeException('Prayer scalar settings must keep their source types.');
            }
            $fields[$key]['value'] = $value;
            continue;
        }
        $kind = $value === null ? 'null' : ($value === [] ? 'array' : 'object');
        if ($kind === 'object' && ! $value instanceof stdClass) throw new RuntimeException('The prayer log must be an object.');
        $log = $kind === 'object' ? $value : new stdClass;
        if (count(get_object_vars($log)) > 31) throw new RuntimeException('The source thirty-one-day log bound is required.');
        foreach (get_object_vars($log) as $date => $prayers) {
            nativePrayerDay($date);
            if (! $prayers instanceof stdClass || count(get_object_vars($prayers)) > 5) throw new RuntimeException('Only canonical prayer records are supported.');
            foreach (get_object_vars($prayers) as $prayer => $done) {
                if (! in_array($prayer, NATIVE_PRAYERS, true) || ! is_bool($done)) throw new RuntimeException('Only the five boolean tracked prayers are supported.');
            }
        }
        $fields[$key] += ['kind' => $kind, 'todayPresent' => property_exists($log, $day)];
        if (property_exists($log, $day)) $fields[$key]['today'] = $log->$day;
    }
    return $fields;
}

function nativePrayerGuards(?string $raw, string $day): array
{
    $settings = nativePrayerParse($raw);
    $log = $settings->prayerLog ?? new stdClass;
    $history = $log instanceof stdClass ? clone $log : new stdClass;
    unset($history->$day);
    foreach (NATIVE_PRAYER_FIELDS as $key) unset($settings->$key);
    return ['untouched' => nativePrayerHash($settings), 'history' => nativePrayerHash($history)];
}

function nativePrayerSnapshot(string $nonce, string $day, ?string $raw): array
{
    if (preg_match('/^[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/D', $nonce) !== 1) {
        throw new RuntimeException('A canonical uppercase version-four UUID nonce is required.');
    }
    return ['version' => 2, 'nonce' => $nonce, 'day' => $day, 'fields' => nativePrayerState($raw, $day),
        'container' => $raw === null ? 'null' : (json_decode($raw) === [] ? 'array' : 'object'),
        'empty' => get_object_vars(nativePrayerParse($raw)) === [],
        ...nativePrayerGuards($raw, $day)];
}

function nativePrayerRestore(array $snapshot, ?string $currentRaw, array $expected): ?string
{
    $day = $snapshot['day'];
    if (array_keys($expected) !== NATIVE_PRAYER_FIELDS || nativePrayerHash(nativePrayerState($currentRaw, $day)) !== nativePrayerHash($expected)
        || nativePrayerGuards($currentRaw, $day) !== ['untouched' => $snapshot['untouched'], 'history' => $snapshot['history']]) {
        throw new RuntimeException('Unexpected current fields, historical records or unrelated settings are retained without rollback.');
    }
    $settings = nativePrayerParse($currentRaw);
    foreach (NATIVE_PRAYER_FIELDS as $key) {
        $original = $snapshot['fields'][$key];
        if (! $original['present']) { unset($settings->$key); continue; }
        if ($key !== 'prayerLog') { $settings->$key = $original['value']; continue; }
        if ($original['kind'] === 'null') { $settings->$key = null; continue; }
        if ($original['kind'] === 'array') { $settings->$key = []; continue; }
        $log = ($settings->$key ?? null) instanceof stdClass ? clone $settings->$key : new stdClass;
        if ($original['todayPresent']) $log->$day = (object) $original['today'];
        else unset($log->$day);
        $settings->$key = $log;
    }
    if (get_object_vars($settings) === []) {
        if ($snapshot['container'] === 'null') return null;
        if ($snapshot['container'] === 'array') return '[]';
    }
    return json_encode($settings, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
}

function nativePrayerRows(PDO $pdo): array
{
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'sqlite') throw new RuntimeException('Only the isolated SQLite adapter is supported.');
    $rows = $pdo->query('SELECT id, name, email, role, is_banned, permissions, permission_scopes, google_id, avatar_url, deleted_at, email_verified_at, settings FROM users WHERE id IN (101,102) ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
    if (count($rows) !== 2) throw new RuntimeException('Both exact existing local users are required.');
    foreach ($rows as $row) {
        $id = (int) $row['id']; $identity = NATIVE_PRAYER_IDENTITIES[$id] ?? [];
        if (! in_array($row['name'], $identity['names'] ?? [], true) || $row['email'] !== ($identity['email'] ?? null)
            || $row['role'] !== 'user' || (int) $row['is_banned'] !== 0 || json_decode($row['permissions'] ?? 'null', true) !== []
            || $row['permission_scopes'] !== null || ! in_array($row['google_id'], $identity['google_ids'] ?? [], true) || $row['avatar_url'] !== null
            || $row['deleted_at'] !== null || ! is_string($row['email_verified_at']) || $row['email_verified_at'] === '') {
            throw new RuntimeException('Foreign or modified local identities are refused.');
        }
    }
    return $rows;
}

function nativePrayerArm(PDO $pdo, string $nonce, string $day): array
{
    $journal = ['version' => 2, 'nonce' => $nonce, 'day' => $day, 'users' => []];
    foreach (nativePrayerRows($pdo) as $row) {
        $snapshot = nativePrayerSnapshot($nonce, $day, $row['settings']);
        $identity = $row; unset($identity['settings']);
        $snapshot['identity'] = nativePrayerHash((object) $identity);
        $journal['users'][(int) $row['id']] = $snapshot;
    }
    nativePrayerPlan($journal);
    return $journal;
}

function nativePrayerPlan(array $journal): array
{
    if (($journal['version'] ?? null) !== 2 || array_keys($journal['users'] ?? []) !== [101, 102]) throw new RuntimeException('The exact two-user version-two journal is required.');
    nativePrayerSnapshot($journal['nonce'], $journal['day'], null);
    $initial = [];
    foreach ([101, 102] as $id) {
        $snapshot = $journal['users'][$id]; $fields = $snapshot['fields'];
        if (($snapshot['version'] ?? null) !== 2 || ($snapshot['nonce'] ?? null) !== $journal['nonce'] || ($snapshot['day'] ?? null) !== $journal['day']
            || array_keys($fields) !== NATIVE_PRAYER_FIELDS || ! in_array($snapshot['container'] ?? null, ['null', 'array', 'object'], true)
            || ! is_bool($snapshot['empty'] ?? null)) {
            throw new RuntimeException('Each exact field snapshot must bind the same nonce and day.');
        }
        foreach (['identity', 'untouched', 'history'] as $hash) if (! is_string($snapshot[$hash] ?? null) || preg_match('/^[a-f0-9]{64}$/D', $snapshot[$hash]) !== 1) throw new RuntimeException('Each journal guard must be an exact digest.');
        foreach (NATIVE_PRAYER_TRACKING_FIELDS as $field) {
            if ($fields[$field] !== ['present' => false]) throw new RuntimeException('This exact native plan refuses existing prayer fields before any write.');
        }
        $home = nativePrayerHomeFields($fields, $id === 102);
        $empty = $home === null && $snapshot['untouched'] === nativePrayerHash(new stdClass);
        if ($snapshot['empty'] !== $empty || ($snapshot['container'] !== 'object' && ! $empty)) throw new RuntimeException('The original whole-settings emptiness must match its fixed snapshot.');
        $initial[$id] = $fields;
    }
    $plans = [$initial];
    foreach ([[101, ['Fajr' => true]], [101, ['Fajr' => false]], [102, ['Fajr' => false]],
        [102, ['Fajr' => false, 'Dhuhr' => true]], [102, ['Fajr' => false, 'Dhuhr' => false]]] as [$id, $today]) {
        $next = $plans[array_key_last($plans)];
        if (count($plans) === 3 && $journal['users'][102]['empty']) {
            foreach (NATIVE_PRAYER_HOME_FIELDS as $key) $next[102][$key] = $initial[101][$key];
        }
        $next[$id]['prayerLog'] = ['present' => true, 'kind' => 'object', 'todayPresent' => true, 'today' => (object) $today];
        $plans[] = $next;
    }
    return $plans;
}

function nativePrayerMatchPlan(array $observed, array $plans, array $allowed): int
{
    $states = [];
    foreach ([101, 102] as $id) $states[$id] = $observed[$id]['state'];
    foreach ($allowed as $index) {
        if (isset($plans[$index]) && nativePrayerHash($states) === nativePrayerHash($plans[$index])) return $index;
    }
    throw new RuntimeException('Current settings do not match any predeclared native action state.');
}

function nativePrayerObserved(PDO $pdo, array $journal): array
{
    $expected = [];
    foreach (nativePrayerRows($pdo) as $row) {
        $id = (int) $row['id']; $state = nativePrayerState($row['settings'], $journal['day']);
        $identity = $row; unset($identity['settings']);
        if (nativePrayerHash((object) $identity) !== $journal['users'][$id]['identity']) throw new RuntimeException('The journaled local identity changed.');
        nativePrayerRestore($journal['users'][$id], $row['settings'], $state);
        $expected[$id] = ['state' => $state, 'rawHash' => nativePrayerHash($row['settings'])];
    }
    return $expected;
}

// The caller must supply the checkpoint persisted in the nonce journal, never accept arbitrary request JSON here.
function nativePrayerRollback(PDO $pdo, array $journal, array $expected): void
{
    if (array_keys($journal['users']) !== [101, 102] || array_keys($expected) !== [101, 102] || $pdo->inTransaction()) {
        throw new RuntimeException('Only one complete nonce-bound two-user rollback may open this transaction.');
    }
    $pdo->beginTransaction();
    try {
        foreach (nativePrayerRows($pdo) as $row) {
            $id = (int) $row['id'];
            $identity = $row; unset($identity['settings']);
            if (nativePrayerHash((object) $identity) !== $journal['users'][$id]['identity']) throw new RuntimeException('The journaled local identity changed.');
            if (nativePrayerHash($row['settings']) !== $expected[$id]['rawHash']) throw new RuntimeException('Current raw settings no longer match the persisted checkpoint.');
            $restored = nativePrayerRestore($journal['users'][$id], $row['settings'], $expected[$id]['state']);
            $predicates = implode(' AND ', array_map(fn (string $key): string => $key.' IS ?', array_keys($identity)));
            $update = $pdo->prepare('UPDATE users SET settings=? WHERE settings IS ? AND '.$predicates);
            $update->execute([$restored, $row['settings'], ...array_values($identity)]);
            if ($update->rowCount() !== 1) throw new RuntimeException('The exact settings and identity compare-and-set refused rollback.');
        }
        $pdo->commit();
    } catch (Throwable $failure) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $failure;
    }
}
