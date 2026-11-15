import Foundation
import UIKit
import XCTest

// Real native multipart and moderation against the gated loopback fixture only.
final class NativeContributionUploadUITests: LocalFixtureTestCase {
  @MainActor
  func testNormalRevealExposesLocationConfirmationWithoutSubmitting() throws {
    let app = try launch("member", id: 101)
    defer { app.terminate() }
    let run = ContributionUploadRun()
    let query = String(format: "%.5f,%.5f", locale: Locale(identifier: "en_US_POSIX"), run.latitude, run.longitude)
    open("places?q=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")&view=list", app: app)
    let coordinateButtons = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "الانتقال إلى "))
    XCTAssertTrue(coordinateButtons.firstMatch.waitForExistence(timeout: 15))
    XCTAssertEqual(coordinateButtons.count, 1)
    let coordinate = coordinateButtons.firstMatch
    let selectedPoint = try contributionPoint(String(coordinate.label.dropFirst("الانتقال إلى ".count)))
    XCTAssertEqual(selectedPoint.latitude, run.latitude, accuracy: 0.0000001)
    XCTAssertEqual(selectedPoint.longitude, run.longitude, accuracy: 0.0000001)
    reveal(coordinate, app: app)
    XCTAssertTrue(coordinate.isHittable)
    coordinate.tap()
    XCTAssertTrue(app.maps.firstMatch.waitForExistence(timeout: 10))
    assertLocal(app, user: "member", id: 101)
    tap("أضف مكاناً", app: app)
    let targets = app.buttons.matching(identifier: "استخدام هذا الموقع")
    XCTAssertTrue(targets.firstMatch.waitForExistence(timeout: 10))
    XCTAssertEqual(targets.count, 1)
    let target = targets.firstMatch
    let owners = app.scrollViews.containing(.button, identifier: "استخدام هذا الموقع")
    XCTAssertEqual(owners.count, 1)
    let owner = owners.firstMatch
    let viewport = owner.frame.intersection(app.frame).insetBy(dx: 0, dy: 8)
    XCTAssertFalse(viewport.isEmpty)
    XCTAssertGreaterThan(target.frame.maxY, viewport.maxY, "The fresh map workflow must reproduce the offscreen confirmation control.")
    XCTAssertFalse(target.isHittable)
    try captureLocationScrollProbe("normal-reveal-offscreen-before", app: app, owner: owner, target: target, viewport: viewport, run: run)
    reveal(target, app: app)
    try captureLocationScrollProbe("normal-reveal-reached-after", app: app, owner: owner, target: target, viewport: viewport, run: run)
    XCTAssertTrue(viewport.contains(target.frame), "Normal reveal must fully contain the actual confirmation control.")
    XCTAssertTrue(target.isHittable)
    assertLocal(app, user: "member", id: 101)
    XCTAssertFalse(app.textFields["اسم المكان"].firstMatch.exists, "This regression must stop before the contribution form, Photos, and every submission action.")
  }

  @MainActor
  func testLocationConfirmationScrollGeometryWithoutSubmitting() throws {
    let app = try launch("member", id: 101)
    defer { app.terminate() }
    let run = ContributionUploadRun()
    let query = String(format: "%.5f,%.5f", locale: Locale(identifier: "en_US_POSIX"), run.latitude, run.longitude)
    open("places?q=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")&view=list", app: app)
    let coordinateButtons = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "الانتقال إلى "))
    XCTAssertTrue(coordinateButtons.firstMatch.waitForExistence(timeout: 15))
    XCTAssertEqual(coordinateButtons.count, 1, "Only the selected synthetic coordinate action may open the map.")
    let coordinate = coordinateButtons.firstMatch
    let selectedPoint = try contributionPoint(String(coordinate.label.dropFirst("الانتقال إلى ".count)))
    XCTAssertEqual(selectedPoint.latitude, run.latitude, accuracy: 0.0000001)
    XCTAssertEqual(selectedPoint.longitude, run.longitude, accuracy: 0.0000001)
    reveal(coordinate, app: app)
    XCTAssertTrue(coordinate.isHittable)
    coordinate.tap()
    XCTAssertTrue(app.maps.firstMatch.waitForExistence(timeout: 10))
    assertLocal(app, user: "member", id: 101)
    tap("أضف مكاناً", app: app)
    let targets = app.buttons.matching(identifier: "استخدام هذا الموقع")
    XCTAssertTrue(targets.firstMatch.waitForExistence(timeout: 10))
    XCTAssertEqual(targets.count, 1)
    let target = targets.firstMatch
    let owners = app.scrollViews.containing(.button, identifier: "استخدام هذا الموقع")
    XCTAssertEqual(owners.count, 1, "The probe must keep the one actual map-page scroll owner.")
    let owner = owners.firstMatch
    let viewport = owner.frame.intersection(app.frame).insetBy(dx: 0, dy: 8)
    guard !viewport.isEmpty, viewport.width > 32, viewport.height > 100 else {
      throw contributionFailure("The map-page scroll viewport must be visible before probing its gutters.")
    }
    XCTAssertFalse(app.keyboards.firstMatch.exists)
    XCTAssertTrue(app.buttons["إلغاء الإضافة"].firstMatch.exists)
    try captureLocationScrollProbe("before-left-drag", app: app, owner: owner, target: target, viewport: viewport, run: run)
    let origin = app.coordinate(withNormalizedOffset: .zero)
    let topY = viewport.minY + viewport.height * 0.25
    let bottomY = viewport.minY + viewport.height * 0.75
    origin.withOffset(CGVector(dx: viewport.minX + 8, dy: bottomY)).press(forDuration: 0.05, thenDragTo: origin.withOffset(CGVector(dx: viewport.minX + 8, dy: topY)))
    try captureLocationScrollProbe("after-left-drag-return", app: app, owner: owner, target: target, viewport: viewport, run: run)
    Thread.sleep(forTimeInterval: 1.5)
    try captureLocationScrollProbe("after-left-drag-settled", app: app, owner: owner, target: target, viewport: viewport, run: run)
    origin.withOffset(CGVector(dx: viewport.maxX - 8, dy: bottomY)).press(forDuration: 0.05, thenDragTo: origin.withOffset(CGVector(dx: viewport.maxX - 8, dy: topY)))
    try captureLocationScrollProbe("after-right-drag-return", app: app, owner: owner, target: target, viewport: viewport, run: run)
    Thread.sleep(forTimeInterval: 1.5)
    try captureLocationScrollProbe("after-right-drag-settled", app: app, owner: owner, target: target, viewport: viewport, run: run)
    assertLocal(app, user: "member", id: 101)
    XCTAssertFalse(app.textFields["اسم المكان"].firstMatch.exists, "This diagnostic must stop before the contribution form, Photos, and every submission action.")
  }

  @MainActor
  private func captureLocationScrollProbe(_ stage: String, app: XCUIApplication, owner: XCUIElement, target: XCUIElement, viewport: CGRect, run: ContributionUploadRun) throws {
    let measuredAt = Date()
    // Read the target frame first. XCTest may wait for app quiescence before returning it.
    let targetFrame = target.frame
    let ownerFrame = owner.frame
    let maps = owner.maps
    let mapCount = maps.count
    let mapFrame = mapCount > 0 ? maps.firstMatch.frame : .zero
    func geometry(_ frame: CGRect) -> [String: Double] {
      ["x": frame.minX, "y": frame.minY, "width": frame.width, "height": frame.height]
    }
    let footer = "حرّك الخريطة وضع علامة المركز فوق المكان، ثم أكّد الموقع."
    let footerFrames = owner.staticTexts.matching(identifier: footer).allElementsBoundByIndex.map { geometry($0.frame) }
    let values: [String: Any] = [
      "stage": stage, "diagnosticOnly": true, "measuredAt": measuredAt.timeIntervalSince1970,
      "measurementFinishedAt": Date().timeIntervalSince1970,
      "expectedLatitude": run.latitude, "expectedLongitude": run.longitude,
      "owner": geometry(ownerFrame), "initialViewport": geometry(viewport),
      "target": geometry(targetFrame), "targetHittable": target.isHittable,
      "map": geometry(mapFrame), "mapCount": mapCount, "footerTextFrames": footerFrames,
      "pressedUseLocation": false,
    ]
    let data = XCTAttachment(data: try JSONSerialization.data(withJSONObject: values, options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
    data.name = "mishwar-location-scroll-geometry-\(stage)"; data.lifetime = .keepAlways; add(data)
    // The scoped tree preserves native Host and footer ancestor frames without fixture launch data.
    let tree = XCTAttachment(string: owner.debugDescription)
    tree.name = "mishwar-location-scroll-owner-AX-\(stage)"; tree.lifetime = .keepAlways; add(tree)
    capture("mishwar-location-scroll-\(stage)", app: app)
    XCTAssertEqual(app.scrollViews.containing(.button, identifier: "استخدام هذا الموقع").count, 1)
    XCTAssertEqual(app.buttons.matching(identifier: "استخدام هذا الموقع").count, 1)
    XCTAssertEqual(mapCount, 1)
    XCTAssertFalse(mapFrame.isEmpty)
    XCTAssertFalse(mapFrame.intersection(viewport).isEmpty, "The selected coordinate map must remain visible during this diagnostic.")
    XCTAssertEqual(ownerFrame.minX, viewport.minX, accuracy: 0.5)
    XCTAssertEqual(ownerFrame.width, viewport.width, accuracy: 0.5)
    XCTAssertEqual(ownerFrame.minY, viewport.minY - 8, accuracy: 0.5)
    XCTAssertEqual(ownerFrame.height, viewport.height + 16, accuracy: 0.5)
    XCTAssertFalse(app.keyboards.firstMatch.exists)
    XCTAssertFalse(app.textFields["اسم المكان"].firstMatch.exists)
  }

  @MainActor
  func testOwnedAlbumContributionApprovalVisibilityAndExactCleanup() async throws {
    let backend = try ContributionUploadBackend(environment: ProcessInfo.processInfo.environment)
    addTeardownBlock { try await backend.cleanupAndClose() }
    try await backend.prepare()
    try NativePhotoFixtures.cleanupRecordedFixtures()
    let photo = try NativePhotoFixtures.create(in: self)
    let app = try launch("member", id: 101)
    let run = ContributionUploadRun()
    let query = String(format: "%.5f,%.5f", locale: Locale(identifier: "en_US_POSIX"), run.latitude, run.longitude)
    open("places?q=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")&view=list", app: app)
    let coordinate = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "الانتقال إلى ")).firstMatch
    XCTAssertTrue(coordinate.waitForExistence(timeout: 15))
    reveal(coordinate, app: app)
    coordinate.tap()
    XCTAssertTrue(app.maps.firstMatch.waitForExistence(timeout: 10))
    assertLocal(app, user: "member", id: 101)
    tap("أضف مكاناً", app: app)
    tap("استخدام هذا الموقع", app: app)
    let nearby = app.buttons["متابعة الإضافة على أي حال"].firstMatch
    if nearby.waitForExistence(timeout: 3) { tap("متابعة الإضافة على أي حال", app: app) }
    let name = app.textFields["اسم المكان"].firstMatch
    XCTAssertTrue(name.waitForExistence(timeout: 20))
    let point = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", #"[0-9]{2}\.[0-9]{5}, [0-9]{2}\.[0-9]{5}"#)).firstMatch
    XCTAssertTrue(point.exists)
    let actual = try contributionPoint(point.label)
    XCTAssertEqual(actual.latitude, run.latitude, accuracy: 0.0001)
    XCTAssertEqual(actual.longitude, run.longitude, accuracy: 0.0001)
    try backend.arm(run, latitude: actual.latitude, longitude: actual.longitude)
    replace(name, with: run.name)
    try captureAndVerifyTypedFields(run, name: name, description: nil, stage: "after-name-entry", app: app)
    tap("التصنيف", app: app)
    tap("تاريخي", app: app)
    let description = app.textViews["الوصف (20 إلى 1000 حرف)"].firstMatch
    XCTAssertTrue(description.waitForExistence(timeout: 5))
    replace(description, with: run.description)
    try captureAndVerifyTypedFields(run, name: name, description: description, stage: "after-description-entry", app: app)
    try photo.verifySingleOwnedPhoto()
    tap("اختيار صور", app: app)
    try chooseOnlyOwnedAlbumPhoto(photo, app: app)
    XCTAssertTrue(app.staticTexts["الصور (1 / 10)"].firstMatch.waitForExistence(timeout: 15))
    try captureAndVerifyTypedFields(run, name: name, description: description, stage: "after-picker-before-upload", app: app)
    assertLocal(app, user: "member", id: 101)
    tap("إرسال المكان", app: app)
    let receiptVisible = app.staticTexts["تم إرسال المكان وسيظهر على الخريطة بعد الموافقة."].firstMatch.waitForExistence(timeout: 25)
    let marker = app.staticTexts["account.fixture.status"]
    let markerExists = marker.exists
    let observationData = markerExists ? (marker.value as? String)?.data(using: .utf8) : nil
    let observation = observationData.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
    let uploads = observation?["uploads"] as? [[String: Any]]
    // Retain only the fixture's bounded, sanitized upload observer values.
    let uploadState: [String: Any] = ["receiptVisible": receiptVisible, "statusMarkerExists": markerExists,
      "uploadObserverPresent": uploads != nil, "uploads": Array((uploads ?? []).suffix(6))]
    let uploadDiagnostic = XCTAttachment(data: try JSONSerialization.data(withJSONObject: uploadState, options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
    uploadDiagnostic.name = "mishwar-post-submit-upload-observation"; uploadDiagnostic.lifetime = .keepAlways; add(uploadDiagnostic)
    XCTAssertTrue(receiptVisible)
    let receipt = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", #"رقم المساهمة: [1-9][0-9]*"#)).firstMatch
    XCTAssertTrue(receipt.waitForExistence(timeout: 5))
    let id = try XCTUnwrap(Int(receipt.label.replacingOccurrences(of: "رقم المساهمة: ", with: "")))
    try await backend.confirmCreated(id: id)
    capture("mishwar-own-generated-photo-pending-receipt", app: app)

    // Native account changes use fresh gated real sessions. Backend observation has its own tokens.
    let admin = try launch("admin", id: 103)
    try await backend.confirmPendingAdminRow()
    let beforeModerationNavigation = try moderationNavigation(admin)
    open("places_admin", app: admin)
    XCTAssertTrue(admin.staticTexts["إدارة أماكن مشوار"].firstMatch.waitForExistence(timeout: 20))
    let heading = admin.staticTexts[run.name].firstMatch
    XCTAssertTrue(heading.waitForExistence(timeout: 20))
    reveal(heading, app: admin)
    try captureModerationLookup(run, previousSequence: beforeModerationNavigation.sequence, app: admin)
    let initialApproval = try ownedModerationAction(name: run.name, description: run.description, action: "قبول المكان", app: admin)
    reveal(initialApproval, app: admin)
    XCTAssertTrue(initialApproval.isEnabled)
    // Refresh actual owner/photo provenance immediately before the unscoped moderator action.
    try await backend.confirmPendingAdminRow()
    assertLocal(admin, user: "admin", id: 103)
    let freshNavigation = try moderationNavigation(admin)
    guard freshNavigation.sequence == beforeModerationNavigation.sequence + 1,
      freshNavigation.destination == "places_admin", freshNavigation.status == "opened",
      admin.staticTexts["إدارة أماكن مشوار"].firstMatch.exists else {
      throw contributionFailure("The same fresh local administrator moderation route is required immediately before approval.")
    }
    let approve = try ownedModerationAction(name: run.name, description: run.description, action: "قبول المكان", app: admin)
    XCTAssertTrue(approve.isEnabled && approve.isHittable, "Only the freshly resolved visible owned approval action may be tapped.")
    approve.tap()
    XCTAssertTrue(admin.staticTexts["تم حفظ التغيير."].firstMatch.waitForExistence(timeout: 20))
    try await backend.waitForApproved()
    capture("mishwar-own-place-approved-through-native-admin", app: admin)

    let member = try launch("member", id: 101)
    open("place?id=\(id)", app: member)
    XCTAssertTrue(member.staticTexts[run.name].firstMatch.waitForExistence(timeout: 20))
    XCTAssertTrue(member.staticTexts[run.description].firstMatch.exists)
    XCTAssertTrue(member.buttons["فتح الصورة 1"].firstMatch.waitForExistence(timeout: 10))
    XCTAssertTrue(member.buttons["حفظ في حسابك"].firstMatch.exists, "Approval must expose the real published-place actions.")
    XCTAssertFalse(member.staticTexts["قيد المراجعة"].exists)
    assertLocal(member, user: "member", id: 101)
    capture("mishwar-published-own-contribution-with-real-upload", app: member)
    try await backend.confirmPublicVisibility()
    // Owner deletion uses its real ownership-scoped endpoint, never an admin bulk operation.
    try await backend.cleanupCreatedPlace()
    open("places?tab=mine&view=list", app: member)
    XCTAssertTrue(member.staticTexts["مساهماتي"].firstMatch.waitForExistence(timeout: 15))
    XCTAssertFalse(member.staticTexts[run.name].exists)
    try photo.cleanup()
    open("account", app: member)
    tap("تسجيل الخروج", app: member)
    XCTAssertTrue(member.buttons["تسجيل الدخول"].firstMatch.waitForExistence(timeout: 15))
  }

  @MainActor
  private func captureAndVerifyTypedFields(_ run: ContributionUploadRun, name: XCUIElement, description: XCUIElement?, stage: String, app: XCUIApplication) throws {
    // Read only these two nonsecure synthetic form fields, once per checkpoint.
    let actualName = name.value as? String
    let actualDescription = description?.value as? String
    let values: [String: Any] = [
      "stage": stage, "identifier": run.identifier,
      "expectedName": run.name, "actualName": actualName as Any? ?? NSNull(),
      "descriptionEntered": description != nil, "expectedDescription": run.description,
      "actualDescription": actualDescription as Any? ?? NSNull(),
    ]
    let diagnostic = XCTAttachment(data: try JSONSerialization.data(withJSONObject: values, options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
    diagnostic.name = "mishwar-synthetic-field-values-\(stage)"; diagnostic.lifetime = .keepAlways; add(diagnostic)
    guard actualName == run.name, description == nil || actualDescription == run.description else {
      capture("mishwar-synthetic-field-mismatch-\(stage)", app: app)
      let tree = XCTAttachment(string: app.debugDescription)
      tree.name = "mishwar-synthetic-field-mismatch-AX-\(stage)"; tree.lifetime = .keepAlways; add(tree)
      throw contributionFailure("The actual synthetic form text changed at \(stage). Exact input is required; no upload was attempted.")
    }
  }

  @MainActor
  private func chooseOnlyOwnedAlbumPhoto(_ photo: NativePhotoFixtures.Fixture, app: XCUIApplication) throws {
    let collections = app.buttons.matching(NSPredicate(format: "label IN %@", ["Albums", "Collections", "الألبومات", "المجموعات"])).firstMatch
    XCTAssertTrue(collections.waitForExistence(timeout: 10), "Open the system picker's album catalogue before selecting anything.")
    collections.tap()
    let album = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", photo.albumTitle)).firstMatch
    for _ in 0..<8 {
      if album.exists && album.isHittable { break }
      guard let grid = app.collectionViews.allElementsBoundByIndex.first(where: { !$0.frame.intersection(app.frame).isEmpty }) else { break }
      grid.swipeUp()
    }
    guard album.exists && album.isHittable else { throw contributionFailure("Only the full exact UUID album is eligible. Never fall back to Recents or an arbitrary thumbnail.") }
    try photo.verifySingleOwnedPhoto()
    album.tap()
    let albumHeading = app.navigationBars[photo.albumTitle].firstMatch
    let albumHeadingText = app.navigationBars.staticTexts[photo.albumTitle].firstMatch
    guard albumHeading.waitForExistence(timeout: 5) || albumHeadingText.exists else { throw contributionFailure("The picker navigation bar must expose the exact opened album title before any asset selection.") }
    try photo.verifySingleOwnedPhoto()
    try captureOwnedAlbumStructure(photo, app: app)
    do {
      let grids = app.scrollViews.matching(identifier: "photosView_content_scroll_view")
      guard grids.count == 1, !grids.firstMatch.frame.intersection(app.frame).isEmpty else {
        throw contributionFailure("The exact opened album must expose its one visible observed Photos content scroll view.")
      }
      let images = grids.firstMatch.images.matching(identifier: "PXGGridLayout-Info")
      guard images.count == 1, images.firstMatch.isHittable else {
        throw contributionFailure("Only the one observed image inside the owned album's Photos content view may be selected.")
      }
      let done = albumHeading.buttons.matching(NSPredicate(format: "label == %@", "Done"))
      guard done.count == 1, !done.firstMatch.isEnabled else {
        throw contributionFailure("The observed exact album Done control must start disabled before its one photo is selected.")
      }
      try photo.verifySingleOwnedPhoto()
      guard albumHeading.exists else { throw contributionFailure("The exact owned album must remain open immediately before selection.") }
      images.firstMatch.tap()
      let enabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true AND enabled == true"), object: done.firstMatch)
      guard XCTWaiter.wait(for: [enabled], timeout: 10) == .completed else {
        throw contributionFailure("The observed album Done control did not enable after selecting the one owned photo.")
      }
      try captureOwnedAlbumStructure(photo, app: app, phase: "one-photo-selected")
      done.firstMatch.tap()
    } catch {
      try? captureOwnedAlbumStructure(photo, app: app, phase: "selection-failure")
      throw error
    }
  }

  @MainActor
  private func captureOwnedAlbumStructure(_ photo: NativePhotoFixtures.Fixture, app: XCUIApplication, phase: String = "before-selection") throws {
    try photo.verifySingleOwnedPhoto()
    guard app.navigationBars[photo.albumTitle].exists || app.navigationBars.staticTexts[photo.albumTitle].exists else {
      throw contributionFailure("Only the exact opened owned album may be captured or inspected before asset selection.")
    }
    let snapshot = app.debugDescription
    let tree = XCTAttachment(string: snapshot)
    tree.name = "mishwar-owned-album-actual-AX-\(phase)"; tree.lifetime = .keepAlways; add(tree)
    capture("mishwar-owned-album-\(phase)", app: app)
    // Derive diagnostics from the same immutable snapshot. Picker layout can
    // invalidate live index-bound XCUI elements between their count and label reads.
    let lines = snapshot.split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }
    let label = try NSRegularExpression(pattern: #"label: '([^']*)'"#)
    let roles: [[String: Any]] = ["CollectionView", "Cell", "ScrollView", "Image", "Button", "Table", "Other"].map { name in
      let matching = lines.filter { $0.hasPrefix(name + ",") }
      let labels = matching.prefix(80).compactMap { line -> String? in
        let value = line as NSString
        guard let match = label.firstMatch(in: line, range: NSRange(location: 0, length: value.length)) else { return nil }
        return value.substring(with: match.range(at: 1))
      }
      return ["type": name, "count": matching.count, "labels": labels]
    }
    let summary = XCTAttachment(data: try JSONSerialization.data(withJSONObject: roles, options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
    summary.name = "mishwar-owned-album-role-counts-and-labels-\(phase)"; summary.lifetime = .keepAlways; add(summary)
  }

  @MainActor
  private func moderationNavigation(_ app: XCUIApplication) throws -> (sequence: Int, destination: String, status: String) {
    let marker = app.staticTexts["account.fixture.status"]
    guard marker.exists, let raw = marker.value as? String, let bytes = raw.data(using: .utf8),
      let value = try JSONSerialization.jsonObject(with: bytes) as? [String: Any],
      let sequence = value["sequence"] as? Int, sequence >= 0,
      let destination = value["destination"] as? String, let status = value["status"] as? String else {
      throw contributionFailure("The local navigation acknowledgement must exist before inspecting moderation.")
    }
    return (sequence, destination, status)
  }

  @MainActor
  private func captureModerationLookup(_ run: ContributionUploadRun, previousSequence: Int, app: XCUIApplication) throws {
    let origin = app.staticTexts["account.fixture.origin"].firstMatch
    guard origin.exists, origin.label == "https://127.0.0.1:9443" else {
      throw contributionFailure("Only the verified local fixture may be captured for moderation diagnostics.")
    }
    let snapshot = app.debugDescription
    let tree = XCTAttachment(string: snapshot)
    tree.name = "mishwar-fresh-admin-before-owned-card-AX"; tree.lifetime = .keepAlways; add(tree)
    capture("mishwar-fresh-admin-before-owned-card", app: app)
    let lines = snapshot.split(separator: "\n").map(String.init)
    struct Candidate { var line: Int; var name = 0; var description = 0; var approve = 0; var view = 0 }
    var candidates: [Candidate] = [], ancestors: [(depth: Int, candidate: Int?)] = []
    var nameTotal = 0, descriptionTotal = 0
    for (index, line) in lines.enumerated() {
      let depth = line.prefix(while: { $0 == " " }).count
      while let last = ancestors.last, last.depth >= depth { ancestors.removeLast() }
      let text = line.trimmingCharacters(in: .whitespaces)
      let name = text.hasPrefix("StaticText,") && line.contains("label: '\(run.name)'")
      let description = text.hasPrefix("StaticText,") && line.contains("label: '\(run.description)'")
      let approve = text.hasPrefix("Button,") && line.contains("label: 'قبول المكان'")
      let view = text.hasPrefix("Button,") && line.contains("label: 'عرض المكان'")
      if name { nameTotal += 1 }; if description { descriptionTotal += 1 }
      for ancestor in ancestors {
        guard let candidate = ancestor.candidate else { continue }
        if name { candidates[candidate].name += 1 }; if description { candidates[candidate].description += 1 }
        if approve { candidates[candidate].approve += 1 }; if view { candidates[candidate].view += 1 }
      }
      if text.hasPrefix("Other,") {
        candidates.append(Candidate(line: index + 1)); ancestors.append((depth, candidates.count - 1))
      } else { ancestors.append((depth, nil)) }
    }
    let named = candidates.filter { $0.name > 0 }, navigation = try moderationNavigation(app)
    let values: [String: Any] = ["identifier": run.identifier, "capturedAt": Date().timeIntervalSince1970,
      "origin": origin.label, "identity": app.staticTexts["account.fixture.identity"].firstMatch.label,
      "previousNavigationSequence": previousSequence, "navigationSequence": navigation.sequence,
      "navigationDestination": navigation.destination, "navigationStatus": navigation.status,
      "moderationHeadingPresent": app.staticTexts["إدارة أماكن مشوار"].firstMatch.exists,
      "exactNameStaticTextCountFromSnapshot": nameTotal, "exactDescriptionStaticTextCountFromSnapshot": descriptionTotal,
      "candidateAncestorCountFromSnapshot": named.count,
      "legacyEligibleAncestorCountFromSnapshot": named.filter { $0.name == 1 && $0.description == 1 && $0.approve == 1 && $0.view == 1 }.count,
      "candidateCountsFromSnapshot": Array(named.prefix(80)).map { ["axLine": $0.line, "name": $0.name, "description": $0.description, "approve": $0.approve, "view": $0.view] }]
    let metadata = XCTAttachment(data: try JSONSerialization.data(withJSONObject: values, options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
    metadata.name = "mishwar-fresh-admin-owned-card-candidate-counts"; metadata.lifetime = .keepAlways; add(metadata)
    assertLocal(app, user: "admin", id: 103)
    guard app.staticTexts["إدارة أماكن مشوار"].firstMatch.exists,
      navigation.sequence == previousSequence + 1, navigation.destination == "places_admin", navigation.status == "opened" else {
      throw contributionFailure("The exact fresh admin navigation and moderation heading are required before the owned-card lookup.")
    }
  }

  @MainActor
  private func ownedModerationAction(name: String, description: String, action: String, app: XCUIApplication) throws -> XCUIElement {
    func usable(_ frame: CGRect) -> Bool {
      [frame.minX, frame.minY, frame.width, frame.height].allSatisfy(\.isFinite) && frame.width > 0 && frame.height > 0
    }
    func textFrames(_ label: String) -> [CGRect] {
      app.staticTexts.matching(NSPredicate(format: "label == %@", label)).allElementsBoundByIndex
        .map(\.frame).filter(usable).reduce(into: [CGRect]()) { frames, frame in
          if !frames.contains(frame) { frames.append(frame) }
        }
    }
    // Native21 exposes nested text twice at the same physical bounds, while
    // Section's background Other is a sibling of its flattened text/actions.
    let names = textFrames(name), descriptions = textFrames(description)
    guard names.count == 1, descriptions.count == 1 else {
      throw contributionFailure("Exactly one physical owned name and description must identify the moderation record. Distinct duplicates are refused.")
    }
    let actions = app.buttons.matching(NSPredicate(format: "label == %@", action)).allElementsBoundByIndex
    let views = app.buttons.matching(NSPredicate(format: "label == %@", "عرض المكان")).allElementsBoundByIndex
    var cards: [(bounds: CGRect, action: XCUIElement)] = []
    for background in app.otherElements.allElementsBoundByIndex {
      let bounds = background.frame
      guard usable(bounds), bounds.contains(names[0]), bounds.contains(descriptions[0]),
        background.children(matching: .any).count == 0 else { continue }
      let ownedActions = actions.filter { usable($0.frame) && bounds.contains($0.frame) }
      let ownedViews = views.filter { usable($0.frame) && bounds.contains($0.frame) }
      guard ownedActions.count == 1, ownedViews.count == 1 else { continue }
      if !cards.contains(where: { $0.bounds == bounds }) { cards.append((bounds, ownedActions[0])) }
    }
    cards.sort { $0.bounds.width * $0.bounds.height < $1.bounds.width * $1.bounds.height }
    guard let card = cards.first else {
      throw contributionFailure("The actual native Section bounds must enclose the exact owned name/description and exactly one approval and one view action. Whole-list and neighboring-record matches are refused.")
    }
    let smallestArea = card.bounds.width * card.bounds.height
    guard cards.filter({ $0.bounds.width * $0.bounds.height == smallestArea }).count == 1 else {
      throw contributionFailure("Ambiguous smallest native moderation bounds refuse an approval action.")
    }
    return card.action
  }

  @MainActor
  private func capture(_ name: String, app: XCUIApplication) {
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
  }
}

private struct ContributionUploadRun: Codable, Sendable {
  let identifier: String
  let name: String
  let description: String
  let latitude: Double
  let longitude: Double
  init() {
    let id = UUID().uuidString
    identifier = id; name = "مكان تحقق محلي \(id)"
    description = "مساهمة محلية بصورة اختبار عامة مولدة، للتحقق من الرفع والمراجعة والحذف. \(id)"
    let digits = id.replacingOccurrences(of: "-", with: "")
    latitude = 34.75 + Double((Int(digits.prefix(4), radix: 16) ?? 0) % 900 + 1) / 100000
    longitude = 39 + Double((Int(digits.suffix(4), radix: 16) ?? 0) % 900 + 1) / 100000
  }
}
private typealias ContributionObject = [String: Any]
private func contributionFailure(_ message: String) -> NSError {
  NSError(domain: "NativeContributionUploadFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
}
private func contributionPoint(_ label: String) throws -> (latitude: Double, longitude: Double) {
  let values = label.components(separatedBy: ", ").compactMap(Double.init)
  guard values.count == 2, values.allSatisfy(\.isFinite) else { throw contributionFailure("A real form coordinate pair was required.") }
  return (values[0], values[1])
}

// No credentials are written or logged. Every request checks the one loopback HTTPS origin.
private final class ContributionUploadBackend: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  private let origin = "https://127.0.0.1:9443"
  private var gate = "", memberToken = "", adminToken = ""
  private var session: URLSession!
  private var before = Set<Int>()
  private var run: ContributionUploadRun?
  private var coordinate: (latitude: Double, longitude: Double)?
  private var createdID: Int?
  private var photoIDs: [Int] = [], media: [String] = []
  private var recordURL: URL?
  private var cleaned = false

  init(environment: [String: String]) throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == NativePhotoFixtures.runnerBundleIdentifier, environment["SIMULATOR_UDID"] != nil,
      environment["SZ_NATIVE_FIXTURE_ORIGIN"] == origin, let key = environment["SZ_NATIVE_FIXTURE_GATE"],
      key.range(of: "^[A-Za-z0-9_-]{16,256}$", options: .regularExpression) != nil else { throw contributionFailure("The exact private Simulator fixture runner is required.") }
    gate = key
    super.init()
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieStorage = nil; configuration.httpShouldSetCookies = false
    configuration.urlCredentialStorage = nil; configuration.urlCache = nil
    configuration.timeoutIntervalForRequest = 15; configuration.timeoutIntervalForResource = 20
    session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    #else
    throw XCTSkip("Contribution upload fixtures refuse physical devices and Mac Photos.")
    #endif
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }

  func prepare() async throws {
    memberToken = try await provision("member", id: 101, email: "member@native-fixture.invalid")
    adminToken = try await provision("admin", id: 103, email: "admin@native-fixture.invalid")
    let admin = try await object("/api/v1/user", token: adminToken)
    guard let permissions = admin["effective_permissions"] as? [String], permissions.contains("places.review"), permissions.contains("places.approve") else {
      throw contributionFailure("Real admin permissions were not confirmed.")
    }
    before = Set(try await mine().map { try positiveID($0["id"]) })
  }

  func arm(_ run: ContributionUploadRun, latitude: Double, longitude: Double) throws {
    guard self.run == nil, latitude.isFinite, longitude.isFinite,
      abs(latitude - run.latitude) <= 0.0001, abs(longitude - run.longitude) <= 0.0001 else { throw contributionFailure("The owned contribution must keep its unique selected coordinates.") }
    self.run = run; coordinate = (latitude, longitude)
    let directory = try XCTUnwrap(FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first)
      .appendingPathComponent("SyrianZoneNativeContributions", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    guard try directory.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink != true else { throw contributionFailure("Refusing a symlink in the private contribution cache.") }
    try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: directory.path)
    recordURL = directory.appendingPathComponent(run.identifier).appendingPathExtension("json")
    try persistRecord()
  }

  func confirmCreated(id: Int) async throws {
    guard id > 203, !before.contains(id) else { throw contributionFailure("A new task-created ID was required.") }
    let rows = try await mine().filter { ($0["id"] as? NSNumber)?.intValue == id }
    guard rows.count == 1 else { throw contributionFailure("The actual owner list did not confirm the submitted ID.") }
    try validate(rows[0], id: id, status: "pending", detail: false)
    let detail = try await object("/api/v1/places/\(id)", token: memberToken)
    try validate(detail, id: id, status: "pending", detail: true)
    let photos = try photosIn(detail, id: id)
    guard photos.count == 1 else { throw contributionFailure("Exactly one processed uploaded photo was required.") }
    createdID = id; photoIDs = try photos.map { try positiveID($0["id"]) }
    media = try photos.flatMap { row -> [String] in
      guard let thumb = row["thumb_url"] as? String, let display = row["display_url"] as? String else { throw contributionFailure("Real photo URLs were required.") }
      return [thumb, display]
    }
    try persistRecord()
    let (imageData, _) = try await data(media[1], token: nil, expected: 200)
    guard let image = UIImage(data: imageData)?.cgImage, image.width == 640, image.height == 480 else { throw contributionFailure("The processed photo must preserve the generated PNG's 640x480 dimensions.") }
    let (_, response) = try await data("/api/v1/places/\(id)", token: nil, expected: 404)
    guard response.statusCode == 404 else { throw contributionFailure("A pending contribution must remain private to its owner and moderators.") }
  }

  func confirmPendingAdminRow() async throws {
    let id = try requiredID()
    let page = try await object("/api/v1/admin/places?status=pending&page=1", token: adminToken)
    guard let rows = page["data"] as? [ContributionObject], let row = rows.first(where: { ($0["id"] as? NSNumber)?.intValue == id }) else { throw contributionFailure("The exact contribution must appear on the actual pending moderation page.") }
    try validate(row, id: id, status: "pending", detail: true)
    guard try photosIn(row, id: id).map({ try positiveID($0["id"]) }) == photoIDs else { throw contributionFailure("Moderation photo IDs changed before approval.") }
  }

  func waitForApproved() async throws {
    let id = try requiredID(), deadline = Date().addingTimeInterval(12)
    while Date() < deadline {
      let detail = try await object("/api/v1/places/\(id)", token: memberToken)
      if detail["status"] as? String == "approved" { try validate(detail, id: id, status: "approved", detail: true); return }
      try await Task.sleep(nanoseconds: 200_000_000)
    }
    throw contributionFailure("The actual native admin action did not approve the recorded contribution.")
  }

  func confirmPublicVisibility() async throws {
    let id = try requiredID(), detail = try await object("/api/v1/places/\(id)", token: nil)
    try validate(detail, id: id, status: "approved", detail: true)
    guard try photosIn(detail, id: id).map({ try positiveID($0["id"]) }) == photoIDs else { throw contributionFailure("Published photo IDs must match the actual upload.") }
  }

  func cleanupCreatedPlace() async throws {
    if cleaned || run == nil { return }
    if createdID == nil {
      let matches = try await mine().filter { $0["name"] as? String == run?.name }
      if matches.isEmpty { cleaned = true; try removeRecord(); return }
      guard matches.count == 1 else { throw contributionFailure("Ambiguous owner rows are retained without deleting anything.") }
      try await confirmCreated(id: positiveID(matches[0]["id"]))
    }
    let id = try requiredID()
    let detail = try await object("/api/v1/places/\(id)", token: memberToken)
    guard let status = detail["status"] as? String, ["pending", "approved"].contains(status) else { throw contributionFailure("Unexpected moderation state is retained for review.") }
    try validate(detail, id: id, status: status, detail: true)
    guard try photosIn(detail, id: id).map({ try positiveID($0["id"]) }) == photoIDs else { throw contributionFailure("Refusing cleanup after the recorded photo IDs changed.") }
    _ = try await data("/api/v1/my/places/\(id)", token: memberToken, method: "DELETE", expected: 204)
    _ = try await data("/api/v1/places/\(id)", token: memberToken, expected: 404)
    guard try await !mine().contains(where: { ($0["id"] as? NSNumber)?.intValue == id }) else { throw contributionFailure("Deleted contribution remains in the real owner list.") }
    for url in media { _ = try await data(url, token: nil, expected: 404) }
    cleaned = true
    try removeRecord()
  }

  func cleanupAndClose() async throws {
    defer { session?.invalidateAndCancel() }
    var failure: Error?
    do { try await cleanupCreatedPlace() } catch { failure = error }
    for token in [memberToken, adminToken] where !token.isEmpty {
      do { _ = try await data("/api/v1/auth/logout", token: token, method: "POST", expected: 200) }
      catch { if failure == nil { failure = error } }
    }
    if let failure { throw failure }
  }

  private func persistRecord() throws {
    guard let run, let coordinate, let recordURL else { throw contributionFailure("The private task record must exist before submission.") }
    let value: ContributionObject = ["version": 1, "identifier": run.identifier, "name": run.name, "description": run.description,
      "latitude": coordinate.latitude, "longitude": coordinate.longitude, "beforeIDs": before.sorted(),
      "createdID": createdID as Any? ?? NSNull(), "photoIDs": photoIDs, "media": media]
    try JSONSerialization.data(withJSONObject: value).write(to: recordURL, options: [.atomic, .completeFileProtection])
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: recordURL.path)
  }

  private func removeRecord() throws {
    guard let recordURL else { return }
    if FileManager.default.fileExists(atPath: recordURL.path) { try FileManager.default.removeItem(at: recordURL) }
  }

  private func validate(_ row: ContributionObject, id: Int, status: String, detail: Bool) throws {
    guard let run, let coordinate, !before.contains(id), try positiveID(row["id"]) == id,
      row["name"] as? String == run.name, row["description"] as? String == run.description,
      row["category"] as? String == "historical", row["status"] as? String == status,
      let latitude = row["lat"] as? NSNumber, let longitude = row["lng"] as? NSNumber,
      abs(latitude.doubleValue - coordinate.latitude) <= 0.00002, abs(longitude.doubleValue - coordinate.longitude) <= 0.00002 else { throw contributionFailure("The exact task name, ID, text, category, selected point, and state must match before any moderation or cleanup.") }
    if detail {
      guard let user = row["user"] as? ContributionObject, try positiveID(user["id"]) == 101 else { throw contributionFailure("Only the real synthetic member 101's own contribution can be mutated.") }
    }
  }

  private func photosIn(_ row: ContributionObject, id: Int) throws -> [ContributionObject] {
    guard let photos = row["photos"] as? [ContributionObject], photos.count == 1 else { throw contributionFailure("The one uploaded photo must remain unambiguous.") }
    for photo in photos {
      _ = try positiveID(photo["id"])
      for key in ["thumb_url", "display_url"] {
        guard let raw = photo[key] as? String, let url = URLComponents(string: raw), url.scheme == "https", url.host == "127.0.0.1", url.port == 9443,
          url.user == nil, url.password == nil, url.fragment == nil,
          url.path.range(of: "^/storage/places/\(id)/[a-f0-9-]{36}_(thumb|display)\\.webp$", options: .regularExpression) != nil else { throw contributionFailure("The photo URL must belong to this exact local contribution.") }
      }
    }
    return photos
  }

  private func requiredID() throws -> Int {
    guard let id = createdID, id > 203, !before.contains(id), run != nil else { throw contributionFailure("A confirmed task-created contribution ID is required.") }
    return id
  }

  private func mine() async throws -> [ContributionObject] {
    var rows: [ContributionObject] = [], lastPage = 1, page = 1
    repeat {
      let response = try await object("/api/v1/my/places?page=\(page)", token: memberToken)
      guard let data = response["data"] as? [ContributionObject], data.count <= 20,
        let last = response["last_page"] as? Int, (1...10).contains(last), response["current_page"] as? Int == page else { throw contributionFailure("A bounded real owner paginator was required.") }
      rows += data; lastPage = last; page += 1
    } while page <= lastPage
    return rows
  }

  private func provision(_ user: String, id: Int, email: String) async throws -> String {
    let value = try await object("/__native_fixture/session?user=\(user)", token: nil, headers: ["X-Native-Fixture-Key": gate])
    guard value["origin"] as? String == origin, let token = value["token"] as? String,
      token.range(of: "^[0-9]+\\|[A-Za-z0-9_-]{16,256}$", options: .regularExpression) != nil else { throw contributionFailure("The private fixture session response was invalid.") }
    let profile = try await object("/api/v1/user", token: token)
    guard try positiveID(profile["id"]) == id, profile["email"] as? String == email, profile["is_banned"] as? Bool == false else { throw contributionFailure("The real source user endpoint must verify each selected local identity.") }
    return token
  }

  private func positiveID(_ value: Any?) throws -> Int {
    guard let value = value as? NSNumber, CFGetTypeID(value) != CFBooleanGetTypeID(), value.doubleValue.isFinite,
      value.doubleValue.rounded() == value.doubleValue, value.int64Value > 0, value.int64Value <= 9_007_199_254_740_991 else { throw contributionFailure("A positive safe server ID was required.") }
    return value.intValue
  }

  private func object(_ path: String, token: String?, headers: [String: String] = [:]) async throws -> ContributionObject {
    let (bytes, _) = try await data(path, token: token, expected: 200, headers: headers)
    guard let object = try JSONSerialization.jsonObject(with: bytes) as? ContributionObject else { throw contributionFailure("The actual local response must be a JSON object.") }
    return object
  }

  private func data(_ path: String, token: String?, method: String = "GET", expected: Int, headers: [String: String] = [:]) async throws -> (Data, HTTPURLResponse) {
    guard let url = URL(string: path, relativeTo: URL(string: origin))?.absoluteURL, let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
      parts.scheme == "https", parts.host == "127.0.0.1", parts.port == 9443, parts.user == nil, parts.password == nil, parts.fragment == nil,
      ["GET", "POST", "DELETE"].contains(method) else { throw contributionFailure("Fixture requests must stay on the exact loopback HTTPS origin.") }
    var request = URLRequest(url: url); request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
    if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    for (key, value) in headers { request.setValue(value, forHTTPHeaderField: key) }
    let (bytes, response) = try await session.data(for: request)
    guard let response = response as? HTTPURLResponse, response.url == url, response.statusCode == expected, bytes.count <= 2_000_000 else { throw contributionFailure("The actual loopback request did not confirm its expected status and bounded response.") }
    return (bytes, response)
  }
}
