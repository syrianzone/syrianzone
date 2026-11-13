<?php

use Illuminate\Support\Facades\File;

afterEach(fn () => File::delete(storage_path('framework/draining')));

test('the healthcheck answers 200 while the container serves', function () {
    $this->get('/healthcheck')->assertOk()->assertSeeText('OK');
});

test('a draining container fails its healthcheck so the proxy moves traffic away', function () {
    File::put(storage_path('framework/draining'), '');

    $this->get('/healthcheck')->assertStatus(503)->assertSeeText('draining');
});
