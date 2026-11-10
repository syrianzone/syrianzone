<?php

namespace App\Support\Seo\Og;

use Illuminate\Support\Facades\Process;

/**
 * Draws cards with the same Node script that builds the fixed-page cards
 * (scripts/og/render.mjs), so every card comes from one set of templates.
 *
 * Node is already in the production image for the Inertia SSR server. The
 * script is started per card: a card is drawn once per version and then served
 * from disk, so a long-running service would buy nothing.
 */
final class NodeCardRenderer implements CardRenderer
{
    public function __construct(private readonly CardImages $images) {}

    public function render(array $model, string $format = 'png'): DrawnCard
    {
        [$model, $complete] = $this->images->embed($model);
        $out = tempnam(sys_get_temp_dir(), 'og-card-');
        if ($out === false) {
            throw new CardRenderFailed('could not create a temporary file');
        }

        try {
            $result = Process::path(base_path())
                ->timeout((int) config('seo.cards.timeout', 10))
                ->input((string) json_encode($model, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES))
                ->run([(string) config('seo.cards.node', 'node'), 'scripts/og/render.mjs', '--out', $out]);

            if ($result->failed()) {
                throw new CardRenderFailed(trim($result->errorOutput()) ?: 'the renderer exited with code '.$result->exitCode());
            }

            $png = (string) file_get_contents($out);
            if (! str_starts_with($png, "\x89PNG")) {
                throw new CardRenderFailed('the renderer did not write a PNG');
            }

            return new DrawnCard($format === 'jpg' ? $this->toJpeg($png) : $png, $complete);
        } catch (CardRenderFailed $e) {
            throw $e;
        } catch (\Throwable $e) {
            // A missing Node binary or a timeout surfaces here.
            throw new CardRenderFailed($e->getMessage(), previous: $e);
        } finally {
            @unlink($out);
        }
    }

    /** A photograph as PNG is ten times the size it needs to be. */
    private function toJpeg(string $png): string
    {
        $image = @imagecreatefromstring($png);
        if ($image === false) {
            throw new CardRenderFailed('could not re-encode the card as JPEG');
        }

        ob_start();
        imagejpeg($image, null, 84);

        return (string) ob_get_clean();
    }
}
