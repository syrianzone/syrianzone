import Foundation
import XCTest

// Isolated adapter input only. No account, Photos, network or system preference action.
final class NativeArabicInputUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }
  @MainActor func testExactArabicInShippingFormField() throws { try run(mode: "shared") }
  @MainActor func testExactArabicInPlainControlledInput() throws { try run(mode: "controlled") }
  @MainActor func testExactArabicInPlainUncontrolledInput() throws { try run(mode: "uncontrolled") }
  @MainActor func testExactArabicInControlledInputWithoutCorrection() throws { try run(mode: "no-correction") }

  @MainActor
  private func run(mode: String) throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == "zone.syrian.ios.uitests.xctrunner", ProcessInfo.processInfo.environment["SIMULATOR_UDID"] != nil else { throw failure("The exact Simulator UI runner is required.") }
    #else
    throw failure("Input diagnostics refuse physical devices and Mac automation.")
    #endif
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate(); app.launch()
    XCTAssertTrue(app.staticTexts["adapter.fixture"].waitForExistence(timeout: 15))
    app.buttons["adapter.tab.inputs"].tap()
    let identifier = app.staticTexts["adapter.inputs.id"].firstMatch
    XCTAssertTrue(identifier.waitForExistence(timeout: 10))
    let id = identifier.label
    guard UUID(uuidString: id)?.uuidString.lowercased() == id else { throw failure("A canonical isolated run UUID is required.") }
    app.buttons["adapter.inputs.mode.\(mode)"].tap()
    let entries = [("user", "مستخدم تحقق محلي \(id) a"), ("place", "مكان تحقق محلي \(id)"),
      ("prose", "مساهمة محلية بصورة اختبار عامة مولدة، للتحقق من الرفع والمراجعة والحذف. \(id)")]
    var mismatches: [String] = [], previousSequence = 0
    for (target, expected) in entries {
      app.buttons["adapter.inputs.target.\(target)"].tap()
      let container = app.otherElements["adapter.inputs.field.\(mode).\(target)"].firstMatch
      XCTAssertTrue(container.waitForExistence(timeout: 5))
      let fields = container.descendants(matching: target == "prose" ? .textView : .textField)
      guard fields.firstMatch.waitForExistence(timeout: 5), fields.count == 1 else {
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "arabic-input-exact-target-container-AX"; tree.lifetime = .keepAlways; add(tree)
        throw failure("The exact mode/target container must hold one native input of the expected role.")
      }
      let field = fields.firstMatch
      expose(field, app: app)
      field.tap()
      // Match the current real-form replacement method, including its clearing keys.
      field.typeKey("a", modifierFlags: .command)
      field.typeText(XCUIKeyboardKey.delete.rawValue)
      field.typeText(expected)
      try checkpoint("focused", field: field, expected: expected, mode: mode, target: target, id: id, app: app,
        previousSequence: &previousSequence, mismatches: &mismatches)
      let sink = app.textFields["حقل التركيز التالي"].firstMatch
      expose(sink, app: app); sink.tap()
      try checkpoint("after-normal-blur", field: field, expected: expected, mode: mode, target: target, id: id, app: app,
        previousSequence: &previousSequence, mismatches: &mismatches)
    }
    let note = XCTAttachment(string: "All checkpoints are collected before asserting text equality, so a focused failure cannot conceal the subsequent blur value. The shipping component is unchanged. An uncontrolled input and a correction-disabled controlled input are separate diagnostic comparisons, not product fixes.")
    note.name = "arabic-input-diagnostic-contract"; note.lifetime = .keepAlways; add(note)
    XCTAssertTrue(mismatches.isEmpty, "Exact Arabic text or focus changed at: \(mismatches.joined(separator: ", ")). Inspect synthetic-value attachments.")
  }

  @MainActor
  private func checkpoint(_ stage: String, field: XCUIElement, expected: String, mode: String, target: String, id: String,
    app: XCUIApplication, previousSequence: inout Int, mismatches: inout [String]) throws {
    let nativeText = field.value as? String
    let capture = app.buttons["adapter.inputs.capture"].firstMatch
    expose(capture, app: app); capture.tap()
    let status = app.staticTexts["adapter.inputs.snapshot"].firstMatch
    let deadline = Date().addingTimeInterval(5)
    var state: [String: Any]?
    while Date() < deadline {
      if let data = status.label.data(using: .utf8), let candidate = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        let sequence = candidate["sequence"] as? Int, sequence > previousSequence { state = candidate; previousSequence = sequence; break }
      RunLoop.current.run(until: Date().addingTimeInterval(0.05))
    }
    guard let state, state["id"] as? String == id, state["mode"] as? String == mode, state["target"] as? String == target else { throw failure("A fresh real input-state snapshot is required.") }
    let record: [String: Any] = ["stage": stage, "mode": mode, "target": target, "expected": expected,
      "actualNativeText": nativeText as Any? ?? NSNull(), "nativeChangeSnapshot": state]
    let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: record, options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
    attachment.name = "arabic-\(mode)-\(target)-\(stage)-exact-values"; attachment.lifetime = .keepAlways; add(attachment)
    let screen = XCTAttachment(screenshot: app.screenshot()); screen.name = "arabic-\(mode)-\(target)-\(stage)"; screen.lifetime = .keepAlways; add(screen)
    if nativeText != expected || state["text"] as? String != expected || state["inputFocused"] as? Bool != (stage == "focused") {
      mismatches.append("\(target):\(stage)")
    }
  }

  @MainActor
  private func expose(_ element: XCUIElement, app: XCUIApplication) {
    for _ in 0..<8 {
      let scroll = app.scrollViews.firstMatch
      let keyboard = app.keyboards.firstMatch
      var visible = scroll.frame.intersection(app.frame).insetBy(dx: 0, dy: 8)
      if keyboard.exists { visible.size.height = max(0, min(visible.maxY, keyboard.frame.minY) - visible.minY) }
      let frame = element.frame
      if element.isHittable && visible.contains(frame) { return }
      let start = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.02, dy: frame.minY < visible.minY ? 0.2 : 0.7))
      let end = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.02, dy: frame.minY < visible.minY ? 0.7 : 0.2))
      start.press(forDuration: 0.05, thenDragTo: end)
    }
    XCTAssertTrue(element.isHittable)
  }
  private func failure(_ message: String) -> NSError { NSError(domain: "NativeArabicInputDiagnostic", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
}
