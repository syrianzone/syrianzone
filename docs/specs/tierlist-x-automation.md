# Tierlist X automation specification

**Version:** 0.4.0
**Date:** 2026-08-31
**Status:** Implemented

## Purpose

Syrian Zone should announce meaningful changes to the public `/tierlist`
leaderboard on the `@SyrianZone` X account. The announcement should bring
people back to vote without flooding the account when several ballots arrive
close together.

This feature covers the `best-ministers` poll. It does not add an editor,
change voting rules, or announce score-only changes that leave the order intact.

## Discovery and gap analysis

The public page and API currently calculate the leaderboard inside
`PollController`. There is no reusable ranking component, fixed tie order,
change detector, delivery record, or X posting client. Production already runs
Laravel's scheduler once per minute and a database queue worker, so the feature
does not need a second scheduler or deployment service.

The authoritative input is the active candidates and their accumulated
`daily_scores`. The controller sorts rounded averages without a final tie
breaker, which means equal averages can move between reads even when no data
changes. The ranking calculation must move into one service that both the page
and automation use.

## Architecture assessment

The existing Laravel process, MySQL database, scheduler, and queue can own the
whole workflow. A scheduled detector reads the same leaderboard service as the
public endpoint. It stores observed state and durable outbox rows in MySQL. A
queued job signs an account identity check and a create-post request with the X
account's OAuth 1.0a credentials, then stores the returned post ID.

This keeps detection fast, survives deploys, and separates an external timeout
from the scheduler loop. See [ADR-0002](../adr/0002-durable-tierlist-social-outbox.md)
for the decision and
[the feature threat model](../threat-models/tierlist-x-automation.md) for the
trust-boundary analysis.

## Functional requirements

### FR-001: Shared deterministic leaderboard

The system SHALL calculate the public leaderboard and automation snapshot with
one service. Within each group it SHALL order candidates by rounded average
descending, vote count descending, configured candidate sort ascending, then
candidate ID ascending.

**Acceptance criteria:**

- The public endpoint keeps its current response shape.
- Repeated reads of tied data return the same order.
- `test_leaderboard_uses_deterministic_tie_breakers()` covers the tie order.

### FR-002: Canonical order snapshot

The system SHALL build one versioned snapshot per group from the normalized
group key and ordered active candidate IDs. Each group carries its own hash,
settle clock, and state row, so every tierlist is detected and announced
independently. The hash SHALL exclude names, scores, vote totals, and
timestamps.

**Acceptance criteria:**

- Score-only changes do not change the hash.
- Candidate moves, group moves, archive changes, and restore changes do.
- `test_snapshot_hash_only_changes_when_order_changes()` covers the boundary.

### FR-003: Silent production baseline

The first detector run for the configured poll SHALL store the current snapshot
without creating an X post.

**Acceptance criteria:**

- A new state row contains the observed and published snapshot.
- No outbox row or queued posting job is created.
- `test_detector_records_the_first_snapshot_without_posting()` covers the flow.

### FR-004: Settled change detection

The production scheduler SHALL sample the ranking every five minutes. A changed
order SHALL become publishable only after the same new snapshot remains current
for fifteen minutes. A return to the published snapshot SHALL clear the pending
change.

**Acceptance criteria:**

- A transient order change does not create an outbox row.
- A stable order change creates exactly one pending outbox row.
- `test_detector_waits_for_a_stable_change()` and
  `test_detector_discards_a_reverted_change()` cover both paths.

### FR-005: One announcement per group transition

The system SHALL create one Arabic announcement for each settled transition
of each group. The text SHALL name that group's top riser and top faller
with their title and X handle when known, invite readers to vote, and link
to `https://syrian.zone/tierlist`. The snapshot SHALL exclude the satirical
jolani group. A transition without a nameable movement (a candidate left the
ranking) SHALL advance that group's published state silently instead of
posting. The exact text SHALL be stored before delivery and SHALL fit X's
post length limit, dropping the title and then the handle from a line when
space runs out. The posting budget (FR-010) spans the poll, so simultaneous
changes in several groups announce one group per interval window.

**Acceptance criteria:**

- Concurrent detector runs cannot create duplicate transition rows.
- An unchanged snapshot never creates another announcement.
- A jolani-only order change never creates a transition.
- `test_detector_deduplicates_a_settled_transition()`,
  `test_post_text_fits_x_limit()`,
  `test_snapshot_ignores_the_jolani_group()`, and
  `test_detector_adopts_an_unnameable_order_change_without_posting()` cover
  the behavior.

### FR-006: Durable delivery record

The queued job SHALL atomically claim a pending or retrying row, post through X
API v2, and record the remote post ID, attempt count, status, response code, and
timestamps in the outbox. A scheduler relay SHALL queue pending rows on every
detector run. The job SHALL return immediately when the row is already posted.

**Acceptance criteria:**

- A successful HTTP 201 response marks the row posted.
- A second run does not send another request.
- A pending row left before queue dispatch is relayed on the next scheduler run.
- A row already marked `sending` moves to `needs_review` without another request.
- `test_x_job_persists_the_remote_post_id()` covers successful delivery.

### FR-007: Bounded failure handling

The job SHALL retry a clear HTTP 429 response with queue backoff. It SHALL not
retry HTTP 400, 401, or 403 responses. A create-post connection failure, HTTP
5xx response, or HTTP 201 response without a usable remote ID SHALL be marked
for review because X does not offer an idempotency key for post creation.

**Acceptance criteria:**

- A 429 response leaves the row retryable and releases the job.
- An ambiguous create-post outcome marks the row `needs_review`.
- An authentication failure marks the row failed and reports the exception.
- `test_x_job_retries_transient_responses()`,
  `test_x_job_stops_on_authentication_failure()`, and
  `test_x_job_marks_ambiguous_timeouts_for_review()` cover these cases.

### FR-008: Safe operational switch

The detector and posting job SHALL remain inert unless production explicitly
enables them and every OAuth credential plus the expected X user ID is present.
If configuration disappears after preparation, the job SHALL return the row to
`pending` so it can be relayed after configuration is restored.

**Acceptance criteria:**

- Local, test, and staging schedules do not register the detector.
- Missing configuration prevents baseline and outbox mutation.
- Missing configuration at delivery prevents a network request without
  consuming the transition.
- `test_detector_does_not_consume_a_transition_with_incomplete_configuration()`
  covers the guard.

### FR-009: Target account verification

Before every create-post request, the client SHALL call X's authenticated-user
endpoint with the same OAuth credentials and SHALL compare the returned ID with
`X_EXPECTED_USER_ID`. A missing or different ID SHALL fail closed.

**Acceptance criteria:**

- A token for another account never reaches the create-post endpoint.
- Both the identity and create-post requests use independently verifiable OAuth
  1.0a signatures.
- `test_x_client_refuses_credentials_for_another_account()` covers the mismatch.

### FR-010: Posting budget

The detector SHALL enforce a minimum interval from the newest preparation or
successful public delivery, whichever happened later, plus a daily activity
limit for each poll. Budget exhaustion SHALL preserve the observed ranking so
it can be reconsidered later.

**Acceptance criteria:**

- The default minimum interval is sixty minutes.
- The default daily limit is four prepared or delivered announcements.
- Budget exhaustion does not create an outbox row.
- A delivery attempt within the minimum interval of the newest successful
  delivery returns the row to pending instead of posting.
- `test_posting_budget_enforces_the_minimum_interval()` and
  `test_posting_budget_enforces_the_daily_limit()` cover both limits.

## Non-functional requirements

### NFR-001: Secret handling

OAuth credentials SHALL come from server-side configuration. Deployment SHALL
write that configuration atomically with owner-only permissions and SHALL clear
managed values removed from the secret store. Application logs, outbox records,
exception messages, and HTTP request URLs SHALL NOT contain any credential or
authorization header. This mitigates TM-X-001 and TM-X-003.

### NFR-002: Scheduler isolation

The detector SHALL complete database work without waiting for X. Detector and
delivery work for one poll SHALL share a finite cache lock, and each state
change SHALL use a database transaction with row locks. Published state SHALL
only advance from the transition's expected prior hash. This mitigates TM-X-002
and TM-X-004.

### NFR-003: Traceability

Every attempted announcement SHALL retain the transition hash, prepared text,
status, attempt count, last safe error summary, and remote post ID when known.
This mitigates TM-X-003.

### NFR-004: Deployment gate

The production image build SHALL depend on the PHP test suite. A failed test
run SHALL prevent deployment.

## Configuration

| Name | Default | Meaning |
|---|---:|---|
| `X_TIERLIST_ENABLED` | `false` | Enables detection and delivery |
| `X_TIERLIST_POLL_SLUG` | `best-ministers` | Poll watched by the detector |
| `X_TIERLIST_SETTLE_MINUTES` | `15` | Stable period before publishing |
| `X_TIERLIST_MIN_POST_INTERVAL_MINUTES` | `720` | Minimum time between prepared announcements |
| `X_TIERLIST_DAILY_POST_LIMIT` | `2` | Maximum prepared or delivered announcements per poll and day |
| `X_API_BASE_URL` | `https://api.x.com` | X API host or test double |
| `X_API_KEY` | empty | OAuth consumer key |
| `X_API_SECRET` | empty | OAuth consumer secret |
| `X_ACCESS_TOKEN` | empty | Target account access token |
| `X_ACCESS_TOKEN_SECRET` | empty | Target account token secret |
| `X_EXPECTED_USER_ID` | empty | Immutable X user ID required for the target token |

## Weekly and monthly cards

Besides change announcements, the account posts a top-3 and bottom-3 image
card per group (ministers, governors, security) every Friday evening and on
the last day of each month, Damascus time.

- `scripts/tierlist-card/render.mjs` renders the cards from the public
  leaderboard API with headless chromium: 1080x1350 at 2x, Al Jazeera font,
  the Syrian Zone logo, candidate photos, plus a caption file per group.
- The `tierlist card` workflow renders on schedule, uploads the cards as an
  artifact for the record, copies them to the server, and posts each one
  through `tierlist:post-card`, which uploads the image via
  `/2/media/upload` and attaches it to the post. No human approval step;
  the maintainer chose automatic posting.
- The caption follows the maintainer's format (rank, name, title, handle)
  and self-trims to the 280 limit: titles drop first because the image
  already shows them, handles only as a last resort.
- Candidate handles come from `candidates.x_handle`; a candidate without a
  personal account carries the official account of their ministry or
  governorate, and security commanders carry the interior ministry.
- Cards bypass the outbox on purpose: the workflow run log, its artifact,
  and the X account record the outcome. The change detector's budget does
  not apply to cards.

## Out of scope

- Posting historical rankings during baseline initialization.
- Editing or deleting an X post after delivery.
- Browser-driven posting or credential capture.
- Supporting arbitrary polls in the first release.

## Verification matrix

| Requirement | Evidence |
|---|---|
| FR-001, FR-002 | Leaderboard and snapshot unit or feature tests |
| FR-003, FR-004, FR-005 | Detector feature tests with time control and queue fakes |
| FR-006, FR-007, FR-008 | Outbox and X job tests with stray HTTP requests blocked |
| FR-009, FR-010 | Wrong-account, OAuth signature, interval, and daily budget tests |
| NFR-001, NFR-003 | Secret redaction assertions and outbox persistence tests |
| NFR-002 | Schedule inspection plus overlap and transaction tests |
| NFR-004 | CI workflow dependency and a successful workflow run |
