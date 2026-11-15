<?php

declare(strict_types=1);

require_once __DIR__.'/avatar-user.php';

$expected = [
    'id' => 105, 'name' => 'حساب الصورة التجريبي المحلي', 'email' => 'avatar@native-fixture.invalid',
    'role' => 'user', 'permissions' => [], 'permission_scopes' => null, 'is_banned' => false,
    'google_id' => null, 'avatar_url' => null, 'deleted_at' => null, 'verified' => true,
];
nativeFixtureAssertAvatarIdentity($expected, true);
$checks = 1;
$owner = ['id' => 105, 'name' => $expected['name'], 'email' => $expected['email']];
if (! nativeFixtureAvatarCreationAllowed(null, false) || nativeFixtureAvatarCreationAllowed($owner, true)) {
    throw new RuntimeException('Only a previously unowned absent row may be created.');
}
$checks += 2;
foreach ([[null, true], [$owner, false], [['id' => 101, 'name' => $owner['name'], 'email' => $owner['email']], false],
    [['id' => 105, 'name' => 'Foreign name', 'email' => $owner['email']], false],
    [['id' => 105, 'name' => $owner['name'], 'email' => 'foreign@native-fixture.invalid'], true]] as [$record, $exists]) {
    $refused = false;
    try {
        nativeFixtureAvatarCreationAllowed($record, $exists);
    } catch (RuntimeException) {
        $refused = true;
    }
    if (! $refused) {
        throw new RuntimeException('Missing recorded rows and foreign ownership must never be silently recreated or overwritten.');
    }
    $checks++;
}
foreach (['id' => 101, 'email' => 'member@native-fixture.invalid', 'name' => 'Foreign account', 'role' => 'superadmin',
    'permissions' => ['places.review'], 'is_banned' => true, 'deleted_at' => '2025-01-01', 'verified' => false,
    'google_id' => 'external-id', 'permission_scopes' => ['transit' => []], 'avatar_url' => '/storage/avatars/105/old.webp'] as $key => $value) {
    $changed = $expected;
    $changed[$key] = $value;
    $refused = false;
    try {
        nativeFixtureAssertAvatarIdentity($changed, true);
    } catch (RuntimeException) {
        $refused = true;
    }
    if (! $refused) {
        throw new RuntimeException('A foreign, changed, deleted or non-pristine account must be refused.');
    }
    $checks++;
}
$uploaded = $expected;
$uploaded['avatar_url'] = '/storage/avatars/105/50000000-0000-4000-8000-000000000001.webp';
nativeFixtureAssertAvatarIdentity($uploaded, false);
$checks++;
foreach (['/storage/avatars/101/50000000-0000-4000-8000-000000000001.webp', 'https://example.invalid/avatar.webp', '/storage/avatars/105/../101/a.webp'] as $url) {
    $uploaded['avatar_url'] = $url;
    $refused = false;
    try {
        nativeFixtureAssertAvatarIdentity($uploaded, false);
    } catch (RuntimeException) {
        $refused = true;
    }
    if (! $refused) {
        throw new RuntimeException('Only an exact local user-105 avatar path may be provisioned.');
    }
    $checks++;
}
echo "Disposable avatar identity: {$checks} checks passed.\n";
