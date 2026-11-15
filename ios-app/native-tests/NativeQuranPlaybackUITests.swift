import Foundation
import XCTest

// Real public Quran metadata/media, real App/AudioProvider, local user 102 usage only.
// The short native deadline's expiration is covered separately by the bare adapter.
final class NativeQuranPlaybackUITests: LocalFixtureTestCase {
  @MainActor
  func testRealProviderQueueReciterBackgroundReaderAndLocalUsage() async throws {
    let backend = try QuranPlaybackFixture(environment: ProcessInfo.processInfo.environment)
    let lifetime = QuranFixtureAppLifetime()
    addTeardownBlock { try await backend.restoreAndClose() }
    // XCTest runs teardown blocks in reverse registration order.
    addTeardownBlock { () throws -> Void in
      guard Thread.isMainThread else { throw quranFixtureFailure("Owned Quran app teardown requires XCTest's documented main thread.") }
      MainActor.assumeIsolated { lifetime.terminateOwnedFixture() }
    }
    try await backend.prepare()
    let timing = try await backend.husaryTimings()
    lifetime.own(XCUIApplication(bundleIdentifier: "zone.syrian.ios"))
    var app = try launch("other", id: 102)
    XCTAssertTrue(app.staticTexts["audio.fixture.owner"].waitForExistence(timeout: 10))
    XCTAssertEqual(app.staticTexts["audio.fixture.owner"].label, "REAL AudioProvider / SyrianAudio, native track generation")
    open("muslim_radio", app: app)
    XCTAssertTrue(app.staticTexts["إذاعة القرآن"].firstMatch.waitForExistence(timeout: 15))
    try clearUsage(app)
    _ = try await backend.waitForUsage { $0.seconds == 0 && $0.bytes == 0 }
    try await chooseReciter(code: "mahmoud-husary/r1", arabic: "محمود خليل الحصري (مرتل)", english: "Husary (Murattal)", backend: backend, app: app)

    assertLocal(app, user: "other", id: 102)
    tap("تشغيل", app: app)
    let first = try waitAudio(app) { $0.playing && $0.loaded && $0.duration > 30 }
    try assertMetadata("mahmoud-husary/r1", app: app)
    try await Task.sleep(nanoseconds: 1_500_000_000)
    tap("إيقاف مؤقت", app: app)
    let paused = try waitAudio(app) { !$0.playing && !$0.loading && $0.loaded }
    XCTAssertGreaterThan(paused.listenedSeconds, first.listenedSeconds + 0.5)
    let firstUsage = try await backend.waitForUsage { $0.seconds > 0 }
    XCTAssertEqual(firstUsage.bytes, firstUsage.seconds * 16000, "The source reports estimated usage, not transferred media bytes.")

    // The initial Radio route was pushed from Home. Exercise the real native pop.
    let radioBars = app.navigationBars.matching(identifier: "إذاعة القرآن")
    let backButtons = radioBars.buttons.matching(NSPredicate(format: "label == %@", "رجوع"))
    guard radioBars.count == 1, backButtons.count == 1 else {
      throw quranFixtureFailure("The initial Radio navigation bar must contain exactly one normal Back button.")
    }
    let back = backButtons.firstMatch
    guard back.isEnabled, back.isHittable, !back.frame.isEmpty, app.frame.contains(back.frame) else {
      throw quranFixtureFailure("The normal Radio Back button must be fully visible and ready before returning to Home.")
    }
    back.tap()
    XCTAssertTrue(app.buttons["إعدادات الرئيسية"].waitForExistence(timeout: 15), "The native Back action must reveal the exact Home toolbar.")
    let startAyah = try miniAyah(app)
    guard startAyah < 7 else { throw quranFixtureFailure("The short initial sample must remain before the final Fatiha ayah.") }
    try openMini(app)
    tap("الآية التالية", app: app)
    XCTAssertTrue(app.buttons["إيقاف مؤقت"].firstMatch.waitForExistence(timeout: 15))
    tap("إيقاف مؤقت", app: app)
    tap("تم", app: app)
    let advanced = try waitAudio(app) { !$0.playing && !$0.loading && $0.trackGeneration > paused.trackGeneration }
    XCTAssertEqual(try miniAyah(app), startAyah + 1)
    let expectedStart = try XCTUnwrap(timing[startAyah + 1])
    XCTAssertGreaterThanOrEqual(advanced.seconds, expectedStart - 0.3)
    XCTAssertLessThan(advanced.seconds, expectedStart + 5)
    try openMini(app)
    tap("الآية السابقة", app: app)
    XCTAssertTrue(app.buttons["إيقاف مؤقت"].firstMatch.waitForExistence(timeout: 15))
    tap("إيقاف مؤقت", app: app)
    tap("تم", app: app)
    let reversed = try waitAudio(app) { !$0.playing && !$0.loading && $0.trackGeneration > advanced.trackGeneration }
    XCTAssertEqual(try miniAyah(app), startAyah)
    XCTAssertLessThan(reversed.seconds, expectedStart)
    capture("quran-real-surah-native-mini-player-queue", app: app)

    try openMini(app)
    tap("الانتقال إلى الراديو", app: app)
    XCTAssertTrue(app.staticTexts["إذاعة القرآن"].firstMatch.waitForExistence(timeout: 10))
    try await chooseReciter(code: "mishary-alafasy/r1", arabic: "مشاري العفاسي", english: "Alafasy", backend: backend, app: app)
    tap("تشغيل", app: app)
    let beforeBackground = try waitAudio(app) { $0.playing && $0.loaded && $0.duration > 30 && $0.trackGeneration > reversed.trackGeneration }
    try assertMetadata("mishary-alafasy/r1", app: app)
    XCUIDevice.shared.press(.home)
    XCTAssertTrue(app.wait(for: .runningBackground, timeout: 5), "The normal Home action must finish placing the playing app in its exact running-background state.")
    let enteredBackground = Date()
    try await Task.sleep(nanoseconds: 4_000_000_000)
    let activating = Date()
    app.activate()
    let afterBackground = try waitAudio(app) { $0.playing && $0.listenedSeconds >= beforeBackground.listenedSeconds + 3 }
    let foregroundBudget = max(0, enteredBackground.timeIntervalSince1970 - beforeBackground.observedAt / 1000) + Date().timeIntervalSince(activating)
    XCTAssertEqual(afterBackground.trackGeneration, beforeBackground.trackGeneration, "Navigation/background must retain the same native track generation.")
    XCTAssertGreaterThanOrEqual(afterBackground.listenedSeconds - beforeBackground.listenedSeconds, foregroundBudget + 2, "Foreground playback cannot satisfy the background listening proof.")
    XCTAssertGreaterThanOrEqual(afterBackground.seconds - beforeBackground.seconds, foregroundBudget + 2, "The media clock must advance while backgrounded, not only after activation.")
    tap("إيقاف مؤقت", app: app)
    _ = try waitAudio(app) { !$0.playing && !$0.loading }

    // Use the shipping fifteen-minute preset. Do not inject a shorter timer or change the clock.
    assertLocal(app, user: "other", id: 102)
    tap("مدة مؤقت النوم", app: app)
    tap("١٥ دقيقة", app: app)
    let preset = try waitAudio(app) { $0.sleepUntil != nil }
    let deadline = try XCTUnwrap(preset.sleepUntil)
    XCTAssertEqual(deadline / 1000 - Date().timeIntervalSince1970, 900, accuracy: 15)
    try backFromRadioToHome(app)
    let acrossNavigation = try waitAudio(app) { $0.sleepUntil == deadline }
    XCTAssertEqual(acrossNavigation.trackGeneration, preset.trackGeneration)
    try openMini(app)
    tap("الانتقال إلى الراديو", app: app)
    tap("مدة مؤقت النوم", app: app)
    tap("بدون", app: app)
    _ = try waitAudio(app) { $0.sleepUntil == nil }

    tap("أكمل في القارئ", app: app)
    let ayah = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "سورة 1، آية ")).firstMatch
    XCTAssertTrue(ayah.waitForExistence(timeout: 30))
    assertLocal(app, user: "other", id: 102)
    tap("تشغيل", app: app)
    let reader = try waitAudio(app) { $0.playing && $0.loaded && $0.trackGeneration > acrossNavigation.trackGeneration }
    XCTAssertTrue(app.buttons["إيقاف مؤقت"].firstMatch.exists)
    XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "تقدم تلاوة الآية").firstMatch.exists)
    capture("quran-real-provider-reader-owned-playback", app: app)
    tap("إيقاف مؤقت", app: app)
    _ = try waitAudio(app) { !$0.playing && !$0.loading }
    try backFromReaderToHome(app)
    XCTAssertFalse(miniButton(app).exists, "The continuous mini player must be hidden while the reader owns the queue.")
    open("muslim_radio", app: app)
    tap("تشغيل", app: app)
    _ = try waitAudio(app) { $0.playing && $0.loaded && $0.trackGeneration > reader.trackGeneration }
    try backFromRadioToHome(app)
    try openMini(app)
    tap("إيقاف التلاوة", app: app)
    let stopped = try waitAudio(app) { !$0.playing && !$0.loaded && $0.duration == 0 && $0.sleepUntil == nil }
    XCTAssertFalse(miniButton(app).exists)
    let total = try await backend.waitForUsage { $0.seconds >= firstUsage.seconds + 3 }
    XCTAssertEqual(total.bytes, total.seconds * 16000)
    XCTAssertLessThanOrEqual(Double(total.seconds), stopped.listenedSeconds + 1)

    // A cold launch uses normal AccountProvider and device preferences, not an injected player.
    lifetime.own(XCUIApplication(bundleIdentifier: "zone.syrian.ios"))
    app = try launch("other", id: 102)
    open("muslim_radio", app: app)
    XCTAssertTrue(app.buttons["القارئ: مشاري العفاسي"].firstMatch.waitForExistence(timeout: 15))
    XCTAssertTrue(app.buttons["تشغيل"].firstMatch.exists)
    XCTAssertFalse(app.buttons["إيقاف مؤقت"].exists)
    _ = try await backend.waitForUsage { $0.seconds >= total.seconds }
    capture("quran-real-account-reciter-and-usage-after-relaunch", app: app)
    open("account", app: app)
    assertLocal(app, user: "other", id: 102)
    tap("تسجيل الخروج", app: app)
    XCTAssertTrue(app.buttons["تسجيل الدخول"].firstMatch.waitForExistence(timeout: 15))
  }

  @MainActor
  private func tapQuranNavigationBack(_ title: String, app: XCUIApplication) throws {
    guard ["إذاعة القرآن", "قارئ القرآن"].contains(title) else { throw quranFixtureFailure("Unknown Quran Back route rejected.") }
    let bars = app.navigationBars.matching(identifier: title)
    let buttons = bars.buttons.matching(NSPredicate(format: "label == %@", "رجوع"))
    guard bars.count == 1, buttons.count == 1 else {
      throw quranFixtureFailure("The exact expected Quran navigation bar must contain one normal Back button.")
    }
    let back = buttons.firstMatch, frame = back.frame
    guard [frame.minX, frame.minY, frame.width, frame.height].allSatisfy({ $0.isFinite }),
      !frame.isEmpty, app.frame.contains(frame), back.isEnabled, back.isHittable else {
      throw quranFixtureFailure("The expected Quran Back button must be completely visible and ready before its one normal tap.")
    }
    back.tap()
  }

  @MainActor
  private func backFromRadioToHome(_ app: XCUIApplication) throws {
    try tapQuranNavigationBack("إذاعة القرآن", app: app)
    let home = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      let toolbar = app.buttons.matching(identifier: "إعدادات الرئيسية")
      return app.navigationBars.matching(identifier: "إذاعة القرآن").count == 0
        && toolbar.count == 1 && toolbar.firstMatch.isEnabled && toolbar.firstMatch.isHittable
    }, object: app)
    guard XCTWaiter.wait(for: [home], timeout: 15) == .completed else {
      throw quranFixtureFailure("The normal Radio Back action must reveal the exact Home toolbar.")
    }
  }

  @MainActor
  private func backFromReaderToHome(_ app: XCUIApplication) throws {
    try tapQuranNavigationBack("قارئ القرآن", app: app)
    let radio = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      let bars = app.navigationBars.matching(identifier: "إذاعة القرآن")
      let back = bars.buttons.matching(NSPredicate(format: "label == %@", "رجوع"))
      return app.navigationBars.matching(identifier: "قارئ القرآن").count == 0
        && bars.count == 1 && back.count == 1 && back.firstMatch.isEnabled && back.firstMatch.isHittable
    }, object: app)
    guard XCTWaiter.wait(for: [radio], timeout: 15) == .completed else {
      throw quranFixtureFailure("The normal Reader Back action must reveal its exact underlying Radio route before returning Home.")
    }
    try backFromRadioToHome(app)
  }

  @MainActor
  private func clearUsage(_ app: XCUIApplication) throws {
    let clear = app.buttons["مسح السجل"].firstMatch
    XCTAssertTrue(clear.waitForExistence(timeout: 15))
    let enabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: clear)
    XCTAssertEqual(XCTWaiter.wait(for: [enabled], timeout: 10), .completed)
    assertLocal(app, user: "other", id: 102)
    tap("مسح السجل", app: app)
    let alert = app.alerts["مسح سجل استهلاك البيانات؟"].firstMatch
    XCTAssertTrue(alert.waitForExistence(timeout: 10))
    alert.buttons["مسح"].tap()
  }
  @MainActor
  private func chooseReciter(code: String, arabic: String, english: String, backend: QuranPlaybackFixture, app: XCUIApplication) async throws {
    let picker = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "القارئ: ")).firstMatch
    XCTAssertTrue(picker.waitForExistence(timeout: 15))
    reveal(picker, app: app); picker.tap()
    let search = app.textFields["ابحث عن قارئ بالعربية أو الإنجليزية"].firstMatch
    XCTAssertTrue(search.waitForExistence(timeout: 10))
    let rows = app.buttons.matching(NSPredicate(format: "label == %@", "\(arabic)، \(english)"))
    func diagnostic(_ phase: String) {
      let searchExists = search.exists
      let exactQuery = searchExists ? search.value as? String == english : false
      let states = rows.allElementsBoundByIndex.map { "frame=\($0.frame),enabled=\($0.isEnabled),hittable=\($0.isHittable)" }.joined(separator: ";")
      let attachment = XCTAttachment(string: "phase=\(phase); code=\(code); searchExists=\(searchExists); exactQuery=\(exactQuery); headingExists=\(app.staticTexts["اختيار القارئ"].firstMatch.exists); matchingRows=\(rows.count); keyboardExists=\(app.keyboards.firstMatch.exists); rows=[\(states)]")
      attachment.name = "quran-reciter-choice-precondition"; attachment.lifetime = .keepAlways; add(attachment)
    }
    replace(search, with: english)
    XCTAssertEqual(search.value as? String, english)
    search.typeText("\n")
    let finished = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      !app.keyboards.firstMatch.exists && search.exists && search.value as? String == english
    }, object: app)
    guard await XCTWaiter.fulfillment(of: [finished], timeout: 5) == .completed else {
      diagnostic("search-not-finished")
      throw quranFixtureFailure("Finish the real exact reciter search before selecting its row.")
    }
    guard rows.count == 1 else {
      diagnostic("row-not-unique")
      throw quranFixtureFailure("The exact visible reciter row must be unique.")
    }
    let row = rows.firstMatch
    reveal(row, app: app)
    guard rows.count == 1, row.isEnabled, row.isHittable, !row.frame.isEmpty, app.frame.contains(row.frame) else {
      diagnostic("row-not-ready")
      throw quranFixtureFailure("The exact reciter row must be visible and hittable before its real tap.")
    }
    row.tap()
    let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      !search.exists && !app.staticTexts["اختيار القارئ"].firstMatch.exists && rows.count == 0
    }, object: app)
    guard await XCTWaiter.fulfillment(of: [dismissed], timeout: 8) == .completed else {
      diagnostic("callback-dismissal-unconfirmed")
      throw quranFixtureFailure("The real reciter tap must dismiss its picker before account persistence can be asserted.")
    }
    XCTAssertTrue(app.buttons["القارئ: \(arabic)"].firstMatch.waitForExistence(timeout: 15))
    try await backend.waitForReciter(code)
  }
  @MainActor
  private func miniButton(_ app: XCUIApplication) -> XCUIElement {
    app.buttons.matching(NSPredicate(format: "label MATCHES %@", #"الفاتحة، آية [1-7]"#)).firstMatch
  }
  @MainActor
  private func miniAyah(_ app: XCUIApplication) throws -> Int {
    let mini = miniButton(app)
    XCTAssertTrue(mini.waitForExistence(timeout: 10))
    guard let number = Int(mini.label.components(separatedBy: "آية ").last ?? ""), (1...7).contains(number) else { throw quranFixtureFailure("The real mini player must identify its current Fatiha ayah.") }
    return number
  }
  @MainActor
  private func openMini(_ app: XCUIApplication) throws {
    _ = try miniAyah(app)
    let mini = miniButton(app)
    reveal(mini, app: app); mini.tap()
    XCTAssertTrue(app.buttons["الانتقال إلى الراديو"].firstMatch.waitForExistence(timeout: 10))
  }
  @MainActor
  private func waitAudio(_ app: XCUIApplication, matches: (QuranNativeSnapshot) -> Bool) throws -> QuranNativeSnapshot {
    let status = app.staticTexts["audio.fixture.native"]
    let deadline = Date().addingTimeInterval(25)
    while Date() < deadline {
      if status.exists, let snapshot = try? QuranNativeSnapshot(status.label), matches(snapshot), !snapshot.failed { return snapshot }
      RunLoop.current.run(until: Date().addingTimeInterval(0.15))
    }
    throw quranFixtureFailure("The real native audio status did not reach the expected state. No simulated player status is accepted.")
  }
  @MainActor
  private func assertMetadata(_ code: String, app: XCUIApplication) throws {
    let label = app.staticTexts["audio.fixture.metadata"]
    XCTAssertTrue(label.waitForExistence(timeout: 10))
    guard let bytes = label.label.data(using: .utf8), let reads = try JSONSerialization.jsonObject(with: bytes) as? [String: Int],
      reads["/v4/recitations/\(code)/surahs/1"] == 200, reads["/v4/recitations/\(code)/surahs/1/ayah-timings"] == 200 else { throw quranFixtureFailure("Real successful source-provider metadata and ayah timings are required. EveryAyah fallback is not this proof.") }
  }
  @MainActor
  private func capture(_ name: String, app: XCUIApplication) {
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
  }
}

@MainActor private final class QuranFixtureAppLifetime {
  private var app: XCUIApplication?
  func own(_ value: XCUIApplication) { app = value }
  func terminateOwnedFixture() { if let app, app.state != .notRunning { app.terminate() } }
}
private struct QuranNativeSnapshot {
  let trackGeneration: Int
  let observedAt: Double
  let seconds: Double, duration: Double, listenedSeconds: Double
  let playing: Bool, loading: Bool, loaded: Bool, failed: Bool
  let sleepUntil: Double?
  init(_ json: String) throws {
    guard let bytes = json.data(using: .utf8), let row = try JSONSerialization.jsonObject(with: bytes) as? [String: Any], row["owner"] as? String == "SyrianAudio",
      let observedAt = row["observedAt"] as? Double, observedAt.isFinite, observedAt > 0,
      let generation = row["trackGeneration"] as? Int, generation > 0,
      let seconds = row["seconds"] as? Double, let duration = row["duration"] as? Double, let listened = row["listenedSeconds"] as? Double,
      [seconds, duration, listened].allSatisfy({ $0.isFinite && $0 >= 0 }), let playing = row["playing"] as? Bool,
      let loading = row["loading"] as? Bool, let loaded = row["loaded"] as? Bool, let failed = row["failed"] as? Bool else { throw quranFixtureFailure("A typed real native track status is required.") }
    self.observedAt = observedAt; self.trackGeneration = generation; self.seconds = seconds; self.duration = duration; self.listenedSeconds = listened
    self.playing = playing; self.loading = loading; self.loaded = loaded; self.failed = failed
    if let until = row["sleepUntil"] as? Double { guard until.isFinite && until > 0 else { throw quranFixtureFailure("The real sleep deadline is invalid.") }; sleepUntil = until }
    else if row["sleepUntil"] is NSNull { sleepUntil = nil }
    else { throw quranFixtureFailure("The real sleep deadline must be explicit.") }
  }
}
private typealias QuranFixtureObject = [String: Any]
private func quranFixtureFailure(_ message: String) -> NSError { NSError(domain: "NativeQuranPlaybackFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }

private final class QuranPlaybackFixture: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  struct Usage { let seconds: Int; let bytes: Int }
  private let origin = "https://127.0.0.1:9443"
  private let keys = ["quranReciterId", "quranRadioSeconds", "quranRadioBytes", "quranLastPage", "quranLastJuz", "quranPageAt"]
  private var token = "", gate = ""
  private var original: QuranFixtureObject?
  private var session: URLSession!
  init(environment: [String: String]) throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == "zone.syrian.ios.uitests.xctrunner", environment["SIMULATOR_UDID"] != nil,
      environment["SZ_NATIVE_FIXTURE_ORIGIN"] == origin, environment["SZ_NATIVE_FIXTURE_PUBLIC_QURAN"] == "1",
      let key = environment["SZ_NATIVE_FIXTURE_GATE"], key.range(of: "^[A-Za-z0-9_-]{16,256}$", options: .regularExpression) != nil else { throw quranFixtureFailure("Use the exact private Simulator account fixture with --public-quran. No production usage is permitted.") }
    gate = key
    super.init()
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieStorage = nil; configuration.httpShouldSetCookies = false; configuration.urlCredentialStorage = nil; configuration.urlCache = nil
    configuration.timeoutIntervalForRequest = 15; configuration.timeoutIntervalForResource = 20
    session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    #else
    throw XCTSkip("Quran playback verification refuses physical devices and unscoped account traffic.")
    #endif
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
  func prepare() async throws {
    let access = try await request("/__native_fixture/session?user=other", headers: ["X-Native-Fixture-Key": gate], authenticated: false)
    guard access["origin"] as? String == origin, let minted = access["token"] as? String,
      minted.range(of: #"^[0-9]+\|[A-Za-z0-9_-]{16,256}$"#, options: .regularExpression) != nil else { throw quranFixtureFailure("The real private fixture token is invalid.") }
    token = minted
    let settings = try await verifiedSettings()
    original = Dictionary(uniqueKeysWithValues: keys.map { ($0, settings[$0] ?? NSNull()) })
  }
  func husaryTimings() async throws -> [Int: Double] {
    let url = "https://api-staging.mp3quran.net/v4/recitations/mahmoud-husary/r1/surahs/1/ayah-timings"
    let payload = try await request(url, authenticated: false)
    guard let data = payload["data"] as? QuranFixtureObject, let rows = data["ayahs"] as? [[NSNumber]], rows.count == 7 else { throw quranFixtureFailure("Actual Fatiha provider timings are required for queue-seek checks.") }
    var starts: [Int: Double] = [:]
    for row in rows {
      guard row.count == 3, (1...7).contains(row[0].intValue), row[1].doubleValue.isFinite, row[1].doubleValue >= 0,
        row[2].doubleValue > row[1].doubleValue else { throw quranFixtureFailure("Invalid real provider ayah timing.") }
      starts[row[0].intValue] = row[1].doubleValue / 1000
    }
    guard starts.count == 7 else { throw quranFixtureFailure("Provider ayah timings must be unique.") }
    return starts
  }
  func waitForReciter(_ code: String) async throws {
    let deadline = Date().addingTimeInterval(15)
    while Date() < deadline {
      if try await verifiedSettings()["quranReciterId"] as? String == code { return }
      try await Task.sleep(nanoseconds: 200_000_000)
    }
    throw quranFixtureFailure("The real native reciter choice was not saved by the local account API.")
  }
  func waitForUsage(_ matches: (Usage) -> Bool) async throws -> Usage {
    let deadline = Date().addingTimeInterval(15)
    while Date() < deadline {
      let settings = try await verifiedSettings()
      let usage = Usage(seconds: settings["quranRadioSeconds"] as? Int ?? 0, bytes: settings["quranRadioBytes"] as? Int ?? 0)
      if usage.seconds >= 0 && usage.bytes >= 0 && matches(usage) { return usage }
      try await Task.sleep(nanoseconds: 200_000_000)
    }
    throw quranFixtureFailure("Real local listening usage did not reach the expected source totals.")
  }
  func restoreAndClose() async throws {
    defer { session?.invalidateAndCancel() }
    var failure: Error?
    do {
      if let original {
        _ = try await verifiedSettings()
        let result = try await request("/api/v1/user/settings", method: "PATCH", body: ["settings": original])
        guard result["status"] as? String == "ok", let restored = result["settings"] as? QuranFixtureObject,
          keys.allSatisfy({ NSDictionary(dictionary: ["v": restored[$0] ?? NSNull()]).isEqual(to: ["v": original[$0] ?? NSNull()]) }) else { throw quranFixtureFailure("Only the original source-exposed Quran settings for synthetic user 102 may be restored.") }
      }
    } catch { failure = error }
    if !token.isEmpty {
      do { _ = try await request("/api/v1/auth/logout", method: "POST") } catch { if failure == nil { failure = error } }
    }
    if let failure { throw failure }
  }
  private func verifiedSettings() async throws -> QuranFixtureObject {
    let user = try await request("/api/v1/user")
    guard user["id"] as? Int == 102, user["email"] as? String == "other@native-fixture.invalid", user["is_banned"] as? Bool == false else { throw quranFixtureFailure("Usage and settings must belong to the exact synthetic local user 102.") }
    if user["settings"] is NSNull { return [:] }
    guard let settings = user["settings"] as? QuranFixtureObject else { throw quranFixtureFailure("The source account settings must be nullable or an object.") }
    return settings
  }
  private func request(_ path: String, method: String = "GET", headers: [String: String] = [:], authenticated: Bool = true, body: QuranFixtureObject? = nil) async throws -> QuranFixtureObject {
    guard let url = URL(string: path, relativeTo: URL(string: origin))?.absoluteURL, let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
      parts.scheme == "https", parts.user == nil, parts.password == nil, parts.fragment == nil else { throw quranFixtureFailure("Invalid Quran fixture request boundary.") }
    let local = parts.host == "127.0.0.1" && parts.port == 9443
    let publicTimings = parts.host == "api-staging.mp3quran.net" && parts.port == nil && parts.path == "/v4/recitations/mahmoud-husary/r1/surahs/1/ayah-timings" && parts.query == nil
    guard local || publicTimings && method == "GET" && !authenticated && body == nil && headers.isEmpty,
      method == "GET" || local && method == "PATCH" && parts.path == "/api/v1/user/settings" || local && method == "POST" && parts.path == "/api/v1/auth/logout" else { throw quranFixtureFailure("Only exact local observation/settings cleanup and a credential-free real timing read are allowed.") }
    var request = URLRequest(url: url); request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    if local { request.setValue("no-store", forHTTPHeaderField: "Cache-Control") }
    if authenticated { guard local && !token.isEmpty else { throw quranFixtureFailure("A verified local-only account token is required.") }; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    for (key, value) in headers { request.setValue(value, forHTTPHeaderField: key) }
    if let body { request.setValue("application/json", forHTTPHeaderField: "Content-Type"); request.httpBody = try JSONSerialization.data(withJSONObject: body) }
    let (bytes, response) = try await session.data(for: request)
    guard let response = response as? HTTPURLResponse, response.url == url, response.statusCode == 200, bytes.count <= 2_000_000,
      let value = try JSONSerialization.jsonObject(with: bytes) as? QuranFixtureObject else { throw quranFixtureFailure("The exact real source response did not confirm the bounded expected result.") }
    return value
  }
}
