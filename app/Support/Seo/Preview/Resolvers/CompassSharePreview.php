<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use Illuminate\Http\Request;

/** /compass/s/{shareId}: someone's shared compass result. Never indexed. */
final class CompassSharePreview implements PreviewResolver
{
    public function resolve(Request $request, string $path): ?Preview
    {
        if (! preg_match('#^/compass/s/[^/]+$#', $path)) {
            return null;
        }

        return new Preview(
            title: 'نتيجة مشتركة — بوصلة سوريا | Syrian Zone',
            description: 'استعرض النتيجة المشتركة على اختبار بوصلة سوريا السياسي التفاعلي واكتشف موقعك على أحد عشر محوراً.',
            canonicalPath: $path,
            image: StaticCards::url('compass-share'),
            noindex: true,
            parent: ['/compass', 'بوصلة سوريا'],
        );
    }
}
