import XCTest
@testable import SyrianAudio

final class ListeningClockTests: XCTestCase {
  func testBufferingAndPausedGapsNeverBecomeListeningTime() {
    var now = 0.0
    let clock = ListeningClock(now: { now })
    now = 10; clock.update(playing: true)
    now = 20; clock.update(playing: false)
    now = 100; clock.update(playing: true)
    XCTAssertEqual(clock.seconds, 10)
    now = 130; clock.update(playing: true)
    XCTAssertEqual(clock.seconds, 40)
    now = 135; clock.update(playing: false)
    now = 1000; clock.update(playing: false)
    XCTAssertEqual(clock.seconds, 45)
  }
}
