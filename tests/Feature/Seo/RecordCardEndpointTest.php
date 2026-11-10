<?php

use App\Models\Promise;
use App\Models\PromiseSpeaker;
use App\Support\Seo\Og\CardImages;
use App\Support\Seo\Og\CardRenderer;
use App\Support\Seo\Og\CardRenderFailed;
use App\Support\Seo\Og\DrawnCard;
use App\Support\Seo\Og\NodeCardRenderer;
use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\Preview\Previews;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    // Drawn cards land under storage/app/og; keep each test's files to itself.
    $this->storage = sys_get_temp_dir().'/og-test-'.bin2hex(random_bytes(6));
    File::ensureDirectoryExists($this->storage.'/app');
    $this->app->useStoragePath($this->storage);
});

afterEach(function () {
    File::deleteDirectory($this->storage);
});

/** A renderer that returns fixed bytes and counts how often it is asked. */
function fakeCardRenderer(?Throwable $failure = null): object
{
    $renderer = new class($failure) implements CardRenderer
    {
        public int $calls = 0;

        public array $models = [];

        /** Set to false to draw as if a photograph could not be loaded. */
        public bool $photosLoad = true;

        public function __construct(private ?Throwable $failure) {}

        public function render(array $model, string $format = 'png'): DrawnCard
        {
            $this->calls++;
            $this->models[] = $model;
            if ($this->failure) {
                throw $this->failure;
            }

            return new DrawnCard("\x89PNG drawn card #".$this->calls, $this->photosLoad);
        }
    };

    app()->instance(CardRenderer::class, $renderer);

    return $renderer;
}

function jpegBytes(int $width, int $height): string
{
    $image = imagecreatetruecolor($width, $height);
    imagefill($image, 0, 0, imagecolorallocate($image, 40, 120, 90));
    ob_start();
    imagejpeg($image, null, 90);

    return (string) ob_get_clean();
}

test('a record card is drawn once, stored, and cacheable forever at its versioned address', function () {
    $renderer = fakeCardRenderer();
    $promise = Promise::factory()->published()->create();
    $card = Previews::cardSource('promise')->card((string) $promise->number);

    $first = $this->get($card->url())->assertOk();

    expect($first->headers->get('Content-Type'))->toBe('image/png')
        ->and($first->headers->get('Cache-Control'))->toContain('max-age=31536000')->toContain('immutable')
        ->and(file_get_contents($first->baseResponse->getFile()->getPathname()))->toBe("\x89PNG drawn card #1")
        ->and($renderer->models[0]['title'])->toBe($promise->title);

    $this->get($card->url())->assertOk();

    expect($renderer->calls)->toBe(1);
});

test('a card response carries no cookie, so the edge can cache it', function () {
    fakeCardRenderer();
    $promise = Promise::factory()->published()->create();

    $response = $this->get(Previews::cardSource('promise')->card((string) $promise->number)->url())->assertOk();

    expect($response->headers->getCookies())->toBe([]);
});

test('an out-of-date or missing version is served the current card with a short cache', function () {
    fakeCardRenderer();
    $promise = Promise::factory()->published()->create();
    $path = '/og/r/promise/'.$promise->number.'.png';

    foreach ([$path, $path.'?v=0000000000'] as $url) {
        $cacheControl = $this->get($url)->assertOk()->headers->get('Cache-Control');
        expect($cacheControl)->toContain('max-age=300')->not->toContain('immutable');
    }
});

test('editing a record draws a new version; the old file goes once nothing can still be reading it', function () {
    $renderer = fakeCardRenderer();
    $promise = Promise::factory()->published()->create(['title' => 'العنوان الأول']);
    $source = Previews::cardSource('promise');
    $names = fn () => collect(File::files($this->storage.'/app/og/promise'))->map->getFilename()->sort()->values()->all();

    $first = $source->card((string) $promise->number);
    $this->get($first->url())->assertOk();

    $promise->update(['title' => 'العنوان بعد التعديل']);
    $second = $source->card((string) $promise->number);
    $this->get($second->url())->assertOk();

    // A request that found the first file a moment ago may still be about to
    // open it, so it survives the redraw.
    expect($second->version())->not->toBe($first->version())
        ->and($renderer->calls)->toBe(2)
        ->and($names())->toBe(collect([$first, $second])->map(fn ($card) => $promise->number.'@'.$card->version().'.png')->sort()->values()->all());

    // Files replaced more than the grace period ago are removed by the next drawing.
    foreach (File::files($this->storage.'/app/og/promise') as $file) {
        touch($file->getPathname(), time() - 3600);
    }
    $promise->update(['title' => 'العنوان الثالث']);
    $third = $source->card((string) $promise->number);
    $this->get($third->url())->assertOk();

    expect($names())->toBe([$promise->number.'@'.$third->version().'.png']);
});

test('a card drawn without its photograph is served briefly, then drawn again', function () {
    $renderer = fakeCardRenderer();
    $renderer->photosLoad = false;
    $promise = Promise::factory()->published()->create();
    $card = Previews::cardSource('promise')->card((string) $promise->number);

    // The media host is down: the card is usable, but must not be cached as final.
    $response = $this->get($card->url())->assertOk();
    expect($response->headers->get('Cache-Control'))->toContain('max-age=300')->not->toContain('immutable')
        ->and(File::exists($this->storage.'/app/og/promise/'.$promise->number.'@'.$card->version().'.partial.png'))->toBeTrue()
        ->and(File::exists($this->storage.'/app/og/promise/'.$promise->number.'@'.$card->version().'.png'))->toBeFalse();

    // Within the retry window the same drawing is reused, not redrawn per request.
    $this->get($card->url())->assertOk();
    expect($renderer->calls)->toBe(1);

    // After it, with the host back, the card is drawn again and becomes final.
    $this->travel(11)->minutes();
    $renderer->photosLoad = true;
    $response = $this->get($card->url())->assertOk();

    expect($renderer->calls)->toBe(2)
        ->and($response->headers->get('Cache-Control'))->toContain('immutable')
        ->and(file_get_contents($response->baseResponse->getFile()->getPathname()))->toBe("\x89PNG drawn card #2");
});

test('when drawing fails the section card is served briefly and nothing is stored', function () {
    fakeCardRenderer(new CardRenderFailed('node is not installed'));
    $promise = Promise::factory()->published()->create();

    $response = $this->get(Previews::cardSource('promise')->card((string) $promise->number)->url())->assertOk();

    expect($response->baseResponse->getFile()->getPathname())->toBe(StaticCards::file('promises'))
        ->and($response->headers->get('Cache-Control'))->toContain('max-age=30')->not->toContain('immutable')
        ->and(File::isDirectory($this->storage.'/app/og'))->toBeFalse();
});

test('an unknown, unpublished or mistyped record gets the section card and is never drawn', function () {
    $renderer = fakeCardRenderer();
    $draft = Promise::factory()->create(['number' => 55]);

    foreach (['/og/r/promise/55.png', '/og/r/promise/999999.png', '/og/r/promise/55.jpg', '/og/r/poll/no-such-poll.png'] as $url) {
        $response = $this->get($url)->assertOk();
        expect($response->headers->get('Content-Type'))->toBe('image/png')
            ->and($response->headers->get('Cache-Control'))->toContain('max-age=300');
    }

    expect($renderer->calls)->toBe(0);

    $this->get('/og/r/nonsense/1.png')->assertNotFound();
    $this->get('/og/r/promise/1.gif')->assertNotFound();
    $this->get('/og/r/promise/..%2F..%2Fsecret.png')->assertNotFound();
});

test('photos are fetched only from allowed hosts and inlined as small jpegs', function () {
    config()->set('filesystems.disks.r2.url', 'https://media.example.test');
    Http::fake([
        'media.example.test/portrait.jpg' => Http::response(jpegBytes(900, 600), 200, ['Content-Type' => 'image/jpeg']),
        'media.example.test/huge.jpg' => Http::response(jpegBytes(6000, 5000), 200),
        'media.example.test/not-an-image' => Http::response('<html>hello</html>', 200),
        'media.example.test/missing.jpg' => Http::response('', 404),
    ]);

    $images = app(CardImages::class);
    $embed = fn (string $url) => $images->embed(['title' => 't', 'person' => ['name' => 'n', 'image' => $url]])[0];

    $inlined = $embed('https://media.example.test/portrait.jpg')['person']['image'];
    [$width, $height, $type] = getimagesizefromstring(base64_decode(substr($inlined, strlen('data:image/jpeg;base64,'))));

    expect($inlined)->toStartWith('data:image/jpeg;base64,')
        ->and([$width, $height, $type])->toBe([256, 256, IMAGETYPE_JPEG])
        // too many pixels to decode safely, not an image, not found
        ->and($embed('https://media.example.test/huge.jpg')['person'])->toBe(['name' => 'n'])
        ->and($embed('https://media.example.test/not-an-image')['person'])->toBe(['name' => 'n'])
        ->and($embed('https://media.example.test/missing.jpg')['person'])->toBe(['name' => 'n'])
        // any other host, plain http, and paths outside the public directory are never read
        ->and($embed('https://attacker.example.net/portrait.jpg')['person'])->toBe(['name' => 'n'])
        ->and($embed('http://media.example.test/portrait.jpg')['person'])->toBe(['name' => 'n'])
        ->and($embed('/../.env')['person'])->toBe(['name' => 'n'])
        ->and($embed('//attacker.example.net/portrait.jpg')['person'])->toBe(['name' => 'n']);

    Http::assertNotSent(fn ($request) => str_contains($request->url(), 'attacker.example.net'));
});

test('a place photograph is scaled to cover the whole card', function () {
    config()->set('filesystems.disks.r2.url', 'https://media.example.test');
    Http::fake(['media.example.test/*' => Http::response(jpegBytes(1200, 1600), 200)]);

    [$model, $complete] = app(CardImages::class)->embed(['kind' => 'photo', 'photo' => 'https://media.example.test/place.jpg']);
    $photo = $model['photo'];

    expect($complete)->toBeTrue();

    expect(array_slice(getimagesizefromstring(base64_decode(substr($photo, strlen('data:image/jpeg;base64,')))), 0, 2))->toBe([1200, 630]);
});

test('a photo that cannot be loaded marks the drawing as incomplete; a card with none is complete', function () {
    Http::fake(['*' => Http::response('', 503)]);
    config()->set('filesystems.disks.r2.url', 'https://media.example.test');
    $images = app(CardImages::class);

    expect($images->embed(['title' => 't', 'person' => ['name' => 'n', 'image' => 'https://media.example.test/a.jpg']])[1])->toBeFalse()
        ->and($images->embed(['title' => 't', 'person' => ['name' => 'n']])[1])->toBeTrue()
        ->and($images->embed(['title' => 't'])[1])->toBeTrue();
});

test('an uploaded photo under /storage is read from the public disk', function () {
    Storage::fake('public');
    Storage::disk('public')->put('promises/speakers/a.jpg', jpegBytes(300, 300));
    Storage::disk('public')->put('notes.txt', 'not an image');
    $embed = fn (string $path) => app(CardImages::class)->embed(['title' => 't', 'person' => ['name' => 'n', 'image' => $path]]);

    [$model, $complete] = $embed('/storage/promises/speakers/a.jpg?v=3');

    expect($complete)->toBeTrue()
        ->and($model['person']['image'])->toStartWith('data:image/jpeg;base64,')
        // not an image, missing, and attempts to climb out of the disk
        ->and($embed('/storage/notes.txt')[1])->toBeFalse()
        ->and($embed('/storage/missing.jpg')[1])->toBeFalse()
        ->and($embed('/storage/../../.env')[1])->toBeFalse()
        ->and($embed('/storage/promises/../../../../composer.json')[1])->toBeFalse();
});

test('the real renderer draws a promise card with the speaker photo, as png and as jpeg', function () {
    if (Process::run(['node', '--version'])->failed() || ! is_dir(base_path('node_modules/@resvg/resvg-wasm'))) {
        $this->markTestSkipped('Node and the card renderer are not installed.');
    }

    config()->set('filesystems.disks.r2.url', 'https://media.example.test');
    Http::fake([
        'media.example.test/down/*' => Http::response('', 503),
        'media.example.test/*' => Http::response(jpegBytes(400, 400), 200),
    ]);

    $promise = Promise::factory()->published()->create([
        'title' => 'تحويل المعاملات إلى رقمية في جميع مراكز الأحوال المدنية بالمحافظات بحلول نيسان 2026',
        'speaker_id' => PromiseSpeaker::factory()->create(['name' => 'أنس خطاب', 'title' => 'وزير الداخلية', 'image_url' => 'https://media.example.test/a.jpg'])->id,
    ]);
    $card = Previews::cardSource('promise')->card((string) $promise->number);
    $renderer = app(CardRenderer::class);

    $png = $renderer->render($card->model, 'png');
    $jpg = $renderer->render($card->model, 'jpg');

    expect(array_slice(getimagesizefromstring($png->bytes), 0, 3))->toBe([1200, 630, IMAGETYPE_PNG])
        ->and(array_slice(getimagesizefromstring($jpg->bytes), 0, 3))->toBe([1200, 630, IMAGETYPE_JPEG])
        ->and($png->complete)->toBeTrue();

    // When the photo cannot be fetched the card is still drawn, and says so.
    $model = $card->model;
    $model['person']['image'] = 'https://media.example.test/down/a.jpg';
    $withoutPhoto = $renderer->render($model, 'png');
    expect($withoutPhoto->complete)->toBeFalse()
        ->and(array_slice(getimagesizefromstring($withoutPhoto->bytes), 0, 2))->toBe([1200, 630]);

    $this->artisan('og:doctor')->assertSuccessful();
});

test('a renderer that cannot start is reported as a failed card, not a crash', function () {
    config()->set('seo.cards.node', 'definitely-not-a-real-binary');

    expect(fn () => app(NodeCardRenderer::class)->render(['kind' => 'brand']))
        ->toThrow(CardRenderFailed::class);

    $this->artisan('og:doctor')->assertFailed();
});
