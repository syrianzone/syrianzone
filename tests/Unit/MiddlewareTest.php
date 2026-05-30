<?php

use App\Http\Middleware\SuperAdmin;
use App\Models\User;
use Illuminate\Http\Request;

test('superadmin middleware blocks non-superadmin', function () {
    $user = User::factory()->create(['role' => 'admin']);
    $request = Request::create('/test', 'GET');
    $request->setUserResolver(fn() => $user);

    $middleware = new SuperAdmin();
    $response = $middleware->handle($request, fn() => response()->json(['ok' => true]));

    expect($response->getStatusCode())->toBe(403);
});

test('superadmin middleware allows superadmin', function () {
    $user = User::factory()->create(['role' => 'superadmin']);
    $request = Request::create('/test', 'GET');
    $request->setUserResolver(fn() => $user);

    $middleware = new SuperAdmin();
    $response = $middleware->handle($request, fn() => response()->json(['ok' => true]));

    expect($response->getStatusCode())->toBe(200);
});

test('superadmin middleware blocks unauthenticated', function () {
    $request = Request::create('/test', 'GET');
    $request->setUserResolver(fn() => null);

    $middleware = new SuperAdmin();
    $response = $middleware->handle($request, fn() => response()->json(['ok' => true]));

    expect($response->getStatusCode())->toBe(403);
});

use App\Http\Middleware\Admin;

test('admin middleware blocks non-admin and non-superadmin', function () {
    $user = User::factory()->create(['role' => 'user']);
    $request = Request::create('/test', 'GET');
    $request->headers->set('Accept', 'application/json');
    $request->setUserResolver(fn() => $user);

    $middleware = new Admin();
    $response = $middleware->handle($request, fn() => response()->json(['ok' => true]));

    expect($response->getStatusCode())->toBe(403);
});

test('admin middleware allows admin', function () {
    $user = User::factory()->create(['role' => 'admin']);
    $request = Request::create('/test', 'GET');
    $request->setUserResolver(fn() => $user);

    $middleware = new Admin();
    $response = $middleware->handle($request, fn() => response()->json(['ok' => true]));

    expect($response->getStatusCode())->toBe(200);
});

test('admin middleware allows superadmin', function () {
    $user = User::factory()->create(['role' => 'superadmin']);
    $request = Request::create('/test', 'GET');
    $request->setUserResolver(fn() => $user);

    $middleware = new Admin();
    $response = $middleware->handle($request, fn() => response()->json(['ok' => true]));

    expect($response->getStatusCode())->toBe(200);
});

test('admin middleware blocks unauthenticated', function () {
    $request = Request::create('/test', 'GET');
    $request->headers->set('Accept', 'application/json');
    $request->setUserResolver(fn() => null);

    $middleware = new Admin();
    $response = $middleware->handle($request, fn() => response()->json(['ok' => true]));

    expect($response->getStatusCode())->toBe(403);
});
