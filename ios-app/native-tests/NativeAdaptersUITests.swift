import XCTest

// Run only against the separately bundled adapter-fixture entry.
final class NativeAdaptersUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func testLongPickerValueStaysInsideItsNativeSlot() throws {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate(); app.launch()
    XCTAssertTrue(app.staticTexts["adapter.fixture"].waitForExistence(timeout: 15))
    let picker = app.buttons["مصدر التحقق الأصلي الطويل"].firstMatch
    XCTAssertTrue(picker.waitForExistence(timeout: 15))
    for _ in 0..<6 where !picker.isHittable { app.scrollViews.firstMatch.swipeUp() }
    let slot = app.otherElements["adapter.picker.long-slot"].firstMatch
    XCTAssertTrue(slot.exists && picker.isHittable)
    XCTAssertGreaterThan(slot.frame.height, 0)
    XCTAssertTrue(slot.frame.insetBy(dx: -1, dy: -1).contains(picker.frame), "The full native menu button must remain inside the measured React Native slot.")
    XCTAssertEqual(picker.value as? String, "مصدر بيانات طويل للتحقق من احتواء القائمة الأصلية داخل المساحة المخصصة لها مع بقاء اسم المصدر الكامل متاحاً لقارئ الشاشة")
    attach("native-long-picker-contained-with-complete-accessibility-value", app: app)
  }

  @MainActor
  func testNativeSliderHasOneSpokenLabelAndControlledRTLTrack() throws {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate(); app.launch()
    XCTAssertTrue(app.staticTexts["adapter.fixture"].waitForExistence(timeout: 15))
    let title = "شريط التحقق الأصلي", slider = app.sliders["شريط التحقق الأصلي"].firstMatch
    XCTAssertTrue(slider.waitForExistence(timeout: 15))
    XCTAssertEqual(slider.identifier, title)
    XCTAssertEqual(slider.label.components(separatedBy: title).count - 1, 1)
    XCTAssertTrue(slider.isHittable)
    // The shipping host uses RTL. Its minimum thumb is on the right.
    let right = slider.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5))
    let left = slider.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5))
    let origin = app.coordinate(withNormalizedOffset: .zero)
    let maximum = origin.withOffset(CGVector(dx: max(app.frame.minX + 1, slider.frame.minX - 20), dy: slider.frame.midY))
    let minimum = origin.withOffset(CGVector(dx: min(app.frame.maxX - 1, slider.frame.maxX + 20), dy: slider.frame.midY))
    right.press(forDuration: 0.1, thenDragTo: maximum)
    wait("slider", prefix: "SLIDER 100", app: app)
    left.press(forDuration: 0.1, thenDragTo: minimum)
    wait("slider", prefix: "SLIDER 0", app: app)
    attach("native-slider-one-label-and-controlled-rtl-values", app: app)
  }

  @MainActor
  func testNativePickerHasOneSpokenLabelAndControlledSelection() throws {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate(); app.launch()
    XCTAssertTrue(app.staticTexts["adapter.fixture"].waitForExistence(timeout: 15))
    let title = "قائمة التحقق الأصلية", picker = app.buttons["قائمة التحقق الأصلية"].firstMatch
    XCTAssertTrue(picker.waitForExistence(timeout: 15))
    XCTAssertEqual(picker.identifier, title)
    XCTAssertEqual(picker.label.components(separatedBy: title).count - 1, 1, "The system picker must announce its purpose once.")
    XCTAssertEqual(picker.value as? String, "الخيار الأول")
    XCTAssertTrue(picker.staticTexts["الخيار الأول"].exists)
    picker.tap()
    let second = app.buttons["الخيار الثاني"].firstMatch
    XCTAssertTrue(second.waitForExistence(timeout: 5)); second.tap()
    wait("picker", prefix: "PICKER second 1", app: app)
    XCTAssertTrue(picker.staticTexts["الخيار الثاني"].waitForExistence(timeout: 5))
    XCTAssertEqual(picker.value as? String, "الخيار الثاني")
    picker.tap()
    let first = app.buttons["الخيار الأول"].firstMatch
    XCTAssertTrue(first.waitForExistence(timeout: 5)); first.tap()
    wait("picker", prefix: "PICKER first 2", app: app)
    XCTAssertTrue(picker.staticTexts["الخيار الأول"].waitForExistence(timeout: 5))
    XCTAssertEqual(picker.value as? String, "الخيار الأول")
    attach("native-picker-one-label-and-controlled-selection", app: app)
  }

  @MainActor
  func testNativeToggleUpdatesItsControlledValue() throws {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate()
    app.launch()
    XCTAssertTrue(app.staticTexts["adapter.fixture"].waitForExistence(timeout: 15))
    let toggle = app.switches["تحقق المفتاح الأصلي"].firstMatch
    XCTAssertTrue(toggle.waitForExistence(timeout: 15))
    XCTAssertTrue(toggle.isHittable)
    let tree = XCTAttachment(string: app.debugDescription)
    tree.name = "native-toggle-before-activation-AX-tree"
    tree.lifetime = .keepAlways
    add(tree)
    // controls09 video shows the63pt switch track at the left of the full RTL
    // row. Its AX frame includes the label and blank space; the row center
    // misses the visible track. NativeThemeHost fixes layoutDirection to RTL.
    let trackInset = min(CGFloat(31), toggle.frame.width / 2)
    let geometry = XCTAttachment(string: "AX frame: \(toggle.frame), initial value: \(String(describing: toggle.value)), track target: \(CGPoint(x: toggle.frame.minX + trackInset, y: toggle.frame.midY))")
    geometry.name = "native-toggle-actual-frame-and-track-target"
    geometry.lifetime = .keepAlways
    add(geometry)
    attach("native-toggle-before-track-activation", app: app)
    let initial = String(describing: toggle.value)
    toggle.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0.5)).withOffset(CGVector(dx: trackInset, dy: 0)).tap()
    wait("toggle", prefix: "TOGGLE ON 1", app: app)
    wait("toggle-events", prefix: "TOGGLE EVENTS boolean:true", app: app)
    XCTAssertNotEqual(String(describing: toggle.value), initial)
    toggle.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0.5)).withOffset(CGVector(dx: trackInset, dy: 0)).tap()
    wait("toggle", prefix: "TOGGLE OFF 2", app: app)
    wait("toggle-events", prefix: "TOGGLE EVENTS boolean:true,boolean:false", app: app)
    XCTAssertEqual(String(describing: toggle.value), initial)
    attach("native-toggle-controlled-callbacks", app: app)
    // Apple's current iOS accessibility minimum is28pt, with44pt as default.
    // The system track is28pt high inside our44pt row. Its callbacks above
    // verify real activation; the row frame does not promise extra hit area.
    // Nested AX coordinates can round 28pt to 27.9999847pt.
    XCTAssertGreaterThanOrEqual(toggle.frame.height, 28 - 0.0001)
  }

  @MainActor
  func testHardwareKeyCommands() throws {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate()
    app.launch()
    XCTAssertTrue(app.staticTexts["adapter.fixture"].waitForExistence(timeout: 15))
    app.typeKey("1", modifierFlags: [])
    wait("keys", prefix: "KEY 1", app: app)
    app.typeKey(XCUIKeyboardKey.leftArrow, modifierFlags: [])
    wait("keys", prefix: "KEY ArrowLeft", app: app)
    attach("native-hardware-key-callbacks", app: app)
  }

  @MainActor
  func testNativeSVGPixelDimensions() throws {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate()
    app.launch()
    XCTAssertTrue(app.staticTexts["adapter.fixture"].waitForExistence(timeout: 15))
    tap("adapter.svg", app: app)
    wait("svg", prefix: "SVG PASS", app: app)
    tap("adapter.jpeg", app: app)
    wait("jpeg", prefix: "JPEG PASS", app: app)
    attach("native-svg-exact-pixel-export", app: app)
  }

  @MainActor
  func testDirectNativePNGAndJPEGEncoder() throws {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate()
    app.launch()
    XCTAssertTrue(app.staticTexts["adapter.fixture"].waitForExistence(timeout: 15))
    tap("adapter.encode", app: app)
    wait("encode", prefix: "ENCODE PASS", app: app)
    attach("bare-native-png-jpeg-encoder", app: app)
  }

  @MainActor
  func testGeneratedFilesQuickLookAndCancelledShares() throws {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate()
    app.launch()
    XCTAssertTrue(app.staticTexts["adapter.fixture"].waitForExistence(timeout: 15))
    tap("adapter.prepare", app: app)
    wait("files", prefix: "FILES PASS", app: app)
    tap("adapter.svg-share", app: app)
    dismissNativeSheet(app: app)
    wait("svgShare", prefix: "SVG SHARE PASS", app: app)
    tap("adapter.preview", app: app)
    dismissNativeSheet(app: app)
    wait("preview", prefix: "PREVIEW PASS", app: app)
    tap("adapter.png-share", app: app)
    dismissNativeSheet(app: app)
    wait("png", prefix: "PNG SHARE PASS", app: app)
    tap("adapter.zip-share", app: app)
    dismissNativeSheet(app: app)
    wait("zip", prefix: "ZIP SHARE PASS", app: app)
    attach("native-generated-files-and-cancelled-shares", app: app)
  }

  @MainActor
  func testBareAudioPlaybackOwnershipBackgroundAndNativeSleep() throws {
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    app.terminate()
    app.launch()
    XCTAssertTrue(app.staticTexts["adapter.fixture"].waitForExistence(timeout: 15))
    tap("adapter.tab.audio", app: app)
    tap("adapter.audio-start", app: app)
    wait("audio", prefix: "AUDIO PASS", app: app, timeout: 30)
    tap("adapter.audio-pause", app: app)
    wait("pause", prefix: "PAUSE PASS", app: app)
    tap("adapter.audio-resume", app: app)
    wait("resume", prefix: "RESUME PASS", app: app)
    tap("adapter.audio-owner", app: app)
    wait("owner", prefix: "OWNER PASS", app: app, timeout: 30)
    tap("adapter.audio-background", app: app)
    wait("background", prefix: "BACKGROUND ARMED", app: app)
    XCUIDevice.shared.press(.home)
    Thread.sleep(forTimeInterval: 3)
    app.activate()
    wait("background", prefix: "BACKGROUND PASS", app: app)
    tap("adapter.audio-sleep", app: app)
    wait("sleep", prefix: "SLEEP ARMED", app: app)
    XCUIDevice.shared.press(.home)
    Thread.sleep(forTimeInterval: 4)
    app.activate()
    wait("sleep", prefix: "SLEEP PASS", app: app)
    tap("adapter.audio-release", app: app)
    wait("release", prefix: "RELEASE PASS", app: app)
    attach("native-audio-paused-after-background-sleep", app: app)
  }

  @MainActor
  private func tap(_ id: String, app: XCUIApplication) {
    let button = app.buttons[id]
    XCTAssertTrue(button.waitForExistence(timeout: 5), id)
    for _ in 0..<5 where !button.isHittable { app.scrollViews.firstMatch.swipeUp() }
    for _ in 0..<5 where !button.isHittable { app.scrollViews.firstMatch.swipeDown() }
    XCTAssertTrue(button.isHittable, id)
    button.tap()
  }

  @MainActor
  private func wait(_ id: String, prefix: String, app: XCUIApplication, timeout: TimeInterval = 15) {
    let status = app.staticTexts["adapter.status.\(id)"]
    let predicate = NSPredicate(format: "label BEGINSWITH %@", prefix)
    let expectation = XCTNSPredicateExpectation(predicate: predicate, object: status)
    XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: timeout), .completed, "\(id): \(status.exists ? status.label : "missing")")
  }

  @MainActor
  private func dismissNativeSheet(app: XCUIApplication) {
    let outside = app.otherElements["PopoverDismissRegion"].firstMatch
    if outside.waitForExistence(timeout: 3) { outside.tap(); return }
    let buttons = app.buttons.matching(NSPredicate(format: "label IN %@", ["Done", "تم", "Close", "إغلاق", "Cancel", "إلغاء"]))
    let preview = app.otherElements["QLPreviewControllerView"].firstMatch
    if preview.exists && !buttons.firstMatch.exists { preview.tap() }
    XCTAssertTrue(buttons.firstMatch.waitForExistence(timeout: 10), "Native QuickLook/share dismissal control")
    buttons.firstMatch.tap()
  }

  @MainActor
  private func attach(_ name: String, app: XCUIApplication) {
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}
