import Foundation
import XCTest

final class NativeSuperadminLoginUITests: LocalFixtureTestCase {
  @MainActor
  func testNativeSuperadminPasswordLoginLogoutRejectionAndThrottle() async throws {
    let environment = ProcessInfo.processInfo.environment
    guard environment["SZ_NATIVE_FIXTURE_ADMIN_EMAIL"] == "admin@native-fixture.invalid",
      let password = environment["SZ_NATIVE_FIXTURE_ADMIN_PASSWORD"], password.count >= 16, password.count <= 256 else {
      throw NSError(domain: "NativeAccountFixture", code: 2, userInfo: [NSLocalizedDescriptionKey: "Private synthetic admin credential configuration is missing."])
    }
    let app = try launch("admin", id: 103)
    open("account", app: app)
    assertLocal(app, user: "admin", id: 103)
    tap("تسجيل الخروج", app: app)
    XCTAssertTrue(app.buttons["تسجيل الدخول"].waitForExistence(timeout: 15))
    tap("دخول الإدارة بكلمة المرور", app: app)
    let emailField = app.textFields.matching(NSPredicate(format: "label BEGINSWITH %@", "البريد الإلكتروني للإدارة")).firstMatch
    let passwordField = app.secureTextFields["كلمة مرور الإدارة"].firstMatch
    XCTAssertTrue(emailField.waitForExistence(timeout: 10), "The native administrator disclosure opens its form")
    replace(emailField, with: "admin@native-fixture.invalid")
    replace(passwordField, with: password)
    assertLocal(app, user: "admin", id: 103)
    tap("دخول لوحة الإدارة", app: app)
    XCTAssertTrue(app.textFields["البريد الإلكتروني"].waitForExistence(timeout: 15), "Actual password endpoint adopts the account")
    XCTAssertEqual(app.textFields["البريد الإلكتروني"].value as? String, "admin@native-fixture.invalid")
    XCTAssertEqual(app.buttons.matching(identifier: "لوحة التحكم ومساهماتي").count, 1, "Keep one account route so background copies cannot satisfy native queries.")
    let passwordPrompt = app.sheets["Save Password?"]
    let declineSave = passwordPrompt.buttons["Not Now"]
    if declineSave.waitForExistence(timeout: 5) {
      assertLocal(app, user: "admin", id: 103)
      XCTAssertTrue(passwordPrompt.buttons["Save"].exists)
      declineSave.tap()
      XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: passwordPrompt)], timeout: 5), .completed)
    }
    tap("لوحة التحكم ومساهماتي", app: app)
    XCTAssertTrue(app.staticTexts["لوحة التحكم"].firstMatch.waitForExistence(timeout: 15))
    XCTAssertTrue(app.buttons["المستخدمون وصلاحياتهم"].firstMatch.waitForExistence(timeout: 15), "The real server-authorized management entry is present")
    open("account", app: app)
    assertLocal(app, user: "admin", id: 103)
    tap("تسجيل الخروج", app: app)
    XCTAssertTrue(app.buttons["تسجيل الدخول"].waitForExistence(timeout: 15))
    tap("دخول الإدارة بكلمة المرور", app: app)
    XCTAssertTrue(emailField.waitForExistence(timeout: 10))
    replace(emailField, with: "admin@native-fixture.invalid")
    let retry = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "يمكنك المحاولة مجدداً بعد")).firstMatch
    assertLocal(app, user: "admin", id: 103)
    replace(passwordField, with: "intentionally-incorrect-local-only")
    tap("دخول لوحة الإدارة", app: app)
    let cleared = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == '' OR value == nil"), object: passwordField)
    XCTAssertEqual(XCTWaiter.wait(for: [cleared], timeout: 15), .completed, "Password is cleared after rejection")
    XCTAssertFalse(app.textFields["اسم المستخدم"].exists, "Rejected credentials must remain signed out")
    XCTAssertTrue(emailField.label.contains("خطأ:"), "Generic credential rejection is attached to the email field")
    // Native gestures can exceed the shared sixty-second budget. Prepare its
    // boundary through real rejected local requests, then exercise native 429 UI.
    try await prepareLocalPasswordLimit(environment)
    assertLocal(app, user: "admin", id: 103)
    replace(passwordField, with: "intentionally-incorrect-local-only")
    tap("دخول لوحة الإدارة", app: app)
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == '' OR value == nil"), object: passwordField)], timeout: 15), .completed)
    XCTAssertTrue(retry.waitForExistence(timeout: 5), "Actual shared server throttle supplies Retry-After")
    XCTAssertFalse(app.buttons["دخول لوحة الإدارة"].firstMatch.isEnabled)
    XCTAssertFalse(app.textFields["اسم المستخدم"].exists)
  }
}

private func prepareLocalPasswordLimit(_ environment: [String: String]) async throws {
  guard environment["SZ_NATIVE_FIXTURE_ORIGIN"] == "https://127.0.0.1:9443",
    environment["SZ_NATIVE_FIXTURE_ADMIN_EMAIL"] == "admin@native-fixture.invalid",
    let password = environment["SZ_NATIVE_FIXTURE_ADMIN_PASSWORD"],
    password != "intentionally-incorrect-local-only" else {
    throw NSError(domain: "NativeAccountFixture", code: 3, userInfo: [NSLocalizedDescriptionKey: "Password limit setup requires the exact isolated synthetic account."])
  }
  let configuration = URLSessionConfiguration.ephemeral
  configuration.httpCookieStorage = nil
  configuration.httpShouldSetCookies = false
  configuration.urlCache = nil
  configuration.timeoutIntervalForRequest = 10
  configuration.timeoutIntervalForResource = 15
  let session = URLSession(configuration: configuration, delegate: PasswordLimitNoRedirect(), delegateQueue: nil)
  defer { session.invalidateAndCancel() }
  let url = URL(string: "https://127.0.0.1:9443/api/v1/auth/superadmin/token")!
  for _ in 0..<6 {
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONSerialization.data(withJSONObject: ["email": "admin@native-fixture.invalid", "password": "intentionally-incorrect-local-only"])
    let (_, response) = try await session.data(for: request)
    guard let response = response as? HTTPURLResponse, response.url == url else { break }
    if response.statusCode == 429, let raw = response.value(forHTTPHeaderField: "Retry-After"), let seconds = Int(raw), (1...60).contains(seconds) { return }
    guard response.statusCode == 401 else { break }
  }
  throw NSError(domain: "NativeAccountFixture", code: 4, userInfo: [NSLocalizedDescriptionKey: "Real local rejected requests did not establish the shared password retry limit."])
}

private final class PasswordLimitNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
    completionHandler(nil)
  }
}
