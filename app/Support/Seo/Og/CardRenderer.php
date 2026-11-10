<?php

namespace App\Support\Seo\Og;

/** Draws a card model into an image. */
interface CardRenderer
{
    /**
     * @param  array<string, mixed>  $model  see scripts/og/lib/cards.mjs
     * @param  'png'|'jpg'  $format
     *
     * @throws CardRenderFailed when the card cannot be drawn
     */
    public function render(array $model, string $format = 'png'): DrawnCard;
}
