# ios: port the full privacy policy

Preserve all five policy sections with explicit native facts for coordinates, Keychain/SQLite, MapKit and actual soft deletion/Google restoration. Browser analytics consent remains a browser-scoped action because this app has no Google Analytics SDK.

Validation: Source extraction and native text/link goldens pass. Native31 passed all five policy headings, native MapKit and browser-scoped Analytics facts, and the visible privacy-preferences action on iPhone 17 in 39.397 seconds. The overall 18-case cohort had 10 passes/eight failures/zero skips.

Still required: Exercise the outbound preferences action and large-text layouts, and keep native facts aligned with future SDK/account changes.

This is a local review draft. No GitHub PR, push or publication is authorized.
