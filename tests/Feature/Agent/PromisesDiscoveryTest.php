<?php

use App\Models\Promise;
use App\Models\PromiseSpeaker;
use App\Models\User;
use App\Support\Agents\TokenIssuer;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Support\Collection;

/*
|--------------------------------------------------------------------------
| Discovery and JSON-RPC surface for promises tracker tools
|--------------------------------------------------------------------------
*/

function promisesMcpCall(string $plainTextToken, array $payload)
{
    return test()
        ->withHeader('Authorization', 'Bearer '.$plainTextToken)
        ->postJson('/mcp/admin', array_merge(['jsonrpc' => '2.0', 'id' => 1], $payload));
}

function promisesMcpToolNames(string $plainTextToken): Collection
{
    return collect(
        promisesMcpCall($plainTextToken, ['method' => 'tools/list'])
            ->assertOk()
            ->json('result.tools')
    )->pluck('name');
}

function promisesMcpSearchToolNames(string $plainTextToken, string $query): array
{
    $response = promisesMcpCall($plainTextToken, [
        'method' => 'tools/call',
        'params' => [
            'name' => 'search_tools',
            'arguments' => ['query' => $query, 'limit' => 50],
        ],
    ])->assertOk();

    $text = $response->json('result.content.0.text') ?? '';
    $payload = json_decode($text, true);

    return collect($payload['tools'] ?? [])
        ->pluck('name')
        ->all();
}

function promisesMcpExecuteTool(string $plainTextToken, string $toolName, array $arguments): array
{
    $response = promisesMcpCall($plainTextToken, [
        'method' => 'tools/call',
        'params' => [
            'name' => 'execute_tools',
            'arguments' => [
                'calls' => [
                    ['name' => $toolName, 'arguments' => $arguments],
                ],
            ],
        ],
    ])->assertOk();

    $stream = (string) $response->streamedContent();

    $lines = array_values(array_filter(
        array_map('trim', explode("\n", $stream)),
        fn (string $line) => str_starts_with($line, 'data:'),
    ));

    $envelope = null;
    foreach ($lines as $line) {
        $decoded = json_decode(substr($line, strlen('data:')), true);

        if (is_array($decoded)) {
            $envelope = $decoded;
        }
    }

    $text = $envelope['result']['content'][0]['text'] ?? null;
    $payload = is_string($text) ? json_decode($text, true) : null;

    return is_array($payload) ? $payload : ['raw' => $stream];
}

test('a token with all six promises.* abilities is offered the read tools and not other modules', function () {
    $permissions = [
        'promises.create',
        'promises.edit',
        'promises.rule',
        'promises.review',
        'promises.speakers',
        'promises.delete',
    ];

    $staff = User::factory()->create(['role' => 'user', 'permissions' => $permissions]);
    $plain = app(TokenIssuer::class)->issue($staff, 'promises', $permissions)['token']->plainTextToken;

    $names = promisesMcpToolNames($plain);

    expect($names)->toContain(
        'list-promises',
        'get-promise',
        'search-promise-speakers',
        'get-promise-form-options',
        'get-promise-review-queue',
        'list-promise-speakers',
        'list-promise-sectors',
        'search_tools',
        'execute_tools',
    )
        ->and($names)->not->toContain('list-places', 'list-gov-apps', 'publish-promise');
});

test('search_tools with query promise returns the write tools', function () {
    $permissions = [
        'promises.create',
        'promises.edit',
        'promises.rule',
        'promises.review',
        'promises.speakers',
        'promises.delete',
    ];

    $staff = User::factory()->create(['role' => 'user', 'permissions' => $permissions]);
    $plain = app(TokenIssuer::class)->issue($staff, 'promises', $permissions)['token']->plainTextToken;

    $found = promisesMcpSearchToolNames($plain, 'promise');

    expect($found)->toContain(
        'create-promise',
        'update-promise',
        'add-promise-update',
        'remove-promise-update',
        'publish-promise',
        'unpublish-promise',
        'reject-promise',
        'set-promise-status',
        'undo-promise-status',
        'reschedule-promise',
        'delete-promise',
        'approve-promise-speaker',
        'reject-promise-speaker',
        'accept-promise-report',
        'dismiss-promise-report',
        'create-promise-speaker',
        'update-promise-speaker',
        'delete-promise-speaker',
        'create-promise-sector',
        'update-promise-sector',
        'toggle-promise-sector',
        'delete-promise-sector',
        'reorder-promise-sectors',
    );
});

test('a review-only token is offered the queue and publishing, but no verdicts, people or sectors', function () {
    $staff = User::factory()->create(['role' => 'user', 'permissions' => PermissionCatalogue::forModule('promises')]);
    $plain = app(TokenIssuer::class)->issue($staff, 'promises-reviewer', ['promises.review'])['token']->plainTextToken;

    $names = promisesMcpToolNames($plain);
    $found = promisesMcpSearchToolNames($plain, 'promise');

    expect($names)->toContain('get-promise-review-queue', 'list-promises')
        ->and($names)->not->toContain('list-promise-speakers', 'list-promise-sectors')
        ->and($found)->toContain('publish-promise', 'reject-promise', 'accept-promise-report', 'approve-promise-speaker')
        ->and($found)->not->toContain(
            'set-promise-status',
            'undo-promise-status',
            'reschedule-promise',
            'delete-promise',
            'update-promise',
            'create-promise-speaker',
            'reorder-promise-sectors',
        );
});

test('execute_tools round trip of set-promise-status logs a sourced verdict', function () {
    $promise = Promise::factory()->published()->create(['statement_date' => '2025-06-01']);
    $staff = User::factory()->create(['role' => 'user', 'permissions' => ['promises.rule']]);
    $plain = app(TokenIssuer::class)->issue($staff, 'promises-ruler', ['promises.rule'])['token']->plainTextToken;

    $result = promisesMcpExecuteTool($plain, 'set-promise-status', [
        'id' => $promise->id,
        'status' => 'in_progress',
        'happened_on' => '2025-07-01',
        'source_url' => 'https://example.com/started',
    ]);

    expect($result['results'][0]['isError'] ?? true)->toBeFalse()
        ->and($result['results'][0]['structuredContent']['status'] ?? null)->toBe('in_progress')
        ->and($promise->fresh()->status)->toBe('in_progress')
        ->and($promise->updates()->sole()->source_url)->toBe('https://example.com/started');
});

test('execute_tools round trip of create-promise returns created true and a promise row exists', function () {
    $speaker = PromiseSpeaker::factory()->create();

    $staff = User::factory()->create(['role' => 'user', 'permissions' => ['promises.create']]);
    $plain = app(TokenIssuer::class)->issue($staff, 'promises-writer', ['promises.create'])['token']->plainTextToken;

    $payload = [
        'speaker_ref' => 'speaker:'.$speaker->id,
        'title' => 'بناء شبكة كهرباء جديدة',
        'quote' => 'سنبني شبكة جديدة في حلب',
        'statement_date' => '2025-07-01',
        'statement_venue' => 'tv_interview',
        'deadline_wording' => 'خلال سنة',
        'deadline_date' => '2026-07-01',
        'sector_id' => 'electricity',
        'is_national' => false,
        'governorates' => ['aleppo'],
        'tags' => ['كهرباء'],
        'sources' => [
            ['url' => 'https://example.com/source', 'type' => 'news_article', 'published_date' => '2025-07-01'],
        ],
    ];

    $result = promisesMcpExecuteTool($plain, 'create-promise', $payload);

    expect($result['ok'] ?? false)->toBeTrue()
        ->and($result['results'][0]['isError'] ?? true)->toBeFalse()
        ->and($result['results'][0]['structuredContent']['created'] ?? false)->toBeTrue()
        ->and(Promise::where('title', 'بناء شبكة كهرباء جديدة')->exists())->toBeTrue();
});

test('a token with only places.review sees none of the promise tools', function () {
    $user = User::factory()->create(['role' => 'user', 'permissions' => ['places.review']]);
    $plain = app(TokenIssuer::class)->issue($user, 'places-only', ['places.review'])['token']->plainTextToken;

    $names = promisesMcpToolNames($plain);

    expect($names)->toContain('list-places')
        ->and($names)->not->toContain(
            'list-promises',
            'get-promise',
            'search-promise-speakers',
            'get-promise-form-options',
            'get-promise-review-queue',
            'list-promise-speakers',
            'list-promise-sectors',
        );

    $found = promisesMcpSearchToolNames($plain, 'promise');
    expect($found)->not->toContain(
        'create-promise',
        'update-promise',
        'add-promise-update',
        'remove-promise-update',
        'publish-promise',
        'set-promise-status',
        'delete-promise',
        'create-promise-speaker',
        'create-promise-sector',
    );
});
