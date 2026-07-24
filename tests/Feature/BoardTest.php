<?php

use App\Models\Board;
use App\Models\User;

// UserFactory defaults role to admin; regular users must be explicit.
function boardUser(array $attrs = []): User
{
    return User::factory()->create(array_merge(['role' => 'user'], $attrs));
}

function boardDoc(array $widgets = [], array $overrides = []): array
{
    return array_merge([
        'v' => 1,
        'activeId' => 'd_main',
        'updatedAt' => '2026-07-18T09:12:44.120Z',
        'dashboards' => [
            ['id' => 'd_main', 'name' => 'الرئيسية', 'widgets' => $widgets ?: [
                ['i' => 'w_k3n1', 'd' => 'clock', 'w' => 4, 'h' => 1, 'c' => ['format' => '24']],
            ]],
        ],
    ], $overrides);
}

test('guests cannot read or write a board', function () {
    $this->getJson('/api/v1/board')->assertUnauthorized();
    $this->putJson('/api/v1/board', ['document' => boardDoc()])->assertUnauthorized();
});

test('mobile bearer tokens can read and write the same board document', function () {
    $user = boardUser();
    $token = $user->createToken('mobile:test-device', ['mobile'])->plainTextToken;

    $this->withToken($token)
        ->putJson('/api/v1/board', ['document' => boardDoc()])
        ->assertOk();

    $this->withToken($token)
        ->getJson('/api/v1/board')
        ->assertOk()
        ->assertJsonPath('document.activeId', 'd_main');
});

test('board sync rejects bearer tokens without mobile provenance', function () {
    $user = boardUser();
    $token = $user->createToken('web-token', ['*'])->plainTextToken;

    $this->withToken($token)->getJson('/api/v1/board')->assertUnauthorized();
});

test('the board page is public', function () {
    $this->withoutVite();
    $this->get('/board')->assertOk();
});

test('a user with no board reads a null document', function () {
    $this->actingAs(boardUser())->getJson('/api/v1/board')
        ->assertOk()
        ->assertJsonPath('document', null)
        ->assertJsonPath('updated_at', null);
});

test('put creates then updates a single row', function () {
    $user = boardUser();

    $this->actingAs($user)->putJson('/api/v1/board', ['document' => boardDoc()])->assertOk();
    $this->assertDatabaseCount('boards', 1);

    $this->actingAs($user)->putJson('/api/v1/board', ['document' => boardDoc([
        ['i' => 'w_x', 'd' => 'notes', 'w' => 12, 'h' => 2, 'c' => ['text' => 'مرحبا']],
    ])])->assertOk();

    $this->assertDatabaseCount('boards', 1);
    $this->actingAs($user)->getJson('/api/v1/board')
        ->assertJsonPath('document.dashboards.0.widgets.0.d', 'notes')
        ->assertJsonPath('document.dashboards.0.widgets.0.c.text', 'مرحبا');
});

// Forward compatibility: a widget added on a newer client must survive a
// round-trip through an older one instead of being silently dropped.
test('an unknown widget id round-trips verbatim', function () {
    $user = boardUser();

    $this->actingAs($user)->putJson('/api/v1/board', ['document' => boardDoc([
        ['i' => 'w_future', 'd' => 'not-a-real-widget', 'w' => 6, 'h' => 2, 'c' => ['weird' => true]],
    ])])->assertOk();

    $this->actingAs($user)->getJson('/api/v1/board')
        ->assertJsonPath('document.dashboards.0.widgets.0.d', 'not-a-real-widget')
        ->assertJsonPath('document.dashboards.0.widgets.0.c.weird', true);
});

test('boards are scoped to their owner', function () {
    $mine = boardUser();
    $theirs = boardUser();
    Board::factory()->create(['user_id' => $theirs->id]);

    $this->actingAs($mine)->getJson('/api/v1/board')->assertJsonPath('document', null);
});

test('rejects a document over the size cap', function () {
    $this->actingAs(boardUser())->putJson('/api/v1/board', ['document' => boardDoc([
        ['i' => 'w_big', 'd' => 'notes', 'w' => 12, 'h' => 2, 'c' => ['text' => str_repeat('ا', 70000)]],
    ])])->assertStatus(422)->assertJsonPath('message', 'حجم اللوحة كبير جداً');

    $this->assertDatabaseCount('boards', 0);
});

test('rejects malformed documents', function () {
    $user = boardUser();

    $cases = [
        'missing version' => boardDoc([], ['v' => null]),
        'unsupported version' => boardDoc([], ['v' => 99]),
        'too many dashboards' => boardDoc([], ['dashboards' => array_map(
            fn ($n) => ['id' => "d_$n", 'name' => "لوحة $n", 'widgets' => []],
            range(1, 11),
        )]),
        'too many widgets' => boardDoc(array_map(
            fn ($n) => ['i' => "w_$n", 'd' => 'clock', 'w' => 4, 'h' => 1, 'c' => []],
            range(1, 41),
        )),
        'width out of range' => boardDoc([
            ['i' => 'w_a', 'd' => 'clock', 'w' => 13, 'h' => 1, 'c' => []],
        ]),
        'height out of range' => boardDoc([
            ['i' => 'w_a', 'd' => 'clock', 'w' => 4, 'h' => 9, 'c' => []],
        ]),
        'no dashboards' => boardDoc([], ['dashboards' => []]),
    ];

    foreach ($cases as $label => $document) {
        $this->actingAs($user)->putJson('/api/v1/board', ['document' => $document])
            ->assertStatus(422, "expected 422 for: $label");
    }

    $this->assertDatabaseCount('boards', 0);
});

test('deleting a user deletes their board', function () {
    $user = boardUser();
    Board::factory()->create(['user_id' => $user->id]);

    $user->forceDelete();

    $this->assertDatabaseCount('boards', 0);
});
