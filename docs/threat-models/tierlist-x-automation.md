# Tierlist X automation threat model

**Version:** 0.2.0
**Date:** 2026-08-30
**Status:** Implemented

## System description

The feature watches the public `best-ministers` leaderboard, prepares an Arabic
announcement after an order change settles, and publishes it to the Syrian Zone
X account. It introduces account credentials, an outbound API call, and durable
delivery records. See [ADR-0002](../adr/0002-durable-tierlist-social-outbox.md)
for the architecture choice.

## System decomposition

### External entities

| ID | Name | Description | Trust level |
|---|---|---|---|
| EU-1 | X API | Accepts signed posts and returns a remote post ID | Partial |
| EU-2 | Syrian Zone operator | Issues and rotates target-account credentials | Trusted |
| EU-3 | Tierlist voter | Changes aggregate scores through the public voting flow | Untrusted |

### Processes

| ID | Name | Description | Technology |
|---|---|---|---|
| P-1 | Rank leaderboard | Produces deterministic grouped rankings | Laravel service |
| P-2 | Detect settled change | Samples snapshots and writes the outbox | Laravel command |
| P-3 | Publish announcement | Signs and sends one stored announcement | Laravel queue job |
| P-4 | Run application | Loads credentials and supervises scheduled work | Docker and S6 |

### Data stores

| ID | Name | Contents | Sensitivity |
|---|---|---|---|
| DS-1 | Poll database | Candidates, groups, ballots, and aggregate scores | Internal |
| DS-2 | Automation state | Observed and published canonical snapshots | Internal |
| DS-3 | Social outbox | Text, status, errors, attempts, and X post ID | Internal |
| DS-4 | Production environment | OAuth consumer and account credentials | Restricted |

### Data flows

| ID | From | To | Data | Protocol | Encrypted | Boundary |
|---|---|---|---|---|---|---|
| DF-1 | EU-3 | DS-1 | Validated ballot and aggregate update | HTTPS and SQL | Yes | TB-1 |
| DF-2 | DS-1 | P-1 | Active candidates and aggregate scores | SQL | Host-local | TB-2 |
| DF-3 | P-1 | P-2 | Grouped ranking snapshot | In-process | Host-local | None |
| DF-4 | P-2 | DS-2, DS-3 | Snapshot and prepared announcement | SQL | Host-local | TB-2 |
| DF-5 | DS-4 | P-3 | OAuth credentials through server config | Process env | Host-local | TB-3 |
| DF-6 | P-3 | EU-1 | Signed authenticated-user and create-post requests | HTTPS | Yes | TB-4 |
| DF-7 | EU-1 | P-3 | Account ID, status code, and remote post ID | HTTPS | Yes | TB-4 |
| DF-8 | P-3 | DS-3 | Safe outcome and delivery identifiers | SQL | Host-local | TB-2 |

### Trust boundaries

| ID | Boundary | Between | Controls |
|---|---|---|---|
| TB-1 | Public voting edge | Internet and Laravel | Validation, vote limits, HTTPS |
| TB-2 | Application data | Laravel and MySQL | Private network, database credentials, transactions |
| TB-3 | Secret injection | VPS environment and application process | Host access control, server-only config |
| TB-4 | Social API edge | Laravel and X | HTTPS, OAuth 1.0a signature, finite timeout |

## Threat identification

### TM-X-001: Target account credential disclosure

**Element:** DS-4, DF-5, DF-6
**Category:** Information disclosure
**Description:** A log, exception, URL, database record, or committed file could
expose credentials that permit posts from the target X account.
**Attack vector:** Read application logs, source history, process diagnostics, or
an error record containing an authorization header.
**Affected assets:** Syrian Zone X account and public reputation.
**DREAD score:** D:8 R:5 E:5 A:8 D:4 = **30 (High)**
**Mitigation:** NFR-001 keeps secrets in server configuration, signs requests in
headers, stores only safe error summaries, and prohibits credential logging.
Deployment writes the environment atomically as root with mode `0600` and
clears managed credentials when their repository secret is removed.
**Residual score:** D:8 R:2 E:3 A:8 D:2 = **23 (Medium)**
**Status:** Mitigated
**Spec requirements:** FR-008, NFR-001
**ADR:** ADR-0002

### TM-X-002: Duplicate or stale announcement

**Element:** P-2, P-3, DS-2, DS-3
**Category:** Tampering and repudiation
**Description:** Overlapping detector runs, queue retries, or a deployment could
publish the same transition twice or publish an order that already reverted.
**Attack vector:** Trigger rapid votes around scheduler boundaries or replay a
queued job after partial execution.
**Affected assets:** Account quality, API spend, and reader trust.
**DREAD score:** D:5 R:7 E:5 A:7 D:5 = **29 (High)**
**Mitigation:** FR-003 through FR-007 use a settle window, a shared poll lock,
row locking, a unique transition hash, a durable relay, an atomic delivery
claim, a conditional published-state update, and no automatic retry after an
ambiguous create-post outcome. A preexisting `sending` row requires review.
**Residual score:** D:3 R:2 E:2 A:3 D:2 = **12 (Low)**
**Status:** Mitigated
**Spec requirements:** FR-003, FR-004, FR-005, FR-006, FR-007, NFR-002
**ADR:** ADR-0002

### TM-X-003: Delivery history manipulation or secret leakage

**Element:** DS-3, DF-8
**Category:** Tampering, repudiation, and information disclosure
**Description:** Missing or unsafe delivery records could hide what was sent,
misstate whether X accepted it, or retain secret-bearing diagnostics.
**Attack vector:** Modify outbox rows directly or persist raw HTTP request data
after an error.
**Affected assets:** Auditability, credentials, and incident response.
**DREAD score:** D:6 R:4 E:4 A:5 D:3 = **22 (Medium)**
**Mitigation:** FR-006 and NFR-003 store immutable prepared text, transition
identity, safe response metadata, attempt counts, and the remote ID. NFR-001
forbids raw authorization data.
**Residual score:** D:4 R:2 E:2 A:3 D:2 = **13 (Medium)**
**Status:** Mitigated
**Spec requirements:** FR-006, FR-007, NFR-001, NFR-003
**ADR:** ADR-0002

### TM-X-004: External API exhaustion or scheduler blocking

**Element:** P-2, P-3, DF-6, DF-7
**Category:** Denial of service
**Description:** X latency, rate limiting, or repeated server errors could hold
the scheduler, occupy workers, or create an unbounded request loop.
**Attack vector:** Cause frequent leaderboard changes while X is slow or
unavailable.
**Affected assets:** Queue capacity, scheduler availability, API spend, and
announcement delivery.
**DREAD score:** D:6 R:6 E:4 A:6 D:4 = **26 (High)**
**Mitigation:** NFR-002 moves network I/O to a queue job with finite timeouts.
FR-007 only retries outcomes known to be safe, and FR-010 enforces hourly and
daily preparation limits.
**Residual score:** D:3 R:2 E:2 A:3 D:2 = **12 (Low)**
**Status:** Mitigated
**Spec requirements:** FR-004, FR-007, FR-010, NFR-002
**ADR:** ADR-0002

### TM-X-005: Valid credentials belong to the wrong account

**Element:** DS-4, DF-5, DF-6, DF-7
**Category:** Spoofing and elevation of privilege
**Description:** A valid access token issued while a delegate is signed in can
post from the delegate's personal account instead of `@SyrianZone`.
**Attack vector:** Configure an OAuth token without proving the authenticated
account identity.
**Affected assets:** Personal account, Syrian Zone account, and public trust.
**DREAD score:** D:8 R:8 E:6 A:8 D:6 = **36 (High)**
**Mitigation:** FR-009 requires an authenticated-user request before every
create-post request and compares its immutable ID with `X_EXPECTED_USER_ID`.
Missing or different identity data fails closed.
**Residual score:** D:3 R:1 E:2 A:3 D:1 = **10 (Low)**
**Status:** Mitigated
**Spec requirements:** FR-008, FR-009
**ADR:** ADR-0002

### TM-X-006: Voter-driven posting and spend exhaustion

**Element:** EU-3, P-2, DS-3, DF-6
**Category:** Denial of service
**Description:** Coordinated ballots can repeatedly settle different orders,
causing unwanted public posts and pay-per-use API charges.
**Attack vector:** Alternate enough votes to reorder candidates after each
settle window.
**Affected assets:** API budget, account quality, and reader trust.
**DREAD score:** D:7 R:8 E:5 A:7 D:5 = **32 (High)**
**Mitigation:** FR-004 debounces unstable changes. FR-010 applies the hourly
interval to the latest preparation or delivery and limits daily activity to
four outbox rows by default.
**Residual score:** D:3 R:2 E:2 A:3 D:2 = **12 (Low)**
**Status:** Mitigated
**Spec requirements:** FR-004, FR-010
**ADR:** ADR-0002

## Risk summary

| Severity before mitigation | Count | Residual state |
|---|---:|---|
| Critical | 0 | None |
| High | 5 | Four reduced to low, one reduced to medium |
| Medium | 1 | Reduced within medium |
| Low | 0 | None |

## Assumptions

| ID | Assumption | Risk if wrong |
|---|---|---|
| A-1 | Production MySQL and queue worker remain available together | Detection may work while delivery stalls |
| A-2 | X accepts OAuth 1.0a user-context create-post requests | Delivery fails until the app auth mode is corrected |
| A-3 | The operator records the immutable `@SyrianZone` user ID correctly | Matching credentials and a wrong expected ID could target another account |
| A-4 | X continues to return a post ID on HTTP 201 | Success cannot be tied to a remote object |

## Residual risk

X can accept a request and then drop the connection before returning its post ID.
The system cannot prove whether that post exists without an extra timeline read.
It therefore stops automatic retries and marks the row for review. A compromised
production host can still read credentials available to the application process;
host hardening and credential rotation remain operational controls.

## Changelog

| Date | Version | Changes |
|---|---|---|
| 2026-08-30 | 0.1.0 | Initial feature threat model |
| 2026-08-30 | 0.2.0 | Added identity verification, delivery ambiguity controls, outbox recovery, poll serialization, and posting budgets |
