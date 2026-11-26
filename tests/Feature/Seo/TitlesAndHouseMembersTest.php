<?php

use App\Services\Sitemap\SitemapBuilder;
use App\Support\Facts;
use App\Support\HouseMembers;
use App\Support\Seo\Preview\Previews;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

test('roznama resolves a dynamic current-year title and passes server today and ramadan props', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-26 10:00:00', Facts::syria()['timezone']));
    $meta2026 = seoMetaFor('/roznama');

    expect($meta2026['title'])->toBe('الروزنامة السورية 2026 — التاريخ اليوم، العطل الرسمية، كم باقي على رمضان | Syrian Zone')
        ->and($meta2026['og_title'])->toBe('الروزنامة السورية 2026 — التاريخ اليوم، العطل الرسمية، كم باقي على رمضان')
        ->and($meta2026['description'])->toContain('2026');

    Carbon::setTestNow(Carbon::parse('2027-01-15 10:00:00', Facts::syria()['timezone']));
    $meta2027 = seoMetaFor('/roznama');
    expect($meta2027['title'])->toBe('الروزنامة السورية 2027 — التاريخ اليوم، العطل الرسمية، كم باقي على رمضان | Syrian Zone');

    Carbon::setTestNow(Carbon::parse('2026-11-26 10:00:00', Facts::syria()['timezone']));
    $this->get('/roznama')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Roznama/Index')
            ->where('serverYear', 2026)
            ->where('serverToday.iso', '2026-11-26')
            ->where('ramadan.hijriYear', 1448)
            ->where('ramadan.expectedStartDate', '2027-02-08')
            ->where('ramadan.daysLeft', 74));

    Carbon::setTestNow();
});

test('transit city pages use the updated title pattern and unique descriptions with route count', function () {
    if (DB::connection()->getDriverName() === 'sqlite') {
        DB::connection()->getPdo()->sqliteCreateFunction('ST_AsGeoJSON', fn ($value) => $value, 1);
    }

    seedCity('damascus', ['name_ar' => 'دمشق', 'name_en' => 'Damascus']);
    seedCity('rif-dimashq', ['name_ar' => 'ريف دمشق', 'name_en' => 'Rif Dimashq']);
    transitRoute('dam-1', 'damascus', ['name_ar' => 'خط المزة']);
    transitRoute('dam-2', 'damascus', ['name_ar' => 'خط برزة']);
    transitRoute('rif-1', 'rif-dimashq', ['name_ar' => 'خط جرمانا']);

    $damascusMeta = seoMetaFor('/transit/city/damascus');
    $rifMeta = seoMetaFor('/transit/city/rif-dimashq');

    expect($damascusMeta['title'])->toBe('خطوط السرافيس في دمشق — خريطة ومسارات وأجرة | ترانزيت سوريا')
        ->and($damascusMeta['description'])->toContain('دمشق')->toContain('2')
        ->and($rifMeta['title'])->toBe('خطوط السرافيس في ريف دمشق — خريطة ومسارات وأجرة | ترانزيت سوريا')
        ->and($rifMeta['description'])->toContain('ريف دمشق')->toContain('1')
        ->and($damascusMeta['description'])->not->toBe($rifMeta['description']);

    $this->get('/transit/city/damascus')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Transit/city/[id]/Index')
            ->has('lastUpdated'));
});

test('house page is retitled and member pages return 200 or 404 with Person JSON-LD and OG card', function () {
    $houseMeta = seoMetaFor('/house');
    expect($houseMeta['title'])->toBe('أعضاء مجلس الشعب السوري 2026 — الأسماء حسب المحافظة | Syrian Zone');

    $this->get('/house/members/73')
        ->assertOk()
        ->assertSee('مصطفى عبدالوهاب موسى', false)
        ->assertSee('GovernmentOrganization', false)
        ->assertSee('مجلس الشعب السوري', false)
        ->assertSee('BreadcrumbList', false)
        ->assertInertia(fn ($page) => $page
            ->component('House/Show')
            ->where('member.member_number', '73')
            ->where('member.name_ar', 'مصطفى عبدالوهاب موسى')
            ->has('sameGovernorateMembers'));

    $memberMeta = seoMetaFor('/house/members/73');
    $card = Previews::cardSource('house-member')->card('73');
    expect($memberMeta['title'])->toContain('مصطفى عبدالوهاب موسى')
        ->and($memberMeta['title'])->toContain('عضو مجلس الشعب السوري عن محافظة إدلب')
        ->and($memberMeta['image'])->toBe('https://syrian.zone/og/r/house-member/73.png?v='.$card->version());

    $femaleMeta = seoMetaFor('/house/members/176');
    expect($femaleMeta['title'])->toContain('عضوة مجلس الشعب السوري عن محافظة إدلب');

    $this->get('/house/members/999999')->assertNotFound();
    $this->get('/house/members/not-a-number')->assertNotFound();
    expect(Previews::cardSource('house-member')->card('999999'))->toBeNull();
});

test('sitemap includes every house member matching the seeder csv count', function () {
    $csvRows = array_map('str_getcsv', file(database_path('seeders/data/house_members_2026.csv')));
    array_shift($csvRows);
    $csvNumbers = array_values(array_filter(array_map(fn ($r) => trim((string) ($r[11] ?? '')), $csvRows)));

    $sitemapPaths = array_map(fn ($u) => $u->path, app(SitemapBuilder::class)->build());
    $memberPaths = array_values(array_filter($sitemapPaths, fn (string $p) => str_starts_with($p, '/house/members/')));

    expect($csvNumbers)->toHaveCount(count(HouseMembers::all()))
        ->and($memberPaths)->toHaveCount(count($csvNumbers));

    foreach ($csvNumbers as $number) {
        expect($memberPaths)->toContain('/house/members/'.$number);
    }
});
