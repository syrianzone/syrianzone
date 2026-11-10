<?php

namespace App\Console\Commands;

use App\Support\Seo\Og\CardRenderer;
use Illuminate\Console\Command;

/**
 * Draws one card to prove the renderer works in this environment.
 *
 * Record cards are drawn on demand, and a failure there is deliberately quiet
 * (the visitor gets the section card). This makes a broken renderer loud at
 * deploy time instead: it runs from docker/10-startup.sh.
 */
class OgDoctor extends Command
{
    protected $signature = 'og:doctor';

    protected $description = 'Check that share cards can be drawn in this environment';

    public function handle(CardRenderer $renderer): int
    {
        $started = microtime(true);

        try {
            $card = $renderer->render([
                'kind' => 'split',
                'url' => 'syrian.zone',
                'title' => 'المساحة السورية',
                'subtitle' => 'فحص مُولِّد بطاقات المشاركة',
                'art' => ['type' => 'emblem'],
            ]);
        } catch (\Throwable $e) {
            $this->error('Share cards cannot be drawn: '.$e->getMessage());
            $this->line('Record pages will fall back to their section card until this is fixed.');

            return self::FAILURE;
        }

        $this->info(sprintf('Share cards can be drawn (%d KB in %d ms).', strlen($card->bytes) / 1024, (microtime(true) - $started) * 1000));

        return self::SUCCESS;
    }
}
