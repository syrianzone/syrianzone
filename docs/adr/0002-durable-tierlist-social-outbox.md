---
status: accepted
date: 2026-08-30
decision-makers: [Syrian Zone maintainers]
consulted: [X developer documentation]
informed: []
---

# ADR-0002: Durable tierlist social outbox

## Context and problem statement

The tierlist can reorder whenever votes or candidate status change. X posting is
an external side effect that can fail, time out after remote acceptance, or be
attempted by overlapping scheduler runs. The public page and detector must also
agree on what the ranking is.

## Decision drivers

- Keep the public leaderboard and automation order identical.
- Record a baseline without announcing old state.
- Prevent duplicate announcements across deploys and concurrent runs.
- Fail closed when credentials belong to a different X account.
- Bound public posting frequency and pay-per-use spend.
- Keep X latency and failures outside the scheduler loop.
- Preserve enough history to investigate every delivery outcome.
- Avoid repetitive posts during short-lived ranking churn.

## Considered options

1. Post directly after every ballot submission.
2. Compare rankings in Laravel cache and post from the scheduler command.
3. Use a shared ranking service, MySQL state, a durable outbox, and a queue job.
4. Run a separate hosted automation service.

## Decision outcome

Chosen option: "Use a shared ranking service, MySQL state, a durable outbox, and
a queue job", because it uses the production services already present and gives
the transition and its side effect durable identities.

The detector samples every five minutes. A snapshot must remain unchanged for
fifteen minutes before one outbox row is created. It applies a one-hour interval
from the newest preparation or delivery and a four-row daily activity limit by
default. A scheduler relay queues
pending outbox rows, including rows left behind if a process stops after the
database commit.

Detector and delivery work share a poll-level cache lock. The queue job
atomically claims pending or safely retryable rows. A preexisting `sending` row
is ambiguous and moves to `needs_review` without another network call. The job
verifies the authenticated X user ID, then sends the stored text through X API
v2 using OAuth 1.0a user context. HTTP 429 is retryable. A connection failure,
HTTP 5xx response, or accepted response without a post ID moves to
`needs_review` because a retry could duplicate a post that X already accepted.

### Consequences

**Good:**

- Baselines, pending observations, and delivery history survive deploys.
- One deterministic service defines both the page and automation order.
- External latency cannot block the scheduled detector.
- A transition hash and database constraints stop known duplicate paths.
- Pending rows are recoverable without coupling the outbox transaction to the
  queue driver.
- Wrong-account credentials fail before the public write request.
- Posting limits constrain voter-driven account activity and API spend.

**Bad:**

- Two new tables and a queue job add operational state.
- Ambiguous timeouts require a human decision before another send.
- Ambiguous create-post server responses also require a human decision.
- Announcements lag a stable order change by fifteen to twenty minutes.
- OAuth credentials must be issued for the target X account and rotated safely.

**Neutral:**

- Posting links uses X's higher pay-per-use write price.

## Confirmation

Automated tests must cover deterministic ties, silent baseline creation, settle
timing, deduplication, outbox recovery, atomic delivery claims, success
persistence, wrong-account credentials, posting limits, permanent authentication
errors, and ambiguous outcomes. Production verification must show a scheduled
detector and successful target-account verification before automation is
enabled.

## Pros and cons of the options

### Post after every ballot

- **Good**, because detection is immediate.
- **Bad**, because normal voting can create bursts and slow the submission path.
- **Bad**, because candidate edits and archives bypass ballot submission.

### Cache and scheduler posting

- **Good**, because it needs little schema work.
- **Bad**, because cache clearing during deploy can lose the baseline.
- **Bad**, because a scheduler timeout can overlap the next run.

### Database state, outbox, and queue

- **Good**, because state and delivery attempts are durable and inspectable.
- **Good**, because database uniqueness can enforce transition deduplication.
- **Bad**, because cleanup and operational review become ongoing concerns.

### Separate automation service

- **Good**, because social delivery is isolated from the web process.
- **Bad**, because it adds another deployment, secret store, and data access path.
- **Bad**, because its ranking logic can drift from the Laravel application.

## More information

- Implements [FR-001 through FR-010](../specs/tierlist-x-automation.md#functional-requirements).
- Mitigates TM-X-001, TM-X-002, TM-X-003, and TM-X-004 in the
  [feature threat model](../threat-models/tierlist-x-automation.md).
- Uses the ADR process in [ADR-0001](0001-architecture-decision-records.md).
