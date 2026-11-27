import Foundation
import CoreGraphics
import ImageIO
import XCTest
@testable import SyrianFiles

final class ImageExportTests: XCTestCase {
  private let png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPocDnzHwAFiAKY//tLRQAAAABJRU5ErkJggg=="

  func testExactPNGAndJPEGPixelDimensionsAndType() throws {
    let cache = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: cache, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: cache) }
    let source = cache.appendingPathComponent("sz-source.png")
    try XCTUnwrap(Data(base64Encoded: png)).write(to: source)
    for format in ["png", "jpg"] {
      let url = try encodeExportImage(source.absoluteString, cache: cache, width: 80, height: 40, format: format, quality: 0.9)
      let image = try XCTUnwrap(CGImageSourceCreateWithURL(url as CFURL, nil))
      let properties = try XCTUnwrap(CGImageSourceCopyPropertiesAtIndex(image, 0, nil) as? [CFString: Any])
      XCTAssertEqual(properties[kCGImagePropertyPixelWidth] as? Int, 80)
      XCTAssertEqual(properties[kCGImagePropertyPixelHeight] as? Int, 40)
      XCTAssertEqual(CGImageSourceGetType(image) as String?, format == "jpg" ? "public.jpeg" : "public.png")
    }
  }

  func testNativeBoundsAndUnsafePathsRejectBeforeDecoding() throws {
    let cache = FileManager.default.temporaryDirectory
    for (width, height) in [(0, 40), (80, 0), (4001, 4000), (Int.max, 2)] {
      XCTAssertThrowsError(try encodeExportImage("file:///outside.png", cache: cache, width: width, height: height, format: "png", quality: 0.9))
    }
    XCTAssertThrowsError(try encodeExportImage("file:///outside.png", cache: cache, width: 80, height: 40, format: "png", quality: .nan))
    XCTAssertThrowsError(try encodeExportImage("file:///outside.png", cache: cache, width: 80, height: 40, format: "gif", quality: 0.9))
    XCTAssertThrowsError(try encodeExportImage("file:///outside.png", cache: cache, width: 80, height: 40, format: "png", quality: 0.9))
  }
}
