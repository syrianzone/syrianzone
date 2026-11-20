import Foundation
import CoreGraphics
import ImageIO

private enum ImageExportFailure: String, LocalizedError {
  case bounds, file, pngSource, sourcePixels, decode, bitmap, output, destination, finalize
  var errorDescription: String? { "Image export failed at \(rawValue)." }
}

// Both the decoded source and exact-pixel destination have independent bounds.
// A bitmap context avoids UIKit's implicit display scale on retina devices.
func encodeExportImage(_ path: String, cache: URL, width: Int, height: Int, format: String, quality: Double) throws -> URL {
  let limit = 16_000_000
  guard width > 0, height > 0, width <= limit / height,
        ["png", "jpg"].contains(format), quality.isFinite, (0...1).contains(quality) else { throw ImageExportFailure.bounds }
  let input = try validateExportFile(path, cache: cache)
  let values = try input.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
  guard values.isRegularFile == true, let size = values.fileSize, size > 0, size <= 72_000_000 else { throw ImageExportFailure.file }
  guard let source = CGImageSourceCreateWithURL(input as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary),
        let sourceType = CGImageSourceGetType(source), sourceType as String == "public.png" else { throw ImageExportFailure.pngSource }
  guard let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
        let sourceWidth = properties[kCGImagePropertyPixelWidth] as? Int,
        let sourceHeight = properties[kCGImagePropertyPixelHeight] as? Int,
        sourceWidth > 0, sourceHeight > 0, sourceWidth <= limit / sourceHeight else { throw ImageExportFailure.sourcePixels }
  guard let image = CGImageSourceCreateImageAtIndex(source, 0, [kCGImageSourceShouldCacheImmediately: false] as CFDictionary) else { throw ImageExportFailure.decode }
  guard let space = CGColorSpace(name: CGColorSpace.sRGB),
        let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
          bytesPerRow: width * 4, space: space,
          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { throw ImageExportFailure.bitmap }
  let bounds = CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height))
  if format == "jpg" { context.setFillColor(CGColor(gray: 1, alpha: 1)); context.fill(bounds) }
  context.interpolationQuality = .high
  context.draw(image, in: bounds)
  guard let outputImage = context.makeImage() else { throw ImageExportFailure.output }
  let output = cache.appendingPathComponent("sz-render-\(UUID().uuidString).\(format)")
  var committed = false
  defer { if !committed { try? FileManager.default.removeItem(at: output) } }
  guard let destination = CGImageDestinationCreateWithURL(output as CFURL,
    (format == "jpg" ? "public.jpeg" : "public.png") as CFString, 1, nil) else { throw ImageExportFailure.destination }
  CGImageDestinationAddImage(destination, outputImage,
    format == "jpg" ? [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary : nil)
  guard CGImageDestinationFinalize(destination) else { throw ImageExportFailure.finalize }
  committed = true
  return output
}
