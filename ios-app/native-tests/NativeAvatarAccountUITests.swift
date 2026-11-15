import Foundation
import ImageIO
import UIKit
import XCTest

// Disposable user 105 only. Selection, crop, upload, and primary deletion use the real native UI.
final class NativeAvatarAccountUITests: LocalFixtureTestCase {
  @MainActor
  func testOwnGeneratedAvatarCropUploadAndDisposableAccountDeletion() async throws {
    let backend = try AvatarAccountBackend(environment: ProcessInfo.processInfo.environment)
    let lifetime = AvatarAccountLifetime()
    addTeardownBlock { try await backend.cleanupAndClose() }
    try await backend.prepare()
    try NativePhotoFixtures.cleanupRecordedFixtures()
    let photo = try NativePhotoFixtures.create(in: self)
    try backend.bindOwnedPhoto(albumTitle: photo.albumTitle, fileName: photo.fileName)
    addTeardownBlock { () throws -> Void in
      guard Thread.isMainThread else { throw avatarAccountFailure("Owned avatar app teardown requires XCTest's main thread.") }
      MainActor.assumeIsolated { lifetime.terminate() }
    }
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    lifetime.own(app)
    _ = try launch("avatar", id: 105)
    open("account", app: app)
    try assertDisposableProfile(app)
    tap("تغيير الصورة", app: app)
    try chooseOnlyOwnedPhotoAndConfirmNativeCrop(photo, app: app)
    XCTAssertTrue(app.staticTexts["تم تحديث الصورة الشخصية."].firstMatch.waitForExistence(timeout: 25))
    try assertDisposableProfile(app)
    try await backend.confirmUploadedAvatar()
    let image = app.images[AvatarAccountBackend.name].firstMatch
    XCTAssertTrue(image.waitForExistence(timeout: 10), "The adopted native profile must display its uploaded avatar.")
    capture("avatar-105-real-upload-adopted-profile", app: app)

    // Reopening the real account route must preserve the server-backed avatar.
    open("dashboard", app: app)
    open("account", app: app)
    try assertDisposableProfile(app)
    XCTAssertTrue(app.images[AvatarAccountBackend.name].firstMatch.waitForExistence(timeout: 10))
    try await backend.confirmBeforeNativeDeletion()
    assertLocal(app, user: "avatar", id: 105)
    tap("حذف الحساب", app: app)
    let alert = app.alerts["حذف الحساب؟"].firstMatch
    guard alert.waitForExistence(timeout: 5), alert.buttons.count == 2,
      alert.buttons["إلغاء"].exists, alert.buttons["حذف الحساب"].exists else { try unknownUI("The exact native account-delete confirmation is required.", app: app) }
    capture("avatar-105-exact-native-delete-confirmation", app: app)
    try await backend.confirmBeforeNativeDeletion()
    alert.buttons["حذف الحساب"].tap()
    XCTAssertTrue(app.buttons["تسجيل الدخول"].firstMatch.waitForExistence(timeout: 20))
    XCTAssertFalse(app.textFields["البريد الإلكتروني"].exists)
    XCTAssertFalse(app.images[AvatarAccountBackend.name].exists)
    try await backend.confirmDeleted()
    capture("avatar-105-native-deletion-signed-out", app: app)
    try photo.cleanup()
  }

  @MainActor
  private func assertDisposableProfile(_ app: XCUIApplication) throws {
    assertLocal(app, user: "avatar", id: 105)
    let email = app.textFields["البريد الإلكتروني"].firstMatch
    guard email.waitForExistence(timeout: 15), email.value as? String == AvatarAccountBackend.email,
      app.textFields["اسم المستخدم"].firstMatch.value as? String == AvatarAccountBackend.name else {
      throw avatarAccountFailure("Only the exact disposable profile may reach avatar or account-delete controls.")
    }
  }

  @MainActor
  private func chooseOnlyOwnedPhotoAndConfirmNativeCrop(_ photo: NativePhotoFixtures.Fixture, app: XCUIApplication) throws {
    try photo.verifySingleOwnedPhoto()
    let presentation = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      let exactAlbum = app.staticTexts[photo.albumTitle].firstMatch
      if exactAlbum.exists && exactAlbum.isHittable { return true }
      let catalogues = app.buttons.matching(NSPredicate(format: "label IN %@", ["Albums", "Collections", "الألبومات", "المجموعات"]))
      return catalogues.count == 1 && catalogues.firstMatch.isHittable
    }, object: app)
    guard XCTWaiter.wait(for: [presentation], timeout: 15) == .completed else {
      try unknownUI("The real avatar picker must expose a known catalogue or the exact owned album within the bounded presentation wait.", app: app)
    }
    var album = app.staticTexts[photo.albumTitle].firstMatch
    if !album.exists {
      let catalogue = app.buttons.matching(NSPredicate(format: "label IN %@", ["Albums", "Collections", "الألبومات", "المجموعات"]))
      guard catalogue.count == 1, catalogue.firstMatch.isHittable else { try unknownUI("The legacy single-photo picker must expose its album catalogue. No Recents fallback is allowed.", app: app) }
      catalogue.firstMatch.tap()
    }
    album = app.staticTexts[photo.albumTitle].firstMatch
    for _ in 0..<8 {
      if album.exists && album.isHittable { break }
      if app.tables.count == 1 { app.tables.firstMatch.swipeUp() }
      else if app.collectionViews.count == 1 { app.collectionViews.firstMatch.swipeUp() }
      else { break }
    }
    guard album.exists && album.isHittable else { try unknownUI("The exact owned UUID album is required before selecting any image.", app: app) }
    try photo.verifySingleOwnedPhoto()
    album.tap()
    guard app.navigationBars[photo.albumTitle].waitForExistence(timeout: 5) || app.navigationBars.staticTexts[photo.albumTitle].exists else { try unknownUI("The opened picker album must retain its exact UUID title.", app: app) }
    // Avatar probe 04 observed and completed this actual legacy picker contract.
    let grids = app.scrollViews.matching(identifier: "photosView_content_scroll_view")
    guard grids.count == 1, grids.firstMatch.exists,
      !grids.firstMatch.frame.intersection(app.frame).isEmpty else {
      try unknownUI("The exact observed legacy album scroll view is required.", app: app, ownedAlbumOpen: true)
    }
    let grid = grids.firstMatch, images = grid.images.matching(identifier: "PXGGridLayout-Info")
    guard images.count == 1, images.firstMatch.exists else {
      try unknownUI("The provenance-verified album must expose exactly its one observed image.", app: app, ownedAlbumOpen: true)
    }
    let image = images.firstMatch
    guard image.isHittable, grid.frame.intersection(app.frame).contains(image.frame) else {
      try unknownUI("The one generated album image must be fully visible and selectable.", app: app, ownedAlbumOpen: true)
    }
    try photo.verifySingleOwnedPhoto()
    capture("avatar-105-exact-owned-album-one-photo", app: app)
    guard app.navigationBars[photo.albumTitle].exists || app.navigationBars.staticTexts[photo.albumTitle].exists,
      grids.count == 1, images.count == 1, image.isHittable else {
      throw avatarAccountFailure("Owned album or sole-image identity changed before selection.")
    }
    image.tap()
    let choose = app.buttons.matching(NSPredicate(format: "label IN %@", ["Choose", "اختيار"]))
    let cancel = app.buttons.matching(NSPredicate(format: "label IN %@", ["Cancel", "إلغاء"]))
    guard choose.firstMatch.waitForExistence(timeout: 8), choose.count == 1, cancel.count == 1,
      choose.firstMatch.isHittable, choose.firstMatch.isEnabled, cancel.firstMatch.isHittable else { try unknownUI("The native crop confirmation is unrecognized. Do not guess Add or select another image.", app: app, ownedAlbumOpen: true) }
    capture("avatar-105-owned-photo-native-crop-before-confirmation", app: app)
    let tree = XCTAttachment(string: app.debugDescription)
    tree.name = "avatar-native-crop-actual-AX"; tree.lifetime = .keepAlways; add(tree)
    try photo.verifySingleOwnedPhoto()
    choose.firstMatch.tap()
  }

  @MainActor
  private func unknownUI(_ message: String, app: XCUIApplication, ownedAlbumOpen: Bool = false) throws -> Never {
    if ownedAlbumOpen {
      let tree = XCTAttachment(string: app.debugDescription)
      tree.name = "avatar-unrecognized-owned-native-UI"; tree.lifetime = .keepAlways; add(tree)
      capture("avatar-unrecognized-owned-native-UI", app: app)
    } else {
      let tree = XCTAttachment(string: app.navigationBars.debugDescription)
      tree.name = "avatar-unrecognized-navigation-only"; tree.lifetime = .keepAlways; add(tree)
    }
    throw avatarAccountFailure(message)
  }

  @MainActor
  private func capture(_ name: String, app: XCUIApplication) {
    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.name = name; screenshot.lifetime = .keepAlways; add(screenshot)
  }
}

@MainActor private final class AvatarAccountLifetime {
  private var app: XCUIApplication?
  func own(_ value: XCUIApplication) { app = value }
  func terminate() { if let app, app.state != .notRunning { app.terminate() } }
}

private typealias AvatarAccountObject = [String: Any]
private func avatarAccountFailure(_ message: String) -> NSError { NSError(domain: "NativeAvatarAccountFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }

// This observer never uploads an avatar. Failure cleanup uses only user 105's real owner API.
private final class AvatarAccountBackend: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  static let name = "حساب الصورة التجريبي المحلي", email = "avatar@native-fixture.invalid"
  private let origin = "https://127.0.0.1:9443"
  private let gate: String
  private var session: URLSession!
  private var token = "", avatar: URL?, record: URL?
  private var photo: (albumTitle: String, fileName: String)?
  private var owned = false, deleted = false

  init(environment: [String: String]) throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == NativePhotoFixtures.runnerBundleIdentifier, environment["SIMULATOR_UDID"] != nil,
      environment["SZ_NATIVE_FIXTURE_ORIGIN"] == origin, let key = environment["SZ_NATIVE_FIXTURE_GATE"],
      key.range(of: "^[A-Za-z0-9_-]{16,256}$", options: .regularExpression) != nil else { throw avatarAccountFailure("Only the exact private local Simulator fixture may own disposable user 105.") }
    gate = key
    super.init()
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieStorage = nil; configuration.httpShouldSetCookies = false
    configuration.urlCredentialStorage = nil; configuration.urlCache = nil
    configuration.timeoutIntervalForRequest = 15; configuration.timeoutIntervalForResource = 20
    session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    #else
    throw avatarAccountFailure("Avatar/account deletion fixtures refuse physical devices and Mac Photos access.")
    #endif
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }

  func prepare() async throws {
    let access = try await json("/__native_fixture/session?user=avatar", authenticated: false, headers: ["X-Native-Fixture-Key": gate])
    try adopt(access)
    let user = try await json("/api/v1/user")
    try validate(user)
    guard user["avatar_url"] is NSNull else { throw avatarAccountFailure("Disposable user 105 must start without an avatar; preparation never overwrites an existing image.") }
    let directory = try XCTUnwrap(FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first).appendingPathComponent("SyrianZoneNativeAvatarAccount", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    guard try directory.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink != true else { throw avatarAccountFailure("Refusing a symlink in the private disposable-account record directory.") }
    try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: directory.path)
    record = directory.appendingPathComponent(UUID().uuidString).appendingPathExtension("json")
    owned = true
    try persist("prepared-with-null-avatar")
  }

  func confirmUploadedAvatar() async throws {
    guard photo != nil else { throw avatarAccountFailure("The generated owned PhotoKit fixture must be bound before observing any upload.") }
    let deadline = Date().addingTimeInterval(15)
    while Date() < deadline {
      let user = try await json("/api/v1/user")
      try validate(user)
      if let path = user["avatar_url"] as? String {
        let url = try localAvatar(path)
        try await verifyImage(url)
        avatar = url; try persist("native-avatar-observed")
        return
      }
      try await Task.sleep(nanoseconds: 200_000_000)
    }
    throw avatarAccountFailure("The real source user endpoint did not adopt a hosted avatar for disposable user 105.")
  }

  func bindOwnedPhoto(albumTitle: String, fileName: String) throws {
    let prefix = "Syrian Zone Native QA "
    guard owned, photo == nil, albumTitle.hasPrefix(prefix),
      let identifier = UUID(uuidString: String(albumTitle.dropFirst(prefix.count))),
      albumTitle == prefix + identifier.uuidString, fileName == "native-qa-\(identifier.uuidString).png" else {
      throw avatarAccountFailure("Only the exact generated PhotoKit album/filename pair may be bound to this disposable account.")
    }
    photo = (albumTitle, fileName)
    try persist("owned-generated-photo-bound")
  }

  func confirmBeforeNativeDeletion() async throws {
    guard owned, let avatar else { throw avatarAccountFailure("Only an owned account with its observed native-uploaded avatar may reach deletion.") }
    let user = try await json("/api/v1/user"); try validate(user)
    guard let value = user["avatar_url"] as? String, try localAvatar(value) == avatar else { throw avatarAccountFailure("The disposable profile avatar changed before deletion.") }
    try await verifyImage(avatar)
  }

  func confirmDeleted() async throws {
    _ = try await request("/api/v1/user", expected: 401)
    _ = try await request("/__native_fixture/session?user=avatar", authenticated: false, expected: 410, headers: ["X-Native-Fixture-Key": gate])
    if let avatar { _ = try await request(avatar.absoluteString, authenticated: false, expected: 404) }
    deleted = true; try removeRecord()
  }

  func cleanupAndClose() async throws {
    defer { session?.invalidateAndCancel() }
    guard owned else {
      if !token.isEmpty { _ = try await request("/api/v1/auth/logout", method: "POST") }
      return
    }
    if deleted { try removeRecord(); return }
    let (bytes, response) = try await request("/api/v1/user", expected: nil)
    if response.statusCode == 401 {
      let (access, state) = try await request("/__native_fixture/session?user=avatar", authenticated: false, expected: nil, headers: ["X-Native-Fixture-Key": gate])
      if state.statusCode == 410 { try await confirmDeleted(); return }
      guard state.statusCode == 200, let object = try JSONSerialization.jsonObject(with: access) as? AvatarAccountObject else { throw avatarAccountFailure("The exact disposable account's state could not be verified for cleanup.") }
      try adopt(object)
    } else {
      guard response.statusCode == 200, let user = try JSONSerialization.jsonObject(with: bytes) as? AvatarAccountObject else { throw avatarAccountFailure("Disposable account cleanup requires a real current-user response.") }
      try validate(user)
    }
    let user = try await json("/api/v1/user"); try validate(user)
    if let path = user["avatar_url"] as? String {
      guard photo != nil else { throw avatarAccountFailure("An avatar appeared before this test owned any source photo. Account retained for review.") }
      let current = try localAvatar(path)
      if let avatar, current != avatar { throw avatarAccountFailure("An unexpected avatar is retained without deleting the account.") }
      try await verifyImage(current); avatar = current
    } else if !(user["avatar_url"] is NSNull) { throw avatarAccountFailure("Unknown disposable avatar state is retained.") }
    try persist("verified-owner-api-failure-cleanup")
    let result = try await json("/api/v1/account", method: "DELETE")
    guard result["ok"] as? Bool == true else { throw avatarAccountFailure("The real owner API did not confirm disposable account deletion.") }
    try await confirmDeleted()
  }

  private func validate(_ user: AvatarAccountObject) throws {
    guard let id = user["id"] as? NSNumber, CFGetTypeID(id) != CFBooleanGetTypeID(), id.doubleValue == 105,
      user["name"] as? String == Self.name, user["email"] as? String == Self.email, user["role"] as? String == "user",
      user["is_banned"] as? Bool == false, let permissions = user["permissions"] as? [String], permissions.isEmpty,
      let effective = user["effective_permissions"] as? [String], effective.isEmpty else { throw avatarAccountFailure("Only the exact unprivileged synthetic user 105 may be observed or deleted.") }
  }

  private func adopt(_ access: AvatarAccountObject) throws {
    guard access["origin"] as? String == origin, let value = access["token"] as? String,
      value.range(of: "^[0-9]+\\|[A-Za-z0-9_-]{16,256}$", options: .regularExpression) != nil else { throw avatarAccountFailure("The gated disposable session response is invalid.") }
    token = value
  }

  private func localAvatar(_ path: String) throws -> URL {
    guard let url = URL(string: path, relativeTo: URL(string: origin))?.absoluteURL, let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
      parts.scheme == "https", parts.host == "127.0.0.1", parts.port == 9443, parts.user == nil, parts.password == nil,
      parts.query == nil, parts.fragment == nil, parts.path.range(of: #"^/storage/avatars/105/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$"#, options: .regularExpression) != nil else { throw avatarAccountFailure("Only an exact local hosted avatar belonging to user 105 is eligible.") }
    return url
  }

  private func verifyImage(_ url: URL) async throws {
    let (bytes, response) = try await request(url.absoluteString, authenticated: false)
    guard response.mimeType == "image/webp", let source = CGImageSourceCreateWithData(bytes as CFData, nil), CGImageSourceGetCount(source) == 1,
      let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
      (properties[kCGImagePropertyPixelWidth] as? NSNumber)?.intValue == 256,
      (properties[kCGImagePropertyPixelHeight] as? NSNumber)?.intValue == 256 else { throw avatarAccountFailure("The real processed avatar must be one 256x256 WebP image.") }
  }

  private func persist(_ phase: String) throws {
    guard let record else { throw avatarAccountFailure("A private disposable-account record is required before mutation.") }
    let metadata: AvatarAccountObject = ["version": 1, "id": 105, "name": Self.name, "email": Self.email,
      "initialAvatarWasNull": true, "phase": phase, "avatar": avatar?.absoluteString as Any? ?? NSNull(),
      "albumTitle": photo?.albumTitle as Any? ?? NSNull(), "fileName": photo?.fileName as Any? ?? NSNull()]
    try JSONSerialization.data(withJSONObject: metadata).write(to: record, options: [.atomic, .completeFileProtection])
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: record.path)
  }
  private func removeRecord() throws { if let record, FileManager.default.fileExists(atPath: record.path) { try FileManager.default.removeItem(at: record) } }

  private func json(_ path: String, method: String = "GET", authenticated: Bool = true, headers: [String: String] = [:]) async throws -> AvatarAccountObject {
    let (bytes, _) = try await request(path, method: method, authenticated: authenticated, headers: headers)
    guard let value = try JSONSerialization.jsonObject(with: bytes) as? AvatarAccountObject else { throw avatarAccountFailure("The real local response must be a JSON object.") }
    return value
  }
  private func request(_ path: String, method: String = "GET", authenticated: Bool = true, expected: Int? = 200, headers: [String: String] = [:]) async throws -> (Data, HTTPURLResponse) {
    guard let url = URL(string: path, relativeTo: URL(string: origin))?.absoluteURL, let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
      parts.scheme == "https", parts.host == "127.0.0.1", parts.port == 9443, parts.user == nil, parts.password == nil, parts.fragment == nil,
      method == "GET" || (method == "DELETE" && parts.path == "/api/v1/account" && owned && authenticated && parts.query == nil)
        || (method == "POST" && parts.path == "/api/v1/auth/logout" && !owned && authenticated && !token.isEmpty && parts.query == nil),
      ["/api/v1/user", "/api/v1/account", "/api/v1/auth/logout"].contains(parts.path) || (parts.path == "/__native_fixture/session" && parts.query == "user=avatar") || parts.path.hasPrefix("/storage/avatars/105/") else { throw avatarAccountFailure("Disposable-account transport refuses any other origin, user path or mutation.") }
    var request = URLRequest(url: url); request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Accept"); request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
    if authenticated { guard !token.isEmpty else { throw avatarAccountFailure("An owned real token is required.") }; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    for (key, value) in headers { request.setValue(value, forHTTPHeaderField: key) }
    let (bytes, result) = try await session.data(for: request)
    guard let response = result as? HTTPURLResponse, response.url == url, bytes.count <= 2_000_000,
      expected == nil || response.statusCode == expected else { throw avatarAccountFailure("The exact local account/media response did not confirm its required status.") }
    return (bytes, response)
  }
}
