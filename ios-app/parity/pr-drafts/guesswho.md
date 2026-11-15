# ios: port Guess Who rooms and native realtime

Preserve category selection, guest room creation/joining, secret portraits, turns, guesses and room state through native screens and the existing Reverb protocol. Keep the two room identities separate from the account used for privileged content management.

Include category/character creation, editing, activation, image replacement, attributes and confirmed deletion under the source capabilities.

Validation: Model/API and isolated server two-client checks pass. Community08 passed the native room flow: real presence, one selected secret caption/portrait, both players ready, acknowledged native elimination, native turn transfer and a peer guess reaching the native finished/loss state. The cohort passed both selected cases with zero failures, skips or runtime warnings; runner cleanup and product restoration passed.

The second passing case was a location-scroll diagnostic. It does not establish contribution upload. The room created for the match stays in the isolated fixture until source expiry because the source exposes no room-delete endpoint.

Remaining checks: Native join/resume, reconnection, own guessing/rematch and privileged content writes still need their own interactions. No production rooms were created. Native module and reviewed backend changes require the corresponding build and rollout.

Local review draft only. No GitHub PR, push, deployment or production mutation has been performed for this draft.
