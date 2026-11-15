import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

// Bun's node:test adapter requires the explicit skip API.
const testOnMac = process.platform === 'darwin' ? test : test.skip;

testOnMac('actual public 2048 reader survives global-text reordering and refuses ambiguous tile identities', () => {
  const source = fs.readFileSync(new URL('../native-tests/PublicInteractionsUITests.swift', import.meta.url), 'utf8');
  const start = source.indexOf('  @MainActor\n  private func tileValues(');
  const end = source.indexOf('  @MainActor\n  private func diagnose2048Reader(', start);
  assert.ok(start >= 0 && end > start);
  const helper = source.slice(start, end).replace('private func tileValues(', 'func tileValues(');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'syrianzone-2048-reader-'));
  try {
    const file = path.join(directory, 'main.swift');
    fs.writeFileSync(file, `import Foundation
import CoreGraphics
var indexReads = 0
var reverseBindings = false
@MainActor final class XCUIElementQuery {
  let items: [XCUIElement]
  init(_ items: [XCUIElement]) { self.items = items }
  var allElementsBoundByAccessibilityElement: [XCUIElement] { reverseBindings ? items.reversed() : items }
  var allElementsBoundByIndex: [XCUIElement] { indexReads += 1; return [] }
  var count: Int { items.count }
  var firstMatch: XCUIElement { items.first ?? XCUIElement(exists: false) }
  func matching(_ predicate: NSPredicate) -> XCUIElementQuery { .init(items.filter { predicate.evaluate(with: ["identifier": $0.identifier]) }) }
  func matching(identifier: String) -> XCUIElementQuery { .init(items.filter { $0.identifier == identifier }) }
}
@MainActor class XCUIElement {
  enum ElementType { case any, staticText }
  var identifier: String, label: String, frame: CGRect, exists: Bool, children: [XCUIElement], type: ElementType
  init(_ identifier: String = "", label: String = "", frame: CGRect = .zero, exists: Bool = true, children: [XCUIElement] = [], type: ElementType = .any) {
    self.identifier = identifier; self.label = label; self.frame = frame; self.exists = exists; self.children = children; self.type = type
  }
  func descendants(matching type: ElementType) -> XCUIElementQuery {
    func flatten(_ node: XCUIElement) -> [XCUIElement] { node.children.flatMap { [$0] + flatten($0) } }
    return .init(flatten(self).filter { type == .any || $0.type == type })
  }
  var staticTexts: XCUIElementQuery { descendants(matching: .staticText) }
}
@MainActor final class XCUIApplication: XCUIElement {}
@MainActor final class ActualReader {
${helper}
}
@MainActor func tile(_ id: Int, _ value: Int, x: Double = 10, y: Double = 10, duplicateText: Bool = false) -> XCUIElement {
  let frame = CGRect(x: x, y: y, width: 80, height: 80)
  let text = XCUIElement(label: String(value), frame: frame, type: .staticText)
  return XCUIElement("2048.tile.\\(id)", frame: frame, children: duplicateText ? [text, XCUIElement(label: String(value), frame: frame, type: .staticText)] : [text])
}
@MainActor func check(_ value: Bool) {
  if !value { FileHandle.standardError.write(Data("Stable reader check failed\\n".utf8)); exit(1) }
  checks += 1
}
var checks = 0
let reader = ActualReader(), board = XCUIElement(frame: CGRect(x: 0, y: 0, width: 400, height: 400))
let first = tile(1, 2), second = tile(2, 2, x: 110)
let app = XCUIApplication(children: [first, second])
check(reader.tileValues(board: board, app: app) == [2, 2])
check(indexReads == 0)
reverseBindings = true
check(reader.tileValues(board: board, app: app) == [2, 2])
app.children = [tile(3, 2, x: 210), first, second]
check(reader.tileValues(board: board, app: app) == [2, 2, 2])
app.children = [tile(4, 4), tile(5, 2, x: 110)]
check(reader.tileValues(board: board, app: app).reduce(0, +) == 6)
app.children = [tile(1, 2, duplicateText: true), second]
check(reader.tileValues(board: board, app: app) == [2, 2])
app.children = [first, tile(1, 2, x: 210)]
check(reader.tileValues(board: board, app: app).isEmpty)
app.children = [first, tile(2, 2, x: 50)]
check(reader.tileValues(board: board, app: app).isEmpty)
app.children = [first, tile(2, 2, x: -5)]
check(reader.tileValues(board: board, app: app).isEmpty)
app.children = [first, tile(2, 2, x: Double.infinity)]
check(reader.tileValues(board: board, app: app).isEmpty)
app.children = [first, tile(2, 3, x: 110)]
check(reader.tileValues(board: board, app: app).isEmpty)
let conflict = tile(2, 2, x: 110)
conflict.children.append(XCUIElement(label: "4", frame: conflict.frame, type: .staticText))
app.children = [first, conflict]
check(reader.tileValues(board: board, app: app).isEmpty)
second.exists = false; app.children = [first, second]
check(reader.tileValues(board: board, app: app).isEmpty)
second.exists = true; board.exists = false
check(reader.tileValues(board: board, app: app).isEmpty)
board.exists = true; board.frame = CGRect(x: 0, y: 0, width: Double.infinity, height: 400)
check(reader.tileValues(board: board, app: app).isEmpty)
board.frame = CGRect(x: 0, y: 0, width: 400, height: 400)
app.children = (1...17).map { tile($0, 2) }
check(reader.tileValues(board: board, app: app).isEmpty)
check(indexReads == 0)
// Actual NativeMotion40 retained snapshot3BAE72F3, stable IDs and numeric frames only.
board.frame = CGRect(x: 18, y: 402.6666564941406, width: 366, height: 366)
let observed: [(Int, Int, Double, Double)] = [(3, 2, 22, 497.1666564941406), (5, 2, 22, 406.6666564941406), (6, 4, 22, 678.1666564941406), (7, 2, 293.5, 678.1666564941406)]
app.children = observed.map { id, value, x, y in
  let item = tile(id, value, x: x, y: y)
  item.frame = CGRect(x: x, y: y, width: 86.66666412353516, height: 86.33333587646484)
  return item
}
check(reader.tileValues(board: board, app: app) == [2, 2, 4, 2])
check(reader.tileValues(board: board, app: app).reduce(0, +) == 10)
print("PASS stable-reader \\(checks)")
`, { mode: 0o600 });
    const result = spawnSync('swift', ['-swift-version', '6', '-strict-concurrency=complete', '-warnings-as-errors', file], { encoding: 'utf8', timeout: 30_000, maxBuffer: 64_000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /^PASS stable-reader 19\s*$/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
