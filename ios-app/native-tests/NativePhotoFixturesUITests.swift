import XCTest

final class NativePhotoFixturesUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func testCreateVerifyAndRemoveOnlyTheGeneratedSimulatorPhoto() throws {
    try NativePhotoFixtures.cleanupRecordedFixtures()
    let photo = try NativePhotoFixtures.create(in: self)
    XCTAssertTrue(photo.albumTitle.hasPrefix("Syrian Zone Native QA "))
    XCTAssertTrue(photo.fileName.hasPrefix("native-qa-"))
    try photo.verifySingleOwnedPhoto()
    try photo.cleanup()
    try photo.cleanup()
  }
}
