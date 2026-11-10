<?php

use App\Support\Seo\LlmsTxt;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;

test('llms.txt is plain text a shared cache may keep', function () {
    $response = $this->get('/llms.txt')->assertOk();

    expect($response->headers->get('Content-Type'))->toBe('text/plain; charset=UTF-8')
        ->and($response->headers->get('Cache-Control'))->toContain('public')
        ->and($response->headers->getCookies())->toBe([]);
});

test('llms.txt follows the proposed format: a title, a summary, then sections of links', function () {
    $lines = explode("\n", $this->get('/llms.txt')->getContent());

    expect($lines[0])->toBe('# المساحة السورية (Syrian Zone)')
        ->and($lines[2])->toStartWith('> ')
        ->and(collect($lines)->filter(fn ($line) => str_starts_with($line, '## '))->values()->all())
        ->toBe(['## بيانات وأدلة', '## خدمات يومية', '## رأي ومشاركة', '## عن المنصة', '## Optional']);

    $links = collect($lines)->filter(fn ($line) => str_starts_with($line, '- '));

    expect($links)->toHaveCount(count(LlmsTxt::paths()))
        ->and($links->every(fn ($line) => preg_match('#^- \[[^\]]+\]\(https://syrian\.zone/[^)\s]*\): \S#u', $line) === 1))->toBeTrue()
        ->and($links->first())->toBe('- [عداد الوعود](https://syrian.zone/promises): '.SeoMeta::fixedPage('/promises')->description);
});

test('llms.txt only links fixed pages that are indexed, each once', function () {
    $paths = LlmsTxt::paths();

    expect($paths)->toBe(array_values(array_unique($paths)));

    foreach ($paths as $path) {
        expect(SeoMeta::pagePaths())->toContain($path)
            ->and(SeoMeta::resolve(Request::create($path, 'GET'))['robots'])->toBe('index, follow');
    }
});
