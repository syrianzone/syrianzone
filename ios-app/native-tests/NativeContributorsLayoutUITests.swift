import Foundation
import XCTest

// Measurement fixture only. A captured layout is not a product fix or cause proof.
final class NativeContributorsLayoutUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func testObserveInitialContributorsHeaderHostPairsWithoutNetworkOrCells() throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == "zone.syrian.ios.uitests.xctrunner" else {
      throw NSError(domain: "ContributorsLayout", code: 1, userInfo: [NSLocalizedDescriptionKey: "Only the Simulator test runner may run this fixture."])
    }
    #else
    throw NSError(domain: "ContributorsLayout", code: 1, userInfo: [NSLocalizedDescriptionKey: "The layout fixture refuses physical devices."])
    #endif
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate(); app.launch()
    defer { app.terminate() }
    let capture = app.buttons["adapter.contributors-layout.capture"].firstMatch
    XCTAssertTrue(capture.waitForExistence(timeout: 20), "The separately enabled initial-layout fixture must mount; no ordinary product fallback.")
    XCTAssertTrue(capture.isEnabled && capture.isHittable)
    capture.tap()
    let status = app.staticTexts["adapter.contributors-layout.snapshot"].firstMatch
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      guard let raw = status.value as? String else { return false }
      return raw.contains("\"fixture\":\"initial-contributors-layout\"")
    }, object: app)
    XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 5), .completed)
    let raw = try XCTUnwrap(status.value as? String)
    let data = try XCTUnwrap(raw.data(using: .utf8))
    let value = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    XCTAssertEqual(value["fixture"] as? String, "initial-contributors-layout")
    XCTAssertEqual(value["initialDataCount"] as? Int, 0)
    XCTAssertEqual(value["loading"] as? Bool, true)
    let samples = try XCTUnwrap(value["samples"] as? [String: [String: Any]])
    for key in ["outer", "list", "header", "author", "metric"] {
      let sample = try XCTUnwrap(samples[key])
      let count = try XCTUnwrap(sample["count"] as? Int)
      let pairs = try XCTUnwrap(sample["pairs"] as? [[Double]])
      XCTAssertTrue((1...24).contains(count) && pairs.count == count, "Each named public measurement must have bounded real observations.")
      XCTAssertTrue(pairs.allSatisfy { $0.count == 2 && $0.allSatisfy { $0.isFinite && $0 >= 0 } })
    }
    let metadata = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
    metadata.name = "contributors-initial-header-public-layout-pairs"; metadata.lifetime = .keepAlways; add(metadata)
    let screen = XCTAttachment(screenshot: app.screenshot())
    screen.name = "contributors-initial-header-layout-fixture"; screen.lifetime = .keepAlways; add(screen)
  }
}
