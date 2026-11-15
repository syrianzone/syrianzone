import XCTest

// Only the separately bundled account-fixture entry accepts the local gate.
final class NativeAccountUITests: LocalFixtureTestCase {

  @MainActor
  func testPopupOverlayKeepsHomeGeometryAndQuietsOnlyForVisit() throws {
    try testClearLocalFixtureState()
    var app = try launch("member", id: 101)
    let quiet = app.buttons["إخفاء التنبيه لهذه الزيارة"].firstMatch
    XCTAssertTrue(quiet.waitForExistence(timeout: 15), "Enabled local popup")
    let settings = app.buttons["إعدادات الرئيسية"].firstMatch
    let search = app.textFields["ابحث في المساحة السورية"].firstMatch
    XCTAssertTrue(settings.exists)
    XCTAssertTrue(search.exists)
    let homeScroll = app.scrollViews.containing(.textField, identifier: "ابحث في المساحة السورية").firstMatch
    XCTAssertTrue(homeScroll.exists)
    let settingsFrame = settings.frame, searchFrame = search.frame, contentFrame = homeScroll.frame
    assertLocal(app, user: "member", id: 101)
    quiet.tap()
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: quiet)], timeout: 5), .completed)
    XCTAssertEqual(settings.frame.minY, settingsFrame.minY, accuracy: 1)
    XCTAssertEqual(search.frame.minY, searchFrame.minY, accuracy: 1)
    XCTAssertEqual(homeScroll.frame.height, contentFrame.height, accuracy: 1)
    // Visit-only quiet must not write the persistent dismissal version.
    app = try launch("member", id: 101)
    XCTAssertTrue(app.buttons["إخفاء التنبيه لهذه الزيارة"].firstMatch.waitForExistence(timeout: 15))
  }

  @MainActor
  func testMemberProfilePersistencePickerCancellationAndLogout() throws {
    var app = try launch("member", id: 101)
    open("account", app: app)
    let name = app.textFields["اسم المستخدم"], email = app.textFields["البريد الإلكتروني"]
    XCTAssertTrue(name.waitForExistence(timeout: 15))
    let originalName = name.value as? String ?? "", originalEmail = email.value as? String ?? ""
    let suffix = UUID().uuidString.lowercased().prefix(12)
    let updatedName = "تحقق محلي \(suffix)", updatedEmail = "native-ui-\(suffix)@native-fixture.invalid"
    XCTAssertFalse(originalName.isEmpty)
    XCTAssertTrue(originalEmail.hasSuffix("@native-fixture.invalid"))
    assertLocal(app, user: "member", id: 101)
    replace(name, with: updatedName)
    replace(email, with: updatedEmail)
    tap("حفظ التعديلات", app: app)
    XCTAssertTrue(app.staticTexts["تم تحديث معلومات الحساب بنجاح."].waitForExistence(timeout: 15))
    app = try launch("member", id: 101)
    open("account", app: app)
    XCTAssertTrue(app.textFields["اسم المستخدم"].waitForExistence(timeout: 15))
    XCTAssertEqual(app.textFields["اسم المستخدم"].value as? String, updatedName)
    XCTAssertEqual(app.textFields["البريد الإلكتروني"].value as? String, updatedEmail)
    assertLocal(app, user: "member", id: 101)
    let avatarButton = app.buttons["تغيير الصورة"].firstMatch
    XCTAssertTrue(avatarButton.waitForExistence(timeout: 10))
    XCTAssertGreaterThanOrEqual(avatarButton.frame.width, 120)
    XCTAssertGreaterThanOrEqual(avatarButton.frame.height, 44)
    XCTAssertLessThanOrEqual(avatarButton.frame.height, 64)
    tap("تغيير الصورة", app: app)
    let cancel = app.buttons.matching(NSPredicate(format: "label IN %@", ["Cancel", "إلغاء"])).firstMatch
    XCTAssertTrue(cancel.waitForExistence(timeout: 10), "Native photo picker cancellation")
    cancel.tap()
    XCTAssertTrue(app.textFields["اسم المستخدم"].waitForExistence(timeout: 5))
    assertLocal(app, user: "member", id: 101)
    replace(app.textFields["اسم المستخدم"], with: originalName)
    replace(app.textFields["البريد الإلكتروني"], with: originalEmail)
    tap("حفظ التعديلات", app: app)
    XCTAssertTrue(app.staticTexts["تم تحديث معلومات الحساب بنجاح."].waitForExistence(timeout: 15))
    app = try launch("member", id: 101)
    open("account", app: app)
    XCTAssertTrue(app.textFields["اسم المستخدم"].waitForExistence(timeout: 15))
    XCTAssertEqual(app.textFields["اسم المستخدم"].value as? String, originalName)
    XCTAssertEqual(app.textFields["البريد الإلكتروني"].value as? String, originalEmail)
    assertLocal(app, user: "member", id: 101)
    tap("تسجيل الخروج", app: app)
    XCTAssertTrue(app.buttons["تسجيل الدخول"].waitForExistence(timeout: 15))
  }

  @MainActor
  func testBoardRenamePersistsInRealLocalAccount() throws {
    var app = try launch("member", id: 101)
    open("board", app: app)
    assertLocal(app, user: "member", id: 101)
    tap("إدارة اللوحات", app: app)
    let field = app.textFields["اسم اللوحة"]
    XCTAssertTrue(field.waitForExistence(timeout: 10))
    let original = field.value as? String ?? ""
    XCTAssertFalse(original.isEmpty)
    replace(field, with: "لوحة تحقق محلية")
    tap("تغيير اسم اللوحة الحالية", app: app)
    tap("تم", app: app)
    XCTAssertTrue(app.staticTexts["محفوظ في الحساب"].waitForExistence(timeout: 15))
    app = try launch("member", id: 101)
    open("board", app: app)
    assertLocal(app, user: "member", id: 101)
    tap("إدارة اللوحات", app: app)
    XCTAssertTrue(app.textFields["اسم اللوحة"].waitForExistence(timeout: 10))
    XCTAssertEqual(app.textFields["اسم اللوحة"].value as? String, "لوحة تحقق محلية")
    replace(app.textFields["اسم اللوحة"], with: original)
    tap("تغيير اسم اللوحة الحالية", app: app)
    tap("تم", app: app)
    XCTAssertTrue(app.staticTexts["محفوظ في الحساب"].waitForExistence(timeout: 15))
  }

  @MainActor
  func testAdminDashboardAndPopupFormUseRealServerPermissions() throws {
    var app = try launch("admin", id: 103)
    open("dashboard", app: app)
    tap("المستخدمون وصلاحياتهم", app: app)
    XCTAssertTrue(app.staticTexts["المستخدمون"].waitForExistence(timeout: 15))
    open("site_popup_admin", app: app)
    let title = app.textFields["عنوان النافذة"]
    XCTAssertTrue(title.waitForExistence(timeout: 15))
    let original = title.value as? String ?? ""
    XCTAssertFalse(original.isEmpty)
    assertLocal(app, user: "admin", id: 103)
    replace(title, with: "نافذة تحقق محلية")
    tap("حفظ الإعدادات", app: app)
    XCTAssertTrue(app.staticTexts["تم حفظ إعدادات النافذة المنبثقة."].waitForExistence(timeout: 15))
    app = try launch("admin", id: 103)
    open("site_popup_admin", app: app)
    XCTAssertTrue(app.textFields["عنوان النافذة"].waitForExistence(timeout: 15))
    XCTAssertEqual(app.textFields["عنوان النافذة"].value as? String, "نافذة تحقق محلية")
    assertLocal(app, user: "admin", id: 103)
    replace(app.textFields["عنوان النافذة"], with: original)
    tap("حفظ الإعدادات", app: app)
    XCTAssertTrue(app.staticTexts["تم حفظ إعدادات النافذة المنبثقة."].waitForExistence(timeout: 15))
  }

  @MainActor
  func testClearLocalFixtureState() throws {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate()
    app.open(URL(string: "syrianzone://fixture/cleanup")!)
    dismissOwnPrompt()
    XCTAssertTrue(app.staticTexts["account.fixture.status"].waitForExistence(timeout: 15))
    let cleaned = NSPredicate(format: "label == %@", "FIXTURE CLEANED, ORIGINAL DATA UNTOUCHED")
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: cleaned, object: app.staticTexts["account.fixture.status"])], timeout: 15), .completed)
  }

}
