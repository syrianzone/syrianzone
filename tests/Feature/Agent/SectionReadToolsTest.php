<?php

use App\Mcp\Tools\Compass\ListCompassFiguresTool;
use App\Mcp\Tools\Compass\ListCompassPersonasTool;
use App\Mcp\Tools\GuessWho\ListGuessWhoCategoriesTool;
use App\Mcp\Tools\GuessWho\ListGuessWhoCharactersTool;
use App\Mcp\Tools\Phonebook\ListPhonebookCategoriesTool;
use App\Mcp\Tools\Phonebook\ListPhonebookEntriesTool;
use App\Mcp\Tools\Places\ListPlaceReportsTool;
use App\Mcp\Tools\Polls\ListPollsTool;
use App\Mcp\Tools\Suggestions\ListDirectorySuggestionsTool;
use App\Models\CompassFigure;
use App\Models\CompassPersona;
use App\Models\DirectorySuggestion;
use App\Models\GuessWhoCategory;
use App\Models\GuessWhoCharacter;
use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use App\Models\Place;
use App\Models\PlaceReport;
use App\Models\Poll;
use App\Models\User;
use App\Support\Agents\TokenIssuer;

test('list-place-reports lists open reports for places.review tokens and refuses others', function () {
    $contributor = User::factory()->create();
    $place = Place::factory()->approved()->create(['name' => 'مقهى قديم']);
    PlaceReport::create([
        'place_id' => $place->id,
        'user_id' => $contributor->id,
        'reason' => 'wrong_info',
        'details' => 'العنوان مختلف',
        'status' => 'open',
    ]);
    PlaceReport::create([
        'place_id' => $place->id,
        'user_id' => User::factory()->create()->id,
        'reason' => 'spam',
        'details' => 'بلاغ قديم',
        'status' => 'dismissed',
    ]);

    $reviewer = agentUser(['permissions' => ['places.review']]);
    agentToken($reviewer, ['places.review']);

    $open = toolPayload(callTool(ListPlaceReportsTool::class));
    expect($open['status'])->toBe('open')
        ->and($open['total'])->toBe(1)
        ->and($open['reports'][0]['reason'])->toBe('wrong_info')
        ->and($open['reports'][0]['place']['name'])->toBe('مقهى قديم');

    $all = toolPayload(callTool(ListPlaceReportsTool::class, ['status' => 'all']));
    expect($all['total'])->toBe(2);

    // A token without places.review is denied
    $other = agentUser(['permissions' => ['govapps.edit']]);
    agentToken($other, ['govapps.edit']);
    expect(callTool(ListPlaceReportsTool::class)->isError())->toBeTrue();
});

test('list-directory-suggestions scopes results to the modules permitted by the token', function () {
    $submitter = User::factory()->create(['name' => 'سارة']);

    DirectorySuggestion::create([
        'module' => 'govtcvs',
        'kind' => 'edit',
        'title' => 'تحديث مصدر وزير',
        'details' => 'رابط رسمي جديد',
        'user_id' => $submitter->id,
        'status' => 'pending',
    ]);
    DirectorySuggestion::create([
        'module' => 'syofficial',
        'kind' => 'add',
        'title' => 'حساب وزارة جديد',
        'details' => 'الحساب الموثق على تيليغرام',
        'user_id' => $submitter->id,
        'status' => 'pending',
    ]);
    DirectorySuggestion::create([
        'module' => 'phonebook',
        'kind' => 'add',
        'title' => 'رقم طوارئ',
        'details' => 'رقم خدمي',
        'user_id' => $submitter->id,
        'status' => 'dismissed',
    ]);

    // Token with only syofficial.edit sees only syofficial and is refused govtcvs
    $syUser = agentUser(['permissions' => ['syofficial.edit', 'govtcvs.edit']]);
    agentToken($syUser, ['syofficial.edit']);

    $scoped = toolPayload(callTool(ListDirectorySuggestionsTool::class));
    expect($scoped['modules'])->toBe(['syofficial'])
        ->and($scoped['count'])->toBe(1)
        ->and($scoped['suggestions'][0]['module'])->toBe('syofficial');

    $denied = callTool(ListDirectorySuggestionsTool::class, ['module' => 'govtcvs']);
    expect($denied->isError())->toBeTrue()
        ->and(toolText($denied))->toContain('Permission denied');

    // Token with govtcvs.view + syofficial.edit + phonebook.edit sees all three modules
    $broad = agentUser(['permissions' => ['govtcvs.view', 'syofficial.edit', 'phonebook.edit']]);
    agentToken($broad, ['govtcvs.view', 'syofficial.edit', 'phonebook.edit']);

    $pending = toolPayload(callTool(ListDirectorySuggestionsTool::class));
    expect($pending['modules'])->toBe(['govtcvs', 'syofficial', 'phonebook'])
        ->and($pending['count'])->toBe(2)
        ->and($pending['counts']['pending'])->toBe(2)
        ->and($pending['counts']['dismissed'])->toBe(1);

    $all = toolPayload(callTool(ListDirectorySuggestionsTool::class, ['status' => 'all']));
    expect($all['count'])->toBe(3);
});

test('phonebook read tools list categories and entries for phonebook tokens', function () {
    PhonebookCategory::create([
        'id' => 'emergency',
        'label_ar' => 'الطوارئ',
        'label_en' => 'Emergency',
        'order_column' => 1,
        'is_active' => true,
    ]);
    PhonebookCategory::create([
        'id' => 'hidden',
        'label_ar' => 'مخفي',
        'label_en' => 'Hidden',
        'order_column' => 2,
        'is_active' => false,
    ]);
    PhonebookEntry::create([
        'id' => 'police-112',
        'category_id' => 'emergency',
        'name_ar' => 'الشرطة',
        'number' => '112',
        'is_whatsapp' => false,
        'order_column' => 1,
        'is_active' => true,
    ]);
    PhonebookEntry::create([
        'id' => 'inactive-entry',
        'category_id' => 'hidden',
        'name_ar' => 'قديم',
        'number' => '999',
        'is_whatsapp' => true,
        'order_column' => 1,
        'is_active' => false,
    ]);

    $staff = agentUser(['permissions' => ['phonebook.edit']]);
    agentToken($staff, ['phonebook.edit']);

    $cats = toolPayload(callTool(ListPhonebookCategoriesTool::class, ['only_active' => true]));
    expect($cats['count'])->toBe(1)
        ->and($cats['categories'][0]['id'])->toBe('emergency');

    $entries = toolPayload(callTool(ListPhonebookEntriesTool::class, ['category_id' => 'emergency']));
    expect($entries['count'])->toBe(1)
        ->and($entries['entries'][0]['number'])->toBe('112');
});

test('list-polls reads polls for polls tokens and enforces permission ceiling', function () {
    Poll::factory()->create(['slug' => 'active-poll', 'title' => 'استبيان نشط', 'is_active' => true]);
    Poll::factory()->create(['slug' => 'inactive-poll', 'title' => 'استبيان معطل', 'is_active' => false]);

    $staff = agentUser(['permissions' => ['polls.edit']]);
    agentToken($staff, ['polls.edit']);

    expect(toolPayload(callTool(ListPollsTool::class))['count'])->toBe(2)
        ->and(toolPayload(callTool(ListPollsTool::class, ['only_active' => true]))['count'])->toBe(1);

    $other = agentUser(['permissions' => ['places.review']]);
    agentToken($other, ['places.review']);
    expect(callTool(ListPollsTool::class)->isError())->toBeTrue();
});

test('compass read tools list figures and personas with granular capabilities', function () {
    CompassFigure::create([
        'name' => 'شخصية مفعّلة',
        'category' => 'current',
        'align' => 'neutral',
        'positions' => ['econ' => 0.2],
        'enabled' => true,
        'sort_order' => 1,
    ]);
    CompassFigure::create([
        'name' => 'شخصية معطّلة',
        'category' => 'founder',
        'align' => 'neutral',
        'positions' => ['econ' => -0.1],
        'enabled' => false,
        'sort_order' => 2,
    ]);
    CompassPersona::create([
        'slug' => 'reformist',
        'name' => 'إصلاحي',
        'icon' => 'Scale',
        'short' => 'وصف مختصر',
        'stances' => [],
        'center' => ['econ' => 0.1],
        'ranges' => [],
        'enabled' => true,
        'sort_order' => 1,
    ]);

    $figUser = agentUser(['permissions' => ['compass.figures']]);
    agentToken($figUser, ['compass.figures']);

    expect(toolPayload(callTool(ListCompassFiguresTool::class, ['only_enabled' => true]))['count'])->toBe(1)
        ->and(callTool(ListCompassPersonasTool::class)->isError())->toBeTrue();

    $personaUser = agentUser(['permissions' => ['compass.personas']]);
    agentToken($personaUser, ['compass.personas']);

    $personasPayload = toolPayload(callTool(ListCompassPersonasTool::class));
    expect($personasPayload['count'])->toBe(CompassPersona::count())
        ->and(collect($personasPayload['personas'])->pluck('slug'))->toContain('reformist')
        ->and(callTool(ListCompassFiguresTool::class)->isError())->toBeTrue();
});

test('guesswho read tools list categories and characters for guesswho.manage tokens', function () {
    $cat = GuessWhoCategory::create([
        'name_ar' => 'شخصيات سورية',
        'name_en' => 'Syrian Figures',
        'slug' => 'syrian-figures',
        'is_active' => true,
    ]);
    GuessWhoCharacter::create([
        'category_id' => $cat->id,
        'name_ar' => 'شخصية 1',
        'name_en' => 'Char 1',
        'image_path' => '/images/guesswho/char-1.webp',
        'is_active' => true,
    ]);

    $staff = agentUser(['permissions' => ['guesswho.manage']]);
    agentToken($staff, ['guesswho.manage']);

    $cats = toolPayload(callTool(ListGuessWhoCategoriesTool::class));
    $chars = toolPayload(callTool(ListGuessWhoCharactersTool::class, ['category_id' => $cat->id]));

    expect($cats['count'])->toBe(1)
        ->and($cats['categories'][0]['characters_count'])->toBe(1)
        ->and($chars['count'])->toBe(1)
        ->and($chars['characters'][0]['name_ar'])->toBe('شخصية 1');
});

test('new read tools are advertised only when the token holds the matching capability', function () {
    $phonebookUser = User::factory()->create(['role' => 'user', 'permissions' => ['phonebook.edit']]);
    $phonebookToken = app(TokenIssuer::class)->issue($phonebookUser, 'pb', ['phonebook.edit'])['token']->plainTextToken;

    $pbTools = mcpToolNames($phonebookToken);
    expect($pbTools)->toContain('list-phonebook-categories', 'list-phonebook-entries', 'list-directory-suggestions')
        ->and($pbTools)->not->toContain(
            'list-place-reports',
            'list-polls',
            'list-compass-figures',
            'list-compass-personas',
            'list-guesswho-categories',
            'list-guesswho-characters',
        );
});
