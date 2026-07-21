<?php

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
  Cache::flush();
});

// Trimmed from a real answers.syrian.zone response, keeping the fields we drop
// (operator, vote_count, url_title) so the normalization is actually exercised.
function answersQuestion(string $id = '10010000000000123', int $answers = 1): array {
  return [
    'id' => $id,
    'created_at' => 1784501445,
    'title' => 'كيف فيني اشتري تطبيق من جوجل بلاي من داخل سوريا',
    'url_title' => 'topic',
    'description' => 'كيف يمكنني الدفع لشراء تطبيق',
    'status' => 1,
    'tags' => [
      ['slug_name' => 'general', 'display_name' => 'أسئلة عامّة', 'recommend' => false],
      ['slug_name' => 'أسئلة-المغتربين', 'display_name' => 'أسئلة المغتربين', 'recommend' => false],
    ],
    'view_count' => 19,
    'vote_count' => 1,
    'answer_count' => $answers,
    'operator' => ['id' => '38', 'display_name' => 'Muhannad Omar'],
  ];
}

function answersPayload(?array $list = null): array {
  return [
    'code' => 200,
    'reason' => 'base.success',
    'msg' => 'تم بنجاح.',
    'data' => ['count' => 17, 'list' => $list ?? [answersQuestion()]],
  ];
}

test('normalizes a realistic upstream payload', function () {
  Http::fake(['*' => Http::response(answersPayload(), 200)]);

  $response = $this->getJson('/api/answers')->assertOk();

  $response->assertJsonPath('items.0.id', '10010000000000123')
    ->assertJsonPath('items.0.title', 'كيف فيني اشتري تطبيق من جوجل بلاي من داخل سوريا')
    ->assertJsonPath('items.0.url', 'https://answers.syrian.zone/questions/10010000000000123')
    ->assertJsonPath('items.0.tags', ['أسئلة عامّة', 'أسئلة المغتربين'])
    ->assertJsonPath('items.0.answer_count', 1)
    ->assertJsonPath('items.0.created_at', 1784501445);

  // the upstream blob does not leak through
  $response->assertJsonMissingPath('items.0.operator')
    ->assertJsonMissingPath('items.0.vote_count')
    ->assertJsonMissingPath('items.0.url_title')
    ->assertJsonMissingPath('data');
});

test('requests the default limit and passes a custom one upstream', function () {
  Http::fake(['*' => Http::response(answersPayload(), 200)]);

  $this->getJson('/api/answers')->assertOk();
  Http::assertSent(fn ($request) => str_contains($request->url(), 'page_size=8')
    && str_contains($request->url(), 'order=newest'));

  $this->getJson('/api/answers?limit=15')->assertOk();
  Http::assertSent(fn ($request) => str_contains($request->url(), 'page_size=15'));
});

test('rejects a limit above the maximum or a non numeric one', function () {
  Http::fake();

  $this->getJson('/api/answers?limit=21')->assertStatus(422);
  $this->getJson('/api/answers?limit=0')->assertStatus(422);
  $this->getJson('/api/answers?limit=abc')->assertStatus(422);

  Http::assertNothingSent();
});

test('caches a successful response instead of refetching', function () {
  Http::fake(['*' => Http::response(answersPayload(), 200)]);

  $this->getJson('/api/answers')->assertOk();
  $this->getJson('/api/answers')->assertOk();

  Http::assertSentCount(1);
});

test('caches per limit, not globally', function () {
  Http::fake(['*' => Http::response(answersPayload(), 200)]);

  $this->getJson('/api/answers?limit=5')->assertOk();
  $this->getJson('/api/answers?limit=6')->assertOk();

  Http::assertSentCount(2);
});

// A transient upstream failure must not be cached, or the whole ttl serves it.
// fakeSequence, because re-calling Http::fake does not reliably replace a stub.
test('does not cache upstream failures', function () {
  Http::fakeSequence()
    ->push('nope', 500)
    ->push(answersPayload(), 200);

  $this->getJson('/api/answers')
    ->assertStatus(502)
    ->assertJsonPath('message', 'تعذر تحميل الأسئلة');

  // the retry reaches upstream, which it could not do if the 500 had been cached
  $this->getJson('/api/answers')
    ->assertOk()
    ->assertJsonPath('items.0.id', '10010000000000123');
});

// Apache Answer answers HTTP 200 with an error code in the body.
test('treats a non 200 code in a successful http response as a failure', function () {
  Http::fake(['*' => Http::response(['code' => 500, 'reason' => 'base.unknown', 'data' => null], 200)]);

  $this->getJson('/api/answers')
    ->assertStatus(502)
    ->assertJsonPath('message', 'تعذر تحميل الأسئلة');
});

test('handles a malformed upstream payload', function () {
  Http::fake(['*' => Http::response(['code' => 200, 'data' => ['count' => 0]], 200)]);

  $this->getJson('/api/answers')->assertStatus(502);
});

test('handles an upstream connection error', function () {
  Http::fake(fn () => throw new \Illuminate\Http\Client\ConnectionException('timeout'));

  $this->getJson('/api/answers')
    ->assertStatus(502)
    ->assertJsonPath('message', 'تعذر تحميل الأسئلة');
});

test('returns an empty item list when upstream has no questions', function () {
  Http::fake(['*' => Http::response(answersPayload([]), 200)]);

  $this->getJson('/api/answers')->assertOk()->assertJsonPath('items', []);
});

test('tolerates a question missing optional fields', function () {
  Http::fake(['*' => Http::response(answersPayload([
    ['id' => '10010000000000999', 'title' => 'سؤال بلا وسوم'],
  ]), 200)]);

  $this->getJson('/api/answers')->assertOk()
    ->assertJsonPath('items.0.tags', [])
    ->assertJsonPath('items.0.answer_count', 0)
    ->assertJsonPath('items.0.url', 'https://answers.syrian.zone/questions/10010000000000999');
});
