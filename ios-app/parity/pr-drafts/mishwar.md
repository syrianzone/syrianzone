# ios: port Mishwar discovery and place contributions

Preserve place search, filters, map/list switching, detail photos, directions, sharing, saved places, reports and contribution forms. Use native location and image selection.

Validation: Source-derived decoding, pagination, upload and ownership tests pass. The historical baseline covered public detail and device-local saves. After Public31's discovery failure, Native40 passed coordinate search, map/list switching and place detail in 58.550 seconds. Its ten-case cohort had eight passes, two failures and zero skips. The separate contribution validation, photo-picker cancellation, draft preservation and confirmed discard case passed account-sections-native02 in 110.316 seconds.

Native29 passed the complete owned-photo contribution case in 186.607 seconds: exact generated album/photo selection, real native multipart submission, native administrator approval and member-visible publication. Exact owned place/media API cleanup and observer logout passed. The overall cohort had one pass and two failures, with zero skips; runner cleanup passed and the product bundle was restored. This used isolated synthetic users and data.

Dependencies: Shared maps, files, account and storage.

Remaining checks: Account saves, reports, photo replacement/rotation, rejection and other owner/moderator actions need their own native verification. No production place was changed.

Local review draft only. No GitHub PR, push, deployment or production mutation has been performed for this draft.
