import Foundation
import UIKit
import XCTest
#if targetEnvironment(simulator)
import Photos
#endif

// Test-runner only. No app code, user image, or broad Photos search is involved.
enum NativePhotoFixtures {
  static let runnerBundleIdentifier = "zone.syrian.ios.uitests.xctrunner"

  struct Fixture {
    let albumTitle: String
    let fileName: String
    fileprivate let recordURL: URL

    @MainActor
    func cleanup() throws {
      try NativePhotoFixtures.cleanupRecord(at: recordURL)
    }

    func verifySingleOwnedPhoto() throws {
      #if targetEnvironment(simulator)
      _ = try NativePhotoFixtures.requireAccess()
      let record = try NativePhotoFixtures.readRecord(at: recordURL)
      _ = try NativePhotoFixtures.fetchOwned(record, requireBoth: true)
      #else
      throw XCTSkip("Photo fixtures refuse physical devices and macOS Photos access.")
      #endif
    }
  }

  @MainActor
  static func create(in testCase: XCTestCase) throws -> Fixture {
    #if targetEnvironment(simulator)
    let directory = try requireAccess()
    let identifier = UUID().uuidString
    let recordURL = directory.appendingPathComponent(identifier).appendingPathExtension("json")
    let planned = Record(version: 1, identifier: identifier, albumTitle: "Syrian Zone Native QA \(identifier)", fileName: "native-qa-\(identifier).png", phase: .planned, assetID: nil, albumID: nil)
    try write(planned, to: recordURL)
    // Register exact-ID cleanup before submitting a transaction, including failure paths.
    testCase.addTeardownBlock { () throws -> Void in
      guard Thread.isMainThread else { throw FixtureError("Owned photo teardown requires XCTest's documented main thread.") }
      // Assertion interruption can keep the original main-actor job on the stack.
      // Use XCTest's synchronous overload instead of enqueueing another actor job.
      try MainActor.assumeIsolated { try cleanupRecord(at: recordURL) }
    }
    let data = patternPNG(identifier: identifier)
    let state = ChangeState(record: planned)
    let completed = XCTestExpectation(description: "Create only the recorded native QA photo and album")
    PHPhotoLibrary.shared().performChanges({
      let asset = PHAssetCreationRequest.forAsset()
      guard let placeholder = asset.placeholderForCreatedAsset else {
        state.fail(FixtureError("PhotoKit did not provide the new asset placeholder. No image resource was submitted."))
        return
      }
      let album = PHAssetCollectionChangeRequest.creationRequestForAssetCollection(withTitle: planned.albumTitle)
      var requested = planned
      requested.phase = .requested
      requested.assetID = placeholder.localIdentifier
      requested.albumID = album.placeholderForCreatedAssetCollection.localIdentifier
      state.replaceRecord(requested)
      do {
        // Persist placeholders before committing any image resource to Photos.
        try write(requested, to: recordURL)
      } catch {
        state.fail(error)
        return
      }
      let options = PHAssetResourceCreationOptions()
      options.originalFilename = planned.fileName
      asset.addResource(with: .photo, data: data, options: options)
      album.addAssets([placeholder] as NSArray)
    }, completionHandler: { success, error in
      var record = state.snapshot().record
      record.phase = success ? .committed : .failed
      do { try write(record, to: recordURL) } catch { state.fail(error) }
      state.finish(success: success, error: error)
      completed.fulfill()
    })
    guard XCTWaiter.wait(for: [completed], timeout: 20) == .completed else {
      throw FixtureError("PhotoKit creation did not complete. Exact IDs remain in the private runner cache. No system alert was accepted automatically.")
    }
    let result = state.snapshot()
    if let error = result.error { throw error }
    guard result.success else { throw FixtureError("PhotoKit refused the native QA fixture transaction.") }
    let fixture = Fixture(albumTitle: planned.albumTitle, fileName: planned.fileName, recordURL: recordURL)
    try fixture.verifySingleOwnedPhoto()
    return fixture
    #else
    throw XCTSkip("Photo fixtures are simulator-only and never access physical-device or Mac Photos.")
    #endif
  }

  @MainActor
  static func cleanupRecordedFixtures() throws {
    #if targetEnvironment(simulator)
    let directory = try requireAccess()
    let records = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
      .filter { $0.pathExtension == "json" && UUID(uuidString: $0.deletingPathExtension().lastPathComponent) != nil }
    for record in records { try cleanupRecord(at: record) }
    #else
    throw XCTSkip("Recorded photo cleanup is simulator-only.")
    #endif
  }

  @MainActor
  private static func cleanupRecord(at url: URL) throws {
    #if targetEnvironment(simulator)
    let directory = try requireAccess()
    guard url.deletingLastPathComponent().standardizedFileURL == directory.standardizedFileURL,
      UUID(uuidString: url.deletingPathExtension().lastPathComponent) != nil else {
      throw FixtureError("Refusing a photo manifest outside the private runner fixture cache.")
    }
    guard FileManager.default.fileExists(atPath: url.path) else { return }
    var record = try readRecord(at: url)
    if record.phase == .planned {
      guard record.assetID == nil && record.albumID == nil else { throw FixtureError("Invalid planned photo fixture record.") }
      try FileManager.default.removeItem(at: url)
      return
    }
    let owned = try fetchOwned(record, requireBoth: record.phase == .requested)
    if record.phase == .requested {
      // Exact object reads confirm that a creation whose callback was interrupted did commit.
      record.phase = .committed
      try write(record, to: url)
    }
    if record.phase == .failed && (!owned.assets.isEmpty || !owned.albums.isEmpty) {
      throw FixtureError("Unexpected partial failed PhotoKit transaction. Recorded IDs are retained for explicit review.")
    }
    try declineVisibleAbsentPrompts(record)
    if owned.assets.isEmpty && owned.albums.isEmpty {
      try FileManager.default.removeItem(at: url)
      return
    }
    try recoverVisibleRetainedPrompts(record)
    // Separate transactions bind each system confirmation to its one owned object kind.
    try deleteOwned(record, kind: .album)
    try deleteOwned(record, kind: .photo)
    let remaining = try fetchOwned(record, requireBoth: false)
    guard remaining.assets.isEmpty && remaining.albums.isEmpty else { throw FixtureError("A recorded fixture object still exists after cleanup.") }
    try declineVisibleAbsentPrompts(record)
    try FileManager.default.removeItem(at: url)
    #else
    throw XCTSkip("PhotoKit cleanup refuses physical devices and macOS Photos.")
    #endif
  }

  #if targetEnvironment(simulator)
  private enum Phase: String, Codable, Sendable { case planned, requested, committed, failed }
  private struct Record: Codable, Sendable {
    let version: Int
    let identifier: String
    let albumTitle: String
    let fileName: String
    var phase: Phase
    var assetID: String?
    var albumID: String?
  }
  private struct Owned {
    let assets: [PHAsset]
    let albums: [PHAssetCollection]
  }
  @MainActor private static var pendingDeletions: [String: ChangeState] = [:]
  private struct FixtureError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
  }
  private final class ChangeState: @unchecked Sendable {
    private let lock = NSLock()
    private var record: Record
    private var success = false
    private var finished = false
    private var error: Error?
    init(record: Record) { self.record = record }
    func replaceRecord(_ next: Record) { lock.lock(); defer { lock.unlock() }; record = next }
    func fail(_ next: Error) { lock.lock(); defer { lock.unlock() }; if error == nil { error = next } }
    func finish(success: Bool, error: Error?) { lock.lock(); defer { lock.unlock() }; self.success = success; self.finished = true; if self.error == nil { self.error = error } }
    func snapshot() -> (record: Record, success: Bool, finished: Bool, error: Error?) { lock.lock(); defer { lock.unlock() }; return (record, success, finished, error) }
  }

  @MainActor
  private static func recoverVisibleRetainedPrompts(_ record: Record) throws {
    // An older request may delete one kind or both. Recover only its already-visible prompt.
    var accepted = Set<NativePhotoFixtureDeletionPolicy.Kind>()
    for kind in [NativePhotoFixtureDeletionPolicy.Kind.album, .photo] {
      if try actOnOwnedDeletionAlert(record, kind: kind, expectedAction: .approve) == .approve { accepted.insert(kind); break }
    }
    if accepted.isEmpty { return }
    let deadline = Date().addingTimeInterval(12)
    while Date() < deadline {
      let remaining = try fetchOwned(record, requireBoth: false)
      if NativePhotoFixtureDeletionPolicy.recoveryFinished(accepted: accepted, albumPresent: !remaining.albums.isEmpty, photoPresent: !remaining.assets.isEmpty) {
        try declineVisibleAbsentPrompts(record)
        return
      }
      try declineVisibleAbsentPrompts(record)
      for kind in [NativePhotoFixtureDeletionPolicy.Kind.album, .photo] where !accepted.contains(kind) {
        if try actOnOwnedDeletionAlert(record, kind: kind, expectedAction: .approve) == .approve { accepted.insert(kind) }
      }
      RunLoop.current.run(until: Date().addingTimeInterval(0.2))
    }
    throw FixtureError("A retained recorded-kind deletion confirmation did not complete. IDs remain recorded; no new transaction was submitted.")
  }

  @MainActor
  private static func deleteOwned(_ record: Record, kind: NativePhotoFixtureDeletionPolicy.Kind) throws {
    let owned = try fetchOwned(record, requireBoth: false)
    switch kind {
    case .album: if owned.albums.isEmpty { return }
    case .photo: if owned.assets.isEmpty { return }
    }
    let requestKey = "\(record.identifier):\(kind)"
    let state: ChangeState
    if let pending = pendingDeletions[requestKey], !pending.snapshot().finished {
      // Teardown resumes the same timed-out request instead of queueing a duplicate.
      state = pending
    } else {
      state = ChangeState(record: record)
      pendingDeletions[requestKey] = state
      PHPhotoLibrary.shared().performChanges({
        switch kind {
        case .album: PHAssetCollectionChangeRequest.deleteAssetCollections(owned.albums as NSArray)
        case .photo: PHAssetChangeRequest.deleteAssets(owned.assets as NSArray)
        }
      }, completionHandler: { success, error in state.finish(success: success, error: error) })
    }
    let deadline = Date().addingTimeInterval(20)
    while !state.snapshot().finished && Date() < deadline {
      try declineVisibleAbsentPrompts(record)
      _ = try actOnOwnedDeletionAlert(record, kind: kind, expectedAction: .approve)
      RunLoop.current.run(until: Date().addingTimeInterval(0.2))
    }
    let result = state.snapshot()
    guard result.finished else { throw FixtureError("Owned PhotoKit deletion timed out. Exact IDs remain recorded. Unrecognized system alerts were left untouched.") }
    pendingDeletions.removeValue(forKey: requestKey)
    let remaining = try fetchOwned(record, requireBoth: false)
    let absent = kind == .album ? remaining.albums.isEmpty : remaining.assets.isEmpty
    // A retained prompt from a prior timed-out transaction may finish the same exact deletion.
    if absent { return }
    if let error = result.error { throw error }
    throw FixtureError("The one recorded PhotoKit object still exists after its deletion transaction.")
  }

  @MainActor
  private static func declineVisibleAbsentPrompts(_ record: Record) throws {
    // Decline only exact current-record duplicates whose corresponding object is already gone.
    for _ in 0..<4 {
      var declined = false
      for kind in [NativePhotoFixtureDeletionPolicy.Kind.album, .photo] {
        if try actOnOwnedDeletionAlert(record, kind: kind, expectedAction: .decline) == .decline { declined = true }
      }
      if !declined { return }
      RunLoop.current.run(until: Date().addingTimeInterval(0.2))
    }
  }

  @MainActor
  private static func actOnOwnedDeletionAlert(_ record: Record, kind: NativePhotoFixtureDeletionPolicy.Kind, expectedAction: NativePhotoFixtureDeletionPolicy.Action) throws -> NativePhotoFixtureDeletionPolicy.Action? {
    // Never touch permission or unrelated-app alerts. Manifest IDs and remaining objects stay verified.
    guard record.phase == .committed, record.assetID != nil, record.albumID != nil else { return nil }
    for bundle in ["com.apple.springboard", runnerBundleIdentifier] {
      let alert = XCUIApplication(bundleIdentifier: bundle).alerts.firstMatch
      guard alert.exists else { continue }
      let labels = alert.staticTexts.allElementsBoundByIndex.map(\.label)
      let buttons = alert.buttons.allElementsBoundByIndex.map(\.label)
      let owned = try fetchOwned(record, requireBoth: false)
      let present = kind == .album ? !owned.albums.isEmpty : !owned.assets.isEmpty
      guard let action = NativePhotoFixtureDeletionPolicy.action(kind: kind, objectPresent: present, albumTitle: record.albumTitle, alertLabels: labels, buttonLabels: buttons), action == expectedAction else { continue }
      let button = action == .approve ? alert.buttons["Delete"] : alert.buttons.matching(NSPredicate(format: "label IN %@", ["Don't Allow", "Don’t Allow"])).firstMatch
      guard button.exists && button.isEnabled else { return nil }
      button.tap()
      return action
    }
    return nil
  }

  private static func requireAccess() throws -> URL {
    guard Bundle.main.bundleIdentifier == runnerBundleIdentifier,
      ProcessInfo.processInfo.environment["SIMULATOR_UDID"] != nil else {
      throw XCTSkip("Photo fixtures require the exact Simulator UI test runner, not the app or another process.")
    }
    for key in ["NSPhotoLibraryUsageDescription", "NSPhotoLibraryAddUsageDescription"] {
      guard let purpose = Bundle.main.object(forInfoDictionaryKey: key) as? String, !purpose.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        throw XCTSkip("The UI runner main bundle is missing \(key). Rebuild the test runner before granting access.")
      }
    }
    guard PHPhotoLibrary.authorizationStatus(for: .readWrite) == .authorized else {
      throw XCTSkip("Pre-authorize read/write Photos for zone.syrian.ios.uitests.xctrunner on the chosen Simulator. Limited, denied, or undecided access is refused; this helper never requests permission.")
    }
    let directory = try XCTUnwrap(FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first)
      .appendingPathComponent("SyrianZoneNativePhotoFixtures", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    guard try directory.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink != true else {
      throw FixtureError("Refusing a symlink in the private runner fixture cache.")
    }
    try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: directory.path)
    return directory
  }

  private static func readRecord(at url: URL) throws -> Record {
    guard try url.resourceValues(forKeys: [.isSymbolicLinkKey, .isRegularFileKey]).isSymbolicLink != true,
      try url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile == true else {
      throw FixtureError("Refusing an owned-photo manifest that isn't a regular private cache file.")
    }
    let record = try JSONDecoder().decode(Record.self, from: Data(contentsOf: url))
    guard record.version == 1, UUID(uuidString: record.identifier) != nil,
      url.deletingPathExtension().lastPathComponent == record.identifier,
      record.albumTitle == "Syrian Zone Native QA \(record.identifier)",
      record.fileName == "native-qa-\(record.identifier).png",
      [record.assetID, record.albumID].compactMap({ $0 }).allSatisfy({ !$0.isEmpty && $0.count <= 512 }) else {
      throw FixtureError("Invalid owned-photo manifest. No Photos objects were queried or deleted.")
    }
    return record
  }

  private static func write(_ record: Record, to url: URL) throws {
    let data = try JSONEncoder().encode(record)
    try data.write(to: url, options: [.atomic, .completeFileProtection])
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
  }

  private static func fetchOwned(_ record: Record, requireBoth: Bool) throws -> Owned {
    let assets = record.assetID.map { PHAsset.fetchAssets(withLocalIdentifiers: [$0], options: nil) }
    let albums = record.albumID.map { PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [$0], options: nil) }
    let asset = assets?.firstObject, album = albums?.firstObject
    if requireBoth && (asset == nil || album == nil) { throw FixtureError("Recorded PhotoKit creation is unconfirmed. IDs are retained without guessing or searching the library.") }
    if let asset {
      guard asset.localIdentifier == record.assetID, asset.mediaType == .image,
        asset.pixelWidth == 640, asset.pixelHeight == 480,
        PHAssetResource.assetResources(for: asset).contains(where: { $0.originalFilename == record.fileName }) else {
        throw FixtureError("Recorded asset provenance differs from the generated PNG. Refusing cleanup.")
      }
    }
    if let album {
      guard album.localIdentifier == record.albumID, album.localizedTitle == record.albumTitle else {
        throw FixtureError("Recorded album identity changed. Refusing cleanup.")
      }
      let members = PHAsset.fetchAssets(in: album, options: nil)
      guard members.count <= 1, members.firstObject == nil || members.firstObject?.localIdentifier == record.assetID else {
        throw FixtureError("The owned album contains an unexpected asset. Refusing cleanup.")
      }
      if requireBoth && members.count != 1 { throw FixtureError("The owned album is not ready with its one generated PNG.") }
    }
    return Owned(assets: asset.map { [$0] } ?? [], albums: album.map { [$0] } ?? [])
  }

  @MainActor
  private static func patternPNG(identifier: String) -> Data {
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = true
    return UIGraphicsImageRenderer(size: CGSize(width: 640, height: 480), format: format).pngData { context in
      UIColor.systemBlue.setFill(); context.fill(CGRect(x: 0, y: 0, width: 640, height: 480))
      UIColor.systemYellow.setFill(); context.fill(CGRect(x: 320, y: 0, width: 320, height: 240))
      UIColor.systemGreen.setFill(); context.fill(CGRect(x: 0, y: 240, width: 320, height: 240))
      UIColor.white.setFill(); context.fill(CGRect(x: 24, y: 182, width: 592, height: 116))
      let attributes: [NSAttributedString.Key: Any] = [.font: UIFont.boldSystemFont(ofSize: 26), .foregroundColor: UIColor.black]
      ("Syrian Zone Native QA\n\(identifier.prefix(8))" as NSString).draw(in: CGRect(x: 42, y: 198, width: 556, height: 90), withAttributes: attributes)
    }
  }
  #endif
}
