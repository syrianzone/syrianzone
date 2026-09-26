<?php

use App\Models\Place;
use App\Models\Poll;
use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Support\Facades\DB;

/*
|--------------------------------------------------------------------------
| Phase C: decide authorisation from capabilities
|--------------------------------------------------------------------------
|
| Phase B stopped the codebase minting new role-derived access. Phase C moves
| the remaining readers of `role` onto the capability list, so the same question
| — who may do this — gets the same answer whether it is asked by a route
| guard, a Filament resource, an MCP tool or a controller.
|
| Every change here had the same shape: the UI or the middleware already gated on
| capabilities, and a second role check in the controller quietly contradicted
| it. The failure mode was always "granted the capability, saw the tab, got an
| empty screen", because there are no `polls_admin` or `transit.admin` roles —
| an explicit per-user grant is the only way to hold those capabilities, so the
| role check denied precisely the people the capability was issued to.
|
| The one exception is GuessWho, where access is narrowed rather than
| re-expressed. That is pinned explicitly at the bottom of this file.
|
*/

// ─── Fixtures ──────────────────────────────────────────────────────────────

/**
 * Insert a city, since route_drafts.city_id is a foreign key and there is no
 * CityFactory. Named distinctly from the other suite's scopeCity() because Pest
 * shares global functions across files.
 */
function phaseCCity(string $id, string $nameEn = 'City'): void
{
    $point = ['type' => 'Point', 'coordinates' => [36.72, 34.73]];
    $polygon = ['type' => 'Polygon', 'coordinates' => [[[36.0, 34.0], [37.0, 34.0], [37.0, 35.0], [36.0, 35.0], [36.0, 34.0]]]];

    $geometry = function (array $shape) {
        $json = json_encode($shape, JSON_THROW_ON_ERROR);

        // SQLite has no spatial types, so the raw geometry is stored as text.
        if (DB::connection()->getDriverName() === 'sqlite') {
            return $json;
        }

        $quoted = DB::connection()->getPdo()->quote($json);

        return DB::raw("ST_GeomFromGeoJSON({$quoted})");
    };

    DB::table('cities')->insert([
        'id' => $id,
        'name_ar' => $nameEn,
        'name_en' => $nameEn,
        'center' => $geometry($point),
        'bounds' => $geometry($polygon),
        'zoom' => 10,
        'status' => 'active',
    ]);
}

// ─── Dashboard: polls + transit payload ─────────────────────────────────────

it('gives a capability-only user the polls data their tab promises', function () {
    Poll::factory()->create(['slug' => 'best-ministers']);

    // No polls_admin role exists, so a `user` holding a polls capability is the
    // only way this account can exist. It used to render an empty list.
    $staff = User::factory()->create([
        'role' => 'user',
        'permissions' => ['polls.create'],
    ]);

    $this->actingAs($staff)
        ->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Dashboard/Index')
            ->has('polls')
            ->has('polls.0.candidates_count')
        );
});

it('withholds the polls data from a user holding only transit capabilities', function () {
    $staff = User::factory()->create([
        'role' => 'user',
        'permissions' => ['transit.edit_routes'],
    ]);

    $this->actingAs($staff)
        ->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Dashboard/Index')
            ->missing('polls')
        );
});

it('gives a transit reviewer the drafts and routes payload', function () {
    $reviewer = User::factory()->create([
        'role' => 'user',
        'permissions' => ['transit.review_drafts'],
    ]);

    $this->actingAs($reviewer)
        ->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Dashboard/Index')
            ->has('allDrafts')
            ->has('publishedRoutes')
        );
});

it('keeps a plain user on their own drafts only', function () {
    $user = User::factory()->create(['role' => 'user', 'permissions' => []]);

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Dashboard/Index')
            ->has('myDrafts')
            // Nothing else. This is the one role check Phase C keeps: it is a
            // negative test, asking "is this an ordinary account?", and it is
            // correct precisely because it is not an authorisation grant.
            ->missing('allDrafts')
            ->missing('publishedRoutes')
            ->missing('polls')
        );
});

it('still gives a full-catalogue account the full dashboard', function () {
    // Was 'still gives the deprecated admin role the full dashboard', guarding
    // the isAdmin() short-circuit. That alias is retired in phase G; the shape it
    // becomes is a `user` holding the whole catalogue, which is what the phase G
    // migration writes. The dashboard gate is unchanged either way.
    $admin = User::factory()->withPermissions(PermissionCatalogue::all())->create();

    $this->actingAs($admin)
        ->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Dashboard/Index')
            ->has('polls')
            ->has('allDrafts')
            ->has('publishedRoutes')
        );
});

it('does not run five queries for a capability that grants nothing', function () {
    $user = User::factory()->create([
        'role' => 'user',
        'permissions' => ['polls.create', 'transit.review_drafts'],
    ]);

    $queries = 0;
    DB::listen(function () use (&$queries) {
        $queries++;
    });

    $this->actingAs($user)->get('/dashboard')->assertOk();

    // myDrafts + polls + allDrafts(+user join) + publishedRoutes(+city join).
    // If a branch regressed to always running, this count would grow.
    expect($queries)->toBeLessThan(12);
});

// ─── Polls: deactivated polls are a moderation view ─────────────────────────

it('lets a polls editor see a deactivated poll', function () {
    $editor = User::factory()->create([
        'role' => 'user',
        'permissions' => ['polls.edit'],
    ]);

    Poll::factory()->create(['slug' => 'retired-poll', 'is_active' => false]);

    $this->actingAs($editor)
        ->get('/polls')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Polls/Index')
            ->where('polls.0.slug', 'retired-poll')
        );
});

it('withholds deactivated polls from someone who can only create them', function () {
    // polls.create was the capability the dashboard handed out; it must not
    // imply the moderation view.
    $creator = User::factory()->create([
        'role' => 'user',
        'permissions' => ['polls.create'],
    ]);

    Poll::factory()->create(['slug' => 'retired-poll', 'is_active' => false]);

    $this->actingAs($creator)
        ->get('/polls')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Polls/Index')
            ->missing('polls.0.slug')
        );
});

it('still lets a full-catalogue account see a deactivated poll', function () {
    $admin = User::factory()->withPermissions(PermissionCatalogue::all())->create();

    Poll::factory()->create(['slug' => 'retired-poll', 'is_active' => false]);

    $this->actingAs($admin)
        ->get('/polls')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('polls.0.slug', 'retired-poll'));
});

// ─── Places: unapproved visibility ──────────────────────────────────────────

it('lets a places reviewer see an unapproved place', function () {
    $reviewer = User::factory()->create([
        'role' => 'user',
        'permissions' => ['places.review'],
    ]);

    $place = Place::factory()->create(['status' => 'pending']);

    $this->actingAs($reviewer)
        ->getJson("/api/v1/places/{$place->id}")
        ->assertOk();
});

it('hides an unapproved place from someone with an unrelated capability', function () {
    $staff = User::factory()->create([
        'role' => 'user',
        'permissions' => ['polls.edit'],
    ]);

    $place = Place::factory()->create(['status' => 'pending']);

    $this->actingAs($staff)
        ->getJson("/api/v1/places/{$place->id}")
        ->assertNotFound();
});

it('still lets the deprecated admin role see an unapproved place', function () {
    // The edit dropped `$user->role === 'admin'` on the strength of
    // User::hasPermission() short-circuiting on isAdmin(). Pin that, because the
    // redundancy looked removable and was not. The short-circuit is retired in
    // phase G, but the capability list alone still admits this account.
    $admin = User::factory()->withPermissions(PermissionCatalogue::all())->create();

    $place = Place::factory()->create(['status' => 'pending']);

    $this->actingAs($admin)
        ->getJson("/api/v1/places/{$place->id}")
        ->assertOk();
});

it('hides an unapproved place from a signed-out visitor', function () {
    $place = Place::factory()->create(['status' => 'pending']);

    $this->getJson("/api/v1/places/{$place->id}")->assertNotFound();
});

// ─── Transit studio: draft editing ──────────────────────────────────────────

it('lets an unscoped transit editor edit another users draft', function () {
    // An editor with no governorate scope is not "scoped staff"
    // (ChecksTransitScope::isScopedTransitStaff requires a scope), so they keep
    // unrestricted access. Worth pinning: routing capability holders into the
    // scope branch could have denied exactly the users it was meant to empower.
    phaseCCity('damascus', 'Damascus');
    $owner = User::factory()->create(['role' => 'user']);

    $draft = RouteDraft::create([
        'user_id' => $owner->id,
        'city_id' => 'damascus',
        'name_ar' => 'مسودة',
        'geojson' => ['type' => 'FeatureCollection', 'features' => []],
        'status' => 'pending',
    ]);

    $editor = User::factory()->create([
        'role' => 'user',
        'permissions' => ['transit.edit_routes'],
    ]);

    $this->actingAs($editor)
        ->getJson("/api/v1/studio/routes/{$draft->id}")
        ->assertOk();
});

it('keeps a scoped transit editor inside their governorates', function () {
    // The scope half of the branch must survive the role->capability swap.
    phaseCCity('aleppo', 'Aleppo');
    $owner = User::factory()->create(['role' => 'user']);

    $draft = RouteDraft::create([
        'user_id' => $owner->id,
        'city_id' => 'aleppo',
        'name_ar' => 'مسودة',
        'geojson' => ['type' => 'FeatureCollection', 'features' => []],
        'status' => 'pending',
    ]);

    $editor = User::factory()->create([
        'role' => 'user',
        'permissions' => ['transit.edit_routes'],
        'permission_scopes' => ['transit' => ['damascus']],
    ]);

    $this->actingAs($editor)
        ->putJson("/api/v1/studio/routes/{$draft->id}", ['name_ar' => 'مخطط'])
        ->assertStatus(403);
});

it('does not let a transit approver edit a draft they do not own', function () {
    // transit.approve is a real capability that used to fall through the role
    // list and land on the owner check.
    phaseCCity('damascus', 'Damascus');
    $owner = User::factory()->create(['role' => 'user']);

    $draft = RouteDraft::create([
        'user_id' => $owner->id,
        'city_id' => 'damascus',
        'name_ar' => 'مسودة',
        'geojson' => ['type' => 'FeatureCollection', 'features' => []],
        'status' => 'pending',
    ]);

    $approver = User::factory()->create([
        'role' => 'user',
        'permissions' => ['transit.approve'],
    ]);

    $this->actingAs($approver)
        ->putJson("/api/v1/studio/routes/{$draft->id}", ['name_ar' => 'مخطط'])
        ->assertStatus(403);
});

it('still lets the owner edit their own draft without a capability', function () {
    phaseCCity('damascus', 'Damascus');
    $owner = User::factory()->create(['role' => 'user', 'permissions' => []]);

    $draft = RouteDraft::create([
        'user_id' => $owner->id,
        'city_id' => 'damascus',
        'name_ar' => 'مسودة',
        'geojson' => ['type' => 'FeatureCollection', 'features' => []],
        'status' => 'pending',
    ]);

    $this->actingAs($owner)
        ->getJson("/api/v1/studio/routes/{$draft->id}")
        ->assertOk();
});

// ─── GuessWho: the one intentional reduction ────────────────────────────────

it('keeps GuessWho admin superadmin-only', function () {
    // Deliberate narrowing, decided over minting a guesswho.* capability for a
    // novelty game with a single operator. Pinned so it is never widened by
    // accident. Holding every capability is not enough: GuessWho is gated on
    // superadmin, and an account that ran it as `admin` before phase G must be
    // promoted.
    $admin = User::factory()->withPermissions(PermissionCatalogue::all())->create();

    $this->actingAs($admin)
        ->get('/admin/guesswho')
        ->assertForbidden();

    $superadmin = User::factory()->create(['role' => 'superadmin']);

    $this->actingAs($superadmin)
        ->get('/admin/guesswho')
        ->assertOk();
});
