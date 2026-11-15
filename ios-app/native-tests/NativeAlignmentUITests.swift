import XCTest

// Requires the dedicated account fixture and preservation flag. No export or server write is activated.
final class NativeAlignmentUITests: LocalFixtureTestCase {
  private let horizontal = "الموضع الأفقي، من 0 يساراً إلى 100 يميناً"
  private let vertical = "الموضع العمودي، من 0 أعلى إلى 100 أسفل"

  @MainActor
  func testNativeDrawingDragRenameCoordinatesColdResumeColorCancelAndOwnedCleanup() throws {
    let run = UUID().uuidString, name = "Alignment QA \(run)"
    let app = try launchAlignment(run, stage: "fresh")
    defer { app.terminate() }
    XCTAssertEqual(try proof(app)["phase"] as? String, "armed")
    XCTAssertEqual(try proof(app)["initiallyAbsent"] as? Bool, true)
    open("alignment", app: app)
    let page = try alignmentPage(app)
    for (label, expected) in [("المحور الأفقي (اليسار)", "اقتصادي"), ("المحور الأفقي (اليمين)", "ليبرالي"),
      ("المحور العمودي (الأعلى)", "محافظ"), ("المحور العمودي (الأسفل)", "تقدمي")] {
      let field = try unique(app.textFields.matching(identifier: label))
      try expose(field, in: page, app: app)
      XCTAssertEqual(field.value as? String, expected, "The real default axes must precede every drawing change.")
    }
    try saved(app)
    open("alignment_observe", app: app)
    XCTAssertEqual(try points(app).count, 0)
    try defaults(app)

    var canvas = try drawing(0, app: app)
    try expose(canvas, in: page, app: app)
    try requireDrawing(canvas, in: page, app: app)
    canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: 0.30)).tap()
    XCTAssertTrue(app.buttons["تعديل 1 نقطة"].firstMatch.waitForExistence(timeout: 10))
    try saved(app); open("alignment_observe", app: app)
    let initial = try XCTUnwrap(try points(app).first)
    XCTAssertEqual(initial.name, "نقطة 1"); XCTAssertEqual(initial.color.lowercased(), "#f44336")
    XCTAssertEqual(initial.x, 0.25, accuracy: 0.04); XCTAssertEqual(initial.y, 0.30, accuracy: 0.04)

    canvas = try drawing(1, app: app)
    try expose(canvas, in: page, app: app); try requireDrawing(canvas, in: page, app: app)
    canvas.coordinate(withNormalizedOffset: CGVector(dx: initial.x, dy: initial.y)).press(forDuration: 0.1,
      thenDragTo: canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.65, dy: 0.55)))
    try saved(app); open("alignment_observe", app: app)
    let moved = try XCTUnwrap(try points(app).first)
    XCTAssertEqual(moved.id, initial.id); XCTAssertEqual(try points(app).count, 1)
    XCTAssertGreaterThan(abs(moved.x - initial.x), 0.15); XCTAssertGreaterThan(abs(moved.y - initial.y), 0.15)
    XCTAssertEqual(moved.x, 0.65, accuracy: 0.04); XCTAssertEqual(moved.y, 0.55, accuracy: 0.04)

    try press("تعديل 1 نقطة", owner: page, app: app)
    let sheet = try pointsPage(app)
    let nameField = try unique(sheet.textFields.matching(identifier: "اسم النقطة \(initial.id)"))
    try expose(nameField, in: sheet, app: app)
    replace(nameField, with: name); XCTAssertEqual(nameField.value as? String, name)
    let x = try unique(sheet.textFields.matching(identifier: horizontal))
    let y = try unique(sheet.textFields.matching(identifier: vertical))
    try expose(x, in: sheet, app: app); replace(x, with: "37.5"); XCTAssertEqual(x.value as? String, "37.5")
    try expose(y, in: sheet, app: app); replace(y, with: "62.5"); XCTAssertEqual(y.value as? String, "62.5")
    // Decimal-pad fields have no Return. The unchanged single-line name field supplies its normal blur action.
    try expose(nameField, in: sheet, app: app); nameField.tap(); nameField.typeText("\n")
    try keyboardClosed(app)
    XCTAssertEqual(nameField.value as? String, name)
    try press("حفظ موضع النقطة", owner: sheet, app: app)
    XCTAssertEqual(x.value as? String, "37.5"); XCTAssertEqual(y.value as? String, "62.5")
    try press("تم", owner: sheet, app: app)
    try saved(app); open("alignment_checkpoint", app: app)
    try expectOwnedPoint(run, id: initial.id, app: app)

    open("home", app: app)
    XCTAssertTrue(app.buttons["إعدادات الرئيسية"].waitForExistence(timeout: 15))
    open("alignment", app: app); try saved(app); open("alignment_observe", app: app)
    try expectOwnedPoint(run, id: initial.id, app: app)
    app.terminate()
    _ = try launchAlignment(run, stage: "resume")
    XCTAssertEqual(try proof(app)["phase"] as? String, "checkpoint")
    let restored = try XCTUnwrap(try proof(app)["point"] as? [String: Any])
    XCTAssertEqual(restored["id"] as? Int, initial.id); XCTAssertEqual(restored["name"] as? String, name)
    open("alignment", app: app)
    let restoredPage = try alignmentPage(app)
    XCTAssertTrue(app.buttons["تعديل 1 نقطة"].firstMatch.waitForExistence(timeout: 15))
    try saved(app); open("alignment_observe", app: app)
    try expectOwnedPoint(run, id: initial.id, app: app)
    try press("تعديل 1 نقطة", owner: restoredPage, app: app)
    let reopened = try pointsPage(app)
    XCTAssertEqual(try unique(reopened.textFields.matching(identifier: "اسم النقطة \(initial.id)")).value as? String, name)
    XCTAssertEqual(try unique(reopened.textFields.matching(identifier: horizontal)).value as? String, "37.5")
    XCTAssertEqual(try unique(reopened.textFields.matching(identifier: vertical)).value as? String, "62.5")
    try press("تم", owner: reopened, app: app)
    let colorPage = try colorPageAfterPointEditor(run, id: initial.id, app: app)

    // Native114 proved the separate service's lowercase close Button and three mode controls.
    // One guarded normal cancellation must preserve the owned point and default palette.
    try pressSourceColorButton("أعلى اليسار", owner: colorPage, app: app)
    try cancelObservedSystemColorPanel(app: app)
    try saved(app); open("alignment_observe", app: app)
    try expectOwnedPoint(run, id: initial.id, app: app); try defaults(app)

    try press("تعديل 1 نقطة", owner: colorPage, app: app)
    let finalSheet = try pointsPage(app)
    XCTAssertEqual(try unique(finalSheet.textFields.matching(identifier: "اسم النقطة \(initial.id)")).value as? String, name)
    try press("حذف \(name)", owner: finalSheet, app: app)
    let confirmation = try ownedPointDeletionConfirmation(app: app)
    try press("تأكيد الحذف", owner: confirmation, app: app)
    XCTAssertTrue(app.staticTexts["لا توجد نقاط بعد"].firstMatch.waitForExistence(timeout: 10))
    try press("تم", owner: try pointsPage(app), app: app)
    XCTAssertTrue(app.buttons["تعديل 0 نقطة"].firstMatch.waitForExistence(timeout: 10))
    try saved(app); open("alignment_empty_saved", app: app)
    XCTAssertEqual(try proof(app)["phase"] as? String, "empty-saved"); XCTAssertEqual(try points(app).count, 0); try defaults(app)
    app.terminate()
    _ = try launchAlignment(run, stage: "close")
    XCTAssertEqual(try proof(app)["phase"] as? String, "closed")
    XCTAssertEqual(try proof(app)["documentAbsent"] as? Bool, true); XCTAssertEqual(try proof(app)["ownerAbsent"] as? Bool, true)
    XCTAssertFalse(app.staticTexts["account.fixture.identity"].exists, "Cold close must not import App or adopt its fresh session.")
  }

  @MainActor
  private func ownedPointDeletionConfirmation(app: XCUIApplication) throws -> XCUIElement {
    let title = "حذف هذه النقطة؟"
    let owners = app.scrollViews.containing(.staticText, identifier: title)
    let ready = wait(10) {
      let scopes = owners.allElementsBoundByAccessibilityElement
      guard scopes.count == 1, let owner = scopes.first, owner.exists else { return false }
      let heading = owner.staticTexts.matching(NSPredicate(format: "label == %@", title))
      let confirm = owner.buttons.matching(NSPredicate(format: "label == %@", "تأكيد الحذف"))
      let cancel = owner.buttons.matching(NSPredicate(format: "label == %@", "إلغاء"))
      return heading.firstMatch.exists && confirm.count == 1 && confirm.firstMatch.exists
        && cancel.count == 1 && cancel.firstMatch.exists
    }
    do {
      try require(ready, "The real exact point-deletion confirmation must finish presenting its one scroll owner, title and unique typed confirm/cancel controls before any confirmation action.")
      let owner = try unique(owners)
      try require(owner.staticTexts.matching(NSPredicate(format: "label == %@", title)).firstMatch.exists
        && owner.buttons.matching(NSPredicate(format: "label == %@", "تأكيد الحذف")).count == 1
        && owner.buttons.matching(NSPredicate(format: "label == %@", "إلغاء")).count == 1
        && app.staticTexts.matching(NSPredicate(format: "label == %@", "حذف الرسم المحفوظ؟")).count == 0,
        "Only the real point confirmation, never the saved-drawing reset, may authorize the existing owned-point confirmation tap.")
      return owner
    } catch {
      let state: [String: Any] = ["fixture": "owned-point-confirmation-presentation-refusal", "hostState": app.state.rawValue,
        "hostExists": app.exists, "exactConfirmationScrollCount": owners.count, "ready": ready,
        "confirmationTapAttempted": false, "selectionOrResetAttempted": false]
      let note = XCTAttachment(data: try JSONSerialization.data(withJSONObject: state, options: [.sortedKeys]), uniformTypeIdentifier: "public.json")
      note.name = "owned-point-confirmation-state-before-termination"; note.lifetime = .keepAlways; add(note)
      if app.state == .runningForeground && app.exists {
        // This same owned app follows the exact nonce-bound point Delete; no navigation or other action intervenes.
        let image = XCTAttachment(screenshot: app.screenshot())
        image.name = "owned-post-point-delete-before-confirmation-refusal"; image.lifetime = .keepAlways; add(image)
        for label in [title, "تأكيد الحذف", "إلغاء", "نقاط البوصلة", "حذف الرسم المحفوظ؟"] {
          let nodes = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).allElementsBoundByAccessibilityElement
          var rows: [[String: Any]] = []
          for node in nodes.prefix(4) where node.exists {
            let frame = node.frame, finite = [frame.minX, frame.minY, frame.width, frame.height].allSatisfy(\.isFinite)
            rows.append(["role": node.elementType.rawValue, "frame": finite ? [frame.minX, frame.minY, frame.width, frame.height] : [],
              "enabled": node.isEnabled, "hittable": node.isHittable])
          }
          let value: [String: Any] = ["fixedLabel": label, "count": nodes.count, "nodesOmitted": nodes.count > 4, "nodes": rows]
          let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
          try require(data.count <= 4096, "Owned confirmation-refusal observations must remain bounded.")
          let item = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
          item.name = "owned-point-confirmation-fixed-control"; item.lifetime = .keepAlways; add(item)
        }
      }
      throw error
    }
  }

  @MainActor
  private func cancelObservedSystemColorPanel(app: XCUIApplication) throws {
    let service = XCUIApplication(bundleIdentifier: "com.apple.UIKit.ColorPickerUIService")
    do {
      let presented = wait(10) {
        guard app.state != .notRunning && service.exists else { return false }
        return ["close", "Grid", "Spectrum", "Sliders"].allSatisfy { label in
          let buttons = service.buttons.matching(NSPredicate(format: "label == %@", label))
          return buttons.count == 1 && buttons.firstMatch.exists
        }
      }
      try require(presented,
        "The real color service opened by this owned consumer must expose its exact cancellation and mode controls before semantic checks.")
      func controls() throws -> XCUIElement {
        try require(app.state != .notRunning && service.exists, "The owned host and observed color presentation must remain alive.")
        for label in ["Grid", "Spectrum", "Sliders"] {
          let nodes = service.buttons.matching(NSPredicate(format: "label == %@", label)).allElementsBoundByAccessibilityElement
          try require(nodes.count == 1 && nodes[0].exists && nodes[0].elementType == .button
            && nodes[0].isEnabled && nodes[0].isHittable && finiteContained(nodes[0].frame, in: app.frame),
            "Each of the three observed color-mode Buttons must remain unique, enabled, hittable and contained before cancellation.")
        }
        let buttons = service.buttons.matching(NSPredicate(format: "label == %@", "close")).allElementsBoundByAccessibilityElement
        try require(buttons.count == 1 && buttons[0].exists && buttons[0].elementType == .button
          && buttons[0].label == "close" && buttons[0].identifier.isEmpty && buttons[0].isEnabled && buttons[0].isHittable
          && finiteContained(buttons[0].frame, in: app.frame),
          "Only Native114's exact unique lowercase close Button in the observed service may cancel this picker.")
        return buttons[0]
      }
      let close = try controls(), viewport = app.frame
      var previous: CGRect?, since: TimeInterval?, samples = 0
      let ready = wait(5) {
        guard close.exists && close.isEnabled && close.isHittable else { previous = nil; since = nil; samples = 0; return false }
        let frame = close.frame
        guard self.finiteContained(frame, in: viewport) else { previous = nil; since = nil; samples = 0; return false }
        let now = ProcessInfo.processInfo.systemUptime
        if previous == frame { samples += 1 } else { previous = frame; since = now; samples = 1 }
        return samples >= 3 && now - (since ?? now) >= 0.2
      }
      try require(ready, "The one observed cancellation Button must settle before its normal tap.")
      let fresh = try controls()
      try require(close.exists && fresh.exists && close.frame == previous && fresh.frame == previous
        && close.label == "close" && close.identifier.isEmpty && close.isEnabled && close.isHittable
        && finiteContained(close.frame, in: app.frame),
        "The full observed panel contract and same stable cancellation geometry must remain current immediately before one tap.")
      close.tap()
      let gone = wait(10) {
        let panelGone = !service.exists || ["close", "Grid", "Spectrum", "Sliders"].allSatisfy { label in
          service.buttons.matching(NSPredicate(format: "label == %@", label)).count == 0
        }
        return panelGone && app.state != .notRunning
          && app.scrollViews.containing(.staticText, identifier: "مولد البوصلة السياسية المخصص").count == 1
          && app.scrollViews.containing(.staticText, identifier: "نقاط البوصلة").count == 0
      }
      try require(gone, "The observed picker controls must disappear and the same owned page must return without selecting a color.")
    } catch {
      try attachObservedColorCancellationFailure(service, app: app)
      throw error
    }
  }

  @MainActor
  private func attachObservedColorCancellationFailure(_ service: XCUIApplication, app: XCUIApplication) throws {
    let state: [String: Any] = ["fixture": "owned-color-cancellation-refusal", "hostState": app.state.rawValue,
      "serviceState": service.state.rawValue, "hostAlive": app.state != .notRunning, "serviceExists": service.exists,
      "selectionAttempted": false, "serviceActivationRequested": false]
    let note = XCTAttachment(data: try JSONSerialization.data(withJSONObject: state, options: [.sortedKeys]), uniformTypeIdentifier: "public.json")
    note.name = "owned-color-cancellation-state-before-termination"; note.lifetime = .keepAlways; add(note)
    guard service.exists else { return }
    for label in ["close", "Grid", "Spectrum", "Sliders"] {
      let nodes = service.buttons.matching(NSPredicate(format: "label == %@", label)).allElementsBoundByAccessibilityElement
      var rows: [[String: Any]] = []
      for node in nodes.prefix(3) where node.exists {
        let frame = node.frame, finite = [frame.minX, frame.minY, frame.width, frame.height].allSatisfy(\.isFinite)
        rows.append(["role": node.elementType.rawValue, "frame": finite ? [frame.minX, frame.minY, frame.width, frame.height] : [],
          "enabled": node.isEnabled, "hittable": node.isHittable, "identifierEmpty": node.identifier.isEmpty])
      }
      let value: [String: Any] = ["fixedLabel": label, "typedButtonCount": nodes.count, "nodesOmitted": nodes.count > 3, "nodes": rows]
      let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
      try require(data.count <= 4096, "Observed cancellation-refusal metadata must remain bounded.")
      let item = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
      item.name = "owned-color-cancellation-" + label; item.lifetime = .keepAlways; add(item)
    }
  }

  @MainActor
  private func launchAlignment(_ run: String, stage: String) throws -> XCUIApplication {
    let environment = ProcessInfo.processInfo.environment
    guard environment["SZ_NATIVE_FIXTURE_ORIGIN"] == "https://127.0.0.1:9443",
      environment["SZ_NATIVE_FIXTURE_PRESERVE_ALIGNMENT_DOCUMENT"] == "1",
      let gate = environment["SZ_NATIVE_FIXTURE_GATE"], gate.range(of: "^[A-Za-z0-9_-]{16,256}$", options: .regularExpression) != nil else {
      throw failure("The dedicated local Alignment preservation configuration is required.")
    }
    var url = URLComponents(); url.scheme = "syrianzone"; url.host = "fixture"; url.path = "/session"
    url.queryItems = [URLQueryItem(name: "user", value: "member"), URLQueryItem(name: "variant", value: "alignment"),
      URLQueryItem(name: "run", value: run), URLQueryItem(name: "stage", value: stage)]
    url.fragment = gate
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate(); app.open(try XCTUnwrap(url.url)); dismissOwnPrompt()
    if stage == "close" {
      try require(wait(20) { app.staticTexts["account.fixture.status"].label == "LOCAL ALIGNMENT CLOSED" }, "The cold fixture must close only this verified owned empty document.")
    } else {
      assertLocal(app, user: "member", id: 101)
      XCTAssertTrue(app.buttons["إعدادات الرئيسية"].waitForExistence(timeout: 20))
    }
    XCTAssertEqual(try proof(app)["run"] as? String, run)
    return app
  }

  @MainActor
  private func proof(_ app: XCUIApplication) throws -> [String: Any] {
    let raw = try XCTUnwrap(app.staticTexts["account.fixture.status"].value as? String)
    let value = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any])
    return try XCTUnwrap(value["alignment"] as? [String: Any])
  }

  private struct Point { let id: Int; let name: String; let color: String; let x: Double; let y: Double }
  @MainActor
  private func points(_ app: XCUIApplication) throws -> [Point] {
    let rows = try XCTUnwrap(try proof(app)["dots"] as? [[String: Any]])
    try require(rows.count <= 1, "Only this fresh run's one point may be observed or deleted.")
    return try rows.map { row in
      let id = try XCTUnwrap(row["id"] as? Int), name = try XCTUnwrap(row["name"] as? String), color = try XCTUnwrap(row["color"] as? String)
      let x = try XCTUnwrap(row["x"] as? Double), y = try XCTUnwrap(row["y"] as? Double)
      try require(id > 0 && x.isFinite && y.isFinite && (0...1).contains(x) && (0...1).contains(y), "Owned point coordinates and ID must be finite and valid.")
      return Point(id: id, name: name, color: color, x: x, y: y)
    }
  }

  @MainActor
  private func defaults(_ app: XCUIApplication) throws {
    XCTAssertEqual(try proof(app)["defaultAxes"] as? Bool, true); XCTAssertEqual(try proof(app)["defaultPalette"] as? Bool, true)
  }
  @MainActor
  private func expectOwnedPoint(_ run: String, id: Int, app: XCUIApplication) throws {
    let list = try points(app); XCTAssertEqual(list.count, 1)
    let point = try XCTUnwrap(list.first)
    XCTAssertEqual(point.id, id); XCTAssertEqual(point.name, "Alignment QA \(run)"); XCTAssertEqual(point.color.lowercased(), "#f44336")
    XCTAssertEqual(point.x, 0.375); XCTAssertEqual(point.y, 0.625); try defaults(app)
  }

  @MainActor
  private func colorPageAfterPointEditor(_ run: String, id: Int, app: XCUIApplication) throws -> XCUIElement {
    let pointEditors = app.scrollViews.containing(.staticText, identifier: "نقاط البوصلة")
    try require(wait { pointEditors.count == 0 }, "The owned point editor must disappear before resolving any page color control.")
    try saved(app); open("alignment_observe", app: app)
    try expectOwnedPoint(run, id: id, app: app)
    let page = try alignmentPage(app)
    let heading = page.staticTexts.matching(NSPredicate(format: "label == %@", "ألوان الأقسام"))
    try revealSourceColorHeading(heading, in: page, app: app)
    if pointEditors.count != 0 {
      try attachColorRevealDiagnostics(page, app: app)
      throw failure("A point editor must not cover the source color section.")
    }
    return page
  }

  private struct PassiveSourceHeading { let frame: CGRect; let enabled: Bool; let hittable: Bool }

  @MainActor
  private func physicalSourceColorHeading(_ query: XCUIElementQuery) -> PassiveSourceHeading? {
    let count = query.count
    guard (1...2).contains(count) else { return nil }
    var observed: PassiveSourceHeading?
    for index in 0..<count {
      let element = query.element(boundBy: index), frame = element.frame
      guard element.exists && element.elementType == .staticText && element.label == "ألوان الأقسام"
        && [frame.minX, frame.minY, frame.width, frame.height].allSatisfy(\.isFinite) && frame.width > 0 && frame.height > 0 else { return nil }
      let current = PassiveSourceHeading(frame: frame, enabled: element.isEnabled, hittable: element.isHittable)
      if let prior = observed, prior.frame != current.frame || prior.enabled != current.enabled || prior.hittable != current.hittable { return nil }
      observed = current
    }
    return query.count == count ? observed : nil
  }

  @MainActor
  private func pressSourceColorButton(_ label: String, owner: XCUIElement, app: XCUIApplication) throws {
    try defaults(app)
    let buttons = owner.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", label))
    let labels = owner.staticTexts.matching(NSPredicate(format: "label == %@", label))
    if buttons.count != 1 || labels.count != 1 {
      try attachColorRevealDiagnostics(owner, app: app)
      throw failure("The observed source-name color row must contain exactly one typed Button and its exact source-label StaticText.")
    }
    let button = buttons.firstMatch
    try expose(button, in: owner, app: app)
    let suffix = button.label.hasPrefix(label) ? String(button.label.dropFirst(label.count)) : ""
    let boundary = suffix.unicodeScalars.first.map { !CharacterSet.letters.contains($0) && !CharacterSet.decimalDigits.contains($0) } == true
    if buttons.count != 1 || labels.count != 1 || !button.exists || button.elementType != .button || !boundary
      || !button.isEnabled || !button.isHittable || !finiteContained(button.frame, in: owner.frame.intersection(app.frame))
      || !labels.firstMatch.exists || !finiteContained(labels.firstMatch.frame, in: button.frame)
      || app.scrollViews.containing(.staticText, identifier: "نقاط البوصلة").count != 0 {
      try attachColorRevealDiagnostics(owner, app: app)
      throw failure("Only the unique observed composite color Button with a full source-name boundary and its exact contained label may be activated.")
    }
    button.tap()
  }

  @MainActor
  private func revealSourceColorHeading(_ query: XCUIElementQuery, in page: XCUIElement, app: XCUIApplication) throws {
    // The source color section follows the axes below the edit-point control. Native104 stopped before it was revealed.
    // Only this exact heading may be absent while the already-proved page receives the same bounded gutter scroll.
    for _ in 0..<12 {
      if !page.exists || app.scrollViews.containing(.staticText, identifier: "نقاط البوصلة").count != 0 || app.keyboards.count != 0 {
        try attachColorRevealDiagnostics(page, app: app)
        throw failure("Only the owned page without its point editor or keyboard may reveal the source color section.")
      }
      let count = query.count
      if count > 2 || (count > 0 && physicalSourceColorHeading(query) == nil) {
        try attachColorRevealDiagnostics(page, app: app)
        throw failure("The passive exact heading may have only the observed one physical frame represented by at most two identical StaticText descriptors.")
      }
      let viewport = page.frame.intersection(app.frame), visible = viewport.insetBy(dx: 0, dy: 4)
      if !finiteContained(viewport, in: app.frame) || visible.height <= 80 {
        try attachColorRevealDiagnostics(page, app: app)
        throw failure("The owned page must have finite visible geometry before a color-section scroll.")
      }
      var towardLaterContent = true
      if let heading = physicalSourceColorHeading(query) {
        let frame = heading.frame
        if ![frame.minX, frame.minY, frame.width, frame.height].allSatisfy(\.isFinite)
          || frame.width <= 0 || frame.height <= 0 || frame.width > viewport.width || frame.height > visible.height {
          try attachColorRevealDiagnostics(page, app: app)
          throw failure("The exact source color heading must fit the owned page viewport.")
        }
        if visible.contains(frame) {
          if !wait(5, {
            guard let current = self.physicalSourceColorHeading(query) else { return false }
            return current.enabled && current.hittable && visible.contains(current.frame)
          }) || physicalSourceColorHeading(query).map({ visible.contains($0.frame) && $0.enabled && $0.hittable }) != true {
            try attachColorRevealDiagnostics(page, app: app)
            throw failure("The revealed exact source color heading must retain one observed physical frame, full containment and matching enabled/hittable states.")
          }
          return
        }
        towardLaterContent = frame.maxY > visible.maxY
      }
      let x = viewport.maxX - 8, upper = visible.minY + visible.height * 0.22, lower = visible.minY + visible.height * 0.78
      let start = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: x - app.frame.minX,
        dy: (towardLaterContent ? lower : upper) - app.frame.minY))
      let end = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: x - app.frame.minX,
        dy: (towardLaterContent ? upper : lower) - app.frame.minY))
      start.press(forDuration: 0.05, thenDragTo: end)
    }
    try attachColorRevealDiagnostics(page, app: app)
    throw failure("The exact source color heading did not resolve to one observed visible physical frame after twelve bounded page gestures.")
  }

  @MainActor
  private func attachColorRevealDiagnostics(_ page: XCUIElement, app: XCUIApplication) throws {
    if !page.exists {
      let data = try JSONSerialization.data(withJSONObject: ["fixture": "owned-alignment-color-reveal", "ownedPageExists": false], options: [.sortedKeys])
      let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
      attachment.name = "owned-alignment-color-page-absent"; attachment.lifetime = .keepAlways
      add(attachment)
      return
    }
    try attachOwnedPageHeadingCounts(page, app: app)
    try attachColorControlCounts(page, app: app)
  }

  @MainActor
  private func attachOwnedPageHeadingCounts(_ page: XCUIElement, app: XCUIApplication) throws {
    let labels = ["مولد البوصلة السياسية المخصص", "محاور البوصلة", "ألوان الأقسام", "تصدير البوصلة", "الرسم محفوظ محلياً"]
    var rows: [[String: Any]] = []
    for label in labels {
      let query = page.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label))
      let count = query.count
      var nodes: [[String: Any]] = []
      if count <= 4 {
        for index in 0..<count {
          let node = query.element(boundBy: index), frame = node.frame
          let finite = [frame.minX, frame.minY, frame.width, frame.height].allSatisfy(\.isFinite)
          nodes.append(["role": node.elementType.rawValue, "enabled": node.isEnabled, "hittable": node.isHittable,
            "finite": finite, "frame": finite ? [frame.minX, frame.minY, frame.width, frame.height] : []])
        }
      }
      rows.append(["sourceLabel": label, "staticTextCount": page.staticTexts.matching(NSPredicate(format: "label == %@", label)).count,
        "anyRoleCount": count, "nodesOmitted": count > 4, "nodes": nodes])
    }
    let frame = page.frame
    let finite = [frame.minX, frame.minY, frame.width, frame.height].allSatisfy(\.isFinite)
    let body: [String: Any] = ["fixture": "owned-alignment-page-heading-observation", "readOnly": true,
      "pageFrame": finite ? [frame.minX, frame.minY, frame.width, frame.height] : [], "pageFrameFinite": finite,
      "pointEditorCount": app.scrollViews.containing(.staticText, identifier: "نقاط البوصلة").count, "headings": rows]
    let data = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
    try require(data.count <= 8192, "Owned page heading observations must remain bounded.")
    let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
    attachment.name = "owned-alignment-page-heading-counts"; attachment.lifetime = .keepAlways
    add(attachment)
  }

  @MainActor
  private func attachColorControlCounts(_ page: XCUIElement, app: XCUIApplication) throws {
    // Only source-label prefixes and bounded native color-label suffixes are observed. No tree, values, identifiers or URLs are captured.
    let labels = ["أعلى اليسار", "أعلى اليمين", "أسفل اليسار", "أسفل اليمين"]
    var rows: [[String: Any]] = []
    for label in labels {
      let query = page.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", label))
      let count = query.count
      var nodes: [[String: Any]] = []
      if count <= 4 {
        for index in 0..<count {
          let node = query.element(boundBy: index), frame = node.frame
          let nativeLabel = node.label
          let suffix = nativeLabel.hasPrefix(label) ? String(nativeLabel.dropFirst(label.count)) : ""
          let allowed = CharacterSet.letters.union(.decimalDigits).union(.nonBaseCharacters).union(.whitespacesAndNewlines)
            .union(CharacterSet(charactersIn: ",،()#.%+-"))
          let safeSuffix = nativeLabel.hasPrefix(label) && suffix.utf8.count <= 96 && suffix.unicodeScalars.allSatisfy { allowed.contains($0) }
          let finite = [frame.minX, frame.minY, frame.width, frame.height].allSatisfy(\.isFinite)
          nodes.append(["role": node.elementType.rawValue, "enabled": node.isEnabled, "hittable": node.isHittable,
            "nativeColorSuffix": safeSuffix ? suffix : "[redacted]", "suffixUTF8Count": suffix.utf8.count,
            "finite": finite, "frame": finite ? [frame.minX, frame.minY, frame.width, frame.height] : []])
        }
      }
      rows.append(["sourceLabel": label, "count": count, "nodesOmitted": count > 4, "nodes": nodes])
    }
    let body: [String: Any] = ["fixture": "owned-alignment-color-control", "pointEditorCount": app.scrollViews.containing(.staticText, identifier: "نقاط البوصلة").count,
      "sourceColorHeadingCount": page.staticTexts.matching(NSPredicate(format: "label == %@", "ألوان الأقسام")).count, "controls": rows]
    let data = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
    try require(data.count <= 8192, "Owned color-control diagnostics must remain bounded.")
    let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
    attachment.name = "owned-alignment-color-control-counts"; attachment.lifetime = .keepAlways
    add(attachment)
  }

  @MainActor
  private func alignmentPage(_ app: XCUIApplication) throws -> XCUIElement {
    try unique(app.scrollViews.containing(.staticText, identifier: "مولد البوصلة السياسية المخصص"))
  }
  @MainActor
  private func pointsPage(_ app: XCUIApplication) throws -> XCUIElement {
    try require(wait { app.scrollViews.containing(.staticText, identifier: "نقاط البوصلة").count == 1 }, "The actual point editor must have one scroll owner.")
    return try unique(app.scrollViews.containing(.staticText, identifier: "نقاط البوصلة"))
  }
  @MainActor
  private func drawing(_ count: Int, app: XCUIApplication) throws -> XCUIElement {
    try unique(app.images.matching(NSPredicate(format: "label == %@", "بوصلة مخصصة، \(count) نقطة. تتوفر أدوات بديلة لإضافة النقاط وتعديل مواضعها في القائمة.")))
  }
  @MainActor
  private func requireDrawing(_ element: XCUIElement, in owner: XCUIElement, app: XCUIApplication) throws {
    try require(element.isEnabled && element.isHittable && finiteContained(element.frame, in: owner.frame.intersection(app.frame))
      && abs(element.frame.width - element.frame.height) < 2, "Only the fully exposed square canvas may receive the real drawing gesture.")
  }

  @MainActor
  private func saved(_ app: XCUIApplication) throws {
    try require(wait(10) { app.staticTexts.matching(NSPredicate(format: "label == %@", "الرسم محفوظ محلياً")).firstMatch.exists }, "The real writer must acknowledge saved state before every fixture observation.")
  }
  @MainActor
  private func press(_ title: String, owner: XCUIElement, app: XCUIApplication) throws {
    let button = try unique(owner.buttons.matching(NSPredicate(format: "label == %@", title)))
    try expose(button, in: owner, app: app)
    try require(button.isEnabled && button.isHittable, "The exact owned control must be enabled and hittable.")
    button.tap()
  }
  @MainActor
  private func expose(_ target: XCUIElement, in owner: XCUIElement, app: XCUIApplication) throws {
    try require(owner.exists, "The exact page or modal scroll owner is required.")
    for _ in 0..<12 {
      let viewport = owner.frame.intersection(app.frame), frame = target.frame
      try require(finiteContained(viewport, in: app.frame) && [frame.minX, frame.minY, frame.width, frame.height].allSatisfy(\.isFinite)
        && frame.width > 0 && frame.height > 0, "Unknown or empty geometry refuses a scroll gesture.")
      let keyboard = app.keyboards.firstMatch
      let bottom = keyboard.exists ? min(viewport.maxY, keyboard.frame.minY) : viewport.maxY
      let visible = CGRect(x: viewport.minX, y: viewport.minY, width: viewport.width, height: bottom - viewport.minY).insetBy(dx: 0, dy: 4)
      if visible.contains(frame) {
        try require(wait(5) { target.exists && target.isHittable }, "The fully visible owned control must become hittable.")
        return
      }
      try require(visible.height > 80 && frame.width <= viewport.width && frame.height <= visible.height,
        "The target must fit in the explicit native scroll viewport.")
      let x = viewport.maxX - 8, upper = visible.minY + visible.height * 0.22, lower = visible.minY + visible.height * 0.78
      let up = frame.maxY > visible.maxY
      let start = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: x - app.frame.minX, dy: (up ? lower : upper) - app.frame.minY))
      let end = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: x - app.frame.minX, dy: (up ? upper : lower) - app.frame.minY))
      start.press(forDuration: 0.05, thenDragTo: end)
    }
    throw failure("The exact owned control remains outside its scroll viewport after twelve bounded gestures.")
  }

  private func finiteContained(_ frame: CGRect, in viewport: CGRect) -> Bool {
    [frame, viewport].allSatisfy { [$0.minX, $0.minY, $0.width, $0.height].allSatisfy(\.isFinite) && $0.width > 0 && $0.height > 0 } && viewport.contains(frame)
  }
  @MainActor
  private func keyboardClosed(_ app: XCUIApplication) throws { try require(wait { app.keyboards.count == 0 }, "The normal Return action must close the keyboard before saving coordinates.") }
  @MainActor
  private func unique(_ query: XCUIElementQuery) throws -> XCUIElement {
    try require(query.count == 1 && query.firstMatch.exists, "The source-derived control must have one actual native match. Unknown roles or scopes refuse actions.")
    return query.firstMatch
  }
  @MainActor
  private func wait(_ timeout: TimeInterval = 5, _ condition: @escaping () -> Bool) -> Bool {
    XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in condition() }, object: nil)], timeout: timeout) == .completed
  }
  private func require(_ condition: Bool, _ message: String) throws { if !condition { throw failure(message) } }
  private func failure(_ message: String) -> NSError { NSError(domain: "NativeAlignmentFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
}
