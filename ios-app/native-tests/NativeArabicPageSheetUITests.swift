import Foundation
import XCTest

// Adapter-only paired diagnostic. No account, Photos, network or system setting action.
final class NativeArabicPageSheetUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func testShippingFormFieldWordSequenceInline() throws { try run(presentation: "inline") }

  @MainActor
  func testShippingFormFieldWordSequenceInPageSheet() throws { try run(presentation: "sheet") }

  @MainActor
  private func run(presentation: String) throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == "zone.syrian.ios.uitests.xctrunner",
      let simulator = ProcessInfo.processInfo.environment["SIMULATOR_UDID"], UUID(uuidString: simulator) != nil else {
      throw failure("Only the exact Simulator runner may collect this synthetic input diagnostic.")
    }
    #else
    throw failure("The paired input diagnostic refuses physical devices.")
    #endif
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    defer { app.terminate() }
    app.terminate(); app.launch()
    XCTAssertTrue(app.staticTexts["adapter.fixture"].waitForExistence(timeout: 15))
    app.buttons["adapter.tab.inputs"].tap()
    let runID = app.staticTexts["adapter.inputs.id"].firstMatch
    XCTAssertTrue(runID.waitForExistence(timeout: 10))
    let id = runID.label
    guard UUID(uuidString: id)?.uuidString.lowercased() == id else { throw failure("A fresh canonical fixture UUID is required.") }
    app.buttons["adapter.inputs.mode.shared"].tap()
    app.buttons["adapter.inputs.target.user"].tap()
    app.buttons["adapter.inputs.presentation.\(presentation)"].tap()
    let container = app.otherElements["adapter.inputs.field.shared.user"].firstMatch
    XCTAssertTrue(container.waitForExistence(timeout: 15))
    let fields = container.textFields
    guard fields.firstMatch.waitForExistence(timeout: 5), fields.count == 1 else { attachFailure(app); throw failure("The exact paired container must hold one shipping single-line FormField.") }
    let field = fields.firstMatch
    expose(field, app: app); field.tap()
    var mismatches: [String] = [], sequence = 0
    let word = "مستخدم", expected = "مستخدم تحقق محلي \(id) a"
    // Ordinary Cmd+A/delete and typeText calls match Users07. No selection prop,
    // cursor command, correction change, keyboard-existence wait or delay is added.
    field.typeKey("a", modifierFlags: .command)
    field.typeText(XCUIKeyboardKey.delete.rawValue)
    try checkpoint("initial-clear", expected: "", presentation: presentation, id: id,
      field: field, app: app, sequence: &sequence, mismatches: &mismatches)
    field.typeText(word)
    try checkpoint("word-focused", expected: word, presentation: presentation, id: id,
      field: field, app: app, sequence: &sequence, mismatches: &mismatches)
    field.typeText(" ")
    try checkpoint("first-space-focused", expected: word + " ", presentation: presentation, id: id,
      field: field, app: app, sequence: &sequence, mismatches: &mismatches)
    field.typeText(String(expected.dropFirst((word + " ").count)))
    try checkpoint("remainder-focused", expected: expected, presentation: presentation, id: id,
      field: field, app: app, sequence: &sequence, mismatches: &mismatches)
    field.typeKey("a", modifierFlags: .command)
    field.typeText(XCUIKeyboardKey.delete.rawValue)
    field.typeText(expected)
    try checkpoint("single-call-focused", expected: expected, presentation: presentation, id: id,
      field: field, app: app, sequence: &sequence, mismatches: &mismatches)
    let sink = app.textFields["حقل التركيز التالي"].firstMatch
    expose(sink, app: app); sink.tap()
    try checkpoint("after-normal-blur", expected: expected, presentation: presentation, id: id,
      field: field, app: app, sequence: &sequence, mismatches: &mismatches)
    let limits = XCTAttachment(string: "The shipping FormField and its autoCorrect/selection behavior are unchanged. The five Users07 typing stages run before normal blur. Snapshot capture is an explicit RN button and queries permit UI quiescence, so this does not reproduce the original timing identically. JS onChangeText, controlled-value/context commits, mount/ref/layout and page-sheet onShow markers are observations, not a complete React commit counter or native eventCount/selection instrumentation. Both paths use AdaptivePanes and the same ScrollView keyboard props. Inline has a bounded500pt parent; the page sheet uses its native available bounds, which are recorded. No expected input text is assigned by the fixture. These small-form cases do not prove behavior of the full UserEditor or Promises editor.")
    limits.name = "arabic-paired-\(presentation)-diagnostic-limits"; limits.lifetime = .keepAlways; add(limits)
    XCTAssertTrue(mismatches.isEmpty, "Exact native/JS text or focus differed at: \(mismatches.joined(separator: ", ")). Inspect all collected stages before classifying a cause.")
  }

  @MainActor
  private func checkpoint(_ stage: String, expected: String, presentation: String, id: String,
    field: XCUIElement, app: XCUIApplication, sequence: inout Int, mismatches: inout [String]) throws {
    let beforeCapture = field.value as? String
    let keyboard = app.keyboards.firstMatch
    let keyboardExists = keyboard.exists
    let keyboardFrame = keyboardExists ? String(describing: keyboard.frame) : "absent"
    let capture = app.buttons["adapter.inputs.capture"].firstMatch
    expose(capture, app: app); capture.tap()
    let status = app.staticTexts["adapter.inputs.snapshot"].firstMatch
    var snapshot: [String: Any]?
    let deadline = Date().addingTimeInterval(5)
    while Date() < deadline {
      if let bytes = status.label.data(using: .utf8), let data = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any],
        let fresh = data["sequence"] as? Int, fresh > sequence {
        snapshot = data; sequence = fresh; break
      }
      RunLoop.current.run(until: Date().addingTimeInterval(0.05))
    }
    guard let snapshot, snapshot["id"] as? String == id, snapshot["mode"] as? String == "shared",
      snapshot["target"] as? String == "user", snapshot["presentation"] as? String == presentation,
      let generation = snapshot["generation"] as? Int, generation > 0,
      let reference = snapshot["referenceID"] as? Int, reference > 0,
      let timeline = snapshot["timeline"] as? [[String: Any]], !timeline.isEmpty, timeline.count <= 200,
      snapshot["events"] is [String] else { attachFailure(app); throw failure("A fresh own-UUID paired input snapshot and bounded lifecycle observations are required.") }
    let afterCapture = field.value as? String
    let record: [String: Any] = ["stage": stage, "expected": expected, "nativeTextBeforeCapture": beforeCapture as Any? ?? NSNull(),
      "nativeTextAfterCapture": afterCapture as Any? ?? NSNull(), "softwareKeyboardExists": keyboardExists,
      "softwareKeyboardFrame": keyboardFrame, "fieldFrame": String(describing: field.frame), "inputSnapshot": snapshot]
    let values = XCTAttachment(data: try JSONSerialization.data(withJSONObject: record, options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
    values.name = "arabic-paired-\(presentation)-\(stage)-exact-values"; values.lifetime = .keepAlways; add(values)
    let image = XCTAttachment(screenshot: app.screenshot()); image.name = "arabic-paired-\(presentation)-\(stage)"; image.lifetime = .keepAlways; add(image)
    let focused = stage != "after-normal-blur"
    if beforeCapture != expected || afterCapture != expected || snapshot["text"] as? String != expected
      || snapshot["controlledValue"] as? String != expected || snapshot["inputFocused"] as? Bool != focused {
      mismatches.append(stage)
    }
  }

  @MainActor
  private func expose(_ element: XCUIElement, app: XCUIApplication) {
    XCTAssertTrue(element.waitForExistence(timeout: 10))
    for _ in 0..<12 {
      let ownerKey = element.identifier.isEmpty ? element.label : element.identifier
      let owners = app.scrollViews.containing(element.elementType, identifier: ownerKey).allElementsBoundByIndex
      guard let scroll = owners.last(where: { !$0.frame.intersection(app.frame).isEmpty }) else { break }
      var viewport = scroll.frame.intersection(app.frame).insetBy(dx: 0, dy: 8)
      let keyboard = app.keyboards.firstMatch
      if keyboard.exists && keyboard.frame.minY > viewport.minY {
        viewport.size.height = min(viewport.maxY, keyboard.frame.minY) - viewport.minY
      }
      if element.isHittable && viewport.contains(element.frame) { return }
      let origin = app.coordinate(withNormalizedOffset: .zero)
      let top = origin.withOffset(CGVector(dx: viewport.minX + 8, dy: viewport.minY + viewport.height * 0.25))
      let bottom = origin.withOffset(CGVector(dx: viewport.minX + 8, dy: viewport.minY + viewport.height * 0.75))
      if element.frame.minY < viewport.minY { top.press(forDuration: 0.05, thenDragTo: bottom) }
      else if element.frame.maxY > viewport.maxY { bottom.press(forDuration: 0.05, thenDragTo: top) }
      else { break }
    }
    if !element.isHittable { attachFailure(app) }
    XCTAssertTrue(element.isHittable, "The actual paired diagnostic control must be visible before interaction.")
  }

  @MainActor
  private func attachFailure(_ app: XCUIApplication) {
    let tree = XCTAttachment(string: app.debugDescription); tree.name = "arabic-paired-failure-AX"; tree.lifetime = .keepAlways; add(tree)
    let image = XCTAttachment(screenshot: app.screenshot()); image.name = "arabic-paired-failure"; image.lifetime = .keepAlways; add(image)
  }
  private func failure(_ message: String) -> NSError { NSError(domain: "NativeArabicPairedDiagnostic", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
}
