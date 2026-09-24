<?php

use App\Models\User;

test('inertia logout redirects home', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/logout', [], ['X-Inertia' => 'true'])
        ->assertRedirect('/');
});

test('json logout still returns json', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/logout')
        ->assertOk()
        ->assertJson(['message' => 'Logged out']);
});
