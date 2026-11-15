import Foundation
import XCTest

// Normal product origin, signed out, public GETs only. No preference or prayer-log controls are changed.
final class NativePrayerPublicUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }
  private let prayerRows = [("Fajr", "الفجر"), ("Sunrise", "الشروق"), ("Dhuhr", "الظهر"), ("Asr", "العصر"), ("Maghrib", "المغرب"), ("Isha", "العشاء")]

  @MainActor
  func testExistingManualCityPublicTimesAndResumePreservePrayerPreferencesAndLog() async throws {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate()
    open("account", app: app)
    let login = app.buttons["تسجيل الدخول"].firstMatch
    XCTAssertTrue(login.waitForExistence(timeout: 20), "This case requires an already signed-out normal-origin product.")
    XCTAssertFalse(app.buttons["تسجيل الخروج"].exists)
    XCTAssertFalse(app.staticTexts["account.fixture.origin"].exists)
    open("muslim_prayer", app: app)
    XCTAssertTrue(app.staticTexts["سجل الصلوات محفوظ على هذا الجهاز. سجّل الدخول لمزامنته مع حسابك."].firstMatch.waitForExistence(timeout: 20))
    let originalSettings = try settings(app)
    let initialDay = day(Date(), zone: "Asia/Damascus")
    let initialLog = try log(app)
    var metadata = try await publicTimes(originalSettings)
    try verifyRows(metadata, app: app)
    let before = try countdown(app)
    try verifyCountdown(before, metadata: metadata)
    guard initialDay == metadata.date else { throw failure("The initial log and public countdown crossed civil days. Retry a coherent read-only snapshot.") }
    attach("prayer-public-before-background", settings: originalSettings, log: initialLog, metadata: metadata, clock: before)
    screenshot("prayer-public-selected-city-and-live-countdown", app: app)

    XCUIDevice.shared.press(.home)
    XCTAssertNotEqual(app.state, .runningForeground)
    try await Task.sleep(nanoseconds: 4_000_000_000)
    app.activate()
    XCTAssertTrue(app.staticTexts["مواقيت الصلاة"].firstMatch.waitForExistence(timeout: 10))
    let resumedDay = day(Date(), zone: "Asia/Damascus")
    if resumedDay != initialDay { metadata = try await publicTimes(originalSettings) }
    try verifyRows(metadata, app: app)
    let resumed = try countdown(app)
    try verifyCountdown(resumed, metadata: metadata)
    guard resumedDay == metadata.date else { throw failure("The resumed observation crossed civil days. Retry a coherent read-only snapshot.") }
    if before.next == resumed.next && resumedDay == initialDay {
      XCTAssertEqual(resumed.remaining, before.remaining - resumed.observedAt.timeIntervalSince(before.observedAt), accuracy: 3,
        "The countdown must catch up to wall time after returning from the background.")
    }
    if resumedDay == initialDay {
      let resumedLog = try log(app)
      try PrayerPublicClockCheck.requireDay(metadata, at: Date())
      XCTAssertEqual(resumedLog, initialLog, "Reading and resuming must preserve every existing completion value.")
    }
    XCTAssertEqual(try settings(app), originalSettings)

    app.terminate()
    open("muslim_prayer", app: app)
    XCTAssertTrue(app.staticTexts["سجل الصلوات محفوظ على هذا الجهاز. سجّل الدخول لمزامنته مع حسابك."].firstMatch.waitForExistence(timeout: 20))
    XCTAssertFalse(app.staticTexts["account.fixture.origin"].exists)
    XCTAssertEqual(try settings(app), originalSettings, "Cold launch must retain the exact selected city, method and source mode.")
    let finalDay = day(Date(), zone: "Asia/Damascus")
    if finalDay != resumedDay { metadata = try await publicTimes(originalSettings) }
    try verifyRows(metadata, app: app)
    let finalLog = try log(app), finalClock = try countdown(app)
    try verifyCountdown(finalClock, metadata: metadata)
    guard finalDay == metadata.date else { throw failure("The cold-launch log and countdown crossed civil days. Retry a coherent read-only snapshot.") }
    if finalDay == initialDay { XCTAssertEqual(finalLog, initialLog) }
    attach("prayer-public-after-cold-launch", settings: originalSettings, log: finalLog, metadata: metadata, clock: finalClock)
    let limits = XCTAttachment(string: "No location, method or completion control was changed. Public caches may refresh. Authoritative public date and timezone were required and validated. The next event was chosen independently from all six clocks, including Sunrise.  Natural Damascus day change observed: \(initialDay != finalDay). This case does not force midnight, select a foreign location, change the system timezone or prove account synchronization.")
    limits.name = "prayer-public-verification-limits"; limits.lifetime = .keepAlways; add(limits)
  }

  private struct Settings: Equatable, Sendable {
    let source: String, city: String, method: String, cityID: String, methodID: Int
  }
  private typealias PublicTimes = PrayerPublicClockCheck.Metadata
  private struct Clock {
    let next: String, remaining: TimeInterval, startedAt: Date, observedAt: Date
  }

  @MainActor
  private func settings(_ app: XCUIApplication) throws -> Settings {
    tap(app.buttons["إعدادات المواقيت"].firstMatch, app: app)
    let source = app.buttons["مصدر الموقع"].firstMatch
    XCTAssertTrue(source.waitForExistence(timeout: 10))
    let sourceValue = try XCTUnwrap(source.value as? String)
    guard sourceValue == "مدينة يدوية" else {
      throw failure("The existing location mode is not manual city. Preserve it and do not select a location for this read-only case.")
    }
    let city = app.buttons["المدينة"].firstMatch, method = app.buttons["طريقة الحساب"].firstMatch
    XCTAssertTrue(city.waitForExistence(timeout: 5)); XCTAssertTrue(method.waitForExistence(timeout: 5))
    let cityValue = try XCTUnwrap(city.value as? String), methodValue = try XCTUnwrap(method.value as? String)
    let cities = ["دمشق": "damascus", "حلب": "aleppo", "حمص": "homs", "حماة": "hama", "اللاذقية": "latakia", "طرطوس": "tartus", "إدلب": "idlib", "الرقة": "raqqa", "دير الزور": "deir-ez-zor", "الحسكة": "hasakah", "درعا": "daraa", "السويداء": "sweida", "القنيطرة": "quneitra", "ريف دمشق": "rural-damascus"]
    let methods = ["رابطة العالم الإسلامي": 3, "الهيئة المصرية للمساحة": 5, "جامعة أم القرى (مكة)": 4, "جامعة العلوم الإسلامية (كراتشي)": 1, "الجمعية الإسلامية لأمريكا الشمالية": 2, "الخليج": 8, "الكويت": 9, "قطر": 10, "سنغافورة": 11, "فرنسا": 12, "تركيا (الديانة)": 13, "جعفري (شيعة)": 0]
    let methodID: Int
    if let known = methods[methodValue] { methodID = known }
    else if methodValue.hasPrefix("الطريقة المحفوظة ("), let stored = Int(digits(methodValue)), [7, 14, 15, 16].contains(stored) { methodID = stored }
    else { throw failure("The existing method does not match the shared source method catalogue.") }
    let value = Settings(source: sourceValue, city: cityValue, method: methodValue, cityID: try XCTUnwrap(cities[cityValue]), methodID: methodID)
    tap(app.buttons["تم"].firstMatch, app: app)
    return value
  }

  @MainActor
  private func screen(_ app: XCUIApplication) throws -> XCUIElement {
    try XCTUnwrap(app.scrollViews.containing(.button, identifier: "إعدادات المواقيت").allElementsBoundByIndex.last(where: { !$0.frame.intersection(app.frame).isEmpty }))
  }
  @MainActor
  private func log(_ app: XCUIApplication) throws -> [String: String] {
    let body = try screen(app)
    var values: [String: String] = [:]
    for (key, label) in prayerRows where key != "Sunrise" {
      let toggle = body.switches["تمت صلاة \(label)"].firstMatch
      XCTAssertTrue(toggle.waitForExistence(timeout: 20))
      let value = try XCTUnwrap(toggle.value as? String)
      guard value == "0" || value == "1" else { throw failure("A prayer completion switch must expose an exact boolean value.") }
      values[key] = value
    }
    let summary = body.staticTexts.matching(NSPredicate(format: "label MATCHES %@", #"^[0-5]/5 صلوات منجزة اليوم$"#)).firstMatch
    XCTAssertTrue(summary.waitForExistence(timeout: 5))
    XCTAssertEqual(Int(digits(String(summary.label.prefix(1)))), values.values.filter { $0 == "1" }.count)
    return values
  }
  @MainActor
  private func verifyRows(_ metadata: PublicTimes, app: XCUIApplication) throws {
    try PrayerPublicClockCheck.requireDay(metadata, at: Date())
    let body = try screen(app)
    for (key, label) in prayerRows {
      let heading = body.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", label, label + "، الآن")).firstMatch
      XCTAssertTrue(heading.waitForExistence(timeout: 20)); expose(heading, app: app)
      let expected = try XCTUnwrap(metadata.timings[key])
      XCTAssertTrue(until {
        let clocks = body.staticTexts.matching(NSPredicate(format: "label MATCHES %@", #"^[0-2][0-9]:[0-5][0-9]$"#)).allElementsBoundByIndex
          .filter { abs($0.frame.midY - heading.frame.midY) < 5 && !$0.frame.intersection(app.frame).isEmpty }
        return Set(clocks.map(\.label)) == [expected]
      }, "The displayed \(key) clock must match the public response for the selected city and method.")
    }
    XCTAssertFalse(body.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "آخر مواقيت محفوظة بتاريخ")).firstMatch.exists)
    try PrayerPublicClockCheck.requireDay(metadata, at: Date())
  }
  @MainActor
  private func countdown(_ app: XCUIApplication) throws -> Clock {
    let body = try screen(app)
    let next = body.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "المتبقي حتى ")).firstMatch
    XCTAssertTrue(next.waitForExistence(timeout: 15)); expose(next, app: app)
    let clock = body.staticTexts.matching(NSPredicate(format: "label MATCHES %@", #"^[0-9]{2}:[0-5][0-9]:[0-5][0-9]$"#)).firstMatch
    XCTAssertTrue(clock.waitForExistence(timeout: 5))
    let startedAt = Date(), nextLabel = next.label, displayedClock = clock.label
    let checkedNextLabel = next.label, finishedAt = Date()
    guard checkedNextLabel == nextLabel else { throw failure("The countdown event changed while capturing its label and value. Retry a coherent snapshot; this is not a product comparison.") }
    let parts = displayedClock.split(separator: ":").compactMap { Int(digits(String($0))) }
    guard parts.count == 3 else { throw failure("The prayer countdown must expose hours, minutes and seconds.") }
    return Clock(next: nextLabel, remaining: Double(parts[0] * 3600 + parts[1] * 60 + parts[2]), startedAt: startedAt, observedAt: finishedAt)
  }
  private func verifyCountdown(_ clock: Clock, metadata: PublicTimes) throws {
    let first = try PrayerPublicClockCheck.expected(metadata, at: clock.startedAt)
    let expected = try PrayerPublicClockCheck.expected(metadata, at: clock.observedAt)
    guard first.key == expected.key, first.deadline == expected.deadline else {
      throw failure("A public event boundary crossed the countdown capture. Retry a coherent snapshot; do not classify it as a product failure.")
    }
    XCTAssertEqual(clock.next, expected.label,
      "The next label must be the earliest future event among all six public clocks, including Sunrise.")
    XCTAssertEqual(clock.remaining, expected.deadline.timeIntervalSince(clock.observedAt), accuracy: 4,
      "Use the selected public event's declared date and timezone. After all six clocks, use the next civil day's first same-day clock, matching the source rollover rule.")
  }

  private func publicTimes(_ settings: Settings) async throws -> PublicTimes {
    let today = day(Date(), zone: "Asia/Damascus")
    var components = URLComponents(string: "https://syrian.zone/api/v1/prayer-times")!
    components.queryItems = [URLQueryItem(name: "governorate", value: settings.cityID), URLQueryItem(name: "method", value: String(settings.methodID)), URLQueryItem(name: "date", value: today)]
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieStorage = nil; configuration.urlCredentialStorage = nil; configuration.httpShouldSetCookies = false
    let session = URLSession(configuration: configuration); defer { session.invalidateAndCancel() }
    var request = URLRequest(url: try XCTUnwrap(components.url), cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
    request.httpMethod = "GET"; request.setValue("application/json", forHTTPHeaderField: "Accept")
    let (data, response) = try await session.data(for: request)
    let http = try XCTUnwrap(response as? HTTPURLResponse)
    XCTAssertEqual(http.statusCode, 200); XCTAssertEqual(http.url?.host, "syrian.zone")
    guard data.count <= 131072, let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
      let timings = json["timings"] as? [String: String] else { throw failure("The public prayer response must expose actual prayer timings.") }
    XCTAssertEqual(json["governorate"] as? String, settings.cityID); XCTAssertEqual((json["method"] as? NSNumber)?.intValue, settings.methodID)
    for (key, _) in prayerRows { XCTAssertNotNil(timings[key]?.range(of: #"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$"#, options: .regularExpression)) }
    let metadata = try PrayerPublicClockCheck.metadata(date: json["date"] as? String, timezone: json["timezone"] as? String, timings: timings)
    guard day(Date(), zone: metadata.timezone) == today else { throw failure("The public request crossed the selected location's civil midnight. Retry the read-only case with a coherent day snapshot.") }
    XCTAssertEqual(metadata.date, today)
    XCTAssertEqual(metadata.timezone, "Asia/Damascus")
    return metadata
  }
  private func day(_ date: Date, zone: String) -> String {
    let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.timeZone = TimeZone(identifier: zone); formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
  }
  private func digits(_ value: String) -> String { value.compactMap(\.wholeNumberValue).map(String.init).joined() }
  private func failure(_ message: String) -> NSError { NSError(domain: "NativePrayerPublic", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }

  @MainActor
  private func open(_ section: String, app: XCUIApplication) {
    app.open(URL(string: "syrianzone://feature/\(section)")!)
    for bundle in ["zone.syrian.ios", "com.apple.springboard"] {
      let open = XCUIApplication(bundleIdentifier: bundle).buttons["Open"].firstMatch
      if open.exists { open.tap(); break }
    }
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 15))
  }
  @MainActor
  private func tap(_ element: XCUIElement, app: XCUIApplication) {
    XCTAssertTrue(element.waitForExistence(timeout: 15)); expose(element, app: app); element.tap()
  }
  @MainActor
  private func expose(_ element: XCUIElement, app: XCUIApplication) {
    for _ in 0..<20 {
      let quiet = app.buttons["إخفاء التنبيه لهذه الزيارة"].firstMatch
      if quiet.exists && quiet.isHittable { quiet.tap() }
      guard let scroll = app.scrollViews.containing(element.elementType, identifier: element.identifier.isEmpty ? element.label : element.identifier)
        .allElementsBoundByIndex.last(where: { !$0.frame.intersection(app.frame).isEmpty }) else { break }
      let viewport = scroll.frame.intersection(app.frame).insetBy(dx: 0, dy: 8)
      if element.isHittable && viewport.contains(element.frame) { return }
      if viewport.contains(element.frame) { XCTAssertTrue(until { element.isHittable }); return }
      let top = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.02, dy: 0.25)), bottom = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.02, dy: 0.75))
      if element.frame.minY < viewport.minY { top.press(forDuration: 0.05, thenDragTo: bottom) }
      else if element.frame.maxY > viewport.maxY { bottom.press(forDuration: 0.05, thenDragTo: top) }
      else { break }
    }
    XCTAssertTrue(element.isHittable)
  }
  @MainActor
  private func until(_ condition: @escaping () -> Bool) -> Bool {
    XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in condition() }, object: nil)], timeout: 10) == .completed
  }
  @MainActor
  private func attach(_ name: String, settings: Settings, log: [String: String], metadata: PublicTimes, clock: Clock) {
    let attachment = XCTAttachment(string: "Source: \(settings.source)\nCity: \(settings.city) (\(settings.cityID))\nMethod: \(settings.method) (\(settings.methodID))\nPublic date: \(metadata.date)\nPublic timezone: \(metadata.timezone)\nPublic timings: \(metadata.timings)\nCurrent-day completion values: \(log)\nNext event: \(clock.next)\nCountdown seconds: \(clock.remaining)\nObserved at: \(clock.observedAt)")
    attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
  }
  @MainActor
  private func screenshot(_ name: String, app: XCUIApplication) {
    let attachment = XCTAttachment(screenshot: app.screenshot()); attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
  }
}

// Public protocol clock comparison only. No astronomy or prayer-time calculation.
enum PrayerPublicClockCheck {
  struct Metadata: Sendable { let date: String, timezone: String, timings: [String: String] }
  struct Moment: Sendable { let key: String, label: String, deadline: Date }
  struct Precondition: Error, LocalizedError {
    let message: String
    var errorDescription: String? { message }
  }
  private static let rows = [("Fajr", "الفجر"), ("Sunrise", "الشروق"), ("Dhuhr", "الظهر"), ("Asr", "العصر"), ("Maghrib", "المغرب"), ("Isha", "العشاء")]

  static func metadata(date: String?, timezone: String?, timings: [String: String]) throws -> Metadata {
    guard let date, date.range(of: #"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"#, options: .regularExpression) != nil,
      let timezone, timezone.count <= 100, let zone = TimeZone(identifier: timezone) else {
      throw Precondition(message: "Backend rollout prerequisite: the public prayer endpoint must return a canonical date and valid IANA timezone. Countdown timezone verification cannot pass without both fields.")
    }
    _ = try instant(date: date, time: "12:00", zone: zone)
    for (key, _) in rows {
      guard let time = timings[key], time.range(of: #"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$"#, options: .regularExpression) != nil else {
        throw Precondition(message: "All six canonical public clocks, including Sunrise, are required for next-event verification.")
      }
      _ = try instant(date: date, time: time, zone: zone)
    }
    return Metadata(date: date, timezone: timezone, timings: timings)
  }

  static func requireDay(_ metadata: Metadata, at now: Date) throws {
    let formatter = formatter(zone: try zone(metadata.timezone), format: "yyyy-MM-dd")
    guard formatter.string(from: now) == metadata.date else {
      throw Precondition(message: "The public response date and observed location day differ. Civil midnight or stale metadata prevents a coherent snapshot; retry before judging product behavior.")
    }
  }

  static func expected(_ metadata: Metadata, at now: Date) throws -> Moment {
    try requireDay(metadata, at: now)
    let timeZone = try zone(metadata.timezone)
    var moments: [(index: Int, key: String, label: String, time: String, deadline: Date)] = []
    for (index, row) in rows.enumerated() {
      guard let time = metadata.timings[row.0] else { throw Precondition(message: "A public event clock disappeared from the snapshot.") }
      let prefix = row.0 == "Sunrise" ? "المتبقي حتى " : "المتبقي حتى صلاة "
      let deadline = try instant(date: metadata.date, time: time, zone: timeZone)
      moments.append((index, row.0, prefix + row.1, time, deadline))
    }
    moments.sort { $0.deadline == $1.deadline ? $0.index < $1.index : $0.deadline < $1.deadline }
    if let next = moments.first(where: { $0.deadline > now }) { return Moment(key: next.key, label: next.label, deadline: next.deadline) }
    guard let first = moments.first else { throw Precondition(message: "Six public event clocks are required.") }
    var calendar = Calendar(identifier: .gregorian); calendar.timeZone = timeZone
    let noon = try instant(date: metadata.date, time: "12:00", zone: timeZone)
    guard let tomorrow = calendar.date(byAdding: .day, value: 1, to: noon) else { throw Precondition(message: "The next civil day could not be represented.") }
    let nextDay = formatter(zone: timeZone, format: "yyyy-MM-dd").string(from: tomorrow)
    return Moment(key: first.key, label: first.label, deadline: try instant(date: nextDay, time: first.time, zone: timeZone))
  }

  private static func zone(_ identifier: String) throws -> TimeZone {
    guard let zone = TimeZone(identifier: identifier) else { throw Precondition(message: "The public timezone is invalid.") }
    return zone
  }
  private static func instant(date: String, time: String, zone: TimeZone) throws -> Date {
    let value = date + " " + time, formatter = formatter(zone: zone, format: "yyyy-MM-dd HH:mm")
    guard let parsed = formatter.date(from: value), formatter.string(from: parsed) == value else { throw Precondition(message: "The declared public clock is not a real civil instant in its declared timezone.") }
    return parsed
  }
  private static func formatter(zone: TimeZone, format: String) -> DateFormatter {
    let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.calendar = Calendar(identifier: .gregorian)
    formatter.timeZone = zone; formatter.dateFormat = format; formatter.isLenient = false
    return formatter
  }
}
