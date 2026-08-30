# Tierlist X automation security assessment

**Date:** 2026-08-30
**Scope:** Leaderboard detection, social outbox, X API delivery, credentials, and deployment workflow
**Verdict:** Code controls are ready. Production activation remains blocked on target-account credentials and live identity verification.

## Executive summary

The automation fails closed before public posting, preserves ambiguous delivery
outcomes for human review, and limits the amount of activity an untrusted voter
can trigger. The review found no unresolved critical, high, or medium code
findings in scope after remediation. The remaining risks are operational:
protecting the production host, entering the correct immutable X user ID, and
reviewing an ambiguous post against the account before any manual retry.

## Reviewed boundaries

- Public tierlist votes to deterministic leaderboard snapshots.
- Scheduler detection to durable MySQL state and outbox rows.
- Database queue delivery to X API v2 over OAuth 1.0a user context.
- GitHub Actions secrets and variables to the production environment.
- Third-party PHP and JavaScript dependencies used by the deployed image.

## Findings and disposition

| Finding | Severity | Control | Status |
|---|---|---|---|
| A worker can stop after X accepts a post but before the database records it | Medium | Atomic claim; a preexisting `sending` row moves to `needs_review` without another request | Resolved |
| HTTP 5xx or a connection loss can hide an accepted create-post request | Medium | Create-post 5xx, connection failures, and 201 responses without an ID are ambiguous and never auto-retried | Resolved |
| A valid OAuth token can belong to a delegate's personal account | Medium | Signed authenticated-user check against `X_EXPECTED_USER_ID` before every public write | Resolved |
| A committed outbox row can be lost before queue dispatch | Medium | Scheduler relay requeues pending rows on every run; queue uniqueness suppresses duplicates | Resolved |
| Older and newer ranking jobs can race or roll state backward | Medium | Poll-level cache serialization plus conditional published-hash advancement | Resolved |
| Voters can drive public posting and pay-per-use spend | Medium | Fifteen-minute settling, a sixty-minute interval from preparation or delivery, and four active posts per day | Resolved |
| Test actions inherited package-write permission and used mutable tags | Medium | Workflow-wide read permission, build-only package write, and exact action commit pins | Resolved |
| Deployment could create a broadly readable production secret file | Medium | Restrictive umask, owner-only mode, root ownership, and same-directory atomic replacement | Resolved |
| Removing a repository secret could leave the old production credential active | Medium | Managed X values always synchronize; a missing enable variable becomes `false` | Resolved |
| Incomplete credentials can consume a settled transition | Medium | Detection remains inert; a prepared row returns to `pending` if configuration disappears | Resolved |

## Verification evidence

- Feature tests block stray HTTP calls and independently validate OAuth
  signatures for both account verification and create-post requests.
- Tests cover wrong-account credentials, interrupted delivery, ambiguous HTTP
  outcomes, stale-state rollback, outbox relay, and posting budgets.
- Composer audit reports no known PHP package advisories.
- Bun audit reports no known JavaScript package vulnerabilities.
- Production image creation depends on a successful PHP test suite and frontend
  build.

## Residual risk and operating rules

X does not expose an idempotency key for post creation. A row marked
`needs_review` must be compared with the public `@SyrianZone` timeline before an
operator considers a retry. The application can verify that the configured
token and expected user ID agree, but it cannot protect credentials after a
production host compromise. Rotate all four OAuth values after suspected host,
log, or secret-store exposure.

Keep `X_TIERLIST_ENABLED=false` until the actual `@SyrianZone` owner authorizes
the app, `X_EXPECTED_USER_ID` is independently confirmed, and the first enabled
detector run creates only a silent baseline.
