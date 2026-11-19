<?php

declare(strict_types=1);

use App\Models\Board;
use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\GovApp;
use App\Models\GuessWhoCategory;
use App\Models\GuessWhoCharacter;
use App\Models\GuessWhoGame;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use App\Models\Place;
use App\Models\Poll;
use App\Models\User;
use App\Services\PlaceImageService;
use App\Services\Places\PlaceRules;
use App\Support\Agents\TokenAbilities;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;

$app = require __DIR__.'/bootstrap.php';
$runtime = $app->basePath('ios-app/.expo/local-fixture');
Artisan::call('migrate:fresh', ['--force' => true]);
require_once __DIR__.'/user-admin-city.php';
nativeFixtureEnsureUserAdminCity();
require_once __DIR__.'/promise-speaker.php';
$promiseSpeaker = nativeFixtureEnsurePromiseSpeaker();
require_once __DIR__.'/atlas-baseline.php';
$atlas = nativeFixtureEnsureAtlas();

$users = [];
foreach ([
    'member' => ['id' => 101, 'name' => 'مستخدم اختبار محلي', 'role' => 'user', 'permissions' => []],
    'other' => ['id' => 102, 'name' => 'مستخدم اختبار ثان', 'role' => 'user', 'permissions' => []],
    'admin' => ['id' => 103, 'name' => 'مدير اختبار محلي', 'role' => 'superadmin', 'permissions' => []],
    'banned' => ['id' => 104, 'name' => 'حساب اختبار محظور', 'role' => 'user', 'permissions' => [], 'is_banned' => true],
] as $key => $attributes) {
    $user = User::factory()->create($attributes + [
        'email' => $key.'@native-fixture.invalid', 'password' => bin2hex(random_bytes(32)),
        'google_id' => null, 'avatar_url' => null,
    ]);
    $users[$key] = ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'token' => $user->createToken('isolated-native-test', [TokenAbilities::MOBILE])->plainTextToken];
}
require_once __DIR__.'/avatar-user.php';
$avatar = nativeFixtureEnsureAvatarUser(null);
$users['avatar'] = ['id' => 105, 'name' => $avatar->name, 'email' => $avatar->email, 'token' => $avatar->createToken('isolated-native-test', [TokenAbilities::MOBILE])->plainTextToken];

$sourceImage = $app->publicPath('og/mishwar.png');
foreach ([201 => 'approved', 202 => 'pending', 203 => 'rejected'] as $id => $status) {
    $place = Place::factory()->create([
        'id' => $id, 'user_id' => 101, 'name' => 'مكان اختبار محلي '.$id,
        'description' => 'مكان تجريبي محلي لا يمثل بيانات حقيقية ولا ينشر خارج جهاز الاختبار.',
        'category' => PlaceRules::categories()[0], 'lat' => 33.5138, 'lng' => 36.2765,
        'status' => $status, 'approved_at' => $status === 'approved' ? now() : null,
        'rejection_reason' => $status === 'rejected' ? 'رفض تجريبي لإعادة الإرسال' : null,
    ]);
    app(PlaceImageService::class)->store(new UploadedFile($sourceImage, 'fixture-place.png', 'image/png', null, true), $place->id, 0);
}

OfficialCategory::create(['id' => 'local-official', 'label_ar' => 'فئة رسمية تجريبية', 'label_en' => 'Local test category', 'icon' => 'building', 'order_column' => 1, 'is_active' => true]);
OfficialEntity::create(['id' => 'local-official-entry', 'category_id' => 'local-official', 'name' => 'Local test entity', 'name_ar' => 'جهة اختبار محلية', 'description' => 'Isolated fixture', 'description_ar' => 'بيانات اختبار محلية فقط', 'image' => '/og/syofficial.png', 'socials' => [], 'order_column' => 1, 'is_active' => true]);
PhonebookCategory::create(['id' => 'local-phonebook', 'label_ar' => 'فئة أرقام تجريبية', 'label_en' => 'Local test numbers', 'icon' => 'phone', 'order_column' => 1, 'is_active' => true]);
PhonebookEntry::create(['id' => 'local-phonebook-entry', 'category_id' => 'local-phonebook', 'name_ar' => 'رقم اختبار محلي', 'name_en' => 'Local test number', 'number' => '+1 202 555 0100', 'is_whatsapp' => false, 'source_url' => 'https://example.invalid/local-test', 'order_column' => 1, 'is_active' => true]);
GovApp::create(['id' => 'local-govapp', 'name' => 'Local fixture app', 'name_ar' => 'تطبيق اختبار محلي', 'description' => 'Isolated test application', 'description_ar' => 'تطبيق تجريبي محلي فقط', 'icon' => '/og/govapps.png', 'images' => [], 'links' => [], 'order_column' => 1, 'is_active' => true]);

$poll = Poll::factory()->create(['id' => '10000000-0000-4000-8000-000000000001', 'slug' => Poll::coreSlug(), 'title' => 'تصويت اختبار محلي', 'timezone' => Poll::defaultTimezone(), 'is_active' => true, 'user_id' => 103]);
$group = CandidateGroup::create(['id' => '10000000-0000-4000-8000-000000000002', 'poll_id' => $poll->id, 'name' => 'مرشحون تجريبيون', 'key' => 'minister', 'sort_order' => 1, 'is_default' => true, 'is_active' => true]);
$candidates = [];
foreach (range(1, 4) as $index) {
    $candidate = Candidate::factory()->create(['id' => sprintf('20000000-0000-4000-8000-%012d', $index), 'poll_id' => $poll->id, 'candidate_group_id' => $group->id, 'name' => 'مرشح اختبار '.$index, 'title' => 'شخصية خيالية للاختبار', 'category' => 'minister', 'image_url' => '/placeholder-user.jpg', 'sort' => $index, 'status' => 'active']);
    $candidates[] = $candidate->id;
}

$category = GuessWhoCategory::create(['id' => 301, 'name_ar' => 'شخصيات اختبار محلية', 'name_en' => 'Local fixture characters', 'slug' => 'local-characters', 'is_active' => true]);
Storage::disk('public')->put('guesswho/fixture.jpg', file_get_contents($app->publicPath('placeholder-user.jpg')));
$characters = [];
foreach (range(1, 24) as $index) {
    $character = GuessWhoCharacter::create(['id' => 400 + $index, 'category_id' => $category->id, 'name_ar' => 'شخصية اختبار '.$index, 'name_en' => 'Test character '.$index, 'image_path' => 'guesswho/fixture.jpg', 'attributes' => ['glasses' => $index % 2 === 0, 'hat' => $index % 3 === 0], 'is_active' => true]);
    $characters[] = $character->id;
}
$room = GuessWhoGame::create(['room_code' => '30000000-0000-4000-8000-000000000001', 'category_id' => $category->id, 'character_ids' => $characters, 'player_1_session' => 'local-player-a', 'player_2_session' => 'local-player-b', 'status' => 'selecting']);

$document = ['v' => 1, 'activeId' => 'local-board', 'updatedAt' => now()->toIso8601String(), 'dashboards' => [['id' => 'local-board', 'name' => 'لوحة اختبار محلية', 'widgets' => [['i' => 'local-notes', 'd' => 'notes', 'w' => 4, 'h' => 3, 'c' => ['text' => 'ملاحظة تجريبية محفوظة على الخادم المحلي']]]]]];
Board::create(['user_id' => 101, 'version' => 1, 'document' => $document]);

$fixture = [
    'origin' => 'https://127.0.0.1:9443',
    'caPath' => $runtime.'/tls/ca.pem',
    'databasePath' => $runtime.'/database.sqlite',
    'users' => $users,
    'places' => ['approved' => 201, 'pending' => 202, 'rejected' => 203],
    'poll' => ['id' => $poll->id, 'slug' => $poll->slug, 'candidateIds' => $candidates],
    'guessWho' => ['categoryId' => $category->id, 'roomCode' => $room->room_code, 'playerA' => 'local-player-a', 'playerB' => 'local-player-b', 'characterIds' => $characters],
    'directories' => ['officialCategory' => 'local-official', 'officialEntry' => 'local-official-entry', 'phonebookCategory' => 'local-phonebook', 'phonebookEntry' => 'local-phonebook-entry', 'govApp' => 'local-govapp'],
    'promises' => ['speakerId' => $promiseSpeaker->id, 'speakerName' => $promiseSpeaker->name, 'speakerRef' => $promiseSpeaker->ref()],
    'atlas' => ['populationSourceId' => $atlas['populationSourceId'], 'synthetic' => true],
];
file_put_contents($runtime.'/fixture.json', json_encode($fixture, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n");
chmod($runtime.'/fixture.json', 0600);
echo "Isolated SQLite fixture seeded. Token configuration was written with mode 0600.\n";
