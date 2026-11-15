<?php

declare(strict_types=1);
require_once __DIR__.'/prayer-settings-policy.php';
$checks = 0;
function check(bool $value): void { global $checks; if (! $value) throw new RuntimeException('Prayer v2 policy regression failed.'); $checks++; }
function refuses(callable $operation): void { $failed = false; try { $operation(); } catch (RuntimeException) { $failed = true; } check($failed); }
function home(): array { return ['theme' => 'dark', 'showWeather' => true, 'showPrayerTimes' => true, 'showEvents' => false,
    'eventsGovernorate' => 'دمشق', 'customLinks' => [(object) ['id' => 'keep', 'name' => 'رابط سوري', 'url' => 'https://example.invalid/syria?city=damascus', 'icon' => 'ر']]]; }
function database(?string $other = null): PDO {
    $pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, role TEXT, is_banned INTEGER, settings TEXT, permissions TEXT DEFAULT '[]', permission_scopes TEXT, google_id TEXT, avatar_url TEXT, deleted_at TEXT, email_verified_at TEXT DEFAULT '2026-11-15 00:00:00')");
    $insert = $pdo->prepare('INSERT INTO users(id,name,email,role,is_banned,settings) VALUES(?,?,?,\'user\',0,?)');
    $insert->execute([101, 'مستخدم اختبار محلي', 'member@native-fixture.invalid', json_encode(home() + ['keep' => ['unchanged']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
    $insert->execute([102, 'مستخدم اختبار ثان', 'other@native-fixture.invalid', $other]);
    return $pdo;
}
$nonce = 'ABCDEF00-0000-4000-8000-000000000099'; $day = '2026-11-15';
$pdo = database(); $policy = nativePrayerArm($pdo, $nonce, $day);
check($policy['version'] === 2);
check(count($policy['users'][101]['fields']) === 9);
$plans = nativePrayerPlan($policy);
check(count($plans) === 6);
check($plans[2][102]['theme'] === ['present' => false]);
check($plans[3][102]['theme'] === ['present' => true, 'value' => 'dark']);
check($plans[3][102]['customLinks'] === $plans[0][101]['customLinks']);
check($plans[3][102]['prayerLog']['today']->Fajr === false);
$context = nativePrayerHomeContext($policy);
check($context['version'] === 2 && $context['seed102'] === true && $context['home101'] === $context['home102']);
foreach ([null, '[]', '{}'] as $empty) {
    $pdo = database($empty); $policy = nativePrayerArm($pdo, $nonce, $day); $plans = nativePrayerPlan($policy);
    foreach ([3, 6, 7] as $variant) {
        $pdo = database($empty); $policy = nativePrayerArm($pdo, $nonce, $day);
        $states = $variant === 3 ? nativePrayerPlan($policy)[3] : nativePrayerAdoptionIntermediates($policy)[$variant - 6];
        foreach ([101, 102] as $id) {
            $raw = $pdo->query('SELECT settings FROM users WHERE id='.$id)->fetchColumn();
            $settings = nativePrayerParse($raw === false ? null : $raw);
            foreach ($states[$id] as $key => $field) { if ($field['present']) $settings->$key = $key === 'prayerLog' ? (object) [$day => $field['today']] : $field['value']; else unset($settings->$key); }
            $pdo->prepare('UPDATE users SET settings=? WHERE id=?')->execute([json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $id]);
        }
        $observed = nativePrayerObserved($pdo, $policy);
        nativePrayerMatchStates($observed, nativePrayerRestoreStates($policy, 2, 3));
        if ($variant !== 3) refuses(fn () => nativePrayerMatchPlan($observed, nativePrayerPlan($policy), [3]));
        nativePrayerRollback($pdo, $policy, $observed);
        check($pdo->query('SELECT settings FROM users WHERE id=102')->fetchColumn() === $empty);
        check(! property_exists(json_decode($pdo->query('SELECT settings FROM users WHERE id=101')->fetchColumn()), 'prayerLog'));
        check(nativePrayerMatchPlan(nativePrayerObserved($pdo, $policy), nativePrayerPlan($policy), [0]) === 0);
    }
}
foreach (['{"keep":"other"}', json_encode(home() + ['keep' => 'other'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)] as $other) {
    $pdo = database($other); $policy = nativePrayerArm($pdo, $nonce, $day); $plans = nativePrayerPlan($policy);
    check(nativePrayerHomeContext($policy)['seed102'] === false);
    check($plans[3][102]['theme'] === $plans[0][102]['theme']);
    check(nativePrayerAdoptionIntermediates($policy) === []);
}
foreach ([['theme' => null], ['showWeather' => 'yes'], ['customLinks' => null], ['customLinks' => [(object) ['id' => 'x']]]] as $patch) {
    $pdo = database(); $pdo->prepare('UPDATE users SET settings=? WHERE id=101')->execute([json_encode(array_replace(home(), $patch))]);
    refuses(fn () => nativePrayerArm($pdo, $nonce, $day));
}
foreach (['{}', '{"theme":"dark"}', '{"showWeather":true}'] as $bad101) {
    $pdo = database(); $pdo->prepare('UPDATE users SET settings=? WHERE id=101')->execute([$bad101]);
    refuses(fn () => nativePrayerArm($pdo, $nonce, $day));
}
$pdo = database('{"theme":"dark"}'); refuses(fn () => nativePrayerArm($pdo, $nonce, $day));
$pdo = database(); $policy = nativePrayerArm($pdo, $nonce, $day);
$pdo->prepare('UPDATE users SET settings=? WHERE id=101')->execute([json_encode(home() + ['keep' => ['changed']])]);
refuses(fn () => nativePrayerObserved($pdo, $policy));
$old = $policy; $old['version'] = 1; refuses(fn () => nativePrayerPlan($old));
$pdo = database(); $policy = nativePrayerArm($pdo, $nonce, $day); $plans = nativePrayerPlan($policy);
foreach ([101, 102] as $id) {
    $settings = $id === 101 ? (object) ['keep' => ['unchanged']] : new stdClass;
    foreach ($plans[3][$id] as $key => $field) if ($field['present']) $settings->$key = $key === 'prayerLog' ? (object) [$day => $field['today']] : $field['value'];
    $pdo->prepare('UPDATE users SET settings=? WHERE id=?')->execute([json_encode($settings), $id]);
}
$observed = nativePrayerObserved($pdo, $policy);
$before = $pdo->query('SELECT id,settings FROM users ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
$pdo->exec("CREATE TRIGGER refuse_second BEFORE UPDATE OF settings ON users WHEN NEW.id=102 BEGIN SELECT RAISE(ABORT, 'owned synthetic failure'); END");
refuses(fn () => nativePrayerRollback($pdo, $policy, $observed));
check($pdo->query('SELECT id,settings FROM users ORDER BY id')->fetchAll(PDO::FETCH_ASSOC) === $before);
// Initial names are independently grounded in seed.php and Root's real GET /user observation on 2026-11-15.
$observedProfiles = [
    ['id' => 101, 'name' => 'مستخدم اختبار محلي', 'email' => 'member@native-fixture.invalid', 'role' => 'user', 'is_banned' => false],
    ['id' => 101, 'name' => 'مستخدم تحقق محلي', 'email' => 'member@native-fixture.invalid', 'role' => 'user', 'is_banned' => false],
];
// Source google-provider.mjs supplies this one exact subject after real synthetic Google adoption.
foreach ($observedProfiles as $profile) {
    foreach ([null, 'local-google-member-101'] as $googleID) {
        $pdo = database();
        $pdo->prepare('UPDATE users SET name=?,email=?,role=?,is_banned=?,google_id=? WHERE id=?')
            ->execute([$profile['name'], $profile['email'], $profile['role'], (int) $profile['is_banned'], $googleID, $profile['id']]);
        $journal = nativePrayerArm($pdo, $nonce, $day);
        check(nativePrayerMatchPlan(nativePrayerObserved($pdo, $journal), nativePrayerPlan($journal), [0]) === 0);
        $states = nativePrayerObserved($pdo, $journal);
        $changedName = $profile['name'] === 'مستخدم اختبار محلي' ? 'مستخدم تحقق محلي' : 'مستخدم اختبار محلي';
        $pdo->prepare('UPDATE users SET name=? WHERE id=101')->execute([$changedName]);
        check(count(nativePrayerRows($pdo)) === 2);
        refuses(fn () => nativePrayerObserved($pdo, $journal));
        refuses(fn () => nativePrayerRollback($pdo, $journal, $states));
        $pdo->prepare('UPDATE users SET name=?,google_id=? WHERE id=101')
            ->execute([$profile['name'], $googleID === null ? 'local-google-member-101' : null]);
        check(count(nativePrayerRows($pdo)) === 2);
        refuses(fn () => nativePrayerObserved($pdo, $journal));
        refuses(fn () => nativePrayerRollback($pdo, $journal, $states));
    }
}
$pdo = database();
$pdo->prepare('UPDATE users SET google_id=? WHERE id=101')->execute(['unknown-local-subject']);
refuses(fn () => nativePrayerArm($pdo, $nonce, $day));
$pdo = database();
$pdo->prepare('UPDATE users SET google_id=? WHERE id=102')->execute(['local-google-member-101']);
refuses(fn () => nativePrayerArm($pdo, $nonce, $day));
$pdo = database();
$pdo->prepare('UPDATE users SET name=? WHERE id=101')->execute(['اسم غير معروف للاختبار']);
refuses(fn () => nativePrayerArm($pdo, $nonce, $day));

echo "Prayer v2 policy: {$checks} checks passed.\n";
