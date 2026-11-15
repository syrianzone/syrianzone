import Foundation
import XCTest

// Synthetic local Home metadata only. No settings save, external open or dismissal.
final class NativePopupLayoutUITests: LocalFixtureTestCase {
  @MainActor
  func testLongPopupKeepsAllThreeControlsInsideItsInitialViewport() throws {
    let environment = ProcessInfo.processInfo.environment
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == "zone.syrian.ios.uitests.xctrunner",
      let device = environment["SIMULATOR_UDID"], UUID(uuidString: device) != nil else {
      throw failure("Only the exact gated local Simulator fixture may measure this synthetic popup.")
    }
    #else
    throw failure("The synthetic popup layout case refuses physical devices.")
    #endif
    guard environment["SZ_NATIVE_FIXTURE_ORIGIN"] == "https://127.0.0.1:9443",
      let gate = environment["SZ_NATIVE_FIXTURE_GATE"],
      gate.range(of: "^[A-Za-z0-9_-]{16,256}$", options: .regularExpression) != nil else {
      throw failure("The private local origin and gate are required.")
    }
    var url = URLComponents()
    url.scheme = "syrianzone"; url.host = "fixture"; url.path = "/session"
    url.queryItems = [URLQueryItem(name: "user", value: "member"), URLQueryItem(name: "variant", value: "popup-long")]
    url.fragment = gate
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    defer { app.terminate() }
    app.terminate(); app.open(try XCTUnwrap(url.url))
    dismissOwnPrompt(); assertLocal(app, user: "member", id: 101)
    XCTAssertTrue(app.buttons["إعدادات الرئيسية"].waitForExistence(timeout: 20))
    let marker = app.staticTexts["account.fixture.popup-layout"]
    let served = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label MATCHES %@", "LOCAL POPUP LONG HOME OVERRIDES [1-9][0-9]*"), object: marker)
    guard XCTWaiter.wait(for: [served], timeout: 20) == .completed else {
      attach(app, note: "A verified Home JSON override did not arrive."); throw failure("A cached short popup cannot prove this case.")
    }
    let title = "صوتك بيعمل فرق: ساهم معنا لفتح الخدمات التقنية لأهل سوريا"
    let description = "ساهم في فك الحظر عن الخدمات التقنية في سوريا. شارك برأيك لتحديد الخدمات الأكثر أهمية للناس، وساعد في إيصال هذه الأولويات إلى الجهات المعنية بشكل واضح وموثّق."
    let heading = app.staticTexts[title].firstMatch
    guard heading.waitForExistence(timeout: 15) else { attach(app, note: "The full synthetic title did not reach the real popup."); throw failure("Long popup copy is required.") }
    let owners = app.scrollViews.containing(.staticText, identifier: title)
    guard owners.count == 1 else {
      attach(app, note: "Expected one popup scroll owner; found \(owners.count)."); throw failure("The actual popup viewport must be established.")
    }
    let owner = owners.firstMatch, viewport = owner.frame.intersection(app.frame)
    let names = ["إغلاق إشعار الموقع", "صوّت الآن", "لاحقاً"]
    let controls = names.map { owner.buttons.matching(identifier: $0) }
    let body = owner.buttons.matching(identifier: "إخفاء التنبيه لهذه الزيارة")
    let frames = Dictionary(uniqueKeysWithValues: zip(names, controls).map { name, query in
      (name, query.firstMatch.exists ? String(describing: query.firstMatch.frame) : "missing")
    })
    let bodyFrame = body.firstMatch.exists ? String(describing: body.firstMatch.frame) : "missing"
    attach(app, note: "Synthetic fixture only, not server-settings or external-link proof. No scroll or control activation has occurred. Marker: \(marker.label). Popup viewport: \(viewport). Title frame: \(heading.frame). Body-button frame: \(bodyFrame). Control frames: \(frames).")
    XCTAssertGreaterThanOrEqual(app.frame.width, 300); XCTAssertLessThanOrEqual(app.frame.width, 430)
    XCTAssertGreaterThan(app.frame.height, app.frame.width, "This case measures the default portrait phone layout.")
    XCTAssertFalse(viewport.isEmpty)
    XCTAssertEqual(heading.label, title); XCTAssertGreaterThan(heading.frame.height, 30, "The long fixture title must wrap beyond the source 25 pt single line.")
    XCTAssertEqual(body.count, 1); XCTAssertEqual(body.firstMatch.label, description + "، إخفاء التنبيه لهذه الزيارة", "Full copy must remain in the actual body Button label, even if not every line fits at once.")
    for (name, query) in zip(names, controls) {
      XCTAssertEqual(query.count, 1, name)
      XCTAssertTrue(query.firstMatch.isHittable, name)
      XCTAssertTrue(viewport.contains(query.firstMatch.frame), "The complete \(name) frame must be inside the initial popup viewport.")
    }
    let primary = controls[1].firstMatch.frame, later = controls[2].firstMatch.frame
    XCTAssertEqual(primary.midY, later.midY, accuracy: 1, "Primary and Later must share the default phone row.")
    XCTAssertFalse(primary.intersects(later), "The two native action frames must remain distinct.")
    assertLocal(app, user: "member", id: 101)
  }

  @MainActor
  private func attach(_ app: XCUIApplication, note: String) {
    let metadata = XCTAttachment(string: note); metadata.name = "popup-long-geometry"; metadata.lifetime = .keepAlways; add(metadata)
    let tree = XCTAttachment(string: app.debugDescription); tree.name = "popup-long-AX"; tree.lifetime = .keepAlways; add(tree)
    let image = XCTAttachment(screenshot: app.screenshot()); image.name = "popup-long-initial-viewport"; image.lifetime = .keepAlways; add(image)
  }
  private func failure(_ message: String) -> NSError { NSError(domain: "NativePopupLayoutFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
}
