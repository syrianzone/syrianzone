<?php

use App\Models\Promise;
use App\Models\PromiseSpeaker;
use App\Support\Seo\Og\CardImages;
use App\Support\Seo\Og\CardRenderer;
use App\Support\Seo\Og\CardRenderFailed;
use App\Support\Seo\Og\NodeCardRenderer;
use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\Preview\Previews;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;

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

        public function __construct(private ?Throwable $failure) {}

        public function render(array $model, string $format = 'png'): string
        {
            $this->calls++;
            $this->models[] = $model;
            if ($this->failure) {
                throw $this->failure;
            }

            return "\x89PNG drawn card #".$this->calls;
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

test('editing a record draws a new version and drops the old file', function () {
    $renderer = fakeCardRenderer();
    $promise = Promise::factory()->published()->create(['title' => 'العنوان الأول']);
    $source = Previews::cardSource('promise');

    $old = $source->card((string) $promise->number);
    $this->get($old->url())->assertOk();

    $promise->update(['title' => 'العنوان بعد التعديل']);
    $new = $source->card((string) $promise->number);
    $this->get($new->url())->assertOk();

    $files = File::files($this->storage.'/app/og/promise');

    expect($new->version())->not->toBe($old->version())
        ->and($renderer->calls)->toBe(2)
        ->and($files)->toHaveCount(1)
        ->and($files[0]->getFilename())->toBe($promise->number.'@'.$new->version().'.png');
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
    $embed = fn (string $url) => $images->embed(['title' => 't', 'person' => ['name' => 'n', 'image' => $url]]);

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

    $photo = app(CardImages::class)->embed(['kind' => 'photo', 'photo' => 'https://media.example.test/place.jpg'])['photo'];

    expect(array_slice(getimagesizefromstring(base64_decode(substr($photo, strlen('data:image/jpeg;base64,')))), 0, 2))->toBe([1200, 630]);
});

test('the real renderer draws a promise card with the speaker photo, as png and as jpeg', function () {
    if (Process::run(['node', '--version'])->failed() || ! is_dir(base_path('node_modules/@resvg/resvg-wasm'))) {
        $this->markTestSkipped('Node and the card renderer are not installed.');
    }

    config()->set('filesystems.disks.r2.url', 'https://media.example.test');
    Http::fake(['media.example.test/*' => Http::response(jpegBytes(400, 400), 200)]);

    $promise = Promise::factory()->published()->create([
        'title' => 'تحويل المعاملات إلى رقمية في جميع مراكز الأحوال المدنية بالمحافظات بحلول نيسان 2026',
        'speaker_id' => PromiseSpeaker::factory()->create(['name' => 'أنس خطاب', 'title' => 'وزير الداخلية', 'image_url' => 'https://media.example.test/a.jpg'])->id,
    ]);
    $card = Previews::cardSource('promise')->card((string) $promise->number);
    $renderer = app(CardRenderer::class);

    $png = $renderer->render($card->model, 'png');
    $jpg = $renderer->render($card->model, 'jpg');

    expect(array_slice(getimagesizefromstring($png), 0, 3))->toBe([1200, 630, IMAGETYPE_PNG])
        ->and(array_slice(getimagesizefromstring($jpg), 0, 3))->toBe([1200, 630, IMAGETYPE_JPEG]);

    $this->artisan('og:doctor')->assertSuccessful();
});

test('a renderer that cannot start is reported as a failed card, not a crash', function () {
    config()->set('seo.cards.node', 'definitely-not-a-real-binary');

    expect(fn () => app(NodeCardRenderer::class)->render(['kind' => 'brand']))
        ->toThrow(CardRenderFailed::class);

    $this->artisan('og:doctor')->assertFailed();
});
