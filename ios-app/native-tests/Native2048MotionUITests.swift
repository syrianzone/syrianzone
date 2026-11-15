import Foundation
import XCTest

// Product entry only. Gameplay uses a new local board and never calls an account API.
final class Native2048MotionUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func testHardwareArrowLowercaseAndShiftKeysMoveThePhysicalBoard() throws {
    let app = openGame(), board = app.otherElements["لوحة 2048"].firstMatch
    XCTAssertTrue(board.waitForExistence(timeout: 15))
    reveal(board, app: app)
    var previous = try settled(board: board, app: app)
    for step in 0..<3 {
      guard let direction = preferredLegalDirection(previous) else { throw motionFailure("A legal hardware-key move is required on the new local board.") }
      quiet(app)
      if step == 0 {
        switch direction {
        case .left: app.typeKey(XCUIKeyboardKey.leftArrow, modifierFlags: [])
        case .right: app.typeKey(XCUIKeyboardKey.rightArrow, modifierFlags: [])
        case .up: app.typeKey(XCUIKeyboardKey.upArrow, modifierFlags: [])
        case .down: app.typeKey(XCUIKeyboardKey.downArrow, modifierFlags: [])
        }
      } else {
        let key: String
        switch direction { case .left: key = "a"; case .right: key = "d"; case .up: key = "w"; case .down: key = "s" }
        app.typeKey(key, modifierFlags: step == 2 ? .shift : [])
      }
      let next = try settled(board: board, app: app)
      try verifyTransition(from: previous, to: next, successfulMoves: 1, direction: direction)
      capture("2048-native-hardware-input-\(step)", snapshot: next, board: board, app: app)
      previous = next
    }
  }

  @MainActor
  func testFastSwipesKeepEngineIdentityScoreAndOneAccessibleValuePerSettledTile() throws {
    let app = openGame()
    let board = app.otherElements["لوحة 2048"].firstMatch
    XCTAssertTrue(board.waitForExistence(timeout: 15))
    reveal(board, app: app)
    let restart = app.buttons["لعبة جديدة"].firstMatch
    XCTAssertTrue(restart.waitForExistence(timeout: 5))
    reveal(restart, app: app); restart.tap(); reveal(board, app: app)
    let initial = try settled(board: board, app: app)
    guard initial.tiles.count == 2, initial.score == 0 else { throw motionFailure("The case requires its own new two-tile, zero-score board.") }
    capture("2048-01-owned-new-board", snapshot: initial, board: board, app: app)

    // With only two initial tiles, a legal horizontal pack followed by its opposite
    // is also legal after the first spawn. No RNG or second game engine is installed.
    let first: MotionDirection = canMoveIntoEmptyNeighbor(initial, direction: .left) || hasEqualLineNeighbors(initial, horizontal: true) ? .left : .right
    let second: MotionDirection = first == .left ? .right : .left
    let firstPoints = points(first, board: board), secondPoints = points(second, board: board)
    let started = Date()
    swipe(firstPoints)
    let firstReturned = Date()
    swipe(secondPoints)
    let secondReturned = Date()
    let burst = try settled(board: board, app: app)
    try verifyTransition(from: initial, to: burst, successfulMoves: 2, direction: nil)
    capture("2048-02-back-to-back-fast-swipes-settled", snapshot: burst, board: board, app: app)
    var trace = [MotionTrace(input: "new game", snapshot: initial), MotionTrace(input: "\(first.rawValue),\(second.rawValue)", snapshot: burst)]
    let timing: [String: Any] = ["firstCommandSeconds": firstReturned.timeIntervalSince(started), "secondCommandSeconds": secondReturned.timeIntervalSince(firstReturned),
      "explicitDelayBetweenCommands": 0, "nativeSlideMilliseconds": 140,
      "limit": "Public XCTest may wait for app quiescence. These command durations do not prove overlapping native-driver frames. Review native video separately; live system Reduce Motion is also pending."]
    attachJSON(timing, name: "2048-gesture-command-timing-and-evidence-limit")

    var previous = burst, sawMerge = burst.score > 0
    for step in 0..<18 where !sawMerge {
      guard let direction = preferredLegalDirection(previous) else { break }
      quiet(app); reveal(board, app: app)
      swipe(points(direction, board: board))
      let next = try settled(board: board, app: app)
      try verifyTransition(from: previous, to: next, successfulMoves: 1, direction: direction)
      trace.append(.init(input: direction.rawValue, snapshot: next))
      if next.score > previous.score {
        sawMerge = true
        capture("2048-03-observed-merge-after-settle", snapshot: next, board: board, app: app)
      }
      previous = next
      if step == 17 { capture("2048-merge-observation-bound-reached", snapshot: next, board: board, app: app) }
    }
    let data = try JSONEncoder.pretty.encode(trace)
    let evidence = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
    evidence.name = "2048-observed-inputs-stable-ids-cell-positions-and-score"; evidence.lifetime = .keepAlways; add(evidence)
    XCTAssertTrue(sawMerge, "A merge was not observed in the bounded new-game input sequence. Do not claim merge animation proof from a spawn-only run.")
    XCTAssertGreaterThanOrEqual(previous.best, initial.best)
    // Source ghosts are AX-hidden throughout and unmount after 320ms. The settled
    // snapshot independently rejects extra numeric cells and overlapping values.
    XCTAssertEqual(app.descendants(matching: .any).matching(NSPredicate(format: "identifier MATCHES %@", #"2048\.ghost\.[1-9][0-9]*"#)).count, 0)
    capture("2048-04-final-accessible-board-no-merge-ghosts", snapshot: previous, board: board, app: app)
  }

  @MainActor
  private func openGame() -> XCUIApplication {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate(); app.launch(); app.open(URL(string: "syrianzone://feature/2048")!)
    for bundle in ["zone.syrian.ios", "com.apple.springboard", "com.apple.mobilesafari", "com.apple.SafariViewService"] {
      let open = XCUIApplication(bundleIdentifier: bundle).buttons["Open"].firstMatch
      if open.exists { open.tap(); break }
    }
    XCTAssertFalse(app.staticTexts["account.fixture.origin"].exists)
    XCTAssertFalse(app.staticTexts["adapter.fixture"].exists)
    quiet(app, timeout: 2)
    return app
  }

  @MainActor
  private func settled(board: XCUIElement, app: XCUIApplication) throws -> MotionSnapshot {
    let deadline = Date().addingTimeInterval(8), notBefore = Date().addingTimeInterval(0.4)
    var prior: MotionSnapshot?, stableSince = Date(), lastError: Error?
    while Date() < deadline {
      if Date() >= notBefore {
        do {
          let next = try snapshot(board: board, app: app)
          if prior?.signature == next.signature {
            if Date().timeIntervalSince(stableSince) >= 0.15 { return next }
          } else { prior = next; stableSince = Date() }
        } catch { lastError = error; prior = nil; stableSince = Date() }
      }
      RunLoop.current.run(until: Date().addingTimeInterval(0.05))
    }
    let tree = XCTAttachment(string: app.debugDescription); tree.name = "2048-unconfirmed-native-AX"; tree.lifetime = .keepAlways; add(tree)
    throw lastError ?? motionFailure("The actual native board did not settle within eight seconds.")
  }

  @MainActor
  private func snapshot(board: XCUIElement, app: XCUIApplication) throws -> MotionSnapshot {
    let bounds = board.frame
    guard board.exists, bounds.width >= 200, abs(bounds.width - bounds.height) <= 1 else { throw motionFailure("The whole square native board must be present.") }
    let containers = app.descendants(matching: .any).matching(NSPredicate(format: "identifier MATCHES %@", #"2048\.tile\.[1-9][0-9]*"#)).allElementsBoundByIndex
    var tiles: [Int: MotionTile] = [:]
    for container in containers {
      guard let id = Int(container.identifier.replacingOccurrences(of: "2048.tile.", with: "")), id > 0,
        bounds.contains(CGPoint(x: container.frame.midX, y: container.frame.midY)) else { continue }
      let cell = try position(container.frame, board: bounds)
      let values = Set(container.descendants(matching: .staticText).allElementsBoundByIndex.compactMap { element -> Int? in
        guard let value = Int(element.label), isTileValue(value) else { return nil }; return value
      })
      guard values.count == 1, let value = values.first else { throw motionFailure("Each stable tile ID must expose its one real numeric value.") }
      let tile = MotionTile(id: id, value: value, row: cell.row, col: cell.col, frame: container.frame)
      if let existing = tiles[id], existing.row != tile.row || existing.col != tile.col || existing.value != tile.value { throw motionFailure("One engine ID appeared in different cells or values.") }
      tiles[id] = tile
    }
    guard !tiles.isEmpty, tiles.count <= 16 else { throw motionFailure("Stable native tile identifiers were not exposed. Inspect the attached actual hierarchy rather than guessing IDs from cell order.") }
    var numbers: [String: Set<Int>] = [:]
    for text in app.staticTexts.allElementsBoundByIndex {
      guard let value = Int(text.label), isTileValue(value), bounds.contains(CGPoint(x: text.frame.midX, y: text.frame.midY)) else { continue }
      let cell = try position(text.frame, board: bounds)
      numbers["\(cell.row):\(cell.col)", default: []].insert(value)
    }
    // Native attributed-text host/child duplicates at the same cell/value are one tile.
    guard numbers.count == tiles.count, numbers.values.allSatisfy({ $0.count == 1 }), Set(tiles.values.map(\.cell)).count == tiles.count else {
      throw motionFailure("Settled board contains duplicate cells, extra accessible merge ghosts, or overlapping numeric values.")
    }
    for tile in tiles.values where numbers[tile.cell] != [tile.value] { throw motionFailure("Accessible numeric positions differ from their stable engine tile containers.") }
    let score = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "النقاط ")).firstMatch
    guard score.exists else { throw motionFailure("The real score label is missing.") }
    let digits = try NSRegularExpression(pattern: #"النقاط\s+([0-9]+)\s+أفضل نتيجة\s+([0-9]+)"#)
    let label = score.label as NSString
    guard let match = digits.firstMatch(in: score.label, range: NSRange(location: 0, length: label.length)),
      let points = Int(label.substring(with: match.range(at: 1))), let best = Int(label.substring(with: match.range(at: 2))) else { throw motionFailure("Score and best must be read from the actual numeric board label.") }
    return MotionSnapshot(tiles: tiles.values.sorted { $0.id < $1.id }, score: points, best: best, boardFrame: bounds)
  }

  private func position(_ frame: CGRect, board: CGRect) throws -> (row: Int, col: Int) {
    let x = (frame.midX - board.minX) / board.width, y = (frame.midY - board.minY) / board.height
    let col = Int(floor(x * 4)), row = Int(floor(y * 4))
    guard (0..<4).contains(col), (0..<4).contains(row),
      abs(x - (Double(col) + 0.5) / 4) < 0.04, abs(y - (Double(row) + 0.5) / 4) < 0.04 else { throw motionFailure("A numeric tile is still between the observed grid's cell centers.") }
    return (row, col)
  }

  private func verifyTransition(from before: MotionSnapshot, to after: MotionSnapshot, successfulMoves: Int, direction: MotionDirection?) throws {
    guard let oldMax = before.tiles.map(\.id).max(), after.tiles.map(\.id).max() == oldMax + successfulMoves else { throw motionFailure("Each accepted legal input must mint exactly one new engine tile ID.") }
    let mass = after.mass - before.mass
    guard stride(from: successfulMoves * 2, through: successfulMoves * 4, by: 2).contains(mass) else { throw motionFailure("Only the actual 2 or 4 spawns may increase tile mass.") }
    // For v,v -> 2v, sum(value * log2(value)) rises by 2v, exactly the awarded
    // score. A spawned 2 contributes 2, a 4 contributes 8: 3*spawnMass-4 per spawn.
    // This conservation identity checks outcomes without predicting a moved board.
    guard after.score - before.score == after.potential - before.potential - (3 * mass - 4 * successfulMoves) else { throw motionFailure("Score does not match the observed merge values and spawn mass.") }
    let previous = Dictionary(uniqueKeysWithValues: before.tiles.map { ($0.id, $0) })
    for tile in after.tiles {
      if let old = previous[tile.id] {
        guard tile.value >= old.value, tile.value <= old.value * (1 << successfulMoves), tile.value % old.value == 0 else { throw motionFailure("A surviving engine ID lost its value or merged too many times for the accepted inputs.") }
        if let direction {
          let valid: Bool
          switch direction {
          case .left: valid = tile.row == old.row && tile.col <= old.col
          case .right: valid = tile.row == old.row && tile.col >= old.col
          case .up: valid = tile.col == old.col && tile.row <= old.row
          case .down: valid = tile.col == old.col && tile.row >= old.row
          }
          guard valid else { throw motionFailure("A stable tile moved against the visible swipe direction or changed its perpendicular axis.") }
        } else if tile.row != old.row { throw motionFailure("Horizontal back-to-back swipes changed a surviving tile's row.") }
      } else if tile.id <= oldMax { throw motionFailure("A consumed engine ID reappeared as an unrelated tile.") }
    }
    guard let spawned = after.tiles.first(where: { $0.id == oldMax + successfulMoves }), [2, 4].contains(spawned.value) else { throw motionFailure("The final spawned ID must retain its actual 2 or 4 value.") }
    XCTAssertGreaterThanOrEqual(after.best, before.best)
  }

  private func preferredLegalDirection(_ snapshot: MotionSnapshot) -> MotionDirection? {
    if hasEqualLineNeighbors(snapshot, horizontal: true) { return .left }
    if hasEqualLineNeighbors(snapshot, horizontal: false) { return .up }
    return [MotionDirection.left, .up, .right, .down].first { canMoveIntoEmptyNeighbor(snapshot, direction: $0) }
  }

  private func hasEqualLineNeighbors(_ snapshot: MotionSnapshot, horizontal: Bool) -> Bool {
    for line in 0..<4 {
      let values = snapshot.tiles.filter { horizontal ? $0.row == line : $0.col == line }
        .sorted { horizontal ? $0.col < $1.col : $0.row < $1.row }.map(\.value)
      if zip(values, values.dropFirst()).contains(where: { $0 == $1 }) { return true }
    }
    return false
  }

  private func canMoveIntoEmptyNeighbor(_ snapshot: MotionSnapshot, direction: MotionDirection) -> Bool {
    snapshot.tiles.contains { tile in
      let row = tile.row + (direction == .up ? -1 : direction == .down ? 1 : 0)
      let col = tile.col + (direction == .left ? -1 : direction == .right ? 1 : 0)
      return (0..<4).contains(row) && (0..<4).contains(col) && !snapshot.tiles.contains { $0.row == row && $0.col == col }
    }
  }

  @MainActor
  private func points(_ direction: MotionDirection, board: XCUIElement) -> (XCUICoordinate, XCUICoordinate) {
    let coordinates: (CGVector, CGVector)
    switch direction {
    case .left: coordinates = (.init(dx: 0.8, dy: 0.5), .init(dx: 0.2, dy: 0.5))
    case .right: coordinates = (.init(dx: 0.2, dy: 0.5), .init(dx: 0.8, dy: 0.5))
    case .up: coordinates = (.init(dx: 0.5, dy: 0.8), .init(dx: 0.5, dy: 0.2))
    case .down: coordinates = (.init(dx: 0.5, dy: 0.2), .init(dx: 0.5, dy: 0.8))
    }
    return (board.coordinate(withNormalizedOffset: coordinates.0), board.coordinate(withNormalizedOffset: coordinates.1))
  }

  @MainActor
  private func swipe(_ points: (XCUICoordinate, XCUICoordinate)) {
    points.0.press(forDuration: 0.01, thenDragTo: points.1, withVelocity: .fast, thenHoldForDuration: 0)
  }

  @MainActor
  private func reveal(_ element: XCUIElement, app: XCUIApplication) {
    quiet(app)
    for _ in 0..<12 {
      let containers = app.scrollViews.containing(element.elementType, identifier: element.label).allElementsBoundByIndex
      let scroll = containers.last(where: { !$0.frame.intersection(app.frame).isEmpty }) ?? app.scrollViews.firstMatch
      guard scroll.exists else { break }
      let viewport = scroll.frame.intersection(app.frame).insetBy(dx: 0, dy: 8), target = element.frame
      if element.isHittable && viewport.contains(target) { return }
      let top = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.02, dy: 0.25)), bottom = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.02, dy: 0.75))
      if target.minY < viewport.minY { top.press(forDuration: 0.05, thenDragTo: bottom) }
      else if target.maxY > viewport.maxY { bottom.press(forDuration: 0.05, thenDragTo: top) }
      else { break }
    }
    XCTAssertTrue(element.isHittable)
  }

  @MainActor
  private func quiet(_ app: XCUIApplication, timeout: TimeInterval = 0) {
    let quiet = app.buttons["إخفاء التنبيه لهذه الزيارة"].firstMatch
    if timeout > 0 ? quiet.waitForExistence(timeout: timeout) : quiet.exists {
      XCTAssertTrue(quiet.isHittable); quiet.tap()
    }
  }

  @MainActor
  private func capture(_ name: String, snapshot: MotionSnapshot, board: XCUIElement, app: XCUIApplication) {
    for (suffix, image) in [("-board", board.screenshot()), ("-screen", app.screenshot())] {
      let attachment = XCTAttachment(screenshot: image); attachment.name = name + suffix; attachment.lifetime = .keepAlways; add(attachment)
    }
    if let data = try? JSONEncoder.pretty.encode(snapshot) {
      let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json"); attachment.name = name + "-observed-tiles"; attachment.lifetime = .keepAlways; add(attachment)
    }
  }

  private func attachJSON(_ value: [String: Any], name: String) {
    guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys]) else { return }
    let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json"); attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
  }
}

private enum MotionDirection: String { case left, right, up, down }
private struct MotionTile: Codable {
  let id: Int, value: Int, row: Int, col: Int
  let frame: CGRect
  var cell: String { "\(row):\(col)" }
}
private struct MotionSnapshot: Codable {
  let tiles: [MotionTile]
  let score: Int, best: Int
  let boardFrame: CGRect
  var mass: Int { tiles.reduce(0) { $0 + $1.value } }
  var potential: Int { tiles.reduce(0) { $0 + $1.value * $1.value.trailingZeroBitCount } }
  var signature: String { "\(score):" + tiles.map { "\($0.id):\($0.value):\($0.row):\($0.col)" }.joined(separator: ";") }
}
private struct MotionTrace: Codable { let input: String; let snapshot: MotionSnapshot }
private func isTileValue(_ value: Int) -> Bool { value >= 2 && value <= 1_048_576 && value.nonzeroBitCount == 1 }
private func motionFailure(_ message: String) -> NSError { NSError(domain: "Native2048Motion", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
private extension JSONEncoder {
  static var pretty: JSONEncoder { let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]; return encoder }
}
