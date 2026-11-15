import XCTest

// Requires --fixture account. The inherited launcher verifies the exact local
// origin and synthetic member before any document or anonymous-statistics write.
final class NativeCivicUITests: LocalFixtureTestCase {
  @MainActor
  func testPrioritiesAllocationComparisonAndLocalStory() throws {
    let app = try launch("member", id: 101)
    open("priorities", app: app)
    XCTAssertTrue(app.staticTexts["الموزّع: 0 من100"].firstMatch.waitForExistence(timeout: 15))
    let allocation = app.sliders["نقاط الملف الاقتصادي ومعالجة الفساد"].firstMatch
    expose(allocation, app: app)
    // Recorded RTL zero is the right thumb; an in-track drag stopped at 97.
    let end = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(
      dx: max(app.frame.minX + 1, allocation.frame.minX - 20) - app.frame.minX,
      dy: allocation.frame.midY - app.frame.minY))
    allocation.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).press(forDuration: 0.1,
      thenDragTo: end)
    let maximum = until { self.nativeDigits(allocation.value as? String ?? "") == "100" }
    if !maximum {
      let details = XCTAttachment(string: "Slider: \(allocation.debugDescription)\nFrame: \(allocation.frame)\n\(app.debugDescription)")
      details.name = "priorities-slider-endpoint-failure"
      details.lifetime = .keepAlways; add(details)
      capture("priorities-slider-endpoint-failure", app: app)
    }
    XCTAssertTrue(maximum)
    XCTAssertTrue(app.staticTexts["الموزّع: 100 من100"].firstMatch.waitForExistence(timeout: 5))
    let salaries = app.switches["تحسين الرواتب وإصلاح هيكل التوظيف الحكومي"].firstMatch
    expose(salaries, app: app)
    activateToggle(salaries, app: app)
    XCTAssertTrue(until { (salaries.value as? String) == "1" })
    // Collapse only this in-memory plan's panels to reach the computed result.
    for title in topicTitles { press(title, app: app) }
    let profile = app.staticTexts["مُحرك عجلة الحياة والاقتصاد الحر"].firstMatch
    expose(profile, app: app)
    XCTAssertTrue(profile.exists)
    press("نموذج المقارنة", app: app)
    press("تكنوقراط مجلس التنمية والأعمال", app: app)
    XCTAssertTrue(app.staticTexts["الخط المتصل: خطتك. الخط المتقطع: تكنوقراط مجلس التنمية والأعمال"].firstMatch.waitForExistence(timeout: 5))
    press("بطاقة للمشاركة", app: app)
    let artwork = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "بطاقة أولوياتي: مُحرك عجلة الحياة والاقتصاد الحر.")).firstMatch
    XCTAssertTrue(artwork.waitForExistence(timeout: 5))
    XCTAssertTrue(artwork.label.contains("الملف الاقتصادي ومعالجة الفساد 100 بالمئة"))
    capture("priorities-local-computed-story", app: app)
    press("إغلاق البطاقة", app: app)
    XCTAssertFalse(app.buttons["إغلاق البطاقة"].exists)
    assertLocal(app, user: "member", id: 101)
  }

  @MainActor
  func testPrioritiesEnforcesFiveSubfilesWithoutChangingTheBudget() throws {
    let app = try launch("member", id: 101)
    open("priorities", app: app)
    let choices = [
      "تحسين الرواتب وإصلاح هيكل التوظيف الحكومي",
      "تمكين القطاع الخاص وجذب الاستثمارات الخارجية",
      "إنقاذ قطاعي الزراعة والصناعة المحلية",
      "الرقابة الداخلية ومحاكمة الفاسدين",
      "كشف مصير المفقودين والمعتقلين ورعاية الأيتام"
    ]
    XCTAssertTrue(app.staticTexts["الموزّع: 0 من100"].firstMatch.waitForExistence(timeout: 15))
    for name in choices {
      let toggle = app.switches[name].firstMatch
      expose(toggle, app: app)
      activateToggle(toggle, app: app)
      XCTAssertTrue(until { (toggle.value as? String) == "1" }, name)
    }
    let sixth = app.switches["محاكمة مجرمي الحرب واستجوابهم"].firstMatch
    expose(sixth, app: app)
    activateToggle(sixth, app: app)
    XCTAssertTrue(until { (sixth.value as? String) == "0" })
    let limit = app.staticTexts["خمسة ملفات فرعية كحد أقصى"].firstMatch
    expose(limit, app: app)
    XCTAssertTrue(limit.exists)
    XCTAssertTrue(app.staticTexts["المتبقي: 100 نقطة. الملفات المختارة: 5 من5."].firstMatch.exists)
    capture("priorities-five-subfile-boundary", app: app)
  }

  @MainActor
  func testCompassQuestionProgressionAndAnonymousLocalResult() throws {
    let app = try launch("member", id: 101)
    open("compass", app: app)
    let start = hittableButton("ابدأ اختباراً جديداً", app: app)
    XCTAssertTrue(start.waitForExistence(timeout: 20))
    XCTAssertTrue(until(timeout: 20) { start.isEnabled })
    // Preserve any synthetic document left by another explicitly selected case.
    let resume = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "استكمال النسخة")).firstMatch
    if resume.exists || app.buttons["عرض النتيجة"].exists {
      throw XCTSkip("The local fixture already has Compass progress/history. Preserve it and run this case with a fresh fixture scope.")
    }
    press("طول الاختبار", app: app)
    let short = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "قصيرة (")).firstMatch
    press(short, app: app)
    assertLocal(app, user: "member", id: 101)
    press("ابدأ اختباراً جديداً", app: app)
    let progress = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "السؤال 1 من")).firstMatch
    XCTAssertTrue(progress.waitForExistence(timeout: 10))
    let pattern = try NSRegularExpression(pattern: "من([0-9]+)")
    let label = progress.label as NSString
    let match = try XCTUnwrap(pattern.firstMatch(in: progress.label, range: NSRange(location: 0, length: label.length)))
    let count = try XCTUnwrap(Int(label.substring(with: match.range(at: 1))))
    XCTAssertGreaterThan(count, 2)
    XCTAssertLessThanOrEqual(count, 100)
    for number in 1...count {
      let question = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "السؤال \(number) من")).firstMatch
      XCTAssertTrue(question.waitForExistence(timeout: 10))
      press("محايد", app: app)
      XCTAssertTrue(app.buttons["✓ محايد"].firstMatch.waitForExistence(timeout: 5))
      if number == 1 {
        press("التالي", app: app)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "السؤال 2 من")).firstMatch.waitForExistence(timeout: 5))
        press("السابق", app: app)
        XCTAssertTrue(app.buttons["✓ محايد"].firstMatch.waitForExistence(timeout: 5))
      }
      if number == count {
        // The source final action posts anonymous statistics automatically.
        // Its only allowed destination here is the verified local fixture.
        assertLocal(app, user: "member", id: 101)
        press("عرض نتيجتي", app: app)
      } else { press("التالي", app: app) }
    }
    let plot = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "المحور الأفقي ")).firstMatch
    XCTAssertTrue(plot.waitForExistence(timeout: 20))
    XCTAssertFalse(plot.label.contains("غير مجاب"))
    XCTAssertTrue(app.buttons["حفظ النتيجة في حسابي"].firstMatch.exists)
    XCTAssertFalse(app.buttons["إزالة النتيجة من الحساب"].exists)
    // Do not press account-save, delete, sign-in or an external share action.
    capture("compass-local-anonymous-result-no-account-adoption", app: app)
    assertLocal(app, user: "member", id: 101)
  }

  @MainActor
  func testParliamentGraphicLegendFiltersTheActualRoster() throws {
    let app = try launch("member", id: 101)
    open("house", app: app)
    press("توزيع المقاعد حسب", app: app)
    press("الجنس", app: app)
    let chart = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@ AND label CONTAINS %@", "مقعداً.", "إناث")).firstMatch
    XCTAssertTrue(chart.waitForExistence(timeout: 15))
    let female = app.buttons.matching(NSPredicate(format: "label MATCHES %@", "إناث \\([0-9]+\\)")).firstMatch
    XCTAssertTrue(female.waitForExistence(timeout: 10))
    let count = try XCTUnwrap(Int(female.label.components(separatedBy: "(").last!.replacingOccurrences(of: ")", with: "")))
    XCTAssertGreaterThan(count, 0)
    press(female, app: app)
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "✓ إناث (")).firstMatch.waitForExistence(timeout: 5))
    let roster = app.staticTexts["قائمة الأعضاء (\(count))"].firstMatch
    expose(roster, app: app)
    XCTAssertTrue(roster.exists)
    capture("parliament-hemicycle-gender-filtered-roster", app: app)
    press("مسح البحث والتصفية", app: app)
    XCTAssertFalse(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "✓ إناث (")).firstMatch.exists)
  }

  @MainActor
  func testAtlasProvinceComparisonLayerAndVectorSelection() throws {
    let app = try launch("member", id: 101)
    open("atlas", app: app)
    press("اختيار محافظة", app: app)
    press(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "دمشق:")).firstMatch, app: app)
    XCTAssertTrue(until { self.hasStaticDigits("عدد السكان:", digits: "120000", app: app) }, "Require the isolated synthetic Damascus population baseline")
    let comparison = app.switches["تحديد للمقارنة"].firstMatch
    expose(comparison, app: app)
    activateToggle(comparison, app: app)
    XCTAssertTrue(until { (comparison.value as? String) == "1" })
    let inlineLayout = XCTAttachment(string: app.debugDescription)
    inlineLayout.name = "atlas-inline-hosts-before-second-province"
    inlineLayout.lifetime = .keepAlways
    add(inlineLayout)
    capture("atlas-inline-hosts-before-second-province", app: app)
    press("اختيار محافظة", app: app)
    press(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "حلب:")).firstMatch, app: app)
    expose(comparison, app: app)
    activateToggle(comparison, app: app)
    let comparisonTitle = app.staticTexts["مقارنة المحافظتين"].firstMatch
    expose(comparisonTitle, app: app)
    XCTAssertTrue(comparisonTitle.exists)
    XCTAssertTrue(until { self.hasStaticDigits("دمشق:", digits: "120000", app: app) })
    XCTAssertTrue(until { self.hasStaticDigits("حلب:", digits: "340000", app: app) })
    capture("atlas-two-province-comparison", app: app)
    press("طبقة البيانات", app: app)
    press("معدل الهطول المطري", app: app)
    XCTAssertFalse(comparisonTitle.exists)
    press("الخريطة", app: app)
    let provinceLabel = "دمشق، معدل الهطول المطري: ١٣٠ مم. اضغط لعرض البيانات."
    let province = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", provinceLabel)).firstMatch
    XCTAssertTrue(province.waitForExistence(timeout: 15))
    XCTAssertEqual(nativeDigits(province.label), "130", "The vector must expose the latest synthetic rainfall value")
    let mapOwners = app.scrollViews.containing(province.elementType, identifier: provinceLabel).allElementsBoundByIndex
    let mapScroll = try XCTUnwrap(mapOwners.last(where: { !$0.frame.intersection(app.frame).isEmpty }))
    let mapViewport = mapScroll.frame.intersection(app.frame).insetBy(dx: 0, dy: 8), provinceFrame = province.frame
    let mapTouch = CGPoint(x: provinceFrame.midX, y: provinceFrame.midY)
    let vectorGeometry = XCTAttachment(string: "Province: \(provinceLabel)\nFrame: \(provinceFrame)\nVisible map viewport: \(mapViewport)\nTouch: \(mapTouch)")
    vectorGeometry.name = "atlas-damascus-vector-touch-geometry"; vectorGeometry.lifetime = .keepAlways; add(vectorGeometry)
    XCTAssertFalse(provinceFrame.isEmpty)
    XCTAssertTrue(mapViewport.contains(provinceFrame), "The entire Damascus shape must be inside the visible map before touching it.")
    // SVG routes Path touches through its root. The recorded Damascus frame center is inside its polygon.
    app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: mapTouch.x - app.frame.minX, dy: mapTouch.y - app.frame.minY)).tap()
    XCTAssertTrue(until { app.segmentedControls.buttons["البيانات"].firstMatch.isSelected })
    XCTAssertTrue(app.staticTexts["دمشق"].firstMatch.waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts["2025: 130.0 مم، المتوسط 100.0 مم"].firstMatch.waitForExistence(timeout: 5))
    capture("atlas-rainfall-vector-selection-opens-province-data", app: app)
  }

  @MainActor
  func testBoardOwnDashboardWidgetDragAndConfiguration() throws {
    let app = try launch("member", id: 101)
    open("board", app: app)
    let picker = app.buttons["اللوحة الحالية"].firstMatch
    XCTAssertTrue(picker.waitForExistence(timeout: 20))
    let selectedName = picker.staticTexts.firstMatch
    XCTAssertTrue(selectedName.waitForExistence(timeout: 5))
    let originalName = selectedName.label
    XCTAssertFalse(originalName.isEmpty)
    let ownName = "مدني " + String(UUID().uuidString.prefix(6))
    press("إدارة اللوحات", app: app)
    let name = app.textFields["اسم اللوحة"].firstMatch
    XCTAssertTrue(name.waitForExistence(timeout: 5))
    replace(name, with: ownName)
    XCTAssertEqual(name.value as? String, ownName)
    assertLocal(app, user: "member", id: 101)
    press("إضافة لوحة فارغة بهذا الاسم", app: app)
    press("تم", app: app)
    XCTAssertTrue(app.staticTexts["اللوحة فارغة. أضف ويدجت للبدء."].firstMatch.waitForExistence(timeout: 10))
    press("إضافة ويدجت", app: app)
    // Source-order first entry is Weather, with multiple instances allowed.
    XCTAssertTrue(app.staticTexts["الطقس"].firstMatch.waitForExistence(timeout: 5))
    press(app.buttons["إضافة"].firstMatch, app: app)
    press("التصنيف", app: app)
    press("الإنتاجية والشخصي", app: app)
    XCTAssertTrue(app.staticTexts["مؤقّت بومودورو"].firstMatch.waitForExistence(timeout: 5))
    press(app.buttons["إضافة"].firstMatch, app: app)
    press("تم", app: app)
    press("تعديل اللوحة", app: app)
    let weather = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "ترتيب الطقس")).firstMatch
    let pomodoro = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "ترتيب مؤقّت بومودورو")).firstMatch
    expose(pomodoro, app: app)
    XCTAssertTrue(weather.isHittable && pomodoro.isHittable)
    XCTAssertLessThan(weather.frame.minY, pomodoro.frame.minY)
    weather.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).press(forDuration: 0.3, thenDragTo: pomodoro.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.7)))
    XCTAssertTrue(until(timeout: 10) { weather.frame.minY > pomodoro.frame.minY }, "Dragging must change the two test widgets' actual order.")
    press(app.buttons["إعدادات وحجم الويدجت"].firstMatch, app: app)
    let minutes = app.sliders["دقائق العمل"].firstMatch
    XCTAssertTrue(minutes.waitForExistence(timeout: 5))
    XCTAssertTrue(minutes.isHittable)
    let minutesLabel = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "دقائق العمل:")).firstMatch
    XCTAssertTrue(minutesLabel.waitForExistence(timeout: 5))
    let currentMinutes = try XCTUnwrap(Double(nativeDigits(minutesLabel.label))), minimum = 5.0, maximum = 90.0
    XCTAssertTrue((minimum...maximum).contains(currentMinutes))
    let thumbX = CGFloat(1 - (currentMinutes - minimum) / (maximum - minimum)), targetX: CGFloat = 0.7
    XCTAssertGreaterThan(abs(thumbX - targetX), 0.02, "The RTL slider drag must target a different value.")
    let old = try XCTUnwrap(minutes.value as? String)
    let sliderGeometry = XCTAttachment(string: "Frame: \(minutes.frame)\nMinutes: \(currentMinutes)\nRange: \(minimum)...\(maximum)\nRTL thumb X: \(thumbX)\nTarget X: \(targetX)")
    sliderGeometry.name = "board-work-minutes-rtl-drag-geometry"; sliderGeometry.lifetime = .keepAlways; add(sliderGeometry)
    minutes.coordinate(withNormalizedOffset: CGVector(dx: thumbX, dy: 0.5)).press(forDuration: 0.1,
      thenDragTo: minutes.coordinate(withNormalizedOffset: CGVector(dx: targetX, dy: 0.5)))
    XCTAssertTrue(until { guard let value = minutes.value as? String else { return false }; return value != old })
    let updated = try XCTUnwrap(minutes.value as? String)
    press("تم", app: app)
    press(app.buttons["إعدادات وحجم الويدجت"].firstMatch, app: app)
    XCTAssertEqual(minutes.value as? String, updated)
    capture("board-own-dashboard-drag-and-persisted-widget-config", app: app)
    press("تم", app: app)
    press("إنهاء التعديل", app: app)
    press("إدارة اللوحات", app: app)
    XCTAssertEqual(name.value as? String, ownName, "Only the test-created dashboard may be deleted.")
    press("حذف اللوحة الحالية", app: app)
    let deletion = app.alerts.buttons["حذف"].firstMatch
    XCTAssertTrue(deletion.waitForExistence(timeout: 5))
    deletion.tap()
    XCTAssertTrue(until { !app.alerts.firstMatch.exists })
    XCTAssertTrue(until { picker.staticTexts.firstMatch.label != ownName })
    if picker.staticTexts.firstMatch.label != originalName {
      press("اللوحة الحالية", app: app)
      press(originalName, app: app)
    }
    XCTAssertTrue(until { picker.staticTexts.firstMatch.label == originalName })
    assertLocal(app, user: "member", id: 101)
  }

  private let topicTitles = [
    "💼 الملف الاقتصادي ومعالجة الفساد", "⚖️ العدالة الانتقالية والمفقودين والتعافي",
    "🏡 أزمة السكن العاجل وإعادة الإعمار", "🛡️ الأمن، فرض القانون ومكافحة الجريمة",
    "🏛️ الإصلاح السياسي والسيادة والتجنيس", "🌐 الرقمنة والمواصلات والبنية التحتية"
  ]

  @MainActor
  private func hittableButton(_ title: String, app: XCUIApplication) -> XCUIElement {
    let matches = app.buttons.matching(NSPredicate(format: "identifier == %@ OR label == %@", title, title))
    return matches.allElementsBoundByIndex.last(where: { $0.isHittable }) ?? matches.firstMatch
  }

  @MainActor
  private func press(_ title: String, app: XCUIApplication) { press(hittableButton(title, app: app), app: app) }

  @MainActor
  private func press(_ element: XCUIElement, app: XCUIApplication) {
    expose(element, app: app)
    XCTAssertTrue(until { element.isEnabled })
    element.tap()
  }

  @MainActor
  private func activateToggle(_ toggle: XCUIElement, app: XCUIApplication) {
    expose(toggle, app: app)
    XCTAssertTrue(toggle.isEnabled)
    // Adapter-controls10 proved ON/OFF boolean callbacks and AX value changes
    // here. NativeThemeHost is explicitly RTL; its full AX row center is blank.
    toggle.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0.5))
      .withOffset(CGVector(dx: min(CGFloat(31), toggle.frame.width / 2), dy: 0)).tap()
  }

  @MainActor
  private func expose(_ element: XCUIElement, app: XCUIApplication) {
    XCTAssertTrue(element.waitForExistence(timeout: 15))
    var lastViewport = CGRect.null
    var ownerKey = ""
    for _ in 0..<24 {
      let quiet = app.buttons["إخفاء التنبيه لهذه الزيارة"].firstMatch
      if quiet.exists && quiet.isHittable { quiet.tap() }
      ownerKey = element.identifier.isEmpty ? element.label : element.identifier
      let owners = app.scrollViews.containing(element.elementType, identifier: ownerKey).allElementsBoundByIndex
      let scroll = owners.last(where: { !$0.frame.intersection(app.frame).isEmpty }) ?? app.scrollViews.firstMatch
      if !scroll.exists { break }
      let viewport = scroll.frame.intersection(app.frame).insetBy(dx: 0, dy: 8), target = element.frame
      lastViewport = viewport
      if element.isHittable && (viewport.contains(target) || target.height > viewport.height) { return }
      if viewport.contains(target) {
        if until(timeout: 5, { element.isHittable }) { return }
        break
      }
      let top = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.02, dy: 0.25))
      let bottom = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.02, dy: 0.75))
      if target.minY < viewport.minY { top.press(forDuration: 0.05, thenDragTo: bottom) }
      else if target.maxY > viewport.maxY { bottom.press(forDuration: 0.05, thenDragTo: top) }
      else { break }
    }
    if !element.isHittable {
      let details = XCTAttachment(string: "Target: \(element.debugDescription)\nIdentifier: \(element.identifier)\nOwner key: \(ownerKey)\nTarget frame: \(element.frame)\nScroll viewport: \(lastViewport)\nApp frame: \(app.frame)\n\(app.debugDescription)")
      details.name = "civic-control-failure-hierarchy"
      details.lifetime = .keepAlways
      add(details)
      capture("civic-control-failure-frame", app: app)
    }
    XCTAssertTrue(element.isHittable, "Expected visible civic control: \(element.label)")
  }

  @MainActor
  private func nativeDigits(_ text: String) -> String { text.compactMap { $0.wholeNumberValue }.map(String.init).joined() }

  @MainActor
  private func hasStaticDigits(_ prefix: String, digits: String, app: XCUIApplication) -> Bool {
    app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).allElementsBoundByIndex
      .contains { nativeDigits($0.label) == digits }
  }

  @MainActor
  private func until(timeout: TimeInterval = 5, _ condition: @escaping () -> Bool) -> Bool {
    XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in condition() }, object: nil)], timeout: timeout) == .completed
  }

  @MainActor
  private func capture(_ name: String, app: XCUIApplication) {
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}
