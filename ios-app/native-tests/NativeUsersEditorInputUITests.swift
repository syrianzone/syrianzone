import Foundation
import XCTest

// Adapter diagnostic only. No account, API request, save, reload or password entry.
final class NativeUsersEditorInputUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func testActualUserEditorWordSequenceInPageSheet() throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == "zone.syrian.ios.uitests.xctrunner",
      let simulator = ProcessInfo.processInfo.environment["SIMULATOR_UDID"], UUID(uuidString: simulator) != nil else {
      throw failure("Only the exact Simulator runner may collect this synthetic UserEditor diagnostic.")
    }
    #else
    throw failure("The UserEditor diagnostic refuses physical devices.")
    #endif
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    defer { app.terminate() }
    app.terminate(); app.launch()
    XCTAssertTrue(app.staticTexts["adapter.fixture"].waitForExistence(timeout: 15))
    app.buttons["adapter.tab.users-input"].tap()
    let runID = app.staticTexts["adapter.users-input.id"].firstMatch
    XCTAssertTrue(runID.waitForExistence(timeout: 10))
    let id = runID.label
    guard UUID(uuidString: id)?.uuidString.lowercased() == id else { throw failure("A fresh canonical fixture UUID is required.") }
    app.buttons["adapter.users-input.open"].tap()
    let container = app.otherElements["adapter.users-input.editor"].firstMatch
    XCTAssertTrue(container.waitForExistence(timeout: 15))
    let names = container.textFields.matching(identifier: "الاسم")
    guard names.firstMatch.waitForExistence(timeout: 5), names.count == 1 else {
      attachFailure(app); throw failure("The actual UserEditor must expose one native name field.")
    }
    let field = names.firstMatch
    expose(field, app: app); field.tap()
    var mismatches: [String] = [], sequence = 0, firstFocusedReference: Int?
    let word = "مستخدم", expected = "مستخدم تحقق محلي \(id) a"
    // Match Users07 and the paired basic control. Do not alter correction,
    // selection, input readiness, keyboard configuration or typing cadence.
    field.typeKey("a", modifierFlags: .command)
    field.typeText(XCUIKeyboardKey.delete.rawValue)
    try checkpoint("initial-clear", expected: "", id: id, field: field, app: app,
      sequence: &sequence, firstFocusedReference: &firstFocusedReference, mismatches: &mismatches)
    field.typeText(word)
    try checkpoint("word-focused", expected: word, id: id, field: field, app: app,
      sequence: &sequence, firstFocusedReference: &firstFocusedReference, mismatches: &mismatches)
    field.typeText(" ")
    try checkpoint("first-space-focused", expected: word + " ", id: id, field: field, app: app,
      sequence: &sequence, firstFocusedReference: &firstFocusedReference, mismatches: &mismatches)
    field.typeText(String(expected.dropFirst((word + " ").count)))
    try checkpoint("remainder-focused", expected: expected, id: id, field: field, app: app,
      sequence: &sequence, firstFocusedReference: &firstFocusedReference, mismatches: &mismatches)
    field.typeKey("a", modifierFlags: .command)
    field.typeText(XCUIKeyboardKey.delete.rawValue)
    field.typeText(expected)
    try checkpoint("single-call-focused", expected: expected, id: id, field: field, app: app,
      sequence: &sequence, firstFocusedReference: &firstFocusedReference, mismatches: &mismatches)
    let emails = container.textFields.matching(identifier: "البريد الإلكتروني")
    guard emails.count == 1 else { throw failure("The unchanged editor email field must provide ordinary blur.") }
    expose(emails.firstMatch, app: app); emails.firstMatch.tap()
    try checkpoint("after-normal-blur", expected: expected, id: id, field: field, app: app,
      sequence: &sequence, firstFocusedReference: &firstFocusedReference, mismatches: &mismatches)
    let limits = XCTAttachment(string: "Actual exported UserEditor, source initialForm(null, options) and functional form patch are used unchanged with all12 groups/42 permissions and the full captured local options DTO. Original record is null. No account, user list, request, save, reload or password value is used. Save/reload attempts are terminal failures. Reference observations use public TextInput.State.currentlyFocusedInput(); they are focused-reference identities, not private field attach/detach instrumentation. Mount/layout/onShow and controlled-name/context effects are bounded observations, not a complete commit counter. Capture and close controls occupy a diagnostic header above the source AdaptivePanes/ScrollView; queries permit quiescence, so this is not a timing-identical reproduction of the complete UsersAdmin screen. Run beside NativeArabicPageSheetUITests/testShippingFormFieldWordSequenceInPageSheet for the existing basic control. Passing this case does not establish a cause for the original prefix loss.")
    limits.name = "users-editor-input-diagnostic-limits"; limits.lifetime = .keepAlways; add(limits)
    XCTAssertTrue(mismatches.isEmpty, "Exact native/controlled text or observed focused-reference identity differed at: \(mismatches.joined(separator: ", ")). Inspect every stage before classifying the cause.")
  }

  @MainActor
  private func checkpoint(_ stage: String, expected: String, id: String, field: XCUIElement, app: XCUIApplication,
    sequence: inout Int, firstFocusedReference: inout Int?, mismatches: inout [String]) throws {
    let beforeCapture = field.value as? String
    let keyboard = app.keyboards.firstMatch, keyboardExists = keyboard.exists
    let keyboardFrame = keyboardExists ? String(describing: keyboard.frame) : "absent"
    let capture = app.buttons["adapter.users-input.capture"].firstMatch
    expose(capture, app: app); capture.tap()
    let status = app.staticTexts["adapter.users-input.snapshot"].firstMatch
    var snapshot: [String: Any]?
    let deadline = Date().addingTimeInterval(5)
    while Date() < deadline {
      if let bytes = status.label.data(using: .utf8), let data = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any] {
        if data["terminalFailure"] != nil { throw failure("The diagnostic attempted a forbidden UserEditor action.") }
        if let fresh = data["sequence"] as? Int, fresh > sequence { snapshot = data; sequence = fresh; break }
      }
      RunLoop.current.run(until: Date().addingTimeInterval(0.05))
    }
    guard let snapshot, snapshot["id"] as? String == id,
      let generation = snapshot["generation"] as? Int, generation > 0,
      let timeline = snapshot["timeline"] as? [[String: Any]], !timeline.isEmpty, timeline.count <= 240,
      let events = snapshot["events"] as? [String], events.count <= 80,
      let forbidden = snapshot["forbiddenAttempts"] as? [String], forbidden.isEmpty,
      let sourceForm = snapshot["sourceForm"] as? [String: Any], sourceForm["id"] is NSNull,
      sourceForm["role"] as? String == "user", sourceForm["passwordIsEmpty"] as? Bool == true,
      sourceForm["emailIsEmpty"] as? Bool == true,
      let options = snapshot["options"] as? [String: Any], options["actorID"] as? Int == 103,
      options["roles"] as? Int == 2, options["groups"] as? Int == 12,
      options["permissions"] as? Int == 42, options["cities"] as? Int == 1,
      options["sha256"] as? String == "ba7edf3b4a3a85c1f4e77773c8914b20323e6488af3cabe209f3d3bebe4f4d88" else {
      attachFailure(app); throw failure("A fresh own-UUID source-editor snapshot with complete synthetic options and no forbidden action is required.")
    }
    let afterCapture = field.value as? String
    let record: [String: Any] = ["stage": stage, "expected": expected,
      "nativeTextBeforeCapture": beforeCapture as Any? ?? NSNull(), "nativeTextAfterCapture": afterCapture as Any? ?? NSNull(),
      "softwareKeyboardExists": keyboardExists, "softwareKeyboardFrame": keyboardFrame,
      "fieldFrame": String(describing: field.frame), "inputSnapshot": snapshot]
    let values = XCTAttachment(data: try JSONSerialization.data(withJSONObject: record, options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
    values.name = "users-editor-input-\(stage)-exact-values"; values.lifetime = .keepAlways; add(values)
    let image = XCTAttachment(screenshot: app.screenshot()); image.name = "users-editor-input-\(stage)"; image.lifetime = .keepAlways; add(image)
    let currentReference = snapshot["focusedReferenceID"] as? Int
    if stage == "initial-clear" { firstFocusedReference = currentReference }
    let expectedFocus = stage == "after-normal-blur"
      ? currentReference != nil && currentReference != firstFocusedReference
      : currentReference != nil && currentReference == firstFocusedReference
    if beforeCapture != expected || afterCapture != expected || snapshot["name"] as? String != expected || !expectedFocus {
      mismatches.append(stage)
    }
    if stage != "initial-clear", snapshot["lastNameFocusedReferenceID"] as? Int != firstFocusedReference {
      mismatches.append(stage + "-source-name-patch-reference")
    }
    // Record an early missing onShow/effect without imposing a readiness barrier.
    if stage == "after-normal-blur", !timeline.contains(where: { $0["kind"] as? String == "editor-mount" })
      || !timeline.contains(where: { $0["kind"] as? String == "modal-on-show" }) {
      mismatches.append(stage + "-lifecycle-observation")
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
      let top = origin.withOffset(CGVector(dx: viewport.maxX - 8, dy: viewport.minY + viewport.height * 0.25))
      let bottom = origin.withOffset(CGVector(dx: viewport.maxX - 8, dy: viewport.minY + viewport.height * 0.75))
      if element.frame.minY < viewport.minY { top.press(forDuration: 0.05, thenDragTo: bottom) }
      else if element.frame.maxY > viewport.maxY { bottom.press(forDuration: 0.05, thenDragTo: top) }
      else { break }
    }
    if !element.isHittable { attachFailure(app) }
    XCTAssertTrue(element.isHittable, "The actual diagnostic control must be visible before interaction.")
  }
  @MainActor
  private func attachFailure(_ app: XCUIApplication) {
    let tree = XCTAttachment(string: app.debugDescription); tree.name = "users-editor-input-failure-AX"; tree.lifetime = .keepAlways; add(tree)
    let image = XCTAttachment(screenshot: app.screenshot()); image.name = "users-editor-input-failure"; image.lifetime = .keepAlways; add(image)
  }
  private func failure(_ message: String) -> NSError { NSError(domain: "NativeUsersEditorInputDiagnostic", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
}
