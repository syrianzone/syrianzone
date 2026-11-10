# Mishwar: Deferred Map Improvements (`flutter_map` Migration)

This document tracks map-related findings from PR review (#96) that are intentionally deferred for the upcoming migration from `maplibre_gl` to `flutter_map`.

---

## 1. Category Filtering on Map Features (Issue 5)

### Problem
In `feature/mobile-mishwar`, selecting a category filter (e.g. `historical`, `natural`, `food`) filters the places feed (`MishwarPlacesTab`), but does not filter the pins rendered in `MishwarMapPane` (`mapFeatures`). As a result, pins of unrelated categories and hotels remain visible on the map while a category filter is active.

### Why Deferred
In `maplibre_gl`, filtering markers on each category tap requires tearing down and recreating all Symbol/Circle layers over the native platform channel, causing noticeable jank. Since `flutter_map` handles marker layers natively as Flutter widgets in the widget tree, filtering will be sub-millisecond and declarative.

### Implementation Tasks (Post `flutter_map` Migration)
1. When `state.selectedCategory != null`, filter `mapPlaces` to features matching `feature.properties.category == state.selectedCategory`.
2. When a category is active, hide hotel pins (since hotels do not share place categories), or respect `_typeFilter`.
3. Animate or update marker layers declaratively without platform-channel overhead.

---

## 2. Dynamic Pinch-to-Zoom Re-Clustering (Issue 7)

### Problem
Marker clustering in `MishwarMapPane` uses `_currentZoom` to calculate the cluster radius. However, `_currentZoom` is only updated when using the on-screen `+` / `-` buttons, tapping a cluster, or calling `zoomToLocation`. When a user pinches-to-zoom directly on the map, `_currentZoom` is not updated, leaving clusters calculated at the initial zoom level instead of expanding into individual pins.

### Why Deferred
Hooking gesture zoom streams from `maplibre_gl` back across the Dart-to-native platform channel to trigger continuous re-clustering causes severe frame drops and jitter. 

### Implementation Tasks (Post `flutter_map` Migration)
1. Use `flutter_map_marker_cluster` or `supercluster` with `flutter_map`.
2. Both packages automatically and smoothly re-calculate clusters at 60/120 FPS on every zoom/pinch tick directly in the Flutter engine without native bridge hops.
