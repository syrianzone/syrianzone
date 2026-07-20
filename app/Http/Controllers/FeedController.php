<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class FeedController extends Controller
{
  // Server-side RSS/Atom proxy, same shape as WeatherController and for the same
  // reason: a browser cannot fetch a third-party feed cross-origin, and none of
  // these publishers send CORS headers.
  //
  // The url is never accepted from the client. An open proxy would mean SSRF
  // hardening, redirect handling, and an unbounded cache keyspace; a fixed
  // allowlist gets all three for free.
  private const SOURCES = [
    'jard' => ['https://news.jard.chat/rss', 'موجز أخبار سوريا'],
    'sana' => ['https://sana.sy/feed/', 'سانا'],
    'halab-today' => ['https://halabtodaytv.net/feed', 'حلب اليوم'],
    'syrian-observer' => ['https://syrianobserver.com/feed', 'ذا سيريان أوبزرفر'],
  ];

  private const TTL = 600;

  private const MAX_ITEMS = 15;

  // A feed page is tens of kilobytes. Anything past this is either broken or
  // hostile, and we refuse to hand it to the xml parser.
  private const MAX_BYTES = 2 * 1024 * 1024;

  private const ATOM_NS = 'http://www.w3.org/2005/Atom';

  public function show(Request $request)
  {
    $validated = $request->validate([
      'source' => 'required|string|in:'.implode(',', array_keys(self::SOURCES)),
    ], [
      'source.required' => 'المصدر مطلوب',
      'source.in' => 'مصدر غير معروف',
    ]);

    $source = $validated['source'];
    $cached = Cache::get("feed:{$source}");
    if ($cached !== null) {
      return response()->json($cached)->header('Cache-Control', 'public, max-age=300');
    }

    [$url, $label] = self::SOURCES[$source];

    try {
      $response = Http::timeout(5)
        ->withHeaders(['Accept' => 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8'])
        ->get($url);
    } catch (\Throwable $e) {
      return $this->failed();
    }

    if (! $response->successful()) {
      // not cached: a transient upstream error must not stick for the whole ttl
      return $this->failed();
    }

    $body = $response->body();
    if ($body === '' || strlen($body) > self::MAX_BYTES) {
      return $this->failed();
    }

    $payload = $this->parse($source, $label, $body);
    if ($payload === null) {
      return $this->failed();
    }

    Cache::put("feed:{$source}", $payload, self::TTL);

    return response()->json($payload)->header('Cache-Control', 'public, max-age=300');
  }

  private function failed()
  {
    return response()->json(['message' => 'تعذر تحميل الأخبار'], 502);
  }

  /**
   * Normalize RSS 2.0 or Atom into one shape. Returns null if the body is not
   * usable xml, which the caller turns into a 502.
   */
  private function parse(string $source, string $label, string $body): ?array
  {
    $previous = libxml_use_internal_errors(true);

    try {
      // NOCDATA folds the CDATA most arabic feeds wrap titles in; NONET refuses
      // any network fetch the document tries to trigger.
      $xml = new \SimpleXMLElement($body, LIBXML_NOCDATA | LIBXML_NONET);
    } catch (\Throwable $e) {
      return null;
    } finally {
      libxml_clear_errors();
      libxml_use_internal_errors($previous);
    }

    $atom = $xml->children(self::ATOM_NS);
    $isAtom = isset($atom->entry);

    if ($isAtom) {
      $title = $this->clean((string) $atom->title);
      $nodes = $atom->entry;
    } elseif (isset($xml->channel)) {
      $title = $this->clean((string) $xml->channel->title);
      $nodes = $xml->channel->item;
    } else {
      return null;
    }

    $items = [];
    foreach ($nodes as $node) {
      if (count($items) >= self::MAX_ITEMS) {
        break;
      }

      $item = $isAtom ? $this->atomItem($node) : $this->rssItem($node);
      if ($item !== null) {
        $items[] = $item;
      }
    }

    return [
      'source' => $source,
      'title' => $title !== '' ? $title : $label,
      'items' => $items,
    ];
  }

  private function rssItem(\SimpleXMLElement $node): ?array
  {
    $title = $this->clean((string) $node->title);
    if ($title === '') {
      return null;
    }

    return [
      'title' => $title,
      'link' => $this->link((string) $node->link),
      'published_at' => $this->timestamp((string) $node->pubDate),
    ];
  }

  private function atomItem(\SimpleXMLElement $node): ?array
  {
    $entry = $node->children(self::ATOM_NS);

    $title = $this->clean((string) $entry->title);
    if ($title === '') {
      return null;
    }

    // Atom puts the url in an attribute and may list several; the alternate link
    // is the human-readable one, so prefer it and fall back to the first.
    // attributes() with no namespace is required here: reading $link['href']
    // straight off a node reached through children(ATOM_NS) looks the attribute
    // up in that namespace, where it does not exist, and yields null.
    $href = '';
    foreach ($entry->link as $link) {
      $attrs = $link->attributes();
      $rel = (string) ($attrs['rel'] ?? '');
      if ($href === '' || $rel === 'alternate') {
        $href = (string) ($attrs['href'] ?? '');
      }
      if ($rel === 'alternate') {
        break;
      }
    }

    $date = (string) $entry->updated !== '' ? (string) $entry->updated : (string) $entry->published;

    return [
      'title' => $title,
      'link' => $this->link($href),
      'published_at' => $this->timestamp($date),
    ];
  }

  private function clean(string $value): string
  {
    $text = html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8');

    return trim(preg_replace('/\s+/u', ' ', $text) ?? '');
  }

  // Only http(s) survives, so a feed cannot hand the widget a javascript: href.
  private function link(string $value): ?string
  {
    $url = trim($value);
    if ($url === '') {
      return null;
    }

    $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));

    return in_array($scheme, ['http', 'https'], true) ? $url : null;
  }

  private function timestamp(string $value): ?string
  {
    $raw = trim($value);
    if ($raw === '') {
      return null;
    }

    try {
      return \Carbon\Carbon::parse($raw)->toIso8601String();
    } catch (\Throwable $e) {
      return null;
    }
  }
}
