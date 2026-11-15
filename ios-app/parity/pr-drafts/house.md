# ios: bring parliament information to native screens

Preserve members, source filters, detail information and seating diagrams with native interaction and scalable original artwork.

Include the current roster, linked seat-legend facets and member social links, plus the lazy historical archive. Preserve all four archive modes, governorate sheets, mode-specific filters, numeric/text sort, new-name comparison and sex/age charts.

Validation: The real-roster, selected filter and seating graphic case passed in account-sections-native02 in 86.100 seconds. Native65 passed both historical cases: four modes, result filtering, district-control visibility, real numeric age sorting and an internal record sheet in 125.505 seconds; sex filtering against chart totals, the sex chart, empty-search/reset and the source new-name comparison sheet in 67.913 seconds. The complete public cohort passed four cases with no skips or runtime warnings. It opened no external destination or CSV export.

Dependencies: Shared civic models and native artwork.

Remaining checks: Actual district/province selection, every dynamic column, age-chart controls, CSV failure/retry, large text and VoiceOver.

Local review draft only. No GitHub PR, push, deployment or production mutation has been performed for this draft.
