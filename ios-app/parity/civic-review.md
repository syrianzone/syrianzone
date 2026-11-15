# Civic native review

Reviewed Population/Atlas, Compass and Promises against their website pages, controllers, rule engines and `PORTING.md`. This was a source review with isolated rendering and model tests. No production mutation, device action or native build was performed.

## Findings

### P1: deleting a Compass result leaves its queued account upload active

Native locations: `src/features/Compass/Index.tsx:47`, `:63`, `:64-67`, `:83`.

Reproduce with fixtures:

1. Complete a guest quiz and choose account save.
2. Cancel or fail login. The pending document and `pending` state retain the answers.
3. Return to history and delete that result, or delete every result.
4. Sign in later. The pending-save effect posts the deleted political answers to the account, then adds the result back to local history.

Both deletion branches remove history but leave `PENDING_KEY` and `pending` intact. Removing the queued result must also cancel its pending upload. Clear-all must clear the queue. Guard an already-started queue operation against a later deletion so completion cannot recreate the deleted record.

This is also present in the website storage helpers: `resources/js/Pages/Compass/lib/storage.ts:55-62`, `:85-101` do not clear `KEY_PENDING_SAVE`. It is an inherited privacy defect, not a claim that the website already handles this case. The native delete confirmation promises deletion, while the queued write contradicts it. `PORTING.md` prohibits fabricated political writes and requires truthful persistence behavior.

Status: fixed in native and web storage. Native `pending-save.test.ts` covers deleted-result/login, clear-all, unrelated deletion, ignored late upload completion, a failed deletion and retry after a server acknowledgement plus local storage failure. The active upload signal is aborted on deletion; an already accepted server write cannot be undone by client cancellation. An acknowledged upload is retained in memory if queue clearing fails, so retry in the same process does not post twice. Exactly-once retry after process death still needs backend idempotency.

The website regression failed for matching deletion and clear-all before the helper fix, then passed all three cases. Its Vitest test is `resources/js/Pages/Compass/lib/storage.test.ts`. Local execution used Bun's test runner with only a Vitest API shim and a mocked unused HTTP import because the website's dependencies are not installed. The native queue tests use no framework or HTTP mock.

### P2: a replaced Compass result permanently disables its image export

Native location: `src/features/Compass/Graphics.tsx:35-39`. Triggering replacement: `src/features/Compass/Index.tsx:55`, `:61`.

Start the result image export, replace the result while that export is pending, then finish the old operation. The effect aborts the old controller but does not reset `busy`. The aborted operation's `finally` deliberately avoids updating state, so the new result retains a permanently disabled export button.

The automatic aggregate-statistics response can replace the result while the independently enabled image export is running. Account-save and withdrawal responses also replace result objects.

An actual `CompassStory` render reproduced this with deferred file sharing. The failed assertion observed `disabled === true` after replacement and old-operation completion. Test artifact at discovery: `.expo/verification/compass-export-review.test.tsx`, run with `bun test ./.expo/verification/compass-export-review.test.tsx`.

Status: fixed. The effect resets export state when installing a new result controller. Tracked actual-component tests in `src/features/Compass/Graphics.test.tsx` cover recovery and an older cancelled completion not unlocking a newer export. Native export appearance remains unverified.

### P2: revoked Promise administration permission leaves the cached private editor visible

Native locations: `src/features/Promises/AdminEditor.tsx:20-21`, `src/features/Promises/AdminShared.tsx:27-28`, `src/resource.ts:29`, `src/platform/account.tsx:46-50`.

Reproduce by loading an unpublished Promise editor, then refreshing the same account after its last `promises.*` capability is revoked. Account refresh updates effective permissions without changing session generation. The admin resource becomes disabled, but the hook retains its cached data for the same loader. The editor renders whenever `resource.data` exists, so unpublished text, submitter details and sources remain visible below an access-denied header.

Backend mutation permissions still apply. This finding concerns retained private presentation, not a bypass of the server's write guards. Gate the editor body with its current read permission, or explicitly make disabled private resources hide their cached data. Preserve same-account background/refocus retention separately.

Source access rule: `routes/web.php:721-723`, `promises_admin:any`. `PORTING.md` requires server-owned capabilities and private state ownership.

Status: fixed with a synchronous capability gate around the editor body. The actual rendered test in `src/features/Promises/AdminEditor.test.tsx` keeps cached resource data present while revoking capability. It observed eleven private fields before the fix. After the fix, none of those fields renders, including the first render after revocation.

### P3: Compass omits the source's strongest-axis result

Source: `resources/js/Pages/Compass/CompassResult.tsx:64-67`, `:308-320`. Target result summary: `src/features/Compass/Index.tsx:76-77`.

The website reports the answered axis with the greatest absolute score and its positive or negative pole. Native shows consistency, answer count and all bars, but never reports that strongest-axis summary. This behavior is independent of the disabled character-name feature flag.

Status: restored. `strongestAxis` uses absolute score, original axis order for ties, and the source's pole selection, including zero. The native result displays the axis and pole. Boundary tests include unanswered axes, a stronger negative score, ties and zero.

### Root native correction: Atlas compact view rendered a string

The blind source review missed a native integration defect. `Population/Index.tsx` supplied `compact='primary'|'secondary'` to `AdaptivePanes`, which interpreted the string as rendered content. The iPhone Atlas appeared blank. Root reproduced this on the iPhone 17, changed the value to the actual selected element, and narrowed the shared prop to `ReactElement`. The fix and native rerun belong to root. Source geometry tests alone did not detect this view integration failure.

## Checked without a new finding

- Promise form-version ownership preserves the loaded version through status, timeline and unpublish responses. It sends that older version on a subsequent field save, so the backend can reject a stale form. The explicit reload action discards edits only after confirmation.
- Promise and Compass administrative routes use their exact server capability strings. Uploads retain the originating session generation and use the shared validated native image builder.
- Atlas bundles the exact original 14-province geometry, including the rural-Damascus hole, islands and Quneitra outline. Native uses even-odd SVG paths and the original data colors. Its layer/source selectors and two-province comparison rules are present.
- Missing and recorded-zero Atlas values remain distinct in the model. Environmental zero degrees uses the source color classifier.

Ran six existing test files for Atlas, Compass and Promise administration/navigation/vote state: 25 tests, 141 assertions passed. These tests do not verify iPhone gesture handling, VoiceOver, Arabic SVG shaping, actual share-sheet output, admin writes or isolated multi-account flows. No native completion claim follows from this review.
