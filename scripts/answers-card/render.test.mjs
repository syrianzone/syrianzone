import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import test from 'node:test'

const run = promisify(execFile)
const renderer = fileURLToPath(new URL('./render.mjs', import.meta.url))
const questionPath = '/answer/api/v1/question/page'
const answerPath = '/answer/api/v1/answer/page'

async function renderWithApi(responseFor, args = []) {
  const requests = []
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost')
    requests.push(url)
    const body = responseFor(url)
    response.writeHead(body === null ? 404 : 200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body === null ? { code: 404 } : { code: 200, data: body }))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const base = `http://127.0.0.1:${server.address().port}`
    try {
      return { ...await run(process.execPath, [renderer, '--base-url', base, '--pages', '10', ...args]), requests }
    } catch (error) {
      return { error, requests }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

function pageOf(total, url, makeRow) {
  const page = Number(url.searchParams.get('page'))
  if (page > Math.max(1, Math.ceil(total / 20))) return null
  const start = (page - 1) * 20
  return { count: total, list: Array.from({ length: Math.min(20, Math.max(0, total - start)) }, (_, i) => makeRow(start + i)) }
}

function assertFinished(result) {
  assert.equal(result.error, undefined, result.error?.stderr)
  assert.match(result.stdout, /no new answers/)
}

for (const total of [0, 13, 20, 21, 40]) {
  test(`question pagination stops at the last page for ${total} questions`, async () => {
    const result = await renderWithApi((url) => url.pathname === questionPath
      ? pageOf(total, url, (i) => ({ id: String(i + 1), answer_count: 0 }))
      : null)
    assertFinished(result)
    assert.equal(result.requests.length, Math.max(1, Math.ceil(total / 20)))
  })
}

test('question pagination respects the configured page limit', async () => {
  const result = await renderWithApi((url) => pageOf(100, url, (i) => ({ id: String(i + 1), answer_count: 0 })), ['--pages', '2'])
  assertFinished(result)
  assert.equal(result.requests.length, 2)
})

test('an empty question page stops pagination even when the count is stale', async () => {
  const result = await renderWithApi(() => ({ count: 100, list: [] }))
  assertFinished(result)
  assert.equal(result.requests.length, 1)
})

for (const total of [0, 13, 20, 21, 40, 80]) {
  test(`answer pagination stops at the last page or its three-page limit for ${total} answers`, async () => {
    const result = await renderWithApi((url) => {
      if (url.pathname === questionPath) return { count: 1, list: [{ id: '1', answer_count: Math.max(1, total) }] }
      if (url.pathname === answerPath) return pageOf(total, url, (i) => ({ id: String(i + 1), question_id: '1', create_time: 0 }))
      return null
    })
    assertFinished(result)
    assert.equal(result.requests.filter((url) => url.pathname === answerPath).length, Math.min(3, Math.max(1, Math.ceil(total / 20))))
    assert.equal(result.requests.filter((url) => url.pathname === questionPath).length, 1)
  })
}

test('an empty answer page stops pagination even when the count is stale', async () => {
  const result = await renderWithApi((url) => url.pathname === questionPath
    ? { count: 1, list: [{ id: '1', answer_count: 100 }] }
    : { count: 100, list: [] })
  assertFinished(result)
  assert.equal(result.requests.filter((url) => url.pathname === answerPath).length, 1)
})

test('a real question endpoint 404 still fails the render', async () => {
  const result = await renderWithApi(() => null)
  assert.equal(result.error?.code, 1)
  assert.match(result.error.stderr, /api fetch failed 404: \/answer\/api\/v1\/question\/page/)
})

test('an answer endpoint 404 still fails the render', async () => {
  const result = await renderWithApi((url) => url.pathname === questionPath
    ? { count: 1, list: [{ id: '1', answer_count: 1 }] }
    : null)
  assert.equal(result.error?.code, 1)
  assert.match(result.error.stderr, /api fetch failed 404: \/answer\/api\/v1\/answer\/page/)
})
