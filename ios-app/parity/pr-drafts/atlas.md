# ios: port the interactive Syria atlas

Preserve source population layers, environmental information, maps, legends and detail views using native vectors and adaptive panes.

Validation: Source-derived models passed. The standard iPhone 17 Civic06 case passed in 93.264994 seconds. It displayed the original Syria vector map, compared the two synthetic provinces at 120000 and 340000, switched to rainfall and touched Damascus to open its exact 130 mm data. Earlier partial failures remain historical results. The completed Civic06 cohort passed three cases with zero failures, skips or runtime warnings; local cleanup passed and the product bundle was restored.

Dependencies: Shared maps, original geometry and adaptive panes.

Remaining checks: Pinch/pan, all zoom controls, remaining layer/source combinations, environmental details, large-map performance and accessibility review remain pending.

Local review draft only. No GitHub PR, push, deployment or production mutation has been performed for this draft.
