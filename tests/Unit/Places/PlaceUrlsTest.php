<?php

namespace Tests\Unit\Places;

use App\Services\Places\PlaceUrls;
use PHPUnit\Framework\TestCase;

class PlaceUrlsTest extends TestCase
{
    public function test_slug_keeps_arabic_and_hyphenates(): void
    {
        $this->assertSame('محطة-الحجاز', PlaceUrls::slug('محطة الحجاز'));
        $this->assertSame('قلعة-حلب', PlaceUrls::slug('  قلعةُ حلب!! '));
        $this->assertSame('مقهى-النوفرة', PlaceUrls::slug('مقهى «النوفرة»'));
        $this->assertSame('جبل-قاسيون', PlaceUrls::slug('جبـــل قاسيون'));
        $this->assertSame('café-2', PlaceUrls::slug('Café 2'));
    }

    public function test_slug_is_capped(): void
    {
        $this->assertLessThanOrEqual(60, mb_strlen(PlaceUrls::slug(str_repeat('مكان جميل ', 20))));
    }

    public function test_path_is_percent_encoded_and_round_trips(): void
    {
        $path = PlaceUrls::path(216, 'محطة الحجاز');
        $this->assertStringStartsWith('/mishwar/216-%D9%85', $path);
        $this->assertSame([216, 'محطة-الحجاز'], PlaceUrls::parse(substr($path, strlen('/mishwar/'))));
    }

    public function test_path_without_slug(): void
    {
        $this->assertSame('/mishwar/5', PlaceUrls::path(5, '!!!'));
        $this->assertSame([5, ''], PlaceUrls::parse('5'));
    }

    public function test_parse_rejects_non_place_segments(): void
    {
        $this->assertNull(PlaceUrls::parse('hama'));
        $this->assertNull(PlaceUrls::parse('0-x'));
        $this->assertNull(PlaceUrls::parse(''));
    }
}
