<?php

namespace App\Support\Seo\Og;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * Prepares the photographs a card shows (a speaker's portrait, a place photo).
 *
 * The renderer only takes images inline, in a format it decodes. Each one is
 * fetched from an allowed host with a size limit, checked, scaled down with GD
 * and inlined as a small JPEG. Anything that goes wrong removes the image and
 * leaves the card to be drawn without it, never fails the card.
 */
final class CardImages
{
    /** Where each image sits in a card model, and the box it is scaled to cover. */
    private const SLOTS = [
        'photo' => [StaticCards::CARD_WIDTH, StaticCards::CARD_HEIGHT],
        'person.image' => [256, 256],
    ];

    private const MAX_BYTES = 8 * 1024 * 1024;

    /** Decoding cost follows pixels, not bytes: a tiny file can describe a huge canvas. */
    private const MAX_PIXELS = 24_000_000;

    private const TYPES = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF];

    /**
     * @param  array<string, mixed>  $model
     * @return array{0: array<string, mixed>, 1: bool} the model with every
     *                                                 image inlined or removed,
     *                                                 and whether all of them
     *                                                 could be loaded
     */
    public function embed(array $model): array
    {
        $complete = true;

        foreach (self::SLOTS as $slot => [$width, $height]) {
            $source = data_get($model, $slot);
            if (! is_string($source) || $source === '') {
                continue;
            }

            $inline = $this->inline($source, $width, $height);
            if ($inline === null) {
                data_forget($model, $slot);
                $complete = false;
            } else {
                data_set($model, $slot, $inline);
            }
        }

        return [$model, $complete];
    }

    private function inline(string $source, int $width, int $height): ?string
    {
        try {
            $bytes = $this->read($source);
            if ($bytes === null) {
                return null;
            }

            $info = @getimagesizefromstring($bytes);
            if ($info === false || ! in_array($info[2], self::TYPES, true) || $info[0] * $info[1] > self::MAX_PIXELS) {
                return null;
            }

            $image = @imagecreatefromstring($bytes);
            if ($image === false) {
                return null;
            }

            // Scale and crop to cover the box, centred.
            $scale = max($width / $info[0], $height / $info[1]);
            $cropWidth = (int) round($width / $scale);
            $cropHeight = (int) round($height / $scale);
            $canvas = imagecreatetruecolor($width, $height);
            imagefill($canvas, 0, 0, (int) imagecolorallocate($canvas, 255, 255, 255));
            imagecopyresampled(
                $canvas, $image, 0, 0,
                (int) (($info[0] - $cropWidth) / 2), (int) (($info[1] - $cropHeight) / 2),
                $width, $height, $cropWidth, $cropHeight,
            );

            ob_start();
            imagejpeg($canvas, null, 86);

            return 'data:image/jpeg;base64,'.base64_encode((string) ob_get_clean());
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }

    /** The image bytes, or null when the source is not one we read. */
    private function read(string $source): ?string
    {
        // A site-relative path is a file this application serves itself.
        if (str_starts_with($source, '/') && ! str_starts_with($source, '//')) {
            return $this->readLocal(ltrim(strtok($source, '?') ?: '', '/'));
        }

        $host = parse_url($source, PHP_URL_HOST);
        if (parse_url($source, PHP_URL_SCHEME) !== 'https' || ! is_string($host) || ! in_array(strtolower($host), $this->allowedHosts(), true)) {
            return null;
        }

        // No redirects: an allowed host must not be able to send us elsewhere.
        $response = Http::timeout(6)->connectTimeout(3)->withoutRedirecting()->withOptions([
            // Stop a download that turns out to be larger than any photo we show.
            'progress' => function ($total, $downloaded) {
                if ($total > self::MAX_BYTES || $downloaded > self::MAX_BYTES) {
                    throw new \RuntimeException('image exceeds the size limit');
                }
            },
        ])->get($source);

        return $response->successful() && strlen($response->body()) <= self::MAX_BYTES ? $response->body() : null;
    }

    /**
     * A file under the public directory, or an upload under /storage/. Uploads
     * are read from the public disk itself: /storage is only a symlink to it,
     * so resolving the path leads outside the public directory, and the link
     * may not exist at all where this runs.
     */
    private function readLocal(string $relative): ?string
    {
        [$root, $file] = str_starts_with($relative, 'storage/')
            ? [Storage::disk('public')->path(''), Storage::disk('public')->path(substr($relative, strlen('storage/')))]
            : [public_path(), public_path($relative)];

        // Resolved before comparing, so "../" cannot climb out of the root.
        $root = realpath($root);
        $file = realpath($file);
        if ($root === false || $file === false || ! is_file($file)
            || ! str_starts_with($file, rtrim($root, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR)
            || filesize($file) > self::MAX_BYTES) {
            return null;
        }

        return (string) file_get_contents($file);
    }

    /**
     * Hosts images may be fetched from: this site's own media storage, plus
     * any listed in OG_IMAGE_HOSTS. Record fields can hold arbitrary URLs, and
     * the server must not be made to request whatever a record points at.
     *
     * @return list<string>
     */
    private function allowedHosts(): array
    {
        $own = [
            config('app.url'),
            config('seo.base_url'),
            config('filesystems.disks.r2.url'),
            config('filesystems.disks.s3.url'),
            rescue(fn () => Storage::disk(config('filesystems.media_disk'))->url(''), null, false),
        ];

        $hosts = array_map(fn ($url) => is_string($url) ? parse_url($url, PHP_URL_HOST) : null, $own);

        return array_values(array_unique(array_map('strtolower', array_filter([
            ...$hosts,
            ...(array) config('seo.cards.image_hosts', []),
        ]))));
    }
}
