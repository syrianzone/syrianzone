import XCTest
@testable import SyrianAudio

final class SleepDeadlineTests: XCTestCase {
  func testDeadlineStopsOnceWithoutAnyScreenMounted() {
    var now = 100.0
    var fire: (() -> Void)?
    var pauses = 0
    let deadline = SleepDeadline(now: { now }, schedule: { _, callback in
      fire = callback
      return {}
    }, onExpire: { pauses += 1 })
    deadline.set(110)
    now = 110
    fire?()
    fire?()
    XCTAssertEqual(pauses, 1)
    XCTAssertNil(deadline.until)
  }

  func testCancelAndReplacementMakeOldCallbacksHarmless() {
    var now = 100.0
    var callbacks: [() -> Void] = []
    var pauses = 0
    let deadline = SleepDeadline(now: { now }, schedule: { _, callback in
      callbacks.append(callback)
      return {}
    }, onExpire: { pauses += 1 })
    deadline.set(110)
    deadline.set(120)
    now = 110
    callbacks[0]()
    XCTAssertEqual(pauses, 0)
    deadline.set(nil)
    now = 130
    callbacks[1]()
    XCTAssertEqual(pauses, 0)
  }

  func testClockMovesBackRearmsInsteadOfStoppingEarly() {
    var now = 100.0
    var delays: [Double] = []
    var fire: (() -> Void)?
    var pauses = 0
    let deadline = SleepDeadline(now: { now }, schedule: { delay, callback in
      delays.append(delay)
      fire = callback
      return {}
    }, onExpire: { pauses += 1 })
    deadline.set(120)
    now = 105
    fire?()
    XCTAssertEqual(delays, [20, 15])
    XCTAssertEqual(pauses, 0)
    now = 120
    fire?()
    XCTAssertEqual(pauses, 1)
  }
}
