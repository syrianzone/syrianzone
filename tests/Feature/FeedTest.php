<?php

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Cache::flush();
});

function rssFeed(string $title = 'موجز أخبار سوريا'): string
{
    return <<<XML
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>{$title}</title>
    <link>https://news.jard.chat</link>
    <item>
      <title><![CDATA[<b>خبر</b> الأول]]></title>
      <link>https://news.jard.chat/a</link>
      <pubDate>Mon, 20 Jul 2026 16:07:29 +0000</pubDate>
    </item>
    <item>
      <title>خبر الثاني</title>
      <link>https://news.jard.chat/b</link>
      <pubDate>Mon, 20 Jul 2026 15:58:42 +0000</pubDate>
    </item>
  </channel>
</rss>
XML;
}

function atomFeed(): string
{
    return <<<'XML'
<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>وكالة</title>
  <entry>
    <title>عنوان ذري</title>
    <link rel="self" href="https://example.sy/self"/>
    <link rel="alternate" href="https://example.sy/post"/>
    <updated>2026-07-20T12:00:00Z</updated>
  </entry>
</feed>
XML;
}

test('parses an rss 2.0 feed', function () {
    Http::fake(['*' => Http::response(rssFeed(), 200)]);

    $response = $this->getJson('/api/feed?source=jard')
        ->assertOk()
        ->assertHeader('Cache-Control', 'max-age=300, public')
        ->assertJsonPath('source', 'jard')
        ->assertJsonPath('title', 'موجز أخبار سوريا')
        ->assertJsonCount(2, 'items');

    // html is stripped out of the title, and the date is normalized
    $response->assertJsonPath('items.0.title', 'خبر الأول');
    $response->assertJsonPath('items.0.link', 'https://news.jard.chat/a');
    expect($response->json('items.0.published_at'))->toStartWith('2026-07-20T16:07:29');
});

test('parses an atom feed', function () {
    Http::fake(['*' => Http::response(atomFeed(), 200)]);

    $this->getJson('/api/feed?source=sana')
        ->assertOk()
        ->assertJsonPath('title', 'وكالة')
        ->assertJsonCount(1, 'items')
        ->assertJsonPath('items.0.title', 'عنوان ذري')
      // the alternate link wins over rel="self"
        ->assertJsonPath('items.0.link', 'https://example.sy/post')
        ->assertJsonPath('items.0.published_at', '2026-07-20T12:00:00+00:00');
});

test('rejects an unknown or missing source', function () {
    Http::fake();

    $this->getJson('/api/feed?source=bbc')->assertStatus(422);
    $this->getJson('/api/feed')->assertStatus(422);

    // no url is accepted from the client, so this stays an unknown key
    $this->getJson('/api/feed?source=&url=https://evil.test/feed')->assertStatus(422);

    Http::assertNothingSent();
});

test('caps the item list', function () {
    $items = str_repeat('<item><title>خبر</title><link>https://a.test/x</link></item>', 40);
    Http::fake(['*' => Http::response("<rss><channel><title>ك</title>{$items}</channel></rss>", 200)]);

    $this->getJson('/api/feed?source=jard')->assertOk()->assertJsonCount(15, 'items');
});

test('caches a successful response instead of refetching', function () {
    Http::fake(['*' => Http::response(rssFeed(), 200)]);

    $this->getJson('/api/feed?source=jard')->assertOk();
    $this->getJson('/api/feed?source=jard')->assertOk();

    Http::assertSentCount(1);
});

test('caches per source, not globally', function () {
    Http::fake(['*' => Http::response(rssFeed(), 200)]);

    $this->getJson('/api/feed?source=jard')->assertOk();
    $this->getJson('/api/feed?source=sana')->assertOk();

    Http::assertSentCount(2);
});

// A transient upstream failure must not be cached, or the whole ttl serves it.
test('does not cache upstream failures', function () {
    Http::fakeSequence()
        ->push('nope', 500)
        ->push(rssFeed(), 200);

    $this->getJson('/api/feed?source=halab-today')
        ->assertStatus(502)
        ->assertJsonPath('message', 'تعذر تحميل الأخبار');

    // the retry reaches upstream, which it could not do if the 500 had been cached
    $this->getJson('/api/feed?source=halab-today')
        ->assertOk()
        ->assertJsonCount(2, 'items');
});

test('handles malformed xml', function () {
    Http::fake(['*' => Http::response('<rss><channel><title>ك</title></rss', 200)]);

    $this->getJson('/api/feed?source=jard')
        ->assertStatus(502)
        ->assertJsonPath('message', 'تعذر تحميل الأخبار');
});

test('handles xml that is neither rss nor atom', function () {
    Http::fake(['*' => Http::response('<html><body>not a feed</body></html>', 200)]);

    $this->getJson('/api/feed?source=jard')->assertStatus(502);
});

test('handles an empty upstream body', function () {
    Http::fake(['*' => Http::response('', 200)]);

    $this->getJson('/api/feed?source=jard')->assertStatus(502);
});

test('refuses an oversize upstream body', function () {
    Http::fake(['*' => Http::response(str_repeat('a', 2 * 1024 * 1024 + 1), 200)]);

    $this->getJson('/api/feed?source=jard')->assertStatus(502);
});

test('drops a non-http link', function () {
    $xml = '<rss><channel><title>ك</title><item><title>خبر</title>'
      .'<link>javascript:alert(1)</link></item></channel></rss>';
    Http::fake(['*' => Http::response($xml, 200)]);

    $this->getJson('/api/feed?source=jard')
        ->assertOk()
        ->assertJsonPath('items.0.link', null);
});

test('handles an upstream connection error', function () {
    Http::fake(fn () => throw new ConnectionException('timeout'));

    $this->getJson('/api/feed?source=jard')->assertStatus(502);
});
