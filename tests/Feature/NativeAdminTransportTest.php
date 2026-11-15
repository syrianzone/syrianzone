<?php

use App\Http\Middleware\FirstPartyAdminTransport;
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\Poll;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

class NativeTransportEnforcedCsrf extends ValidateCsrfToken
{
    protected function runningUnitTests()
    {
        return false;
    }
}

function nativeAdminBearer(string $capability): string
{
    Auth::forgetGuards();

    return User::factory()->create(['role' => 'user', 'permissions' => [$capability]])
        ->createToken('Native transport test', ['mobile'])->plainTextToken;
}

test('canonical content administration routes use API middleware with their original capability', function () {
    foreach ([
        ['POST', '/api/v1/admin/compass/figures', 'compass_admin:compass.figures'],
        ['POST', '/api/v1/admin/promises', 'promises_admin:promises.create'],
        ['POST', '/api/v1/admin/phonebook/categories', 'phonebook_admin:phonebook.create'],
        ['POST', '/api/v1/admin/syofficial/categories', 'syofficial_admin:syofficial.create'],
        ['POST', '/api/v1/admin/govapps', 'govapps_admin:govapps.create'],
        ['POST', '/api/v1/admin/guesswho/categories', 'guesswho_admin:guesswho.manage'],
        ['POST', '/api/v1/admin/assets/upload', 'assets_admin:assets.manage'],
    ] as [$method, $path, $capability]) {
        $route = Route::getRoutes()->match(Request::create($path, $method));
        expect($route->gatherMiddleware())->toContain('api', 'auth:sanctum', $capability)->not->toContain('web');
    }
});

test('native bearer administration works with real CSRF enforcement and browser requests still require CSRF', function () {
    app()->bind(ValidateCsrfToken::class, NativeTransportEnforcedCsrf::class);
    app()->bind(PreventRequestForgery::class, NativeTransportEnforcedCsrf::class);
    config(['sanctum.stateful' => ['localhost']]);
    $token = nativeAdminBearer('compass.figures');
    $this->withHeader('Authorization', 'Bearer '.$token)
        ->postJson('/api/v1/admin/compass/figures', [
            'name' => 'شخصية اختبار محلية', 'category' => 'civ', 'align' => 'neutral', 'positions' => ['auth_lib' => 0],
        ])->assertOk()->assertJsonPath('success', true);

    $this->withHeader('Origin', 'http://localhost')
        ->postJson('/api/v1/admin/compass/figures', [])->assertStatus(419);
    $this->postJson('/api/polls', [])->assertStatus(419);
});

test('native directory and game content writes acknowledge JSON without following redirects', function (string $capability, string $path, array $payload) {
    $this->withHeader('Authorization', 'Bearer '.nativeAdminBearer($capability))
        ->postJson($path, $payload)->assertSuccessful()->assertJsonPath('success', true);
})->with([
    ['phonebook.create', '/api/v1/admin/phonebook/categories', ['id' => 'native-local', 'label_ar' => 'اختبار محلي', 'label_en' => 'Local test']],
    ['syofficial.create', '/api/v1/admin/syofficial/categories', ['id' => 'native-local', 'label_ar' => 'اختبار محلي', 'label_en' => 'Local test']],
    ['govapps.create', '/api/v1/admin/govapps', ['id' => 'native-local', 'name' => 'Local test', 'name_ar' => 'اختبار محلي', 'links' => []]],
    ['guesswho.manage', '/api/v1/admin/guesswho/categories', ['slug' => 'native-local', 'name_ar' => 'اختبار محلي', 'name_en' => 'Local test']],
]);

test('native poll managers can inspect every roster without widening public reads', function (string $capability) {
    $poll = Poll::factory()->create(['is_active' => false]);
    $group = CandidateGroup::factory()->create(['poll_id' => $poll->id, 'is_active' => false]);
    $candidate = Candidate::factory()->create(['poll_id' => $poll->id, 'candidate_group_id' => $group->id, 'status' => 'archived']);
    $this->getJson('/api/v1/admin/polls')->assertUnauthorized();
    $this->withHeader('Authorization', 'Bearer '.nativeAdminBearer($capability))
        ->getJson('/api/v1/admin/polls')->assertOk()->assertHeader('Cache-Control', 'no-store, private')->assertJsonFragment(['id' => $poll->id, 'candidates_count' => 1]);
    $this->getJson('/api/v1/admin/polls/'.$poll->id.'?include_archived=1')->assertOk()
        ->assertJsonPath('groups.0.id', $group->id)->assertJsonPath('groups.0.is_active', false)
        ->assertJsonPath('candidates.0.id', $candidate->id);
    $this->postJson('/api/v1/admin/polls', [])->assertStatus($capability === 'polls.create' ? 422 : 403);
})->with(['polls.create', 'polls.edit', 'polls.delete']);

test('native poll writes retain each exact action guard and protect the core poll', function () {
    $poll = Poll::factory()->create(['slug' => Poll::coreSlug()]);
    $this->withHeader('Authorization', 'Bearer '.nativeAdminBearer('polls.create'))
        ->deleteJson('/api/v1/admin/polls/'.$poll->id)->assertForbidden();
    $this->withHeader('Authorization', 'Bearer '.nativeAdminBearer('polls.delete'))
        ->deleteJson('/api/v1/admin/polls/'.$poll->id)->assertForbidden();
    $this->withHeader('Authorization', 'Bearer '.nativeAdminBearer('polls.edit'))
        ->putJson('/api/v1/admin/polls/'.$poll->id, ['slug' => 'rename-core'])->assertForbidden();
    expect($poll->fresh())->not->toBeNull()->and($poll->fresh()->slug)->toBe(Poll::coreSlug());
});

test('first party admin transport refuses banned owners and scoped agent credentials', function () {
    $banned = User::factory()->create(['role' => 'user', 'permissions' => ['compass.figures'], 'is_banned' => true]);
    $this->withHeader('Authorization', 'Bearer '.$banned->createToken('Native', ['mobile'])->plainTextToken)
        ->postJson('/api/v1/admin/compass/figures', [])->assertForbidden();
    $owner = User::factory()->create(['role' => 'user', 'permissions' => ['compass.figures']]);
    Auth::forgetGuards();
    $this->withHeader('Authorization', 'Bearer '.$owner->createToken('Scoped agent', ['compass.stats'])->plainTextToken)
        ->postJson('/api/v1/admin/compass/figures', [])->assertForbidden();
    Auth::forgetGuards();
    $this->withHeader('Authorization', 'Bearer '.$owner->createToken('Wildcard agent', ['*'])->plainTextToken)
        ->postJson('/api/v1/admin/compass/figures', [])->assertForbidden();
});

test('private admin and dashboard pages enforce the same native token boundary', function (string $path, string $component, string $capability) {
    $this->withoutVite();
    $owner = User::factory()->create(['role' => 'user', 'permissions' => [$capability]]);
    $mobile = $owner->createToken('Native', ['mobile'])->plainTextToken;
    $version = (string) app(HandleInertiaRequests::class)->version(Request::create('/'));
    $this->withHeaders(['Authorization' => 'Bearer '.$mobile, 'X-Inertia' => 'true', 'X-Inertia-Version' => 'stale-native-test'])
        ->getJson($path)->assertStatus(409);
    $this->withHeader('X-Inertia-Version', $version)->getJson($path)->assertOk()->assertJsonPath('component', $component);

    Auth::forgetGuards();
    $agent = $owner->createToken('Scoped agent', [$capability])->plainTextToken;
    $this->withHeader('Authorization', 'Bearer '.$agent)->getJson($path)->assertForbidden();
    Auth::forgetGuards();
    $wildcard = $owner->createToken('Wildcard agent', ['*'])->plainTextToken;
    $this->withHeader('Authorization', 'Bearer '.$wildcard)->getJson($path)->assertForbidden();
    Auth::forgetGuards();
    $owner->update(['is_banned' => true]);
    $this->withHeader('Authorization', 'Bearer '.$mobile)->getJson($path)->assertForbidden();
})->with([
    ['/dashboard', 'Dashboard/Index', 'compass.figures'],
    ['/admin/compass/figures', 'Admin/Compass/Figures', 'compass.figures'],
    ['/admin/promises/review', 'Admin/Promises/Review', 'promises.review'],
    ['/admin/navigation', 'Admin/Navigation/Index', 'site.navigation'],
    ['/transit/admin', 'Transit/admin/Index', 'transit.review_drafts'],
]);

test('ordinary browser dashboard access and account routes retain their existing session contract', function () {
    $this->withoutVite();
    $user = User::factory()->create(['role' => 'user', 'permissions' => []]);
    $this->actingAs($user, 'web')->get('/dashboard')->assertOk();
    $route = Route::getRoutes()->match(Request::create('/api/account/update', 'POST'));
    expect($route->gatherMiddleware())->toContain('web')->not->toContain(FirstPartyAdminTransport::class);
});

test('canonical guest game actions are stateless while legacy browser actions retain CSRF', function () {
    app()->bind(ValidateCsrfToken::class, NativeTransportEnforcedCsrf::class);
    app()->bind(PreventRequestForgery::class, NativeTransportEnforcedCsrf::class);
    $this->postJson('/api/v1/guesswho/rooms', [])->assertUnprocessable()->assertJsonValidationErrors('player_session');
    $this->postJson('/guesswho/rooms', [])->assertStatus(419);
});

test('native popup save returns its committed version while Inertia keeps its redirect', function () {
    $this->withHeader('Authorization', 'Bearer '.nativeAdminBearer('site.popup'))
        ->putJson('/api/v1/admin/site-popup', [
            'title' => 'اختبار محلي', 'description' => 'وصف محلي', 'buttonText' => 'افتح', 'dismissText' => 'إغلاق', 'link' => 'https://example.org/', 'enabled' => false,
        ])->assertOk()->assertJsonPath('success', true)->assertJsonPath('popup.title', 'اختبار محلي')->assertJsonPath('popup.enabled', false)->assertJsonStructure(['popup' => ['version']]);
    $this->withHeader('X-Inertia', 'true')->put('/api/v1/admin/site-popup', [
        'title' => 'اختبار المتصفح', 'description' => 'وصف محلي', 'buttonText' => 'افتح', 'dismissText' => 'إغلاق', 'link' => 'https://example.org/', 'enabled' => false,
    ])->assertRedirect();
});
