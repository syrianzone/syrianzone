<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use Illuminate\Http\Request;

/**
 * /priorities?state={encoded}: someone's own ranking, shared as a link. The
 * ranking lives entirely in the parameter, so the preview is an invitation to
 * look at it and the parameter is kept in the shared address.
 */
final class PrioritiesSharePreview implements PreviewResolver
{
    public function resolve(Request $request, string $path): ?Preview
    {
        $state = $request->query('state');
        if ($path !== '/priorities' || ! is_string($state) || ! preg_match('#^[A-Za-z0-9+/=_\-]{4,2000}$#', $state)) {
            return null;
        }

        return new Preview(
            title: 'أولوياتي لسوريا المستقبل | Syrian Zone',
            description: 'شاهد ترتيبي لأولويات سوريا المستقبل، ثم رتّب أولوياتك وقارن بينهما.',
            canonicalPath: '/priorities',
            image: StaticCards::url('priorities-share'),
            sharePath: '/priorities?state='.rawurlencode($state),
        );
    }
}
