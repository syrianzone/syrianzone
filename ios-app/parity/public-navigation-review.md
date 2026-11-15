# Public navigation review

Source routes were compared with the native registry and actual parameter readers. This is a source review and authored test plan, not a device result.

## Concrete findings

- P1: Native linking in `src/App.tsx` only registers `transit`, `places`, `place/:id` and `feature/:section`. It does not recognize canonical individual game paths, Guess Who rooms or transit city routes. Internal feature navigation resolves these destinations, so the loss occurs when opening a shared source-style URL. Root owns the resolver correction.
- P1: Source Mishwar detail shares use `/mishwar?place=ID`, but Discovery reads `placeId`. A path alias must also translate the parameter. Source `guide=ID` and `view=grid` already have reader compatibility.
- P2, fixed: Home global search passed `{id,q}` to GovApps, but its screen ignored props and initialized an empty query. The actual rendered regression failed with an empty value, then passed after accepting `FeatureScreenProps` and applying `params.q`.
- P2, drafted: `/shawarma` is a reachable public route outside the Home module catalogue. Its native screen now preserves all ten original restaurants and WebPs, exact ranking order and social account URLs. Registry integration belongs to root.

## Required alias mappings

| Source path | Native destination and parameters |
|---|---|
| `/games` | `games` |
| `/games/2048` | `2048` |
| `/games/solitare` | `solitare`, preserving the source spelling |
| `/games/tarneeb`, `/games/trix` | `tarneeb`, `trix` |
| `/guesswho` | `guesswho` |
| `/guesswho/room/{roomCode}` | `guesswho`, `room=roomCode` |
| `/phonebook?q=...`, `/syofficial?q=...`, `/govapps?q=...` | Matching feature, preserving `q` |
| `/sites`, `/syid`, `/syrian-contributors`, `/shawarma` | `sites`, `syid`, `contributors`, `shawarma` |
| `/transit` | Native Transit tab |
| `/transit/city/{id}?route={routeId}` | TransitCity, resolving the real city and translating `route` to `routeId` |
| `/transit/city/{id}/map` | Same city destination, preserving its query |
| `/transit/city/{id}/route/{routeId}` | Same city plus route identity |
| `/transit/studio` | `transit_studio` |
| `/mishwar`, legacy `/places` | Native Places tab, preserving guide/view and translating `place` to `placeId` |

Hotel details and guide profiles are source panel state rather than standalone website routes. Native `hotel?id=...`, `hotels` and `guides` destinations are app additions. Their in-app row callbacks exist. External game destinations retain explicit original links and do not imply a third-party application port.

## Focused native tests

`native-tests/PublicInteractionsUITests.swift` uses the shipping product entry and supported existing feature URLs. It must run serially after restoring that entry from any adapter fixture.

The tests exercise a 2048 swipe through tile-mass growth, rules/focus/reset; Solitaire stock draw/undo/hint/new deal; Tarneeb bid/trump/local card; Trix teams/local card; SyId province/vector zoom and cancelled SVG/GeoJSON shares; Transit city/route/map/stop visibility; Mishwar coordinate/map/list/detail; read-only Guess Who lobby; and Shawarma restaurant sheets.

Solitaire stock movement does not prove tableau drag. Card accessibility queries, native menu queries and map controls require validation against the actual accessibility tree. Guess Who rooms are never created or joined by these tests. Real two-client realtime, reconnect behavior, full human card matches, 2048 transition animations, keyboard controls, native export byte content, and all isolated authenticated writes remain separate evidence requirements.
