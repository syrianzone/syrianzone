<?php

namespace App\Support\Seo\Og;

use Illuminate\Support\Facades\File;

/**
 * Drawn record cards on local disk, one file per card version.
 *
 * The files are disposable: a deploy starts with an empty directory and each
 * card is drawn again the first time it is asked for, then cached at the edge.
 */
final class CardCache
{
    /**
     * How long a drawing that is missing its photograph is served before the
     * card is drawn again. Long enough not to hammer a media host that is
     * down, short enough that the photograph appears soon after it recovers.
     */
    public const RETRY_AFTER = 600;

    /**
     * How long a replaced file is kept. A request may already hold its path
     * when a newer version is drawn; deleting it at once would fail that
     * request.
     */
    private const GRACE = 600;

    /** The drawing of this exact version of a card, if there is one to serve. */
    public function get(RecordCard $card): ?StoredCard
    {
        $final = $this->file($card);
        if (is_file($final)) {
            return new StoredCard($final, true);
        }

        $partial = $this->file($card, partial: true);
        if (is_file($partial) && now()->getTimestamp() - (int) filemtime($partial) < self::RETRY_AFTER) {
            return new StoredCard($partial, false);
        }

        return null;
    }

    /** Stores a drawing and drops the files it replaces once they are out of use. */
    public function put(RecordCard $card, DrawnCard $drawn): StoredCard
    {
        $file = $this->file($card, partial: ! $drawn->complete);
        File::ensureDirectoryExists(dirname($file));

        // Written under a temporary name and moved into place, so a concurrent
        // request never reads half a file.
        $temporary = $file.'.'.bin2hex(random_bytes(4)).'.tmp';
        File::put($temporary, $drawn->bytes);
        File::move($temporary, $file);

        $cutoff = now()->getTimestamp() - self::GRACE;
        foreach (File::glob(dirname($file).'/'.$card->key.'@*.'.$card->format) as $other) {
            if ($other !== $file && (int) filemtime($other) < $cutoff) {
                File::delete($other);
            }
        }

        return new StoredCard($file, $drawn->complete);
    }

    private function file(RecordCard $card, bool $partial = false): string
    {
        // "@" cannot appear in a key, so one card's versions never match another's.
        return storage_path(sprintf(
            'app/og/%s/%s@%s%s.%s',
            $card->type, $card->key, $card->version(), $partial ? '.partial' : '', $card->format,
        ));
    }
}
