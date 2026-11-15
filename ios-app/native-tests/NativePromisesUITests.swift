import XCTest

// Requires the private account fixture and its approved synthetic speaker baseline.
final class NativePromisesUITests: LocalFixtureTestCase {
  @MainActor
  func testLocalSuggestionValidationAndSourceRowsPreserveDraftWithoutSubmitting() async throws {
    let backend = try PromisesFixture(environment: ProcessInfo.processInfo.environment)
    addTeardownBlock { try await backend.cleanupAndClose() }
    try await backend.prepare(requireSpeaker: false)
    let app = try launch("member", id: 101)
    defer { app.terminate() }
    open("promises?view=suggest", app: app)
    XCTAssertTrue(app.textFields["عنوان مختصر للوعد"].waitForExistence(timeout: 15))
    assertLocal(app, user: "member", id: 101)
    tap("إرسال الاقتراح للمراجعة", app: app)
    for message in ["اختر المسؤول أو اكتب اسمه", "اكتب عنواناً مختصراً للوعد", "اكتب نص الوعد كما قاله المسؤول", "أضف من مصدر واحد إلى خمسة مصادر"] {
      XCTAssertTrue(app.staticTexts[message].firstMatch.waitForExistence(timeout: 10), message)
    }
    let title = app.textFields["عنوان مختصر للوعد"].firstMatch
    replace(title, with: backend.title)
    XCTAssertEqual(title.value as? String, backend.title)
    finishSearch(title, app: app)
    replace(app.textViews["نص الوعد كما قاله المسؤول"].firstMatch, with: backend.quote)
    replace(app.textFields["رابط المصدر 1"].firstMatch, with: backend.source)
    tap("إضافة رابط مصدر", app: app)
    let second = app.textFields["رابط المصدر 2"].firstMatch
    XCTAssertTrue(second.waitForExistence(timeout: 5))
    replace(second, with: "https://example.invalid/native-promises/\(backend.identifier)/second")
    tap("حذف رابط المصدر 2", app: app)
    XCTAssertFalse(second.exists)
    XCTAssertEqual(title.value as? String, backend.title)
    XCTAssertEqual(app.textViews["نص الوعد كما قاله المسؤول"].firstMatch.value as? String, backend.quote)
    XCTAssertEqual(app.textFields["رابط المصدر 1"].firstMatch.value as? String, backend.source)
    XCTAssertFalse(app.staticTexts["وصل اقتراحك"].exists)
    try await backend.assertBaselineUnchanged()
    try await backend.assertNoPromiseCreated()
    capture("promises-local-invalid-suggestion-draft-and-source-removal", app: app)
    // No valid submission: this case creates no pending promise or proposed speaker.
  }

  @MainActor
  func testOwnNativePromiseCreateEditPublishPublicFiltersAndChangedVote() async throws {
    let backend = try PromisesFixture(environment: ProcessInfo.processInfo.environment)
    addTeardownBlock { try await backend.cleanupAndClose() }
    try await backend.prepare(requireSpeaker: true)
    var app = try launch("admin", id: 103)
    open("promises?view=admin", app: app)
    assertLocal(app, user: "admin", id: 103)
    tap("إضافة وعد", app: app)
    XCTAssertTrue(app.textFields["عنوان مختصر"].firstMatch.waitForExistence(timeout: 15))
    replace(app.textFields["عنوان مختصر"].firstMatch, with: backend.title)
    XCTAssertEqual(app.textFields["عنوان مختصر"].firstMatch.value as? String, backend.title)
    replace(app.textViews["نص الاقتباس الأصلي"].firstMatch, with: backend.quote)
    XCTAssertEqual(app.textViews["نص الاقتباس الأصلي"].firstMatch.value as? String, backend.quote)
    tap("اختيار المسؤول الأساسي", app: app)
    let speakerSearch = app.textFields["بحث في المسؤولين والأدلة"].firstMatch
    XCTAssertTrue(speakerSearch.waitForExistence(timeout: 10))
    replace(speakerSearch, with: PromisesFixture.speakerName)
    XCTAssertEqual(speakerSearch.value as? String, PromisesFixture.speakerName, "The full Arabic search must reach the controlled input unchanged")
    finishSearch(speakerSearch, app: app)
    let speaker = app.buttons.matching(NSPredicate(format: "label == %@", "\(PromisesFixture.speakerName)، \(PromisesFixture.speakerTitle)")).firstMatch
    XCTAssertTrue(speaker.waitForExistence(timeout: 15), "Exact approved synthetic speaker, not a source person materialized by selection")
    reveal(speaker, app: app)
    speaker.tap()
    XCTAssertFalse(app.buttons["إغلاق اختيار المسؤول"].exists)
    tap("اختيار تاريخ التصريح", app: app)
    replace(app.textFields["المصدر 1: الرابط"].firstMatch, with: backend.source)
    XCTAssertEqual(app.textFields["المصدر 1: الرابط"].firstMatch.value as? String, backend.source)
    assertLocal(app, user: "admin", id: 103)
    tap("إضافة الوعد بانتظار النشر", app: app)
    XCTAssertTrue(app.staticTexts["وعد غير منشور"].firstMatch.waitForExistence(timeout: 20))
    let created = try await backend.confirmCreated()
    XCTAssertNil(created.number)

    replace(app.textFields["عنوان مختصر"].firstMatch, with: backend.editedTitle)
    XCTAssertEqual(app.textFields["عنوان مختصر"].firstMatch.value as? String, backend.editedTitle)
    assertLocal(app, user: "admin", id: 103)
    tap("حفظ التعديلات", app: app)
    let saved = try await backend.waitForOwned(title: backend.editedTitle, review: "pending", expectedVersion: created.version + 1)
    XCTAssertGreaterThan(saved.version, created.version)
    assertLocal(app, user: "admin", id: 103)
    tap("نشر الوعد", app: app)
    XCTAssertTrue(app.buttons["عرض الصفحة العامة للوعد"].firstMatch.waitForExistence(timeout: 20))
    let published = try await backend.waitForOwned(title: backend.editedTitle, review: "published", expectedVersion: saved.version)
    let number = try XCTUnwrap(published.number)
    XCTAssertGreaterThan(number, 0)
    try await backend.assertVotes(number: number, yes: 0, no: 0)

    app = try launch("member", id: 101)
    open("promises", app: app)
    let query = app.textFields["ابحث في عنوان الوعد أو اسم المسؤول"].firstMatch
    XCTAssertTrue(query.waitForExistence(timeout: 15))
    replace(query, with: backend.identifier + "-absent")
    finishSearch(query, app: app)
    XCTAssertTrue(app.staticTexts["0 وعداً مطابقاً"].firstMatch.waitForExistence(timeout: 10))
    XCTAssertTrue(app.staticTexts["لا توجد وعود تطابق هذه التصفية"].firstMatch.exists)
    replace(query, with: backend.identifier)
    finishSearch(query, app: app)
    XCTAssertTrue(app.staticTexts["1 وعداً مطابقاً"].firstMatch.waitForExistence(timeout: 10))
    tap("ترتيب الوعود", app: app)
    tap("الأحدث تصريحاً", app: app)
    let sort = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", "الأحدث تصريحاً"), object: app.buttons["ترتيب الوعود"].firstMatch)
    XCTAssertEqual(XCTWaiter.wait(for: [sort], timeout: 5), .completed, "Native Picker must adopt its selected value")
    tap("بطاقات", app: app)
    let grid = app.buttons["بطاقات"].firstMatch
    let selectedGrid = XCTNSPredicateExpectation(predicate: NSPredicate(format: "selected == true"), object: grid)
    XCTAssertEqual(XCTWaiter.wait(for: [selectedGrid], timeout: 5), .completed, "Establish a different layout before checking the persisted list preference")
    tap("قائمة", app: app)
    let selected = XCTNSPredicateExpectation(predicate: NSPredicate(format: "selected == true"), object: app.buttons["قائمة"].firstMatch)
    XCTAssertEqual(XCTWaiter.wait(for: [selected], timeout: 5), .completed, "Native segmented control must select list layout")
    XCTAssertFalse(grid.isSelected)
    let row = app.buttons[backend.editedTitle].firstMatch
    XCTAssertTrue(row.waitForExistence(timeout: 10))
    reveal(row, app: app)
    row.tap()
    XCTAssertTrue(app.staticTexts["«\(backend.quote)»"].firstMatch.waitForExistence(timeout: 15))
    XCTAssertTrue(app.staticTexts[backend.editedTitle].firstMatch.exists)
    tap("العودة إلى قائمة الوعود", app: app)
    XCTAssertEqual(query.value as? String, backend.identifier)
    XCTAssertTrue(app.staticTexts["1 وعداً مطابقاً"].firstMatch.exists)
    tap(backend.editedTitle, app: app)
    assertLocal(app, user: "member", id: 101)
    tap("نعم، أعتقد أنه سيتحقق", app: app)
    let yes = app.buttons["✓ نعم، أعتقد أنه سيتحقق"].firstMatch
    XCTAssertTrue(yes.waitForExistence(timeout: 15))
    XCTAssertFalse(yes.isEnabled)
    try await backend.assertVotes(number: number, yes: 1, no: 0)
    assertLocal(app, user: "member", id: 101)
    tap("لا، لا أعتقد أنه سيتحقق", app: app)
    let no = app.buttons["✓ لا، لا أعتقد أنه سيتحقق"].firstMatch
    XCTAssertTrue(no.waitForExistence(timeout: 15))
    XCTAssertFalse(no.isEnabled)
    XCTAssertTrue(app.staticTexts["0 نعم، 1 لا، 0% يرجّحون تحققه"].firstMatch.exists)
    try await backend.assertVotes(number: number, yes: 0, no: 1)
    capture("promises-own-record-member-changed-vote", app: app)

    app = try launch("member", id: 101)
    open("promises?number=\(number)", app: app)
    let restored = app.buttons["✓ لا، لا أعتقد أنه سيتحقق"].firstMatch
    XCTAssertTrue(restored.waitForExistence(timeout: 15), "Origin-scoped device choice survives the real app restart")
    reveal(restored, app: app)
    XCTAssertFalse(restored.isEnabled)
    try await backend.assertVotes(number: number, yes: 0, no: 1)
    try await backend.cleanupOwnedPromise()
    try await backend.assertBaselineUnchanged()
    // Source deletion retains a soft-deleted UUID promise and its history in local SQLite.
  }

  @MainActor
  private func finishSearch(_ field: XCUIElement, app: XCUIApplication) {
    // Single-line native inputs blur on Return; no valid form is submitted here.
    field.typeText(XCUIKeyboardKey.return.rawValue)
    let closed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: app.keyboards.firstMatch)
    XCTAssertEqual(XCTWaiter.wait(for: [closed], timeout: 5), .completed)
  }

  @MainActor
  private func capture(_ name: String, app: XCUIApplication) {
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
  }
}

private func promisesFixtureFailure(_ message: String) -> NSError {
  NSError(domain: "NativePromisesFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
}
private typealias PromisesObject = [String: Any]
private struct PromiseSnapshot: Sendable { let id: String; let number: Int?; let version: Int }
private final class PromisesNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

private actor PromisesFixture {
  static let speakerID = "50000000-0000-4000-8000-000000000001"
  static let speakerName = "مسؤول الوعود التجريبي المحلي"
  static let speakerTitle = "شخصية خيالية للاختبار"
  nonisolated let identifier: String
  nonisolated let title: String
  nonisolated let editedTitle: String
  nonisolated let quote: String
  nonisolated let source: String
  private let origin = "https://127.0.0.1:9443", gate: String, session: URLSession
  private var token = "", actorName = ""
  private var inertiaVersion: String?
  private var baselineIDs = Set<String>(), baselineData: Data?, ownedID: String?, ownedNumber: Int?, ownedVersion: Int?, ownedFingerprint: Data?, recordURL: URL?
  private var cleaned = false, prepared = false

  init(environment: [String: String]) throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == "zone.syrian.ios.uitests.xctrunner", environment["SIMULATOR_UDID"] != nil,
      environment["SZ_NATIVE_FIXTURE_ORIGIN"] == "https://127.0.0.1:9443", let key = environment["SZ_NATIVE_FIXTURE_GATE"],
      key.range(of: "^[A-Za-z0-9_-]{16,256}$", options: .regularExpression) != nil else { throw promisesFixtureFailure("Only the exact private loopback Simulator runner may exercise Promises fixtures.") }
    gate = key
    let nonce = UUID().uuidString.lowercased()
    identifier = nonce; title = "وعد تحقق محلي \(nonce)"; editedTitle = "وعد تحقق محلي \(nonce) معدل"
    quote = "هذا وعد خيالي للاختبار المحلي فقط، مرجعه \(nonce)."
    source = "https://example.invalid/native-promises/\(nonce)"
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieStorage = nil; configuration.httpShouldSetCookies = false
    configuration.urlCredentialStorage = nil; configuration.urlCache = nil
    configuration.timeoutIntervalForRequest = 15; configuration.timeoutIntervalForResource = 20
    session = URLSession(configuration: configuration, delegate: PromisesNoRedirect(), delegateQueue: nil)
    #else
    throw promisesFixtureFailure("Promises fixtures refuse physical devices and other processes.")
    #endif
  }

  func prepare(requireSpeaker: Bool) async throws {
    let bootstrap = try await request("/", expected: 200, authenticated: false, bootstrap: true)
    guard let html = String(data: bootstrap, encoding: .utf8) else { throw promisesFixtureFailure("The local Home bootstrap must be UTF-8.") }
    inertiaVersion = try NativeInertiaBootstrap.version(in: html)
    let access = try await object("/__native_fixture/session?user=admin", authenticated: false, gateHeader: true)
    guard access["origin"] as? String == origin, let issued = access["token"] as? String,
      issued.range(of: #"^[0-9]+\|[A-Za-z0-9_-]{16,256}$"#, options: .regularExpression) != nil else { throw promisesFixtureFailure("The private observer session was invalid.") }
    token = issued
    let user = try await object("/api/v1/user")
    guard user["id"] as? Int == 103, user["email"] as? String == "admin@native-fixture.invalid", user["is_banned"] as? Bool == false,
      let name = user["name"] as? String, let permissions = user["effective_permissions"] as? [String],
      Set(permissions).isSuperset(of: ["promises.create", "promises.edit", "promises.review", "promises.delete"]) else { throw promisesFixtureFailure("A real, eligible synthetic administrator must be verified for observation and exact cleanup.") }
    actorName = name
    let rows = try await list()
    baselineIDs = Set(try rows.map { try uuid($0["id"]) }); baselineData = try canonical(rows)
    guard rows.allSatisfy({ $0["title"] as? String != title && $0["title"] as? String != editedTitle }) else { throw promisesFixtureFailure("The new UUID title must be absent before any native action.") }
    if requireSpeaker {
      let data = try await page("/admin/promises/speakers", component: "Admin/Promises/Speakers")
      guard let speakers = data["speakers"] as? [PromisesObject], let speaker = speakers.first(where: { $0["id"] as? String == Self.speakerID }),
        speaker["name"] as? String == Self.speakerName, speaker["title"] as? String == Self.speakerTitle,
        speaker["status"] as? String == "approved" else { throw promisesFixtureFailure("The exact approved local baseline speaker is required. Do not substitute another person or seed through the test.") }
    }
    prepared = true
    try createRecord()
  }

  func confirmCreated() async throws -> PromiseSnapshot {
    try await waitForOwned(title: title, review: "pending", expectedVersion: nil)
  }
  func waitForOwned(title expected: String, review: String, expectedVersion: Int?) async throws -> PromiseSnapshot {
    let deadline = Date().addingTimeInterval(15)
    repeat {
      if let snapshot = try await observe(expectedTitle: expected, expectedReview: review, expectedVersion: expectedVersion, adoptExpected: true) { return snapshot }
      try await Task.sleep(for: .milliseconds(200))
    } while Date() < deadline
    throw promisesFixtureFailure("The actual native write did not reach its exact title, publication state and newer version.")
  }
  private func observe(expectedTitle: String? = nil, expectedReview: String? = nil, expectedVersion: Int? = nil, adoptExpected: Bool = false) async throws -> PromiseSnapshot? {
    let matches = try await list().filter { [title, editedTitle].contains($0["title"] as? String ?? "") }
    guard matches.count <= 1 else { throw promisesFixtureFailure("Ambiguous UUID rows are retained without mutation.") }
    guard let row = matches.first else { return nil }
    let id = try uuid(row["id"])
    guard !baselineIDs.contains(id), ownedID == nil || ownedID == id else { throw promisesFixtureFailure("Only the single new UUID-owned promise may be observed or cleaned.") }
    let detail = try await page("/admin/promises/\(id)/edit", component: "Admin/Promises/Edit")
    guard let promise = detail["promise"] as? PromisesObject, try uuid(promise["id"]) == id,
      [title, editedTitle].contains(promise["title"] as? String ?? ""), promise["quote"] as? String == quote,
      promise["origin"] as? String == "editor", promise["submitterName"] as? String == actorName,
      let speaker = promise["speaker"] as? PromisesObject, speaker["ref"] as? String == "speaker:\(Self.speakerID)",
      let sources = promise["sources"] as? [PromisesObject], sources.count == 1, sources[0]["url"] as? String == source,
      let version = promise["version"] as? Int, version > 0 else { throw promisesFixtureFailure("The exact synthetic title, quote, source, author and baseline speaker must all match before recording a cleanup ID.") }
    let number = promise["number"] as? Int
    if let number, number <= 0 { throw promisesFixtureFailure("The public promise number must be positive.") }
    if let expectedTitle, promise["title"] as? String != expectedTitle { return nil }
    if let expectedReview, promise["reviewStatus"] as? String != expectedReview { return nil }
    if let expectedVersion, version != expectedVersion {
      guard version < expectedVersion else { throw promisesFixtureFailure("An unexpected newer edit must be retained, not adopted as this test's native write.") }
      return nil
    }
    let fingerprint = try canonical([promise])
    if !adoptExpected, let knownVersion = ownedVersion, let knownFingerprint = ownedFingerprint {
      guard version == knownVersion, fingerprint == knownFingerprint else { throw promisesFixtureFailure("The owned promise changed after its confirmed native write. Refusing to overwrite the recorded version or delete unexpected edits.") }
    } else {
      // First recovery after a create may discover its exact UUID before an acknowledgement.
      ownedID = id; ownedNumber = number; ownedVersion = version; ownedFingerprint = fingerprint
      try persistRecord()
    }
    return .init(id: id, number: number, version: version)
  }
  func assertVotes(number: Int, yes: Int, no: Int) async throws {
    guard number == ownedNumber, ownedID != nil else { throw promisesFixtureFailure("Only the exact task-owned public promise tally may be read.") }
    let data = try await page("/promises/\(number)", component: "Promises/Show", authenticated: false)
    guard let promise = data["promise"] as? PromisesObject, promise["id"] as? String == ownedID, promise["title"] as? String == editedTitle,
      promise["quote"] as? String == quote, let votes = promise["votes"] as? PromisesObject,
      votes["yes"] as? Int == yes, votes["no"] as? Int == no else { throw promisesFixtureFailure("The real public tally must acknowledge exactly one local member's latest choice, not a second vote.") }
  }
  func assertBaselineUnchanged() async throws {
    guard prepared, let baselineData else { throw promisesFixtureFailure("A verified baseline snapshot is required.") }
    let rows = try await list().filter { baselineIDs.contains($0["id"] as? String ?? "") }
    guard try canonical(rows) == baselineData else { throw promisesFixtureFailure("A preexisting promise changed during the isolated UI case.") }
  }
  func assertNoPromiseCreated() async throws {
    guard prepared else { throw promisesFixtureFailure("A verified baseline snapshot is required.") }
    guard try Set(await list().map { try uuid($0["id"]) }) == baselineIDs else { throw promisesFixtureFailure("Invalid suggestion handling must not create a promise.") }
  }
  func cleanupOwnedPromise() async throws {
    guard prepared, !cleaned else { return }
    guard let snapshot = try await observe() else {
      guard ownedID == nil else { throw promisesFixtureFailure("The recorded task promise disappeared before confirmed cleanup.") }
      try removeRecord(); return
    }
    guard snapshot.id == ownedID, !baselineIDs.contains(snapshot.id) else { throw promisesFixtureFailure("Cleanup refuses any baseline or unrecorded promise.") }
    try await assertBaselineUnchanged()
    guard let fresh = try await observe(), fresh.id == snapshot.id, fresh.version == snapshot.version else { throw promisesFixtureFailure("Cleanup requires the same recorded fresh UUID and version immediately before deletion.") }
    let result = try decode(await request("/api/v1/admin/promises/\(snapshot.id)", method: "DELETE", expected: 200))
    guard result["success"] as? Bool == true else { throw promisesFixtureFailure("The source did not confirm the exact promise soft-delete.") }
    _ = try await request("/admin/promises/\(snapshot.id)/edit", expected: 404, inertia: true)
    if let number = snapshot.number { _ = try await request("/promises/\(number)", expected: 404, authenticated: false, inertia: true) }
    guard try await list().allSatisfy({ $0["id"] as? String != snapshot.id }) else { throw promisesFixtureFailure("The task-created promise remains visible after acknowledged deletion.") }
    cleaned = true; try removeRecord()
  }
  func cleanupAndClose() async throws {
    defer { session.invalidateAndCancel() }
    var failure: Error?
    do { try await cleanupOwnedPromise(); if prepared { try await assertBaselineUnchanged() } } catch { failure = error }
    if !token.isEmpty {
      do { _ = try await request("/api/v1/auth/logout", method: "POST", expected: 200) } catch { if failure == nil { failure = error } }
    }
    if let failure { throw failure }
  }
  private func list() async throws -> [PromisesObject] {
    let data = try await page("/admin/promises", component: "Admin/Promises/Index")
    guard let rows = data["promises"] as? [PromisesObject], rows.count <= 500 else { throw promisesFixtureFailure("A bounded real Promises admin list is required.") }
    return rows
  }
  private func canonical(_ rows: [PromisesObject]) throws -> Data {
    try JSONSerialization.data(withJSONObject: rows.sorted { ($0["id"] as? String ?? "") < ($1["id"] as? String ?? "") }, options: [.sortedKeys])
  }
  private func uuid(_ value: Any?) throws -> String {
    guard let value = value as? String, let parsed = UUID(uuidString: value), parsed.uuidString.lowercased() == value else { throw promisesFixtureFailure("An exact lowercase source UUID is required.") }
    return value
  }
  private func createRecord() throws {
    let directory = try XCTUnwrap(FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first).appendingPathComponent("SyrianZoneNativePromises", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    guard try directory.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink != true else { throw promisesFixtureFailure("Refusing a linked fixture record directory.") }
    recordURL = directory.appendingPathComponent(identifier).appendingPathExtension("json")
    try persistRecord()
  }
  private func persistRecord() throws {
    guard let recordURL else { return }
    let metadata: PromisesObject = ["version": 1, "identifier": identifier, "title": title, "editedTitle": editedTitle, "quote": quote,
      "source": source, "speakerID": Self.speakerID, "baselineIDs": baselineIDs.sorted(), "ownedID": ownedID as Any? ?? NSNull(), "number": ownedNumber as Any? ?? NSNull(), "ownedVersion": ownedVersion as Any? ?? NSNull(),
      "deletionPolicy": "Source soft-delete only. Retains local tombstone, sources, votes and history."]
    try JSONSerialization.data(withJSONObject: metadata).write(to: recordURL, options: [.atomic, .completeFileProtection])
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: recordURL.path)
  }
  private func removeRecord() throws {
    if let recordURL, FileManager.default.fileExists(atPath: recordURL.path) { try FileManager.default.removeItem(at: recordURL) }
  }
  private func page(_ path: String, component: String, authenticated: Bool = true) async throws -> PromisesObject {
    let data = try decode(await request(path, expected: 200, authenticated: authenticated, inertia: true))
    guard data["component"] as? String == component, let props = data["props"] as? PromisesObject else { throw promisesFixtureFailure("The source must return the exact Inertia page component and real props.") }
    return props
  }
  private func object(_ path: String, authenticated: Bool = true, gateHeader: Bool = false) async throws -> PromisesObject {
    try decode(await request(path, expected: 200, authenticated: authenticated, gateHeader: gateHeader))
  }
  private func decode(_ data: Data) throws -> PromisesObject {
    guard let object = try JSONSerialization.jsonObject(with: data) as? PromisesObject else { throw promisesFixtureFailure("The actual local response must be an object.") }
    return object
  }
  private func request(_ path: String, method: String = "GET", expected: Int, authenticated: Bool = true,
    inertia: Bool = false, gateHeader: Bool = false, bootstrap: Bool = false) async throws -> Data {
    guard let url = URL(string: path, relativeTo: URL(string: origin))?.absoluteURL, let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
      parts.scheme == "https", parts.host == "127.0.0.1", parts.port == 9443, parts.user == nil, parts.password == nil, parts.fragment == nil,
      method == "GET" || method == "DELETE" && ownedID != nil && parts.path == "/api/v1/admin/promises/\(ownedID!)" || method == "POST" && parts.path == "/api/v1/auth/logout",
      !bootstrap || parts.path == "/" && parts.query == nil && method == "GET" && !authenticated && !inertia && !gateHeader,
      !gateHeader || parts.path == "/__native_fixture/session" && parts.query == "user=admin" && !authenticated else { throw promisesFixtureFailure("Observers refuse foreign origins, action shortcuts, unrecorded cleanup IDs and leaked fixture gates.") }
    var request = URLRequest(url: url); request.httpMethod = method
    request.setValue(bootstrap ? "text/html" : "application/json", forHTTPHeaderField: "Accept"); request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
    if authenticated { guard !token.isEmpty else { throw promisesFixtureFailure("A verified local observer token is required.") }; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    if inertia {
      guard let version = inertiaVersion else { throw promisesFixtureFailure("The current Home asset version must be read before a page request.") }
      for (name, value) in NativeInertiaBootstrap.headers(version: version) { request.setValue(value, forHTTPHeaderField: name) }
    }
    if gateHeader { request.setValue(gate, forHTTPHeaderField: "X-Native-Fixture-Key") }
    let (bytes, response) = try await session.data(for: request)
    guard let response = response as? HTTPURLResponse, response.url == url, response.statusCode == expected, bytes.count <= 2_000_000 else { throw promisesFixtureFailure("The bounded real loopback response did not match its exact expected status.") }
    return bytes
  }
}
