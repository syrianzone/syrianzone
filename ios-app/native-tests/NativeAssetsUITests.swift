import CryptoKit
import Foundation
import XCTest

// Real account 103 and loopback asset APIs only. No cloud, Files-provider, or Save activity.
final class NativeAssetsUITests: LocalFixtureTestCase {
  @MainActor
  func testOwnedPhotoUploadQuickLookAndExactNativeDeletion() async throws {
    let backend = try AssetsBackend(environment: ProcessInfo.processInfo.environment)
    addTeardownBlock { try await backend.cleanupAndClose() }
    try await backend.prepare()
    try NativePhotoFixtures.cleanupRecordedFixtures()
    let photo = try NativePhotoFixtures.create(in: self)
    try await backend.arm(photoName: photo.fileName, albumTitle: photo.albumTitle)
    let lifetime = AssetsAppLifetime()
    addTeardownBlock { () throws -> Void in
      guard Thread.isMainThread else { throw assetsFailure("Owned app teardown requires XCTest's main thread.") }
      MainActor.assumeIsolated { lifetime.terminate() }
    }
    let app = try launch("admin", id: 103)
    lifetime.own(app)
    open("assets_admin", app: app)
    try require(app.staticTexts["إدارة الملفات المستضافة"].firstMatch.waitForExistence(timeout: 20), "Open the real Assets manager.", app: app)
    tap("رفع ملف", app: app)
    try require(wait { app.buttons["رفع ملف"].firstMatch.isSelected }, "The actual upload segment must be selected.", app: app)
    let folder = app.textFields["مجلد الحفظ"].firstMatch
    try require(folder.waitForExistence(timeout: 10), "The real folder field is required.", app: app)
    replace(folder, with: "uploads")
    try require(folder.value as? String == "uploads", "Use the existing uploads prefix without creating a new folder.", app: app)
    folder.typeText("\n")
    try require(wait { !app.keyboards.firstMatch.exists }, "Finish the real single-line folder edit with Return before opening Photos.", app: app)
    try require(folder.value as? String == "uploads", "Return must preserve the exact existing folder value.", app: app)
    tap("اختيار صورة", app: app)
    try chooseOnlyOwnedAlbumPhoto(photo, app: app)
    let selectedPrefix = "الملف المحدد: \(photo.fileName) ("
    try require(wait(timeout: 15) { self.leafTexts(prefix: selectedPrefix, app: app).count == 1 },
      "The picker must return the exact generated photo filename before upload.", app: app)
    try require(folder.value as? String == "uploads", "Keep the selected existing folder through the picker round trip.", app: app)
    try photo.verifySingleOwnedPhoto()
    try await backend.confirmArmedBaseline()
    assertLocal(app, user: "admin", id: 103)
    tap("بدء الرفع", app: app)
    try require(app.staticTexts["تم رفع الملف بنجاح."].firstMatch.waitForExistence(timeout: 30)
      && leafTexts(prefix: "الرابط المباشر: ", app: app).count == 1, "Actual upload success and one returned direct URL are required.", app: app)
    let receipt = try XCTUnwrap(leafTexts(prefix: "الرابط المباشر: ", app: app).first)
    let returnedURL = String(receipt.label.dropFirst("الرابط المباشر: ".count))
    let asset = try await backend.confirmUploaded(returnedURL: returnedURL)
    try attach("assets-native-upload-confirmed", app: app, asset: asset)

    tap("الملفات", app: app)
    try require(wait { app.buttons["الملفات"].firstMatch.isSelected }, "Return to the actual asset list.", app: app)
    try require(app.staticTexts[asset.path].firstMatch.waitForExistence(timeout: 20), "The returned exact path must appear in the native list.", app: app)
    let row = try ownedRow(asset, app: app)
    let preview = row.buttons["معاينة"].firstMatch
    reveal(preview, app: app)
    try await backend.verifyOwned(asset)
    assertLocal(app, user: "admin", id: 103)
    try require(preview.isEnabled && preview.isHittable, "Preview only the path-proven row.", app: app)
    preview.tap()
    let quickLook = app.otherElements.matching(identifier: "QLPreviewControllerView")
    try require(quickLook.firstMatch.waitForExistence(timeout: 20) && quickLook.count == 1
      && !quickLook.firstMatch.frame.intersection(app.frame).isEmpty, "The existing observed native QuickLook view must present.", app: app)
    let done = app.navigationBars.buttons.matching(NSPredicate(format: "label IN %@", ["Done", "تم"]))
    try require(done.count == 1 && done.firstMatch.isEnabled && done.firstMatch.isHittable,
      "Use only SyrianFiles' explicit native navigation Done action.", app: app)
    try attach("assets-owned-object-native-quicklook", app: app, asset: asset)
    done.firstMatch.tap()
    try require(wait { !quickLook.firstMatch.exists }, "QuickLook must finish dismissing before the row is used again.", app: app)

    let delete = try ownedRow(asset, app: app).buttons["حذف"].firstMatch
    reveal(delete, app: app)
    try await backend.verifyOwned(asset)
    try require(delete.isEnabled && delete.isHittable, "Only the exact proven asset row may open deletion.", app: app)
    delete.tap()
    let alerts = app.alerts.matching(identifier: "حذف الملف نهائياً؟")
    try require(alerts.firstMatch.waitForExistence(timeout: 5) && alerts.count == 1,
      "Require the real Assets destructive confirmation.", app: app)
    let alert = alerts.firstMatch
    try require(alert.staticTexts[asset.path].exists && alert.buttons.matching(identifier: "حذف").count == 1
      && alert.buttons.matching(identifier: "إلغاء").count == 1, "The confirmation must name this exact owned path.", app: app)
    try await backend.verifyOwned(asset)
    assertLocal(app, user: "admin", id: 103)
    let confirm = alert.buttons["حذف"]
    try require(confirm.isEnabled && confirm.isHittable, "The exact destructive confirmation must be ready.", app: app)
    confirm.tap()
    try require(app.staticTexts["تم حذف الملف."].firstMatch.waitForExistence(timeout: 20)
      && wait { !app.staticTexts[asset.path].firstMatch.exists }, "Native deletion must remove the exact row and report success.", app: app)
    try await backend.confirmDeleted()
    try attach("assets-exact-native-delete-baseline-restored", app: app, asset: asset)
  }

  @MainActor
  private func chooseOnlyOwnedAlbumPhoto(_ photo: NativePhotoFixtures.Fixture, app: XCUIApplication) throws {
    // Native29 proves this single-select album has one image and no Done action.
    let collections = app.buttons.matching(NSPredicate(format: "label IN %@", ["Albums", "Collections", "الألبومات", "المجموعات"]))
    guard collections.firstMatch.waitForExistence(timeout: 10), collections.count == 1, collections.firstMatch.isHittable else {
      throw assetsFailure("The observed Photos catalogue control is required. No Recents fallback is allowed.")
    }
    collections.firstMatch.tap()
    let album = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", photo.albumTitle)).firstMatch
    for _ in 0..<8 {
      if album.exists && album.isHittable { break }
      guard let grid = app.collectionViews.allElementsBoundByIndex.first(where: { !$0.frame.intersection(app.frame).isEmpty }) else { break }
      grid.swipeUp()
    }
    guard album.exists && album.isHittable else { throw assetsFailure("Only the exact generated UUID album is eligible.") }
    try photo.verifySingleOwnedPhoto()
    album.tap()
    let heading = app.navigationBars[photo.albumTitle].firstMatch
    guard heading.waitForExistence(timeout: 5) || app.navigationBars.staticTexts[photo.albumTitle].exists else {
      throw assetsFailure("The opened photo album must retain its full exact UUID title.")
    }
    let grids = app.scrollViews.matching(identifier: "photosView_content_scroll_view")
    guard grids.count == 1 else { throw assetsFailure("Require the observed owned-album Photos content view.") }
    let images = grids.firstMatch.images.matching(identifier: "PXGGridLayout-Info")
    guard images.count == 1, images.firstMatch.isHittable,
      grids.firstMatch.frame.intersection(app.frame).contains(images.firstMatch.frame) else {
      throw assetsFailure("Only the fully visible sole generated album image may be selected.")
    }
    try photo.verifySingleOwnedPhoto()
    guard heading.exists else { throw assetsFailure("Only the exact owned album may be captured before probing its terminal controls.") }
    let tree = XCTAttachment(string: app.debugDescription)
    tree.name = "assets-owned-single-select-album-AX"; tree.lifetime = .keepAlways; add(tree)
    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.name = "assets-owned-single-select-album"; screenshot.lifetime = .keepAlways; add(screenshot)
    try photo.verifySingleOwnedPhoto()
    guard heading.exists, grids.count == 1, images.count == 1, images.firstMatch.isHittable,
      grids.firstMatch.frame.intersection(app.frame).contains(images.firstMatch.frame) else {
      throw assetsFailure("The exact owned album and fully visible sole image must remain current immediately before single selection.")
    }
    images.firstMatch.tap()
    guard wait(timeout: 15, { !heading.exists }) else {
      throw assetsFailure("The real single-image picker must dismiss its owned album after selection. No unobserved terminal button is used.")
    }
  }

  @MainActor
  private func leafTexts(prefix: String, app: XCUIApplication) -> [XCUIElement] {
    let predicate = NSPredicate(format: "label BEGINSWITH %@", prefix)
    return app.staticTexts.matching(predicate).allElementsBoundByIndex.filter {
      $0.descendants(matching: .staticText).matching(predicate).count == 0
    }
  }

  @MainActor
  private func ownedRow(_ asset: AssetsObject, app: XCUIApplication) throws -> XCUIElement {
    let rows = app.otherElements.containing(.staticText, identifier: asset.path).allElementsBoundByIndex.filter {
      $0.staticTexts[asset.filename].exists && $0.buttons.matching(identifier: "معاينة").count == 1
        && $0.buttons.matching(identifier: "حذف").count == 1 && !$0.frame.isEmpty
    }.sorted { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height }
    return try XCTUnwrap(rows.first, "One source asset row must contain the exact path, generated basename, Preview and Delete.")
  }

  @MainActor
  private func wait(timeout: TimeInterval = 10, _ predicate: @escaping () -> Bool) -> Bool {
    XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in predicate() }, object: nil)], timeout: timeout) == .completed
  }

  @MainActor
  private func require(_ condition: Bool, _ message: String, app: XCUIApplication) throws {
    guard condition else {
      let tree = XCTAttachment(string: app.debugDescription)
      tree.name = "assets-failure-AX"; tree.lifetime = .keepAlways; add(tree)
      let screenshot = XCTAttachment(screenshot: app.screenshot())
      screenshot.name = "assets-failure"; screenshot.lifetime = .keepAlways; add(screenshot)
      throw assetsFailure(message)
    }
  }

  @MainActor
  private func attach(_ name: String, app: XCUIApplication, asset: AssetsObject) throws {
    let metadata = XCTAttachment(data: try JSONEncoder().encode(asset), uniformTypeIdentifier: "public.json")
    metadata.name = name + "-owned-object"; metadata.lifetime = .keepAlways; add(metadata)
    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.name = name; screenshot.lifetime = .keepAlways; add(screenshot)
  }
}

@MainActor private final class AssetsAppLifetime {
  private var app: XCUIApplication?
  func own(_ value: XCUIApplication) { app = value }
  func terminate() { if let app, app.state != .notRunning { app.terminate() } }
}

private struct AssetsObject: Codable, Equatable, Sendable {
  let path: String
  let filename: String
  let folder: String
  let size: Int
  let url: String
}
private typealias AssetsJSON = [String: Any]
private func assetsFailure(_ message: String) -> NSError { NSError(domain: "NativeAssetsFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }

// Never uploads. Native UI owns creation and the primary deletion; failure cleanup is exact-path only.
private final class AssetsBackend: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  private let origin = "https://127.0.0.1:9443"
  private let gate: String
  private var session: URLSession!
  private var token = "", identifier = "", stem = "", digest = ""
  private var baseline: [AssetsObject] = [], owned: AssetsObject?, recordURL: URL?
  private var prepared = false, deleted = false

  init(environment: [String: String]) throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == NativePhotoFixtures.runnerBundleIdentifier, environment["SIMULATOR_UDID"] != nil,
      environment["SZ_NATIVE_FIXTURE_ORIGIN"] == origin, let key = environment["SZ_NATIVE_FIXTURE_GATE"],
      key.range(of: "^[A-Za-z0-9_-]{16,256}$", options: .regularExpression) != nil else {
      throw assetsFailure("Only the exact private loopback Simulator fixture may own an Assets object.")
    }
    gate = key
    super.init()
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieStorage = nil; configuration.httpShouldSetCookies = false
    configuration.urlCredentialStorage = nil; configuration.urlCache = nil
    configuration.timeoutIntervalForRequest = 15; configuration.timeoutIntervalForResource = 20
    session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    #else
    throw XCTSkip("The Assets fixture refuses physical devices, Mac Photos and nonlocal storage.")
    #endif
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }

  func prepare() async throws {
    let access = try await json("/__native_fixture/session?user=admin", authenticated: false, headers: ["X-Native-Fixture-Key": gate])
    guard access["origin"] as? String == origin, let value = access["token"] as? String,
      value.range(of: "^[0-9]+\\|[A-Za-z0-9_-]{16,256}$", options: .regularExpression) != nil else { throw assetsFailure("The private admin session response was invalid.") }
    token = value
    let profile = try await json("/api/v1/user")
    guard (profile["id"] as? NSNumber)?.intValue == 103, profile["email"] as? String == "admin@native-fixture.invalid",
      profile["is_banned"] as? Bool == false, (profile["effective_permissions"] as? [String])?.contains("assets.manage") == true else {
      throw assetsFailure("The real user endpoint must confirm local admin 103 and assets.manage.")
    }
    baseline = try await list(); prepared = true
  }

  func arm(photoName: String, albumTitle: String) async throws {
    let prefix = "Syrian Zone Native QA "
    guard prepared, identifier.isEmpty, albumTitle.hasPrefix(prefix), let id = UUID(uuidString: String(albumTitle.dropFirst(prefix.count))),
      albumTitle == prefix + id.uuidString, photoName == "native-qa-\(id.uuidString).png" else {
      throw assetsFailure("Bind the exact owned PhotoKit UUID and original filename before any native upload.")
    }
    identifier = id.uuidString; stem = "native-qa-" + id.uuidString.lowercased()
    try await confirmArmedBaseline()
    let directory = try XCTUnwrap(FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first)
      .appendingPathComponent("SyrianZoneNativeAssets", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    guard try directory.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink != true else { throw assetsFailure("Refusing a symlink in the private Assets record directory.") }
    recordURL = directory.appendingPathComponent(identifier).appendingPathExtension("json")
    try persist()
  }

  func confirmArmedBaseline() async throws {
    guard prepared, !stem.isEmpty, try await list() == baseline else { throw assetsFailure("Existing assets must remain identical before native upload.") }
    guard !baseline.contains(where: { $0.filename.hasPrefix(stem) }) else { throw assetsFailure("The generated nonce must be absent from the fresh baseline.") }
  }

  func confirmUploaded(returnedURL: String) async throws -> AssetsObject {
    let path = try ownedPath(returnedURL)
    let matches = try await list().filter { $0.path == path }
    guard matches.count == 1 else { throw assetsFailure("The exact UI-returned path must identify one real listed object.") }
    return try await adopt(matches[0], returnedURL: returnedURL)
  }

  func verifyOwned(_ asset: AssetsObject) async throws {
    guard owned == asset, !deleted, try await list().filter({ $0.path == asset.path }) == [asset],
      try await imageDigest(asset) == digest else { throw assetsFailure("The recorded exact object and bytes must remain unchanged before preview or deletion.") }
  }

  func confirmDeleted() async throws {
    guard let owned else { throw assetsFailure("A proven exact object is required before deletion can be confirmed.") }
    _ = try await request("/fixture-assets/" + owned.path, authenticated: false, expected: 404)
    guard try await list() == baseline else { throw assetsFailure("The exact object must be gone and every baseline asset unchanged.") }
    deleted = true; try removeRecord()
  }

  func cleanupAndClose() async throws {
    defer { session?.invalidateAndCancel() }
    var failure: Error?
    do {
      if prepared, !identifier.isEmpty, !deleted {
        if owned == nil {
          let candidates = try await list().filter { $0.folder == "uploads" && $0.filename.hasPrefix(stem + "-") }
          guard candidates.count <= 1 else { throw assetsFailure("Ambiguous nonce objects are retained without any deletion.") }
          if let candidate = candidates.first { _ = try await adopt(candidate, returnedURL: candidate.url) }
        }
        if let owned {
          let present = try await list().contains { $0.path == owned.path }
          if present {
            try await verifyOwned(owned)
            let response = try await json("/api/v1/admin/assets/delete", method: "DELETE", body: ["path": owned.path])
            guard response["success"] as? Bool == true else { throw assetsFailure("The exact owned asset cleanup was not confirmed.") }
          }
          try await confirmDeleted()
        } else {
          guard try await list() == baseline else { throw assetsFailure("Unexpected Assets changes are retained without broad cleanup.") }
          try removeRecord()
        }
      }
    } catch { failure = error }
    if !token.isEmpty {
      do { _ = try await json("/api/v1/auth/logout", method: "POST"); token = "" }
      catch { if failure == nil { failure = error } }
    }
    if let failure { throw failure }
  }

  private func adopt(_ asset: AssetsObject, returnedURL: String) async throws -> AssetsObject {
    guard owned == nil, try ownedPath(returnedURL) == asset.path, asset.url == returnedURL,
      asset.folder == "uploads", asset.path == "uploads/" + asset.filename,
      asset.filename.range(of: "^\(stem)-[A-Za-z0-9]{6}\\.png$", options: .regularExpression) != nil,
      !baseline.contains(where: { $0.path == asset.path }), asset.size > 0, asset.size <= 1_048_576 else {
      throw assetsFailure("Only a fresh exact returned path retaining this bound photo's nonce and controller basename is eligible.")
    }
    digest = try await imageDigest(asset); owned = asset
    try persist()
    guard try await list().filter({ $0.path != asset.path }) == baseline else { throw assetsFailure("Uploading this one object must preserve every baseline asset.") }
    return asset
  }

  private func ownedPath(_ raw: String) throws -> String {
    guard !stem.isEmpty, let url = URLComponents(string: raw), url.scheme == "https", url.host == "127.0.0.1", url.port == 9443,
      url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
      url.path.range(of: "^/fixture-assets/uploads/\(stem)-[A-Za-z0-9]{6}\\.png$", options: .regularExpression) != nil else {
      throw assetsFailure("The UI acknowledgement must be the exact local HTTPS URL of this nonce-bound PNG.")
    }
    return String(url.path.dropFirst("/fixture-assets/".count))
  }

  private func imageDigest(_ asset: AssetsObject) async throws -> String {
    guard try ownedPath(asset.url) == asset.path else { throw assetsFailure("Only the bound local asset may be read.") }
    let (bytes, response) = try await request("/fixture-assets/" + asset.path, authenticated: false)
    let prefix: [UInt8] = [137, 80, 78, 71, 13, 10, 26, 10]
    guard response.mimeType == "image/png", bytes.count == asset.size, bytes.count >= 24, bytes.count <= 1_048_576,
      Array(bytes.prefix(8)) == prefix, String(data: bytes.subdata(in: 12..<16), encoding: .ascii) == "IHDR" else {
      throw assetsFailure("The actual local asset response must contain bounded PNG bytes matching its reported size.")
    }
    func axis(_ start: Int) -> Int { bytes[start..<(start + 4)].reduce(0) { $0 * 256 + Int($1) } }
    guard axis(16) == 640, axis(20) == 480 else { throw assetsFailure("The returned PNG must keep the generated PhotoKit fixture's actual 640 by 480 dimensions.") }
    return SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
  }

  private func list() async throws -> [AssetsObject] {
    var assets: [AssetsObject] = [], cursor: String?, seen = Set<String>()
    for _ in 0..<10 {
      var components = URLComponents(); components.path = "/api/v1/admin/assets/list"
      components.queryItems = [URLQueryItem(name: "per_page", value: "200")]
      if let cursor { components.queryItems?.append(URLQueryItem(name: "cursor", value: cursor)) }
      else { components.queryItems?.append(URLQueryItem(name: "refresh", value: "1")) }
      let page = try await json(try XCTUnwrap(components.string))
      guard page["success"] as? Bool == true, let rows = page["files"] as? [AssetsJSON], rows.count <= 200,
        let more = page["has_more"] as? Bool else { throw assetsFailure("Require the real bounded Assets paginator.") }
      for row in rows {
        guard let path = row["path"] as? String, let filename = row["filename"] as? String, let folder = row["folder"] as? String,
          let size = row["size"] as? Int, size >= 0, let url = row["url"] as? String, seen.insert(path).inserted else {
          throw assetsFailure("Every listed asset must retain one distinct path and its real metadata.")
        }
        assets.append(AssetsObject(path: path, filename: filename, folder: folder, size: size, url: url))
      }
      if !more { return assets.sorted { $0.path < $1.path } }
      guard let next = page["next_cursor"] as? String, !next.isEmpty, next.count <= 2048, next != cursor else { throw assetsFailure("Assets pagination must advance its real cursor.") }
      cursor = next
    }
    throw assetsFailure("Assets fixture listing exceeded its ten-page diagnostic bound.")
  }

  private func persist() throws {
    guard let recordURL else { throw assetsFailure("A private ownership record is required before upload.") }
    let row: AssetsJSON = ["version": 1, "identifier": identifier, "stem": stem, "folder": "uploads", "createdFolder": false,
      "baseline": try JSONSerialization.jsonObject(with: JSONEncoder().encode(baseline)),
      "owned": try owned.map { try JSONSerialization.jsonObject(with: JSONEncoder().encode($0)) } as Any? ?? NSNull(), "sha256": digest]
    try JSONSerialization.data(withJSONObject: row).write(to: recordURL, options: [.atomic, .completeFileProtection])
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: recordURL.path)
  }

  private func removeRecord() throws {
    if let recordURL, FileManager.default.fileExists(atPath: recordURL.path) { try FileManager.default.removeItem(at: recordURL) }
  }

  private func json(_ path: String, authenticated: Bool = true, method: String = "GET", body: [String: String]? = nil,
    headers: [String: String] = [:]) async throws -> AssetsJSON {
    let (bytes, _) = try await request(path, authenticated: authenticated, method: method, body: body, headers: headers)
    guard let row = try JSONSerialization.jsonObject(with: bytes) as? AssetsJSON else { throw assetsFailure("The actual loopback response must be a JSON object.") }
    return row
  }

  private func request(_ path: String, authenticated: Bool = true, method: String = "GET", body: [String: String]? = nil,
    expected: Int = 200, headers: [String: String] = [:]) async throws -> (Data, HTTPURLResponse) {
    guard let url = URL(string: origin + path), let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
      parts.scheme == "https", parts.host == "127.0.0.1", parts.port == 9443, parts.user == nil, parts.password == nil, parts.fragment == nil else {
      throw assetsFailure("Assets requests must remain on the one private loopback HTTPS origin.")
    }
    let sessionRead = parts.path == "/__native_fixture/session" && parts.query == "user=admin" && !authenticated
    let apiRead = authenticated && ["/api/v1/user", "/api/v1/admin/assets/list"].contains(parts.path)
    let imageRead = !authenticated && parts.query == nil && !stem.isEmpty && (try? ownedPath(url.absoluteString)) != nil
    let deletion = method == "DELETE" && authenticated && parts.path == "/api/v1/admin/assets/delete" && parts.query == nil
      && owned != nil && body == ["path": owned!.path] && !deleted
    let logout = method == "POST" && authenticated && parts.path == "/api/v1/auth/logout" && parts.query == nil && body == nil
    guard (method == "GET" && body == nil && (sessionRead || apiRead || imageRead)) || deletion || logout,
      !authenticated || !token.isEmpty else { throw assetsFailure("The Assets observer cannot upload, mutate arbitrary paths, or access another service.") }
    var request = URLRequest(url: url); request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
    if authenticated { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    for (key, value) in headers { request.setValue(value, forHTTPHeaderField: key) }
    if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
    let (bytes, response) = try await session.data(for: request)
    guard let response = response as? HTTPURLResponse, response.url == url, response.statusCode == expected, bytes.count <= 2_000_000 else {
      throw assetsFailure("The exact loopback request must confirm its expected status and bounded response.")
    }
    return (bytes, response)
  }
}
