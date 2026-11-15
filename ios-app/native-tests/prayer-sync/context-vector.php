<?php
declare(strict_types=1);
ob_start(); require __DIR__.'/prayer-settings-policy.test.php'; ob_end_clean();
$other = ($argv[1] ?? '') === '--nonempty-other' ? '{"keep":"other"}' : null;
$pdo = database($other);
echo json_encode(['context' => nativePrayerHomeContext(nativePrayerArm($pdo, $nonce, $day)), 'settings101' => home(), 'settings102' => $other === null ? new stdClass : json_decode($other)],
    JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_LINE_TERMINATORS);
