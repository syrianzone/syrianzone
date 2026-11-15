# Local Promises interaction cases

`NativePromisesUITests.swift` uses the product UI and source server contracts. Native13 passed both selected Promise cases: suggestion validation/retained editing in 82.993673 seconds and the owned-promise workflow in 326.338943 seconds. Two other sections failed in that cohort, so these results do not establish a whole-cohort pass.

Both cases require the existing account-fixture runner, the exact `https://127.0.0.1:9443` origin and private gate, and the native verified member/admin banner. The observer independently verifies synthetic administrator 103 through `/api/v1/user`. Cookies, credential storage, redirects and remote origins are refused. No real Google flow, production account, public vote or remote promise is used.

The write case requires this approved baseline speaker in the isolated fixture:

| Field | Exact value |
| --- | --- |
| ID | `50000000-0000-4000-8000-000000000001` |
| Name | `مسؤول الوعود التجريبي المحلي` |
| Title | `شخصية خيالية للاختبار` |
| Status | `approved` |

The test requires the existing row and leaves it untouched. Fixture provisioning belongs to the isolated server owner. Missing or mismatched baseline data fails preflight. The test does not seed records, reset the database or select another person as a fallback. Selecting a source candidate would materialize another speaker, which cannot be removed through supported APIs once a soft-deleted promise references it.

The isolated fixture owner provisioned and verified this baseline on 2026-11-14. Its invalid-gate check made zero writes, the authorized operation made exactly one speaker insert, and the idempotent repeat made zero writes. No reset, cache clear or other row mutation was performed. This is fixture setup evidence, not execution of either native case.

The validation case submits an empty suggestion and requires its four actual client errors. It then edits title/quote/source, adds and removes a second source, and verifies retained field values without making a valid submission. The observer verifies that no promise was created and no preexisting promise row changed.

The write case creates a fresh UUID-named promise through the native administrator form, edits its title and requires exactly one editor-version increment, then publishes through the native action. Source publication changes review state without increasing that editor version. The member filters zero and one result, requires the native sort value and selected list segment to change, opens the exact quote and returns to the retained search. Actual native Yes then No actions must produce public tallies `(1,0)` then `(0,1)`, and the checked No choice must survive a real app restart. The observer never performs create, edit, publish or vote requests.

Cleanup uses only the source `DELETE /api/v1/admin/promises/{id}` for the recorded non-baseline UUID. It revalidates the unique title, quote, author, speaker and single source, and compares the fresh version and full admin payload with the last confirmed native write. Unexpected edits are retained and fail cleanup. A second matching read occurs immediately before DELETE. The source DELETE has no atomic version condition, so a concurrent edit between the final read and delete remains outside this guard; these fixture cases run serially without another writer to their UUID. Cleanup then requires `{success:true}`, absence from the admin list and 404 responses for its editor/public detail. The source operation is a soft delete: its local tombstone, sources, votes and history remain. There is no force-delete API, and the test does not bypass that policy. A private runner-cache record contains synthetic identity/version data and no token; failed cleanup retains it for inspection. The observer revokes only its own token on teardown.

The validation case failed after 45.071 seconds when the quote field was visible but the older shared reveal helper could not expose it as hittable. The test now verifies the complete title and uses the normal Return key before entering the quote. The write case failed after 62.047 seconds because the generic speaker-search input lost part of the typed Arabic name and correctly returned no matches. The speaker picker now uses the existing search control with autocorrection disabled. The test still enters and verifies the full Arabic name, then requires the exact filtered baseline speaker. It has no unfiltered fallback.

The actual 02 cohort did not prove create/edit/publish, sort/list controls, list-return state or vote persistence. Native13 subsequently passed those named interactions, including native Yes-to-No server tallies, local choice, cold-restart persistence, exact owned cleanup and unchanged protected baseline. The suggestion case also passed its no-valid-submission and retained-field assertions. Independent source review tightened cleanup version/payload checks and prevented a persisted layout preference from masking a no-op callback. These cases do not prove a valid public suggestion submission, reports, export, ruler/review actions or all privileged directories.
