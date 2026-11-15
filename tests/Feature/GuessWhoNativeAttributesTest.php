<?php

use App\Models\GuessWhoCategory;
use App\Models\GuessWhoCharacter;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    $owner = User::factory()->create(['role' => 'user', 'permissions' => ['guesswho.manage']]);
    $this->withHeader('Authorization', 'Bearer '.$owner->createToken('Native', ['mobile'])->plainTextToken);
    $this->category = GuessWhoCategory::create(['name_ar' => 'اختبار', 'name_en' => 'Test', 'slug' => 'local-test', 'is_active' => true]);
    $this->character = GuessWhoCharacter::create([
        'category_id' => $this->category->id, 'name_ar' => 'شخصية', 'name_en' => 'Character',
        'image_path' => 'old.png', 'attributes' => ['hair' => 'black'], 'is_active' => true,
    ]);
});

test('native multipart replacement can clear character attributes without retaining stale values', function () {
    $this->withHeader('Accept', 'application/json')->post('/api/v1/admin/guesswho/characters/'.$this->character->id, [
        'category_id' => $this->category->id, 'name_ar' => 'شخصية', 'name_en' => 'Character',
        'image_file' => UploadedFile::fake()->image('replacement.png'), 'attributes_json' => '[]',
    ])->assertOk()->assertJsonPath('success', true);

    $updated = $this->character->fresh();
    expect($updated->attributes)->toBe([])->and($updated->image_path)->not->toBe('old.png');
    Storage::disk('public')->assertExists($updated->image_path);
});

test('native multipart creation retains named attributes from a JSON object', function () {
    $this->withHeader('Accept', 'application/json')->post('/api/v1/admin/guesswho/characters', [
        'category_id' => $this->category->id, 'name_ar' => 'جديد', 'name_en' => 'New',
        'image_file' => UploadedFile::fake()->image('new.png'), 'attributes_json' => '{"hair":"brown","glasses":"yes"}',
    ])->assertOk()->assertJsonPath('success', true);

    expect(GuessWhoCharacter::where('name_en', 'New')->firstOrFail()->attributes)->toBe(['hair' => 'brown', 'glasses' => 'yes']);
});

test('malformed or excessive native attribute JSON never mutates the character', function (mixed $attributes) {
    $this->withHeader('Accept', 'application/json')->post('/api/v1/admin/guesswho/characters/'.$this->character->id, [
        'category_id' => $this->category->id, 'name_ar' => 'تغيير مرفوض', 'name_en' => 'Rejected',
        'attributes_json' => $attributes,
    ])->assertUnprocessable()->assertJsonValidationErrors('attributes');

    expect($this->character->fresh()->attributes)->toBe(['hair' => 'black'])
        ->and($this->character->fresh()->name_en)->toBe('Character');
})->with([
    'broken JSON' => ['{'], 'scalar' => ['"value"'], 'null' => ['null'], 'not a string' => [['hair' => 'brown']],
    'too large' => ['{"long":"'.str_repeat('a', 65537).'"}'], 'too deep' => [str_repeat('[', 33).'0'.str_repeat(']', 33)],
]);

test('native edits reject ambiguous attribute representations', function () {
    $this->withHeader('Accept', 'application/json')->post('/api/v1/admin/guesswho/characters/'.$this->character->id, [
        'category_id' => $this->category->id, 'name_ar' => 'شخصية', 'name_en' => 'Character',
        'attributes_json' => '[]', 'attributes' => ['hair' => 'brown'],
    ])->assertUnprocessable()->assertJsonValidationErrors('attributes');
    expect($this->character->fresh()->attributes)->toBe(['hair' => 'black']);
});

test('legacy Inertia edits keep their existing attributes and redirect contract', function () {
    $this->withHeader('X-Inertia', 'true')->withHeader('Accept', 'application/json')
        ->post('/api/v1/admin/guesswho/characters/'.$this->character->id, [
            'category_id' => $this->category->id, 'name_ar' => 'شخصية', 'name_en' => 'Character',
            'attributes_json' => '[]',
        ])->assertRedirect();
    expect($this->character->fresh()->attributes)->toBe(['hair' => 'black']);
});
