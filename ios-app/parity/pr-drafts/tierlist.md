# ios: add native performance ratings and rankings

Preserve the poll catalogue, category selection, candidate cards and ranking, ballot validation, cooldown and leaderboard charts/filters. Export the board PNG and original candidate images. Privileged poll/group/candidate editing belongs to the native Dashboard draft.

Validation: Source models and API checks pass. The invalid cooldown document key, including its colon-bearing timestamp, now uses the existing UUID/date contract and a valid epoch key. The real store plus Tier/Promise regression cohort passes 12 cases and 57 assertions, preserving separate polls/days and without widening storage validation.

Native94 passed the complete selected local poll workflow in 341.826904 seconds, with one pass and zero failures, skips or runtime warnings. Original one-call typing and exact editor/API guards remained enabled. The member selected three own cards, moved them to S and submitted the ballot; the API confirmed one vote for each exact candidate and the native leaderboard matched its real ranks, scores and averages. Immediate submit disabling, exact owned cleanup, protected baseline checks, runner cleanup and normal-product restoration passed. Cold cooldown/expiry and export/share actions remain separate checks.

Native11 stopped at the exact new-poll title guard before creating a poll. With the source-built RN comparison correction and diagnostic observer disabled, Native89 passed the exact native editor/API checkpoints, ranked three own cards and reached the successful ballot message and disabled submit control. It then failed the backend score-count guard. Cleanup and normal-product restoration passed. Public31 separately passed read-only native leaderboard navigation and its former-member filter, as recorded in stats.md; it did not cast a ballot.

An actual HTTP regression reproduced the score-reader failure on SQLite: voting writes date-only rows, while the reader compared midnight timestamps. The admin and legacy score readers now use a half-open poll-local day range that also preserves model-created midnight rows. The live related backend cohort passed 39 cases and 329 assertions. Native89 remains a historical failure; Native94 is the later passing selected workflow.

Dependencies: Shared account, original graphics and guarded poll transport. Backend additions and the score-reader correction need their own rollout. No production votes were cast.

Local review draft only. No GitHub PR, push, deployment or production mutation has been performed for this draft.
