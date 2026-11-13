<?php

/*
|--------------------------------------------------------------------------
| Arabic validation messages
|--------------------------------------------------------------------------
|
| The app's locale is `ar`, and lang/ar/validation.php is the only catalogue of
| framework messages, so a rule with no hand-written message must still read in
| Arabic. The directory dialogs post through `$request->validate()` without a
| message map, which is the path that printed a raw `validation.required` key.
|
*/

it('refuses an empty category form with Arabic messages', function () {
    $admin = capabilityUser('syofficial.create');

    $response = $this->actingAs($admin)
        ->post('/api/v1/admin/syofficial/categories', []);

    $response->assertRedirect()
        ->assertSessionHasErrors(['id', 'label_ar', 'label_en']);

    $errors = session('errors');

    expect([
        $errors->first('id'),
        $errors->first('label_ar'),
        $errors->first('label_en'),
    ])->toBe([
        'حقل المعرّف مطلوب.',
        'حقل الاسم بالعربية مطلوب.',
        'حقل الاسم بالإنجليزية مطلوب.',
    ]);
});
