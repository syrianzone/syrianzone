import Foundation
import XCTest

// Public product routes and legal local controls only. No seeds or match-state injection.
final class NativeCardHandsUITests: XCTestCase {
  private let cardPattern = "(A|[2-9]|10|J|Q|K) (بستوني|كبة|ديناري|سباتي)"
  private let contracts = ["البنات", "الديناري", "اللطوش", "شيخ الكبة", "التركس"]
  private struct PlayEvidence { var cards: [String] = []; var passes = 0; var continues = 0 }
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func testTarneebThirteenLegalCardsScoreAndAdvanceOneDeal() throws {
    let app = try open("tarneeb")
    defer { app.terminate() }
    var humanAuction = false
    for attempt in 0..<4 {
      if app.buttons["مرّر"].waitForExistence(timeout: 6) { humanAuction = true; break }
      if attempt < 3 { try tap("خيارات", app: app); try tap("لعبة جديدة", app: app) }
    }
    try require(humanAuction, "A human auction turn is required within the existing four-deal bound.", app: app)
    try tap("13", app: app)
    try require(app.staticTexts["اختر الحكم"].waitForExistence(timeout: 5), "The actual human declarer must choose trump.", app: app)
    try tap("♠", app: app)
    try require(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "أنت طلب 13، الحكم ♠")).firstMatch.waitForExistence(timeout: 5), "Keep the actual human 13 contract and trump.", app: app)
    let evidence = try playAvoidanceHand(app: app, scorePrefix: "نتيجة الدست: ")
    let score = try scoreValues(prefix: "نتيجة الدست: ", count: 2, app: app)
    try require(score.contains(where: { $0 != 0 }), "A fully played non-redeal hand must expose a nonzero score.", app: app)
    let tricks = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "الطرانيب: فريقك ")).firstMatch.label
    let trickValues = tricks.components(separatedBy: CharacterSet.decimalDigits.inverted).compactMap(Int.init)
    try require(trickValues.count == 2 && trickValues.reduce(0, +) == 13, "The visible team trick counts must account for all thirteen tricks.", app: app)
    try record("tarneeb-complete-hand-before-advance", evidence: evidence, score: score, app: app)
    try tap("الدست التالي", app: app)
    try require(wait { self.handCards(app).count == 13 && !self.scoreElement(prefix: "نتيجة الدست: ", app: app).exists }, "Next deal must replace the scored hand with thirteen fresh human cards.", app: app)
    try tap("الإحصائيات", app: app)
    try require(app.staticTexts["الدست 2"].waitForExistence(timeout: 5), "Exactly one scored hand must advance the deal count once.", app: app)
    try require(app.staticTexts["فريقك \(score[0])، الخصوم \(score[1])، الهدف ٤١"].exists, "The displayed round score must carry into the match once.", app: app)
    try tap("تم", app: app)
    try record("tarneeb-next-deal-score-retained", evidence: evidence, score: score, app: app)
  }

  @MainActor
  func testTrixCompleteAvoidanceContractAndAdvanceWithRealBots() throws {
    let app = try open("trix")
    defer { app.terminate() }
    var totals = [0, 0, 0, 0]
    var contract = try awaitContract(app: app)
    if contract == "التركس" {
      // The real AI chooses shedding first. It can finish after three players
      // empty their hands, so thirteen human plays are not required here.
      let shedding = try completeShedding(app: app)
      totals = try scoreValues(prefix: "نتيجة الطلب: ", count: 4, app: app)
      try require(totals.reduce(0, +) == 500, "The completed shedding contract must expose its four placement awards.", app: app)
      try record("trix-natural-shedding-complete", evidence: shedding, score: totals, app: app)
      try advanceTrix(app: app)
      contract = try awaitContract(app: app, excluding: "التركس")
      try require(contract != "التركس", "The already completed shedding contract must be unavailable in this kingdom.", app: app)
    }
    try require(contracts.dropLast().contains(contract), "A real avoidance contract is required for thirteen human turns.", app: app)
    let evidence = try playAvoidanceHand(app: app, scorePrefix: "نتيجة الطلب: ")
    let points = try scoreValues(prefix: "نتيجة الطلب: ", count: 4, app: app)
    let expectedTotal = ["البنات": -100, "الديناري": -130, "اللطوش": -195, "شيخ الكبة": -75][contract]!
    try require(points.allSatisfy { $0 <= 0 } && points.reduce(0, +) == expectedTotal, "The visible contract penalties must account for its complete fixed total.", app: app)
    totals = zip(totals, points).map(+)
    try record("trix-thirteen-card-contract-before-advance", evidence: evidence, score: points, app: app)
    try advanceTrix(app: app)
    let next = try awaitContract(app: app, excluding: contract)
    try require(next != contract, "A completed contract cannot be chosen again in the same kingdom.", app: app)
    try tap("الإحصائيات", app: app)
    try require(app.staticTexts["المملكة 1"].waitForExistence(timeout: 5), "At most two completed contracts must remain in the first kingdom.", app: app)
    for (seat, name) in ["أنت", "الخصم ١", "اللاعب ٣", "الخصم ٢"].enumerated() {
      try require(app.staticTexts["\(name): \(totals[seat])"].exists, "Each displayed seat total must carry the completed contract scores once.", app: app)
    }
    try tap("تم", app: app)
    try record("trix-next-contract-scores-retained", evidence: evidence, score: totals, app: app)
  }

  @MainActor
  private func playAvoidanceHand(app: XCUIApplication, scorePrefix: String) throws -> PlayEvidence {
    var evidence = PlayEvidence()
    for turn in 1...13 {
      if turn > 1 {
        let nextTrick = app.buttons["كمّل"].firstMatch
        try require(nextTrick.waitForExistence(timeout: 12), "The completed trick must offer its real Continue control before the next human card.", app: app)
        try tap(nextTrick, app: app)
        evidence.continues += 1
        try require(wait { !nextTrick.exists }, "Continue must leave the paused trick.", app: app)
      }
      try require(wait(timeout: 12) { self.handCards(app).count == 14 - turn && self.legalCards(app).count > 0 }, "A real human legal turn and exact remaining hand are required.", app: app)
      evidence.cards.append(try playCard(expectedCount: 14 - turn, app: app))
    }
    try require(wait(timeout: 12) { self.scoreElement(prefix: scorePrefix, app: app).exists }, "Real bots must finish the last trick and expose scoring.", app: app)
    try require(handCards(app).isEmpty && evidence.cards.count == 13 && Set(evidence.cards).count == 13 && evidence.continues == 12, "The complete hand must consume thirteen distinct legal cards and twelve offered trick transitions.", app: app)
    return evidence
  }

  @MainActor
  private func completeShedding(app: XCUIApplication) throws -> PlayEvidence {
    var evidence = PlayEvidence()
    for _ in 0..<64 {
      if scoreElement(prefix: "نتيجة الطلب: ", app: app).exists { return evidence }
      if handCards(app).isEmpty {
        // At most 39 bot cards remain. Allow their actual legal turns to finish.
        try require(wait(timeout: 90) { self.scoreElement(prefix: "نتيجة الطلب: ", app: app).exists }, "Bots must finish after the human goes out.", app: app)
        return evidence
      }
      try require(wait(timeout: 12) { self.scoreElement(prefix: "نتيجة الطلب: ", app: app).exists || !self.legalCards(app).isEmpty || app.buttons["باس"].firstMatch.exists }, "The actual shedding deal must offer a legal card, a legal pass, or its score.", app: app)
      if scoreElement(prefix: "نتيجة الطلب: ", app: app).exists { return evidence }
      let legal = legalCards(app)
      if !legal.isEmpty { evidence.cards.append(try playCard(expectedCount: handCards(app).count, app: app)) }
      else {
        try require(app.buttons["باس"].firstMatch.exists, "Never invent a pass while a legal card is available.", app: app)
        try tap("باس", app: app)
        evidence.passes += 1
      }
    }
    throw failure("Shedding exceeded its bounded sixty-four offered human actions.", app: app)
  }

  @MainActor
  private func awaitContract(app: XCUIApplication, excluding completed: String? = nil) throws -> String {
    func freshContract() -> String? {
      guard let value = currentContract(app), value != completed else { return nil }
      return value
    }
    try require(wait(timeout: 10) { freshContract() != nil || app.buttons["اللطوش"].firstMatch.exists }, "The actual king must choose or offer a contract.", app: app)
    if freshContract() == nil {
      let choice = (["اللطوش"] + contracts).first { $0 != completed && app.buttons[$0].firstMatch.exists && app.buttons[$0].firstMatch.isEnabled }
      guard let choice else { throw failure("No actual remaining contract is offered to the human king.", app: app) }
      try tap(choice, app: app)
    }
    try require(wait(timeout: 10) { freshContract() != nil }, "The chosen fresh contract must appear in the real kingdom header.", app: app)
    return freshContract()!
  }

  @MainActor
  private func currentContract(_ app: XCUIApplication) -> String? {
    let header = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "المملكة 1، الملك ")).firstMatch
    guard header.exists else { return nil }
    return contracts.first { header.label.hasSuffix("، " + $0) }
  }

  @MainActor
  private func advanceTrix(app: XCUIApplication) throws {
    try tap("الطلب التالي", app: app)
    try require(wait { self.handCards(app).count == 13 && !self.scoreElement(prefix: "نتيجة الطلب: ", app: app).exists }, "Next contract must deal thirteen fresh human cards and clear the previous score panel.", app: app)
  }

  @MainActor
  private func scoreElement(prefix: String, app: XCUIApplication) -> XCUIElement {
    app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
  }

  @MainActor
  private func scoreValues(prefix: String, count: Int, app: XCUIApplication) throws -> [Int] {
    let label = scoreElement(prefix: prefix, app: app).label
    let parts = label.dropFirst(prefix.count).components(separatedBy: " / "), values = parts.compactMap(Int.init)
    try require(parts.count == count && values.count == count, "The actual score label must expose every scoring seat or team.", app: app)
    return values
  }

  @MainActor
  private func handCards(_ app: XCUIApplication) -> [XCUIElement] {
    let table = app.otherElements["طاولة اللعب"].firstMatch
    guard table.exists else { return [] }
    let bottom = table.frame.maxY
    return app.buttons.matching(NSPredicate(format: "label MATCHES %@", cardPattern)).allElementsBoundByIndex.filter { $0.frame.minY >= bottom }
  }

  @MainActor
  private func legalCards(_ app: XCUIApplication) -> [XCUIElement] { handCards(app).filter { $0.isEnabled } }

  @MainActor
  private func playCard(expectedCount: Int, app: XCUIApplication) throws -> String {
    guard let candidate = legalCards(app).last else { throw failure("A real enabled hand-card Button is required.", app: app) }
    let label = candidate.label
    // Selection changes native accessibility order. Keep the actual rank/suit,
    // rather than an element bound to its previous sibling index.
    let matching = app.buttons.matching(NSPredicate(format: "label == %@", label))
    let card = matching.firstMatch
    try expose(card, app: app)
    try require(matching.count == 1 && handCards(app).count == expectedCount && card.frame.minY >= app.otherElements["طاولة اللعب"].firstMatch.frame.maxY && card.isEnabled && card.isHittable, "Only the unique current legal hand card may be selected.", app: app)
    card.tap()
    try require(wait { matching.count == 1 && card.isSelected && self.handCards(app).count == expectedCount && card.frame.minY >= app.otherElements["طاولة اللعب"].firstMatch.frame.maxY }, "First tap must select the same actual card without consuming it.", app: app)
    try require(card.isEnabled && card.isHittable, "The selected legal card must remain directly tappable.", app: app)
    card.tap()
    try require(wait(timeout: 12) { self.handCards(app).count == expectedCount - 1 }, "Second tap must remove exactly one human card.", app: app)
    return label
  }

  @MainActor
  private func open(_ game: String) throws -> XCUIApplication {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate(); app.launch(); app.open(URL(string: "syrianzone://feature/\(game)")!)
    for bundle in ["zone.syrian.ios", "com.apple.springboard", "com.apple.mobilesafari", "com.apple.SafariViewService"] {
      let prompt = XCUIApplication(bundleIdentifier: bundle).buttons["Open"].firstMatch
      if prompt.exists { prompt.tap(); break }
    }
    try require(app.buttons["خيارات"].waitForExistence(timeout: 15), "The real public game must mount.", app: app)
    quiet(app)
    return app
  }

  @MainActor
  private func tap(_ title: String, app: XCUIApplication) throws { try tap(app.buttons[title].firstMatch, app: app) }

  @MainActor
  private func tap(_ button: XCUIElement, app: XCUIApplication) throws {
    try require(button.waitForExistence(timeout: 12), "The actual offered game control must exist.", app: app)
    try expose(button, app: app)
    try require(button.isEnabled && button.isHittable, "The actual game control must be enabled and hittable.", app: app)
    button.tap()
  }

  @MainActor
  private func expose(_ element: XCUIElement, app: XCUIApplication) throws {
    for attempt in 0...12 {
      quiet(app)
      let key = element.identifier.isEmpty ? element.label : element.identifier
      let owners = app.scrollViews.containing(element.elementType, identifier: key).allElementsBoundByIndex
      guard let owner = owners.last(where: { !$0.frame.intersection(app.frame).isEmpty }) else { break }
      let viewport = owner.frame.intersection(app.frame).insetBy(dx: 0, dy: 8), target = element.frame
      if element.isHittable && viewport.contains(target) { return }
      if attempt == 12 { break }
      let origin = app.coordinate(withNormalizedOffset: .zero)
      let top = origin.withOffset(CGVector(dx: viewport.maxX - 8, dy: viewport.minY + viewport.height * 0.25))
      let bottom = origin.withOffset(CGVector(dx: viewport.maxX - 8, dy: viewport.minY + viewport.height * 0.75))
      if target.minY < viewport.minY { top.press(forDuration: 0.05, thenDragTo: bottom) }
      else if target.maxY > viewport.maxY { bottom.press(forDuration: 0.05, thenDragTo: top) }
      else { break }
    }
    throw failure("The current game control could not be fully exposed in its actual scroll viewport.", app: app)
  }

  @MainActor
  private func quiet(_ app: XCUIApplication) {
    let button = app.buttons["إخفاء التنبيه لهذه الزيارة"].firstMatch
    if button.exists && button.isHittable { button.tap() }
  }

  @MainActor
  private func wait(timeout: TimeInterval = 8, _ predicate: @escaping () -> Bool) -> Bool {
    XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in predicate() }, object: nil)], timeout: timeout) == .completed
  }

  @MainActor
  private func require(_ condition: @autoclosure () -> Bool, _ message: String, app: XCUIApplication) throws {
    if !condition() { throw failure(message, app: app) }
  }

  @MainActor
  private func record(_ name: String, evidence: PlayEvidence, score: [Int], app: XCUIApplication) throws {
    let value: [String: Any] = ["playedCards": evidence.cards, "humanPlayCount": evidence.cards.count,
      "offeredPassCount": evidence.passes, "offeredContinueCount": evidence.continues, "displayedScore": score,
      "scope": "Local UI only. At most one Tarneeb hand or two Trix contracts. No full match, seed, injected state or persisted preference changes."]
    let data = XCTAttachment(data: try JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
    data.name = name + "-values"; data.lifetime = .keepAlways; add(data)
    let image = XCTAttachment(screenshot: app.screenshot()); image.name = name; image.lifetime = .keepAlways; add(image)
  }

  @MainActor
  private func failure(_ message: String, app: XCUIApplication) -> NSError {
    let note = XCTAttachment(string: message + "\n" + app.debugDescription); note.name = "card-hand-failure-AX"; note.lifetime = .keepAlways; add(note)
    let image = XCTAttachment(screenshot: app.screenshot()); image.name = "card-hand-failure-screen"; image.lifetime = .keepAlways; add(image)
    return NSError(domain: "NativeCardHand", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
}
