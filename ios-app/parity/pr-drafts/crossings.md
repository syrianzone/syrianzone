# ios: add native border crossing information

Preserve the 20 bundled crossings and ports, grouped search, Damascus clock and schedule/override status calculation. Map markers and list rows select the same detail sheet, with work windows, WhatsApp, directions and status-sharing links.

Validation: Source-derived models passed. Public28 passed the 20-to-one Nassib search, detail fields and native map/list switching with the search retained. Marker activation, schedule boundaries and outbound actions remain pending. The overall public28 cohort had eight passes and six failures.

Dependencies: Shared maps and native artwork.

Remaining checks: Verify opening/closing transitions, foreign device timezones, marker/list selection, contact and share actions. Status comes from the bundled source schedule and overrides, with its source/as-of caveat. There is no live status service to claim.

Local review draft only. No GitHub PR, push, deployment or production mutation has been performed for this draft.
