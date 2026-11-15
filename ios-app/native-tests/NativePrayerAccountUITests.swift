import Foundation
import XCTest

// Requires the separately reviewed prayer-sync fixture variant and exact local restore entry.
// Synthetic times enable tracking controls. Actual account writes use the shipping toggle caller.
final class NativePrayerAccountUITests: LocalFixtureTestCase {
  @MainActor
  func testPrayerNativeMarkColdReopenActiveAccountWritesAndExactRestore() async throws {
    let run = try PrayerAccountRun(environment: ProcessInfo.processInfo.environment)
    let proof = PrayerLocalCleanupProof()
    let backend = PrayerAccountBackend(run: run, proof: proof)
    addTeardownBlock { try await backend.cleanupAndClose() }
    try await backend.prepareAndArm()
    let lifetime = PrayerAccountLifetime(run: run, proof: proof)
    addTeardownBlock { () throws -> Void in
      guard Thread.isMainThread else { throw prayerAccountFailure("Owned Prayer cleanup requires XCTest's main thread.") }
      try MainActor.assumeIsolated { try lifetime.restoreLocalAndTerminate() }
    }

    var app = try launchPrayer("member", id: 101, run: run, lifetime: lifetime)
    try verifySettingsAndDTO(app, run: run)
    try await backend.intent(1)
    try setPrayer("الفجر", from: "0", to: "1", app: app, run: run)
    try await backend.checkpoint(1)
    try capture("prayer-101-native-mark-server-102-untouched", phase: 1, run: run, app: app)
    app = try launchPrayer("member", id: 101, run: run, lifetime: lifetime)
    try verifySettingsAndDTO(app, run: run)
    try requirePrayer("الفجر", value: "1", app: app)
    try requireSummary(1, app: app)
    try capture("prayer-101-cold-reopen-retains-mark", phase: 1, run: run, app: app)
    try await backend.intent(2)
    try setPrayer("الفجر", from: "1", to: "0", app: app, run: run)
    try await backend.checkpoint(2)

    // Source parity: the same device's explicit false record is OR-merged on login.
    // This proves active-account write ownership, not a per-user device-log namespace.
    try await backend.intent(3)
    app = try launchPrayer("other", id: 102, run: run, lifetime: lifetime)
    try verifySettingsAndDTO(app, run: run)
    try requirePrayer("الفجر", value: "0", app: app)
    try requireSummary(0, app: app)
    try await backend.checkpoint(3)
    try await backend.intent(4)
    try setPrayer("الظهر", from: "0", to: "1", app: app, run: run)
    try await backend.checkpoint(4)
    try capture("prayer-102-native-mark-server-101-untouched", phase: 4, run: run, app: app)
    app = try launchPrayer("other", id: 102, run: run, lifetime: lifetime)
    try verifySettingsAndDTO(app, run: run)
    try requirePrayer("الظهر", value: "1", app: app)
    try requireSummary(1, app: app)
    try await backend.intent(5)
    try setPrayer("الظهر", from: "1", to: "0", app: app, run: run)
    try await backend.checkpoint(5)
    try capture("prayer-both-native-unmarks-confirmed", phase: 5, run: run, app: app)

    try lifetime.restoreLocalAndTerminate()
    try await backend.cleanupAndClose()
    let limits = XCTAttachment(string: "Actual native account settings writes, current Damascus-day tracking, cold relaunch persistence and active-account write ownership only. Times are an explicitly synthetic HTTP DTO from the existing server test payload. Source shared-device OR merge is expected. No live provider accuracy, normal public metadata rollout, foreign timezone, forced midnight, GPS, system clock or broad settings clear is proved.")
    limits.name = "prayer-account-verification-limits"; limits.lifetime = .keepAlways; add(limits)
  }

  @MainActor
  private func launchPrayer(_ user: String, id: Int, run: PrayerAccountRun, lifetime: PrayerAccountLifetime) throws -> XCUIApplication {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    lifetime.own(app)
    app.terminate(); app.open(try run.url(user: user))
    dismissOwnPrompt()
    assertLocal(app, user: user, id: id)
    let local = app.staticTexts["account.fixture.prayer.local"]
    try require(wait { self.marker(local, nonce: run.nonce, day: run.day)?["ready"] as? Bool == true && self.marker(local, nonce: run.nonce, day: run.day)?["journalVersion"] as? Int == 2 }, "The exact local snapshot must be verified before the product mounts.", app: app)
    try require(app.buttons["إعدادات الرئيسية"].waitForExistence(timeout: 20), "Real app navigation must mount before the first Prayer hot link.", app: app)
    open("muslim_prayer", app: app)
    try require(app.staticTexts["مواقيت الصلاة"].firstMatch.waitForExistence(timeout: 15), "The real Prayer feature must open through native Linking.", app: app)
    return app
  }

  @MainActor
  private func verifySettingsAndDTO(_ app: XCUIApplication, run: PrayerAccountRun) throws {
    try run.requireDay()
    let dto = app.staticTexts["account.fixture.prayer.times"]
    try require(wait {
      guard let value = self.marker(dto, nonce: run.nonce, day: run.day) else { return false }
      return dto.label == "LOCAL SYNTHETIC PRAYER TIMES" && (value["reads"] as? Int ?? 0) > 0
        && value["date"] as? String == run.day && value["timezone"] as? String == "Asia/Damascus"
        && value["governorate"] as? String == "damascus" && value["method"] as? Int == 3
    }, "A positive exact selected-day synthetic DTO read must precede tracking.", app: app)
    tap("إعدادات المواقيت", app: app)
    let mode = app.buttons["مصدر الموقع"].firstMatch
    try require(mode.waitForExistence(timeout: 10) && mode.value as? String == "مدينة يدوية", "Preserve the existing manual location mode.", app: app)
    try require(app.buttons["المدينة"].firstMatch.value as? String == "دمشق"
      && app.buttons["طريقة الحساب"].firstMatch.value as? String == "رابطة العالم الإسلامي", "Require Damascus and method three without changing location or method.", app: app)
    let sheets = app.scrollViews.containing(.button, identifier: "مصدر الموقع")
    try require(sheets.count == 1 && sheets.firstMatch.buttons.matching(identifier: "تم").count == 1, "Close only the actual Prayer settings sheet.", app: app)
    let done = sheets.firstMatch.buttons["تم"]
    reveal(done, app: app); try require(done.isHittable, "The source settings Done control must be visible.", app: app)
    done.tap()
    try require(wait { !mode.exists }, "The settings sheet must finish dismissing before a log control is used.", app: app)
    try require(app.switches.matching(NSPredicate(format: "label BEGINSWITH %@", "تمت صلاة ")).count == 5
      && !app.switches["تمت صلاة الشروق"].exists, "Only the five Source tracked prayers may be marked.", app: app)
  }

  @MainActor
  private func setPrayer(_ label: String, from: String, to: String, app: XCUIApplication, run: PrayerAccountRun) throws {
    try run.requireDay()
    let toggle = try requirePrayer(label, value: from, app: app)
    reveal(toggle, app: app)
    let owners = app.scrollViews.containing(.switch, identifier: "تمت صلاة \(label)").allElementsBoundByIndex.filter { !$0.frame.intersection(app.frame).isEmpty }
    try require(owners.count == 1 && toggle.isEnabled && toggle.isHittable && !toggle.frame.isEmpty
      && owners[0].frame.intersection(app.frame).insetBy(dx: 0, dy: 8).contains(toggle.frame), "The exact Prayer switch must be fully contained and genuinely exposed.", app: app)
    // Native-controls10 and Civic proved this physical RTL track activation.
    toggle.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0.5))
      .withOffset(CGVector(dx: min(CGFloat(31), toggle.frame.width / 2), dy: 0)).tap()
    try require(wait { toggle.value as? String == to }, "The real native toggle must adopt its changed completion value.", app: app)
    try requireSummary(to == "1" ? 1 : 0, app: app)
    try run.requireDay()
  }

  @MainActor @discardableResult
  private func requirePrayer(_ label: String, value: String, app: XCUIApplication) throws -> XCUIElement {
    let toggles = app.switches.matching(identifier: "تمت صلاة \(label)")
    try require(toggles.firstMatch.waitForExistence(timeout: 15) && toggles.count == 1, "Require exactly the selected Source Prayer switch.", app: app)
    try require(wait { toggles.firstMatch.value as? String == value }, "Keep the exact expected completion state.", app: app)
    return toggles.firstMatch
  }

  @MainActor
  private func requireSummary(_ completed: Int, app: XCUIApplication) throws {
    try require(wait { app.staticTexts["\(completed)/5 صلوات منجزة اليوم"].firstMatch.exists }, "The visible current-day completion total must follow the actual marks.", app: app)
  }

  @MainActor
  private func marker(_ element: XCUIElement, nonce: String, day: String) -> [String: Any]? {
    guard element.exists, let raw = element.value as? String, let data = raw.data(using: .utf8), data.count < 2048,
      let row = try? JSONSerialization.jsonObject(with: data) as? [String: Any], row["nonce"] as? String == nonce, row["day"] as? String == day else { return nil }
    return row
  }

  @MainActor
  private func wait(_ condition: @escaping () -> Bool) -> Bool {
    XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in condition() }, object: nil)], timeout: 15) == .completed
  }

  @MainActor
  private func require(_ condition: Bool, _ message: String, app: XCUIApplication) throws {
    guard condition else {
      let tree = XCTAttachment(string: app.debugDescription)
      tree.name = "prayer-account-failure-AX"; tree.lifetime = .keepAlways; add(tree)
      let screenshot = XCTAttachment(screenshot: app.screenshot())
      screenshot.name = "prayer-account-failure"; screenshot.lifetime = .keepAlways; add(screenshot)
      throw prayerAccountFailure(message)
    }
  }

  @MainActor
  private func capture(_ name: String, phase: Int, run: PrayerAccountRun, app: XCUIApplication) throws {
    let evidence: [String: Any] = ["nonce": run.nonce, "day": run.day, "phase": phase, "syntheticTimes": true,
      "completion": ["Fajr": app.switches["تمت صلاة الفجر"].firstMatch.value as? String as Any? ?? NSNull(),
        "Dhuhr": app.switches["تمت صلاة الظهر"].firstMatch.value as? String as Any? ?? NSNull()]]
    let metadata = XCTAttachment(data: try JSONSerialization.data(withJSONObject: evidence, options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
    metadata.name = name + "-state"; metadata.lifetime = .keepAlways; add(metadata)
    let image = XCTAttachment(screenshot: app.screenshot()); image.name = name; image.lifetime = .keepAlways; add(image)
  }
}

private func prayerAccountFailure(_ message: String) -> NSError { NSError(domain: "NativePrayerAccountFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
private struct PrayerAccountRun: Sendable {
  let nonce = UUID().uuidString
  let day: String
  let gate: String
  init(environment: [String: String]) throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == "zone.syrian.ios.uitests.xctrunner", environment["SIMULATOR_UDID"] != nil,
      environment["SZ_NATIVE_FIXTURE_PRESERVE_PRAYER_STATE"] == "1",
      environment["SZ_NATIVE_FIXTURE_ORIGIN"] == "https://127.0.0.1:9443", let key = environment["SZ_NATIVE_FIXTURE_GATE"],
      key.range(of: "^[A-Za-z0-9_-]{16,256}$", options: .regularExpression) != nil else { throw prayerAccountFailure("Only the exact private local Simulator fixture may track prayers.") }
    gate = key; day = Self.today()
    #else
    throw XCTSkip("The Prayer account fixture refuses physical devices and other origins.")
    #endif
  }
  static func today() -> String {
    let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.calendar = Calendar(identifier: .gregorian)
    formatter.timeZone = TimeZone(identifier: "Asia/Damascus"); formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: Date())
  }
  func requireDay() throws { guard day == Self.today() else { throw prayerAccountFailure("The current-day test crossed Damascus midnight. Restore the exact journaled day and retry.") } }
  func url(user: String? = nil) throws -> URL {
    var parts = URLComponents(); parts.scheme = "syrianzone"; parts.host = "fixture"
    parts.path = user == nil ? "/prayer-sync-restore" : "/session"
    parts.queryItems = user.map { [URLQueryItem(name: "user", value: $0), URLQueryItem(name: "variant", value: "prayer-sync")] } ?? []
    parts.queryItems?.append(contentsOf: [URLQueryItem(name: "run", value: nonce), URLQueryItem(name: "day", value: day)])
    parts.fragment = gate
    return try XCTUnwrap(parts.url)
  }
}

private final class PrayerLocalCleanupProof: @unchecked Sendable {
  private let lock = NSLock(); private var value = false
  func complete() { lock.lock(); value = true; lock.unlock() }
  func restored() -> Bool { lock.lock(); defer { lock.unlock() }; return value }
}

@MainActor private final class PrayerAccountLifetime {
  private let run: PrayerAccountRun, proof: PrayerLocalCleanupProof
  private var app: XCUIApplication?
  init(run: PrayerAccountRun, proof: PrayerLocalCleanupProof) { self.run = run; self.proof = proof }
  func own(_ value: XCUIApplication) { app = value }
  func restoreLocalAndTerminate() throws {
    if proof.restored() { app?.terminate(); return }
    let current = app ?? XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    current.terminate(); defer { current.terminate() }
    current.open(try run.url())
    for bundle in ["zone.syrian.ios", "com.apple.springboard"] {
      let open = XCUIApplication(bundleIdentifier: bundle).buttons["Open"].firstMatch
      if open.exists { open.tap(); break }
    }
    let marker = current.staticTexts["account.fixture.prayer.local"]
    let restored = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      guard marker.exists, let raw = marker.value as? String, let data = raw.data(using: .utf8), data.count < 2048,
        let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return false }
      return value["nonce"] as? String == self.run.nonce && value["day"] as? String == self.run.day
        && value["journalVersion"] as? Int == 2 && value["restored"] as? Bool == true && value["serverRestored"] as? Bool == true
    }, object: marker)
    guard XCTWaiter.wait(for: [restored], timeout: 25) == .completed else {
      throw prayerAccountFailure("Exact local Prayer restoration was not confirmed. Private journals are retained for review.")
    }
    proof.complete()
  }
}

private final class PrayerAccountBackend: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  private let run: PrayerAccountRun, proof: PrayerLocalCleanupProof
  private var session: URLSession!, tokens: [String] = []
  private var armed = false, closed = false
  init(run: PrayerAccountRun, proof: PrayerLocalCleanupProof) {
    self.run = run; self.proof = proof; super.init()
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieStorage = nil; configuration.httpShouldSetCookies = false; configuration.urlCredentialStorage = nil; configuration.urlCache = nil
    configuration.timeoutIntervalForRequest = 15; configuration.timeoutIntervalForResource = 20
    session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
  func prepareAndArm() async throws {
    for (user, id, names) in [("member", 101, ["مستخدم اختبار محلي", "مستخدم تحقق محلي"]), ("other", 102, ["مستخدم اختبار ثان"])] {
      let access = try await request("/__native_fixture/session?user=\(user)", gate: true)
      guard access["origin"] as? String == "https://127.0.0.1:9443", let token = access["token"] as? String,
        token.range(of: "^[0-9]+\\|[A-Za-z0-9_-]{16,256}$", options: .regularExpression) != nil else { throw prayerAccountFailure("The exact private account session is required.") }
      tokens.append(token)
      let profile = try await request("/api/v1/user", token: token)
      guard profile["id"] as? Int == id, names.contains(profile["name"] as? String ?? ""), profile["email"] as? String == "\(user)@native-fixture.invalid",
        profile["role"] as? String == "user", profile["is_banned"] as? Bool == false else { throw prayerAccountFailure("Both canonical local accounts must be confirmed before arming.") }
    }
    try run.requireDay()
    let arm = try await control("arm")
    guard arm["journalVersion"] as? Int == 2, arm["phase"] as? Int == 0, arm["pending"] is NSNull, arm["restored"] as? Bool == false else { throw prayerAccountFailure("Only a fresh exact phase-zero journal may arm the case.") }
    armed = true
  }
  func intent(_ index: Int) async throws {
    try run.requireDay()
    let next = try await control("intent", index: index)
    guard next["phase"] as? Int == index - 1, next["pending"] as? Int == index, next["restored"] as? Bool == false else {
      throw prayerAccountFailure("The next exact native action must be durably armed before its tap.")
    }
  }
  func checkpoint(_ index: Int) async throws {
    let deadline = Date().addingTimeInterval(15)
    repeat {
      try run.requireDay()
      let response = try await control("checkpoint", index: index, allowRefusal: true)
      if response["ok"] as? Bool == true {
        guard response["phase"] as? Int == index, response["pending"] is NSNull, response["restored"] as? Bool == false else {
          throw prayerAccountFailure("The exact completed phase must be confirmed after its real account write.")
        }
        return
      }
      try await Task.sleep(nanoseconds: 200_000_000)
    } while Date() < deadline
    throw prayerAccountFailure("The real account writes did not reach their exact predeclared current-day state.")
  }
  func cleanupAndClose() async throws {
    if closed { return }
    defer { session.invalidateAndCancel() }
    var failure: Error?
    if armed {
      do {
        let restored = try await control("restore")
        guard restored["restored"] as? Bool == true, restored["phase"] as? Int == 0, restored["pending"] is NSNull else { throw prayerAccountFailure("Exact original server field presence was not restored.") }
        guard proof.restored() else { throw prayerAccountFailure("Local restoration is unproved. Keep the restored server journal for review.") }
        let close = try await control("close")
        guard close["closed"] as? Bool == true else { throw prayerAccountFailure("The exact restored server journal was not closed.") }
        armed = false
      } catch { failure = error }
    }
    for token in tokens {
      do { _ = try await request("/api/v1/auth/logout", token: token, method: "POST") }
      catch { if failure == nil { failure = error } }
    }
    tokens = []; closed = failure == nil
    if let failure { throw failure }
  }
  private func control(_ action: String, index: Int? = nil, allowRefusal: Bool = false) async throws -> [String: Any] {
    var command: [String: Any] = ["nonce": run.nonce, "day": run.day, "action": action]
    if let index { command["index"] = index }
    return try await request("/__native_fixture/prayer-sync", gate: true, method: "POST", body: command, allowRefusal: allowRefusal)
  }
  private func request(_ path: String, token: String? = nil, gate: Bool = false, method: String = "GET", body: [String: Any]? = nil,
    allowRefusal: Bool = false) async throws -> [String: Any] {
    let origin = "https://127.0.0.1:9443"
    guard let url = URL(string: origin + path), let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
      parts.scheme == "https", parts.host == "127.0.0.1", parts.port == 9443, parts.user == nil, parts.password == nil, parts.fragment == nil else {
      throw prayerAccountFailure("Prayer fixture requests must remain on the exact loopback HTTPS origin.")
    }
    let provision = method == "GET" && gate && token == nil && parts.path == "/__native_fixture/session" && ["user=member", "user=other"].contains(parts.query ?? "")
    let profile = method == "GET" && !gate && token != nil && parts.path == "/api/v1/user" && parts.query == nil
    let revoke = method == "POST" && !gate && token != nil && parts.path == "/api/v1/auth/logout" && parts.query == nil && body == nil
    let control = method == "POST" && gate && token == nil && parts.path == "/__native_fixture/prayer-sync" && parts.query == nil && body != nil
    guard provision || profile || revoke || control else { throw prayerAccountFailure("The observer cannot write feature settings or access another user/service.") }
    var request = URLRequest(url: url); request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
    if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    if gate { request.setValue(run.gate, forHTTPHeaderField: "X-Native-Fixture-Key") }
    if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
    let (bytes, response) = try await session.data(for: request)
    guard let response = response as? HTTPURLResponse, response.url == url, bytes.count < 4096,
      response.statusCode == 200 || allowRefusal && response.statusCode == 409,
      let result = try JSONSerialization.jsonObject(with: bytes) as? [String: Any] else { throw prayerAccountFailure("The exact fixture request must confirm its bounded JSON response.") }
    if control, response.statusCode == 200 {
      guard response.value(forHTTPHeaderField: "X-Native-Prayer-Journal-Version") == "2", result["journalVersion"] as? Int == 2, result["ok"] as? Bool == true, result["nonce"] as? String == run.nonce, result["day"] as? String == run.day else { throw prayerAccountFailure("The exact nonce/day acknowledgement is required.") }
    }
    return result
  }
}
