# ios: preserve full transit browsing and native maps

Browse cities, routes, fares and stops using Apple Maps. Preserve selected route geometry, nearby-stop consent, Arabic search, route sharing and canonical city links.

Validation: Source-derived model/API tests pass. Public31 passed the selected city/route read and native-map-control case on iPhone 17. The overall cohort had ten passes, eight failures and zero skips, with zero runtime warnings. This later result does not change the earlier public-interactions02 failure.

Dependencies: Shared maps, location and route-link changes.

Remaining checks: Nearby-stop permission acceptance/denial, shared-route reopening, directions and remaining route/map interactions need separate native checks.

Local review draft only. No GitHub PR, push, deployment or production mutation has been performed for this draft.
