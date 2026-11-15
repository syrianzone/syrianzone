# ios: preserve hotel details, gallery and selected map context

Preserve the source paginated hotel list, original photographs, names, city, star rating, available price, descriptions and explicit HalaSyria source link. Selecting a hotel retains its geographic context through the shared native map. Coordinate-less hotels remain browsable without an invented location.

Validation: Public28 passed native hotel detail, named photo accessibility and available-gallery next/previous navigation within a partially passing cohort. The source audit then found that hotel detail had dropped the website parent map's selected-hotel context. Production-compiled regressions failed before the correction, then passed four cases and 20 assertions for exact decoded coordinates, one compact/wide map placement, missing/stale coordinates and unchanged gallery/source behavior.

Native83 passed the dedicated public iPhone 17 hotel case in 34.724 seconds, with one pass and zero failures, skips or runtime warnings. The selected hotel's native map was fully visible at 330 by 300 points with one bed pin and its name. The reviewed dark screenshot shows the HalaSyria source action fitting below the map without opening it.

Native81 failed only the original bare-name marker expectation after map containment passed. MapKit exposes that selected pin as one VKPointFeature with the exact composite label `name, name`; the test now checks that observed role, identifier and label. The app supplies the title once. No product accessibility change or actual VoiceOver speech result is claimed.

The source HotelsTab has pagination and retry, without hotel search, filters or separate contact controls. The native draft does not add those features. Source map pins and independent place-discovery filters remain in Mishwar.

Dependencies: Shared maps and existing validated hotel data.

Remaining checks: Review original image pixels, pagination/retry, explicit HalaSyria opening, wide-layout native behavior, large text and VoiceOver speech. Native83 establishes the selected-pin contract on the standard iPhone 17; coordinate-less and stale-result handling are source-tested.

Local review draft only. No GitHub PR, push, deployment or production mutation has been performed for this draft.
