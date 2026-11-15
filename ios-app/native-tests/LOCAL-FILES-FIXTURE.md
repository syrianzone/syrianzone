# Local Save to Files interaction

`NativeLocalFilesUITests.swift` is authored for the adapter entry. Strict SDK typechecking, whole-app TypeScript and adapter lint pass. The case has not run on a simulator, so system labels, file-row accessibility and preview behavior remain unverified.

Run only on the English-language iPhone Simulator with the adapter fixture. The case refuses a physical device, another runner or missing exact adapter metadata. Production `index.ts` and `App.tsx` do not import the fixture.

The adapter exposes a mount-stable UUID and exact PNG filename before exporting. Its added button calls the existing shared `shareSvgPng` implementation with that filename. It uses the existing native SVG and image path; this case does not repeat the separate pixel-dimension checks or treat a returned share promise as proof of saving.

Before the first Files creation, the test writes a private recovery journal in the UI-test runner's cache. It records the UUID, exact folder and filename, `On My iPhone` location and observed phase. It contains no credentials. An unresolved earlier journal refuses another run. The test does not inspect the app sandbox, Photos database or other files through a filesystem API.

The case opens Files, requires the actual Browse/Locations screen and explicitly selects its unique `On My iPhone` provider row. A folder with the same name cannot establish that location. Unknown starting navigation fails closed. The case searches for the exact UUID folder and requires no result before creating it. The exact name must be present in the native New Folder prompt. The new folder must be an immediate child of the proven local root and show no items. The real system Save to Files activity establishes its local provider through Browse/Locations again, then saves the generated PNG into that recorded empty folder without renaming it.

After the share returns, the case reopens Files and requires exactly one file with the recorded name. It opens that file in the system preview, checks its exact title and a full image accessibility element, and retains a preview screenshot. This native preview assertion is intentionally unproven until the first run; an unknown hierarchy fails with accessibility and screenshot attachments.

Cleanup opens only that file's context menu. A confirmation, if presented, must name the recorded file. After deletion, the same local folder must show no items. The test reopens it to check emptiness immediately before deleting only the exact UUID folder. Unexpected files, an unknown provider, ambiguous rows or an unnamed deletion prompt stop cleanup and preserve the journal. There is no bulk selection, iCloud fallback, external share action or global Files reset.

Successful cleanup proves removal from the original folder and removal of its empty test folder. Files may retain deleted items in Recently Deleted. The case never empties that area or claims permanent erasure. A concurrent user edit between a UI check and deletion is outside its guard, so Root runs the case serially without another Files operator.

On failure, use the retained synthetic recovery record and the attached UI hierarchy to inspect only its recorded UUID. Do not delete a folder with additional or changed items. Recovery must establish the local ancestry and exact contents again; the test has no broad automatic recovery or filesystem deletion shortcut.
