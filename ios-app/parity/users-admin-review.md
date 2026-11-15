# User administration review

The review compared the native screen/model/client and new JSON backend with `app/Filament/Resources/UserResource.php`, its create/edit/list pages, `UserPermissionForm`, the user model's hashed cast, and the installed Filament bulk actions. No native build, simulator action, production request or authenticated transport addition was performed.

## Fixed findings

### P1: An obsolete select-all result could enable destructive actions for another search

Reproduction: load a user search, start selecting all matching users, type a new search while selection is pending, wait for the new results, then resolve the old selection. The search input remained editable while the request ran. Its old snapshot was adopted after the new search cleared selection, making the bulk controls act on records outside the displayed results.

The actual rendered screen test reproduced this state. `UsersAdmin/Index.tsx` now increments a selection revision whenever search or filters change, clears selection immediately, aborts an active selection, and checks its captured revision before adopting a completed snapshot. The revision check also rejects obsolete results from an adapter that resolves after cancellation. The previously failing rendered test passes.

A separate narrow hostile review confirmed the revision guard still rejects the stale result when a same-turn stale phase closure misses the abort. No additional blocker was found.

### P2: A password resembling a stored hash was accepted as the stored credential

Filament always applies `Hash::make` to a submitted nonempty password. `UserAdministrationService::formData` instead passed the input directly to the user's `hashed` cast, which recognizes existing bcrypt hashes. Submitting a bcrypt-looking literal therefore installed that hash instead of making the submitted literal the password.

Both create and update API regressions failed at `Hash::check(submittedLiteral, storedPassword)` before the fix. The service now explicitly hashes filled password input. Both regressions then passed, including the inverse check that the hash's original underlying password does not work. Existing omitted/blank edit-password behavior remains covered. A separate narrow hostile review confirmed this matches Filament's dehydration behavior.

## Reviewed behavior

- A same-session role/permission refresh remounts the private document. The rendered regression confirms cached private list/editor data disappears while replacement access remains unresolved.
- Cancelling selection rejects a late complete snapshot rather than adopting partial rows. A rendered regression passes alongside the client cancellation tests.
- Partial bulk completion retains only unconfirmed records as selected and reports the confirmed count. The rendered regression and client batch identity tests pass.
- Bulk acknowledgements bind exact IDs and self-deletion state. Later batches stop after cancellation; the current account remains last in a larger selection.
- The server rechecks the actor and target versions inside a transaction. The new tests preserve self-demotion and self-deletion, rather than adding a last-admin or self-action prohibition.
- Unknown stored permissions and unrelated scopes remain server-owned. Native editing sends known checkbox choices and preserves legacy scope IDs only for the selected record.

## Verification and limits

`php artisan test --compact tests/Feature/NativeUserAdministrationTest.php` passed 11 tests with 114 assertions. The two new password cases were red first. Pint passed for the service and backend test.

The focused native model/client/rendered screen suite passed 19 tests. The stale-search selection case was red first. Whole-tree JavaScript tests passed 444 tests with 4852 assertions across 125 files. Typecheck and owned lint passed. The final test-only query adjustment for React 19 typing passed the rendered suite again.

Those source fixtures did not establish native runtime behavior. Root subsequently completed User12 in 681.926443 seconds with strict selected-case/local-cleanup/product-restoration success. It covered two owned native creations, scoped permission editing, ban/unban, single and bulk soft-delete/restore, protected 101-105 invariants, exact owned cleanup and logout. Permanent-delete/self-action/cancellation/partial-failure and broader keyboard/accessibility cases remain separate. No production user data was changed.
