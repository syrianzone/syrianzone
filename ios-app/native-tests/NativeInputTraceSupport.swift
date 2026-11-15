import XCTest

extension LocalFixtureTestCase {
  var nativeInputTraceEnabled: Bool { ProcessInfo.processInfo.environment["SZ_NATIVE_FIXTURE_INPUT_TRACE"] == "1" }

  @MainActor
  func armNativeInputTrace(_ slot: String, nonce: String, app: XCUIApplication) throws {
    guard nativeInputTraceEnabled else { return }
    guard ["poll-group", "studio-stop"].contains(slot), isInputTraceNonce(nonce) else { throw inputTraceFailure() }
    let proof = try inputTraceRequest("inputtrace.arm.\(slot).\(nonce)", nonce: nonce, phase: "armed", app: app)
    guard Set(proof.keys) == ["phase", "version", "nonce", "slot", "requestSequence"], proof["slot"] as? String == slot else { throw inputTraceFailure() }
  }

  @MainActor
  func attachNativeInputTrace(_ slot: String, nonce: String, expected: String, observedBeforeRead: String?, app: XCUIApplication) throws {
    guard nativeInputTraceEnabled else { return }
    guard isInputTraceNonce(nonce), ["poll-group", "studio-stop"].contains(slot) else { throw inputTraceFailure() }
    let alternatives = slot == "poll-group" ? ["مجموعة أ \(nonce)", "مجموعة ب \(nonce)"] : ["موقف \(nonce) 1", "موقف \(nonce) 2"]
    guard alternatives.contains(expected) else { throw inputTraceFailure() }
    let label = slot == "poll-group" ? "اسم مجموعة جديدة" : "اسم الموقف"
    if app.keyboards.firstMatch.exists {
      let fields = app.textFields.matching(NSPredicate(format: "identifier == %@ OR label == %@", label, label))
      guard fields.count == 1, let current = fields.firstMatch.value as? String, current.count <= 96,
        alternatives.contains(where: { inputTraceSubsequence(current, of: $0) }) else { throw inputTraceFailure() }
      fields.firstMatch.typeText("\n")
      let finished = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in !app.keyboards.firstMatch.exists }, object: app)
      guard XCTWaiter.wait(for: [finished], timeout: 5) == .completed else { throw inputTraceFailure() }
    }
    let proof = try inputTraceRequest("inputtrace.read.\(nonce)", nonce: nonce, phase: "captured", app: app)
    guard Set(proof.keys) == ["phase", "version", "nonce", "slot", "capped", "events", "requestSequence"], proof["slot"] as? String == slot,
      proof["capped"] is Bool, let events = proof["events"] as? [[String: Any]], !events.isEmpty, events.count <= 192 else { throw inputTraceFailure() }
    for (index, event) in events.enumerated() {
      guard Set(event.keys).isSubset(of: ["sequence", "at", "kind", "label", "text", "redacted", "length", "eventCount"]),
        event["sequence"] as? Int == index + 1, let at = event["at"] as? Double, at.isFinite, at >= 0,
        event["label"] as? String == label, let kind = event["kind"] as? String,
        ["observer-attached", "observer-detached", "value-commit", "native-change", "change-text", "focus", "blur"].contains(kind) else { throw inputTraceFailure() }
      if let text = event["text"] as? String {
        guard text.count <= 96, alternatives.contains(where: { inputTraceSubsequence(text, of: $0) }), event["redacted"] == nil, event["length"] == nil else { throw inputTraceFailure() }
      }
      if let redacted = event["redacted"] as? Bool {
        guard redacted, event["text"] == nil, let length = event["length"] as? Int, (0...1_000_000).contains(length) else { throw inputTraceFailure() }
      }
      if let count = event["eventCount"] as? Int, !(0...1_000_000).contains(count) { throw inputTraceFailure() }
    }
    var observed: [String: Any] = ["isNil": observedBeforeRead == nil]
    if let text = observedBeforeRead {
      if text.count <= 96, alternatives.contains(where: { inputTraceSubsequence(text, of: $0) }) { observed["text"] = text }
      else { observed["redactedLength"] = min(text.count, 1_000_000) }
    }
    let data = try JSONSerialization.data(withJSONObject: ["observedBeforeHeaderRead": observed, "expected": expected, "trace": proof], options: [.prettyPrinted, .sortedKeys])
    guard data.count <= 65_536 else { throw inputTraceFailure() }
    let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
    attachment.name = "own-\(slot)-native-input-events"; attachment.lifetime = .keepAlways; add(attachment)
  }

  @MainActor
  private func inputTraceRequest(_ command: String, nonce: String, phase: String, app: XCUIApplication) throws -> [String: Any] {
    let field = app.textFields["account.fixture.destination"], status = app.staticTexts["account.fixture.status"]
    func currentTrace() -> [String: Any]? {
      guard let value = status.value as? String, let data = value.data(using: .utf8), data.count <= 65_536,
        let state = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
      return state["inputTrace"] as? [String: Any]
    }
    let previousSequence = currentTrace()?["requestSequence"] as? Int ?? 0
    guard previousSequence >= 0, previousSequence < Int.max else { throw inputTraceFailure() }
    if phase == "armed" {
      guard field.waitForExistence(timeout: 5), field.isEnabled, field.isHittable else { throw inputTraceFailure() }
      let initial = field.value as? String
      guard initial == nil || initial == "" || initial == field.placeholderValue else { throw inputTraceFailure() }
      field.tap(); field.typeText(command + "\n")
    } else {
      guard phase == "captured" else { throw inputTraceFailure() }
      let reads = app.buttons.matching(identifier: "account.fixture.input-trace.read")
      guard reads.count == 1 else { throw inputTraceFailure() }
      let read = reads.firstMatch, frame = read.frame
      guard [frame.minX, frame.minY, frame.width, frame.height].allSatisfy({ $0.isFinite }), !frame.isEmpty,
        app.frame.contains(frame), read.isEnabled, read.isHittable else { throw inputTraceFailure() }
      read.tap()
    }
    func reply() -> [String: Any]? {
      guard let trace = currentTrace(), trace["requestSequence"] as? Int == previousSequence + 1,
        trace["phase"] as? String == phase, trace["nonce"] as? String == nonce, trace["version"] as? Int == 1 else { return nil }
      return trace
    }
    let accepted = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in reply() != nil }, object: status)
    guard XCTWaiter.wait(for: [accepted], timeout: 5) == .completed, let proof = reply(), !app.staticTexts["account.fixture.navigation-error"].exists else { throw inputTraceFailure() }
    let closed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in !app.keyboards.firstMatch.exists }, object: app)
    guard XCTWaiter.wait(for: [closed], timeout: 5) == .completed else { throw inputTraceFailure() }
    return proof
  }

  private func isInputTraceNonce(_ value: String) -> Bool {
    value.range(of: #"^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$"#, options: .regularExpression) != nil
  }

  private func inputTraceSubsequence(_ text: String, of expected: String) -> Bool {
    var index = text.startIndex
    for character in expected where index < text.endIndex {
      if character == text[index] { index = text.index(after: index) }
    }
    return index == text.endIndex
  }

  private func inputTraceFailure() -> NSError {
    NSError(domain: "NativeInputTrace", code: 1, userInfo: [NSLocalizedDescriptionKey: "The explicitly armed synthetic input trace must acknowledge its exact bounded scope."])
  }
}
