# ios: port the political organization directory

Preserve organization search, type/city/country/language filters, grid/list presentation, result counts and incremental loading. Keep available social, website, manifesto and contact links, plus the source external contribution form. Display source freshness as a readable Arabic date and time.

Validation: Native65 passed the selected public case in 94.187 seconds. Counts matched an independent public read through all four filters, exact search, list layout, internal details and return to unfiltered cards. Root inspected the retained dark card screenshot. The full public cohort passed four cases with no skips or runtime warnings. The source does not provide an organization chart or first-party contribution endpoint.

Dependencies: Shared civic models and native artwork.

Remaining checks: The current ten-record feed cannot reach the 15-row load-more branch. External organization/contribution links, refresh failures, large text and VoiceOver remain separate checks.

Local review draft only. No GitHub PR, push, deployment or production mutation has been performed for this draft.

Native76 passed the selected Party case again with zero failures, skips or runtime warnings after source-date formatting. Root inspected the dark Arabic timestamp and card capture. No external destination was opened.
