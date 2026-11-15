import Foundation
import UIKit
import XCTest

// Adapter-only UIImagePickerController observation. No user 105 or account API.
final class NativeAvatarPickerProbeUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func testOnlyGeneratedPhotoThroughRealAvatarPickerAndCrop() throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == NativePhotoFixtures.runnerBundleIdentifier,
      ProcessInfo.processInfo.environment["SIMULATOR_UDID"] != nil else { throw probeFailure("The exact Simulator runner is required.") }
    #else
    throw probeFailure("Avatar picker probes refuse physical devices and Mac Photos access.")
    #endif
    try NativePhotoFixtures.cleanupRecordedFixtures()
    let photo = try NativePhotoFixtures.create(in: self)
    let lifetime = AvatarPickerProbeLifetime()
    addTeardownBlock { () throws -> Void in
      guard Thread.isMainThread else { throw probeFailure("Owned picker teardown requires XCTest's main thread.") }
      try MainActor.assumeIsolated { try lifetime.clearReturnedCopyAndTerminate() }
    }
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    lifetime.own(app); app.terminate(); app.launch()
    XCTAssertTrue(app.staticTexts["adapter.fixture"].waitForExistence(timeout: 15))
    app.buttons["adapter.tab.avatar"].tap()
    let open = app.buttons["adapter.avatar.open"].firstMatch
    XCTAssertTrue(open.waitForExistence(timeout: 10))
    try photo.verifySingleOwnedPhoto()
    open.tap()
    // The native presentation starts asynchronously after the real picker call.
    // Never classify the still-visible adapter as an unrecognized photo catalogue.
    let presentation = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      let status = app.staticTexts["adapter.avatar.status"].firstMatch
      if status.exists, let phase = try? probeMetadata(status)["phase"] as? String,
        phase == "error" || phase == "cancelled" { return true }
      let album = app.staticTexts[photo.albumTitle].firstMatch
      if album.exists && album.isHittable { return true }
      let catalogues = app.buttons.matching(NSPredicate(format: "label IN %@", ["Albums", "Collections", "الألبومات", "المجموعات"]))
      return catalogues.count == 1 && catalogues.firstMatch.isHittable
    }, object: app)
    let presented = XCTWaiter.wait(for: [presentation], timeout: 15)
    // Before the owned album, diagnostics contain navigation and adapter state only.
    // Recents can contain unrelated media and are never selected or photographed.
    attachNavigation("avatar-probe-initial-navigation", app: app)
    guard presented == .completed else { try unknownUI("The native picker did not expose a known catalogue or the exact owned album within the bounded presentation wait.", app: app, ownedAlbumOpen: false) }
    let status = app.staticTexts["adapter.avatar.status"].firstMatch
    if status.exists, let phase = try? probeMetadata(status)["phase"] as? String,
      phase == "error" || phase == "cancelled" {
      throw probeFailure("The real picker finished before any asset selection with terminal adapter phase: \(phase).")
    }
    var album = app.staticTexts[photo.albumTitle].firstMatch
    if !album.exists {
      let catalogues = app.buttons.matching(NSPredicate(format: "label IN %@", ["Albums", "Collections", "الألبومات", "المجموعات"]))
      guard catalogues.count == 1, catalogues.firstMatch.isHittable else { try unknownUI("The legacy album catalogue is unrecognized. No Recents fallback is allowed.", app: app, ownedAlbumOpen: false) }
      catalogues.firstMatch.tap()
    }
    album = app.staticTexts[photo.albumTitle].firstMatch
    for _ in 0..<8 {
      if album.exists && album.isHittable { break }
      if app.tables.count == 1 { app.tables.firstMatch.swipeUp() }
      else if app.collectionViews.count == 1 { app.collectionViews.firstMatch.swipeUp() }
      else { break }
    }
    guard album.exists, album.isHittable else { try unknownUI("The exact owned UUID album is required before any image selection.", app: app, ownedAlbumOpen: false) }
    try photo.verifySingleOwnedPhoto()
    album.tap()
    guard app.navigationBars[photo.albumTitle].waitForExistence(timeout: 5) || app.navigationBars.staticTexts[photo.albumTitle].exists else { try unknownUI("The opened album must retain its exact UUID title.", app: app, ownedAlbumOpen: false) }
    try photo.verifySingleOwnedPhoto()
    attachOwned("avatar-probe-exact-owned-album-actual-AX", app: app)
    // Avatar02 observed this scroll/image contract on the actual legacy picker.
    // Album membership and the sole generated asset remain independently verified.
    let grids = app.scrollViews.matching(identifier: "photosView_content_scroll_view")
    guard grids.count == 1, grids.firstMatch.exists,
      !grids.firstMatch.frame.intersection(app.frame).isEmpty else { try unknownUI("The exact observed legacy album scroll view is required.", app: app, ownedAlbumOpen: true) }
    let grid = grids.firstMatch, images = grid.images.matching(identifier: "PXGGridLayout-Info")
    guard images.count == 1, images.firstMatch.exists else { try unknownUI("The provenance-verified album must expose exactly its one observed image.", app: app, ownedAlbumOpen: true) }
    let image = images.firstMatch
    guard image.isHittable, grid.frame.intersection(app.frame).contains(image.frame) else { try unknownUI("The one generated album image must be fully visible and selectable.", app: app, ownedAlbumOpen: true) }
    try photo.verifySingleOwnedPhoto()
    guard app.navigationBars[photo.albumTitle].exists || app.navigationBars.staticTexts[photo.albumTitle].exists,
      grids.count == 1, images.count == 1, image.isHittable else { throw probeFailure("Owned album or sole-image identity changed before selection.") }
    image.tap()
    let choose = app.buttons.matching(NSPredicate(format: "label IN %@", ["Choose", "اختيار"]))
    let cancel = app.buttons.matching(NSPredicate(format: "label IN %@", ["Cancel", "إلغاء"]))
    guard choose.firstMatch.waitForExistence(timeout: 8), choose.count == 1, cancel.count == 1,
      choose.firstMatch.isHittable, choose.firstMatch.isEnabled, cancel.firstMatch.isHittable else { try unknownUI("The owned photo's native crop confirmation is unrecognized. Do not guess Add or another image.", app: app, ownedAlbumOpen: true) }
    attachOwned("avatar-probe-owned-photo-native-crop-actual-AX", app: app)
    try photo.verifySingleOwnedPhoto()
    choose.firstMatch.tap()
    let result = app.staticTexts["adapter.avatar.status"].firstMatch
    let selected = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      guard let data = result.label.data(using: .utf8), let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return false }
      return value["phase"] as? String == "selected" || value["phase"] as? String == "error"
    }, object: result)
    XCTAssertEqual(XCTWaiter.wait(for: [selected], timeout: 20), .completed)
    let metadata = try probeMetadata(result)
    let values = XCTAttachment(data: try JSONSerialization.data(withJSONObject: metadata, options: [.sortedKeys, .prettyPrinted]), uniformTypeIdentifier: "public.json")
    values.name = "avatar-probe-returned-native-crop-metadata"; values.lifetime = .keepAlways; add(values)
    guard metadata["phase"] as? String == "selected", metadata["copiedFileExists"] as? Bool == true,
      let width = metadata["width"] as? Int, let height = metadata["height"] as? Int,
      (64...6000).contains(width), (64...6000).contains(height),
      let encodedWidth = metadata["encodedWidth"] as? Int, let encodedHeight = metadata["encodedHeight"] as? Int,
      encodedWidth == width, encodedHeight == height,
      let bytes = metadata["bytes"] as? Int, let encodedBytes = metadata["encodedBytes"] as? Int, bytes == encodedBytes,
      (1...(4 * 1024 * 1024)).contains(bytes), let mime = metadata["mimeType"] as? String,
      ["image/jpeg", "image/png", "image/webp"].contains(mime), metadata["encodedMimeType"] as? String == mime else {
      throw probeFailure("The real edited image must match its independently read file header and the actual avatar axis, MIME and byte bounds.")
    }
    XCTAssertTrue(app.images["Generated fixture crop result"].exists)
    attachOwned("avatar-probe-generated-crop-result", app: app)
    try lifetime.clearReturnedCopyAndTerminate()
    try photo.verifySingleOwnedPhoto()
    try photo.cleanup()
  }

  @MainActor
  private func attachNavigation(_ name: String, app: XCUIApplication) {
    let queries: [(String, XCUIElementQuery)] = [("NAVIGATION", app.navigationBars), ("TAB BARS", app.tabBars),
      ("KNOWN CATALOGUE CONTROLS", app.buttons.matching(NSPredicate(format: "label IN %@", ["Albums", "Collections", "الألبومات", "المجموعات"])))]
    var sections: [String] = []
    for (role, query) in queries {
      let first = query.firstMatch
      sections.append("\(role) count: \(query.count)")
      if first.exists { sections.append(first.debugDescription) }
    }
    let tree = XCTAttachment(string: sections.joined(separator: "\n"))
    tree.name = name; tree.lifetime = .keepAlways; add(tree)
    let status = app.staticTexts["adapter.avatar.status"].firstMatch
    if status.exists, let metadata = try? probeMetadata(status),
      let data = try? JSONSerialization.data(withJSONObject: metadata, options: [.prettyPrinted, .sortedKeys]) {
      let values = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
      values.name = name + "-adapter-state"; values.lifetime = .keepAlways; add(values)
    }
  }

  @MainActor
  private func attachOwned(_ name: String, app: XCUIApplication) {
    let tree = XCTAttachment(string: app.debugDescription)
    tree.name = name; tree.lifetime = .keepAlways; add(tree)
    let image = XCTAttachment(screenshot: app.screenshot())
    image.name = name + "-screen"; image.lifetime = .keepAlways; add(image)
  }

  @MainActor
  private func unknownUI(_ message: String, app: XCUIApplication, ownedAlbumOpen: Bool) throws -> Never {
    if ownedAlbumOpen { attachOwned("avatar-probe-unrecognized-owned-UI", app: app) }
    else { attachNavigation("avatar-probe-unrecognized-navigation", app: app) }
    let cancel = app.buttons.matching(NSPredicate(format: "label IN %@", ["Cancel", "إلغاء"]))
    if cancel.count == 1 && cancel.firstMatch.isHittable { cancel.firstMatch.tap() }
    throw probeFailure(message)
  }
}

private func probeFailure(_ message: String) -> NSError { NSError(domain: "NativeAvatarPickerProbe", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }

@MainActor
private func probeMetadata(_ element: XCUIElement) throws -> [String: Any] {
  guard let data = element.label.data(using: .utf8), let result = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw probeFailure("The adapter must expose its actual picker result metadata.") }
  return result
}

@MainActor private final class AvatarPickerProbeLifetime {
  private var app: XCUIApplication?
  func own(_ value: XCUIApplication) { app = value }
  func clearReturnedCopyAndTerminate() throws {
    guard let app, app.state != .notRunning else { return }
    defer { app.terminate() }
    let clear = app.buttons["adapter.avatar.clear"].firstMatch
    let status = app.staticTexts["adapter.avatar.status"].firstMatch
    if status.exists, let value = try? probeMetadata(status), value["copiedFileExists"] as? Bool == true,
      !(clear.exists && clear.isEnabled && clear.isHittable) {
      throw probeFailure("The captured fixture copy remains owned but its exact cleanup control is unavailable.")
    }
    if clear.exists && clear.isEnabled && clear.isHittable {
      clear.tap()
      let result = app.staticTexts["adapter.avatar.status"].firstMatch
      let removed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
        guard let value = try? probeMetadata(result) else { return false }
        return value["phase"] as? String == "removed" && value["copiedFileExists"] as? Bool == false
      }, object: result)
      guard XCTWaiter.wait(for: [removed], timeout: 5) == .completed else { throw probeFailure("Only the returned fixture cache copy should be removed before app termination.") }
    }
  }
}
