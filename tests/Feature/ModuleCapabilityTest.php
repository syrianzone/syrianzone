<?php

use App\Models\Candidate;
use App\Models\GovApp;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use App\Models\Place;
use App\Models\PlacePhoto;
use App\Models\Poll;
use App\Models\User;

/*
|--------------------------------------------------------------------------
| Per-capability admin enforcement
|--------------------------------------------------------------------------
|
| The behavioural counterpart to ModuleCapabilityRoutesTest. That file asserts
| the route table is tagged correctly; this one proves the tags are actually
| enforced, and that the specific over-grants that motivated the change are
| closed:
|
|   * phonebook.reorder  could DELETE entries and cascade-delete categories
|   * polls.create       could DELETE polls
|   * syofficial.reorder could hard-delete a category and every entity in it
|   * govapps.reorder    could soft-delete apps
|   * places.review      could delete places and photos
|
| Every case below is "holds exactly one harmless-looking capability, attempts
| the destructive action, is refused".
|
*/

/**
 * Phonebook has no factory, and both tables are hard-deleted with string keys,
 * so the fixtures are built here rather than adding two factory classes for one
 * test file.
 */
function pbCategory(array $overrides = []): PhonebookCategory
{
    return PhonebookCategory::create(array_merge([
        'id' => 'cat-'.uniqid(),
        'label_ar' => 'تصنيف',
        'label_en' => 'Category',
        'order_column' => 1,
        'is_active' => true,
    ], $overrides));
}

function pbEntry(string $categoryId, array $overrides = []): PhonebookEntry
{
    return PhonebookEntry::create(array_merge([
        'id' => 'entry-'.uniqid(),
        'category_id' => $categoryId,
        'name_ar' => 'مدخل',
        'number' => '0111111111',
        'is_whatsapp' => false,
        'order_column' => 1,
        'is_active' => true,
    ], $overrides));
}

function capUser(string $capability, ?array $scopes = null): User
{
    return User::factory()->create([
        'role' => 'user',
        'permissions' => [$capability],
        'permission_scopes' => $scopes,
    ]);
}

it('refuses a phonebook.reorder holder from deleting an entry', function () {
    $category = pbCategory();
    $entry = pbEntry($category->id);

    $this->actingAs(capUser('phonebook.reorder'))
        ->deleteJson("/api/v1/admin/phonebook/entries/{$entry->id}")
        ->assertForbidden();

    expect(PhonebookEntry::find($entry->id))->not->toBeNull();
});

it('refuses a phonebook.reorder holder from cascade-deleting a category', function () {
    $category = pbCategory();
    pbEntry($category->id);

    $this->actingAs(capUser('phonebook.reorder'))
        ->deleteJson("/api/v1/admin/phonebook/categories/{$category->id}")
        ->assertForbidden();

    expect(PhonebookCategory::find($category->id))->not->toBeNull();
});

it('still lets a phonebook.reorder holder reorder', function () {
    $category = pbCategory(['order_column' => 1]);
    $second = pbCategory(['order_column' => 2]);

    // Phonebook reorder takes a positional list of ids, not an id/ordinal
    // object list like the SyOfficial one.
    $this->actingAs(capUser('phonebook.reorder'))
        ->postJson('/api/v1/admin/phonebook/reorder/categories', [
            'order' => [$second->id, $category->id],
        ])
        ->assertOk();

    expect($category->fresh()->order_column)->toBe(2);
});

it('refuses a phonebook.edit holder from toggling visibility', function () {
    $entry = pbEntry(pbCategory()->id);

    $this->actingAs(capUser('phonebook.edit'))
        ->postJson("/api/v1/admin/phonebook/entries/{$entry->id}/toggle")
        ->assertForbidden();
});

it('refuses a polls.create holder from deleting a poll', function () {
    $poll = Poll::factory()->create();

    $this->actingAs(capUser('polls.create'))
        ->deleteJson("/api/polls/{$poll->id}")
        ->assertForbidden();

    expect(Poll::find($poll->id))->not->toBeNull();
});

it('refuses a polls.create holder from deleting a candidate', function () {
    $poll = Poll::factory()->create();
    $candidate = Candidate::factory()->create(['poll_id' => $poll->id]);

    $this->actingAs(capUser('polls.create'))
        ->deleteJson("/api/candidates/{$candidate->id}")
        ->assertForbidden();

    expect(Candidate::find($candidate->id))->not->toBeNull();
});

it('refuses a polls.delete holder from creating a poll', function () {
    $this->actingAs(capUser('polls.delete'))
        ->postJson('/api/polls', ['title' => 'New Poll', 'type' => 'single'])
        ->assertForbidden();

    expect(Poll::count())->toBe(0);
});

it('refuses a syofficial.reorder holder from deleting a category and its entities', function () {
    $category = OfficialCategory::factory()->create();
    OfficialEntity::factory()->count(2)->inCategory($category)->create();

    $this->actingAs(capUser('syofficial.reorder'))
        ->deleteJson("/api/v1/admin/syofficial/categories/{$category->id}")
        ->assertForbidden();

    expect(OfficialCategory::find($category->id))->not->toBeNull()
        ->and(OfficialEntity::where('category_id', $category->id)->count())->toBe(2);
});

it('refuses a syofficial.create holder from deleting an entity', function () {
    $entity = OfficialEntity::factory()->create();

    $this->actingAs(capUser('syofficial.create'))
        ->deleteJson("/api/v1/admin/syofficial/entities/{$entity->id}")
        ->assertForbidden();

    expect(OfficialEntity::find($entity->id))->not->toBeNull();
});

it('refuses a govapps.reorder holder from deleting an app', function () {
    $app = GovApp::factory()->create();

    $this->actingAs(capUser('govapps.reorder'))
        ->deleteJson("/api/v1/admin/govapps/{$app->id}")
        ->assertForbidden();

    expect(GovApp::find($app->id))->not->toBeNull();
});

it('refuses a govapps.edit holder from creating an app', function () {
    $this->actingAs(capUser('govapps.edit'))
        ->postJson('/api/v1/admin/govapps/', ['id' => 'new', 'name' => 'N', 'name_ar' => 'ن'])
        ->assertForbidden();

    expect(GovApp::count())->toBe(0);
});

it('refuses a places.review holder from deleting a place', function () {
    $place = Place::factory()->create();

    $this->actingAs(capUser('places.review'))
        ->deleteJson("/api/v1/admin/places/{$place->id}")
        ->assertForbidden();

    expect(Place::find($place->id))->not->toBeNull();
});

it('refuses a places.review holder from moderating photos', function () {
    $place = Place::factory()->create();
    $photo = PlacePhoto::factory()->create(['place_id' => $place->id]);

    $this->actingAs(capUser('places.review'))
        ->deleteJson("/api/v1/admin/place-photos/{$photo->id}")
        ->assertForbidden();

    expect(PlacePhoto::find($photo->id))->not->toBeNull();
});

it('refuses a places.approve holder from editing a place', function () {
    $place = Place::factory()->create(['name' => 'Original']);

    $this->actingAs(capUser('places.approve'))
        ->patchJson("/api/v1/admin/places/{$place->id}", ['name' => 'Renamed'])
        ->assertForbidden();

    expect($place->fresh()->name)->toBe('Original');
});

it('still lets each capability reach its own action', function () {
    $place = Place::factory()->create();

    $this->actingAs(capUser('places.delete'))
        ->deleteJson("/api/v1/admin/places/{$place->id}")
        ->assertNoContent();

    expect(Place::find($place->id))->toBeNull();
});

it('lets a page shell through for any single capability in the module', function () {
    // The `any` tag on a read-only page: module membership is the authorisation.
    $this->actingAs(capUser('phonebook.reorder'))->get('/admin/phonebook')->assertOk();
    $this->actingAs(capUser('places.review'))->get('/admin/places')->assertOk();
    $this->actingAs(capUser('syofficial.reorder'))->get('/admin/syofficial')->assertOk();
    $this->actingAs(capUser('govapps.reorder'))->get('/admin/govapps')->assertOk();
});

it('still refuses the page shell to a user with no capability in the module', function () {
    $this->actingAs(capUser('phonebook.create'))->get('/admin/places')->assertForbidden();
    $this->actingAs(capUser('phonebook.create'))->get('/admin/phonebook')->assertOk();
});

it('keeps the per-module admin role working across the whole module', function () {
    // phonebook_admin implies every phonebook.* capability via
    // User::ROLE_MODULE_PREFIXES, so a role holder must not be affected by the
    // new per-route tags.
    $staff = User::factory()->create(['role' => 'phonebook_admin', 'permissions' => []]);

    $category = pbCategory();
    $entry = pbEntry($category->id);

    $this->actingAs($staff)->get('/admin/phonebook')->assertOk();
    $this->actingAs($staff)
        ->deleteJson("/api/v1/admin/phonebook/entries/{$entry->id}")
        ->assertRedirect();
    $this->actingAs($staff)
        ->deleteJson("/api/v1/admin/phonebook/categories/{$category->id}")
        ->assertRedirect();
});

it('keeps the general admin role and superadmin unaffected', function () {
    $category = OfficialCategory::factory()->create();

    $this->actingAs(User::factory()->create(['role' => 'admin']))
        ->deleteJson("/api/v1/admin/syofficial/categories/{$category->id}")
        ->assertRedirect();

    $second = OfficialCategory::factory()->create();
    $this->actingAs(User::factory()->create(['role' => 'superadmin']))
        ->deleteJson("/api/v1/admin/syofficial/categories/{$second->id}")
        ->assertRedirect();
});

it('sends an unauthenticated api caller to json 401 rather than a login redirect', function () {
    // Improved over the old PlacesAdmin/PhonebookAdmin behaviour, which
    // redirected guests even for /api requests.
    $this->postJson('/api/v1/admin/phonebook/entries', [])->assertUnauthorized();
});

it('redirects an unauthenticated page visitor to login', function () {
    $this->get('/admin/phonebook')->assertRedirect(route('login'));
});
