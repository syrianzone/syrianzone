import Foundation
import XCTest

// Local drawings only. This case never activates save, submit or moderation.
final class NativeTransitStudioUITests: LocalFixtureTestCase {
  @MainActor
  func testTwoSegmentsStopsUndoAndSameProcessDraftReopen() async throws {
    let nonce = UUID().uuidString.lowercased()
    let environment = ProcessInfo.processInfo.environment
    guard environment["SZ_NATIVE_FIXTURE_PRESERVE_STUDIO_PENDING"] == "1" else { throw studioFailure("The explicit Studio-only runner preservation flag is required before fixture launch.") }
    let city = try await StudioCityReadOnly(environment: environment).requireDamascus()
    let gate = try XCTUnwrap(environment["SZ_NATIVE_FIXTURE_GATE"])
    var launchURL = URLComponents()
    launchURL.scheme = "syrianzone"; launchURL.host = "fixture"; launchURL.path = "/session"
    launchURL.queryItems = [URLQueryItem(name: "user", value: "member"), URLQueryItem(name: "variant", value: "transit-studio")]
    launchURL.fragment = gate
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    defer { app.terminate() }
    app.terminate(); app.open(try XCTUnwrap(launchURL.url))
    dismissOwnPrompt(); assertLocal(app, user: "member", id: 101)
    XCTAssertTrue(app.buttons["إعدادات الرئيسية"].waitForExistence(timeout: 20))
    let status = app.staticTexts["account.fixture.status"]
    guard let data = (status.value as? String)?.data(using: .utf8),
      let proof = try JSONSerialization.jsonObject(with: data) as? [String: Any],
      let studio = proof["studioPreflight"] as? [String: String], studio == ["pending": "absent"] else {
      throw studioFailure("The closed member variant must prove an absent pending document before importing the real app.")
    }
    try armNativeInputTrace("studio-stop", nonce: nonce, app: app)
    open("transit_studio?city=damascus", app: app)
    XCTAssertTrue(app.staticTexts["ترانزيت ستوديو"].firstMatch.waitForExistence(timeout: 15))
    try expectSummary(points: 0, segments: 0, stops: 0, app: app)
    let cityPicker = app.buttons["المدينة"].firstMatch
    XCTAssertTrue(cityPicker.waitForExistence(timeout: 10)); XCTAssertEqual(cityPicker.value as? String, city.name)
    let routeName = "مسار تحقق \(nonce)"
    let routeField = app.textFields["اسم المسار بالعربية"].firstMatch
    XCTAssertTrue(routeField.waitForExistence(timeout: 10)); XCTAssertEqual(routeField.value as? String, "")
    replace(routeField, with: routeName)
    XCTAssertEqual(routeField.value as? String, routeName, "The actual typed task name must be intact before drawing or resetting anything.")
    routeField.typeText("\n")
    try requireKeyboardClosed(app)

    tap("رسم أو إكمال المسار", app: app)
    try selectMap(x: 0.25, y: 0.35, app: app)
    try expectSummary(points: 1, segments: 1, stops: 0, app: app)
    try selectMap(x: 0.62, y: 0.35, app: app)
    try expectSummary(points: 2, segments: 1, stops: 0, app: app)
    try selectMap(x: 0.62, y: 0.55, app: app)
    try expectSummary(points: 3, segments: 1, stops: 0, app: app)
    tap("تراجع عن تعديل الرسم", app: app)
    try expectSummary(points: 2, segments: 1, stops: 0, app: app)

    tap("إضافة جزء منفصل", app: app)
    try expectSummary(points: 2, segments: 2, stops: 0, app: app)
    try selectMap(x: 0.25, y: 0.68, app: app)
    try expectSummary(points: 3, segments: 2, stops: 0, app: app)
    try selectMap(x: 0.62, y: 0.68, app: app)
    try expectSummary(points: 4, segments: 2, stops: 0, app: app)
    tap("إنهاء الرسم", app: app)
    let vertices = try readVertices(app: app, city: city)
    XCTAssertEqual(vertices.count, 4)
    XCTAssertGreaterThan(try distance(vertices, "1.1", "1.2"), 0.00001)
    XCTAssertGreaterThan(try distance(vertices, "2.1", "2.2"), 0.00001)
    XCTAssertGreaterThan(try distance(vertices, "1.1", "2.1"), 0.00001, "The disconnected part must contain independently selected geometry.")

    let stopNames = ["موقف \(nonce) 1", "موقف \(nonce) 2"]
    for index in 0..<2 {
      tap("إضافة موقف على الخريطة", app: app)
      try selectMap(x: 0.43, y: index == 0 ? 0.35 : 0.68, app: app)
      let name = app.textFields["اسم الموقف"].firstMatch
      XCTAssertTrue(name.waitForExistence(timeout: 10))
      replace(name, with: stopNames[index])
      let observedBeforeRead = nativeInputTraceEnabled ? name.value as? String : nil
      if nativeInputTraceEnabled {
        if observedBeforeRead != stopNames[index] {
          try closeRejectedStopPanel(name, expected: stopNames[index], observedBeforeRead: observedBeforeRead, app: app)
          try attachNativeInputTrace("studio-stop", nonce: nonce, expected: stopNames[index], observedBeforeRead: observedBeforeRead, app: app)
        }
        XCTAssertEqual(observedBeforeRead, stopNames[index])
      } else { XCTAssertEqual(name.value as? String, stopNames[index]) }
      name.typeText("\n"); try requireKeyboardClosed(app)
      tap("حفظ اسم الموقف", app: app); tap("تم", app: app)
      if nativeInputTraceEnabled {
        try waitForStopTraceHeader(app)
        try attachNativeInputTrace("studio-stop", nonce: nonce, expected: stopNames[index], observedBeforeRead: observedBeforeRead, app: app)
      }
      try expectSummary(points: 4, segments: 2, stops: index + 1, app: app)
    }
    tap("إنهاء الرسم", app: app)
    let stops = try readStops(names: stopNames, app: app, city: city)
    for index in 0..<2 {
      let point = try XCTUnwrap(stops[stopNames[index]]), segment = index + 1
      XCTAssertLessThan(try projectionDistance(point, vertices, "\(segment).1", "\(segment).2"), 0.00004, "Each actual stop must align with its intended independently selected part.")
    }
    XCTAssertGreaterThan(try distance(stops, stopNames[0], stopNames[1]), 0.00001, "Two named stops must have distinct real coordinates.")
    attach(app, note: "Own drawing \(nonce): four actual native-map vertices, two disconnected parts, two named snapped stops and the undo transition were observed. No server write action was activated.")

    open("home", app: app)
    XCTAssertTrue(app.buttons["إعدادات الرئيسية"].waitForExistence(timeout: 15))
    open("transit_studio?city=damascus", app: app)
    try expectSummary(points: 4, segments: 2, stops: 2, app: app)
    XCTAssertEqual(app.textFields["اسم المسار بالعربية"].firstMatch.value as? String, routeName)
    XCTAssertEqual(try readVertices(app: app, city: city), vertices)
    XCTAssertEqual(try readStops(names: stopNames, app: app, city: city), stops)
    // Only this fresh-process UUID drawing may reach the source reset confirmation.
    XCTAssertEqual(app.textFields["اسم المسار بالعربية"].firstMatch.value as? String, routeName)
    tap("بدء رسم جديد", app: app)
    let confirmation = app.alerts["بدء رسم جديد؟"]
    XCTAssertTrue(confirmation.waitForExistence(timeout: 5))
    XCTAssertTrue(confirmation.buttons["إلغاء"].exists)
    confirmation.buttons["رسم جديد"].tap()
    try expectSummary(points: 0, segments: 0, stops: 0, app: app)
    XCTAssertEqual(app.textFields["اسم المسار بالعربية"].firstMatch.value as? String, "")
    open("home", app: app); open("transit_studio?city=damascus", app: app)
    try expectSummary(points: 0, segments: 0, stops: 0, app: app)
    XCTAssertEqual(app.textFields["اسم المسار بالعربية"].firstMatch.value as? String, "")
    assertLocal(app, user: "member", id: 101)
    let after = try await StudioCityReadOnly(environment: environment).requireDamascus()
    XCTAssertEqual(after, city, "The source city name and bounds must remain unchanged.")
    attach(app, note: "The same-process reopen retained exact row coordinates and names. Visible source Reset cleared only the UUID drawing, and a second same-process reopen stayed empty. No cold-persistence, pending-login or submission claim.")
  }

  @MainActor
  private func closeRejectedStopPanel(_ name: XCUIElement, expected: String, observedBeforeRead: String?, app: XCUIApplication) throws {
    let names = app.textFields.matching(identifier: "اسم الموقف")
    let owners = app.scrollViews.containing(.textField, identifier: "اسم الموقف")
    func bounded(_ value: String) -> Bool {
      guard value.count <= 96 else { return false }
      var index = value.startIndex
      for character in expected where index < value.endIndex {
        if character == value[index] { index = value.index(after: index) }
      }
      return index == value.endIndex
    }
    guard nativeInputTraceEnabled, names.count == 1, owners.count == 1, let observedBeforeRead,
      observedBeforeRead != expected, bounded(observedBeforeRead), name.value as? String == observedBeforeRead else {
      throw studioFailure("A rejected synthetic name must still belong to the unique current Stop panel before diagnostic dismissal.")
    }
    // Finish only this edit. The saved immediate value remains the failing assertion's source.
    name.typeText("\n"); try requireKeyboardClosed(app)
    guard names.count == 1, owners.count == 1, let afterReturn = names.firstMatch.value as? String, bounded(afterReturn) else {
      throw studioFailure("The same bounded synthetic Stop editor must remain after normal Return.")
    }
    let owner = owners.firstMatch, field = names.firstMatch
    let closes = owner.buttons.matching(NSPredicate(format: "identifier == %@ OR label == %@", "تم", "تم"))
    guard owner.textFields.matching(identifier: "إحداثيات الموقف").count == 1, closes.count == 1 else {
      throw studioFailure("Only the unique Done action in the actual Stop-name and coordinate ScrollView may dismiss this diagnostic panel.")
    }
    let close = closes.firstMatch, viewport = owner.frame.intersection(app.frame), closeFrame = close.frame, fieldFrame = field.frame
    guard [viewport.minX, viewport.minY, viewport.width, viewport.height, closeFrame.minX, closeFrame.minY, closeFrame.width, closeFrame.height,
      fieldFrame.minX, fieldFrame.minY, fieldFrame.width, fieldFrame.height].allSatisfy({ $0.isFinite }),
      !viewport.isNull, !viewport.isEmpty, !closeFrame.isEmpty, !fieldFrame.isEmpty,
      viewport.contains(closeFrame), viewport.contains(fieldFrame), close.isEnabled, close.isHittable, field.isEnabled, field.isHittable else {
      throw studioFailure("The owned Stop editor and its one Done button must be completely visible before the single diagnostic dismissal.")
    }
    // Source Done only closes this panel. Do not activate Save Name or any geometry/server action.
    close.tap()
    try waitForStopTraceHeader(app)
  }

  @MainActor
  private func waitForStopTraceHeader(_ app: XCUIApplication) throws {
    let returned = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      let header = app.textFields["account.fixture.destination"]
      return app.textFields.matching(identifier: "اسم الموقف").count == 0
        && app.scrollViews.containing(.textField, identifier: "اسم الموقف").count == 0
        && header.exists && header.isEnabled && header.isHittable
    }, object: app)
    guard XCTWaiter.wait(for: [returned], timeout: 5) == .completed else {
      throw studioFailure("The own Stop panel must finish closing before reading the unchanged fixture header.")
    }
  }

  @MainActor
  private func revealStudioMap(_ map: XCUIElement, app: XCUIApplication) throws -> XCUIElement {
    // The compact Studio ScrollView contains both the real Map and route editor.
    // MapKit internals cannot qualify merely because the Map has an empty label.
    let owners = app.scrollViews
      .containing(NSPredicate(format: "elementType == %lu", XCUIElement.ElementType.map.rawValue))
      .containing(.textField, identifier: "اسم المسار بالعربية")
    var observations: [[String: Any]] = []
    func rectangle(_ frame: CGRect) -> [String: Double] {
      guard [frame.minX, frame.minY, frame.width, frame.height].allSatisfy({ $0.isFinite }) else { return [:] }
      return ["x": Double(frame.minX), "y": Double(frame.minY), "width": Double(frame.width), "height": Double(frame.height)]
    }
    func refused(_ message: String) -> NSError {
      let value: [String: Any] = ["attempts": observations, "map": rectangle(map.frame), "ownerCount": owners.count,
        "limits": "Scoped map/editor ancestor geometry only. No AX, field value, coordinate injection or map tap occurred in this helper."]
      if let data = try? JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys]) {
        let note = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        note.name = "studio-map-owner-reveal-refusal"; note.lifetime = .keepAlways; add(note)
      }
      return studioFailure(message)
    }
    for attempt in 0...12 {
      dismissPopup(app)
      guard owners.count == 1 else { throw refused("Studio requires one live ScrollView ancestor containing the Map role and the known route-name field.") }
      let owner = owners.firstMatch
      var viewport = owner.frame.intersection(app.frame).insetBy(dx: 0, dy: 8)
      let keyboard = app.keyboards.firstMatch
      if keyboard.exists && keyboard.frame.minY > viewport.minY { viewport.size.height = min(viewport.maxY, keyboard.frame.minY) - viewport.minY }
      let target = map.frame
      observations.append(["attempt": attempt, "owner": rectangle(owner.frame), "viewport": rectangle(viewport), "map": rectangle(target), "hittable": map.isHittable])
      guard [viewport.minX, viewport.minY, viewport.width, viewport.height, target.minX, target.minY, target.width, target.height].allSatisfy({ $0.isFinite })
        && !viewport.isNull && !viewport.isEmpty && target.width > 0 && target.height > 0 else {
        throw refused("The validated Studio map and scroll viewport must have finite positive visible geometry before gestures.")
      }
      if map.isHittable && viewport.contains(target) { return owner }
      if attempt == 12 { break }
      let origin = app.coordinate(withNormalizedOffset: .zero)
      let gutter = min(CGFloat(8), viewport.width * 0.1)
      let top = origin.withOffset(CGVector(dx: viewport.maxX - gutter, dy: viewport.minY + viewport.height * 0.25))
      let bottom = origin.withOffset(CGVector(dx: viewport.maxX - gutter, dy: viewport.minY + viewport.height * 0.75))
      if target.minY < viewport.minY { top.press(forDuration: 0.05, thenDragTo: bottom) }
      else if target.maxY > viewport.maxY { bottom.press(forDuration: 0.05, thenDragTo: top) }
      else { break }
    }
    throw refused("The complete native Studio Map must be exposed and hittable before any location tap.")
  }

  @MainActor
  private func selectMap(x: CGFloat, y: CGFloat, app: XCUIApplication) throws {
    let maps = app.maps
    XCTAssertTrue(maps.firstMatch.waitForExistence(timeout: 10)); XCTAssertEqual(maps.count, 1)
    let map = maps.firstMatch
    let owner = try revealStudioMap(map, app: app)
    let viewport = owner.frame.intersection(app.frame)
    guard map.isHittable, map.frame.width > 200, map.frame.height > 200, viewport.contains(map.frame) else {
      attach(app, note: "Map \(map.frame), viewport \(viewport), hittable \(map.isHittable)."); throw studioFailure("The complete native map must be visible before selecting a location.")
    }
    // Screen positions are real MapKit taps. No screen-to-geography conversion or state injection occurs.
    map.coordinate(withNormalizedOffset: CGVector(dx: x, dy: y)).tap()
  }

  @MainActor
  private func expectSummary(points: Int, segments: Int, stops: Int, app: XCUIApplication) throws {
    let expected = "\(points) نقطة · \(segments) جزء · \(stops) موقف"
    guard app.staticTexts[expected].firstMatch.waitForExistence(timeout: 10) else {
      attach(app, note: "Missing actual drawing summary: \(expected)"); throw studioFailure("The native map action did not produce its required geometry transition.")
    }
  }

  @MainActor
  private func readVertices(app: XCUIApplication, city: StudioCity) throws -> [String: StudioPoint] {
    tap("قائمة نقاط المسار", app: app)
    XCTAssertTrue(app.staticTexts["نقاط المسار"].firstMatch.waitForExistence(timeout: 10))
    var result: [String: StudioPoint] = [:]
    let owner = try panelOwner(app)
    let rows = owner.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "الجزء "))
    XCTAssertEqual(rows.count, 4)
    for segment in 1...2 { for vertex in 1...2 {
      let prefix = "الجزء \(segment)، النقطة \(vertex)، "
      let matches = rows.matching(NSPredicate(format: "label BEGINSWITH %@", prefix))
      XCTAssertEqual(matches.count, 1)
      let point = try pointFromLabel(matches.firstMatch.label, prefix: prefix, city: city)
      result["\(segment).\(vertex)"] = point
    } }
    tap("تم", app: app)
    return result
  }

  @MainActor
  private func readStops(names: [String], app: XCUIApplication, city: StudioCity) throws -> [String: StudioPoint] {
    tap("قائمة المواقف (2)", app: app)
    let owner = try panelOwner(app)
    var result: [String: StudioPoint] = [:]
    for name in names {
      let prefix = name + "، "
      let matches = owner.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", prefix))
      XCTAssertTrue(matches.firstMatch.waitForExistence(timeout: 10)); XCTAssertEqual(matches.count, 1)
      result[name] = try pointFromLabel(matches.firstMatch.label, prefix: prefix, city: city)
    }
    tap("تم", app: app)
    return result
  }

  @MainActor
  private func panelOwner(_ app: XCUIApplication) throws -> XCUIElement {
    let done = app.buttons["تم"].firstMatch
    XCTAssertTrue(done.waitForExistence(timeout: 10))
    let owners = app.scrollViews.containing(.button, identifier: "تم")
    guard owners.count == 1 else { attach(app, note: "Unknown native list sheet; expected one scroll owner with its Done control."); throw studioFailure("The actual sheet list must be scoped before reading coordinate rows.") }
    return owners.firstMatch
  }

  private func pointFromLabel(_ label: String, prefix: String, city: StudioCity) throws -> StudioPoint {
    guard label.hasPrefix(prefix) else { throw studioFailure("A source coordinate row was missing its exact title.") }
    let values = label.dropFirst(prefix.count).split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
    guard values.count == 2, let latitude = Double(values[0]), let longitude = Double(values[1]),
      latitude.isFinite, longitude.isFinite, (city.south...city.north).contains(latitude), (city.west...city.east).contains(longitude) else {
      throw studioFailure("Actual list geometry must contain finite coordinates inside the selected source city.")
    }
    return StudioPoint(latitude: latitude, longitude: longitude)
  }
  private func distance(_ points: [String: StudioPoint], _ a: String, _ b: String) throws -> Double {
    let first = try XCTUnwrap(points[a]), second = try XCTUnwrap(points[b])
    return hypot(first.latitude - second.latitude, first.longitude - second.longitude)
  }
  private func projectionDistance(_ point: StudioPoint, _ points: [String: StudioPoint], _ first: String, _ second: String) throws -> Double {
    let a = try XCTUnwrap(points[first]), b = try XCTUnwrap(points[second])
    let dx = b.longitude - a.longitude, dy = b.latitude - a.latitude, squared = dx * dx + dy * dy
    guard squared > 0 else { throw studioFailure("A zero-length segment cannot establish stop alignment.") }
    let t = max(0, min(1, ((point.longitude - a.longitude) * dx + (point.latitude - a.latitude) * dy) / squared))
    return hypot(point.latitude - (a.latitude + t * dy), point.longitude - (a.longitude + t * dx))
  }
  @MainActor
  private func requireKeyboardClosed(_ app: XCUIApplication) throws {
    let closed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: app.keyboards.firstMatch)
    guard XCTWaiter.wait(for: [closed], timeout: 5) == .completed else { throw studioFailure("Normal Return must finish dismissing the field keyboard.") }
  }
  @MainActor
  private func attach(_ app: XCUIApplication, note: String) {
    let metadata = XCTAttachment(string: note); metadata.name = "studio-owned-drawing"; metadata.lifetime = .keepAlways; add(metadata)
    let tree = XCTAttachment(string: app.debugDescription); tree.name = "studio-owned-AX"; tree.lifetime = .keepAlways; add(tree)
    let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "studio-owned-screen"; shot.lifetime = .keepAlways; add(shot)
  }
}

private struct StudioPoint: Equatable { let latitude: Double; let longitude: Double }
private struct StudioCity: Equatable { let name: String; let south: Double; let north: Double; let west: Double; let east: Double }
private func studioFailure(_ message: String) -> NSError { NSError(domain: "NativeTransitStudioFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }

private final class StudioCityReadOnly: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  private let session: URLSession
  init(environment: [String: String]) throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == "zone.syrian.ios.uitests.xctrunner",
      let device = environment["SIMULATOR_UDID"], UUID(uuidString: device) != nil,
      environment["SZ_NATIVE_FIXTURE_ORIGIN"] == "https://127.0.0.1:9443",
      let gate = environment["SZ_NATIVE_FIXTURE_GATE"], gate.range(of: "^[A-Za-z0-9_-]{16,256}$", options: .regularExpression) != nil else {
      throw studioFailure("Only the exact gated local Simulator runner may read Studio fixture prerequisites.")
    }
    #else
    throw studioFailure("Studio fixtures refuse physical devices.")
    #endif
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieStorage = nil; configuration.httpShouldSetCookies = false
    configuration.urlCredentialStorage = nil; configuration.urlCache = nil
    configuration.timeoutIntervalForRequest = 15; configuration.timeoutIntervalForResource = 20
    session = URLSession(configuration: configuration, delegate: StudioNoRedirect(), delegateQueue: nil)
    super.init()
  }
  func requireDamascus() async throws -> StudioCity {
    defer { session.invalidateAndCancel() }
    let url = try XCTUnwrap(URL(string: "https://127.0.0.1:9443/api/v1/transit/cities"))
    var request = URLRequest(url: url); request.httpMethod = "GET"
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    let (data, response) = try await session.data(for: request)
    guard let http = response as? HTTPURLResponse, http.statusCode == 200, http.url == url, data.count < 1_000_000,
      let rows = try JSONSerialization.jsonObject(with: data) as? [[String: Any]],
      rows.filter({ $0["id"] as? String == "damascus" }).count == 1,
      let city = rows.first(where: { $0["id"] as? String == "damascus" }), city["status"] as? String == "active",
      city["nameAr"] as? String == "دمشق", let bounds = city["bounds"] as? [[Double]], bounds.count == 2,
      bounds.allSatisfy({ $0.count == 2 && $0.allSatisfy(\.isFinite) }),
      bounds[0][0] < bounds[1][0], bounds[0][1] < bounds[1][1] else {
      throw studioFailure("The actual source cities endpoint must expose the approved active Damascus row and valid bounds.")
    }
    return StudioCity(name: "دمشق", south: bounds[0][1], north: bounds[1][1], west: bounds[0][0], east: bounds[1][0])
  }
}
private final class StudioNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping @Sendable (URLRequest?) -> Void) { completionHandler(nil) }
}
