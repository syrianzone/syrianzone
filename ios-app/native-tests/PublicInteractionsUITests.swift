import XCTest

// Run serially against the product entry. These tests use public reads and local
// game state. They never create rooms, submit contributions or change an account.
final class PublicInteractionsUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func test2048LegalSwipeRulesAndFocus() throws {
    let app = open("feature/2048")
    let board = app.otherElements["لوحة 2048"].firstMatch
    XCTAssertTrue(board.waitForExistence(timeout: 15))
    reveal(board, app: app)
    let initial = tileValues(board: board, app: app)
    var observations: [[String: Any]] = [["stage": "initial", "values": initial, "boardFrame": reader2048Frame(board.frame) as Any? ?? NSNull()]]
    if initial.count != 2 { diagnose2048Reader(board: board, app: app, observations: observations, reason: "initial-count") }
    XCTAssertEqual(initial.count, 2)
    let initialMass = initial.reduce(0, +)
    var moved = false
    for (start, end) in [
      (CGVector(dx: 0.8, dy: 0.5), CGVector(dx: 0.2, dy: 0.5)),
      (CGVector(dx: 0.5, dy: 0.8), CGVector(dx: 0.5, dy: 0.2)),
      (CGVector(dx: 0.2, dy: 0.5), CGVector(dx: 0.8, dy: 0.5)),
      (CGVector(dx: 0.5, dy: 0.2), CGVector(dx: 0.5, dy: 0.8))
    ] {
      quietPopup(app)
      reveal(board, app: app)
      board.coordinate(withNormalizedOffset: start).press(forDuration: 0.05, thenDragTo: board.coordinate(withNormalizedOffset: end))
      var polls: [[Int]] = [], lastValues: [Int] = [], pollCount = 0
      let changed = waitUntil(timeout: 2, {
        lastValues = self.tileValues(board: board, app: app)
        pollCount += 1
        if polls.count < 16 { polls.append(lastValues) }
        return lastValues.reduce(0, +) > initialMass
      })
      observations.append(["stage": "after-swipe", "start": [start.dx, start.dy], "end": [end.dx, end.dy],
        "values": lastValues, "pollValues": polls, "pollCount": pollCount, "pollsTruncated": pollCount > polls.count, "massIncreased": changed,
        "boardFrame": reader2048Frame(board.exists ? board.frame : .zero) as Any? ?? NSNull()])
      if changed { moved = true; break }
    }
    if !moved { diagnose2048Reader(board: board, app: app, observations: observations, reason: "mass-not-increased") }
    XCTAssertTrue(moved, "A legal swipe must spawn a tile. Merges preserve tile mass.")
    attach("2048-after-legal-swipe", app: app)
    tap("القوانين", app: app)
    XCTAssertTrue(app.staticTexts["قوانين 2048"].waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts["الهدف بلوغ ٢٠٤٨، ويمكن متابعة اللعب بعده."].exists)
    tap("تم", app: app)
    tap("تركيز", app: app)
    XCTAssertTrue(app.buttons["إنهاء التركيز"].waitForExistence(timeout: 5))
    XCTAssertFalse(app.navigationBars.firstMatch.exists)
    tap("إنهاء التركيز", app: app)
    tap("لعبة جديدة", app: app)
    reveal(board, app: app)
    XCTAssertTrue(waitUntil { self.tileValues(board: board, app: app).count == 2 })
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "النقاط 0 ")).firstMatch.exists)
  }

  @MainActor
  func testSolitaireStockMoveUndoHintAndNewDeal() throws {
    let app = open("feature/solitare")
    let stock = app.buttons["المخزون، 24 ورقة، اسحب ورقة"]
    XCTAssertTrue(stock.waitForExistence(timeout: 15))
    tap(stock, app: app)
    XCTAssertTrue(app.buttons["المخزون، 23 ورقة، اسحب ورقة"].waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "الحركات 1 ")).firstMatch.exists)
    tap("تراجع", app: app)
    XCTAssertTrue(stock.waitForExistence(timeout: 5))
    XCTAssertFalse(app.buttons["تراجع"].isEnabled)
    tap("تلميح", app: app)
    let hint = app.staticTexts.matching(NSPredicate(format: "label IN %@", ["الورقة المحددة يمكن نقلها إلى الخانة المضيئة.", "اسحب ورقة من المخزون.", "لا توجد حركات متاحة."])).firstMatch
    XCTAssertTrue(hint.waitForExistence(timeout: 5))
    tap(stock, app: app)
    tap("لعبة جديدة", app: app)
    XCTAssertTrue(stock.waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "الحركات 0 ")).firstMatch.exists)
    XCTAssertTrue(app.buttons["العمود 7، 7 ورقة"].exists)
    attach("solitaire-new-deal-after-draw-and-undo", app: app)
  }

  @MainActor
  func testTarneebBidTrumpAndLegalLocalCard() throws {
    let app = open("feature/tarneeb")
    XCTAssertTrue(app.buttons["خيارات"].waitForExistence(timeout: 15))
    // An AI can end an auction at 13 before the human acts. Start another local
    // deal if necessary; no seed or alternate game engine is installed by tests.
    var hasBid = false
    for attempt in 0..<4 {
      if app.buttons["مرّر"].waitForExistence(timeout: 6) { hasBid = true; break }
      if attempt < 3 { tap("خيارات", app: app); tap("لعبة جديدة", app: app) }
    }
    XCTAssertTrue(hasBid, "A human auction turn was not reached within four local deals.")
    tap("13", app: app)
    XCTAssertTrue(app.staticTexts["اختر الحكم"].waitForExistence(timeout: 5))
    tap("♠", app: app)
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "أنت طلب 13، الحكم ♠")).firstMatch.waitForExistence(timeout: 5))
    playOneHandCard(app: app)
    tap("الإحصائيات", app: app)
    XCTAssertTrue(app.staticTexts["الدست 1"].waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts["فريقك 0، الخصوم 0، الهدف ٤١"].exists)
    attach("tarneeb-local-bid-trump-play-and-stats", app: app)
    tap("تم", app: app)
  }

  @MainActor
  func testTrixTeamModeAndLegalLocalTurn() throws {
    let app = open("feature/trix")
    XCTAssertTrue(app.buttons["خيارات"].waitForExistence(timeout: 15))
    tap("خيارات", app: app)
    let teams = app.segmentedControls.buttons["فريقين"].firstMatch
    XCTAssertTrue(teams.waitForExistence(timeout: 5))
    teams.tap()
    XCTAssertTrue(app.staticTexts["شريكك"].waitForExistence(timeout: 5))
    if app.buttons["اللطوش"].waitForExistence(timeout: 2) { tap("اللطوش", app: app) }
    let table = app.otherElements["طاولة اللعب"].firstMatch
    XCTAssertTrue(table.waitForExistence(timeout: 5))
    for _ in 0..<5 where !firstLegalHandCard(app: app).exists { scrollGameUp(app) }
    var playable = false
    for _ in 0..<20 {
      if waitUntil(timeout: 2, { self.firstLegalHandCard(app: app).exists }) { playable = true; break }
      // A shedding deal can require several legal passes before a playable rank
      // arrives. Only an actually offered pass/continue is performed.
      if app.buttons["باس"].exists { tap("باس", app: app) }
      else if app.buttons["كمّل"].exists { tap("كمّل", app: app) }
    }
    XCTAssertTrue(playable, "A playable local turn was not reached within twenty offered control steps.")
    playOneHandCard(app: app)
    tap("الإحصائيات", app: app)
    XCTAssertTrue(app.staticTexts["المملكة 1"].waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "فريقك:")).firstMatch.exists)
    attach("trix-team-mode-after-local-turn", app: app)
    tap("تم", app: app)
  }

  @MainActor
  func testIdentityProvinceVectorZoomAndCancelledExports() throws {
    let app = open("feature/syid?page=map")
    tap("تحميل الخريطة", app: app, timeout: 15)
    let map = app.otherElements["خريطة المحافظات، اسحب للتحريك واقرص للتكبير"].firstMatch
    XCTAssertTrue(map.waitForExistence(timeout: 5))
    reveal(map, app: app)
    let original = map.screenshot().pngRepresentation
    tap("تكبير", app: app)
    XCTAssertTrue(waitUntil { map.screenshot().pngRepresentation != original }, "Zoom must change the original vector's rendered geometry.")
    tap("ملاءمة الخريطة", app: app)
    tap("المحافظة", app: app)
    tap("دمشق", app: app)
    XCTAssertTrue(app.staticTexts["دمشق"].firstMatch.waitForExistence(timeout: 5))
    attach("syid-damascus-original-vector", app: app)
    for format in ["تصدير SVG", "تصدير GeoJSON"] {
      tap(format, app: app)
      attach("syid-share-\(format)", app: app)
      let outside = app.otherElements["PopoverDismissRegion"].firstMatch
      if outside.waitForExistence(timeout: 3) { outside.tap() }
      else {
        let cancel = app.buttons.matching(NSPredicate(format: "label IN %@", ["Close", "إغلاق", "Cancel", "إلغاء"])).firstMatch
        XCTAssertTrue(cancel.waitForExistence(timeout: 10), "System share sheet for \(format)")
        cancel.tap()
      }
      XCTAssertTrue(app.buttons[format].waitForExistence(timeout: 5))
    }
  }

  @MainActor
  func testTransitCityRouteReadAndNativeMapControls() throws {
    let app = open("transit")
    let damascus = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "دمشق،")).firstMatch
    XCTAssertTrue(damascus.waitForExistence(timeout: 25))
    tap(damascus, app: app)
    XCTAssertTrue(app.textFields["ابحث عن خط، موقف، أو مكان"].waitForExistence(timeout: 20))
    let route = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", " موقف")).firstMatch
    XCTAssertTrue(route.waitForExistence(timeout: 20))
    let routeName = route.label.components(separatedBy: "، ").first!
    tap(route, app: app)
    XCTAssertTrue(app.buttons["كل الخطوط"].waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts[routeName].firstMatch.exists)
    XCTAssertTrue(app.buttons["مشاركة الخط"].exists)
    tap("الخريطة", app: app)
    let map = app.maps.firstMatch
    XCTAssertTrue(map.waitForExistence(timeout: 10))
    reveal(map, app: app)
    map.pinch(withScale: 1.3, velocity: 1)
    let stops = app.switches["إظهار المواقف"].firstMatch
    reveal(stops, app: app)
    XCTAssertTrue(stops.exists)
    let previous = String(describing: stops.value)
    // Adapter-controls10 verified both boolean callbacks at this left-side RTL
    // track position. The full AX row includes blank space at its center.
    stops.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0.5))
      .withOffset(CGVector(dx: min(CGFloat(31), stops.frame.width / 2), dy: 0)).tap()
    XCTAssertTrue(waitUntil { String(describing: stops.value) != previous })
    attach("transit-selected-route-map-stops-toggle", app: app)
    tap("القائمة", app: app)
    tap("كل الخطوط", app: app)
    XCTAssertTrue(route.waitForExistence(timeout: 10))
  }

  @MainActor
  func testMishwarCoordinateSearchMapListAndPlaceDetail() throws {
    let app = open("places?view=list&q=33.5138%2C36.2765")
    let search = app.textFields["ابحث عن مكان أو إحداثيات"]
    XCTAssertTrue(search.waitForExistence(timeout: 20))
    XCTAssertEqual(search.value as? String, "33.5138,36.2765")
    let coordinate = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "الانتقال إلى 33.5138, 36.2765")).firstMatch
    tap(coordinate, app: app)
    let map = app.maps.firstMatch
    XCTAssertTrue(map.waitForExistence(timeout: 10))
    reveal(map, app: app)
    map.pinch(withScale: 1.3, velocity: 1)
    tap("القائمة", app: app)
    XCTAssertTrue(app.segmentedControls.buttons["الأحدث"].firstMatch.waitForExistence(timeout: 5))
    // The native clear control exists only while this SearchField is editing.
    tap(search, app: app)
    XCTAssertEqual(search.value as? String, "33.5138,36.2765")
    let clear = search.buttons.matching(NSPredicate(format: "label == %@", "مسح النص"))
    XCTAssertTrue(waitUntil { clear.count == 1 && clear.firstMatch.isEnabled && clear.firstMatch.isHittable })
    clear.firstMatch.tap()
    XCTAssertTrue(waitUntil {
      let value = search.value as? String
      let nativeEmpty = value == nil || value == "" || (search.placeholderValue?.isEmpty == false && value == search.placeholderValue)
      return nativeEmpty && clear.count == 0 && !coordinate.exists
    }, "The real clear action must empty native input and remove its controlled coordinate suggestion.")
    search.typeText("\n")
    XCTAssertTrue(waitUntil { !app.keyboards.firstMatch.exists })
    tap("الأكثر حفظاً", app: app)
    let place = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", " حفظ")).firstMatch
    XCTAssertTrue(place.waitForExistence(timeout: 25))
    let placeName = place.label.components(separatedBy: "، ").first!
    tap(place, app: app)
    XCTAssertTrue(app.staticTexts[placeName].firstMatch.waitForExistence(timeout: 20))
    XCTAssertTrue(app.buttons["نسخ الإحداثيات"].waitForExistence(timeout: 20))
    attach("mishwar-public-detail-after-search-map-list", app: app)
  }

  @MainActor
  func testGuessWhoReadOnlyLobbyControls() throws {
    let app = open("feature/guesswho")
    let create = app.buttons["أنشئ غرفة اللعب"]
    XCTAssertTrue(create.waitForExistence(timeout: 20))
    XCTAssertFalse(create.isEnabled)
    tap(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "عشوائي من كل الفئات")).firstMatch, app: app)
    XCTAssertTrue(waitUntil(timeout: 20) { create.isEnabled })
    tap("انضم لصديق", app: app)
    XCTAssertTrue(app.textFields["رمز الغرفة"].waitForExistence(timeout: 5))
    XCTAssertFalse(app.buttons["انضم للعب"].isEnabled)
    attach("guesswho-read-only-lobby-no-room-created", app: app)
  }

  @MainActor
  func testShawarmaOriginalRankingAndRestaurantSheet() throws {
    let app = open("feature/shawarma")
    let restaurant = app.buttons["Just Shawarma، الفئة S"]
    XCTAssertTrue(restaurant.waitForExistence(timeout: 15))
    XCTAssertTrue(app.buttons["Alger، الفئة S"].exists)
    tap(restaurant, app: app)
    XCTAssertTrue(app.buttons["عرض حساب المطعم"].waitForExistence(timeout: 5))
    XCTAssertTrue(app.images["Just Shawarma"].exists)
    XCTAssertTrue(app.staticTexts["Instagram"].exists)
    attach("shawarma-original-logo-restaurant-sheet", app: app)
    tap("إغلاق", app: app)
    let last = app.buttons["Alaga، الفئة C"]
    tap(last, app: app)
    XCTAssertTrue(app.staticTexts["Facebook"].waitForExistence(timeout: 5))
    attach("shawarma-original-tier-c-restaurant-sheet", app: app)
    tap("إغلاق", app: app)
  }

  @MainActor
  private func open(_ path: String) -> XCUIApplication {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate()
    app.launch()
    app.open(URL(string: "syrianzone://\(path)")!)
    for identifier in ["zone.syrian.ios", "com.apple.springboard", "com.apple.mobilesafari", "com.apple.SafariViewService"] {
      let prompt = XCUIApplication(bundleIdentifier: identifier).buttons["Open"].firstMatch
      if prompt.exists { prompt.tap(); break }
    }
    quietPopup(app, timeout: 2)
    return app
  }

  @MainActor
  private func tileValues(board: XCUIElement, app: XCUIApplication) -> [Int] {
    guard board.exists else { return [] }
    let bounds = board.frame
    guard [bounds.minX, bounds.minY, bounds.width, bounds.height].allSatisfy({ $0.isFinite }), bounds.width > 0, bounds.height > 0 else { return [] }
    let identified = app.descendants(matching: .any).matching(NSPredicate(format: "identifier MATCHES %@", #"2048\.tile\.[1-9][0-9]*"#))
    let candidates = identified.allElementsBoundByAccessibilityElement
    guard (1...16).contains(candidates.count) else { return [] }
    var seen = Set<String>(), frames: [CGRect] = [], values: [(id: Int, value: Int)] = []
    for candidate in candidates {
      let identifier = candidate.identifier
      guard let id = Int(identifier.replacingOccurrences(of: "2048.tile.", with: "")), id > 0, seen.insert(identifier).inserted else { return [] }
      let matches = identified.matching(identifier: identifier)
      guard matches.count == 1 else { return [] }
      let tile = matches.firstMatch
      guard tile.exists else { return [] }
      let frame = tile.frame
      guard [frame.minX, frame.minY, frame.width, frame.height].allSatisfy({ $0.isFinite }), frame.width > 0, frame.height > 0,
        bounds.contains(frame), !frames.contains(where: { $0.intersects(frame) }) else { return [] }
      let texts = tile.descendants(matching: .staticText).allElementsBoundByAccessibilityElement
      let numbers = texts.compactMap { Int($0.label) }
      guard !texts.isEmpty, numbers.count == texts.count, numbers.allSatisfy({ $0 >= 2 && $0.nonzeroBitCount == 1 }),
        Set(numbers).count == 1, let number = numbers.first else { return [] }
      frames.append(frame); values.append((id: id, value: number))
    }
    let final = identified.allElementsBoundByAccessibilityElement
    guard final.count == seen.count, Set(final.map(\.identifier)) == seen else { return [] }
    // Source IDs identify one live tile. Identical attributed-text host/child
    // values count once. NativeMotion separately rejects extra accessible cells.
    return values.sorted { $0.id < $1.id }.map(\.value)
  }

  @MainActor
  private func diagnose2048Reader(board: XCUIElement, app: XCUIApplication, observations: [[String: Any]], reason: String) {
    let exists = board.exists, bounds = exists ? board.frame : .zero
    var candidates: [[String: Any]] = [], positions = Set<String>()
    let identified = exists ? app.descendants(matching: .any).matching(NSPredicate(format: "identifier MATCHES %@", #"2048\.tile\.[1-9][0-9]*"#)).allElementsBoundByAccessibilityElement : []
    for tile in identified.prefix(64) {
      let identifier = tile.identifier
      let recognized = identifier.range(of: #"^2048\.tile\.[1-9][0-9]*$"#, options: .regularExpression) != nil
      let actualFrame = tile.frame
      let texts = tile.descendants(matching: .staticText).allElementsBoundByAccessibilityElement
      let numbers = texts.compactMap { Int($0.label) }.filter { $0 >= 2 && $0.nonzeroBitCount == 1 }
      let duplicate = !positions.insert("\(actualFrame.midX),\(actualFrame.midY)").inserted
      var candidate: [String: Any] = ["identifier": recognized ? identifier : "unrecognized", "values": numbers,
        "numericTextCount": numbers.count, "invalidTextCount": texts.count - numbers.count, "duplicateCenter": duplicate, "exists": tile.exists]
      candidate["frame"] = reader2048Frame(actualFrame) as Any? ?? NSNull()
      candidates.append(candidate)
    }
    let metadata: [String: Any] = ["reason": reason, "observations": observations, "boardExists": exists,
      "boardFrame": reader2048Frame(bounds) as Any? ?? NSNull(), "appFrame": reader2048Frame(app.frame) as Any? ?? NSNull(),
      "freshIdentifiedTiles": candidates, "identifiedTileCount": identified.count, "identifiedTilesTruncated": identified.count > candidates.count,
      "limits": "The poll arrays are the mass reader outputs. Identified tiles and frames are a separate fresh failure observation, not an atomic AX snapshot or proof of gesture delivery. NativeMotion separately checks extra accessible cells."]
    if let data = try? JSONSerialization.data(withJSONObject: metadata, options: [.sortedKeys, .prettyPrinted]) {
      let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
      attachment.name = "2048-public-mass-reader-failure"; attachment.lifetime = .keepAlways; add(attachment)
    }
  }

  private func reader2048Frame(_ value: CGRect) -> [String: Double]? {
    guard [value.minX, value.minY, value.width, value.height].allSatisfy({ $0.isFinite }) else { return nil }
    return ["x": Double(value.minX), "y": Double(value.minY), "width": Double(value.width), "height": Double(value.height)]
  }

  @MainActor
  private func firstLegalHandCard(app: XCUIApplication) -> XCUIElement {
    let table = app.otherElements["طاولة اللعب"].firstMatch
    let cards = app.buttons.matching(NSPredicate(format: "enabled == true AND label MATCHES %@", "(A|[2-9]|10|J|Q|K) (بستوني|كبة|ديناري|سباتي)"))
    return cards.allElementsBoundByIndex.last(where: { $0.frame.minY >= table.frame.maxY && $0.isHittable }) ?? cards.element(boundBy: cards.count)
  }

  @MainActor
  private func playOneHandCard(app: XCUIApplication) {
    let instruction = app.staticTexts["أوراقك، المس الورقة لتحديدها ثم المسها ثانية للعب، أو اسحبها إلى الطاولة."].firstMatch
    reveal(instruction, app: app)
    for _ in 0..<4 where !firstLegalHandCard(app: app).exists { scrollGameUp(app) }
    XCTAssertTrue(waitUntil(timeout: 12) { self.firstLegalHandCard(app: app).exists }, "Human must have a legal card on turn.")
    let name = firstLegalHandCard(app: app).label
    // The selected card moves in the AX sibling order. Re-resolve its exact
    // unique rank/suit for both real taps and the selection assertion.
    let matching = app.buttons.matching(NSPredicate(format: "label == %@", name))
    let card = matching.firstMatch
    reveal(card, app: app)
    let count = handCardCount(app: app)
    XCTAssertEqual(matching.count, 1)
    XCTAssertTrue(card.frame.minY >= app.otherElements["طاولة اللعب"].firstMatch.frame.maxY && card.isEnabled && card.isHittable)
    card.tap()
    XCTAssertTrue(waitUntil { matching.count == 1 && card.isSelected && self.handCardCount(app: app) == count && card.frame.minY >= app.otherElements["طاولة اللعب"].firstMatch.frame.maxY }, "First tap selects the same \(name) without consuming it.")
    XCTAssertTrue(card.isEnabled && card.isHittable)
    card.tap()
    XCTAssertTrue(waitUntil { !card.exists || !card.isSelected }, "Second tap must commit the selected legal card.")
    XCTAssertTrue(waitUntil { self.handCardCount(app: app) == count - 1 }, "Playing a legal card must remove exactly one card from the human hand.")
    attach("local-card-play-\(name)", app: app)
  }

  @MainActor
  private func handCardCount(app: XCUIApplication) -> Int {
    let table = app.otherElements["طاولة اللعب"].firstMatch
    return app.buttons.matching(NSPredicate(format: "label MATCHES %@", "(A|[2-9]|10|J|Q|K) (بستوني|كبة|ديناري|سباتي)"))
      .allElementsBoundByIndex.filter { $0.frame.minY >= table.frame.maxY }.count
  }

  @MainActor
  private func tap(_ label: String, app: XCUIApplication, timeout: TimeInterval = 5) {
    tap(app.buttons[label].firstMatch, app: app, timeout: timeout)
  }

  @MainActor
  private func tap(_ element: XCUIElement, app: XCUIApplication, timeout: TimeInterval = 5) {
    quietPopup(app)
    XCTAssertTrue(element.waitForExistence(timeout: timeout))
    reveal(element, app: app)
    XCTAssertTrue(waitUntil(timeout: timeout) { element.isEnabled })
    element.tap()
  }

  @MainActor
  private func reveal(_ element: XCUIElement, app: XCUIApplication) {
    quietPopup(app)
    // A partly exposed board is hittable but its normalized swipe coordinates
    // can still fall under another view. Bring the whole target into its actual
    // scroll viewport, and choose direction from geometry rather than guessing.
    for _ in 0..<12 {
      let containers = app.scrollViews.containing(element.elementType, identifier: element.label).allElementsBoundByIndex
      let scroll = containers.last(where: { !$0.frame.intersection(app.frame).isEmpty }) ?? app.scrollViews.firstMatch
      guard scroll.exists else { break }
      let viewport = scroll.frame.intersection(app.frame).insetBy(dx: 0, dy: 8)
      let target = element.frame
      if element.isHittable && (viewport.contains(target) || target.height > viewport.height && viewport.contains(CGPoint(x: target.midX, y: target.midY))) { return }
      let origin = app.coordinate(withNormalizedOffset: .zero)
      let top = origin.withOffset(CGVector(dx: viewport.maxX - 8, dy: viewport.minY + viewport.height * 0.25))
      let bottom = origin.withOffset(CGVector(dx: viewport.maxX - 8, dy: viewport.minY + viewport.height * 0.75))
      if target.minY < viewport.minY { top.press(forDuration: 0.05, thenDragTo: bottom) }
      else if target.maxY > viewport.maxY { bottom.press(forDuration: 0.05, thenDragTo: top) }
      else { break }
      quietPopup(app)
    }
    XCTAssertTrue(element.isHittable, "Target is not exposed: \(element.label), frame \(element.frame)")
  }

  @MainActor
  private func scrollGameUp(_ app: XCUIApplication) {
    quietPopup(app)
    let scroll = app.scrollViews.firstMatch
    // Native09 verified the physical right gutter in RTL. Keep the drag
    // eight points inside it, outside cards and the 2048 board.
    let viewport = scroll.frame.intersection(app.frame), origin = app.coordinate(withNormalizedOffset: .zero)
    origin.withOffset(CGVector(dx: viewport.maxX - 8, dy: viewport.minY + viewport.height * 0.75)).press(forDuration: 0.05,
      thenDragTo: origin.withOffset(CGVector(dx: viewport.maxX - 8, dy: viewport.minY + viewport.height * 0.25)))
  }

  @MainActor
  private func quietPopup(_ app: XCUIApplication, timeout: TimeInterval = 0) {
    let quiet = app.buttons["إخفاء التنبيه لهذه الزيارة"].firstMatch
    let exists = timeout > 0 ? quiet.waitForExistence(timeout: timeout) : quiet.exists
    guard exists else { return }
    XCTAssertTrue(quiet.isHittable, "Visit-only popup dismissal must be reachable without changing a persisted preference.")
    quiet.tap()
    XCTAssertTrue(waitUntil { !quiet.exists })
  }

  @MainActor
  private func waitUntil(timeout: TimeInterval = 5, _ predicate: @escaping () -> Bool) -> Bool {
    let expectation = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in predicate() }, object: nil)
    return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
  }

  @MainActor
  private func attach(_ name: String, app: XCUIApplication) {
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}
