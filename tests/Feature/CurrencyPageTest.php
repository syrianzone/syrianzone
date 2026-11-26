<?php

use App\Support\Facts;
use Inertia\Testing\AssertableInertia as Assert;

test('currency page renders with verified currency facts props', function () {
    $response = $this->get('/currency')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Currency/Index')
            ->where('currency.ratio.old_per_new', 100)
            ->where('currency.ratio.subunits_per_new', 100)
            ->where('currency.legal_status.old_legal_tender', false)
            ->has('currency.new_denominations', 6)
            ->has('currency.old_denominations', 7)
            ->has('currency.common_amounts_old', 8)
            ->has('currency.timeline')
            ->has('currency.faq')
        );

    $html = $response->getContent();
    expect($html)->toMatch('/<title[^>]*>.*تحويل الليرة السورية الجديدة والقديمة.*<\/title>/u');
    expect($html)->toMatch('/<meta[^>]+name="description"[^>]+content="[^"]*100 إلى 1[^"]*"/u');
    expect($html)->not->toMatch('/[\x{0660}-\x{0669}]/u');
});

test('currency metadata in llms.txt has no Arabic-Indic digits', function () {
    $content = $this->get('/llms.txt')
        ->assertOk()
        ->getContent();

    expect($content)->toContain('/currency');
    expect($content)->toContain('100 إلى 1');
    expect($content)->not->toMatch('/[\x{0660}-\x{0669}]/u');
});

test('all currency banknote images exist in public directory and are under size limit', function () {
    $currency = Facts::currency();

    foreach (['new_denominations', 'old_denominations'] as $group) {
        foreach ($currency[$group] as $note) {
            foreach (['front_image', 'back_image'] as $field) {
                if (! isset($note[$field]) || ! is_array($note[$field])) {
                    continue;
                }

                $relativePath = ltrim((string) $note[$field]['path'], '/');
                $fullPath = public_path($relativePath);

                expect(file_exists($fullPath))
                    ->toBeTrue("Missing banknote image: {$relativePath}");
                expect(filesize($fullPath))
                    ->toBeLessThanOrEqual(80 * 1024, "Oversized banknote image: {$relativePath}");
            }
        }
    }
});
