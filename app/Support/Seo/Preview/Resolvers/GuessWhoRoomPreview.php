<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use Illuminate\Http\Request;

/**
 * /guesswho/room/{code}: a game room. Its link exists to be sent to a friend,
 * so the preview is an invitation. Rooms are short-lived and never indexed.
 */
final class GuessWhoRoomPreview implements PreviewResolver
{
    public function resolve(Request $request, string $path): ?Preview
    {
        if (! preg_match('#^/guesswho/room/[^/]+$#', $path)) {
            return null;
        }

        return new Preview(
            title: 'دعوة للعب «من هو؟» | Syrian Zone',
            description: 'صديقك يدعوك إلى غرفة لعب مباشرة في «من هو؟». اطرح الأسئلة واستبعد الشخصيات لتكشف بطاقته السرّية.',
            canonicalPath: $path,
            image: StaticCards::url('guesswho-invite'),
            noindex: true,
            parent: ['/guesswho', 'من هو؟'],
        );
    }
}
