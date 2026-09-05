<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class SiteSetting extends Model
{
    protected $fillable = ['key', 'value', 'updated_by'];

    protected $casts = ['value' => 'array'];

    public const HOMEPAGE_POPUP_KEY = 'homepage_popup';

    public static function defaults(): array
    {
        return [
            'enabled' => true,
            'title' => 'صوتك بيعمل فرق!',
            'description' => 'ساهم في فك الحظر عن الخدمات التقنية في سوريا. صوّت للخدمات الأكثر أهمية بالنسبة لك لتكون من أولويات العمل.',
            'buttonText' => 'صوّت الآن',
            'dismissText' => 'لاحقاً',
            'link' => 'https://unblocksyria.com',
            'version' => 1,
        ];
    }

    public static function getPopup(): array
    {
        return Cache::remember('site_popup', 300, function () {
            $row = static::where('key', static::HOMEPAGE_POPUP_KEY)->first();
            if (! $row || ! is_array($row->value)) {
                return static::defaults();
            }

            return array_merge(static::defaults(), $row->value);
        });
    }

    public static function flushPopupCache(): void
    {
        Cache::forget('site_popup');
    }
}
