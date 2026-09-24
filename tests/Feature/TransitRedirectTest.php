<?php

test('legacy transit map shim redirects permanently and keeps the query', function () {
    $this->get('/transit/city/damascus/map?route=route-x')
        ->assertMovedPermanently()
        ->assertRedirect('/transit/city/damascus?route=route-x');
});

test('legacy transit map shim without a query keeps the bare target', function () {
    $this->get('/transit/city/damascus/map')
        ->assertMovedPermanently()
        ->assertRedirect('/transit/city/damascus');
});

test('legacy transit route shim redirects to the query form', function () {
    $this->get('/transit/city/damascus/route/route-x')
        ->assertMovedPermanently()
        ->assertRedirect('/transit/city/damascus?route=route-x');
});

test('transit admin page redirects unauthorized users to the dashboard', function () {
    $user = \App\Models\User::factory()->create(['role' => 'user']);

    $this->actingAs($user)->get('/transit/admin')->assertRedirect('/dashboard');
});
