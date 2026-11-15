# ios: bring promise tracking and administration to iPhone

Preserve filters, details, original visual summaries, voting and statistics. Include sources/timeline, methodology, suggestion and speaker lookup, reports, link/image sharing and capability-gated review, editors, rules, directories and logs.

Validation: Native13 passed both isolated Promise cases. Suggestion validation and retained title/quote/source editing passed in 82.993673 seconds without submitting a valid suggestion. The owned-promise case passed in 326.338943 seconds.

The owned case created and edited its UUID promise, published it, exercised public filters/layout and detail-return state, changed a native Yes vote to No, verified the corresponding server tallies and local choice, and retained that choice after a cold restart. Exact owned cleanup preserved the synthetic speaker and protected baseline. The source delete retains a soft-deleted tombstone.

Native10 exposed an invalid local vote-document key. The corrected key roundtrips through the real document-store contract. A separate production-compiled regression proved a stale tally with unchanged card props; reactive state/tally snapshots now pass the async first-choice and changed-choice case. The focused model/state/store/render cohort passes 10 cases and 64 assertions. Native13 subsequently verified both changed-choice tallies and persisted choice through the product UI.

The native cases use the verified synthetic speaker baseline and UUID-owned promises. Cleanup preserves the source soft-delete policy. See native-tests/PROMISES-FIXTURE.md.

Remaining checks: Valid suggestion submission, reports, sharing/export, ruler/review actions and privileged directories/logs need their own native results. The Native13 cohort also contained two failures in other sections and is not a whole-cohort pass. Native/backend write aliases need separate rollout. No production votes or promise edits were made.

Local review draft only. No GitHub PR, push, deployment or production mutation has been performed for this draft.
