# ios: port agent token administration for trusted mobile accounts

Add server-owned owner/TTL/capability selection, one-time issuance disclosure, explicit copy/hide, status list, single revoke and superadmin revoke-all. Plaintext stays in screen memory and late replies cannot reveal it after blur, hide, account or permission changes.

Validation: Four token tests pass 23 assertions, including late response secrecy and effect replay. Root backend tests preserve owner/capability clamps, bans and scoped/wildcard-agent refusal. No real credential was issued or revoked.

Still required: Deploy the reviewed trusted-mobile policy separately, then verify authenticated token actions on the isolated test account. Revoke-all also ends mobile sessions and requires explicit confirmation. The Google website handoff is implemented without a separate iOS client; account-native06 passed synthetic browser consent, native return/adoption, dashboard access, logout and cancellation. Real Google sign-in and this token administration workflow remain unverified.

These are local review drafts. No GitHub PR, push, publication or production mutation is authorized.
