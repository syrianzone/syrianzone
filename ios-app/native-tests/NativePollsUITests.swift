import XCTest

final class NativePollsUITests: LocalFixtureTestCase {
  @MainActor
  func testGrantedDashboardTransitCardOpensNativeRouteFilters() throws {
    let app = try launch("admin", id: 103)
    open("dashboard", app: app)
    let dashboard = app.scrollViews.containing(.staticText, identifier: "أدوات الإدارة المتاحة لحسابك").firstMatch
    XCTAssertTrue(dashboard.waitForExistence(timeout: 15))
    assertLocal(app, user: "admin", id: 103)
    press(dashboard.buttons["ترانزيت"].firstMatch, app: app)
    XCTAssertTrue(app.staticTexts["إدارة ترانزيت"].firstMatch.waitForExistence(timeout: 15))
    press("قسم الإدارة", app: app)
    press("الخطوط", app: app)
    let query = app.textFields["ابحث باسم الخط"].firstMatch
    XCTAssertTrue(query.waitForExistence(timeout: 15))
    let text = "native-read-" + UUID().uuidString.lowercased()
    replace(query, with: text)
    XCTAssertEqual(query.value as? String, text)
    assertLocal(app, user: "admin", id: 103)
    capture("dashboard-granted-transit-route-and-filter", app: app)
  }

  @MainActor
  func testOwnNativePollGroupsCandidatesBallotAndLeaderboard() async throws {
    let backend = try PollsFixture(environment: ProcessInfo.processInfo.environment)
    addTeardownBlock { try await backend.cleanupAndClose() }
    try await backend.prepare()
    var app = try launch("admin", id: 103)
    try armNativeInputTrace("poll-group", nonce: backend.identifier, app: app)
    open("dashboard", app: app)
    assertLocal(app, user: "admin", id: 103)
    press("إنشاء استبيان جديد", app: app)
    let title = app.textFields["العنوان"].firstMatch
    let slug = app.textFields["المعرف (Slug)"].firstMatch
    XCTAssertTrue(title.waitForExistence(timeout: 10))
    try enter(title, text: backend.title)
    try enter(slug, text: backend.slug)
    press("إنشاء ومتابعة التحرير", app: app)
    XCTAssertTrue(app.staticTexts["تحرير الاستبيان"].firstMatch.waitForExistence(timeout: 20))
    var state = PollsExpected(title: backend.title, slug: backend.slug)
    try await backend.confirm(state)

    try enter(app.textFields["العنوان"].firstMatch, text: backend.editedTitle)
    try enter(app.textFields["المعرف (Slug)"].firstMatch, text: backend.editedSlug)
    assertLocal(app, user: "admin", id: 103)
    press("حفظ إعدادات الاستبيان", app: app)
    state.title = backend.editedTitle; state.slug = backend.editedSlug
    try await backend.confirm(state)

    for (index, name) in backend.groupNames.enumerated() {
      let groupName = app.textFields["اسم مجموعة جديدة"].firstMatch
      let observedBeforeRead = try enter(groupName, text: name)
      try finishGroupNameEdit(groupName, text: name, app: app)
      if nativeInputTraceEnabled {
        try attachNativeInputTrace("poll-group", nonce: backend.identifier, expected: name, observedBeforeRead: observedBeforeRead, app: app)
      }
      assertLocal(app, user: "admin", id: 103)
      press("إضافة مجموعة", app: app)
      state.groups.append(.init(name: name, order: index, isDefault: false, active: true))
      try await backend.confirm(state)
    }
    press("المجموعة", app: app)
    press(backend.groupNames[0], app: app)
    assertLocal(app, user: "admin", id: 103)
    press("تعيين كافتراضية", app: app)
    state.groups[0].isDefault = true
    try await backend.confirm(state)
    assertLocal(app, user: "admin", id: 103)
    press("نقل المجموعة لليسار", app: app)
    state.groups[0].order = 1; state.groups[1].order = 0
    try await backend.confirm(state)
    assertLocal(app, user: "admin", id: 103)
    press("تعطيل المجموعة", app: app)
    try confirmAlert("تعطيل المجموعة؟", app: app)
    state.groups[0].active = false; state.groups[0].isDefault = false
    try await backend.confirm(state)
    XCTAssertTrue(app.staticTexts["البيانات والمرشحون والصور والنتائج محفوظة، لكن المجموعة مخفية عن التصويت والترتيب حتى تعيد تفعيلها."].firstMatch.exists)
    assertLocal(app, user: "admin", id: 103)
    press("إعادة تفعيل المجموعة", app: app)
    state.groups[0].active = true
    try await backend.confirm(state)
    press("تعيين كافتراضية", app: app)
    state.groups[0].isDefault = true
    try await backend.confirm(state)

    for index in 0..<3 {
      assertLocal(app, user: "admin", id: 103)
      press("إضافة مرشح", app: app)
      let name = app.textFields["الاسم"].firstMatch
      XCTAssertTrue(name.waitForExistence(timeout: 10))
      try enter(name, text: backend.candidateNames[index])
      try enter(app.textFields["الصفة"].firstMatch, text: backend.candidateTitle)
      let group = app.buttons["مجموعة المرشح"].firstMatch
      XCTAssertTrue(group.exists)
      XCTAssertEqual(group.value as? String, backend.groupNames[0])
      press("حفظ المرشح", app: app)
      state.candidates.append(.init(name: backend.candidateNames[index], title: backend.candidateTitle, group: backend.groupNames[0]))
      try await backend.confirm(state)
      XCTAssertTrue(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: name)], timeout: 10) == .completed)
      if index == 0 {
        // Only one candidate exists, so this edit action cannot select another row.
        assertLocal(app, user: "admin", id: 103)
        press("تعديل المرشح", app: app)
        XCTAssertTrue(name.waitForExistence(timeout: 10))
        try enter(name, text: backend.editedCandidateName)
        try enter(app.textFields["الصفة"].firstMatch, text: backend.editedCandidateTitle)
        press("حفظ المرشح", app: app)
        state.candidates[0].name = backend.editedCandidateName
        state.candidates[0].title = backend.editedCandidateTitle
        try await backend.confirm(state)
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: name)], timeout: 10), .completed)
      }
    }
    capture("polls-own-native-editor-groups-and-three-candidates", app: app)
    try await backend.assertBaselineUnchanged()

    app = try launch("member", id: 101)
    open("tierlist?poll=\(backend.editedSlug)", app: app)
    XCTAssertTrue(app.staticTexts[backend.editedTitle].firstMatch.waitForExistence(timeout: 15))
    XCTAssertEqual(app.buttons["التصنيف"].firstMatch.value as? String, backend.groupNames[0])
    for candidate in state.candidates {
      let row = app.buttons.matching(NSPredicate(format: "label == %@", "\(candidate.name)، \(candidate.title)، اضغط للتحديد")).firstMatch
      press(row, app: app)
      let selected = app.buttons.matching(NSPredicate(format: "label == %@", "\(candidate.name)، \(candidate.title)، محدد")).firstMatch
      XCTAssertTrue(selected.waitForExistence(timeout: 5))
    }
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "3 بطاقة محددة.")).firstMatch.exists)
    XCTAssertEqual(app.buttons["المستوى المطلوب"].firstMatch.value as? String, "S: ممتاز")
    press("نقل البطاقات المحددة", app: app)
    XCTAssertTrue(app.staticTexts["S: ممتاز (3)"].firstMatch.waitForExistence(timeout: 10))
    XCTAssertTrue(app.staticTexts["البطاقات غير المصنفة (0)"].firstMatch.exists)
    assertLocal(app, user: "member", id: 101)
    press("إرسال التصويت", app: app)
    XCTAssertTrue(app.staticTexts["تم تسجيل التصويت"].firstMatch.waitForExistence(timeout: 20))
    XCTAssertFalse(app.buttons["إرسال التصويت"].firstMatch.isEnabled)
    let rows = try await backend.waitForScoresAndLeaderboard()
    press("النتائج العامة والترتيب", app: app)
    XCTAssertTrue(app.staticTexts["قائمة \(backend.groupNames[0])"].firstMatch.waitForExistence(timeout: 15))
    for row in rows {
      let name = app.staticTexts["#\(row.rank) \(row.name)"].firstMatch
      XCTAssertTrue(name.waitForExistence(timeout: 15))
      reveal(name, app: app)
      let summary = "النقاط: \(grouped(row.score))، الأصوات: 1، المعدّل: \(String(format: "%.2f", locale: Locale(identifier: "en_US_POSIX"), row.average))"
      XCTAssertTrue(app.staticTexts[summary].firstMatch.exists)
    }
    capture("polls-own-native-ballot-and-real-leaderboard", app: app)
    assertLocal(app, user: "member", id: 101)
    try await backend.cleanupOwnedPoll()
    try await backend.assertBaselineUnchanged()
  }

  @MainActor
  private func finishGroupNameEdit(_ field: XCUIElement, text: String, app: XCUIApplication) throws {
    field.typeText("\n")
    let keyboardClosed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      !app.keyboards.firstMatch.exists
    }, object: app)
    guard XCTWaiter.wait(for: [keyboardClosed], timeout: 5) == .completed, field.value as? String == text else {
      throw pollsFailure("Return must finish the real single-line group edit and preserve its exact synthetic name before Add Group.")
    }
  }

  @discardableResult
  @MainActor
  private func enter(_ field: XCUIElement, text: String) throws -> String? {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    dismissPopup(app)
    reveal(field, app: app)
    field.tap()
    let observedValue = field.value
    guard observedValue == nil || observedValue is String else {
      throw pollsFailure("Refusing to type into a field with an unrecognized native value.")
    }
    // Clearing the already empty new-group field stalled XCTest before a write.
    if let currentValue = observedValue as? String, !currentValue.isEmpty, currentValue != field.placeholderValue {
      field.typeKey("a", modifierFlags: .command)
      field.typeText(XCUIKeyboardKey.delete.rawValue)
    }
    field.typeText(text)
    if nativeInputTraceEnabled, field.label == "اسم مجموعة جديدة" {
      let observedBeforeRead = field.value as? String
      let pattern = #"[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}"#
      guard let range = text.range(of: pattern, options: .regularExpression) else { throw pollsFailure("An owned synthetic input nonce is required.") }
      if observedBeforeRead != text {
        try attachNativeInputTrace("poll-group", nonce: String(text[range]), expected: text, observedBeforeRead: observedBeforeRead, app: app)
      }
      XCTAssertEqual(observedBeforeRead, text, "The exact synthetic input must be present before a native write.")
      guard observedBeforeRead == text else { throw pollsFailure("Refusing a native write after the entered synthetic input changed.") }
      return observedBeforeRead
    } else {
      XCTAssertEqual(field.value as? String, text, "The exact synthetic input must be present before a native write.")
      guard field.value as? String == text else { throw pollsFailure("Refusing a native write after the entered synthetic input changed.") }
      return nil
    }
  }
  @MainActor
  private func press(_ title: String, app: XCUIApplication) {
    press(app.buttons.matching(NSPredicate(format: "identifier == %@ OR label == %@", title, title)).firstMatch, app: app,
      diagnosticName: title == "إضافة مجموعة" ? "polls-add-group-reveal" : nil)
  }
  @MainActor
  private func press(_ element: XCUIElement, app: XCUIApplication, diagnosticName: String? = nil) {
    XCTAssertTrue(element.waitForExistence(timeout: 15))
    reveal(element, app: app, diagnosticName: diagnosticName)
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: element)], timeout: 15), .completed)
    XCTAssertTrue(element.isHittable)
    element.tap()
  }
  @MainActor
  private func confirmAlert(_ title: String, app: XCUIApplication) throws {
    let alert = app.alerts.firstMatch
    XCTAssertTrue(alert.staticTexts[title].waitForExistence(timeout: 5))
    alert.buttons["تأكيد"].tap()
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: alert)], timeout: 5), .completed)
  }
  private func grouped(_ value: Int) -> String {
    let formatter = NumberFormatter(); formatter.locale = Locale(identifier: "en_US"); formatter.numberStyle = .decimal; formatter.maximumFractionDigits = 0
    return formatter.string(from: NSNumber(value: value)) ?? String(value)
  }
  @MainActor
  private func capture(_ name: String, app: XCUIApplication) {
    let attachment = XCTAttachment(screenshot: app.screenshot()); attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
  }
}

private struct PollsExpected: Sendable {
  struct Group: Sendable { let name: String; var order: Int; var isDefault: Bool; var active: Bool }
  struct Candidate: Sendable { var name: String; var title: String; let group: String }
  var title: String; var slug: String; var groups: [Group] = []; var candidates: [Candidate] = []
}
private struct PollsRanking: Sendable { let name: String; let rank: Int; let score: Int; let average: Double }
private typealias PollsObject = [String: Any]
private func pollsFailure(_ text: String) -> NSError { NSError(domain: "NativePollsFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: text]) }
private final class PollsNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
private actor PollsFixture {
  nonisolated let identifier: String, title: String, editedTitle: String, slug: String, editedSlug: String
  nonisolated let groupNames: [String], candidateNames: [String], editedCandidateName: String
  nonisolated let candidateTitle = "شخصية خيالية للاختبار", editedCandidateTitle = "صفة معدلة للاختبار المحلي"
  private let origin = "https://127.0.0.1:9443", gate: String, session: URLSession
  private var token = "", prepared = false, cleaned = false
  private var baselineIDs = Set<String>(), baselineData: Data?, coreID: String?, coreData: Data?
  private var ownedID: String?, knownData: Data?, groupIDs = Set<String>(), candidateIDs = Set<String>(), recordURL: URL?

  init(environment: [String: String]) throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == "zone.syrian.ios.uitests.xctrunner", environment["SIMULATOR_UDID"] != nil,
      environment["SZ_NATIVE_FIXTURE_ORIGIN"] == "https://127.0.0.1:9443", let gate = environment["SZ_NATIVE_FIXTURE_GATE"],
      gate.range(of: "^[A-Za-z0-9_-]{16,256}$", options: .regularExpression) != nil else { throw pollsFailure("Only the exact private Simulator account fixture may exercise synthetic polls.") }
    self.gate = gate
    let nonce = UUID().uuidString.lowercased(); identifier = nonce
    title = "استبيان تحقق محلي \(nonce)"; editedTitle = "استبيان تحقق محلي \(nonce) معدل"
    slug = "native-poll-\(nonce)"; editedSlug = "native-poll-\(nonce)-edited"
    groupNames = ["مجموعة أ \(nonce)", "مجموعة ب \(nonce)"]
    candidateNames = ["مرشح أ \(nonce)", "مرشح ب \(nonce)", "مرشح ج \(nonce)"]
    editedCandidateName = "مرشح أ \(nonce) معدل"
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieStorage = nil; configuration.httpShouldSetCookies = false; configuration.urlCredentialStorage = nil; configuration.urlCache = nil
    configuration.timeoutIntervalForRequest = 15; configuration.timeoutIntervalForResource = 20
    session = URLSession(configuration: configuration, delegate: PollsNoRedirect(), delegateQueue: nil)
    #else
    throw pollsFailure("Polls fixtures refuse physical devices and other processes.")
    #endif
  }

  func prepare() async throws {
    let access = try await object("/__native_fixture/session?user=admin", authenticated: false, gateHeader: true)
    guard access["origin"] as? String == origin, let issued = access["token"] as? String,
      issued.range(of: #"^[0-9]+\|[A-Za-z0-9_-]{16,256}$"#, options: .regularExpression) != nil else { throw pollsFailure("Invalid private observer token response.") }
    token = issued
    let user = try await object("/api/v1/user")
    guard user["id"] as? Int == 103, user["email"] as? String == "admin@native-fixture.invalid", user["is_banned"] as? Bool == false,
      let permissions = user["effective_permissions"] as? [String], Set(permissions).isSuperset(of: ["polls.create", "polls.edit", "polls.delete"]) else { throw pollsFailure("An authoritative eligible synthetic poll administrator is required.") }
    let rows = try await list()
    baselineIDs = Set(try rows.map { try uuid($0["id"]) }); baselineData = try canonical(rows)
    guard let core = rows.first(where: { $0["slug"] as? String == "best-ministers" }),
      rows.allSatisfy({ ![slug, editedSlug].contains($0["slug"] as? String ?? "") && ![title, editedTitle].contains($0["title"] as? String ?? "") }) else { throw pollsFailure("The seeded core must exist and both fresh UUID slugs/titles must be absent before UI creation.") }
    coreID = try uuid(core["id"]); coreData = try canonicalState(await detail(try uuid(core["id"])))
    prepared = true; try createRecord()
  }
  func confirm(_ expected: PollsExpected) async throws {
    let deadline = Date().addingTimeInterval(15)
    repeat {
      if let state = try await observe(), try matches(state, expected: expected) {
        knownData = try canonicalState(state); try persistRecord(); return
      }
      try await Task.sleep(for: .milliseconds(200))
    } while Date() < deadline
    throw pollsFailure("The actual native poll/group/candidate write did not reach its exact expected state.")
  }
  private func observe() async throws -> PollsObject? {
    let rows = try await list().filter { [slug, editedSlug].contains($0["slug"] as? String ?? "") }
    guard rows.count <= 1 else { throw pollsFailure("Ambiguous nonce slugs are retained without cleanup.") }
    guard let row = rows.first else { return nil }
    let id = try uuid(row["id"])
    guard !baselineIDs.contains(id), id != coreID, ownedID == nil || ownedID == id,
      [title, editedTitle].contains(row["title"] as? String ?? "") else { throw pollsFailure("The record must be the newly created non-core UUID with its exact nonce title and slug.") }
    let state = try await detail(id)
    try validate(state, id: id)
    if ownedID == nil { ownedID = id; try persistRecord() }
    return state
  }
  private func validate(_ state: PollsObject, id: String) throws {
    guard let poll = state["poll"] as? PollsObject, try uuid(poll["id"]) == id,
      !baselineIDs.contains(id), id != coreID, [slug, editedSlug].contains(poll["slug"] as? String ?? ""),
      [title, editedTitle].contains(poll["title"] as? String ?? ""), poll["is_active"] as? Bool == true,
      let groups = state["groups"] as? [PollsObject], groups.count <= 2,
      let candidates = state["candidates"] as? [PollsObject], candidates.count <= 3 else { throw pollsFailure("Refusing any poll outside the active nonce-owned record and bounded children.") }
    for group in groups {
      guard try uuid(group["poll_id"]) == id, groupNames.contains(group["name"] as? String ?? "") else { throw pollsFailure("Every group must belong to this exact poll and expected synthetic name set.") }
      _ = try uuid(group["id"])
    }
    let expectedNames = candidateNames + [editedCandidateName]
    for candidate in candidates {
      guard try uuid(candidate["poll_id"]) == id, expectedNames.contains(candidate["name"] as? String ?? ""),
        [candidateTitle, editedCandidateTitle].contains(candidate["title"] as? String ?? ""), candidate["status"] as? String == "active",
        candidate["image_url"] is NSNull, candidate["x_handle"] is NSNull else { throw pollsFailure("Every candidate must be the exact synthetic image-free active record in this poll.") }
      let group = try uuid(candidate["candidate_group_id"])
      guard groups.contains(where: { $0["id"] as? String == group }) else { throw pollsFailure("A candidate cannot point to a different poll's group.") }
      _ = try uuid(candidate["id"])
    }
  }
  private func matches(_ state: PollsObject, expected: PollsExpected) throws -> Bool {
    guard let poll = state["poll"] as? PollsObject, poll["title"] as? String == expected.title, poll["slug"] as? String == expected.slug,
      let groups = state["groups"] as? [PollsObject], groups.count == expected.groups.count,
      let candidates = state["candidates"] as? [PollsObject], candidates.count == expected.candidates.count else { return false }
    for expected in expected.groups {
      guard let row = groups.first(where: { $0["name"] as? String == expected.name }), row["sort_order"] as? Int == expected.order,
        row["is_default"] as? Bool == expected.isDefault, row["is_active"] as? Bool == expected.active else { return false }
    }
    for expected in expected.candidates {
      guard let row = candidates.first(where: { $0["name"] as? String == expected.name }), row["title"] as? String == expected.title,
        let group = groups.first(where: { $0["name"] as? String == expected.group }), row["candidate_group_id"] as? String == group["id"] as? String else { return false }
    }
    groupIDs = Set(try groups.map { try uuid($0["id"]) }); candidateIDs = Set(try candidates.map { try uuid($0["id"]) })
    return true
  }
  func waitForScoresAndLeaderboard() async throws -> [PollsRanking] {
    guard let id = ownedID, candidateIDs.count == 3 else { throw pollsFailure("Three confirmed native candidates in the exact own poll are required.") }
    let deadline = Date().addingTimeInterval(15)
    repeat {
      let state = try await detail(id)
      try validate(state, id: id)
      guard try canonicalState(state) == knownData else { throw pollsFailure("Voting must not modify the editor's confirmed poll/group/candidate data.") }
      if let scores = state["todayScores"] as? [PollsObject], scores.count == 3,
        Set(scores.compactMap { $0["candidate_id"] as? String }) == candidateIDs,
        scores.allSatisfy({ $0["poll_id"] as? String == id && $0["votes"] as? Int == 1 && ($0["score"] as? Int ?? 0) > 0 }) {
        let data = try await object("/api/v1/polls/\(editedSlug)/leaderboard", authenticated: false)
        guard let poll = data["poll"] as? PollsObject, poll["id"] as? String == id, let groups = data["groups"] as? [PollsObject],
          let group = groups.first(where: { $0["name"] as? String == groupNames[0] }), let key = group["rankingKey"] as? String,
          let rows = data[key] as? [PollsObject], rows.count == 3, Set(rows.compactMap { $0["candidateId"] as? String }) == candidateIDs else { throw pollsFailure("The real public leaderboard must contain exactly the three own candidates.") }
        return try rows.map { row in
          guard let name = row["name"] as? String, let rank = row["rank"] as? Int, (1...3).contains(rank), row["votes"] as? Int == 1,
            let score = row["score"] as? Int, score > 0, let average = row["avg"] as? Double, average.isFinite else { throw pollsFailure("Each leaderboard row must expose an actual rank, one vote and finite positive score.") }
          return .init(name: name, rank: rank, score: score, average: average)
        }
      }
      try await Task.sleep(for: .milliseconds(200))
    } while Date() < deadline
    throw pollsFailure("The native ballot did not produce exactly one vote for each of the three own candidates.")
  }
  func assertBaselineUnchanged() async throws {
    guard prepared, let baselineData, let coreID, let coreData else { throw pollsFailure("A verified baseline and protected core snapshot are required.") }
    let rows = try await list().filter { baselineIDs.contains($0["id"] as? String ?? "") }
    guard try canonical(rows) == baselineData, try canonicalState(await detail(coreID)) == coreData else { throw pollsFailure("A preexisting poll or the seeded core/groups/candidates changed. Refusing cleanup.") }
  }
  func cleanupOwnedPoll() async throws {
    guard prepared, !cleaned else { return }
    guard let state = try await observe() else {
      guard ownedID == nil else { throw pollsFailure("A recorded poll disappeared before confirmed cleanup.") }
      try removeRecord(); return
    }
    guard let id = ownedID, !baselineIDs.contains(id), id != coreID else { throw pollsFailure("Only the exact new non-core UUID may be cleaned.") }
    let snapshot = try canonicalState(state)
    if let knownData { guard knownData == snapshot else { throw pollsFailure("Unexpected editor changes are retained rather than adopted during cleanup.") } }
    else { knownData = snapshot; try persistRecord() }
    try await assertBaselineUnchanged()
    guard try canonicalState(await detail(id)) == snapshot else { throw pollsFailure("The exact own poll state changed before cleanup.") }
    _ = try await request("/api/v1/admin/polls/\(id)", method: "DELETE", expected: 204)
    _ = try await request("/api/v1/admin/polls/\(id)", expected: 404)
    for group in groupIDs { _ = try await request("/api/v1/admin/candidate-groups/\(group)", expected: 404) }
    guard try await list().allSatisfy({ $0["id"] as? String != id }) else { throw pollsFailure("The exact own poll remains after source hard deletion.") }
    cleaned = true; try removeRecord()
  }
  func cleanupAndClose() async throws {
    defer { session.invalidateAndCancel() }
    var failure: Error?
    do { try await cleanupOwnedPoll(); if prepared { try await assertBaselineUnchanged() } } catch { failure = error }
    if !token.isEmpty { do { _ = try await request("/api/v1/auth/logout", method: "POST", expected: 200) } catch { if failure == nil { failure = error } } }
    if let failure { throw failure }
  }
  private func list() async throws -> [PollsObject] {
    let data = try await request("/api/v1/admin/polls", expected: 200)
    guard let rows = try JSONSerialization.jsonObject(with: data) as? [PollsObject], rows.count <= 500 else { throw pollsFailure("A bounded real administrator poll list is required.") }
    return rows
  }
  private func detail(_ id: String) async throws -> PollsObject { try await object("/api/v1/admin/polls/\(id)?include_archived=1") }
  private func canonicalState(_ state: PollsObject) throws -> Data {
    guard let poll = state["poll"] as? PollsObject, let groups = state["groups"] as? [PollsObject], let candidates = state["candidates"] as? [PollsObject] else { throw pollsFailure("Invalid real editor state.") }
    return try JSONSerialization.data(withJSONObject: ["poll": poll, "groups": sorted(groups), "candidates": sorted(candidates)], options: [.sortedKeys])
  }
  private func sorted(_ rows: [PollsObject]) -> [PollsObject] { rows.sorted { ($0["id"] as? String ?? "") < ($1["id"] as? String ?? "") } }
  private func canonical(_ rows: [PollsObject]) throws -> Data { try JSONSerialization.data(withJSONObject: sorted(rows), options: [.sortedKeys]) }
  private func uuid(_ value: Any?) throws -> String {
    guard let text = value as? String, UUID(uuidString: text)?.uuidString.lowercased() == text else { throw pollsFailure("An exact lowercase source UUID is required.") }
    return text
  }
  private func createRecord() throws {
    let directory = try XCTUnwrap(FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first).appendingPathComponent("SyrianZoneNativePolls", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    guard try directory.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink != true else { throw pollsFailure("Refusing a linked private fixture cache.") }
    recordURL = directory.appendingPathComponent(identifier).appendingPathExtension("json"); try persistRecord()
  }
  private func persistRecord() throws {
    guard let recordURL else { return }
    let metadata: PollsObject = ["version": 1, "identifier": identifier, "title": title, "editedTitle": editedTitle, "slug": slug, "editedSlug": editedSlug,
      "baselineIDs": baselineIDs.sorted(), "coreID": coreID as Any? ?? NSNull(), "ownedID": ownedID as Any? ?? NSNull(), "groupIDs": groupIDs.sorted(), "candidateIDs": candidateIDs.sorted()]
    try JSONSerialization.data(withJSONObject: metadata).write(to: recordURL, options: [.atomic, .completeFileProtection])
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: recordURL.path)
  }
  private func removeRecord() throws { if let recordURL, FileManager.default.fileExists(atPath: recordURL.path) { try FileManager.default.removeItem(at: recordURL) } }
  private func object(_ path: String, authenticated: Bool = true, gateHeader: Bool = false) async throws -> PollsObject {
    let data = try await request(path, expected: 200, authenticated: authenticated, gateHeader: gateHeader)
    guard let object = try JSONSerialization.jsonObject(with: data) as? PollsObject else { throw pollsFailure("The actual local response must be an object.") }
    return object
  }
  private func request(_ path: String, method: String = "GET", expected: Int, authenticated: Bool = true, gateHeader: Bool = false) async throws -> Data {
    guard let url = URL(string: path, relativeTo: URL(string: origin))?.absoluteURL, let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
      parts.scheme == "https", parts.host == "127.0.0.1", parts.port == 9443, parts.user == nil, parts.password == nil, parts.fragment == nil,
      method == "GET" || method == "DELETE" && ownedID != nil && parts.path == "/api/v1/admin/polls/\(ownedID!)" && !baselineIDs.contains(ownedID!) && ownedID != coreID || method == "POST" && parts.path == "/api/v1/auth/logout",
      !gateHeader || parts.path == "/__native_fixture/session" && parts.query == "user=admin" && !authenticated else { throw pollsFailure("Observers refuse external targets, action shortcuts, leaked gates and any non-owned deletion.") }
    var request = URLRequest(url: url); request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Accept"); request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
    if authenticated { guard !token.isEmpty else { throw pollsFailure("A verified private observer token is required.") }; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    if gateHeader { request.setValue(gate, forHTTPHeaderField: "X-Native-Fixture-Key") }
    let (data, response) = try await session.data(for: request)
    guard let response = response as? HTTPURLResponse, response.url == url, response.statusCode == expected, data.count <= 2_000_000 else { throw pollsFailure("The exact bounded loopback response did not confirm the expected status.") }
    return data
  }
}
