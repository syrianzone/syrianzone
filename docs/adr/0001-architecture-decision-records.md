---
status: proposed
date: 2026-08-30
decision-makers: [Syrian Zone maintainers]
consulted: []
informed: []
---

# ADR-0001: Architecture decision records

## Context and problem statement

Syrian Zone has useful module and deployment documentation but no durable record
of choices between architectural alternatives. The X automation introduces
state, external credentials, retry rules, and a new trust boundary. Future
changes need the original context without rewriting history.

## Decision drivers

- Preserve why a choice was made when code alone cannot show it.
- Keep implementation specifications and threat mitigations traceable.
- Avoid turning routine code details into process overhead.
- Keep accepted decisions immutable when circumstances later change.

## Considered options

1. Keep decisions in pull request descriptions only.
2. Maintain MADR records under `docs/adr`.
3. Keep a mutable architecture page with the latest choices.
4. Record every implementation detail as an ADR.

## Decision outcome

Chosen option: "Maintain MADR records under `docs/adr`", because it keeps the
context, alternatives, consequences, and confirmation method beside the code.
Accepted records remain unchanged except when a later record supersedes them.

### Consequences

**Good:**

- Important choices are reviewable and link to requirements and threats.
- Superseded decisions keep their original context.

**Bad:**

- Maintainers must decide which changes deserve a record.
- Proposed records need a status update when they are accepted or rejected.

**Neutral:**

- File numbers are sequential and never reused.

## Confirmation

Architecture-changing pull requests should include or reference an ADR. Reviewers
should reject records that describe only local implementation details.

## Pros and cons of the options

### Pull request descriptions only

- **Good**, because no new document type is needed.
- **Bad**, because decisions are hard to find after branches and reviews age.

### MADR records

- **Good**, because each choice retains its drivers and alternatives.
- **Good**, because stable IDs make cross-references practical.
- **Bad**, because records add a small maintenance cost.

### Mutable architecture page

- **Good**, because readers see the current system in one place.
- **Bad**, because edits erase why an earlier choice was reasonable.

### ADR for every detail

- **Good**, because documentation coverage would be broad.
- **Bad**, because noise would hide the decisions that matter.

## More information

- First applied by [ADR-0002](0002-durable-tierlist-social-outbox.md).
- Related spec: [Tierlist X automation](../specs/tierlist-x-automation.md).
