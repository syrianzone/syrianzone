# ios: preserve visual identity artwork and exports

Render the original identity assets and province geometry with native vectors, zoom and selection. Export the source formats through native files and sharing.

Validation: Source-derived geometry/export tests pass. The shared native SVG PNG/JPEG adapter passed with an independent pixel-content check. Public31 passed the selected identity province/vector/zoom and cancelled-export case on iPhone 17. The overall cohort had ten passes, eight failures and zero skips, with zero runtime warnings. Successful identity export/share completion and remaining vector controls still need separate proof.

Dependencies: Shared original SVG adapters and native file exports.

Remaining checks: Original artwork attribution and file names are retained.

Local review draft only. No GitHub PR, push, deployment or production mutation has been performed for this draft.
