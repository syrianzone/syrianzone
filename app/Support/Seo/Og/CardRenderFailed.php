<?php

namespace App\Support\Seo\Og;

use RuntimeException;

/** The renderer could not draw a card; the caller serves the fallback card. */
final class CardRenderFailed extends RuntimeException {}
