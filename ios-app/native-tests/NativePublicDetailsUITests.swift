import Foundation
import XCTest

// Normal product bundle. Public reads only; no accounts, settings or external actions.
final class NativePublicDetailsUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func testPartyRealFacetsListSearchAndInternalDetails() async throws {
    let source = try await PublicPartyRead.current()
    let app = try open("party", heading: "دليل المنظمات السياسية السورية")
    let field = textField("ابحث بالاسم أو النوع أو المكان", in: app)
    let list = try scroll(owning: field, in: app)
    try expectPartyCount(source.rows.count, in: app)
    try choose("نوع المنظمة", option: source.category, app: app, scroll: list)
    try expectPartyCount(source.categoryCount, in: app)
    try choose("المدينة", option: source.city, app: app, scroll: list)
    try expectPartyCount(source.cityCount, in: app)
    try choose("البلد", option: source.country, app: app, scroll: list)
    try choose("اللغة", option: "العربية", app: app, scroll: list)
    try expectPartyCount(source.combinedCount, in: app)
    try replaceSearch(field, with: source.name, app: app, scroll: list)
    try expectPartyCount(1, in: app)
    try press("قائمة", app: app, scroll: list)
    let rows = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", source.name + "، "))
    XCTAssertTrue(rows.firstMatch.waitForExistence(timeout: 10))
    XCTAssertEqual(rows.count, 1)
    try activate(rows.firstMatch, app: app, scroll: list)
    let close = button("إغلاق التفاصيل", in: app)
    XCTAssertTrue(close.waitForExistence(timeout: 10))
    let detail = try scroll(owning: close, in: app)
    try expose(text(source.name, in: detail), app: app, scroll: detail)
    try expose(text(source.description, in: detail), app: app, scroll: detail)
    let website = button("الموقع الإلكتروني", in: app)
    try expose(website, app: app, scroll: detail)
    XCTAssertTrue(website.isEnabled && website.isHittable)
    capture("party-real-source-detail-without-opening-any-destination", scroll: detail)
    try activate(close, app: app, scroll: detail)
    XCTAssertTrue(until { !close.exists })
    try press("مسح البحث والتصفية", app: app, scroll: list)
    try expectPartyCount(source.rows.count, in: app)
    try press("بطاقات", app: app, scroll: list)
    try expose(button("الموقع والبيان وحسابات التواصل", in: app), app: app, scroll: list)
    capture("party-facets-cleared-and-source-card-layout", scroll: list)
    // Today's public source has ten records, so it cannot exercise the 15-row load-more branch.
    note("Load-more is intentionally unproved when the live public feed has at most fifteen rows. No external contribution or organization destination was opened.")
  }

  @MainActor
  func testJusticeSourceHierarchyRankCountsAndOriginalPortraits() throws {
    let app = try open("justice", heading: "العدالة الانتقالية")
    let list = try scroll(owning: text("القائمة السوداء", in: app), in: app)
    let asOf = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "محدّث حتى ")).firstMatch
    try expose(asOf, app: app, scroll: list)
    let date = asciiDigits(asOf.label)
    XCTAssertTrue(date.contains("2025") && date.contains("15") && (date.contains("حزيران") || date.contains("يونيو")))
    let rootPortrait = app.images.matching(NSPredicate(format: "label == %@", "بشار الأسد")).firstMatch
    try expose(rootPortrait, app: app, scroll: list)
    XCTAssertGreaterThanOrEqual(rootPortrait.frame.width, 60)
    XCTAssertGreaterThanOrEqual(rootPortrait.frame.height, 60)
    capture("justice-original-hierarchy-root-portrait", scroll: list)
    for group in ["المخابرات والأمن", "الجيش والقوات المسلحة", "الميليشيات والشبيحة", "رجال الأعمال وتمويل النظام"] {
      try expose(text(group, in: app), app: app, scroll: list)
    }
    try expose(text("إجمالي الموقوفين", in: app), app: app, scroll: list)
    try expose(text("5,989", in: app), app: app, scroll: list)
    try expose(text("منهم 3,696 من أصحاب الرتب العسكرية", in: app), app: app, scroll: list)
    let ranks: [(String, String)] = [("عماد", "1"), ("لواء", "42"), ("عميد", "172"), ("عقيد", "218"),
      ("مقدم", "112"), ("رائد", "73"), ("نقيب", "160"), ("ملازم أول", "126"), ("ملازم", "32"),
      ("مساعد أول", "435"), ("مساعد", "268"), ("رقيب أول", "174"), ("رقيب", "285"), ("عريف", "160"), ("عنصر", "1,438")]
    for (rank, expected) in ranks {
      let title = text(rank, in: app)
      try expose(title, app: app, scroll: list)
      let matchingCount = app.staticTexts.matching(NSPredicate(format: "label == %@", expected)).allElementsBoundByAccessibilityElement
        .contains { value in
          let a = value.frame, b = title.frame
          return finite(a) && a.maxY <= b.minY + 1 && b.minY - a.maxY < b.height * 2
            && min(a.maxX, b.maxX) > max(a.minX, b.minX)
        }
      XCTAssertTrue(matchingCount, "The actual \(rank) card must pair its source count \(expected) with the rank label.")
    }
    let people = text("أبرز الموقوفين", in: app)
    try expose(people, app: app, scroll: list)
    XCTAssertTrue(text("55 من رموز النظام", in: app).exists)
    let first = app.images.matching(NSPredicate(format: "label == %@", "عاطف نجيب")).firstMatch
    try expose(first, app: app, scroll: list)
    XCTAssertGreaterThan(first.frame.minY, people.frame.minY)
    XCTAssertGreaterThanOrEqual(first.frame.width, 60)
    XCTAssertGreaterThanOrEqual(first.frame.height, 60)
    try expose(text("رئيس فرع الأمن السياسي في درعا", in: app), app: app, scroll: list)
    capture("justice-rank-source-counts-and-first-detainee-portrait", scroll: list)
    note("Expectations come from the bundled Justice JSON dated2025-06-15. Image elements and screenshots permit visual review; they do not prove every portrait pixel, all55 cards or large-text accessibility. The current hierarchy has no name shared with the detainee list, so no detained badge is claimed.")
  }

  @MainActor
  func testHouseHistoricalVotersSexChartsSearchAndNewNameSheet() throws {
    let app = try open("house?view=archive", heading: "البيانات التاريخية")
    let field = textField("ابحث بالاسم أو المكان", in: app)
    let list = try scroll(owning: field, in: app)
    let original = try archiveCount(in: app)
    let totals = try archiveGenderTotals(in: app)
    XCTAssertEqual(totals.total, original)
    XCTAssertGreaterThan(totals.male, 0)
    XCTAssertGreaterThan(totals.female, 0)
    let chart = app.images.matching(NSPredicate(format: "label == %@", "ذكور \(totals.male)، إناث \(totals.female)")).firstMatch
    try expose(chart, app: app, scroll: list)
    XCTAssertGreaterThan(chart.frame.height, 100)
    try choose("الجنس", option: "أنثى", app: app, scroll: list)
    try expectArchiveCount(totals.female, in: app)
    let female = try archiveGenderTotals(in: app)
    XCTAssertEqual(female.male, 0)
    XCTAssertEqual(female.total, totals.female)
    try press("مسح البحث والتصفية", app: app, scroll: list)
    try expectArchiveCount(original, in: app)
    try replaceSearch(field, with: "لاتوجدبهذاالاسمالتجريبي", app: app, scroll: list)
    try expectArchiveCount(0, in: app)
    XCTAssertTrue(text("لا توجد نتائج مطابقة", in: app).exists)
    try press("مسح البحث والتصفية", app: app, scroll: list)
    try expectArchiveCount(original, in: app)
    let names = app.buttons.matching(NSPredicate(format: "label MATCHES %@", #"^أسماء جديدة \([0-9]+\)$"#)).firstMatch
    try expose(names, app: app, scroll: list)
    let expectedNames = try XCTUnwrap(numbers(names.label).first)
    XCTAssertGreaterThan(expectedNames, 0)
    try activate(names, app: app, scroll: list)
    let close = button("إغلاق الأسماء", in: app)
    XCTAssertTrue(close.waitForExistence(timeout: 10))
    let sheet = try scroll(owning: close, in: app)
    try expose(text("أسماء جديدة (\(expectedNames))", in: sheet), app: app, scroll: sheet)
    try expose(text("وردت في القوائم النهائية ولم تظهر في القوائم الأولية", in: sheet), app: app, scroll: sheet)
    capture("house-historical-new-name-comparison-sheet", scroll: sheet)
    try activate(close, app: app, scroll: sheet)
    XCTAssertTrue(until { !close.exists })
    try expectArchiveCount(original, in: app)
    note("This reads the source's public CSV through the product, not an export/send action. It does not prove CSV retry behavior.")
  }

  @MainActor
  func testHouseHistoricalModesResultDistrictAndNumericSort() throws {
    let app = try open("house?view=archive", heading: "البيانات التاريخية")
    let field = textField("ابحث بالاسم أو المكان", in: app)
    let list = try scroll(owning: field, in: app)
    _ = try archiveCount(in: app)
    try chooseArchiveMode("المرشحون", app: app, scroll: list)
    let candidates = try archiveCount(in: app)
    XCTAssertGreaterThan(candidates, 0)
    XCTAssertTrue(button("النتيجة", in: app).exists)
    XCTAssertFalse(button("المحافظة", in: app).exists)
    try choose("النتيجة", option: "فائز", app: app, scroll: list)
    let winnersAmongCandidates = try archiveCount(in: app)
    XCTAssertLessThan(winnersAmongCandidates, candidates)
    try press("مسح البحث والتصفية", app: app, scroll: list)
    try chooseArchiveMode("الفائزون", app: app, scroll: list)
    _ = try archiveCount(in: app)
    XCTAssertTrue(button("الدائرة الانتخابية", in: app).exists)
    XCTAssertFalse(button("النتيجة", in: app).exists)
    try chooseArchiveMode("الثلث الرئاسي", app: app, scroll: list)
    let presidential = try archiveCount(in: app)
    let totals = try archiveGenderTotals(in: app)
    XCTAssertEqual(totals.total, presidential)
    XCTAssertGreaterThan(totals.female, 0)
    XCTAssertFalse(button("الدائرة الانتخابية", in: app).exists)
    try choose("الجنس", option: "أنثى", app: app, scroll: list)
    try expectArchiveCount(totals.female, in: app)
    try press("مسح البحث والتصفية", app: app, scroll: list)
    try choose("ترتيب حسب", option: "Age", app: app, scroll: list)
    try press("تصاعدي", app: app, scroll: list)
    let ascending = try firstArchiveRow(app: app, scroll: list)
    let ascendingAge = try rowAge(ascending.label)
    try press("تنازلي", app: app, scroll: list)
    let descending = try firstArchiveRow(app: app, scroll: list)
    XCTAssertGreaterThan(try rowAge(descending.label), ascendingAge, "The current public presidential source has varied ages; a no-op direction control must not pass.")
    let name = try XCTUnwrap(descending.label.components(separatedBy: "،").first).trimmingCharacters(in: .whitespaces)
    XCTAssertFalse(name.isEmpty)
    try activate(descending, app: app, scroll: list)
    let close = button("إغلاق السجل", in: app)
    XCTAssertTrue(close.waitForExistence(timeout: 10))
    let detail = try scroll(owning: close, in: app)
    try expose(text(name, in: detail), app: app, scroll: detail)
    try expose(text("Age", in: detail), app: app, scroll: detail)
    capture("house-historical-presidential-numeric-sort-and-record", scroll: detail)
    try activate(close, app: app, scroll: detail)
    XCTAssertTrue(until { !close.exists })
    try expectArchiveCount(presidential, in: app)
    note("Four real historical modes are reached. District control visibility is verified; choosing a district, province changes and every dynamic column remain separate checks.")
  }

  @MainActor
  private func open(_ section: String, heading: String) throws -> XCUIApplication {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate()
    app.open(try XCTUnwrap(URL(string: "syrianzone://feature/" + section)))
    for bundle in ["zone.syrian.ios", "com.apple.springboard", "com.apple.mobilesafari", "com.apple.SafariViewService"] {
      let allow = XCUIApplication(bundleIdentifier: bundle).buttons["Open"].firstMatch
      if allow.exists { XCTAssertTrue(allow.isEnabled && allow.isHittable); allow.tap(); break }
    }
    XCTAssertTrue(text(heading, in: app).waitForExistence(timeout: 25))
    XCTAssertFalse(app.staticTexts["account.fixture.origin"].exists)
    XCTAssertFalse(app.staticTexts["adapter.fixture"].exists)
    try quiet(app)
    return app
  }

  @MainActor
  private func text(_ label: String, in scope: XCUIElement) -> XCUIElement {
    scope.staticTexts.matching(NSPredicate(format: "label == %@", label)).firstMatch
  }
  @MainActor
  private func button(_ purpose: String, in app: XCUIApplication) -> XCUIElement {
    app.buttons.matching(NSPredicate(format: "identifier == %@ OR label == %@", purpose, purpose)).firstMatch
  }
  @MainActor
  private func textField(_ purpose: String, in app: XCUIApplication) -> XCUIElement {
    app.textFields.matching(NSPredicate(format: "identifier == %@ OR label == %@", purpose, purpose)).firstMatch
  }

  @MainActor
  private func scroll(owning anchor: XCUIElement, in app: XCUIApplication) throws -> XCUIElement {
    XCTAssertTrue(anchor.waitForExistence(timeout: 20))
    let predicate = NSPredicate(format: "elementType == %lu AND label == %@", anchor.elementType.rawValue, anchor.label)
    let candidates = app.scrollViews.containing(predicate).allElementsBoundByAccessibilityElement.filter {
      finite($0.frame) && $0.frame.width > app.frame.width * 0.5 && $0.frame.height > 100
        && !$0.frame.intersection(app.frame).isEmpty
    }
    XCTAssertEqual(candidates.count, 1, "The source anchor must identify exactly one actual vertical scroll owner. No global fallback is used.")
    return try XCTUnwrap(candidates.first)
  }

  @MainActor
  private func expose(_ element: XCUIElement, app: XCUIApplication, scroll: XCUIElement) throws {
    XCTAssertTrue(element.waitForExistence(timeout: 20))
    for _ in 0..<48 {
      try quiet(app)
      let viewport = scroll.frame.intersection(app.frame).insetBy(dx: 0, dy: 8), target = element.frame
      guard scroll.exists && finite(viewport) && finite(target) else { throw failure("Known scroll and target geometry must remain finite and positive.") }
      if element.isHittable && viewport.contains(target) { return }
      let origin = app.coordinate(withNormalizedOffset: .zero)
      let top = origin.withOffset(CGVector(dx: viewport.maxX - 8, dy: viewport.minY + viewport.height * 0.25))
      let bottom = origin.withOffset(CGVector(dx: viewport.maxX - 8, dy: viewport.minY + viewport.height * 0.75))
      if target.minY < viewport.minY { top.press(forDuration: 0.05, thenDragTo: bottom) }
      else if target.maxY > viewport.maxY { bottom.press(forDuration: 0.05, thenDragTo: top) }
      else {
        if until({ element.isHittable && viewport.contains(element.frame) }) { return }
        break
      }
    }
    let data = try JSONSerialization.data(withJSONObject: ["targetRole": element.elementType.rawValue,
      "targetFrame": frame(element.frame), "scrollFrame": frame(scroll.frame), "appFrame": frame(app.frame)], options: [.sortedKeys])
    let note = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
    note.name = "public-detail-known-owner-exposure-failure"; note.lifetime = .keepAlways; add(note)
    throw failure("The target must be fully visible and hittable in its exact source-owned scroll view.")
  }

  @MainActor
  private func activate(_ element: XCUIElement, app: XCUIApplication, scroll: XCUIElement) throws {
    try expose(element, app: app, scroll: scroll)
    XCTAssertTrue(element.isEnabled && element.isHittable)
    element.tap()
  }
  @MainActor
  private func press(_ title: String, app: XCUIApplication, scroll: XCUIElement) throws {
    try activate(button(title, in: app), app: app, scroll: scroll)
  }
  @MainActor
  private func choose(_ purpose: String, option: String, app: XCUIApplication, scroll: XCUIElement) throws {
    let control = button(purpose, in: app)
    try activate(control, app: app, scroll: scroll)
    let options = app.buttons.matching(NSPredicate(format: "label == %@", option))
    XCTAssertTrue(options.firstMatch.waitForExistence(timeout: 8))
    XCTAssertEqual(options.count, 1)
    XCTAssertTrue(options.firstMatch.isEnabled && options.firstMatch.isHittable && app.frame.contains(options.firstMatch.frame))
    options.firstMatch.tap()
    XCTAssertTrue(until { control.value as? String == option })
  }

  @MainActor
  private func chooseArchiveMode(_ option: String, app: XCUIApplication, scroll: XCUIElement) throws {
    let previous = try archiveCount(in: app)
    try choose("القائمة التاريخية", option: option, app: app, scroll: scroll)
    let heading = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", #"^القائمة الرئيسية \([0-9]+\)$"#)).firstMatch
    XCTAssertTrue(until(timeout: 30) {
      guard heading.exists, let count = self.numbers(heading.label).first else { return false }
      return count > 0 && count != previous
    }, "These four current public CSV sources have different row totals. A retained previous-mode count cannot establish that the new source loaded.")
  }

  @MainActor
  private func replaceSearch(_ field: XCUIElement, with value: String, app: XCUIApplication, scroll: XCUIElement) throws {
    try activate(field, app: app, scroll: scroll)
    let clear = field.buttons.matching(NSPredicate(format: "label == %@", "مسح النص"))
    func empty() -> Bool {
      guard clear.count == 0 else { return false }
      guard let raw = field.value else { return true }
      guard let text = raw as? String else { return false }
      return text.isEmpty || (field.placeholderValue?.isEmpty == false && text == field.placeholderValue)
    }
    if !empty() {
      XCTAssertTrue(clear.firstMatch.waitForExistence(timeout: 5))
      XCTAssertEqual(clear.count, 1)
      XCTAssertTrue(clear.firstMatch.isEnabled && clear.firstMatch.isHittable)
      clear.firstMatch.tap()
    }
    XCTAssertTrue(until { empty() })
    field.typeText(value + "\n")
    XCTAssertEqual(field.value as? String, value)
  }

  @MainActor
  private func expectPartyCount(_ expected: Int, in app: XCUIApplication) throws {
    let heading = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", #"^عرض [0-9]+ من أصل [0-9]+ منظمة$"#)).firstMatch
    XCTAssertTrue(until(timeout: 30) {
      heading.exists && self.numbers(heading.label).last == expected
    }, "The real organization filter/search outcome must match the independent public read.")
    XCTAssertEqual(try partyCounts(in: app).total, expected)
  }
  @MainActor
  private func expectArchiveCount(_ expected: Int, in app: XCUIApplication) throws {
    let heading = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", #"^القائمة الرئيسية \([0-9]+\)$"#)).firstMatch
    XCTAssertTrue(until(timeout: 30) {
      heading.exists && self.numbers(heading.label).first == expected
    }, "The actual historical filter/search count must change before its result is adopted.")
    XCTAssertEqual(try archiveCount(in: app, allowZero: expected == 0), expected)
  }

  @MainActor
  private func partyCounts(in app: XCUIApplication) throws -> (visible: Int, total: Int) {
    let values = try matchingNumbers(#"^عرض ([0-9]+) من أصل ([0-9]+) منظمة$"#, app: app, requirePositiveFirst: true)
    XCTAssertEqual(values.count, 2)
    return (values[0], values[1])
  }
  @MainActor
  private func archiveCount(in app: XCUIApplication, allowZero: Bool = false) throws -> Int {
    let value = try XCTUnwrap(matchingNumbers(#"^القائمة الرئيسية \(([0-9]+)\)$"#, app: app, requirePositiveFirst: !allowZero).first)
    XCTAssertTrue(allowZero || value > 0, "The actual public CSV must load nonempty rows; an upstream error is not a passing case.")
    return value
  }
  @MainActor
  private func archiveGenderTotals(in app: XCUIApplication) throws -> (total: Int, male: Int, female: Int) {
    let values = try matchingNumbers(#"^الإجمالي: ([0-9]+)، ذكور: ([0-9]+)، إناث: ([0-9]+)$"#, app: app, requirePositiveFirst: true)
    XCTAssertEqual(values.count, 3)
    return (values[0], values[1], values[2])
  }
  @MainActor
  private func matchingNumbers(_ pattern: String, app: XCUIApplication, requirePositiveFirst: Bool = false) throws -> [Int] {
    let expression = try NSRegularExpression(pattern: pattern)
    let target = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", pattern)).firstMatch
    XCTAssertTrue(until(timeout: 30) {
      guard target.exists else { return false }
      return !requirePositiveFirst || (self.numbers(target.label).first ?? 0) > 0
    }, "The real public response must replace its initial empty/loading count.")
    let value = target.label as NSString
    let match = try XCTUnwrap(expression.firstMatch(in: target.label, range: NSRange(location: 0, length: value.length)))
    return (1..<match.numberOfRanges).compactMap { Int(value.substring(with: match.range(at: $0))) }
  }
  @MainActor
  private func firstArchiveRow(app: XCUIApplication, scroll: XCUIElement) throws -> XCUIElement {
    let title = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", #"^القائمة الرئيسية \([0-9]+\)$"#)).firstMatch
    try expose(title, app: app, scroll: scroll)
    let candidates = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "العمر ")).allElementsBoundByAccessibilityElement.filter {
      finite($0.frame) && $0.frame.minY >= title.frame.maxY
    }.sorted { $0.frame.minY < $1.frame.minY }
    let row = try XCTUnwrap(candidates.first, "A real CSV row with the source age subtitle must exist below its list heading.")
    try expose(row, app: app, scroll: scroll)
    return row
  }
  private func rowAge(_ label: String) throws -> Int {
    let expression = try NSRegularExpression(pattern: #"العمر ([0-9]+)"#), value = label as NSString
    let match = try XCTUnwrap(expression.firstMatch(in: label, range: NSRange(location: 0, length: value.length)))
    return try XCTUnwrap(Int(value.substring(with: match.range(at: 1))))
  }

  @MainActor
  private func quiet(_ app: XCUIApplication) throws {
    let controls = app.buttons.matching(identifier: "إخفاء التنبيه لهذه الزيارة")
    guard controls.count > 0 else { return }
    XCTAssertEqual(controls.count, 1)
    XCTAssertTrue(controls.firstMatch.isEnabled && controls.firstMatch.isHittable)
    controls.firstMatch.tap()
    XCTAssertTrue(until { controls.count == 0 })
  }
  @MainActor
  private func until(timeout: TimeInterval = 5, _ condition: @escaping () -> Bool) -> Bool {
    XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in condition() }, object: nil)], timeout: timeout) == .completed
  }
  private func finite(_ value: CGRect) -> Bool {
    [value.minX, value.minY, value.width, value.height].allSatisfy(\.isFinite) && value.width > 0 && value.height > 0
  }
  private func frame(_ value: CGRect) -> [Double] {
    [value.minX, value.minY, value.width, value.height].map { $0.isFinite ? Double($0) : 0 }
  }
  private func numbers(_ text: String) -> [Int] { text.split(whereSeparator: { !$0.isNumber }).compactMap { Int($0) } }
  private func asciiDigits(_ text: String) -> String {
    text.unicodeScalars.map { scalar in (0x660...0x669).contains(scalar.value) ? String(scalar.value - 0x660) : String(scalar) }.joined()
  }
  @MainActor
  private func capture(_ name: String, scroll: XCUIElement) {
    let attachment = XCTAttachment(screenshot: scroll.screenshot()); attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
  }
  private func note(_ text: String) { let attachment = XCTAttachment(string: text); attachment.name = "public-detail-proof-limits"; attachment.lifetime = .keepAlways; add(attachment) }
  private func failure(_ message: String) -> NSError { NSError(domain: "NativePublicDetails", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
}

private struct PublicPartyRead {
  let rows: [[String: Any]], name: String, description: String, category: String, city: String, country: String
  let categoryCount: Int, cityCount: Int, combinedCount: Int

  static func current() async throws -> PublicPartyRead {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieStorage = nil; configuration.urlCredentialStorage = nil; configuration.urlCache = nil
    configuration.httpShouldSetCookies = false; configuration.timeoutIntervalForRequest = 15; configuration.timeoutIntervalForResource = 20
    let session = URLSession(configuration: configuration, delegate: PublicRedirectRefusal(), delegateQueue: nil)
    defer { session.invalidateAndCancel() }
    func read(_ path: String, headers: [String: String]) async throws -> (Data, Int) {
      let url = URL(string: "https://syrian.zone" + path)!
      var request = URLRequest(url: url); request.httpMethod = "GET"; request.httpShouldHandleCookies = false
      request.setValue(path == "/" ? "text/html" : "application/json", forHTTPHeaderField: "Accept")
      request.setValue("SyrianZone public native verification", forHTTPHeaderField: "User-Agent")
      for (key, value) in headers { request.setValue(value, forHTTPHeaderField: key) }
      let data: Data, response: URLResponse
      do { (data, response) = try await session.data(for: request) }
      catch { throw failure() }
      guard let response = response as? HTTPURLResponse, response.url == url, data.count <= 2_000_000 else { throw failure() }
      return (data, response.statusCode)
    }
    var result: (Data, Int)?
    for _ in 0..<2 {
      let home = try await read("/", headers: [:])
      guard home.1 == 200, let html = String(data: home.0, encoding: .utf8) else { throw failure() }
      let version = try NativeInertiaBootstrap.version(in: html)
      let page = try await read("/party", headers: NativeInertiaBootstrap.headers(version: version))
      if page.1 == 409 { continue }
      result = page; break
    }
    guard let result, result.1 == 200,
      let page = try JSONSerialization.jsonObject(with: result.0) as? [String: Any], page["component"] as? String == "Party/Index",
      let props = page["props"] as? [String: Any], let rows = props["initialOrganizations"] as? [[String: Any]],
      !rows.isEmpty, rows.count <= 5000 else { throw failure() }
    let selected = rows.filter { $0["name"] as? String == "حزب الجمهورية" }
    guard selected.count == 1, let own = selected.first, let name = own["name"] as? String,
      let description = own["description"] as? String, !description.isEmpty,
      own["type"] as? String == "حزب سياسي", own["city"] as? String == "دمشق",
      own["country"] as? String == "سوريا", own["lang"] as? String == "AR",
      let website = own["website"] as? String, !website.isEmpty else { throw failure() }
    let category = rows.filter { $0["type"] as? String == "حزب سياسي" }
    let city = category.filter { $0["city"] as? String == "دمشق" }
    let combined = city.filter { $0["country"] as? String == "سوريا" && $0["lang"] as? String == "AR" }
    return .init(rows: rows, name: name, description: description, category: "حزب سياسي", city: "دمشق", country: "سوريا",
      categoryCount: category.count, cityCount: city.count, combinedCount: combined.count)
  }
  private static func failure() -> NSError { NSError(domain: "PublicPartyRead", code: 1, userInfo: [NSLocalizedDescriptionKey: "The current credential-free public Party source and known source record must be available. No raw response, cookie or URL is reported."]) }
}

private final class PublicRedirectRefusal: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
