# ios: port hosted-file administration

Add paged file browsing, search and folder-prefix filtering with counts, native generic/photo selection, an upload-folder prefix, 50 MiB upload, actual QuickLook, explicit copy, Save to Files and confirmed deletion. ZIP backup preserves nested paths for all currently loaded files, tracks progress and reports partial failures.

Validation: Focused cohort passes 18 tests and 115 assertions, including path/duplicate/partial ZIP guards and file-name support. The shared isolated controls09 file case passed QuickLook preview/Done and SVG/PNG/ZIP share cancellation with zero runtime warnings. That run failed at a separate Toggle tap; the later native-controls14 case passed controlled native Toggle activation. Neither adapter result verifies this administration workflow.

Native61 passed the complete selected administration case in 126.423 seconds. It selected only its generated album photo, uploaded to the existing uploads prefix, verified the exact returned path and bytes, opened and dismissed native QuickLook, then confirmed deletion of that exact hosted row. Backend baseline verification, fixture cleanup and normal-product restoration passed. The overall cohort had one Assets pass, one Poll failure, zero skips and no runtime warnings.

Still required: Generic-file selection, loaded-file folder filtering and upload-prefix entry, successful Files/share/ZIP completion and exact final saved filenames. The source folder controls filter loaded file prefixes and choose the upload prefix; they expose no separate empty-folder creation, rename or deletion. Guarded JSON aliases need separate deployment. ZIP source behavior includes loaded files, not unseen cursor pages.

These are local review drafts. No GitHub PR, push, publication or production mutation is authorized.
