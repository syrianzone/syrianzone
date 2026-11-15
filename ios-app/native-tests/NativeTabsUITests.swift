import XCTest

// Product entry only. Uses public reads and existing device-local preferences.
final class NativeTabsUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func testFirstOpenOfEveryNativeTabAndReturnToHome() throws {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate()
    app.launch()
    XCTAssertTrue(app.buttons["إعدادات الرئيسية"].waitForExistence(timeout: 15))
    var timings: [String: TimeInterval] = [:]
    for (tab, field) in [
      ("ترانزيت", "ابحث عن مدينة"),
      ("مشوار", "ابحث عن مكان أو إحداثيات"),
      ("المحفوظات", "ابحث في الأماكن المحفوظة")
    ] {
      try quietPopup(app)
      let matches = app.tabBars.buttons.matching(identifier: tab)
      let button = matches.firstMatch
      XCTAssertTrue(button.waitForExistence(timeout: 5), tab)
      try quietPopup(app)
      let ready = matches.count == 1 && button.isEnabled && button.isHittable
      if !ready { try attachFirstOpenFailure(tab: tab, field: field, button: button, app: app) }
      XCTAssertTrue(ready, "The exact native tab must be unique, enabled and hittable before its tap.")
      var start = Date()
      button.tap()
      var selected = waitForSelection(button)
      if !selected {
        let quiet = app.buttons.matching(identifier: "إخفاء التنبيه لهذه الزيارة")
        if quiet.count == 1 && quiet.firstMatch.exists && quiet.firstMatch.isEnabled && quiet.firstMatch.isHittable {
          try quietPopup(app)
          let retryReady = matches.count == 1 && button.exists && button.isEnabled && button.isHittable
          if !retryReady { try attachFirstOpenFailure(tab: tab, field: field, button: button, app: app) }
          XCTAssertTrue(retryReady, "The same native tab must remain uniquely exposed after the observed popup disappears.")
          start = Date()
          button.tap()
          selected = waitForSelection(button)
        }
      }
      if !selected { try attachFirstOpenFailure(tab: tab, field: field, button: button, app: app) }
      XCTAssertTrue(selected, "The requested native tab must become selected before reading its content.")
      let appeared = app.textFields[field].firstMatch.waitForExistence(timeout: 15)
      if !appeared { try attachFirstOpenFailure(tab: tab, field: field, button: button, app: app) }
      XCTAssertTrue(appeared, field)
      timings[tab] = Date().timeIntervalSince(start)
    }
    try quietPopup(app)
    app.tabBars.buttons["الإعدادات"].firstMatch.tap()
    XCTAssertTrue(app.staticTexts["إعدادات هذا الجهاز"].firstMatch.waitForExistence(timeout: 10))
    try quietPopup(app)
    app.tabBars.buttons["الرئيسية"].firstMatch.tap()
    XCTAssertTrue(app.buttons["إعدادات الرئيسية"].waitForExistence(timeout: 10))
    let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: timings, options: [.sortedKeys]), uniformTypeIdentifier: "public.json")
    attachment.name = "native-tab-first-open-observed-seconds"
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  @MainActor
  private func attachFirstOpenFailure(tab: String, field: String, button: XCUIElement, app: XCUIApplication) throws {
    let quiet = app.buttons["إخفاء التنبيه لهذه الزيارة"].firstMatch
    let evidence: [String: Any] = ["requestedTab": tab, "expectedField": field,
      "targetExists": button.exists, "targetSelected": button.isSelected, "targetEnabled": button.isEnabled,
      "targetHittable": button.isHittable, "targetFrame": String(describing: button.frame),
      "expectedFieldCount": app.textFields.matching(identifier: field).count,
      "homeTabSelected": app.tabBars.buttons["الرئيسية"].firstMatch.isSelected,
      "quietPopupExists": quiet.exists, "quietPopupHittable": quiet.exists && quiet.isHittable]
    let metadata = XCTAttachment(data: try JSONSerialization.data(withJSONObject: evidence, options: [.sortedKeys]), uniformTypeIdentifier: "public.json")
    metadata.name = "native-tab-first-open-failure-metadata"; metadata.lifetime = .keepAlways; add(metadata)
    let tree = XCTAttachment(string: app.debugDescription)
    tree.name = "native-tab-first-open-failure-AX"; tree.lifetime = .keepAlways; add(tree)
    let screen = XCTAttachment(screenshot: app.screenshot())
    screen.name = "native-tab-first-open-failure-screen"; screen.lifetime = .keepAlways; add(screen)
  }

  @MainActor
  private func waitForSelection(_ button: XCUIElement) -> Bool {
    let selected = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in button.exists && button.isSelected }, object: button)
    return XCTWaiter.wait(for: [selected], timeout: 5) == .completed
  }

  @MainActor
  private func quietPopup(_ app: XCUIApplication) throws {
    let matches = app.buttons.matching(identifier: "إخفاء التنبيه لهذه الزيارة")
    let quiet = matches.firstMatch
    if matches.count == 1 && quiet.exists && quiet.isEnabled && quiet.isHittable {
      quiet.tap()
      let gone = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in !quiet.exists }, object: quiet)
      guard XCTWaiter.wait(for: [gone], timeout: 5) == .completed else {
        throw NSError(domain: "NativeTabsFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: "The observed visit-only popup must disappear before the tab interaction continues."])
      }
    }
  }
}
