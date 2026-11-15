# ios: port dashboard submissions and poll administration

Add profile/submission navigation, route history and pending withdrawal. Preserve poll metadata and core guards, group defaults/order, candidate images, archive/restore and server-owned capabilities. Show implemented native administration destinations; UsersAdmin trusts authoritative canManageUsers and defaults false for older responses.

Validation: The focused Dashboard model/render cohort passes 22 cases and 455 assertions. Its production-compiled forms check the exercised literal title/name fields without changing identifier, URL or prose traits. Civic06 separately passed the granted Transit card and its real native route/filter destination in 45.225358 seconds.

Native94 passed the complete selected poll workflow in 341.826904 seconds, with one pass and zero failures, skips or runtime warnings. Original one-call typing and exact native/API guards confirmed poll creation, title/slug edits, two groups with default/order/disable/reactivate actions and three image-free candidates with an edit. Member voting produced exactly three one-vote score rows and matching native leaderboard values. Exact owned cleanup, protected baseline checks, runner cleanup and normal source-built product restoration passed. Candidate images/archive/restore, cold cooldown and submission withdrawal were not exercised.

Native11 stopped before poll creation when its title changed during typing. Public31 passed read-only leaderboard navigation/filtering, as recorded in stats.md. User12 passed its selected user-administration workflow, as recorded in users-admin.md; permanent deletion and the other listed user edge cases remain unverified.

Native61 reached real backend checkpoints for poll creation and title/slug editing. It failed in 68.766 seconds before its first group write when native typing dropped the first two Arabic characters of the synthetic name. That field already disabled autocorrection. Owned cleanup and normal-product restoration passed. That run did not prove groups, candidates or the ballot. The cohort had one Assets pass and one Poll failure, with no skips or runtime warnings.

Native73 captured the failing first group through the fixture Read button before any group write. Its uncapped 124-event trace lost `ج` by native event 2, with contiguous counts 1 through 44 and all 44 text callbacks matching those native values. It recorded no observer detachment or early blur. The case failed, with cleanup and normal-product restoration passing. That trace alone did not distinguish UIKit insertion from a controlled native write or establish an input fix.

With the source-built RN comparison correction and diagnostic observer disabled, Native89 passed the exact native poll/title/slug, group default/order/disable/reactivate and candidate create/edit API checkpoints, including two groups and three candidates. It reached the successful ballot message and disabled submit control, then failed the backend score-count guard. Cleanup and normal-product restoration passed. The admin and legacy score-reader correction now preserves both SQLite date-only and model-midnight rows through a half-open poll-local day range; the live related backend cohort passed 39 cases and 329 assertions. Native89 remains a historical failure; Native94 is the later passing selected workflow.

Deploy reviewed backend aliases and the score-reader correction separately. All observed account writes used the isolated fixture; no production writes were performed.

Local review draft only. No GitHub PR, push, deployment or production mutation has been performed for this draft.
