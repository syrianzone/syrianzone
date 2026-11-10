<?php

namespace App\Http\Controllers;

use App\Support\Seo\Og\CardCache;
use App\Support\Seo\Og\CardRenderer;
use App\Support\Seo\Og\RecordCard;
use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\Preview\Previews;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Serves the share card of one record: /og/r/{type}/{key}.{png|jpg}
 *
 * A card is drawn the first time it is asked for and kept on disk per version;
 * Cloudflare caches it after that. The response is always an image. A record
 * that does not exist, or a card that cannot be drawn, gets the card of its
 * section with a short cache, because a broken image URL leaves a shared link
 * with no picture at all.
 */
class OgCardController extends Controller
{
    private const YEAR = 'public, max-age=31536000, immutable';

    private const SHORT = 'public, max-age=300';

    private const RETRY_SOON = 'public, max-age=30';

    public function __construct(
        private readonly CardRenderer $renderer,
        private readonly CardCache $cache,
    ) {}

    public function show(Request $request, string $type, string $key, string $format): BinaryFileResponse
    {
        $source = Previews::cardSource($type);
        abort_if($source === null, 404);

        $card = rescue(fn () => $source->card($key), null);
        if ($card === null || $card->format !== $format) {
            return $this->fallback($source::fallbackCard(), self::SHORT);
        }

        $file = $this->cache->get($card) ?? $this->draw($card);
        if ($file === null) {
            return $this->fallback($source::fallbackCard(), self::RETRY_SOON);
        }

        // Only the address that names this exact version may be cached forever:
        // an older `?v=` keeps working but must be allowed to catch up.
        $current = $request->query('v') === $card->version();

        return response()->file($file, [
            'Content-Type' => $format === 'jpg' ? 'image/jpeg' : 'image/png',
            'Cache-Control' => $current ? self::YEAR : self::SHORT,
        ]);
    }

    /** Draws and stores a card; null when it cannot be drawn right now. */
    private function draw(RecordCard $card): ?string
    {
        try {
            // One drawing per card at a time: a link shared in a busy group is
            // fetched by many clients in the same second.
            return Cache::lock('og-card:'.$card->type.':'.$card->key.':'.$card->version(), 20)
                ->block(8, fn () => $this->cache->get($card)
                    ?? $this->cache->put($card, $this->renderer->render($card->model, $card->format)));
        } catch (LockTimeoutException) {
            return null;
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }

    private function fallback(string $slug, string $cacheControl): BinaryFileResponse
    {
        $file = StaticCards::file($slug);
        if (! is_file($file)) {
            $file = StaticCards::file(StaticCards::DEFAULT);
        }

        return response()->file($file, ['Content-Type' => 'image/png', 'Cache-Control' => $cacheControl]);
    }
}
