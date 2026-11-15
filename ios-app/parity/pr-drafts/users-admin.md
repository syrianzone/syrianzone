# ios: port user administration with guarded native transport

Preserve the Filament form, permissions, city scopes, bans, soft deletion, restore and permanent deletion. Include confirmed bulk operations, cancellation and visible partial results without inventing restrictions on source-allowed self-actions.

Validation: Native model/API and backend authorization tests pass. Independent reviews and rendered permission/selection regressions cover stale selection and literal hash-looking password handling.

User12 passed its complete selected native case in 681.926443 seconds: two owned users created, permission/city-scope edits, ban/unban, single soft-delete/restore, bulk soft-delete/restore and logout. Protected fixture accounts 101-105 stayed unchanged. Exact owned cleanup, strict runner checks, local cleanup and product restoration passed.

Remaining checks: Native permanent deletion, self-demotion/deletion, cancellation, partial-failure and broader accessibility cases remain separate from that pass. Reviewed backend aliases still need production rollout; the expanded physical-device app remains unverified. No production users were changed.

Local review draft only. No GitHub PR, push, deployment or production mutation has been performed for this draft.
