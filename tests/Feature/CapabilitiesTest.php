<?php

use App\Filament\Resources\UserResource;
use App\Http\Middleware\AutoLoginDevUser;
use App\Models\Place;
use App\Models\Poll;
use App\Models\RouteDraft;
use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
|--------------------------------------------------------------------------
| Capability-based authorisation
|--------------------------------------------------------------------------
|
| An account's access is exactly the capability list an operator ticked, and
| `role` holds two values: `superadmin` and `user`. Everything else — the six
| module roles and the old catch-all `admin` — is an inert string.
|
| This file is organised by the invariant it protects rather than by the order
| the migration was carried out in. Each section states a rule that must keep
| holding; the rollout order is in the git history (phases A to G) and in the
| migrations themselves, which is where a reader should look for "why".
|
| The negative direction carries most of the weight. Before the migration, each
| phase could only prove something was still granted; the interesting property
| now is that nothing is, so a stray role can never quietly become a back door.
|
*/

// ─── Fixtures ──────────────────────────────────────────────────────────────

/**
 * Insert a city, since route_drafts.city_id is a foreign key and there is no
 * CityFactory. Named distinctly from TransitGovernorateScopeTest's scopeCity(),
 * because Pest shares global functions across files.
 */
function capabilitiesCity(string $id, string $nameEn = 'City'): void
{
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
        'center' => $geometry(['type' => 'Point', 'coordinates' => [36.72, 34.73]]),
        'bounds' => $geometry(['type' => 'Polygon', 'coordinates' => [[[36.0, 34.0], [37.0, 34.0], [37.0, 35.0], [36.0, 35.0], [36.0, 34.0]]]]),
        'zoom' => 10,
        'status' => 'active',
    ]);
}

/**
 * Every role value that no longer grants anything. The six module roles stopped
 * conferring capabilities when the prefix table was deleted; `admin` stopped
 * when the catch-all short-circuit was.
 *
 * @return array<int, string>
 */
function retiredRoles(): array
{
    return [
        'admin',
        'syofficial_admin',
        'transit_admin',
        'govapps_admin',
        'phonebook_admin',
        'places_admin',
        'users_admin',
    ];
}

// ─── `permissions` is the only thing that grants access ────────────────────

it('grants a retired role nothing at all', function (string $role) {
    $user = User::factory()->create(['role' => $role, 'permissions' => []]);

    expect($user->effectivePermissions())->toBe([])
        ->and($user->isSuperAdmin())->toBeFalse();

    // Not even the module it is named after.
    foreach (PermissionCatalogue::all() as $capability) {
        expect($user->hasPermission($capability))->toBeFalse();
    }
})->with(retiredRoles());

it('keeps an explicit grant working under a retired role name', function () {
    // The label is inert; the data is what grants. This is the shape the 2026-09
    // migrations leave every previously-`transit_admin` account in, so it is the
    // case that matters most.
    $user = User::factory()->create([
        'role' => 'transit_admin',
        'permissions' => PermissionCatalogue::forModule('transit'),
    ]);

    expect($user->effectivePermissions())->toHaveCount(5)
        ->and($user->hasPermission('transit.approve'))->toBeTrue()
        // The role name contributes nothing beyond what is stored.
        ->and($user->hasPermission('transit.delete_routes'))
        ->toBe(in_array('transit.delete_routes', $user->permissions, true));
});

it('resolves a plain user purely from the stored array', function () {
    $user = User::factory()->create([
        'role' => 'user',
        'permissions' => ['polls.create'],
    ]);

    expect($user->hasPermission('polls.create'))->toBeTrue()
        // Holding one polls capability must not imply the rest of its module.
        ->and($user->hasPermission('polls.delete'))->toBeFalse()
        ->and($user->effectivePermissions())->toBe(['polls.create']);
});

it('honours the wildcard for an ordinary role', function () {
    // `*` predates the migration and is the one non-role grant that survives it.
    $user = User::factory()->create(['role' => 'user', 'permissions' => ['*']]);

    expect($user->effectivePermissions())->toEqual(PermissionCatalogue::all())
        ->and($user->hasPermission('govapps.delete'))->toBeTrue();
});

it('resolves superadmin to the whole catalogue', function () {
    // The only role that still confers anything by name.
    $user = User::factory()->create(['role' => 'superadmin', 'permissions' => []]);

    expect($user->effectivePermissions())->toEqual(PermissionCatalogue::all());
});

it('does not let an unset role grant anything', function () {
    // users.role is NOT NULL, so a persisted account cannot have a null role. The
    // reachable case is an unsaved model — a form being validated, a factory
    // mid-build — which is the state that used to index the prefix table with
    // null, a PHP 8.1 deprecation that `?? null` does not suppress.
    $unsaved = new User(['permissions' => ['polls.create']]);

    expect($unsaved->role)->toBeNull()
        ->and($unsaved->hasPermission('polls.create'))->toBeTrue()
        ->and($unsaved->hasPermission('polls.delete'))->toBeFalse()
        ->and($unsaved->effectivePermissions())->toBe(['polls.create'])
        ->and($unsaved->isSuperAdmin())->toBeFalse();
});

it('defaults an omitted role to user, and the column default agrees', function () {
    // Defence in depth. All three account-creation paths set `role` explicitly,
    // so this only decides what happens when a future one forgets: fail closed.
    $user = new User(['name' => 'No Role', 'email' => 'norole@example.test']);
    $user->password = bcrypt('secret');
    $user->save();

    expect($user->fresh()->role)->toBe('user')
        ->and($user->fresh()->effectivePermissions())->toBe([]);

    // And the column itself, so the behaviour above is not an artefact of the
    // factory. The default was 'admin' until the 2026-09-27 migration, which made
    // an omitted role mint an all-powerful account.
    $driver = Schema::getConnection()->getDriverName();

    $default = match ($driver) {
        'mysql', 'mariadb' => (Schema::select("SHOW COLUMNS FROM users LIKE 'role'")[0]->Default ?? null),
        // SQLite rebuilds the table on change(); pragma_table_info is a
        // table-valued function, so it needs a raw SELECT.
        default => DB::selectOne("SELECT dflt_value FROM pragma_table_info('users') WHERE name = 'role'")->dflt_value ?? null,
    };

    expect(trim((string) $default, "'\" "))->toBe('user');
});

// ─── The role vocabulary is exactly two values ─────────────────────────────

it('offers exactly superadmin and user in the role select', function () {
    // The one place roles are assigned. Both retired groups are asserted absent
    // explicitly rather than by set difference, so re-adding either fails here.
    expect(array_keys(UserResource::roleOptions()))
        ->toEqualCanonicalizing(['superadmin', 'user'])
        ->not->toContain(
            'admin',
            'syofficial_admin',
            'transit_admin',
            'govapps_admin',
            'phonebook_admin',
            'places_admin',
            'users_admin',
        );
});

// ─── Staff accounts are minted capability-backed ───────────────────────────

it('creates a staff account as a user holding the full catalogue', function () {
    $this->actingAs(User::factory()->create(['role' => 'superadmin']))
        ->postJson('/api/admins', ['name' => 'Staff', 'email' => 'staff@example.test'])
        ->assertCreated()
        ->assertJsonPath('role', 'user');

    $created = User::where('email', 'staff@example.test')->firstOrFail();

    expect($created->permissions)->toEqual(PermissionCatalogue::all())
        ->and($created->effectivePermissions())->toEqual(PermissionCatalogue::all());
});

it('discards a retired role requested at the admin API', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);

    $this->actingAs($superadmin)
        ->postJson('/api/admins', [
            'name' => 'Transit Operator',
            'email' => 'transit-operator@example.test',
            'role' => 'transit_admin',
        ])
        ->assertCreated()
        ->assertJsonPath('role', 'user');

    $created = User::where('email', 'transit-operator@example.test')->firstOrFail();

    // The requested role is ignored rather than honoured, and access comes from
    // the catalogue — so a caller cannot mint a label that means nothing and
    // leave the operator to guess why the account is not scoped.
    expect($created->role)->toBe('user')
        ->and($created->effectivePermissions())->toEqual(PermissionCatalogue::all());
});

// ─── Dev impersonation is capability-backed, not role-backed ────────────────
//
// The presets are named after the module they preview, which made them read as
// role values. They are not: each is a `user` account holding that module's
// capabilities explicitly. Had they stayed real roles, the switcher would have
// stopped working the moment the prefix table was deleted.

it('gives every dev preset a plain user or superadmin role', function () {
    $middleware = new AutoLoginDevUser;

    foreach (AutoLoginDevUser::DEV_ROLES as $preset) {
        $user = $middleware->ensureDevUser($preset);

        expect($user->role)->toBe($preset === 'superadmin' ? 'superadmin' : 'user');

        if (str_ends_with($preset, '_admin') && $preset !== 'superadmin') {
            expect($user->role)->not->toBe($preset);
        }
    }
});

it('gives each dev preset exactly the capabilities it previews', function () {
    $middleware = new AutoLoginDevUser;

    $cases = [
        'transit_admin' => 'transit.',
        'syofficial_admin' => 'syofficial.',
        'govapps_admin' => 'govapps.',
        'phonebook_admin' => 'phonebook.',
        'places_admin' => 'places.',
        'users_admin' => 'users.',
    ];

    foreach ($cases as $preset => $prefix) {
        $expected = array_values(array_filter(
            PermissionCatalogue::all(),
            static fn (string $c) => str_starts_with($c, $prefix)
        ));

        expect($middleware->ensureDevUser($preset)->effectivePermissions())
            ->toEqual($expected, "{$preset} should hold {$prefix}*");
    }

    // The plain `user` preset is the control: a name that is not a module holds
    // nothing, rather than falling back to some implicit grant.
    expect($middleware->ensureDevUser('user')->effectivePermissions())->toBe([]);
});

it('syncs a dev account that predates the capability backing', function () {
    $middleware = new AutoLoginDevUser;

    // An account created back when the preset really was a role: stale role, and
    // only the capabilities the 2026-07 backfill happened to give it.
    $spec = AutoLoginDevUser::DEV_USERS['transit_admin'];
    $legacy = User::create([
        'name' => $spec['name'],
        'email' => $spec['email'],
        'password' => bcrypt('password'),
        'role' => 'transit_admin',
        'permissions' => ['transit.approve'],
    ]);

    $user = $middleware->ensureDevUser('transit_admin');

    expect($user->is($legacy))->toBeTrue()
        ->and($user->role)->toBe('user')
        ->and($user->effectivePermissions())->toHaveCount(5);
});

it('re-syncs a dev account whose capabilities were edited', function () {
    $middleware = new AutoLoginDevUser;
    $user = $middleware->ensureDevUser('places_admin');

    $user->update(['permissions' => []]);

    expect($middleware->ensureDevUser('places_admin')->effectivePermissions())->toHaveCount(5);
});

// ─── Capability gates actually gate ────────────────────────────────────────
//
// Every case below was a place where the UI or the middleware gated on a
// capability while a second check in the controller contradicted it. The symptom
// was always the same: the tab was visible, the panel was empty.

// Dashboard: the payload each capability earns.

it('gives a capability-only user the polls data their tab promises', function () {
    Poll::factory()->create(['slug' => 'best-ministers']);

    $staff = User::factory()->withPermissions(['polls.create'])->create();

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
    $staff = User::factory()->withPermissions(['transit.edit_routes'])->create();

    $this->actingAs($staff)
        ->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Dashboard/Index')
            ->missing('polls')
        );
});

it('gives a transit reviewer the drafts and routes payload', function () {
    $reviewer = User::factory()->withPermissions(['transit.review_drafts'])->create();

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
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Dashboard/Index')
            ->has('myDrafts')
            // Nothing else. This is the one role check the dashboard keeps: a
            // negative test asking "is this an ordinary account?", correct
            // precisely because it is not an authorisation grant.
            ->missing('allDrafts')
            ->missing('publishedRoutes')
            ->missing('polls')
        );
});

it('gives a full-catalogue account every dashboard panel', function () {
    // The broad-access case, in one place: the shape the 2026-09-27 migration
    // writes a former `admin` account into.
    $staff = User::factory()->withPermissions(PermissionCatalogue::all())->create();

    $this->actingAs($staff)
        ->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Dashboard/Index')
            ->has('polls')
            ->has('allDrafts')
            ->has('publishedRoutes')
        );
});

// Polls: seeing a deactivated poll is a moderation view.

it('lets a polls editor see a deactivated poll', function () {
    $editor = User::factory()->withPermissions(['polls.edit'])->create();

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
    // polls.create is the capability the dashboard hands out; it must not imply
    // the moderation view.
    $creator = User::factory()->withPermissions(['polls.create'])->create();

    Poll::factory()->create(['slug' => 'retired-poll', 'is_active' => false]);

    $this->actingAs($creator)
        ->get('/polls')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Polls/Index')
            ->missing('polls.0.slug')
        );
});

// Places: an unapproved place is visible to its owner and to places staff.

it('lets a places reviewer see an unapproved place', function () {
    $reviewer = User::factory()->withPermissions(['places.review'])->create();

    $place = Place::factory()->create(['status' => 'pending']);

    $this->actingAs($reviewer)->getJson("/api/v1/places/{$place->id}")->assertOk();
});

it('hides an unapproved place from someone with an unrelated capability', function () {
    $staff = User::factory()->withPermissions(['polls.edit'])->create();

    $place = Place::factory()->create(['status' => 'pending']);

    $this->actingAs($staff)->getJson("/api/v1/places/{$place->id}")->assertNotFound();
});

it('hides an unapproved place from a signed-out visitor', function () {
    $place = Place::factory()->create(['status' => 'pending']);

    $this->getJson("/api/v1/places/{$place->id}")->assertNotFound();
});

// Transit studio: capability plus governorate scope.

it('lets an unscoped transit editor edit another users draft', function () {
    // An editor with no governorate scope is not "scoped staff" — that requires a
    // scope — so they keep unrestricted access. Worth pinning: routing
    // capability holders into the scope branch could have denied exactly the
    // users the change was meant to empower.
    capabilitiesCity('damascus', 'Damascus');
    $owner = User::factory()->create();

    $draft = RouteDraft::create([
        'user_id' => $owner->id,
        'city_id' => 'damascus',
        'name_ar' => 'مسودة',
        'geojson' => ['type' => 'FeatureCollection', 'features' => []],
        'status' => 'pending',
    ]);

    $editor = User::factory()->withPermissions(['transit.edit_routes'])->create();

    $this->actingAs($editor)->getJson("/api/v1/studio/routes/{$draft->id}")->assertOk();
});

it('keeps a scoped transit editor inside their governorates', function () {
    capabilitiesCity('aleppo', 'Aleppo');
    $owner = User::factory()->create();

    $draft = RouteDraft::create([
        'user_id' => $owner->id,
        'city_id' => 'aleppo',
        'name_ar' => 'مسودة',
        'geojson' => ['type' => 'FeatureCollection', 'features' => []],
        'status' => 'pending',
    ]);

    $editor = User::factory()->create([
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
    capabilitiesCity('damascus', 'Damascus');
    $owner = User::factory()->create();

    $draft = RouteDraft::create([
        'user_id' => $owner->id,
        'city_id' => 'damascus',
        'name_ar' => 'مسودة',
        'geojson' => ['type' => 'FeatureCollection', 'features' => []],
        'status' => 'pending',
    ]);

    $approver = User::factory()->withPermissions(['transit.approve'])->create();

    $this->actingAs($approver)
        ->putJson("/api/v1/studio/routes/{$draft->id}", ['name_ar' => 'مخطط'])
        ->assertStatus(403);
});

it('still lets the owner edit their own draft without a capability', function () {
    capabilitiesCity('damascus', 'Damascus');
    $owner = User::factory()->create();

    $draft = RouteDraft::create([
        'user_id' => $owner->id,
        'city_id' => 'damascus',
        'name_ar' => 'مسودة',
        'geojson' => ['type' => 'FeatureCollection', 'features' => []],
        'status' => 'pending',
    ]);

    $this->actingAs($owner)->getJson("/api/v1/studio/routes/{$draft->id}")->assertOk();
});

it('keeps GuessWho superadmin-only even for a full-catalogue account', function () {
    // The one place access was narrowed rather than re-expressed: minting
    // guesswho.* capabilities for a novelty game with one operator was not worth
    // a fifth module in the catalogue. Pinned so it is never widened by
    // accident, and so the migration note stays honest — an account that ran
    // GuessWho as `admin` has to be promoted.
    $staff = User::factory()->withPermissions(PermissionCatalogue::all())->create();

    $this->actingAs($staff)->get('/admin/guesswho')->assertForbidden();

    $superadmin = User::factory()->create(['role' => 'superadmin']);

    $this->actingAs($superadmin)->get('/admin/guesswho')->assertOk();
});

// ─── The role machinery is gone, not merely bypassed ───────────────────────

it('has no role-to-capability machinery left on the model', function () {
    // Stronger than asserting behaviour: the members are gone, so nothing can
    // reintroduce a caller that depends on them.
    $reflection = new ReflectionClass(User::class);

    expect(method_exists(User::class, 'isAdmin'))->toBeFalse()
        ->and(method_exists(User::class, 'moduleImplyingRoles'))->toBeFalse()
        ->and($reflection->hasConstant('ROLE_MODULE_PREFIXES'))->toBeFalse();
});

it('has no admin middleware class or route alias left', function () {
    // Asserted on the router's alias table rather than class_exists(), because a
    // developer's composer classmap can still list a deleted file and make
    // class_exists() fatal — a stale local artefact, not a real failure.
    expect(app('router')->getMiddleware())->not->toHaveKey('admin')
        ->and(file_exists(app_path('Http/Middleware/Admin.php')))->toBeFalse();
});

// ─── Migration safety ──────────────────────────────────────────────────────
//
// The 2026-09-27 migration rewrote every retired role to `user`, granting the
// catalogue first so the rewrite could not cost anyone access. It is deployed
// and idempotent, so these cover the three paths that still matter: the rewrite
// itself, a rollback, and an accidental re-run.

/**
 * Drive the migration's up(). The migration is an anonymous class, so it is
 * re-required and invoked directly rather than through Artisan.
 */
function runRoleNormalisation(): void
{
    // It already ran once during RefreshDatabase, so its backup table exists and
    // up() would short-circuit. Dropping it is the only way to exercise the real
    // path, since the skip is itself the idempotence guard.
    Schema::dropIfExists('users_role_normalisation_backup');

    $migration = require database_path('migrations/2026_09_27_100000_reduce_roles_to_superadmin_and_user.php');
    $migration->up();
}

it('rewrites a retired role to user without changing access', function (string $role, array $capabilities) {
    $before = $capabilities;

    $account = User::factory()->create(['role' => $role, 'permissions' => $capabilities]);

    runRoleNormalisation();

    $fresh = $account->fresh();

    // Only retired roles are rewritten; superadmin is in the dataset as a
    // control and must come through untouched.
    expect($fresh->role)->toBe($role === 'superadmin' ? 'superadmin' : 'user');

    // The migration unions rather than replaces, so nothing already granted is
    // revoked. What it adds depends on what the role used to imply:
    //
    //   admin          resolved everything through a short-circuit rather than in
    //                  data, so it must end up holding the whole catalogue
    //   module role    implies its module, so a short list is topped up — the
    //                  2026-09-26 migration should already have done this, so a
    //                  shortfall here is a defect the union quietly covers
    //   superadmin     already resolves the catalogue and gains nothing
    $granted = match (true) {
        $role === 'admin' => PermissionCatalogue::all(),
        $role === 'superadmin' => PermissionCatalogue::all(),
        default => PermissionCatalogue::forModule(str_replace('_admin', '', $role)),
    };

    // Canonicalising because effectivePermissions() walks the catalogue, so the
    // order is an artefact of that loop. What matters is the set.
    expect($fresh->effectivePermissions())
        ->toEqualCanonicalizing(array_values(array_unique(array_merge($before, $granted))));

    // And the end state: whatever the row started as, no retired value survives
    // anywhere in the column. Stated as an intersection rather than an equality
    // because each dataset run only creates the one account it is about.
    expect(User::distinct()->pluck('role')->intersect(retiredRoles())->all())->toBe([]);
})->with([
    'catch-all with no list' => ['admin', []],
    // The realistic production shape: the 2026-07 backfill left `admin` accounts
    // 11 capabilities short, resolved by the short-circuit rather than in data.
    'catch-all with a stale list' => ['admin', ['polls.create', 'polls.edit', 'polls.delete']],
    'module role with a partial list' => ['transit_admin', ['transit.review_drafts', 'transit.approve']],
    'superadmin is left alone' => ['superadmin', []],
]);

it('restores the original roles and lists on rollback', function () {
    $admin = User::factory()->create(['role' => 'admin', 'permissions' => ['polls.create']]);
    $staff = User::factory()->create([
        'role' => 'places_admin',
        'permissions' => PermissionCatalogue::forModule('places'),
    ]);

    runRoleNormalisation();

    expect($admin->fresh()->role)->toBe('user')
        ->and($staff->fresh()->role)->toBe('user');

    $migration = require database_path('migrations/2026_09_27_100000_reduce_roles_to_superadmin_and_user.php');
    $migration->down();

    // down() is a restore, not a re-derivation, so the original role and the
    // original list both come back — including the short list the admin had.
    expect($admin->fresh()->role)->toBe('admin')
        ->and($admin->fresh()->permissions)->toBe(['polls.create'])
        ->and($staff->fresh()->role)->toBe('places_admin')
        ->and($staff->fresh()->permissions)->toBe(PermissionCatalogue::forModule('places'));

    Schema::dropIfExists('users_role_normalisation_backup');
});

it('skips rather than re-granting when re-run', function () {
    $admin = User::factory()->create(['role' => 'admin', 'permissions' => []]);

    runRoleNormalisation();
    expect($admin->fresh()->role)->toBe('user');

    // An operator then trims the account down. A re-run must not undo that,
    // which is why the migration skips on an existing backup table instead of
    // throwing the way the phase A backfill does.
    $admin->update(['permissions' => ['polls.create']]);
    runRoleNormalisation();

    expect($admin->fresh()->permissions)->toBe(['polls.create']);
});
