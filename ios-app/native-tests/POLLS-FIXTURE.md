# Local Polls interaction cases

`NativePollsUITests.swift` is authored and has passed strict SDK typechecking and independent source review. Neither case has run on a simulator. These checks do not establish native success.

Both cases require the existing account-fixture runner, its exact `https://127.0.0.1:9443` origin and private gate, and the verified synthetic native account banner. The observer separately verifies administrator 103 through `/api/v1/user`. It refuses physical devices, other processes, redirects, cookies, stored credentials and other origins. No production data or real account is used.

The first case enters Transit administration through the actual permitted Dashboard card, selects the native routes section and checks its search field. It makes no write.

The second case creates a fresh UUID-named poll through the native editor. It edits the title and slug, creates two groups, changes the first group's default/order/enabled state, creates three image-free candidates and edits the first. Every nonsecure text input must exactly match its expected synthetic value before a write can proceed. Fresh server reads must confirm each native action before the next one begins.

The member then opens that exact custom poll, selects the three candidates, moves them into tier S and sends the ballot through the native UI. The test requires the successful response and disabled submit control, exactly one score contribution for each candidate, and matching real public leaderboard rows. The source ballot is device-identified and credential-free even when the synthetic member banner is visible. This case does not establish user-identified voting or exercise image upload.

The observer performs reads, deletes only its own recorded poll and revokes only its own token. It cannot create or edit polls, groups or candidates, or submit ballots. Before the UI creates anything, it records every existing poll and the core `best-ministers` editor data. Both fresh title/slug variants must be absent. The source poll DTO does not assign an owner account, so ownership here is established by the new UUID, exact nonce-bearing title and slug, absent baseline and bounded synthetic children, rather than an invented owner field.

Cleanup uses the existing `DELETE /api/v1/admin/polls/{id}` only for that recorded non-baseline, non-core UUID. It compares the fresh complete poll/group/candidate state with the last confirmed native action and checks the protected baseline again. Unexpected edits are retained and fail cleanup. The source delete is a hard delete with related-data cascades; the test requires HTTP 204, absence from the admin list and 404 responses for the poll and recorded groups. Its private runner-cache journal contains synthetic IDs and names, never tokens. Failed cleanup leaves that journal for inspection.

The source DELETE has no atomic version condition. A concurrent edit between the final matching read and delete remains outside this guard, so these cases must run serially without another writer to their UUID. The test never modifies or deletes the seeded core or another baseline poll.

Actual native checks remain pending: Dashboard arrival, modal keyboard scrolling, picker values, group/candidate action labels, multi-card selection, ballot cooldown and leaderboard rendering. A completed run must report each case and teardown separately.
