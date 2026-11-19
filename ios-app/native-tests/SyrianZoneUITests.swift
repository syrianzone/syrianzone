import XCTest

final class SyrianZoneUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func testHomepageLaunchResponsiveness() throws {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    let options = XCTMeasureOptions()
    options.iterationCount = 3
    measure(metrics: [XCTApplicationLaunchMetric(waitUntilResponsive: true)], options: options) {
      app.terminate()
      app.launch()
      XCTAssertTrue(app.buttons["إعدادات الرئيسية"].waitForExistence(timeout: 15))
    }
  }

  @MainActor
  func testHomeSearchOpensMishwar() {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.launch()

    let scroll = app.scrollViews.firstMatch
    let search = app.textFields["ابحث في المساحة السورية"]
    XCTAssertTrue(search.waitForExistence(timeout: 15))
    for _ in 0..<4 where !search.isHittable { scroll.swipeUp() }
    search.tap()
    search.typeText("Mishwar\n")
    XCTAssertEqual((search.value as? String)?.lowercased(), "mishwar")
    XCTAssertTrue(app.staticTexts["الأقسام"].waitForExistence(timeout: 5))

    let result = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "مشوار،")).firstMatch
    XCTAssertTrue(result.waitForExistence(timeout: 5))
    for _ in 0..<4 where !result.isHittable { scroll.swipeUp() }
    result.tap()

    XCTAssertTrue(app.staticTexts["أماكن تستحق المشوار في سوريا"].waitForExistence(timeout: 10))
    attach("home-search-mishwar", app: app)
  }

  @MainActor
  func testHomepageToolbarThemesAndSearch() throws {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.launch()
    let system = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let deny = system.alerts.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] %@", "Don")).firstMatch
    if deny.waitForExistence(timeout: 2) { deny.tap() }

    let settings = app.buttons["إعدادات الرئيسية"]
    XCTAssertTrue(settings.waitForExistence(timeout: 15))
    XCTAssertTrue(settings.isEnabled && settings.isHittable)
    XCTAssertGreaterThan(settings.frame.height, 0)
    XCTAssertLessThanOrEqual(settings.frame.height, 64)
    attach("homepage-initial", app: app)
    try openHomeSettingsAtMeasuredHostEdge(settings, app: app)
    XCTAssertTrue(app.staticTexts["إعدادات الرئيسية"].waitForExistence(timeout: 5))
    let light = app.segmentedControls.buttons["فاتح"].firstMatch
    XCTAssertTrue(light.waitForExistence(timeout: 5))
    light.tap()
    attach("settings-light", app: app)
    app.buttons["تم"].firstMatch.tap()
    attach("homepage-light", app: app)

    let search = app.textFields["ابحث في المساحة السورية"]
    XCTAssertTrue(search.waitForExistence(timeout: 5))
    search.tap()
    search.typeText("Damascus")
    attach("homepage-search-entered", app: app)
    XCTAssertEqual(search.value as? String, "Damascus")
    XCTAssertTrue(app.staticTexts["مدن النقل"].waitForExistence(timeout: 15))
    attach("homepage-search", app: app)
    app.buttons["مسح النص"].firstMatch.tap()
    search.typeText("\n")
    for _ in 0..<4 where !settings.isHittable { app.scrollViews.firstMatch.swipeDown() }
    settings.tap()
    app.segmentedControls.buttons["داكن"].firstMatch.tap()
    app.buttons["تم"].firstMatch.tap()
    attach("homepage-dark", app: app)
  }

  @MainActor
  private func openHomeSettingsAtMeasuredHostEdge(_ settings: XCUIElement, app: XCUIApplication) throws {
    let buttons = app.buttons.matching(NSPredicate(format: "label == %@", "إعدادات الرئيسية"))
    guard buttons.count == 1, settings.isEnabled, settings.isHittable else {
      throw NSError(domain: "HomeIconHit", code: 1, userInfo: [NSLocalizedDescriptionKey: "The actual unique Home settings button must be available."])
    }
    let buttonFrame = settings.frame
    let center = CGPoint(x: buttonFrame.midX, y: buttonFrame.midY)
    let hosts = app.otherElements.containing(NSPredicate(format: "elementType == %lu AND label == %@", XCUIElement.ElementType.button.rawValue, "إعدادات الرئيسية"))
    let frames = hosts.allElementsBoundByIndex.map(\.frame).filter {
      abs($0.width - 44) <= 0.5 && abs($0.height - 44) <= 0.5 && $0.contains(center) && app.frame.contains($0)
    }
    let uniqueFrames = frames.reduce(into: [CGRect]()) { values, frame in if !values.contains(frame) { values.append(frame) } }
    guard uniqueFrames.count == 1, let host = uniqueFrames.first, app.frame.contains(buttonFrame), !buttonFrame.isEmpty else {
      throw NSError(domain: "HomeIconHit", code: 1, userInfo: [NSLocalizedDescriptionKey: "The actual Home icon must expose one distinct measured 44-point ancestor frame. No hit area is inferred from its smaller Button AX frame."])
    }
    let candidates = [CGPoint(x: host.midX, y: host.minY + 2), CGPoint(x: host.midX, y: host.maxY - 2)]
    guard let point = candidates.first(where: { host.contains($0) && !buttonFrame.contains($0) }),
      settings.frame == buttonFrame, buttons.count == 1, settings.isEnabled, settings.isHittable else {
      throw NSError(domain: "HomeIconHit", code: 1, userInfo: [NSLocalizedDescriptionKey: "A genuine inside-host point outside the Button AX frame is required immediately before the Home callback tap."])
    }
    let metadata = XCTAttachment(data: try JSONSerialization.data(withJSONObject: ["buttonFrame": String(describing: buttonFrame),
      "hostFrame": String(describing: host), "matchingAncestorCount": frames.count, "distinctHostFrameCount": uniqueFrames.count,
      "tapPoint": [point.x, point.y], "insideHost": true, "outsideButtonAX": true], options: [.sortedKeys, .prettyPrinted]), uniformTypeIdentifier: "public.json")
    metadata.name = "homepage-actual-host-edge-callback-precondition"; metadata.lifetime = .keepAlways; add(metadata)
    app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: point.x - app.frame.minX, dy: point.y - app.frame.minY)).tap()
  }

  @MainActor
  func testPublicSectionNavigation() throws {
    let sections: [(String, String)] = [
      ("games", "الألعاب"), ("phonebook", "دليل الهاتف"),
      ("sites", "المواقع السورية"), ("govapps", "تطبيقات حكومية"),
      ("contributors", "أفضل المساهمين في GitHub"),
      ("crossings", "المنافذ الحدودية"), ("priorities", "سوريا حسب أولوياتك"),
      ("party", "دليل المنظمات السياسية السورية"), ("house", "مجلس الشعب"),
      ("justice", "العدالة الانتقالية"), ("compass", "بوصلة سوريا"),
      ("atlas", "أطلس سوريا التفاعلي"), ("promises", "عداد الوعود"),
      ("muslim", "الركن الإسلامي"), ("muslim_prayer", "مواقيت الصلاة"),
      ("muslim_radio", "إذاعة القرآن"), ("roznama", "الروزنامة السورية"),
      ("board", "مساحتي"), ("hotels", "الفنادق"), ("guides", "المرشدون المحليون"),
      ("stats", "إحصائيات المنصة")
    ]
    visitSections(sections)
  }

  @MainActor
  func testRemainingPublicSections() throws {
    visitSections([
      ("promises", "عداد الوعود"), ("muslim", "الركن الإسلامي"),
      ("muslim_prayer", "مواقيت الصلاة"), ("muslim_radio", "إذاعة القرآن"),
      ("roznama", "الروزنامة السورية"), ("board", "مساحتي"),
      ("hotels", "الفنادق"), ("guides", "المرشدون المحليون"),
      ("stats", "إحصائيات المنصة"), ("about", "عن المنصة"),
      ("privacy", "سياسة الخصوصية"), ("terms", "الشروط والأحكام")
    ])
  }

  @MainActor
  private func visitSections(_ sections: [(String, String)]) {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    let monitor = addUIInterruptionMonitor(withDescription: "Open Syrian Zone") { alert in
      if alert.buttons["Open"].exists { alert.buttons["Open"].tap(); return true }
      return false
    }
    defer { removeUIInterruptionMonitor(monitor) }
    dismissOwnLinkPrompt()
    app.launch()
    for (section, heading) in sections {
      app.open(URL(string: "syrianzone://feature/\(section)")!)
      dismissOwnLinkPrompt()
      XCTAssertTrue(app.staticTexts[heading].firstMatch.waitForExistence(timeout: 20), section)
      attach("section-\(section)", app: app)
      let back = app.navigationBars.buttons["رجوع"].firstMatch
      if back.exists { back.tap() }
    }
  }

  @MainActor
  func testQuranRenderingPagingAndFocus() throws {
    dismissOwnLinkPrompt()
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.open(URL(string: "syrianzone://feature/muslim_quran?page=1")!)
    dismissOwnLinkPrompt()
    let ayah = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "سورة 1، آية 1،")).firstMatch
    XCTAssertTrue(ayah.waitForExistence(timeout: 30))
    let bookmarks = app.buttons["العلامات"]
    let preferences = app.buttons["الانتقال وإعدادات التلاوة"]
    XCTAssertLessThanOrEqual(bookmarks.frame.width, 48)
    XCTAssertFalse(bookmarks.frame.intersects(preferences.frame))
    attach("quran-page-1", app: app)
    app.buttons["الصفحة التالية"].tap()
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "صفحة 2 /")).firstMatch.waitForExistence(timeout: 15))
    attach("quran-page-2", app: app)
    app.buttons["وضع التركيز"].tap()
    XCTAssertTrue(app.buttons["إظهار أدوات القراءة"].waitForExistence(timeout: 5))
    attach("quran-focus", app: app)
    app.buttons["إظهار أدوات القراءة"].tap()
  }

  @MainActor
  func testDeepLinkOpensAtlas() throws {
    dismissOwnLinkPrompt()
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.open(URL(string: "syrianzone://feature/atlas")!)
    dismissOwnLinkPrompt()
    XCTAssertTrue(app.staticTexts["أطلس سوريا التفاعلي"].firstMatch.waitForExistence(timeout: 20))
    attach("atlas-content", app: app)
  }

  @MainActor
  private func dismissOwnLinkPrompt() {
    for identifier in ["zone.syrian.ios", "com.apple.springboard", "com.apple.mobilesafari", "com.apple.SafariViewService"] {
      let application = XCUIApplication(bundleIdentifier: identifier)
      let open = application.buttons["Open"].firstMatch
      if open.exists { open.tap(); return }
    }
  }

  @MainActor
  func testHomepageOpensNativeGames() throws {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.launch()
    let games = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "الألعاب،")).firstMatch
    XCTAssertTrue(games.waitForExistence(timeout: 15))
    for _ in 0..<5 where !games.isHittable { app.scrollViews.firstMatch.swipeUp() }
    games.tap()
    XCTAssertTrue(app.buttons["2048، تلعب على جهازك"].waitForExistence(timeout: 5))
    attach("native-games", app: app)
  }

  @MainActor
  private func attach(_ name: String, app: XCUIApplication) {
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}
