import Foundation
import XCTest

final class NativeIconActionUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func testProductionIconCallbackAtCenterAndInsideSlotOutsideAccessibilityFrame() throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == "zone.syrian.ios.uitests.xctrunner",
      let device = ProcessInfo.processInfo.environment["SIMULATOR_UDID"], UUID(uuidString: device) != nil else {
      throw failure("Only the exact Simulator runner may observe this fixture.")
    }
    #else
    throw failure("Icon hit observations refuse physical devices.")
    #endif
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    defer { app.terminate() }
    app.terminate(); app.launch()
    XCTAssertTrue(app.staticTexts["adapter.fixture"].waitForExistence(timeout: 15))
    let tab = app.buttons["adapter.tab.icon-hit"]
    XCTAssertTrue(tab.waitForExistence(timeout: 10)); try reveal(tab, in: app); tab.tap()
    let slot = app.otherElements["adapter.icon-hit.slot"]
    XCTAssertTrue(slot.waitForExistence(timeout: 10))
    var failures: [String] = []
    for mode in ["light", "dark"] {
      let theme = app.buttons["adapter.icon-hit.\(mode)"]
      XCTAssertTrue(theme.waitForExistence(timeout: 5)); try reveal(theme, in: app); theme.tap()
      let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
        guard let value = try? self.state(app) else { return false }
        return value["mode"] as? String == mode && value["layout"] is [String: Any]
      }, object: app)
      guard XCTWaiter.wait(for: [ready], timeout: 5) == .completed else { throw failure("The actual themed layout must be observed.") }
      try reveal(slot, in: app)
      let buttons = slot.buttons.matching(NSPredicate(format: "label == %@", "إعدادات الرئيسية"))
      guard buttons.count == 1 else { throw failure("The exact slot must contain only its shipping icon button.") }
      let button = buttons.firstMatch, initial = try state(app)
      guard let layout = initial["layout"] as? [String: Any], let width = layout["width"] as? Double,
        let height = layout["height"] as? Double, abs(width - 44) < 0.5, abs(height - 44) < 0.5,
        abs(slot.frame.width - 44) < 0.5, abs(slot.frame.height - 44) < 0.5,
        initial["count"] as? Int == 0, button.exists, button.isEnabled, button.isHittable else {
        try record("\(mode)-unrecognized-slot", state: initial, slot: slot, button: button, app: app)
        throw failure("Require the real RN44 slot and an untouched native callback counter.")
      }
      let bounds = slot.frame, accessibility = button.frame
      let center = CGPoint(x: bounds.midX, y: bounds.midY)
      let candidates: [(String, CGPoint)] = [("top-edge", CGPoint(x: bounds.midX, y: bounds.minY + 2)),
        ("bottom-edge", CGPoint(x: bounds.midX, y: bounds.maxY - 2)),
        ("left-edge", CGPoint(x: bounds.minX + 2, y: bounds.midY)),
        ("right-edge", CGPoint(x: bounds.maxX - 2, y: bounds.midY))]
      let outside = candidates.filter { bounds.contains($0.1) && !accessibility.contains($0.1) }
      guard app.frame.contains(bounds), accessibility.contains(center), outside.count >= 2 else {
        try record("\(mode)-no-outside-AX-coverage", state: initial, slot: slot, button: button, app: app)
        throw failure("At least two distinct inside-slot points must actually lie outside the measured button AX frame. No edge coverage is inferred.")
      }
      for (name, point) in [("center", center)] + outside {
        let before = try state(app), count = try XCTUnwrap(before["count"] as? Int)
        guard before["mode"] as? String == mode, slot.frame == bounds, button.frame == accessibility,
          button.isEnabled, button.isHittable, bounds.contains(point),
          name == "center" || !button.frame.contains(point) else { throw failure("The observed slot/AX geometry must stay fixed immediately before the real tap.") }
        app.coordinate(withNormalizedOffset: .zero)
          .withOffset(CGVector(dx: point.x - app.frame.minX, dy: point.y - app.frame.minY)).tap()
        let changed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
          guard let value = try? self.state(app), let observed = value["count"] as? Int else { return false }
          return value["mode"] as? String == mode && observed != count
        }, object: app)
        _ = XCTWaiter.wait(for: [changed], timeout: 5)
        let after = try state(app), observed = after["count"] as? Int
        if observed != count + 1 { failures.append("\(mode).\(name)") }
        try record("\(mode)-\(name)", state: after, slot: slot, button: button, app: app,
          extra: ["beforeCount": count, "expectedAfterCount": count + 1,
            "tapPoint": [point.x, point.y], "insideSlot": true, "outsideAX": !accessibility.contains(point)])
      }
    }
    let limits = XCTAttachment(string: "Real callback observations at the center and measured near-edge points inside the unmodified shipping 44-point slot but outside its smaller accessibility frame, in local light/dark themes. The wrapper does not add a hit handler, padding, clipping, fixed dimensions or an alternate button. The counter increments only from NativeIconAction.onPress. This samples those exact points; it does not prove every point of a 44-by-44 rectangle, other text sizes, physical devices or native private hit-test internals. Layout/AX snapshots and public XCTest queries allow UI quiescence.")
    limits.name = "icon-hit-observation-limits"; limits.lifetime = .keepAlways; add(limits)
    XCTAssertTrue(failures.isEmpty, "Actual native callbacks were absent or duplicated at: \(failures.joined(separator: ", ")). Inspect the retained observations before changing the product or its expectations.")
  }

  @MainActor
  private func state(_ app: XCUIApplication) throws -> [String: Any] {
    let marker = app.staticTexts["adapter.icon-hit.state"]
    guard marker.exists, let text = marker.value as? String, let bytes = text.data(using: .utf8), bytes.count < 2048,
      let value = try JSONSerialization.jsonObject(with: bytes) as? [String: Any] else { throw failure("The actual icon fixture metadata is required.") }
    return value
  }

  @MainActor
  private func record(_ name: String, state: [String: Any], slot: XCUIElement, button: XCUIElement,
    app: XCUIApplication, extra: [String: Any] = [:]) throws {
    let observation: [String: Any] = ["state": state, "slotFrame": String(describing: slot.frame),
      "buttonFrame": String(describing: button.frame), "buttonEnabled": button.isEnabled,
      "buttonHittable": button.isHittable, "extra": extra]
    let metadata = XCTAttachment(data: try JSONSerialization.data(withJSONObject: observation, options: [.sortedKeys, .prettyPrinted]), uniformTypeIdentifier: "public.json")
    metadata.name = "icon-hit-\(name)-metadata"; metadata.lifetime = .keepAlways; add(metadata)
    let tree = XCTAttachment(string: slot.debugDescription); tree.name = "icon-hit-\(name)-slot-AX"; tree.lifetime = .keepAlways; add(tree)
    let screen = XCTAttachment(screenshot: app.screenshot()); screen.name = "icon-hit-\(name)-screen"; screen.lifetime = .keepAlways; add(screen)
  }

  @MainActor
  private func reveal(_ element: XCUIElement, in app: XCUIApplication) throws {
    guard element.waitForExistence(timeout: 10) else { throw failure("The exact adapter control is absent.") }
    for _ in 0..<8 {
      let owners = app.scrollViews.containing(NSPredicate(format: "identifier == %@", element.identifier)).allElementsBoundByIndex
      guard let scroll = owners.last(where: { !$0.frame.intersection(app.frame).isEmpty }) else { break }
      let viewport = scroll.frame.intersection(app.frame).insetBy(dx: 0, dy: 8)
      if element.isHittable && viewport.contains(element.frame) { return }
      let origin = app.coordinate(withNormalizedOffset: .zero)
      let top = origin.withOffset(CGVector(dx: viewport.maxX - app.frame.minX - 8, dy: viewport.minY - app.frame.minY + viewport.height * 0.25))
      let bottom = origin.withOffset(CGVector(dx: viewport.maxX - app.frame.minX - 8, dy: viewport.minY - app.frame.minY + viewport.height * 0.75))
      if element.frame.minY < viewport.minY { top.press(forDuration: 0.05, thenDragTo: bottom) }
      else if element.frame.maxY > viewport.maxY { bottom.press(forDuration: 0.05, thenDragTo: top) }
      else { break }
    }
    guard element.isHittable && app.frame.contains(element.frame) else { throw failure("The exact observed slot/control must be fully visible before coordinate taps.") }
  }
  private func failure(_ message: String) -> NSError { NSError(domain: "NativeIconHitFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
}
