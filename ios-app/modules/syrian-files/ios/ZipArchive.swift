import Foundation

enum ExportError: Error { case invalidFile, archiveUnavailable, imageUnavailable }

func validateExportFile(_ path: String, cache: URL) throws -> URL {
  guard let url = URL(string: path), url.isFileURL, url.host == nil || url.host == "",
        url.standardizedFileURL.resolvingSymlinksInPath().path.hasPrefix(cache.standardizedFileURL.resolvingSymlinksInPath().path + "/sz-") else {
    throw ExportError.invalidFile
  }
  return url
}

func createZipArchive(_ directory: URL, cache: URL) throws -> URL {
  let manager = FileManager.default
  let output = cache.appendingPathComponent("sz-archive-\(UUID().uuidString).zip")
  var coordinationError: NSError?
  var copyError: Error?
  NSFileCoordinator().coordinate(readingItemAt: directory, options: .forUploading, error: &coordinationError) { archive in
    do { try manager.copyItem(at: archive, to: output) }
    catch { copyError = error }
  }
  if let error = coordinationError { throw error }
  if let error = copyError { throw error }
  let values = try output.resourceValues(forKeys: [.isRegularFileKey])
  guard values.isRegularFile == true else { try? manager.removeItem(at: output); throw ExportError.archiveUnavailable }
  return output
}
