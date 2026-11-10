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
    /** The file of this exact version of a card, if it has been drawn. */
    public function get(RecordCard $card): ?string
    {
        $file = $this->file($card);

        return is_file($file) ? $file : null;
    }

    /** Stores a drawn card and drops the versions it replaces. */
    public function put(RecordCard $card, string $bytes): string
    {
        $file = $this->file($card);
        File::ensureDirectoryExists(dirname($file));

        // Written under a temporary name and moved into place, so a concurrent
        // request never reads half a file.
        $partial = $file.'.'.bin2hex(random_bytes(4)).'.tmp';
        File::put($partial, $bytes);
        File::move($partial, $file);

        foreach (File::glob(dirname($file).'/'.$card->key.'@*.'.$card->format) as $other) {
            if ($other !== $file) {
                File::delete($other);
            }
        }

        return $file;
    }

    private function file(RecordCard $card): string
    {
        // "@" cannot appear in a key, so one card's versions never match another's.
        return storage_path(sprintf('app/og/%s/%s@%s.%s', $card->type, $card->key, $card->version(), $card->format));
    }
}
