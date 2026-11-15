import Foundation
import UIKit
import XCTest

// Native forms perform creation, editing, moderation and bulk actions.
// The HTTP observer can only read, revoke its own token, or clean exact task IDs.
final class NativeUsersAdminUITests: LocalFixtureTestCase {
  @MainActor
  func testSyntheticUsersCapabilitiesScopeBanRestoreAndBoundedBulk() async throws {
    let backend = try UsersAdminFixture(environment: ProcessInfo.processInfo.environment)
    addTeardownBlock { try await backend.cleanupAndClose() }
    let controls = try await backend.prepare()
    let app = try launch("admin", id: 103)
    open("users_admin", app: app)
    XCTAssertTrue(app.buttons["إنشاء مستخدم"].waitForExistence(timeout: 20))

    let first = backend.identities[0], second = backend.identities[1]
    try await create(first, controls: controls, backend: backend, app: app)
    try await create(second, controls: controls, backend: backend, app: app)
    let firstID = try backend.requiredID(first)

    try await edit(first, id: firstID, controls: controls, backend: backend, app: app, banned: true, configureScope: true)
    let banned = try await backend.verify(first, name: first.editedName, banned: true, deleted: false, configured: true)
    capture("users-native-edited-capability-scope-and-ban", app: app)
    try await edit(first, id: firstID, controls: controls, backend: backend, app: app, banned: false, configureScope: false)
    let unbanned = try await backend.verify(first, name: first.editedName, banned: false, deleted: false, configured: true)
    XCTAssertNotEqual(banned.version, unbanned.version, "A real ban change must adopt a fresh server version.")

    try await search(first.email, count: 1, app: app)
    try await backend.verifyOnly([first], deleted: false)
    assertLocal(app, user: "admin", id: 103)
    tap("حذف مؤقت \(first.editedName)", app: app)
    try confirm("حذف مؤقت", count: 1, app: app)
    _ = try await backend.verify(first, name: first.editedName, banned: false, deleted: true, configured: true)
    try setDeletedFilter("المحذوفون فقط", app: app)
    XCTAssertTrue(app.buttons["استعادة \(first.editedName)"].firstMatch.waitForExistence(timeout: 15))
    assertLocal(app, user: "admin", id: 103)
    tap("استعادة \(first.editedName)", app: app)
    try confirm("استعادة", count: 1, app: app)
    _ = try await backend.verify(first, name: first.editedName, banned: false, deleted: false, configured: true)

    try setDeletedFilter("المستخدمون غير المحذوفين", app: app)
    try await search(backend.identifier, count: 2, app: app)
    try await bulk("حذف مؤقت", identities: [first, second], deleted: false, backend: backend, app: app)
    _ = try await backend.verify(first, name: first.editedName, banned: false, deleted: true, configured: true)
    _ = try await backend.verify(second, name: second.name, banned: false, deleted: true, configured: false)
    try setDeletedFilter("المحذوفون فقط", app: app)
    try await search(backend.identifier, count: 2, app: app)
    try await bulk("استعادة", identities: [first, second], deleted: true, backend: backend, app: app)
    _ = try await backend.verify(first, name: first.editedName, banned: false, deleted: false, configured: true)
    _ = try await backend.verify(second, name: second.name, banned: false, deleted: false, configured: false)
    try await backend.verifyProtectedAccounts()
    capture("users-native-two-owned-users-bulk-restored", app: app)

    try await backend.cleanupCreatedUsers()
    try await backend.verifyProtectedAccounts()
    open("account", app: app)
    assertLocal(app, user: "admin", id: 103)
    tap("تسجيل الخروج", app: app)
    XCTAssertTrue(app.buttons["تسجيل الدخول"].firstMatch.waitForExistence(timeout: 15))
  }

  @MainActor
  func testArabicNameWordSpaceAndSingleCallWithoutCreatingUser() async throws {
    let backend = try UsersAdminFixture(environment: ProcessInfo.processInfo.environment)
    let lifetime = UsersNameProbeLifetime()
    addTeardownBlock { try await backend.closeReadOnlyProbe() }
    addTeardownBlock { () throws -> Void in
      guard Thread.isMainThread else { throw usersFixtureFailure("The owned form probe teardown requires XCTest's main thread.") }
      MainActor.assumeIsolated { lifetime.terminate() }
    }
    _ = try await backend.prepare()
    let expected = backend.identities[0].name, word = "مستخدم"
    guard expected.hasPrefix(word + " ") else { throw usersFixtureFailure("The existing synthetic identity must retain its exact Arabic name prefix.") }
    for identity in backend.identities { try await backend.expectAbsent(identity) }
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    lifetime.own(app)
    _ = try launch("admin", id: 103)
    open("users_admin", app: app)
    XCTAssertTrue(app.buttons["إنشاء مستخدم"].waitForExistence(timeout: 20))
    tap("إنشاء مستخدم", app: app)
    let name = app.textFields["الاسم"].firstMatch
    XCTAssertTrue(name.waitForExistence(timeout: 15))
    reveal(name, app: app); name.tap()
    var mismatches: [String] = []
    name.typeKey("a", modifierFlags: .command)
    name.typeText(XCUIKeyboardKey.delete.rawValue)
    try nameProbeCheckpoint("initial-clear", field: name, expected: "", identifier: backend.identifier, app: app, mismatches: &mismatches)
    name.typeText(word)
    try nameProbeCheckpoint("word-focused", field: name, expected: word, identifier: backend.identifier, app: app, mismatches: &mismatches)
    name.typeText(" ")
    try nameProbeCheckpoint("first-space-focused", field: name, expected: word + " ", identifier: backend.identifier, app: app, mismatches: &mismatches)
    name.typeText(String(expected.dropFirst((word + " ").count)))
    try nameProbeCheckpoint("remainder-focused", field: name, expected: expected, identifier: backend.identifier, app: app, mismatches: &mismatches)
    name.typeKey("a", modifierFlags: .command)
    name.typeText(XCUIKeyboardKey.delete.rawValue)
    name.typeText(expected)
    try nameProbeCheckpoint("single-call-focused", field: name, expected: expected, identifier: backend.identifier, app: app, mismatches: &mismatches)
    // Chunk boundaries and value/screenshot queries intentionally allow UI quiescence.
    // Compare them with the final one-call entry; neither measures native text events.
    app.terminate()
    try await backend.verifyReadOnlyProbeUnchanged()
    XCTAssertTrue(mismatches.isEmpty, "Exact synthetic name differed at: \(mismatches.joined(separator: ", ")). All stages were captured without submitting the form.")
  }

  @MainActor
  private func nameProbeCheckpoint(_ stage: String, field: XCUIElement, expected: String, identifier: String,
    app: XCUIApplication, mismatches: inout [String]) throws {
    let actual = field.value as? String
    let record: [String: Any] = ["stage": stage, "identifier": identifier, "expected": expected,
      "actualNativeText": actual as Any? ?? NSNull(), "submitted": false,
      "limit": "The input stays focused. Chunked XCTest calls and queries allow quiescence; no JS change event or password value is read."]
    let values = XCTAttachment(data: try JSONSerialization.data(withJSONObject: record, options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
    values.name = "users-arabic-name-\(stage)-exact-values"; values.lifetime = .keepAlways; add(values)
    capture("users-arabic-name-\(stage)", app: app)
    if actual != expected { mismatches.append(stage) }
  }

  @MainActor
  private func create(_ identity: UsersFixtureIdentity, controls: UsersFixtureControls, backend: UsersAdminFixture, app: XCUIApplication) async throws {
    try await backend.expectAbsent(identity)
    assertLocal(app, user: "admin", id: 103)
    tap("إنشاء مستخدم", app: app)
    let name = app.textFields["الاسم"].firstMatch
    XCTAssertTrue(name.waitForExistence(timeout: 15))
    replace(name, with: identity.name)
    replace(app.textFields["البريد الإلكتروني"].firstMatch, with: identity.email)
    let password = app.secureTextFields["كلمة المرور المطلوبة للمستخدم الجديد"].firstMatch
    XCTAssertTrue(password.exists)
    // The disposable synthetic password exists only in the runner and secure field.
    replace(password, with: UUID().uuidString + UUID().uuidString)
    try collapseGroups(controls, keepTransit: false, app: app)
    XCTAssertEqual(name.value as? String, identity.name, "Keep the task's exact name before native creation.")
    XCTAssertEqual(app.textFields["البريد الإلكتروني"].firstMatch.value as? String, identity.email)
    assertLocal(app, user: "admin", id: 103)
    tap("حفظ المستخدم", app: app)
    XCTAssertTrue(app.staticTexts["تم حفظ المستخدم «\(identity.name)»."].firstMatch.waitForExistence(timeout: 20))
    try await backend.confirmCreated(identity)
    try requireCreatedUserEditorDismissal(name: name, app: app)
  }

  @MainActor
  private func requireCreatedUserEditorDismissal(name: XCUIElement, app: XCUIApplication) throws {
    let passwordPrompt = app.sheets["Save Password?"]
    if passwordPrompt.waitForExistence(timeout: 5) {
      let declineSave = passwordPrompt.buttons["Not Now"]
      XCTAssertTrue(declineSave.exists && declineSave.isHittable && passwordPrompt.buttons["Save"].exists,
        "Only the observed Passwords save sheet may be declined.")
      declineSave.tap()
      XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: passwordPrompt)], timeout: 5), .completed)
    }
    let create = app.buttons["إنشاء مستخدم"].firstMatch
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      !name.exists && create.exists && create.isEnabled && create.isHittable
    }, object: app)
    let result = XCTWaiter.wait(for: [ready], timeout: 15)
    if result != .completed {
      func geometry(_ frame: CGRect) -> [String: Double] {
        ["x": frame.minX, "y": frame.minY, "width": frame.width, "height": frame.height]
      }
      let createExists = create.exists
      let state: [String: Any] = [
        "stage": "after-confirmed-user-creation", "appFrame": geometry(app.frame),
        "createExists": createExists, "createEnabled": createExists && create.isEnabled,
        "createHittable": createExists && create.isHittable,
        "createFrame": createExists ? geometry(create.frame) as Any : NSNull(),
        "editorNameFieldCount": app.textFields.matching(identifier: "الاسم").count,
        "editorSaveButtonCount": app.buttons.matching(identifier: "حفظ المستخدم").count,
        "cancelButtonCount": app.buttons.matching(identifier: "إلغاء").count,
        "sheetCount": app.sheets.count, "keyboardCount": app.keyboards.count,
      ]
      let values = XCTAttachment(data: try JSONSerialization.data(withJSONObject: state, options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
      values.name = "users-after-confirmed-create-readiness"; values.lifetime = .keepAlways; add(values)
      let tree = XCTAttachment(string: app.debugDescription)
      tree.name = "users-after-confirmed-create-AX"; tree.lifetime = .keepAlways; add(tree)
      let screen = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
      screen.name = "users-after-confirmed-create-system-screen"; screen.lifetime = .keepAlways; add(screen)
      throw usersFixtureFailure("The confirmed user's editor must disappear and the background Create control must become enabled and hittable before continuing.")
    }
  }

  @MainActor
  private func edit(_ identity: UsersFixtureIdentity, id: Int, controls: UsersFixtureControls, backend: UsersAdminFixture,
    app: XCUIApplication, banned: Bool, configureScope: Bool) async throws {
    let current = try await backend.observe(identity)
    XCTAssertEqual(current.id, id)
    try await search(identity.email, count: 1, app: app)
    assertLocal(app, user: "admin", id: 103)
    tap("تعديل \(current.name)", app: app)
    let name = app.textFields["الاسم"].firstMatch
    XCTAssertTrue(name.waitForExistence(timeout: 15))
    replace(name, with: identity.editedName)
    try setToggle("محظور", value: banned, app: app)
    try collapseGroups(controls, keepTransit: true, app: app)
    if configureScope {
      try setToggle(controls.permissionLabel, value: true, app: app)
      XCTAssertTrue(app.staticTexts["نطاق المحافظات"].firstMatch.waitForExistence(timeout: 10))
      try setToggle(controls.cityLabel, value: true, app: app)
    }
    XCTAssertEqual(name.value as? String, identity.editedName, "Keep the task's exact name before native editing.")
    assertLocal(app, user: "admin", id: 103)
    tap("حفظ المستخدم", app: app)
    XCTAssertTrue(app.staticTexts["تم حفظ المستخدم «\(identity.editedName)»."].firstMatch.waitForExistence(timeout: 20))
  }

  @MainActor
  private func collapseGroups(_ controls: UsersFixtureControls, keepTransit: Bool, app: XCUIApplication) throws {
    for group in controls.groups where !keepTransit || group.id != "transit" {
      let button = app.buttons["طي \(group.label) (0)"].firstMatch
      guard button.waitForExistence(timeout: 5) else { throw usersFixtureFailure("Each untouched permission group must match the real server options before collapsing it.") }
      reveal(button, app: app)
      button.tap()
    }
  }

  @MainActor
  private func setToggle(_ title: String, value: Bool, app: XCUIApplication) throws {
    let toggle = app.switches[title].firstMatch
    XCTAssertTrue(toggle.waitForExistence(timeout: 10))
    reveal(toggle, app: app)
    XCTAssertTrue(toggle.isEnabled)
    let raw = toggle.value
    let previous: Bool
    if let text = raw as? String, ["0", "1"].contains(text) { previous = text == "1" }
    else if let number = raw as? NSNumber, [0, 1].contains(number.intValue) { previous = number.boolValue }
    else { throw usersFixtureFailure("A native switch must expose its actual Boolean state.") }
    if previous != value {
      // The proven RTL native switch track sits at the left of its wider AX row.
      let inset = min(CGFloat(31), toggle.frame.width / 2)
      toggle.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0.5)).withOffset(CGVector(dx: inset, dy: 0)).tap()
    }
    let expected = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@ OR value == %@", value ? "1" : "0", NSNumber(value: value)), object: toggle)
    XCTAssertEqual(XCTWaiter.wait(for: [expected], timeout: 8), .completed)
  }

  @MainActor
  private func search(_ query: String, count: Int, app: XCUIApplication) async throws {
    let input = app.textFields["ابحث بالاسم أو البريد الإلكتروني"].firstMatch
    XCTAssertTrue(input.waitForExistence(timeout: 10))
    replace(input, with: query)
    XCTAssertTrue(app.staticTexts["\(count) مستخدماً، محدد 0"].firstMatch.waitForExistence(timeout: 15))
    XCTAssertFalse(app.buttons["تأكيد الإجراء"].exists)
  }

  @MainActor
  private func setDeletedFilter(_ title: String, app: XCUIApplication) throws {
    tap("حالة الحذف", app: app)
    tap(title, app: app)
  }

  @MainActor
  private func bulk(_ action: String, identities: [UsersFixtureIdentity], deleted: Bool, backend: UsersAdminFixture, app: XCUIApplication) async throws {
    try await backend.verifyOnly(identities, deleted: deleted)
    assertLocal(app, user: "admin", id: 103)
    tap("تحديد هذه الصفحة", app: app)
    XCTAssertTrue(app.staticTexts["2 مستخدماً، محدد 2"].firstMatch.waitForExistence(timeout: 10))
    for identity in identities {
      let current = try await backend.observe(identity)
      try setToggle("تحديد \(current.name)", value: true, app: app)
    }
    try await backend.verifyOnly(identities, deleted: deleted)
    assertLocal(app, user: "admin", id: 103)
    tap("\(action) المحددين", app: app)
    try confirm(action, count: 2, app: app)
  }

  @MainActor
  private func confirm(_ action: String, count: Int, app: XCUIApplication) throws {
    XCTAssertTrue(app.staticTexts["تأكيد \(action)"].firstMatch.waitForExistence(timeout: 10))
    let summary = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "\(action) \(count) مستخدماً.")).firstMatch
    XCTAssertTrue(summary.exists)
    XCTAssertFalse(app.staticTexts["التحديد يشمل حسابك. حذفه ينهي تسجيل دخولك بعد إكمال التغييرات المؤكدة."].exists)
    assertLocal(app, user: "admin", id: 103)
    tap("تأكيد الإجراء", app: app)
    XCTAssertTrue(app.staticTexts["تم تأكيد \(action) \(count) مستخدماً من \(count)."].firstMatch.waitForExistence(timeout: 20))
  }

  @MainActor
  private func capture(_ name: String, app: XCUIApplication) {
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
  }
}

@MainActor private final class UsersNameProbeLifetime {
  private var app: XCUIApplication?
  func own(_ value: XCUIApplication) { app = value }
  func terminate() { if let app, app.state != .notRunning { app.terminate() } }
}

private struct UsersFixtureIdentity: Codable, Sendable {
  let name: String
  let editedName: String
  let email: String
}
private struct UsersFixtureControls: Sendable {
  struct Group: Sendable { let id: String; let label: String }
  let groups: [Group]
  let permissionLabel: String
  let cityLabel: String
}
private struct UsersFixtureSnapshot: Sendable {
  let id: Int
  let name: String
  let version: String
}
private typealias UsersFixtureObject = [String: Any]
private func usersFixtureFailure(_ message: String) -> NSError {
  NSError(domain: "NativeUsersAdminFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
}

private final class UsersAdminFixture: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  let identifier = UUID().uuidString.lowercased()
  lazy var identities: [UsersFixtureIdentity] = ["a", "b"].map { suffix in
    let name = "مستخدم تحقق محلي \(identifier) \(suffix)"
    return UsersFixtureIdentity(name: name, editedName: "\(name) معدل", email: "native-users-\(identifier)-\(suffix)@native-fixture.invalid")
  }
  private let origin = "https://127.0.0.1:9443"
  private let permission = "transit.review_drafts", city = "damascus"
  private var token = "", gate = ""
  private var session: URLSession!
  private var baseline = Set<Int>(), protectedVersions: [Int: String] = [:], ids: [String: Int] = [:]
  private var recordURL: URL?
  private var cleaned = Set<Int>()

  init(environment: [String: String]) throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == "zone.syrian.ios.uitests.xctrunner", environment["SIMULATOR_UDID"] != nil,
      environment["SZ_NATIVE_FIXTURE_ORIGIN"] == origin, let key = environment["SZ_NATIVE_FIXTURE_GATE"],
      key.range(of: "^[A-Za-z0-9_-]{16,256}$", options: .regularExpression) != nil else { throw usersFixtureFailure("Only the exact private Simulator fixture runner may manage synthetic users.") }
    gate = key
    super.init()
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieStorage = nil; configuration.httpShouldSetCookies = false
    configuration.urlCredentialStorage = nil; configuration.urlCache = nil
    configuration.timeoutIntervalForRequest = 15; configuration.timeoutIntervalForResource = 20
    session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    #else
    throw XCTSkip("User administration fixtures refuse physical devices and other processes.")
    #endif
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }

  func prepare() async throws -> UsersFixtureControls {
    let access = try await object("/__native_fixture/session?user=admin", headers: ["X-Native-Fixture-Key": gate], authenticated: false)
    guard access["origin"] as? String == origin, let minted = access["token"] as? String,
      minted.range(of: #"^[0-9]+\|[A-Za-z0-9_-]{16,256}$"#, options: .regularExpression) != nil else { throw usersFixtureFailure("The private fixture session response was invalid.") }
    token = minted
    let actor = try await object("/api/v1/user")
    guard try positiveID(actor["id"]) == 103, actor["email"] as? String == "admin@native-fixture.invalid", actor["is_banned"] as? Bool == false else { throw usersFixtureFailure("The real synthetic administrator identity must be verified.") }
    let options = try await object("/api/v1/admin/users/options")
    guard options["can_manage_users"] as? Bool == true, try positiveID(options["actor_id"]) == 103,
      options["default_role"] as? String == "user", let groups = options["groups"] as? [UsersFixtureObject],
      let transit = groups.first(where: { $0["id"] as? String == "transit" }), let permissions = transit["permissions"] as? [UsersFixtureObject],
      let capability = permissions.first(where: { $0["id"] as? String == permission }), let permissionLabel = capability["label"] as? String,
      let cities = options["cities"] as? [UsersFixtureObject], let damascus = cities.first(where: { $0["id"] as? String == city }),
      let cityLabel = damascus["name_ar"] as? String else { throw usersFixtureFailure("Authoritative user, permission and governorate options are required.") }
    let all = try await list(query: "", trashed: "with")
    baseline = Set(try all.map { try positiveID($0["id"]) })
    guard baseline.isSuperset(of: [101, 102, 103, 104]) else { throw usersFixtureFailure("All original fixture accounts must be present before this test.") }
    for row in all where [101, 102, 103, 104].contains(try positiveID(row["id"])) { protectedVersions[try positiveID(row["id"])] = try version(row) }
    try createRecord()
    return UsersFixtureControls(groups: try groups.map { row in
      guard let id = row["id"] as? String, let label = row["label"] as? String, !id.isEmpty, !label.isEmpty else { throw usersFixtureFailure("Invalid permission-group options.") }
      return .init(id: id, label: label)
    }, permissionLabel: permissionLabel, cityLabel: cityLabel)
  }

  func requiredID(_ identity: UsersFixtureIdentity) throws -> Int {
    guard identities.contains(where: { $0.email == identity.email }), let id = ids[identity.email], id > 104, !baseline.contains(id), !cleaned.contains(id) else { throw usersFixtureFailure("Only an exact task-created non-baseline ID is eligible.") }
    return id
  }
  func expectAbsent(_ identity: UsersFixtureIdentity) async throws {
    guard try await list(query: identity.email, trashed: "with").isEmpty else { throw usersFixtureFailure("A task email must be absent before native creation.") }
  }
  func confirmCreated(_ identity: UsersFixtureIdentity) async throws {
    let rows = try await list(query: identity.email, trashed: "with")
    guard rows.count == 1 else { throw usersFixtureFailure("One unique native-created user is required.") }
    let id = try positiveID(rows[0]["id"])
    try validate(rows[0], identity: identity)
    guard rows[0]["name"] as? String == identity.name, rows[0]["is_banned"] as? Bool == false,
      rows[0]["deleted_at"] is NSNull, (rows[0]["permissions"] as? [String]) == [], (rows[0]["stored_transit_scope"] as? [String]) == [] else { throw usersFixtureFailure("Native creation must preserve the source's ordinary, unbanned default role and empty capability scope.") }
    ids[identity.email] = id
    try persistRecord()
    _ = try await observe(identity)
  }
  func observe(_ identity: UsersFixtureIdentity) async throws -> UsersFixtureSnapshot {
    let id = try requiredID(identity), row = try await detail(id)
    try validate(row, identity: identity)
    return UsersFixtureSnapshot(id: id, name: row["name"] as? String ?? "", version: try version(row))
  }
  func verify(_ identity: UsersFixtureIdentity, name: String, banned: Bool, deleted: Bool, configured: Bool) async throws -> UsersFixtureSnapshot {
    let id = try requiredID(identity), row = try await detail(id)
    try validate(row, identity: identity)
    guard row["name"] as? String == name, row["is_banned"] as? Bool == banned, (row["deleted_at"] is String) == deleted,
      row["permissions"] as? [String] == (configured ? [permission] : []), row["stored_transit_scope"] as? [String] == (configured ? [city] : []) else { throw usersFixtureFailure("The actual native user mutation did not preserve its exact expected fields, capabilities, scope and state.") }
    return .init(id: id, name: name, version: try version(row))
  }
  func verifyOnly(_ selected: [UsersFixtureIdentity], deleted: Bool) async throws {
    let expected = Set(try selected.map(requiredID)), rows = try await list(query: selected.count == 1 ? selected[0].email : identifier, trashed: deleted ? "only" : "without")
    guard rows.count == selected.count, Set(try rows.map { try positiveID($0["id"]) }) == expected else { throw usersFixtureFailure("The native filter may select only the exact task-created users.") }
    for identity in selected { _ = try await observe(identity) }
  }
  func verifyProtectedAccounts() async throws {
    for (id, expected) in protectedVersions { guard try version(await detail(id)) == expected else { throw usersFixtureFailure("A protected fixture account changed. No further destructive action is permitted.") } }
  }

  func cleanupCreatedUsers() async throws {
    for identity in identities {
      if let existing = ids[identity.email], cleaned.contains(existing) { continue }
      if ids[identity.email] == nil {
        let matches = try await list(query: identity.email, trashed: "with")
        if matches.isEmpty { continue }
        guard matches.count == 1 else { throw usersFixtureFailure("Ambiguous task-email results are retained without deletion.") }
        try validate(matches[0], identity: identity)
        ids[identity.email] = try positiveID(matches[0]["id"])
        try persistRecord()
      }
      let id = try requiredID(identity)
      try await verifyProtectedAccounts()
      var row = try await detail(id)
      try validate(row, identity: identity)
      if row["deleted_at"] is NSNull {
        try await remove(id, version: version(row), force: false)
        row = try await detail(id)
        try validate(row, identity: identity)
      }
      guard row["deleted_at"] is String else { throw usersFixtureFailure("Force cleanup requires the exact task user's confirmed soft-deleted state.") }
      try await remove(id, version: version(row), force: true)
      _ = try await request("/api/v1/admin/users/\(id)", expected: 404)
      guard try await list(query: identity.email, trashed: "with").isEmpty else { throw usersFixtureFailure("The exact task user remains after cleanup.") }
      cleaned.insert(id)
      try persistRecord()
    }
    if let recordURL, FileManager.default.fileExists(atPath: recordURL.path) { try FileManager.default.removeItem(at: recordURL) }
  }
  func verifyReadOnlyProbeUnchanged() async throws {
    guard ids.isEmpty, cleaned.isEmpty, !baseline.isEmpty else { throw usersFixtureFailure("The read-only name probe must never adopt a created user ID.") }
    for identity in identities { try await expectAbsent(identity) }
    try await verifyProtectedAccounts()
  }
  func closeReadOnlyProbe() async throws {
    defer { session?.invalidateAndCancel() }
    var failure: Error?
    do { if !baseline.isEmpty { try await verifyReadOnlyProbeUnchanged() } } catch { failure = error }
    if !token.isEmpty {
      // The diagnostic can only revoke its own minted observer session.
      do { _ = try await request("/api/v1/auth/logout", method: "POST", expected: 200); token = "" }
      catch { if failure == nil { failure = error } }
    }
    if failure == nil, let recordURL, FileManager.default.fileExists(atPath: recordURL.path) {
      do { try FileManager.default.removeItem(at: recordURL) } catch { failure = error }
    }
    if let failure { throw failure }
  }
  func cleanupAndClose() async throws {
    defer { session?.invalidateAndCancel() }
    var failure: Error?
    do { if !baseline.isEmpty { try await cleanupCreatedUsers() } } catch { failure = error }
    if !token.isEmpty {
      do { _ = try await request("/api/v1/auth/logout", method: "POST", expected: 200) } catch { if failure == nil { failure = error } }
    }
    if let failure { throw failure }
  }
  private func remove(_ id: Int, version: String, force: Bool) async throws {
    guard ids.values.contains(id), id > 104, !baseline.contains(id), !cleaned.contains(id) else { throw usersFixtureFailure("Refusing cleanup outside the exact task-created ID set.") }
    let bytes = try await request("/api/v1/admin/users/\(id)\(force ? "/force" : "")", method: "DELETE", expected: 200, body: ["version": version])
    let result = try object(bytes)
    guard result["success"] as? Bool == true, result["ids"] as? [Int] == [id], result["actor_deleted"] as? Bool == false else { throw usersFixtureFailure("The source must acknowledge exactly one non-actor cleanup ID.") }
  }
  private func validate(_ row: UsersFixtureObject, identity: UsersFixtureIdentity) throws {
    let id = try positiveID(row["id"])
    guard identities.contains(where: { $0.email == identity.email }), id > 104, !baseline.contains(id),
      row["email"] as? String == identity.email, identity.email.hasPrefix("native-users-\(identifier)-"), identity.email.hasSuffix("@native-fixture.invalid"),
      [identity.name, identity.editedName].contains(row["name"] as? String ?? ""), row["role"] as? String == "user", row["is_self"] as? Bool == false,
      ids[identity.email] == nil || ids[identity.email] == id else { throw usersFixtureFailure("Only the exact UUID-named, synthetic-domain, non-actor task user may be mutated or cleaned.") }
    _ = try version(row)
  }
  private func list(query: String, trashed: String) async throws -> [UsersFixtureObject] {
    var page = 1, last = 1, rows: [UsersFixtureObject] = []
    repeat {
      var url = URLComponents(string: origin + "/api/v1/admin/users")!
      url.queryItems = [URLQueryItem(name: "q", value: query), .init(name: "trashed", value: trashed), .init(name: "per_page", value: "100"), .init(name: "page", value: String(page))]
      let value = try await object(url.string!)
      guard let data = value["data"] as? [UsersFixtureObject], data.count <= 100, value["current_page"] as? Int == page,
        let lastPage = value["last_page"] as? Int, (1...10).contains(lastPage) else { throw usersFixtureFailure("A bounded real user paginator is required.") }
      rows += data; last = lastPage; page += 1
    } while page <= last
    return rows
  }
  private func detail(_ id: Int) async throws -> UsersFixtureObject {
    guard let user = try await object("/api/v1/admin/users/\(id)")["user"] as? UsersFixtureObject, try positiveID(user["id"]) == id else { throw usersFixtureFailure("The source user detail must match its exact requested ID.") }
    return user
  }
  private func positiveID(_ value: Any?) throws -> Int {
    guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(), number.doubleValue.isFinite,
      number.doubleValue.rounded() == number.doubleValue, number.int64Value > 0, number.int64Value <= 9_007_199_254_740_991 else { throw usersFixtureFailure("A positive safe server ID is required.") }
    return number.intValue
  }
  private func version(_ row: UsersFixtureObject) throws -> String {
    guard let value = row["version"] as? String, value.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { throw usersFixtureFailure("A fresh source version hash is required.") }
    return value
  }
  private func createRecord() throws {
    let directory = try XCTUnwrap(FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first).appendingPathComponent("SyrianZoneNativeUsers", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    guard try directory.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink != true else { throw usersFixtureFailure("Refusing a symlink in the private users fixture cache.") }
    try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: directory.path)
    recordURL = directory.appendingPathComponent(identifier).appendingPathExtension("json")
    try persistRecord()
  }
  private func persistRecord() throws {
    guard let recordURL else { return }
    let metadata: UsersFixtureObject = ["version": 1, "identifier": identifier, "names": identities.map(\.name), "editedNames": identities.map(\.editedName),
      "emails": identities.map(\.email), "baselineIDs": baseline.sorted(), "createdIDs": ids, "cleanedIDs": cleaned.sorted()]
    try JSONSerialization.data(withJSONObject: metadata).write(to: recordURL, options: [.atomic, .completeFileProtection])
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: recordURL.path)
  }
  private func object(_ path: String, headers: [String: String] = [:], authenticated: Bool = true) async throws -> UsersFixtureObject {
    try object(await request(path, expected: 200, headers: headers, authenticated: authenticated))
  }
  private func object(_ bytes: Data) throws -> UsersFixtureObject {
    guard let value = try JSONSerialization.jsonObject(with: bytes) as? UsersFixtureObject else { throw usersFixtureFailure("The actual source response must be a JSON object.") }
    return value
  }
  private func request(_ path: String, method: String = "GET", expected: Int, body: UsersFixtureObject? = nil,
    headers: [String: String] = [:], authenticated: Bool = true) async throws -> Data {
    guard let url = URL(string: path, relativeTo: URL(string: origin))?.absoluteURL, let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
      parts.scheme == "https", parts.host == "127.0.0.1", parts.port == 9443, parts.user == nil, parts.password == nil, parts.fragment == nil,
      method == "GET" || method == "DELETE" && parts.path.hasPrefix("/api/v1/admin/users/") || method == "POST" && parts.path == "/api/v1/auth/logout" else { throw usersFixtureFailure("HTTP helpers may only observe the exact local fixture, revoke their own token, and clean recorded IDs.") }
    var request = URLRequest(url: url); request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Accept"); request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
    if authenticated { guard !token.isEmpty else { throw usersFixtureFailure("A verified local token is required.") }; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    for (key, value) in headers { request.setValue(value, forHTTPHeaderField: key) }
    if let body { request.setValue("application/json", forHTTPHeaderField: "Content-Type"); request.httpBody = try JSONSerialization.data(withJSONObject: body) }
    let (bytes, response) = try await session.data(for: request)
    guard let response = response as? HTTPURLResponse, response.url == url, response.statusCode == expected, bytes.count <= 2_000_000 else { throw usersFixtureFailure("The actual bounded loopback response did not confirm the expected status.") }
    return bytes
  }
}
