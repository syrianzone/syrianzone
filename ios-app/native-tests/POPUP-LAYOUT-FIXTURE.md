# Local popup layout fixture

Authored and source checked. Native geometry has not been executed for this case.

The existing local baseline has a 15-character title and 106-character description. The closed `popup-long` session variant supplies a 57-character title and 157-character description to exercise wrapping without changing server settings. Only member 101 can select the variant, after the existing exact origin, gate, session and account checks.

The fixture replaces only `sitePopup` in a verified, credential-free, exact Home Inertia JSON response. It preserves the real component, version, other props and verified response URL. Ordinary sessions, bootstrap HTML, other routes, authenticated reads, writes and non-200 responses remain unchanged. The synthetic response is explicitly uncached. No server write, cache reset or settings restoration is involved.

`NativePopupLayoutUITests/testLongPopupKeepsAllThreeControlsInsideItsInitialViewport` waits for a positive override marker and the full long title. It requires full copy in the actual body button's spoken label, a wrapped title, three initially contained/hittable controls and one shared primary/Later row. It never scrolls, opens the link or persists a dismissal. The campaign URL uses reserved example.invalid. The runner's existing final local cleanup and production-bundle restoration still apply.

This is a fixture-only visual check of the real app component. It does not prove server settings updates, live campaign behavior, maximum 500-character reachability, DynamicType layout or an external browser flow. Unknown layout roles fail with AX, frames and screenshot evidence. A positive marker or accessible text alone cannot pass the geometry checks.
