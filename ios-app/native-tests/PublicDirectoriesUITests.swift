import XCTest

// Product-bundle public reads only. Each case changes view-local state and
// avoids outbound links, calls, clipboard actions, account writes and uploads.
final class PublicDirectoriesUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func testPhonebookNumberSearchCategoryAndCardListLayouts() throws {
    let app = open("phonebook")
    let total = try count(#"^([0-9]+) نتيجة$"#, app: app)
    XCTAssertGreaterThan(total, 0)
    let copy = app.buttons["نسخ الرقم"].firstMatch
    expose(copy, app: app)
    let number = try XCTUnwrap(app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", #"^[+0-9][0-9 ()+*-]{1,24}$"#))
      .allElementsBoundByIndex.filter { $0.frame.maxY <= copy.frame.minY && $0.isHittable }.max(by: { $0.frame.maxY < $1.frame.maxY })?.label)
    replace(app.textFields["ابحث بالاسم أو الرقم"].firstMatch, with: number, app: app)
    let filtered = try count(#"^([0-9]+) نتيجة$"#, app: app)
    XCTAssertGreaterThan(filtered, 0)
    XCTAssertLessThanOrEqual(filtered, total)
    XCTAssertTrue(app.staticTexts[number].firstMatch.exists)
    press("بطاقات", app: app)
    XCTAssertTrue(app.segmentedControls.buttons["بطاقات"].firstMatch.isSelected)
    XCTAssertEqual(try count(#"^([0-9]+) نتيجة$"#, app: app), filtered)
    press("قائمة", app: app)
    replace(app.textFields["ابحث بالاسم أو الرقم"].firstMatch, with: "لارقمبهذاالاسمالتجريبي", app: app)
    XCTAssertTrue(app.staticTexts["لم يتم العثور على أرقام."].firstMatch.waitForExistence(timeout: 5))
    press("مسح البحث والتصفية", app: app)
    XCTAssertEqual(try count(#"^([0-9]+) نتيجة$"#, app: app), total)
    let category = try categoryControl(app: app)
    let initial = category.isSelected
    activate(category, app: app)
    XCTAssertTrue(until { category.isSelected != initial }, "RN category selection must expose its selected trait.")
    XCTAssertLessThanOrEqual(try count(#"^([0-9]+) نتيجة$"#, app: app, allowZero: true), total)
    activate(category, app: app)
    XCTAssertEqual(try count(#"^([0-9]+) نتيجة$"#, app: app), total)
    capture("phonebook-local-search-filter-and-layout-no-number-actions", app: app)
  }

  @MainActor
  func testOfficialAccountsLanguageSearchCategoryAndLayoutWithoutOpeningSocialLinks() throws {
    let app = open("syofficial")
    let total = try count(#"^عرض ([0-9]+) حساب رسمي$"#, app: app)
    XCTAssertGreaterThan(total, 0)
    let categoryHeaders = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH %@", "syofficial.category."))
    XCTAssertTrue(categoryHeaders.firstMatch.waitForExistence(timeout: 10), "The source grid must expose a category heading before its accounts.")
    let firstHeaderID = categoryHeaders.firstMatch.identifier, firstHeaderLabel = categoryHeaders.firstMatch.label
    XCTAssertFalse(firstHeaderLabel.isEmpty)
    let category = try categoryControl(app: app)
    activate(category, app: app)
    XCTAssertTrue(until { category.isSelected })
    let filtered = try count(#"^عرض ([0-9]+) حساب رسمي$"#, app: app, allowZero: true, emptyLabel: "لم يتم العثور على حسابات رسمية")
    XCTAssertLessThanOrEqual(filtered, total)
    XCTAssertTrue(until { filtered == 0 ? categoryHeaders.count == 0 : categoryHeaders.count == 1 && categoryHeaders.firstMatch.label == category.label },
      "A filtered grid must expose only its nonempty source category heading.")
    activate(category, app: app)
    XCTAssertEqual(try count(#"^عرض ([0-9]+) حساب رسمي$"#, app: app), total)
    // The source RN radio has the exact label English; its native element type
    // has not been observed, so use that label without guessing a radio enum.
    activate(app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "English")).firstMatch, app: app)
    let english = app.textFields["Search official accounts by name or description..."].firstMatch
    XCTAssertTrue(english.waitForExistence(timeout: 5))
    XCTAssertEqual(try count(#"^Showing ([0-9]+) official accounts$"#, app: app), total)
    let translatedHeader = app.descendants(matching: .any).matching(identifier: firstHeaderID).firstMatch
    XCTAssertTrue(translatedHeader.waitForExistence(timeout: 5))
    let translatedCategories = try horizontalRow(app).buttons.allElementsBoundByIndex.map(\.label)
    XCTAssertTrue(translatedCategories.contains(translatedHeader.label), "Grid headings must use the same translated source labels as the category filters.")
    press("Table", app: app)
    XCTAssertTrue(app.segmentedControls.buttons["Table"].firstMatch.isSelected)
    XCTAssertTrue(until { categoryHeaders.count == 0 }, "The source table must remain a flat list without grid category headings.")
    replace(english, with: "لاجهةبهذاالاسمالتجريبي", app: app)
    XCTAssertTrue(app.staticTexts["No official accounts found"].firstMatch.waitForExistence(timeout: 5))
    press("مسح البحث والتصفية", app: app)
    XCTAssertEqual(try count(#"^Showing ([0-9]+) official accounts$"#, app: app), total)
    activate(app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "العربية")).firstMatch, app: app)
    XCTAssertTrue(app.textFields["ابحث في الحسابات الرسمية بالاسم أو الوصف..."].firstMatch.waitForExistence(timeout: 5))
    XCTAssertTrue(app.segmentedControls.buttons["جدول"].firstMatch.isSelected)
    capture("official-language-and-layout-restored-without-social-navigation", app: app)
    press("شبكة", app: app)
    let restoredHeader = app.descendants(matching: .any).matching(identifier: firstHeaderID).firstMatch
    XCTAssertTrue(restoredHeader.waitForExistence(timeout: 5))
    XCTAssertEqual(restoredHeader.label, firstHeaderLabel)
    XCTAssertEqual(try count(#"^عرض ([0-9]+) حساب رسمي$"#, app: app), total)
    capture("official-source-category-headings-restored-in-grid", app: app)
  }

  @MainActor
  func testGovernmentAppsPlatformFilterDescriptionAndSearchWithoutOpeningStores() throws {
    let app = open("govapps")
    let total = try count(#"^([0-9]+) تطبيق$"#, app: app)
    XCTAssertGreaterThan(total, 0)
    let filter = try horizontalControl("آيفون", app: app)
    let value = String(describing: filter.value), selected = filter.isSelected
    activate(filter, app: app)
    XCTAssertTrue(until { filter.isSelected != selected || String(describing: filter.value) != value },
      "The source RN checkbox's native checked mapping still needs its first observed hierarchy.")
    XCTAssertLessThanOrEqual(try count(#"^([0-9]+) تطبيق$"#, app: app, allowZero: true), total)
    activate(filter, app: app)
    XCTAssertEqual(try count(#"^([0-9]+) تطبيق$"#, app: app), total)
    let expand = app.buttons["إظهار الوصف كاملاً"].firstMatch
    if expand.waitForExistence(timeout: 3) {
      activate(expand, app: app)
      XCTAssertTrue(app.buttons["إخفاء التفاصيل"].firstMatch.waitForExistence(timeout: 5))
      press("إخفاء التفاصيل", app: app)
      XCTAssertTrue(app.buttons["إظهار الوصف كاملاً"].firstMatch.waitForExistence(timeout: 5))
    } else {
      note("The first visible source app has no expandable description; that control was not exercised.")
    }
    replace(app.textFields["ابحث بالاسم أو الوصف"].firstMatch, with: "لاتطبيقبهذاالاسمالتجريبي", app: app)
    XCTAssertTrue(app.staticTexts["لا توجد تطبيقات تطابق البحث والتصفية."].firstMatch.waitForExistence(timeout: 5))
    press("مسح البحث والتصفية", app: app)
    XCTAssertEqual(try count(#"^([0-9]+) تطبيق$"#, app: app), total)
    let image = app.images.allElementsBoundByIndex.first { !$0.label.isEmpty && $0.isHittable && $0.frame.height >= 100 }
    XCTAssertNotNil(image, "A visible app icon must have a real native image element; pixels still need visual review.")
    capture("government-app-filter-description-and-icon-no-store-open", app: app)
  }

  @MainActor
  func testWebsiteDirectoryCategoryLayoutAndEmptySearchWithoutOpeningWebsites() throws {
    let app = open("sites")
    let original = try websiteCounts(app)
    XCTAssertGreaterThan(original.total, 0)
    let category = try categoryControl(app: app)
    let categoryLabel = category.label
    activate(category, app: app)
    XCTAssertTrue(until { category.isSelected })
    let filtered = try websiteCounts(app, allowZero: true)
    XCTAssertLessThanOrEqual(filtered.total, original.total)
    press("قائمة", app: app)
    XCTAssertTrue(app.segmentedControls.buttons["قائمة"].firstMatch.isSelected)
    XCTAssertEqual(try websiteCounts(app, allowZero: true).total, filtered.total)
    try activateHorizontalCategory(categoryLabel, app: app)
    XCTAssertEqual(try websiteCounts(app).total, original.total)
    replace(app.textFields["ابحث في المواقع السورية"].firstMatch, with: "لاموقعبهذاالاسمالتجريبي", app: app)
    XCTAssertTrue(app.staticTexts["لم يتم العثور على مواقع."].firstMatch.waitForExistence(timeout: 5))
    press("مسح البحث والتصفية", app: app)
    XCTAssertEqual(try websiteCounts(app).total, original.total)
    press("بطاقات", app: app)
    XCTAssertTrue(app.segmentedControls.buttons["بطاقات"].firstMatch.isSelected)
    capture("website-category-and-layout-without-outbound-links", app: app)
  }

  @MainActor
  func testHotelDetailAndAvailableGalleryStayInsideTheNativeApp() throws {
    let app = open("hotels")
    let detail = app.buttons["تفاصيل الفندق"].firstMatch
    XCTAssertTrue(detail.waitForExistence(timeout: 25))
    expose(detail, app: app)
    let image = try XCTUnwrap(app.images.allElementsBoundByIndex.first { !$0.label.isEmpty && $0.frame.height >= 100 && $0.frame.maxY < detail.frame.minY })
    let name = image.label
    activate(detail, app: app)
    XCTAssertTrue(app.staticTexts[name].firstMatch.waitForExistence(timeout: 20))
    XCTAssertTrue(app.images[name].firstMatch.exists)
    XCTAssertTrue(app.buttons["اقرأ المزيد على HalaSyria"].firstMatch.exists)
    let next = app.buttons["الصورة التالية"].firstMatch
    if next.waitForExistence(timeout: 3) {
      let counter = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", #"^1 / [0-9]+$"#)).firstMatch
      XCTAssertTrue(counter.exists)
      let initial = counter.label
      activate(next, app: app)
      XCTAssertTrue(app.staticTexts[initial.replacingOccurrences(of: "1 / ", with: "2 / ")].firstMatch.waitForExistence(timeout: 5))
      press("الصورة السابقة", app: app)
      XCTAssertTrue(app.staticTexts[initial].firstMatch.waitForExistence(timeout: 5))
    } else { note("Selected source hotel offers no multi-image gallery; only detail/photo rendering was exercised.") }
    // The real public detail supplies its validated selected-hotel coordinate to the shared map.
    let location = app.staticTexts["موقع الفندق"].firstMatch
    XCTAssertTrue(location.waitForExistence(timeout: 10), "This selected public hotel must expose its map context; a coordinate-less hotel cannot establish this case.")
    expose(location, app: app)
    let map = app.maps.firstMatch
    XCTAssertTrue(map.waitForExistence(timeout: 10))
    expose(map, app: app)
    XCTAssertTrue(map.exists && map.frame.width > 0 && map.frame.height >= 220 && app.frame.contains(map.frame),
      "The selected hotel's native map must be fully visible inside the current detail.")
    // Native81 exposes the SwiftUI marker as one MapKit point feature with a composed title label.
    let marker = map.otherElements.matching(NSPredicate(format: "identifier == %@ AND label == %@", "VKPointFeature", name + ", " + name))
    if marker.count != 1 {
      let note = XCTAttachment(string: map.debugDescription)
      note.name = "hotel-selected-map-marker-contract"; note.lifetime = .keepAlways; add(note)
    }
    XCTAssertEqual(marker.count, 1, "The exact observed MapKit point feature must identify the selected hotel once.")
    XCTAssertTrue(marker.firstMatch.exists && map.frame.intersects(marker.firstMatch.frame))
    capture("hotel-native-detail-selected-map-and-available-gallery-no-source-open", app: app)
  }

  @MainActor
  func testGuideRankSheetRecentSortProfileAndContributionMap() throws {
    let app = open("guides")
    press("الرتب", app: app)
    XCTAssertTrue(app.staticTexts["مكان مقبول: 15 نقطة"].firstMatch.waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts["كل صورة على مكان مقبول: 5 نقاط"].firstMatch.exists)
    press("تم", app: app)
    press("ترتيب المرشدين", app: app)
    press("النشطون مؤخراً", app: app)
    let recent = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "خلال 30 يوماً")).firstMatch
    XCTAssertTrue(recent.waitForExistence(timeout: 20))
    let profile = app.buttons["عرض الملف"].firstMatch
    expose(profile, app: app)
    let rankedName = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", #"^[0-9]+\. .+$"#)).firstMatch.label
    let separator = try XCTUnwrap(rankedName.range(of: ". "))
    let name = String(rankedName[separator.upperBound...])
    activate(profile, app: app)
    XCTAssertTrue(app.staticTexts[name].firstMatch.waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "خلال آخر 30 يوماً")).firstMatch.exists)
    XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format: "label MATCHES %@", #"^.+، المستوى [0-9]+$"#)).firstMatch.exists)
    press("عرض المساهمات على الخريطة", app: app)
    XCTAssertTrue(app.staticTexts["مساهمات \(name)"].firstMatch.waitForExistence(timeout: 20))
    XCTAssertTrue(app.buttons["عرض كل المساهمين"].firstMatch.exists)
    XCTAssertTrue(app.maps.firstMatch.waitForExistence(timeout: 20))
    capture("guide-profile-badge-and-scoped-contribution-map", app: app)
  }

  @MainActor
  func testContributorsMetricTabsAndOriginalFlagEagleArtwork() throws {
    let app = open("contributors")
    let emblem = app.buttons["عرض النسر السوري"].firstMatch
    XCTAssertTrue(emblem.waitForExistence(timeout: 20))
    expose(emblem, app: app)
    let flag = emblem.screenshot().pngRepresentation
    activate(emblem, app: app)
    let eagle = app.buttons["عرض علم سوريا"].firstMatch
    XCTAssertTrue(eagle.waitForExistence(timeout: 5))
    XCTAssertNotEqual(eagle.screenshot().pngRepresentation, flag, "The source flag/eagle control must change its rendered artwork.")
    activate(eagle, app: app)
    XCTAssertTrue(app.buttons["عرض النسر السوري"].firstMatch.waitForExistence(timeout: 5))
    for metric in ["يومي", "شهري", "سنوي", "إجمالي"] {
      press(metric, app: app)
      XCTAssertTrue(app.segmentedControls.buttons[metric].firstMatch.isSelected)
      let row = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", #"^[0-9]+ مساهمة$"#)).firstMatch
      XCTAssertTrue(row.waitForExistence(timeout: 25), "A selected period must render real ranked contribution counts.")
    }
    XCTAssertTrue(app.buttons["الملف الشخصي على GitHub"].firstMatch.exists)
    capture("contributors-periods-and-original-emblem-without-github-open", app: app)
  }

  @MainActor
  func testCrossingSearchListDetailsAndNativeMapRetainSelection() throws {
    let app = open("crossings")
    XCTAssertEqual(try count(#"^([0-9]+) منفذاً$"#, app: app), 20)
    replace(app.textFields["ابحث عن منفذ أو دولة"].firstMatch, with: "نصيب", app: app)
    XCTAssertEqual(try count(#"^([0-9]+) منفذاً$"#, app: app), 1)
    let crossing = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "منفذ نصيب الحدودي،")).firstMatch
    activate(crossing, app: app)
    XCTAssertTrue(app.buttons["إغلاق التفاصيل"].firstMatch.waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts["منفذ نصيب الحدودي"].firstMatch.exists)
    XCTAssertTrue(app.staticTexts["مسافرين وتجاري"].firstMatch.exists)
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "آخر تحديث للبيانات:")).firstMatch.exists)
    capture("crossing-source-detail-without-contact-directions-or-share", app: app)
    press("إغلاق التفاصيل", app: app)
    press("الخريطة", app: app)
    XCTAssertTrue(app.maps.firstMatch.waitForExistence(timeout: 15))
    XCTAssertEqual(try count(#"^([0-9]+) منفذاً$"#, app: app), 1)
    press("القائمة", app: app)
    XCTAssertTrue(crossing.waitForExistence(timeout: 5))
    XCTAssertEqual(app.textFields["ابحث عن منفذ أو دولة"].value as? String, "نصيب")
    capture("crossing-filter-preserved-between-native-map-and-list", app: app)
  }

  @MainActor
  func testAboutCreditsPortraitsAttributionsAndInternalPrivacyLink() throws {
    let app = open("about")
    for name in ["هادي الأحمد", "نور صوفناتي"] {
      let portrait = app.images[name].firstMatch
      XCTAssertTrue(portrait.waitForExistence(timeout: 10))
      expose(portrait, app: app)
      XCTAssertGreaterThanOrEqual(portrait.frame.height, 60)
    }
    capture("about-source-portrait-elements-for-visual-review", app: app)
    for heading in ["الفريق المؤسس", "المساهمون والإسنادات (Contributors)", "مشروع مفتوح المصدر (MIT License)", "حقوق الموارد والأيقونات (Attributions)"] {
      let item = app.staticTexts[heading].firstMatch
      XCTAssertTrue(item.waitForExistence(timeout: 10))
      expose(item, app: app)
    }
    let sfSymbols = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@ AND label CONTAINS %@", "SF Symbols", "UIKit")).firstMatch
    expose(sfSymbols, app: app)
    XCTAssertTrue(sfSymbols.exists)
    XCTAssertTrue(app.buttons["تحميل الهوية البصرية (Brand Kit)"].firstMatch.exists)
    press("سياسة الخصوصية", app: app)
    XCTAssertTrue(app.staticTexts["البيانات التي نقوم بتخزينها"].firstMatch.waitForExistence(timeout: 10))
    capture("about-original-attribution-and-native-privacy-navigation", app: app)
  }

  @MainActor
  func testPrivacyAllSectionsAndNativeMapAnalyticsFactsRemainReadable() throws {
    let app = open("privacy")
    for title in ["مقدمة عامة", "حسابات المستخدمين والمصادقة (Google OAuth)", "البيانات التي نقوم بتخزينها", "ميزات خاصة وصلاحيات المتصفح", "أدوات الطرف الثالث ومعالجة البيانات"] {
      let heading = app.staticTexts[title].firstMatch
      XCTAssertTrue(heading.waitForExistence(timeout: 10))
      expose(heading, app: app)
    }
    let map = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "خرائط Apple عبر MapKit")).firstMatch
    expose(map, app: app)
    let analytics = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "لا تتضمن نسخة iOS الحالية حزمة Google Analytics")).firstMatch
    expose(analytics, app: app)
    XCTAssertTrue(map.exists)
    XCTAssertTrue(analytics.exists)
    XCTAssertTrue(app.buttons["إدارة تفضيلات الخصوصية على الموقع"].firstMatch.exists)
    capture("privacy-native-map-and-browser-scoped-analytics-facts", app: app)
  }

  @MainActor
  func testTermsAllSevenSectionsScrollToTheFinalDisclaimer() throws {
    let app = open("terms")
    for title in ["قبول الشروط والاستخدام العام", "حسابات المستخدمين والسلوك المقبول", "استوديو الترانزيت وحقوق المساهمة", "دليل \"مشوار\" ومساهمات الأماكن والفنادق", "الألعاب والسلوك فيها", "بوصلة سوريا والنتائج المشتركة", "إخلاء المسؤولية وحدودها"] {
      let heading = app.staticTexts[title].firstMatch
      XCTAssertTrue(heading.waitForExistence(timeout: 10))
      expose(heading, app: app)
    }
    let finalText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "انقطاع الخدمة: لا نتحمل المسؤولية عن أي انقطاع مؤقت أو دائم")).firstMatch
    expose(finalText, app: app)
    XCTAssertTrue(finalText.isHittable)
    capture("terms-complete-seven-section-scroll", app: app)
  }

  @MainActor
  func testStatisticsOpenNativeLeaderboardAndAnonymousCompassDataOnly() throws {
    var app = open("stats")
    press("إحصائيات تير ليست الحكومة", app: app)
    let former = app.segmentedControls.buttons["السابقون"].firstMatch
    XCTAssertTrue(former.waitForExistence(timeout: 20))
    activate(former, app: app)
    XCTAssertTrue(former.isSelected)
    XCTAssertTrue(app.buttons["اذهب للتقييم"].firstMatch.exists)
    XCTAssertFalse(app.buttons["إرسال التصويت"].exists)
    capture("statistics-native-leaderboard-filter-without-voting", app: app)
    app = open("stats")
    press("إحصاءات بوصلة سوريا", app: app)
    let total = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "إجمالي المشاركات:")).firstMatch
    XCTAssertTrue(until(timeout: 25) { total.exists || app.staticTexts["لا توجد إحصاءات بعد"].firstMatch.exists })
    if total.exists {
      let axis = app.staticTexts["المتوسط على المحاور"].firstMatch
      expose(axis, app: app, dismissObservedLatePopup: true)
      XCTAssertTrue(axis.exists)
      XCTAssertTrue(app.buttons["المتوسط حسب طول الاختبار"].firstMatch.exists)
    } else { note("The live source has zero shared Compass results; empty-state navigation only was exercised.") }
    XCTAssertFalse(app.buttons["حفظ النتيجة في حسابي"].exists)
    capture("statistics-public-compass-aggregates-without-submission", app: app)
  }

  @MainActor
  private func open(_ section: String) -> XCUIApplication {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate()
    app.open(URL(string: "syrianzone://feature/\(section)")!)
    for identifier in ["zone.syrian.ios", "com.apple.springboard", "com.apple.mobilesafari", "com.apple.SafariViewService"] {
      let prompt = XCUIApplication(bundleIdentifier: identifier).buttons["Open"].firstMatch
      if prompt.exists { prompt.tap(); break }
    }
    XCTAssertFalse(app.staticTexts["account.fixture.origin"].exists, "Use the ordinary product bundle for these public reads.")
    XCTAssertFalse(app.staticTexts["adapter.fixture"].exists)
    quiet(app, timeout: 2)
    return app
  }

  @MainActor
  private func press(_ title: String, app: XCUIApplication) { activate(app.buttons[title].firstMatch, app: app) }

  @MainActor
  private func activate(_ element: XCUIElement, app: XCUIApplication) {
    quiet(app)
    XCTAssertTrue(element.waitForExistence(timeout: 15))
    expose(element, app: app)
    XCTAssertTrue(element.isEnabled)
    element.tap()
  }

  @MainActor
  private func replace(_ field: XCUIElement, with value: String, app: XCUIApplication) {
    XCTAssertTrue(field.waitForExistence(timeout: 15))
    expose(field, app: app)
    field.tap()
    let clear = field.buttons.matching(NSPredicate(format: "label == %@", "مسح النص"))
    if !emptySearch(field, clearButtonPresent: clear.count != 0) {
      XCTAssertTrue(clear.firstMatch.waitForExistence(timeout: 5))
      XCTAssertEqual(clear.count, 1)
      XCTAssertTrue(clear.firstMatch.isEnabled && clear.firstMatch.isHittable)
      clear.firstMatch.tap()
    }
    let empty = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      self.emptySearch(field, clearButtonPresent: clear.count != 0)
    }, object: field)
    XCTAssertEqual(XCTWaiter.wait(for: [empty], timeout: 5), .completed, "The actual native SearchField must be empty before entering its full query.")
    field.typeText(value + "\n")
    XCTAssertEqual(field.value as? String, value, "Search input must receive the complete source-derived query.")
  }

  @MainActor
  private func emptySearch(_ field: XCUIElement, clearButtonPresent: Bool) -> Bool {
    guard !clearButtonPresent else { return false }
    guard let value = field.value else { return true }
    guard let text = value as? String else { return false }
    return text.isEmpty || (field.placeholderValue?.isEmpty == false && text == field.placeholderValue)
  }

  @MainActor
  private func categoryControl(app: XCUIApplication) throws -> XCUIElement {
    let row = try horizontalRow(app)
    return try XCTUnwrap(row.buttons.allElementsBoundByIndex.first { $0.label != "الكل" && $0.label != "All" && $0.isHittable },
      "A source category must be exposed inside its horizontal filter row.")
  }

  @MainActor
  private func horizontalControl(_ label: String, app: XCUIApplication) throws -> XCUIElement {
    let row = try horizontalRow(app)
    // Header scoping prevents confusing this RN checkbox with an outbound
    // store button of the same name. Its exact AX role remains unobserved.
    return try XCTUnwrap(row.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label))
      .allElementsBoundByIndex.first { $0.elementType != .staticText && $0.elementType != .image })
  }

  @MainActor
  private func horizontalRow(_ app: XCUIApplication) throws -> XCUIElement {
    quiet(app)
    let row = app.scrollViews.allElementsBoundByIndex.first { $0.isHittable && $0.frame.height >= 30 && $0.frame.height <= 140 && $0.frame.width > $0.frame.height * 2 }
    return try XCTUnwrap(row, "The source horizontal category/filter ScrollView has not yet been observed in a native hierarchy.")
  }

  @MainActor
  private func activateHorizontalCategory(_ label: String, app: XCUIApplication) throws {
    let row = try horizontalRow(app)
    let buttons = row.buttons.matching(NSPredicate(format: "label == %@", label))
    XCTAssertTrue(buttons.firstMatch.waitForExistence(timeout: 15))
    XCTAssertEqual(buttons.count, 1, "The same source category must remain unique after the layout remount.")
    for _ in 0..<16 {
      let viewport = row.frame.intersection(app.frame), target = buttons.firstMatch.frame
      if buttons.firstMatch.isHittable && viewport.contains(target) { break }
      XCTAssertTrue(!viewport.isEmpty && viewport.width > viewport.height * 2)
      let origin = app.coordinate(withNormalizedOffset: .zero)
      let left = origin.withOffset(CGVector(dx: viewport.minX + viewport.width * 0.25, dy: viewport.midY))
      let right = origin.withOffset(CGVector(dx: viewport.minX + viewport.width * 0.75, dy: viewport.midY))
      if target.minX < viewport.minX { left.press(forDuration: 0.05, thenDragTo: right) }
      else if target.maxX > viewport.maxX { right.press(forDuration: 0.05, thenDragTo: left) }
      else { break }
    }
    XCTAssertEqual(buttons.count, 1)
    XCTAssertTrue(buttons.firstMatch.isEnabled && buttons.firstMatch.isHittable
      && row.frame.intersection(app.frame).contains(buttons.firstMatch.frame),
      "The exact original category must be visible inside its actual horizontal row before a native tap.")
    buttons.firstMatch.tap()
  }

  @MainActor
  private func count(_ pattern: String, app: XCUIApplication, allowZero: Bool = false, emptyLabel: String? = nil) throws -> Int {
    let regex = try NSRegularExpression(pattern: pattern)
    var result: Int?
    XCTAssertTrue(until(timeout: 25) {
      if allowZero, let emptyLabel, app.staticTexts[emptyLabel].firstMatch.exists { result = 0; return true }
      for element in app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", pattern)).allElementsBoundByIndex {
        let label = element.label as NSString
        if let match = regex.firstMatch(in: element.label, range: NSRange(location: 0, length: label.length)),
          let number = Int(label.substring(with: match.range(at: 1))), allowZero || number > 0 { result = number; return true }
      }
      return false
    }, "A real source result count must load: \(pattern)")
    return try XCTUnwrap(result)
  }

  @MainActor
  private func websiteCounts(_ app: XCUIApplication, allowZero: Bool = false) throws -> (visible: Int, total: Int) {
    let element = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", #"^عرض [0-9]+ من [0-9]+ موقع$"#)).firstMatch
    var result: (visible: Int, total: Int)?
    XCTAssertTrue(until(timeout: 25) {
      guard element.exists else { return false }
      let values = element.label.split(separator: " ").compactMap { Int($0) }
      guard values.count == 2, let visible = values.first, let total = values.last, allowZero || total > 0 else { return false }
      result = (visible, total)
      return true
    })
    return try XCTUnwrap(result)
  }

  @MainActor
  private func expose(_ element: XCUIElement, app: XCUIApplication, dismissObservedLatePopup: Bool = false) {
    quiet(app)
    var latePopupDismissed = false
    for _ in 0..<16 {
      if dismissObservedLatePopup && !latePopupDismissed {
        let popup = app.buttons["إخفاء التنبيه لهذه الزيارة"].firstMatch
        if popup.exists && popup.isEnabled && popup.isHittable {
          popup.tap()
          latePopupDismissed = true
          XCTAssertTrue(until { !popup.exists }, "The observed late campaign must disappear after visit-only quieting.")
        }
      }
      let containers = app.scrollViews.containing(NSPredicate(format: "elementType == %lu AND label == %@", element.elementType.rawValue, element.label)).allElementsBoundByIndex
      let scroll = containers.last(where: { !$0.frame.intersection(app.frame).isEmpty }) ?? app.scrollViews.firstMatch
      guard scroll.exists else { break }
      var viewport = scroll.frame.intersection(app.frame).insetBy(dx: 0, dy: 8)
      let keyboard = app.keyboards.firstMatch
      if keyboard.exists && keyboard.frame.minY > viewport.minY { viewport.size.height = min(viewport.maxY, keyboard.frame.minY) - viewport.minY }
      let target = element.frame
      if element.isHittable && (viewport.contains(target) || target.height > viewport.height && viewport.contains(CGPoint(x: target.midX, y: target.midY))) { return }
      let origin = app.coordinate(withNormalizedOffset: .zero)
      let top = origin.withOffset(CGVector(dx: viewport.maxX - 8, dy: viewport.minY + viewport.height * 0.25))
      let bottom = origin.withOffset(CGVector(dx: viewport.maxX - 8, dy: viewport.minY + viewport.height * 0.75))
      if target.minY < viewport.minY { top.press(forDuration: 0.05, thenDragTo: bottom) }
      else if target.maxY > viewport.maxY { bottom.press(forDuration: 0.05, thenDragTo: top) }
      else { break }
    }
    XCTAssertTrue(element.isHittable, "Source control not exposed; inspect actual AX type/frame before changing the selector: \(element.label)")
  }

  @MainActor
  private func quiet(_ app: XCUIApplication, timeout: TimeInterval = 0) {
    let button = app.buttons["إخفاء التنبيه لهذه الزيارة"].firstMatch
    if timeout > 0 ? button.waitForExistence(timeout: timeout) : button.exists {
      XCTAssertTrue(button.isHittable)
      button.tap()
    }
  }

  @MainActor
  private func until(timeout: TimeInterval = 5, _ predicate: @escaping () -> Bool) -> Bool {
    let expectation = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in predicate() }, object: nil)
    return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
  }

  @MainActor
  private func capture(_ name: String, app: XCUIApplication) {
    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.name = name; screenshot.lifetime = .keepAlways; add(screenshot)
    let tree = XCTAttachment(string: app.debugDescription)
    tree.name = name + "-AX"; tree.lifetime = .keepAlways; add(tree)
  }

  private func note(_ text: String) {
    let attachment = XCTAttachment(string: text)
    attachment.name = "unverified-source-dependent-substep"
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}
