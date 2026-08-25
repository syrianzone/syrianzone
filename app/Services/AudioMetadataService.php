<?php

namespace App\Services;

// Thin wrapper over getID3, resolved from the container so tests can bind a fake.
class AudioMetadataService
{
  /**
   * @return array{duration_seconds: ?int, title: ?string, artist: ?string, picture: ?array{data: string, mime: string}}
   */
  public function analyze(string $path): array
  {
    $info = (new \getID3())->analyze($path);

    if (!empty($info['error'])) {
      throw new \RuntimeException('unreadable audio file: ' . implode('; ', (array) $info['error']));
    }

    // the real content gate: upload-time extension/mime checks are advisory only
    if (empty($info['playtime_seconds'])) {
      throw new \RuntimeException('no audio stream found in file');
    }

    $tags = ($info['tags']['id3v2'] ?? []) + ($info['tags']['id3v1'] ?? []);
    $picture = $info['comments']['picture'][0] ?? null;

    return [
      'duration_seconds' => (int) round($info['playtime_seconds']),
      'title' => $this->tag($tags, 'title'),
      'artist' => $this->tag($tags, 'artist'),
      'picture' => isset($picture['data'], $picture['image_mime'])
        ? ['data' => $picture['data'], 'mime' => $picture['image_mime']]
        : null,
    ];
  }

  // Cover pipeline shared by the upload job (embedded art) and the admin cover
  // endpoint: fit inside 600x600, webp q85. Null when GD cannot decode the bytes.
  public function coverWebp(string $binary): ?string
  {
    $im = @imagecreatefromstring($binary);
    if ($im === false) {
      return null;
    }

    $w = imagesx($im);
    $h = imagesy($im);
    $scale = min(1, 600 / max($w, $h));
    $tw = max(1, (int) round($w * $scale));
    $th = max(1, (int) round($h * $scale));

    $canvas = imagecreatetruecolor($tw, $th);
    imagecopyresampled($canvas, $im, 0, 0, 0, 0, $tw, $th, $w, $h);

    ob_start();
    imagewebp($canvas, null, 85);
    imagedestroy($canvas);
    imagedestroy($im);

    return ob_get_clean() ?: null;
  }

  private function tag(array $tags, string $key): ?string
  {
    $value = isset($tags[$key][0]) ? trim((string) $tags[$key][0]) : '';

    return $value === '' ? null : $value;
  }
}
