import XCTest

// Shared only by fixture-bundled local tests, never by production code.
class LocalFixtureTestCase: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func launch(_ user: String, id: Int) throws -> XCUIApplication {
    let environment = ProcessInfo.processInfo.environment
    guard environment["SZ_NATIVE_FIXTURE_ORIGIN"] == "https://127.0.0.1:9443", let gate = environment["SZ_NATIVE_FIXTURE_GATE"],
      gate.range(of: "^[A-Za-z0-9_-]{16,256}$", options: .regularExpression) != nil else {
      throw NSError(domain: "NativeAccountFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: "Private local fixture configuration is missing."])
    }
    var components = URLComponents()
    components.scheme = "syrianzone"; components.host = "fixture"; components.path = "/session"
    components.queryItems = [URLQueryItem(name: "user", value: user)]; components.fragment = gate
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate()
    app.open(try XCTUnwrap(components.url))
    dismissOwnPrompt()
    assertLocal(app, user: user, id: id)
    XCTAssertTrue(app.buttons["إعدادات الرئيسية"].waitForExistence(timeout: 20), "Real app navigation must mount before sending hot links.")
    return app
  }

  @MainActor
  func assertLocal(_ app: XCUIApplication, user: String, id: Int) {
    let origin = app.staticTexts["account.fixture.origin"], identity = app.staticTexts["account.fixture.identity"]
    XCTAssertTrue(origin.waitForExistence(timeout: 15))
    XCTAssertEqual(origin.label, "https://127.0.0.1:9443")
    XCTAssertTrue(identity.waitForExistence(timeout: 20), "Expected locally verified account")
    XCTAssertEqual(identity.label, "LOCAL \(user) \(id)")
  }

  @MainActor
  func open(_ section: String, app: XCUIApplication) {
    let destination = app.textFields["account.fixture.destination"]
    XCTAssertTrue(destination.waitForExistence(timeout: 10))
    let acknowledgement = app.staticTexts["account.fixture.status"]
    func navigationState() -> (sequence: Int, destination: String, status: String)? {
      guard let value = acknowledgement.value as? String, let data = value.data(using: .utf8),
        let state = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        let sequence = state["sequence"] as? Int, sequence >= 0,
        let destination = state["destination"] as? String, let status = state["status"] as? String else { return nil }
      return (sequence, destination, status)
    }
    guard let previous = navigationState() else {
      XCTFail("The fixture's native navigation acknowledgement is required before opening a destination.")
      return
    }
    replace(destination, with: section + "\n")
    let opened = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      guard let actual = navigationState() else { return false }
      return actual.sequence == previous.sequence + 1 && actual.destination == section && actual.status == "opened"
    }, object: acknowledgement)
    let result = XCTWaiter.wait(for: [opened], timeout: 15)
    if result != .completed {
      let state: [String: Any] = ["expectedSequence": previous.sequence + 1, "expectedDestination": section,
        "actualAcknowledgement": acknowledgement.value as? String as Any? ?? NSNull()]
      if let data = try? JSONSerialization.data(withJSONObject: state, options: [.prettyPrinted, .sortedKeys]) {
        let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        attachment.name = "fixture-navigation-acknowledgement"; attachment.lifetime = .keepAlways; add(attachment)
      }
    }
    XCTAssertEqual(result, .completed, "The fixture must acknowledge the exact fresh submitted destination after real Linking accepts it.")
    XCTAssertFalse(app.staticTexts["account.fixture.navigation-error"].exists)
    let keyboardClosed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: app.keyboards.firstMatch)
    XCTAssertEqual(XCTWaiter.wait(for: [keyboardClosed], timeout: 5), .completed, "Fixture navigation must finish dismissing its header keyboard before editing the destination.")
    dismissPopup(app)
  }

  @MainActor
  func dismissOwnPrompt() {
    for identifier in ["zone.syrian.ios", "com.apple.springboard", "com.apple.mobilesafari", "com.apple.SafariViewService"] {
      let button = XCUIApplication(bundleIdentifier: identifier).buttons["Open"].firstMatch
      if button.exists { button.tap(); break }
    }
  }

  @MainActor
  func dismissPopup(_ app: XCUIApplication) {
    let quiet = app.buttons["إخفاء التنبيه لهذه الزيارة"].firstMatch
    if quiet.exists && quiet.isHittable { quiet.tap() }
  }

  @MainActor
  func tap(_ title: String, app: XCUIApplication) {
    dismissPopup(app)
    let button = app.buttons[title].firstMatch
    XCTAssertTrue(button.waitForExistence(timeout: 15), title)
    reveal(button, app: app)
    XCTAssertTrue(button.isHittable, title)
    button.tap()
  }

  @MainActor
  func replace(_ field: XCUIElement, with value: String) {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    dismissPopup(app)
    reveal(field, app: app)
    field.tap()
    field.typeKey("a", modifierFlags: .command)
    field.typeText(XCUIKeyboardKey.delete.rawValue)
    field.typeText(value)
  }

  @MainActor
  func reveal(_ element: XCUIElement, app: XCUIApplication, diagnosticName: String? = nil) {
    // Only this synthetic Polls call opts in. Other callers, including Photos
    // workflows, keep the existing gesture path without captures or metadata.
    let diagnostics = diagnosticName == "polls-add-group-reveal"
      && app.staticTexts["account.fixture.origin"].firstMatch.label == "https://127.0.0.1:9443"
      && app.staticTexts["account.fixture.identity"].firstMatch.label == "LOCAL admin 103"
      && app.staticTexts["تحرير الاستبيان"].firstMatch.exists
    var observations: [[String: Any]] = []
    var lastScroll: XCUIElement?
    func rectangle(_ value: CGRect) -> [String: Double] {
      ["x": value.minX, "y": value.minY, "width": value.width, "height": value.height]
    }
    func captureFinal(_ hittable: Bool) {
      if diagnostics, let name = diagnosticName {
        let keyboard = app.keyboards.firstMatch
        var finalScroll: [String: Any] = [:]
        if let scroll = lastScroll, scroll.exists {
          var viewport = scroll.frame.intersection(app.frame).insetBy(dx: 0, dy: 8)
          if keyboard.exists && keyboard.frame.minY > viewport.minY {
            viewport.size.height = min(viewport.maxY, keyboard.frame.minY) - viewport.minY
          }
          finalScroll = ["scroll": rectangle(scroll.frame), "viewport": rectangle(viewport), "contained": viewport.contains(element.frame)]
        }
        let fields = app.textFields.matching(identifier: "اسم مجموعة جديدة")
        let fieldCount = fields.count
        let fieldMetadata: [[String: Any]] = fields.allElementsBoundByIndex.prefix(2).map { field in
          ["frame": rectangle(field.frame), "exists": field.exists, "enabled": field.isEnabled, "hittable": field.isHittable,
            "valueLength": (field.value as? String)?.count as Any? ?? NSNull()]
        }
        let values: [String: Any] = ["name": name, "capturedAt": Date().timeIntervalSince1970,
          "label": element.label, "identifier": element.identifier, "finalTarget": rectangle(element.frame),
          "finalHittable": hittable, "finalKeyboardExists": keyboard.exists,
          "finalKeyboard": keyboard.exists ? rectangle(keyboard.frame) : [:], "finalScroll": finalScroll,
          "finalNewGroupFieldCount": fieldCount, "finalNewGroupFields": fieldMetadata, "attempts": observations]
        if let data = try? JSONSerialization.data(withJSONObject: values, options: [.prettyPrinted, .sortedKeys]) {
          let metadata = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
          metadata.name = name + "-attempt-geometry"; metadata.lifetime = .keepAlways; add(metadata)
        }
        if !hittable {
          let tree = XCTAttachment(string: app.debugDescription)
          tree.name = name + "-before-final-assert-AX"; tree.lifetime = .keepAlways; add(tree)
          let screenshot = XCTAttachment(screenshot: app.screenshot())
          screenshot.name = name + "-before-final-assert-screen"; screenshot.lifetime = .keepAlways; add(screenshot)
        }
      }
    }
    for attempt in 0..<12 {
      dismissPopup(app)
      let ownerKey = element.identifier.isEmpty ? element.label : element.identifier
      let containers = app.scrollViews.containing(element.elementType, identifier: ownerKey).allElementsBoundByIndex
      guard let scroll = containers.last(where: { !$0.frame.intersection(app.frame).isEmpty }) else {
        if diagnostics { observations.append(["attempt": attempt, "observedAt": Date().timeIntervalSince1970, "action": "no-visible-scroll-owner", "ownerKey": ownerKey,
          "target": rectangle(element.frame), "hittable": element.isHittable, "ownerCount": containers.count]) }
        break
      }
      if diagnostics { lastScroll = scroll }
      var viewport = scroll.frame.intersection(app.frame).insetBy(dx: 0, dy: 8)
      let keyboard = app.keyboards.firstMatch
      if keyboard.exists && keyboard.frame.minY > viewport.minY {
        viewport.size.height = min(viewport.maxY, keyboard.frame.minY) - viewport.minY
      }
      let target = element.frame
      if diagnostics {
        let visible = target.intersection(viewport)
        observations.append(["attempt": attempt, "observedAt": Date().timeIntervalSince1970, "phase": "before-existing-action", "ownerKey": ownerKey, "ownerCount": containers.count,
          "target": rectangle(target), "scroll": rectangle(scroll.frame), "viewport": rectangle(viewport), "app": rectangle(app.frame),
          "keyboardExists": keyboard.exists, "keyboard": keyboard.exists ? rectangle(keyboard.frame) : [:],
          "exists": element.exists, "enabled": element.isEnabled, "hittable": element.isHittable, "contained": viewport.contains(target),
          "visible": visible.isNull ? [:] : rectangle(visible), "visibleArea": visible.isNull ? 0 : visible.width * visible.height,
          "action": target.minY < viewport.minY ? "existing-downward-drag" : target.maxY > viewport.maxY ? "existing-upward-drag" : "already-in-viewport"])
      }
      if element.isHittable && viewport.contains(target) { captureFinal(true); return }
      let origin = app.coordinate(withNormalizedOffset: .zero)
      // Keep form drags outside editable text and above the keyboard.
      // Fixed RTL scrollbars occupy the physical left gutter.
      let gutter = min(CGFloat(8), viewport.width * 0.1)
      let top = origin.withOffset(CGVector(dx: viewport.maxX - gutter, dy: viewport.minY + viewport.height * 0.25))
      let bottom = origin.withOffset(CGVector(dx: viewport.maxX - gutter, dy: viewport.minY + viewport.height * 0.75))
      if target.minY < viewport.minY { top.press(forDuration: 0.05, thenDragTo: bottom) }
      else if target.maxY > viewport.maxY { bottom.press(forDuration: 0.05, thenDragTo: top) }
      else { break }
    }
    let hittable = element.isHittable
    captureFinal(hittable)
    XCTAssertTrue(hittable, "Local form control '\(element.label)' at \(element.frame) must be exposed before interaction.")
  }
}
