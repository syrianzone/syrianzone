<?php
declare(strict_types=1);
require_once __DIR__.'/prayer-settings-policy.test.php';
require_once __DIR__.'/prayer-settings-journal.php';
$directory = realpath(sys_get_temp_dir()).'/sz-prayer-v2-'.bin2hex(random_bytes(8));
try {
    refuses(fn () => nativePrayerJournal(database(), $directory, $nonce, $day, 'context'));
    check(! is_dir($directory));
    $pdo = database(); nativePrayerJournal($pdo, $directory, $nonce, $day, 'arm');
    $raw = file_get_contents($directory.'/'.$nonce.'.json');
    check(json_decode($raw, true)['version'] === 2);
    $record = nativePrayerDecodeJournal($raw);
    check($record['policy']['users'][101]['fields']['customLinks']['value'][0] instanceof stdClass);
    check(nativePrayerMatchPlan(nativePrayerObserved($pdo, $record['policy']), nativePrayerPlan($record['policy']), [0]) === 0);
    $context = nativePrayerJournal($pdo, $directory, $nonce, $day, 'context');
    check($context['journalVersion'] === 2 && $context['context'] === nativePrayerHomeContext($record['policy']));
    check(file_get_contents($directory.'/'.$nonce.'.json') === $raw);
    refuses(fn () => nativePrayerJournal($pdo, $directory, 'ABCDEF00-0000-4000-8000-000000000098', $day, 'context'));
    $plans = nativePrayerPlan($record['policy']);
    foreach ([1, 2, 3, 4, 5] as $index) {
        nativePrayerJournal($pdo, $directory, $nonce, $day, 'intent', $index);
        foreach ([101, 102] as $id) {
            $settings = $id === 101 ? (object) ['keep' => ['unchanged']] : new stdClass;
            foreach ($plans[$index][$id] as $key => $field) if ($field['present']) $settings->$key = $key === 'prayerLog' ? (object) [$day => $field['today']] : $field['value'];
            $pdo->prepare('UPDATE users SET settings=? WHERE id=?')->execute([json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $id]);
        }
        check(nativePrayerJournal($pdo, $directory, $nonce, $day, 'checkpoint', $index)['phase'] === $index);
    }
    check(nativePrayerJournal($pdo, $directory, $nonce, $day, 'restore')['restored']);
    check($pdo->query('SELECT settings FROM users WHERE id=102')->fetchColumn() === null);
    check(nativePrayerJournal($pdo, $directory, $nonce, $day, 'close')['closed']);
    check(! file_exists($directory.'/'.$nonce.'.json') && file_get_contents($directory.'/owner.lock') === '');
    foreach ([0, 1] as $partial) {
        $pdo = database(); nativePrayerJournal($pdo, $directory, $nonce, $day, 'arm');
        $record = nativePrayerDecodeJournal(file_get_contents($directory.'/'.$nonce.'.json'));
        $plans = nativePrayerPlan($record['policy']);
        foreach ([1, 2, 3] as $index) {
            nativePrayerJournal($pdo, $directory, $nonce, $day, 'intent', $index);
            $state = $index === 3 ? nativePrayerAdoptionIntermediates($record['policy'])[$partial] : $plans[$index];
            foreach ([101, 102] as $id) {
                $settings = $id === 101 ? (object) ['keep' => ['unchanged']] : new stdClass;
                foreach ($state[$id] as $key => $field) if ($field['present']) $settings->$key = $key === 'prayerLog' ? (object) [$day => $field['today']] : $field['value'];
                $pdo->prepare('UPDATE users SET settings=? WHERE id=?')->execute([json_encode($settings), $id]);
            }
            if ($index !== 3) nativePrayerJournal($pdo, $directory, $nonce, $day, 'checkpoint', $index);
        }
        refuses(fn () => nativePrayerJournal($pdo, $directory, $nonce, $day, 'checkpoint', 3));
        check(nativePrayerJournal($pdo, $directory, $nonce, $day, 'restore')['restored']);
        check($pdo->query('SELECT settings FROM users WHERE id=102')->fetchColumn() === null);
        nativePrayerJournal($pdo, $directory, $nonce, $day, 'close');
    }
} finally {
    foreach ([$directory.'/'.$nonce.'.json', $directory.'/owner.lock'] as $path) if (is_file($path)) unlink($path);
    if (is_dir($directory)) rmdir($directory);
}
echo "Prayer v2 journal total: {$checks} checks passed.\n";
