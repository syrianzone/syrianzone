<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Support\Facts;
use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\Pages;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use Illuminate\Http\Request;

/**
 * /roznama: dynamic year in the title and description so the calendar page
 * always targets the current Syrian year without editing seo.json each January.
 */
final class RoznamaPreview implements PreviewResolver
{
    public function resolve(Request $request, string $path): ?Preview
    {
        if ($path !== '/roznama') {
            return null;
        }

        $year = now()->timezone(Facts::syria()['timezone'])->format('Y');
        $shareTitle = "الروزنامة السورية {$year} — التاريخ اليوم، العطل الرسمية، كم باقي على رمضان";

        return new Preview(
            title: $shareTitle.' | Syrian Zone',
            shareTitle: $shareTitle,
            description: "الروزنامة (التقويم) السورية {$year}: التاريخ اليوم ميلادياً وهجرياً، العطلة الرسمية القادمة وكم باقي على رمضان 1448، مع مواقيت الصلاة والفعاليات بتوقيت دمشق.",
            canonicalPath: '/roznama',
            image: StaticCards::url('roznama'),
            type: Pages::type('/roznama'),
            schema: Pages::schema('/roznama'),
            parent: Pages::parent('/roznama'),
        );
    }
}
