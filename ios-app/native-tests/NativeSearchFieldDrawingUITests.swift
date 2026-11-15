import Foundation
import XCTest

private enum NativeSearchEmptyPolicy {
  static func matches(value: Any?, placeholder: String?, clearButtonPresent: Bool) -> Bool {
    guard !clearButtonPresent else { return false }
    guard let value else { return true }
    guard let text = value as? String else { return false }
    return text.isEmpty || (placeholder?.isEmpty == false && text == placeholder)
  }
}

// Synthetic adapter-only drawing observations. No account or persisted search.
final class NativeSearchFieldDrawingUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func testLongSyntheticSearchValuesBeforeFocusWhileEditingAndAfterBlur() throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == "zone.syrian.ios.uitests.xctrunner",
      let simulator = ProcessInfo.processInfo.environment["SIMULATOR_UDID"], UUID(uuidString: simulator) != nil else {
      throw failure("Only the exact Simulator runner may observe these synthetic search fields.")
    }
    #else
    throw failure("The search-field drawing probe refuses physical devices.")
    #endif
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    defer { app.terminate() }
    app.terminate(); app.launch()
    XCTAssertTrue(app.staticTexts["adapter.fixture"].waitForExistence(timeout: 15))
    app.buttons["adapter.tab.search"].tap()
    let identity = app.staticTexts["adapter.search.id"].firstMatch
    XCTAssertTrue(identity.waitForExistence(timeout: 10))
    let id = identity.label
    guard UUID(uuidString: id)?.uuidString.lowercased() == id else { throw failure("A canonical mount UUID is required.") }
    let email = "native-users-\(id)-a@native-fixture.invalid"
    let mixed = "بحث عربي عن مستخدم \(email) في دمشق وحلب"
    var sequence = 0, mismatches: [String] = []
    for mode in ["shared", "clip"] {
      for target in ["email", "mixed"] {
        let selector = app.buttons["adapter.search.select.\(mode).\(target)"].firstMatch
        try reveal(selector, app: app); selector.tap()
        let container = app.otherElements["adapter.search.field.\(mode).\(target)"].firstMatch
        XCTAssertTrue(container.waitForExistence(timeout: 10))
        guard container.textFields.firstMatch.waitForExistence(timeout: 5), container.textFields.count == 1,
          container.textViews.count == 0 else { attachFailure(app); throw failure("The exact search wrapper must contain one native single-line TextField.") }
        var searchReference: Int?
        let field = container.textFields.firstMatch, expected = target == "email" ? email : mixed
        try reveal(field, app: app)
        try checkpoint("initial-blurred-prefill", expected: expected, mode: mode, target: target, id: id,
          field: field, container: container, app: app, sequence: &sequence, searchReference: &searchReference, mismatches: &mismatches)
        field.tap()
        try clearNativePrefill(field, mode: mode, target: target, id: id, app: app, sequence: &sequence, searchReference: &searchReference)
        field.typeText(expected)
        try checkpoint("focused-after-real-typing", expected: expected, mode: mode, target: target, id: id,
          field: field, container: container, app: app, sequence: &sequence, searchReference: &searchReference, mismatches: &mismatches)
        let sink = app.textFields["حقل التركيز التالي للبحث"].firstMatch
        try reveal(sink, app: app); sink.tap(); sink.typeText("\n")
        let keyboardGone = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in !app.keyboards.firstMatch.exists }, object: app)
        XCTAssertEqual(XCTWaiter.wait(for: [keyboardGone], timeout: 8), .completed)
        try reveal(field, app: app)
        try checkpoint("after-normal-blur", expected: expected, mode: mode, target: target, id: id,
          field: field, container: container, app: app, sequence: &sequence, searchReference: &searchReference, mismatches: &mismatches)
      }
    }
    let limits = XCTAttachment(string: "Each initial blurred query is an explicit synthetic prefill. The selected TextField must expose its one observed native clear button. Its real clear callback, empty native/controlled values and genuine focused reference are confirmed before retyping the complete query through the keyboard, followed by ordinary focus transfer and Return to blur. Shared renders the current production SearchField, now using lineBreakModeIOS=clip and overflow=hidden on its TextInput. Clip retains the prior raw clip-only comparator without input overflow clipping. No wrapper height, font-scale cap, correction, value or RTL change is added. Actual Search onChange callbacks must observe a clear and final complete query after prefill. The last change must identify the same public focused reference observed at the focused checkpoint, retained through blur. These refs observe public JS focus state, not native eventCount or responder internals. Exact text, native TextField role/frame, wrapper layout and fontScale are asserted or recorded. A TextField accessibility frame cannot detect glyphs drawn beyond that frame. Screenshot review is required to classify wrapping or overflow; a passing diagnostic alone does not prove glyph containment or persistence. Explicit capture and XCTest queries allow UI quiescence, so this does not reproduce the original transition timing identically.")
    limits.name = "search-field-drawing-diagnostic-limits"; limits.lifetime = .keepAlways; add(limits)
    XCTAssertTrue(mismatches.isEmpty, "Exact query, focus, layout or identity differed at: \(mismatches.joined(separator: ", ")). Inspect the retained stages before attributing a cause.")
  }

  @MainActor
  private func clearNativePrefill(_ field: XCUIElement, mode: String, target: String, id: String,
    app: XCUIApplication, sequence: inout Int, searchReference: inout Int?) throws {
    // Native16 exposed this actual child of the selected TextField. It is the
    // phone editing action, not a hardware select-all assumption or JS value set.
    let clear = field.buttons.matching(NSPredicate(format: "label == %@", "مسح النص"))
    guard clear.firstMatch.waitForExistence(timeout: 5), clear.count == 1, clear.firstMatch.isEnabled, clear.firstMatch.isHittable else {
      attachFailure(app); throw failure("The exact selected field must own its one visible native clear button.")
    }
    clear.firstMatch.tap()
    let empty = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      NativeSearchEmptyPolicy.matches(value: field.value, placeholder: field.placeholderValue, clearButtonPresent: clear.count != 0)
    }, object: field)
    guard XCTWaiter.wait(for: [empty], timeout: 5) == .completed else {
      attachFailure(app); throw failure("The real native clear action must empty the selected field before typing.")
    }
    let capture = app.buttons["adapter.search.capture"].firstMatch
    try reveal(capture, app: app); capture.tap()
    let snapshot = app.staticTexts["adapter.search.snapshot"].firstMatch, previousSequence = sequence
    var value: [String: Any]?
    let fresh = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      guard let raw = snapshot.label.data(using: .utf8),
        let observed = try? JSONSerialization.jsonObject(with: raw) as? [String: Any],
        let next = observed["sequence"] as? Int, next > previousSequence else { return false }
      value = observed; return true
    }, object: snapshot)
    guard XCTWaiter.wait(for: [fresh], timeout: 5) == .completed, let value, let next = value["sequence"] as? Int else {
      attachFailure(app); throw failure("A fresh actual clear callback observation must precede typing.")
    }
    sequence = next
    let rawNativeValue = field.value, nativePlaceholder = field.placeholderValue, remainingClearButtons = clear.count
    var observation = value
    observation["rawNativeValue"] = rawNativeValue as Any? ?? NSNull()
    observation["placeholderValue"] = nativePlaceholder as Any? ?? NSNull()
    observation["remainingNativeClearButtons"] = remainingClearButtons
    let record = XCTAttachment(data: try JSONSerialization.data(withJSONObject: observation, options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
    record.name = "search-\(mode)-\(target)-native-clear-before-typing"; record.lifetime = .keepAlways; add(record)
    let last = value["lastSearchChange"] as? [String: Any], reference = value["focusedReferenceID"] as? Int ?? 0
    guard value["id"] as? String == id, value["mode"] as? String == mode, value["target"] as? String == target,
      NativeSearchEmptyPolicy.matches(value: rawNativeValue, placeholder: nativePlaceholder, clearButtonPresent: remainingClearButtons != 0),
      value["controlledValue"] as? String == "", value["latestChange"] as? String == "",
      (value["clearCount"] as? Int ?? 0) > 0, (value["changeCount"] as? Int ?? 0) > 0,
      (value["changes"] as? [String])?.last == "", last?["text"] as? String == "",
      reference > 0, last?["focusedReferenceID"] as? Int == reference, app.keyboards.firstMatch.exists else {
      attachFailure(app); throw failure("The native field, controlled value and genuine focused clear callback must agree before retyping.")
    }
    searchReference = reference
  }

  @MainActor
  private func checkpoint(_ stage: String, expected: String, mode: String, target: String, id: String,
    field: XCUIElement, container: XCUIElement, app: XCUIApplication, sequence: inout Int, searchReference: inout Int?, mismatches: inout [String]) throws {
    let before = field.value as? String, fieldFrame = field.frame, containerFrame = container.frame
    let keyboardPresent = app.keyboards.firstMatch.exists, wrapperAX = container.debugDescription
    let screen = XCTAttachment(screenshot: app.screenshot())
    screen.name = "search-\(mode)-\(target)-\(stage)-before-capture"; screen.lifetime = .keepAlways; add(screen)
    let capture = app.buttons["adapter.search.capture"].firstMatch
    try reveal(capture, app: app); capture.tap()
    let snapshot = app.staticTexts["adapter.search.snapshot"].firstMatch
    var value: [String: Any]?
    let previousSequence = sequence
    let fresh = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      guard let raw = snapshot.label.data(using: .utf8),
        let observed = try? JSONSerialization.jsonObject(with: raw) as? [String: Any],
        let next = observed["sequence"] as? Int, next > previousSequence else { return false }
      value = observed; return true
    }, object: snapshot)
    guard XCTWaiter.wait(for: [fresh], timeout: 5) == .completed, let value,
      let next = value["sequence"] as? Int else { attachFailure(app); throw failure("A fresh search-field observation is required.") }
    sequence = next
    let after = field.value as? String
    let record: [String: Any] = ["stage": stage, "expected": expected, "nativeBeforeCapture": before as Any? ?? NSNull(),
      "nativeAfterCapture": after as Any? ?? NSNull(), "nativeRole": String(describing: field.elementType),
      "wrapperAXBeforeCapture": wrapperAX, "nativeFieldFrameBeforeCapture": String(describing: fieldFrame),
      "nativeWrapperFrameBeforeCapture": String(describing: containerFrame), "nativeFieldFrameAfterCapture": String(describing: field.frame),
      "keyboardPresentBeforeCapture": keyboardPresent, "snapshot": value]
    let data = XCTAttachment(data: try JSONSerialization.data(withJSONObject: record, options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
    data.name = "search-\(mode)-\(target)-\(stage)-exact-metadata"; data.lifetime = .keepAlways; add(data)
    let focused = stage == "focused-after-real-typing"
    let layout = value["wrapperLayout"] as? [String: Any], window = value["window"] as? [String: Any]
    let width = layout?["width"] as? Double ?? 0, height = layout?["height"] as? Double ?? 0
    let fontScale = window?["fontScale"] as? Double ?? 0
    let focusedReference = value["focusedReferenceID"] as? Int ?? 0
    let hasFocus = focusedReference > 0
    let lastChange = value["lastSearchChange"] as? [String: Any]
    let lastSearchReference = lastChange?["focusedReferenceID"] as? Int ?? 0
    let changes = value["changes"] as? [String] ?? []
    let clearCount = value["clearCount"] as? Int ?? -1, changeCount = value["changeCount"] as? Int ?? -1
    let inputEvidence: Bool
    if stage == "initial-blurred-prefill" {
      inputEvidence = clearCount == 0 && changeCount == 0 && lastChange == nil && changes.isEmpty
    } else {
      inputEvidence = clearCount > 0 && changeCount > 1 && changes.last == expected && lastChange?["text"] as? String == expected
        && lastSearchReference > 0 && (focused ? lastSearchReference == focusedReference : lastSearchReference == searchReference)
    }
    if focused {
      if let clearedReference = searchReference, focusedReference != clearedReference { mismatches.append("\(mode).\(target).focus-changed-after-native-clear") }
      searchReference = focusedReference
    }
    let implementation = mode == "shared" ? "current-production-search-field" : "prior-clip-only-input-without-overflow"
    if value["id"] as? String != id || value["mode"] as? String != mode || value["target"] as? String != target || value["implementation"] as? String != implementation
      || before != expected || after != expected || value["controlledValue"] as? String != expected
      || value["latestChange"] as? String != expected || hasFocus != focused || !inputEvidence
      || !width.isFinite || width <= 0 || !height.isFinite || height < 48 || !fontScale.isFinite || fontScale <= 0
      || !containerFrame.contains(fieldFrame) || (focused && !keyboardPresent) || (!focused && keyboardPresent) {
      mismatches.append("\(mode).\(target).\(stage)")
    }
  }

  @MainActor
  private func reveal(_ element: XCUIElement, app: XCUIApplication) throws {
    guard element.waitForExistence(timeout: 10) else { attachFailure(app); throw failure("The exact synthetic search control is absent.") }
    for _ in 0..<12 {
      let key = element.identifier.isEmpty ? element.label : element.identifier
      let owners = app.scrollViews.containing(element.elementType, identifier: key).allElementsBoundByIndex
      guard let scroll = owners.last(where: { !$0.frame.intersection(app.frame).isEmpty }) else { break }
      var viewport = scroll.frame.intersection(app.frame).insetBy(dx: 0, dy: 8)
      let keyboard = app.keyboards.firstMatch
      if keyboard.exists && keyboard.frame.minY > viewport.minY { viewport.size.height = min(viewport.maxY, keyboard.frame.minY) - viewport.minY }
      if element.isHittable && viewport.contains(element.frame) { return }
      guard viewport.height > 44 else { break }
      let origin = app.coordinate(withNormalizedOffset: .zero), gutter = min(CGFloat(8), viewport.width / 4)
      let top = origin.withOffset(CGVector(dx: viewport.maxX - gutter, dy: viewport.minY + viewport.height * 0.25))
      let bottom = origin.withOffset(CGVector(dx: viewport.maxX - gutter, dy: viewport.minY + viewport.height * 0.75))
      if element.frame.minY < viewport.minY { top.press(forDuration: 0.05, thenDragTo: bottom) }
      else if element.frame.maxY > viewport.maxY { bottom.press(forDuration: 0.05, thenDragTo: top) }
      else { break }
    }
    guard element.isHittable else { attachFailure(app); throw failure("The exact search diagnostic control must be hittable.") }
  }
  @MainActor
  private func attachFailure(_ app: XCUIApplication) {
    let tree = XCTAttachment(string: app.debugDescription); tree.name = "search-diagnostic-failure-AX"; tree.lifetime = .keepAlways; add(tree)
    let screen = XCTAttachment(screenshot: app.screenshot()); screen.name = "search-diagnostic-failure-screen"; screen.lifetime = .keepAlways; add(screen)
  }
  private func failure(_ message: String) -> NSError { NSError(domain: "NativeSearchFieldDrawing", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
}
