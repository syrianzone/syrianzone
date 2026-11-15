import XCTest
@testable import SyrianAudio

final class AudioSessionQueueTests: XCTestCase {
  func testReleaseCannotDeactivateANewerOwnerAndNoSessionRequestsOverlap() {
    var requests: [Bool] = []
    var callbacks: [(Error?) -> Void] = []
    let queue = AudioSessionQueue { active, completed in requests.append(active); callbacks.append(completed) }
    queue.setActive(true)
    queue.setActive(false)
    queue.setActive(true)
    XCTAssertEqual(requests, [true])
    callbacks[0](nil)
    XCTAssertEqual(requests, [true, false])
    callbacks[1](nil)
    XCTAssertEqual(requests, [true, false, true])
    callbacks[2](nil)
  }

  func testAnErrorAndADuplicateSystemCallbackCannotBlockOrRepeatTheNextRequest() {
    var requests: [Bool] = []
    var callbacks: [(Error?) -> Void] = []
    var failures = 0
    let queue = AudioSessionQueue { active, completed in requests.append(active); callbacks.append(completed) }
    queue.setActive(true) { if $0 != nil { failures += 1 } }
    queue.setActive(false)
    callbacks[0](NSError(domain: "test", code: 1))
    callbacks[0](nil)
    XCTAssertEqual(failures, 1)
    XCTAssertEqual(requests, [true, false])
    callbacks[1](nil)
  }
}
