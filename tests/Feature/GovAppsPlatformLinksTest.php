<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Models\GovApp;
use App\Models\User;
use App\Services\GovApps\GovAppService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

test('keyed government app platform links survive native writes and the actual public feed', function () {
    $this->withoutVite();
    $user = User::factory()->create(['role' => 'user', 'permissions' => ['govapps.create', 'govapps.edit']]);
    $token = $user->createToken('Native test', ['mobile'])->plainTextToken;
    $links = ['apple' => 'https://apps.apple.com/app/example/id123', 'android' => 'https://play.google.com/store/apps/details?id=example', 'official' => 'https://example.org/'];
    $this->withHeader('Authorization', 'Bearer '.$token)->postJson('/api/v1/admin/govapps', [
        'id' => 'local-platforms', 'name' => 'Local app', 'name_ar' => 'تطبيق محلي', 'links' => $links,
    ])->assertOk()->assertJsonPath('success', true);
    expect(GovApp::findOrFail('local-platforms')->links)->toBe($links);
    Auth::forgetGuards();
    $version = (string) app(HandleInertiaRequests::class)->version(Request::create('/'));
    $this->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => 'stale-native-test'])->getJson('/govapps')->assertStatus(409);
    $this->withHeader('X-Inertia-Version', $version)->getJson('/govapps')->assertOk()->assertJsonPath('props.initialData.0.links', $links);

    $next = ['apple' => 'https://apps.apple.com/app/example/id456', 'android' => null, 'official' => 'https://example.org/new'];
    $this->withHeader('X-Inertia', '')->putJson('/api/v1/admin/govapps/local-platforms', [
        'name' => 'Local app', 'name_ar' => 'تطبيق محلي', 'links' => $next,
    ])->assertOk()->assertJsonPath('success', true);
    $this->withHeader('X-Inertia', 'true')->getJson('/govapps')->assertOk()
        ->assertJsonPath('props.initialData.0.links.apple', $next['apple'])
        ->assertJsonPath('props.initialData.0.links.official', $next['official'])
        ->assertJsonMissingPath('props.initialData.0.links.android');
});

test('government app link filtering retains legacy identity without assigning platforms', function () {
    $service = app(GovAppService::class);
    $create = fn (string $id, array $links) => $service->create(['id' => $id, 'name' => $id, 'name_ar' => 'اختبار'], $links);
    expect($create('named', ['huawei' => 'https://example.org/huawei', 'official' => 'javascript:alert(1)', 'empty' => null])->links)->toBe(['huawei' => 'https://example.org/huawei']);
    expect($create('listed', [2 => 'https://example.org/a', 8 => 'javascript:x', 9 => 'https://example.org/b'])->links)->toBe(['https://example.org/a', 'https://example.org/b']);
    expect($create('mixed', [0 => 'https://example.org/legacy', 'apple' => 'https://example.org/apple'])->links)->toBe([0 => 'https://example.org/legacy', 'apple' => 'https://example.org/apple']);
});
