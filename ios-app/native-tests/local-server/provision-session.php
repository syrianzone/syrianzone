<?php

declare(strict_types=1);

use App\Models\User;
use App\Support\Agents\TokenAbilities;

$app = require __DIR__.'/bootstrap.php';
$runtime = $app->basePath('ios-app/.expo/local-fixture');
$name = $argv[1] ?? '';
$allowed = json_decode(file_get_contents(__DIR__.'/../fixture-users.json'), true, flags: JSON_THROW_ON_ERROR);
if (! array_key_exists($name, $allowed)) {
    echo json_encode(['status' => 422]);
    exit;
}
$user = User::find($allowed[$name]);
if ($user === null) {
    echo json_encode(['status' => 410]);
    exit;
}
if ($name === 'avatar') {
    require_once __DIR__.'/avatar-user.php';
    nativeFixtureAssertAvatarIdentity(nativeFixtureAvatarIdentity($user), false);
}

// A ban is still enforced by the original API and mutation policies.
$token = $user->createToken('isolated-native-launch', [TokenAbilities::MOBILE])->plainTextToken;
$fixture = json_decode(file_get_contents($runtime.'/fixture.json'), true, flags: JSON_THROW_ON_ERROR);
$fixture['users'][$name]['token'] = $token;
file_put_contents($runtime.'/fixture.json', json_encode($fixture, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n", LOCK_EX);
chmod($runtime.'/fixture.json', 0600);
echo json_encode(['status' => 200, 'token' => $token], JSON_THROW_ON_ERROR);
