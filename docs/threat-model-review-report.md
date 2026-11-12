# X automation repair threat model review

Date: 2026-11-12. Scope: bounded answer discovery and safe X command diagnostics.
This review doesn't assess the rest of the application or claim that rejected
production credentials have been repaired.

## Data flow review

The existing model contains six threats. The repair adds the previously omitted
account-status command as P-5 and its operator output as DF-9. It uses the same
configured credentials, expected account ID, HTTPS endpoint, and restricted host
or workflow access as the existing client. No endpoint, principal, credential
store, schema, or dependency is added.

| Concern | Review result |
|---|---|
| Spoofing and privilege | Expected-account verification remains in place; status checks don't publish |
| Tampering | Upstream HTTP failures remain failures; pagination stops from API counts or empty pages |
| Repudiation | CLI failures retain the numeric HTTP status alongside the fixed local message |
| Information disclosure | Diagnostics exclude raw response bodies, request headers, and credential values |
| Denial of service | Existing request timeouts and pagination page limits remain bounded |

## Risk and mitigation deltas

TM-X-001 and TM-X-003 cover the diagnostic output. The added metadata is a
numeric HTTP status, so their existing DREAD and residual scores don't change.
FR-011 in the [specification](specs/tierlist-x-automation.md) records that output
contract. FR-012 records pagination behavior. The implementation continues
[ADR-0002](adr/0002-durable-tierlist-social-outbox.md), which already requires
safe response metadata; no architectural decision is superseded.

The existing model uses the historical status label `Mitigated`. This scoped
review doesn't relabel those entries as newly verified controls. The relevant
regression evidence is `tests/Feature/XDiagnosticsTest.php` and
`scripts/answers-card/render.test.mjs`; their execution and live verification
belong to the repair's release checks.

## Remaining operational checks

Run the read-only account-status check against the deployed image. A green
deployment or successful image render isn't proof that X accepted a public
post. Review failed or ambiguous historical delivery records before releasing
them, and verify a returned public post ID before reporting delivery recovered.
