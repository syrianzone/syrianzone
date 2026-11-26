<?php

use App\Services\Places\PlaceAuditService;

test('classifyDuplicatePair classifies <= 1 km as duplicate', function () {
    expect(PlaceAuditService::classifyDuplicatePair(0.0, 'damascus', 'damascus'))->toBe('duplicate')
        ->and(PlaceAuditService::classifyDuplicatePair(0.07, 'daraa', 'daraa'))->toBe('duplicate')
        ->and(PlaceAuditService::classifyDuplicatePair(1.0, 'aleppo', 'idlib'))->toBe('duplicate')
        ->and(PlaceAuditService::classifyDuplicatePair(0.5, null, null))->toBe('duplicate');
});

test('classifyDuplicatePair classifies >= 25 km in different known governorates as same_name_different_place', function () {
    expect(PlaceAuditService::classifyDuplicatePair(25.0, 'damascus', 'hama'))->toBe('same_name_different_place')
        ->and(PlaceAuditService::classifyDuplicatePair(185.0, 'damascus', 'hama'))->toBe('same_name_different_place');
});

test('classifyDuplicatePair classifies intermediate distances, same-governorate >= 25 km, and unknown governorates as check_coordinates', function () {
    // 1 < d < 25 km
    expect(PlaceAuditService::classifyDuplicatePair(1.5, 'damascus', 'damascus'))->toBe('check_coordinates')
        ->and(PlaceAuditService::classifyDuplicatePair(12.0, 'damascus', 'rif-dimashq'))->toBe('check_coordinates')
        ->and(PlaceAuditService::classifyDuplicatePair(24.99, 'damascus', 'hama'))->toBe('check_coordinates')
        // >= 25 km in the SAME governorate (e.g. Citadel of Aleppo pin 30 km off inside Aleppo)
        ->and(PlaceAuditService::classifyDuplicatePair(30.0, 'aleppo', 'aleppo'))->toBe('check_coordinates')
        // >= 25 km with an unknown governorate
        ->and(PlaceAuditService::classifyDuplicatePair(40.0, 'aleppo', null))->toBe('check_coordinates')
        ->and(PlaceAuditService::classifyDuplicatePair(40.0, null, 'damascus'))->toBe('check_coordinates');
});

test('isLatinOnlyName detects names with no Arabic letters', function () {
    expect(PlaceAuditService::isLatinOnlyName('Free wifi'))->toBeTrue()
        ->and(PlaceAuditService::isLatinOnlyName('Pizzeria Al-Kabbas'))->toBeTrue()
        ->and(PlaceAuditService::isLatinOnlyName('12345'))->toBeTrue()
        ->and(PlaceAuditService::isLatinOnlyName('قلعة حلب'))->toBeFalse()
        ->and(PlaceAuditService::isLatinOnlyName('كافيه Free Wifi'))->toBeFalse();
});

test('haversineKm computes expected distances', function () {
    expect(PlaceAuditService::haversineKm(33.5119, 36.3065, 33.5119, 36.3065))->toBe(0.0);

    // Damascus to Hama is roughly 180–195 km straight-line
    $damascusToHama = PlaceAuditService::haversineKm(33.5119, 36.3065, 35.1318, 36.7578);
    expect($damascusToHama)->toBeGreaterThan(175.0)
        ->and($damascusToHama)->toBeLessThan(195.0);
});
