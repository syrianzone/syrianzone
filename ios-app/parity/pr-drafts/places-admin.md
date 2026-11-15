# ios: add native place and photo moderation

Review pending places, edit approved records, resolve reports and manage photos through native sheets. Require source capabilities and validate the server's mutation acknowledgement.

Validation: Focused tests cover real source DTOs, changed-field validation and mismatched acknowledgements. Independent source review passed. Native29's owned contribution case passed in 186.607 seconds, including native approval of the exact pending member-owned place, member-visible publication and exact owned API cleanup. The overall cohort had one pass and two failures, with zero skips; runner cleanup and product restoration passed. Other photo/moderation actions remain unverified.

Dependencies: Guarded native administration transport and native image selection.

Remaining checks: Backend rollout, photo replacement/rotation/removal, rejection, reports and other moderation actions still require separate checks. Production data was not changed.

Local review draft only. No GitHub PR, push, deployment or production mutation has been performed for this draft.
