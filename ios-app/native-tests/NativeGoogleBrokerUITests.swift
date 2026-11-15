import XCTest

// Real source handoff with a synthetic loopback provider. This is not Google verification.
final class NativeGoogleBrokerUITests: LocalFixtureTestCase {
  private var expectedMemberEmail = ""
  @MainActor
  func testSyntheticProviderCompletesRealNativeBrokerAndAccountAdoption() throws {
    let app = try signedOutLocalMember()
    assertLocal(app, user: "member", id: 101)
    tap("تسجيل الدخول", app: app)
    allowOwnedAuthenticationPrompt()
    let page = localProviderPage(app)
    XCTAssertTrue(page.staticTexts["Local provider fixture"].firstMatch.waitForExistence(timeout: 15), "Synthetic upstream must be explicitly identified")
    let consent = page.buttons["Continue as local member 101"].firstMatch
    XCTAssertTrue(consent.waitForExistence(timeout: 10))
    consent.tap()
    let email = app.textFields["البريد الإلكتروني"].firstMatch
    XCTAssertTrue(email.waitForExistence(timeout: 20), "Real broker callback and token exchange must adopt the native account")
    XCTAssertEqual(email.value as? String, expectedMemberEmail)
    assertLocal(app, user: "member", id: 101)
    tap("لوحة التحكم ومساهماتي", app: app)
    XCTAssertTrue(app.staticTexts["لوحة التحكم"].firstMatch.waitForExistence(timeout: 15))
    XCTAssertFalse(app.staticTexts["سجّل الدخول للوصول إلى ملفك ومساهماتك."].exists)
    open("account", app: app)
    assertLocal(app, user: "member", id: 101)
    tap("تسجيل الخروج", app: app)
    XCTAssertTrue(app.buttons["تسجيل الدخول"].waitForExistence(timeout: 15))
  }

  @MainActor
  func testCancellingSyntheticSystemBrowserKeepsNativeAccountSignedOut() throws {
    let app = try signedOutLocalMember()
    assertLocal(app, user: "member", id: 101)
    tap("تسجيل الدخول", app: app)
    allowOwnedAuthenticationPrompt()
    let page = localProviderPage(app)
    XCTAssertTrue(page.staticTexts["Local provider fixture"].firstMatch.waitForExistence(timeout: 15), "Cancel only the clearly local simulated provider")
    // Use the system browser's Cancel, not the provider's denial button.
    let cancel = page.buttons.matching(NSPredicate(format: "label IN %@", ["Cancel", "إلغاء"])).firstMatch
    XCTAssertTrue(cancel.waitForExistence(timeout: 10), "Native authentication browser cancellation control")
    cancel.tap()
    let closed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: page.staticTexts["Local provider fixture"].firstMatch)
    XCTAssertEqual(XCTWaiter.wait(for: [closed], timeout: 10), .completed)
    let signIn = app.buttons["تسجيل الدخول"].firstMatch
    XCTAssertTrue(signIn.waitForExistence(timeout: 10))
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: signIn)], timeout: 10), .completed)
    XCTAssertFalse(app.textFields["اسم المستخدم"].exists)
    XCTAssertFalse(app.textFields["البريد الإلكتروني"].exists)
    XCTAssertFalse(app.staticTexts["لم يكتمل تسجيل الدخول. حاول مجدداً."].exists)
    assertLocal(app, user: "member", id: 101)
  }

  @MainActor
  private func signedOutLocalMember() throws -> XCUIApplication {
    let app = try launch("member", id: 101)
    open("account", app: app)
    assertLocal(app, user: "member", id: 101)
    let email = app.textFields["البريد الإلكتروني"].firstMatch
    XCTAssertTrue(email.waitForExistence(timeout: 15))
    expectedMemberEmail = try XCTUnwrap(email.value as? String)
    XCTAssertTrue(expectedMemberEmail.hasSuffix("@native-fixture.invalid"))
    tap("تسجيل الخروج", app: app)
    XCTAssertTrue(app.buttons["تسجيل الدخول"].waitForExistence(timeout: 15))
    return app
  }

  @MainActor
  private func allowOwnedAuthenticationPrompt() {
    // This permission names the local host. Never approve a Google or foreign-host prompt here.
    for identifier in ["zone.syrian.ios", "com.apple.springboard", "com.apple.SafariViewService"] {
      let application = XCUIApplication(bundleIdentifier: identifier)
      let alert = application.alerts.firstMatch
      if alert.waitForExistence(timeout: 2) && alert.staticTexts.allElementsBoundByIndex.contains(where: { $0.label.contains("127.0.0.1") }) {
        let proceed = alert.buttons.matching(NSPredicate(format: "label IN %@", ["Continue", "متابعة"])).firstMatch
        if proceed.exists { proceed.tap(); return }
      }
    }
  }

  @MainActor
  private func localProviderPage(_ app: XCUIApplication) -> XCUIApplication {
    let safari = XCUIApplication(bundleIdentifier: "com.apple.SafariViewService")
    if safari.staticTexts["Local provider fixture"].firstMatch.waitForExistence(timeout: 3) { return safari }
    return app
  }
}
