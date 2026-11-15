# ios: add native Transit Studio editing

Create and edit route geometry and stops with native map gestures, undo, local draft recovery and validated submission. Preserve the source distinction between anonymous new routes and authenticated linked edits.

Validation: Model/API tests cover geometry, request preparation and ownership. Native90 passed the complete selected local drawing case; controlled submission remains pending.

Studio38 failed the exact Arabic route-name guard before drawing. With correction disabled only for that proper-name field, Studio42 passed the unchanged exact-name guard, then failed the test's offscreen-map reveal in 49.222 seconds before drawing. Runner cleanup passed and restored the product. This verifies the narrow input correction, not map geometry, undo, same-process draft reopening, reset or submission.

Studio58 reached four actual native map vertices, two disconnected parts, undo and independent coordinate checks. It failed in 135.340 seconds at its first stop editor because native line hit testing consumed the route tap. The map wrapper now uses the installed public zero threshold for coordinate editing without a line-selection handler. Two production-compiled regressions passed 19 assertions for Studio stop callbacks, snapping and preserved transit line selection. The original native route tap and strict stop checks are unchanged for the retry. Stop placement, draft reopening and reset still require that native pass.

Native63 opened the actual stop-name editor from that unchanged route tap. It then failed in 132.916 seconds when typing lost characters from the exact synthetic name, before saving it or checking stop coordinates. Cleanup and normal-product restoration passed. This establishes the native map callback correction while keeping the incomplete stop workflow explicit.

Native90 passed that complete selected workflow in 257.951 seconds, with one pass, zero failures, skips or runtime warnings. The source-built RN comparison correction ran without the diagnostic observer. Exact Arabic route and stop names survived normal typing. Real MapKit taps produced four vertices in two disconnected parts; undo removed the intended vertex, and both named stops aligned with their respective parts at distinct coordinates. Same-process reopening retained the exact names and row coordinates. Visible Reset cleared only the owned drawing, and another reopening stayed empty. The city name and bounds stayed unchanged. The required pending-document preservation flag, runner cleanup and normal-product restoration passed. This supersedes the incomplete native stop/draft evidence without changing Native63's failed result.

Dependencies: Shared maps, persistence and account transport.

Remaining checks: No route submission or moderation was activated. Cold persistence, pending-login recovery and account-linked edits remain unverified. This same-process pass does not establish every RN text transformation or restyle path.

Local review draft only. No GitHub PR, push, deployment or production mutation has been performed for this draft.
