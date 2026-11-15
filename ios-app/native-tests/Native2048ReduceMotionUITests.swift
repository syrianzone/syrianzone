import Foundation
import UIKit
import XCTest

// Simulator-only normal Settings UI. No preference injection or private URL schemes.
final class Native2048ReduceMotionUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func testObserveNormalAccessibilityMotionRowWithoutChangingAnyPreference() throws {
    try SystemMotionDriver.requireSimulator()
    let original = UIAccessibility.isReduceMotionEnabled
    let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
    if settings.state == .notRunning { settings.launch() } else { settings.activate() }
    try SystemMotionDriver.openAccessibilityFromObservedRoot(settings)
    guard settings.navigationBars["Accessibility"].waitForExistence(timeout: 5) else {
      throw systemMotionFailure("The observed Accessibility button did not open its expected normal page. No preference was changed.")
    }
    let motion = settings.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Motion"))
    let observed = motion.firstMatch.waitForExistence(timeout: 5)
    let snapshot = settings.debugDescription
    let rows = snapshot.split(separator: "\n").filter { $0.contains("label: 'Motion'") }.map(String.init)
    let metadata = XCTAttachment(data: try JSONSerialization.data(withJSONObject: ["readOnly": true, "motionLabelObserved": observed,
      "matchingPublicAXLines": rows, "preferenceUnchanged": UIAccessibility.isReduceMotionEnabled == original], options: [.sortedKeys, .prettyPrinted]), uniformTypeIdentifier: "public.json")
    metadata.name = "normal-accessibility-motion-role-observation"; metadata.lifetime = .keepAlways; add(metadata)
    let tree = XCTAttachment(string: snapshot); tree.name = "normal-accessibility-page-actual-AX"; tree.lifetime = .keepAlways; add(tree)
    let screen = XCTAttachment(screenshot: settings.screenshot()); screen.name = "normal-accessibility-page-read-only"; screen.lifetime = .keepAlways; add(screen)
    XCTAssertTrue(observed && !rows.isEmpty, "Actual Motion row semantics must be observed before changing its selector. No Motion row or preference was tapped.")
    XCTAssertEqual(UIAccessibility.isReduceMotionEnabled, original)
  }

  @MainActor
  func testRealSystemReduceMotionChangesPreserveTheLiveProductBoardAndRestoreOriginalSetting() throws {
    try SystemMotionDriver.requireSimulator()
    let control = try SystemMotionDriver.motionSwitch()
    let original = try SystemMotionDriver.value(control)
    let record = try SystemMotionDriver.record(original: original)
    addTeardownBlock { () throws -> Void in
      guard Thread.isMainThread else { throw systemMotionFailure("System preference teardown requires XCTest's documented main thread.") }
      try MainActor.assumeIsolated { try SystemMotionDriver.restore(original: original, record: record) }
    }
    try SystemMotionDriver.confirmSystemValue(original)
    captureSettings("2048-system-motion-original", expected: original)

    let app = openProductGame()
    let board = app.otherElements["لوحة 2048"].firstMatch
    XCTAssertTrue(board.waitForExistence(timeout: 15))
    let restart = app.buttons["لعبة جديدة"].firstMatch
    reveal(restart, app: app); restart.tap(); reveal(board, app: app)
    var previous = try readBoard(board, app: app)
    guard previous.ids.count == 2, previous.score == 0 else { throw systemMotionFailure("The case must start its own new product board.") }
    captureProduct("2048-system-motion-owned-new-board", board: board, app: app, systemValue: original)

    for expected in [!original, original] {
      try SystemMotionDriver.set(expected)
      captureSettings(expected ? "2048-real-reduce-motion-on" : "2048-real-reduce-motion-off", expected: expected)
      // Activate the existing process so this exercises a real OS preference change
      // while the board remains mounted, rather than merely a fresh preference read.
      app.activate()
      XCTAssertTrue(board.waitForExistence(timeout: 10))
      reveal(board, app: app)
      let resumed = try readBoard(board, app: app)
      XCTAssertEqual(resumed.signature, previous.signature, "Changing the system preference must preserve the live board, engine IDs, positions, and score.")
      try SystemMotionDriver.confirmSystemValue(expected)
      let left = resumed.cells.contains { tile in tile.col > 0 && !resumed.cells.contains { $0.row == tile.row && $0.col == tile.col - 1 } }
      let start = board.coordinate(withNormalizedOffset: CGVector(dx: left ? 0.8 : 0.2, dy: 0.5))
      let end = board.coordinate(withNormalizedOffset: CGVector(dx: left ? 0.2 : 0.8, dy: 0.5))
      start.press(forDuration: 0.01, thenDragTo: end, withVelocity: .fast, thenHoldForDuration: 0)
      let changed = try readBoard(board, app: app)
      guard let oldMax = resumed.ids.max(), changed.ids.max() == oldMax + 1,
        [2, 4].contains(changed.mass - resumed.mass), changed.score >= resumed.score else { throw systemMotionFailure("The actual product must still accept its legal swipe under each real system preference.") }
      XCTAssertEqual(app.descendants(matching: .any).matching(NSPredicate(format: "identifier MATCHES %@", #"2048\.ghost\.[1-9][0-9]*"#)).count, 0)
      captureProduct(expected ? "2048-product-under-real-reduce-motion-on" : "2048-product-under-real-reduce-motion-off", board: board, app: app, systemValue: expected)
      previous = changed
    }
    // Restore explicitly now and again from teardown if any later assertion fails.
    try SystemMotionDriver.restore(original: original, record: record)
    let note = XCTAttachment(string: "The real Simulator Settings switch and public UIAccessibility status were verified for both values, and the existing product board remained playable across background/foreground changes. These settled snapshots do not measure native animation frame duration or prove interrupted-frame overlap; Root must review native video for those claims.")
    note.name = "real-os-toggle-proof-and-separate-animation-limit"; note.lifetime = .keepAlways; add(note)
  }

  @MainActor
  private func openProductGame() -> XCUIApplication {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate(); app.launch(); app.open(URL(string: "syrianzone://feature/2048")!)
    for bundle in ["zone.syrian.ios", "com.apple.springboard", "com.apple.mobilesafari", "com.apple.SafariViewService"] {
      let open = XCUIApplication(bundleIdentifier: bundle).buttons["Open"].firstMatch
      if open.exists { open.tap(); break }
    }
    XCTAssertFalse(app.staticTexts["account.fixture.origin"].exists)
    XCTAssertFalse(app.staticTexts["adapter.fixture"].exists)
    let quiet = app.buttons["إخفاء التنبيه لهذه الزيارة"].firstMatch
    if quiet.waitForExistence(timeout: 2) { XCTAssertTrue(quiet.isHittable); quiet.tap() }
    return app
  }

  @MainActor
  private func readBoard(_ board: XCUIElement, app: XCUIApplication) throws -> SystemMotionBoard {
    let notBefore = Date().addingTimeInterval(0.4), deadline = Date().addingTimeInterval(8)
    var prior: SystemMotionBoard?, stableSince = Date()
    while Date() < deadline {
      if Date() >= notBefore, let next = try? boardSnapshot(board, app: app) {
        if prior?.signature == next.signature {
          if Date().timeIntervalSince(stableSince) >= 0.15 { return next }
        } else { prior = next; stableSince = Date() }
      }
      RunLoop.current.run(until: Date().addingTimeInterval(0.05))
    }
    throw systemMotionFailure("The real product board did not expose a stable identified numeric grid. Inspect actual AX before changing selectors.")
  }

  @MainActor
  private func boardSnapshot(_ board: XCUIElement, app: XCUIApplication) throws -> SystemMotionBoard {
    let bounds = board.frame
    guard board.exists, bounds.width >= 200 else { throw systemMotionFailure("The real product board is missing.") }
    let elements = app.descendants(matching: .any).matching(NSPredicate(format: "identifier MATCHES %@", #"2048\.tile\.[1-9][0-9]*"#)).allElementsBoundByIndex
    var cells: [Int: SystemMotionCell] = [:]
    for element in elements {
      guard let id = Int(element.identifier.replacingOccurrences(of: "2048.tile.", with: "")), id > 0 else { continue }
      let values = Set(element.descendants(matching: .staticText).allElementsBoundByIndex.compactMap { Int($0.label) })
      guard values.count == 1, let value = values.first, value >= 2, value.nonzeroBitCount == 1 else { throw systemMotionFailure("Each product engine ID must have one numeric tile value.") }
      let x = (element.frame.midX - bounds.minX) / bounds.width, y = (element.frame.midY - bounds.minY) / bounds.height
      let col = Int(floor(x * 4)), row = Int(floor(y * 4))
      guard (0..<4).contains(row), (0..<4).contains(col), abs(x - (Double(col) + 0.5) / 4) < 0.04,
        abs(y - (Double(row) + 0.5) / 4) < 0.04 else { throw systemMotionFailure("The product tile has not settled at a visible cell center.") }
      let cell = SystemMotionCell(id: id, value: value, row: row, col: col)
      if let existing = cells[id], existing != cell { throw systemMotionFailure("One product ID appeared twice with different content.") }
      cells[id] = cell
    }
    guard !cells.isEmpty, cells.count <= 16, Set(cells.values.map { "\($0.row):\($0.col)" }).count == cells.count else { throw systemMotionFailure("A unique identified product grid is required.") }
    let label = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "النقاط ")).firstMatch.label as NSString
    let regex = try NSRegularExpression(pattern: #"النقاط\s+([0-9]+)"#)
    guard let match = regex.firstMatch(in: label as String, range: NSRange(location: 0, length: label.length)), let score = Int(label.substring(with: match.range(at: 1))) else { throw systemMotionFailure("The actual product score label is missing.") }
    return .init(cells: cells.values.sorted { $0.id < $1.id }, score: score)
  }

  @MainActor
  private func reveal(_ element: XCUIElement, app: XCUIApplication) {
    XCTAssertTrue(element.waitForExistence(timeout: 10))
    for _ in 0..<12 {
      let scroll = app.scrollViews.containing(element.elementType, identifier: element.label).allElementsBoundByIndex.last ?? app.scrollViews.firstMatch
      guard scroll.exists else { break }
      let viewport = scroll.frame.intersection(app.frame).insetBy(dx: 0, dy: 8), frame = element.frame
      if element.isHittable && viewport.contains(frame) { return }
      let top = scroll.coordinate(withNormalizedOffset: .init(dx: 0.02, dy: 0.25)), bottom = scroll.coordinate(withNormalizedOffset: .init(dx: 0.02, dy: 0.75))
      if frame.minY < viewport.minY { top.press(forDuration: 0.05, thenDragTo: bottom) }
      else if frame.maxY > viewport.maxY { bottom.press(forDuration: 0.05, thenDragTo: top) }
      else { break }
    }
    XCTAssertTrue(element.isHittable)
  }

  @MainActor
  private func captureSettings(_ name: String, expected: Bool) {
    let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
    let screenshot = XCTAttachment(screenshot: settings.screenshot()); screenshot.name = name; screenshot.lifetime = .keepAlways; add(screenshot)
    let state = XCTAttachment(string: "Normal Settings Reduce Motion value: \(expected). Public UIAccessibility.isReduceMotionEnabled: \(UIAccessibility.isReduceMotionEnabled).")
    state.name = name + "-real-os-status"; state.lifetime = .keepAlways; add(state)
  }

  @MainActor
  private func captureProduct(_ name: String, board: XCUIElement, app: XCUIApplication, systemValue: Bool) {
    for (suffix, screenshot) in [("-board", board.screenshot()), ("-screen", app.screenshot())] {
      let attachment = XCTAttachment(screenshot: screenshot); attachment.name = name + suffix; attachment.lifetime = .keepAlways; add(attachment)
    }
    let state = XCTAttachment(string: "Genuine OS status: \(systemValue). Product process retained across Settings change.\n" + app.debugDescription)
    state.name = name + "-native-AX-and-os-status"; state.lifetime = .keepAlways; add(state)
  }
}

@MainActor
private enum SystemMotionDriver {
  static func requireSimulator() throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == "zone.syrian.ios.uitests.xctrunner", ProcessInfo.processInfo.environment["SIMULATOR_UDID"] != nil else { throw systemMotionFailure("Only the exact Simulator UI runner may navigate system Settings.") }
    #else
    throw systemMotionFailure("This test refuses physical-device and Mac Settings access before any UI action.")
    #endif
  }

  static func motionSwitch() throws -> XCUIElement {
    try requireSimulator()
    let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
    if settings.state == .notRunning { settings.launch() } else { settings.activate() }
    let control = settings.switches["Reduce Motion"].firstMatch
    if settings.navigationBars["Motion"].exists && control.exists { return control }
    for _ in 0..<5 where !settings.navigationBars["Settings"].exists {
      let back = settings.navigationBars.buttons.matching(NSPredicate(format: "label IN %@ OR identifier == %@", ["Settings", "Accessibility"], "Back")).firstMatch
      guard back.exists else { try unavailable(settings, reason: "Cannot return to Settings through its normal visible Back control.") }
      back.tap()
    }
    guard settings.navigationBars["Settings"].waitForExistence(timeout: 5) else { try unavailable(settings, reason: "The normal Settings root is not visible.") }
    // Apple Support 111781 documents Settings > Accessibility > Motion.
    try openAccessibilityFromObservedRoot(settings)
    guard settings.navigationBars["Accessibility"].waitForExistence(timeout: 5) else { try unavailable(settings, reason: "Accessibility did not open through the normal Settings cell.") }
    try openMotionFromObservedAccessibilityPage(settings)
    guard settings.navigationBars["Motion"].waitForExistence(timeout: 5), control.waitForExistence(timeout: 5) else { try unavailable(settings, reason: "The normal Motion page or exact Reduce Motion switch is unavailable.") }
    return control
  }

  static func openAccessibilityFromObservedRoot(_ settings: XCUIApplication) throws {
    try requireSimulator()
    guard settings.navigationBars["Settings"].waitForExistence(timeout: 5) else {
      throw systemMotionFailure("The exact normal Settings root is required before the observed Accessibility action.")
    }
    let matches = settings.buttons.matching(NSPredicate(format: "identifier == %@ AND label == %@", "com.apple.settings.accessibility", "Accessibility"))
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      matches.count == 1 && matches.firstMatch.isEnabled && matches.firstMatch.isHittable
        && settings.frame.contains(matches.firstMatch.frame) && !matches.firstMatch.frame.isEmpty
    }, object: settings)
    guard XCTWaiter.wait(for: [ready], timeout: 5) == .completed else {
      throw systemMotionFailure("The actual unique visible Accessibility Button is required. No alternative Settings path is guessed.")
    }
    matches.firstMatch.tap()
  }

  static func value(_ control: XCUIElement) throws -> Bool {
    if let raw = control.value as? String, ["0", "1"].contains(raw) { return raw == "1" }
    if let raw = control.value as? NSNumber, [0, 1].contains(raw.intValue) { return raw.boolValue }
    throw systemMotionFailure("The real system switch did not expose an exact Boolean value.")
  }

  static func set(_ desired: Bool) throws {
    let control = try motionSwitch()
    let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
    let controls = settings.switches.matching(NSPredicate(format: "label == %@ OR identifier == %@", "Reduce Motion", "Reduce Motion"))
    let pages = settings.navigationBars.matching(NSPredicate(format: "identifier == %@ OR label == %@", "Motion", "Motion"))
    var previousFrame: CGRect?
    // Native48 exposed a hittable, rescaled switch extending beyond the window
    // during Settings activation. Observe settled geometry before the same tap.
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      let frame = control.frame, viewport = settings.frame
      guard settings.state == .runningForeground && pages.count == 1
        && controls.count == 1 && control.isEnabled && control.isHittable
        && [frame.minX, frame.minY, frame.width, frame.height, viewport.minX, viewport.minY, viewport.width, viewport.height].allSatisfy(\.isFinite)
        && !frame.isEmpty && !viewport.isEmpty && viewport.contains(frame) else {
        previousFrame = nil
        return false
      }
      let stable = previousFrame == frame
      previousFrame = frame
      return stable
    }, object: settings)
    guard XCTWaiter.wait(for: [ready], timeout: 5) == .completed else {
      throw systemMotionFailure("The exact Motion switch must expose finite, fully contained, unchanged geometry across consecutive observations before any preference tap.")
    }
    let before = try value(control), tapped = before != desired
    let frameBeforeTap = control.frame
    guard previousFrame == frameBeforeTap && settings.state == .runningForeground
      && pages.count == 1 && controls.count == 1
      && control.isEnabled && control.isHittable && settings.frame.contains(frameBeforeTap) else {
      throw systemMotionFailure("The observed Motion switch geometry must remain settled immediately before its normal track tap.")
    }
    // Native50's settled AX frame includes the row label. Its center tap missed
    // the visible right-side track. Use that track's height-derived interior.
    let tapPoint = CGPoint(x: frameBeforeTap.maxX - frameBeforeTap.height, y: frameBeforeTap.midY)
    guard frameBeforeTap.width > 2 * frameBeforeTap.height
      && frameBeforeTap.contains(tapPoint) && settings.frame.contains(tapPoint) else {
      throw systemMotionFailure("The observed right-side Motion track must have a fully contained activation point derived from its current frame.")
    }
    let controlBeforeTap: [String: Any] = ["enabled": control.isEnabled, "hittable": control.isHittable,
      "frame": ["x": frameBeforeTap.minX, "y": frameBeforeTap.minY, "width": frameBeforeTap.width, "height": frameBeforeTap.height],
      "activationPoint": ["x": tapPoint.x, "y": tapPoint.y]]
    if tapped {
      control.coordinate(withNormalizedOffset: CGVector(dx: 1, dy: 0.5))
        .withOffset(CGVector(dx: -frameBeforeTap.height, dy: 0)).tap()
    }
    let started = Date(), deadline = Date().addingTimeInterval(8)
    var series: [[String: Any]] = [], previousSwitch: Bool?, previousPublic: Bool?, changes = 0
    while Date() < deadline {
      let actualSwitch = try value(control), actualPublic = UIAccessibility.isReduceMotionEnabled
      if actualSwitch != previousSwitch || actualPublic != previousPublic {
        changes += 1
        if series.count < 16 { series.append(["elapsedMilliseconds": Int(Date().timeIntervalSince(started) * 1000), "switchValue": actualSwitch, "publicRunnerValue": actualPublic]) }
        previousSwitch = actualSwitch; previousPublic = actualPublic
      }
      if actualSwitch == desired && actualPublic == desired { return }
      RunLoop.current.run(until: Date().addingTimeInterval(0.1))
    }
    observeSetMismatch(desired: desired, before: before, tapped: tapped, controlBeforeTap: controlBeforeTap, series: series, truncated: changes > series.count)
    throw systemMotionFailure("The normal Settings switch and public OS accessibility status did not both adopt the requested value.")
  }

  private static func observeSetMismatch(desired: Bool, before: Bool, tapped: Bool, controlBeforeTap: [String: Any], series: [[String: Any]], truncated: Bool) {
    let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
    let controls = settings.switches.matching(NSPredicate(format: "label == %@ OR identifier == %@", "Reduce Motion", "Reduce Motion"))
    let knownPage = settings.navigationBars["Motion"].exists && controls.count == 1
    var metadata: [String: Any] = ["requestedValue": desired, "switchBeforeTap": before, "tapPerformed": tapped, "controlBeforeTap": controlBeforeTap,
      "publicRunnerValue": UIAccessibility.isReduceMotionEnabled, "runnerApplicationState": UIApplication.shared.applicationState.rawValue,
      "settingsApplicationState": settings.state.rawValue, "knownMotionPageAndUniqueSwitch": knownPage, "booleanChanges": series, "seriesTruncated": truncated]
    if knownPage {
      let control = controls.firstMatch
      let finalValue = try? value(control)
      metadata["switchBooleanReadable"] = finalValue != nil
      metadata["switchAfterTimeout"] = finalValue as Any? ?? NSNull()
      metadata["switchEnabled"] = control.isEnabled
      metadata["switchHittable"] = control.isHittable
      let frame = control.frame
      metadata["switchFrame"] = ["x": frame.minX, "y": frame.minY, "width": frame.width, "height": frame.height]
    }
    XCTContext.runActivity(named: "Reduce Motion oracle disagreement after unchanged timeout") { activity in
      guard let data = try? JSONSerialization.data(withJSONObject: metadata, options: [.sortedKeys, .prettyPrinted]) else { return }
      let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
      attachment.name = "normal-motion-switch-and-public-runner-status"; attachment.lifetime = .keepAlways; activity.add(attachment)
    }
  }

  static func confirmSystemValue(_ expected: Bool) throws {
    guard UIAccessibility.isReduceMotionEnabled == expected else { throw systemMotionFailure("Public OS accessibility status differs from the observed Settings switch. No app preference is injected or assumed.") }
  }

  static func record(original: Bool) throws -> URL {
    try requireSimulator()
    let directory = try XCTUnwrap(FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first).appendingPathComponent("SyrianZoneNativeSystemFixtures", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    guard try directory.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink != true else { throw systemMotionFailure("Refusing a symlink in the private system-test record directory.") }
    try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: directory.path)
    let url = directory.appendingPathComponent("reduce-motion-\(UUID().uuidString).json")
    try JSONSerialization.data(withJSONObject: ["version": 1, "originalReduceMotion": original]).write(to: url, options: [.atomic, .completeFileProtection])
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
    return url
  }

  static func restore(original: Bool, record: URL) throws {
    try set(original)
    guard try value(motionSwitch()) == original else { throw systemMotionFailure("The exact original system Reduce Motion value was not restored.") }
    if FileManager.default.fileExists(atPath: record.path) { try FileManager.default.removeItem(at: record) }
    let product = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    if product.state != .notRunning { product.activate() }
  }

  private static func openMotionFromObservedAccessibilityPage(_ settings: XCUIApplication) throws {
    try requireSimulator()
    guard settings.navigationBars["Accessibility"].waitForExistence(timeout: 5) else {
      throw systemMotionFailure("The normal Accessibility page is required before its observed Motion row.")
    }
    let pages = settings.otherElements.matching(identifier: "AccessibilitySettingsControllerView")
    guard pages.count == 1 else { throw systemMotionFailure("The actual Accessibility page owner must be unique.") }
    let rows = pages.firstMatch.cells.matching(NSPredicate(format: "identifier == %@ AND label == %@", "MOTION_TITLE", "Motion"))
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      pages.count == 1 && rows.count == 1 && rows.firstMatch.isEnabled && rows.firstMatch.isHittable
        && !rows.firstMatch.frame.isEmpty && settings.frame.contains(rows.firstMatch.frame)
        && pages.firstMatch.frame.contains(rows.firstMatch.frame)
    }, object: settings)
    guard XCTWaiter.wait(for: [ready], timeout: 5) == .completed else {
      try unavailable(settings, reason: "The Native34 observed unique MOTION_TITLE Cell must be visible. No alternative Settings role or path is guessed.")
    }
    rows.firstMatch.tap()
  }

  private static func unavailable(_ settings: XCUIApplication, reason: String) throws -> Never {
    XCTContext.runActivity(named: "Unobserved normal Settings hierarchy") { activity in
      let tree = XCTAttachment(string: settings.debugDescription); tree.name = "system-settings-actual-AX"; tree.lifetime = .keepAlways; activity.add(tree)
    }
    throw systemMotionFailure(reason)
  }
}

private struct SystemMotionCell: Equatable { let id: Int, value: Int, row: Int, col: Int }
private struct SystemMotionBoard {
  let cells: [SystemMotionCell]
  let score: Int
  var ids: [Int] { cells.map(\.id) }
  var mass: Int { cells.reduce(0) { $0 + $1.value } }
  var signature: String { "\(score):" + cells.map { "\($0.id):\($0.value):\($0.row):\($0.col)" }.joined(separator: ";") }
}
private func systemMotionFailure(_ message: String) -> NSError { NSError(domain: "Native2048SystemReduceMotion", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
