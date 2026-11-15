import ExpoModulesCore
import ImageIO
import UIKit
import QuickLook

public final class SyrianFilesModule: Module {
  private let previewID = UUID()
  public func definition() -> ModuleDefinition {
    let previewID = self.previewID
    Name("SyrianFiles")
    AsyncFunction("preview") { (path: String, title: String, promise: Promise) in
      MainActor.assumeIsolated {
        guard PreviewOwners.active[previewID] == nil else {
          promise.reject("preview_busy", "أغلق المعاينة الحالية أولاً.")
          return
        }
        do {
          let cache = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
          let url = try validateExportFile(path, cache: cache)
          let values = try url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
          guard values.isRegularFile == true, (values.fileSize ?? 0) <= 50 * 1024 * 1024 else { throw ExportError.invalidFile }
          let owner = FilePreviewOwner(url: url, title: String(title.prefix(255))) { completed in
            PreviewOwners.active[previewID] = nil
            if completed { promise.resolve() }
            else { promise.reject("preview_cancelled", "تم إغلاق المعاينة.") }
          }
          PreviewOwners.active[previewID] = owner
          try owner.present()
        } catch {
          PreviewOwners.active[previewID] = nil
          promise.reject("preview_unavailable", "تعذر معاينة هذا الملف. يمكنك حفظه في تطبيق الملفات.")
        }
      }
    }.runOnQueue(.main)
    OnDestroy {
      DispatchQueue.main.async {
        PreviewOwners.active.removeValue(forKey: previewID)?.cancel()
      }
    }
    AsyncFunction("zip") { (path: String) -> String in
      let cache = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      let directory = try validateExportFile(path, cache: cache)
      guard directory.deletingLastPathComponent().lastPathComponent.hasPrefix("sz-zip-") else { throw ExportError.invalidFile }
      return try createZipArchive(directory, cache: cache).absoluteString
    }.runOnQueue(.global(qos: .userInitiated))

    AsyncFunction("encodeImage") { (path: String, width: Int, height: Int, format: String, quality: Double) -> String in
      let cache = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      return try encodeExportImage(path, cache: cache, width: width, height: height, format: format, quality: quality).absoluteString
    }.runOnQueue(.global(qos: .userInitiated))

    AsyncFunction("imageDataUri") { (path: String) -> String in
      let cache = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      let url = try validateExportFile(path, cache: cache)
      let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
      guard size > 0 && size <= 8_000_000,
            let source = CGImageSourceCreateWithURL(url as CFURL, nil),
            let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
            let width = properties[kCGImagePropertyPixelWidth] as? Int,
            let height = properties[kCGImagePropertyPixelHeight] as? Int,
            width > 0, height > 0, width <= 8000, height <= 8000, width * height <= 16_000_000 else {
        throw ExportError.imageUnavailable
      }
      let options: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: 2048]
      guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary),
            let png = UIImage(cgImage: image).pngData(), png.count <= 12_000_000 else { throw ExportError.imageUnavailable }
      return "data:image/png;base64," + png.base64EncodedString()
    }.runOnQueue(.global(qos: .userInitiated))
  }
}

@MainActor
private enum PreviewOwners {
  static var active: [UUID: FilePreviewOwner] = [:]
}

@MainActor
private final class FilePreviewItem: NSObject, QLPreviewItem {
  let previewItemURL: URL?
  let previewItemTitle: String?
  init(url: URL, title: String) { previewItemURL = url; previewItemTitle = title }
}

@MainActor
private final class FilePreviewOwner: NSObject, QLPreviewControllerDataSource, QLPreviewControllerDelegate, UIAdaptivePresentationControllerDelegate {
  private let item: FilePreviewItem
  private let controller = QLPreviewController()
  private lazy var navigation = UINavigationController(rootViewController: controller)
  private let complete: (Bool) -> Void
  private var finished = false

  init(url: URL, title: String, complete: @escaping (Bool) -> Void) {
    item = FilePreviewItem(url: url, title: title)
    self.complete = complete
    super.init()
    controller.dataSource = self
    controller.delegate = self
    controller.navigationItem.rightBarButtonItem = UIBarButtonItem(barButtonSystemItem: .done, target: self, action: #selector(closePreview))
  }

  func present() throws {
    guard QLPreviewController.canPreview(item),
          let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first(where: { $0.activationState == .foregroundActive }),
          var presenter = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController else { throw ExportError.invalidFile }
    while let next = presenter.presentedViewController { presenter = next }
    guard presenter.viewIfLoaded?.window != nil, !presenter.isBeingDismissed else { throw ExportError.invalidFile }
    presenter.present(navigation, animated: true) { [weak self] in
      guard let self else { return }
      // iOS27's direct image preview exposes no dismiss button. Keep the
      // native navigation container's explicit Done action visible on entry.
      self.navigation.setNavigationBarHidden(false, animated: false)
      self.controller.navigationItem.rightBarButtonItem = UIBarButtonItem(barButtonSystemItem: .done, target: self, action: #selector(self.closePreview))
    }
    navigation.presentationController?.delegate = self
  }
  @objc private func closePreview() {
    navigation.dismiss(animated: true) { [weak self] in self?.finish(true) }
  }
  func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }
  func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> any QLPreviewItem { item }
  nonisolated func previewControllerDidDismiss(_ controller: QLPreviewController) {
    // QuickLook imports this delegate requirement as nonisolated. UIKit delivers
    // dismissal on its main thread; verify that boundary before touching state.
    MainActor.assumeIsolated { finish(true) }
  }
  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) { finish(true) }
  private func finish(_ completed: Bool) { guard !finished else { return }; finished = true; complete(completed) }
  func cancel() { navigation.dismiss(animated: false); finish(false) }
}
