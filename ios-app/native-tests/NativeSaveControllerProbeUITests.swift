import Foundation
import XCTest

// Real generated PNG with observed Share and document controls. No document save, folder creation or filename editing.
final class NativeSaveControllerProbeUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func testExpandOwnedShareActionsAndCancelWithoutSaving() throws {
    try observeOwnedExport(openDocumentController: false)
  }

  @MainActor
  func testOpenObservedSaveToFilesControllerAndCancelWithoutSaving() throws {
    try observeOwnedExport(openDocumentController: true)
  }

  @MainActor
  func testObserveOwnedHostedSaveProviderAndCancelWithoutSaving() throws {
    try observeOwnedExport(openDocumentController: true, observeHostedProvider: true)
  }

  @MainActor
  private func observeOwnedExport(openDocumentController: Bool, observeHostedProvider: Bool = false) throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == "zone.syrian.ios.uitests.xctrunner",
      let device = ProcessInfo.processInfo.environment["SIMULATOR_UDID"], UUID(uuidString: device) != nil else { throw failure("Only the exact Simulator runner may observe this generated export.") }
    #else
    throw failure("Save-controller probes refuse physical devices.")
    #endif
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    defer { app.terminate() }
    app.terminate(); app.launch()
    XCTAssertTrue(app.staticTexts["adapter.fixture"].waitForExistence(timeout: 15))
    let metadata = app.staticTexts["adapter.status.local-files-metadata"].firstMatch
    XCTAssertTrue(metadata.waitForExistence(timeout: 15))
    let prefix = "LOCAL FILES METADATA ", raw = metadata.label
    guard raw.hasPrefix(prefix), let bytes = raw.dropFirst(prefix.count).data(using: .utf8),
      let source = try JSONSerialization.jsonObject(with: bytes) as? [String: Any],
      Set(source.keys) == ["version", "id", "filename"], source["version"] as? Int == 1,
      let id = source["id"] as? String, UUID(uuidString: id)?.uuidString.lowercased() == id,
      let filename = source["filename"] as? String, filename == "native-files-\(id).png" else { throw failure("Only this adapter mount's exact generated PNG may be shared.") }
    let prepare = app.buttons["adapter.save-controller-prepare"].firstMatch
    XCTAssertTrue(prepare.waitForExistence(timeout: 10))
    try reveal(prepare, in: app)
    prepare.tap()
    let status = app.staticTexts["adapter.status.save-controller"].firstMatch
    let prepared = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      guard let value = try? self.state(status) else { return false }
      return ["ready", "failed-clean", "cleanup-error"].contains(value["phase"] as? String ?? "")
    }, object: status)
    XCTAssertEqual(XCTWaiter.wait(for: [prepared], timeout: 20), .completed)
    let staged = try state(status)
    try attachMetadata(staged, name: "save-controller-exact-generated-PNG-before-presentation")
    try validate(staged, id: id, filename: filename, phase: "ready")
    let probe = app.buttons["adapter.save-controller-probe"].firstMatch
    try reveal(probe, in: app)
    probe.tap()
    let basename = String(filename.dropLast(4))
    let captions = app.otherElements.matching(identifier: "LP.CaptionBar.TopCaption")
    guard captions.firstMatch.waitForExistence(timeout: 15), captions.count == 1, captions.firstMatch.label == basename else {
      try attachMetadata(try state(status), name: "share-owned-caption-unverified")
      throw failure("Only the exact generated basename may establish ownership of this Share sheet.")
    }
    let shares = app.otherElements.matching(identifier: "ShareSheet.RemoteContainerView")
    guard shares.count == 1, shares.firstMatch.otherElements.matching(identifier: "LP.CaptionBar.TopCaption").count == 1 else {
      throw failure("The observed owned Share container must be unique before any system interaction.")
    }
    let share = shares.firstMatch
    try validate(try state(status), id: id, filename: filename, phase: "presenting")
    let more = share.cells.matching(NSPredicate(format: "identifier == %@ AND label == %@", "actionGroupCell", "View More"))
    guard more.count == 1, more.firstMatch.isEnabled, more.firstMatch.isHittable else {
      try observeShare(share, caption: captions.firstMatch, basename: basename, phase: "before-expansion-unavailable")
      throw failure("Only the actually observed View More action-group Cell may expand the Share actions.")
    }
    try observeShare(share, caption: captions.firstMatch, basename: basename, phase: "before-expansion")
    let initialActions = share.cells.matching(identifier: "actionGroupCell").allElementsBoundByIndex.map { $0.label }
    more.firstMatch.tap()
    // This is an observation boundary, not a guessed Save-to-Files selector.
    // No action row, contact, recipient, app or provider is selected here.
    let expanded = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      share.cells.matching(identifier: "actionGroupCell").allElementsBoundByIndex.map { $0.label } != initialActions
    }, object: share)
    let expansion = XCTWaiter.wait(for: [expanded], timeout: 10)
    try observeShare(share, caption: captions.firstMatch, basename: basename, phase: "after-expansion")
    guard expansion == .completed else { throw failure("The observed action-group labels did not change after View More.") }
    if openDocumentController {
      let saveActivity = share.cells.matching(NSPredicate(format: "identifier == %@ AND label == %@", "actionGroupCell", "Save to Files"))
      guard captions.count == 1, captions.firstMatch.label == basename, saveActivity.count == 1,
        saveActivity.firstMatch.isEnabled, saveActivity.firstMatch.isHittable else {
        throw failure("Only the Native18 observed Save to Files Cell may open the owned export controller.")
      }
      saveActivity.firstMatch.tap()
      let ownName = NSPredicate(format: "value == %@ OR value == %@", filename, basename)
      let fields = app.textFields.matching(ownName)
      let appeared = fields.firstMatch.waitForExistence(timeout: 15)
      captureDocumentControls(app, filename: filename, basename: basename)
      guard appeared, fields.count == 1 else {
        try attachMetadata(try state(status), name: "save-document-own-filename-unverified")
        throw failure("The actual document controller must expose exactly this generated filename before cancellation. No Save or provider fallback is attempted.")
      }
      let ownsField = NSPredicate(format: "elementType == %lu AND (value == %@ OR value == %@)", XCUIElement.ElementType.textField.rawValue, filename, basename)
      let candidates = app.otherElements.containing(ownsField).allElementsBoundByIndex.filter {
        $0.textFields.matching(ownName).count == 1 && $0.buttons.matching(identifier: "Cancel").count == 1
      }.sorted { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height }
      guard var document = candidates.first else { throw failure("A shared document-controller ancestor must own both this exact filename and its unique Cancel button.") }
      if observeHostedProvider { document = try observeProvider(app, document: document, filename: filename, basename: basename) }
      let cancel = document.buttons.matching(identifier: "Cancel")
      guard fields.count == 1, cancel.count == 1, cancel.firstMatch.isEnabled, cancel.firstMatch.isHittable else {
        throw failure("The owned document controller's unique enabled Cancel is required. No generic dismissal is attempted.")
      }
      let nameImage = XCTAttachment(screenshot: fields.firstMatch.screenshot())
      nameImage.name = "save-document-exact-generated-filename"; nameImage.lifetime = .keepAlways; add(nameImage)
      let cancelImage = XCTAttachment(screenshot: cancel.firstMatch.screenshot())
      cancelImage.name = "save-document-owned-cancel"; cancelImage.lifetime = .keepAlways; add(cancelImage)
      cancel.firstMatch.tap()
      if captions.firstMatch.exists { try closeOwnedShare(share, caption: captions.firstMatch, basename: basename) }
    } else {
      try closeOwnedShare(share, caption: captions.firstMatch, basename: basename)
    }
    let cleaned = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      guard let value = try? self.state(status) else { return false }
      return value["phase"] as? String == "returned-clean" || value["phase"] as? String == "cleanup-error" || value["phase"] as? String == "failed-clean"
    }, object: status)
    XCTAssertEqual(XCTWaiter.wait(for: [cleaned], timeout: 20), .completed)
    let result = try state(status)
    let cleanup = XCTAttachment(data: try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys, .prettyPrinted]), uniformTypeIdentifier: "public.json")
    cleanup.name = "save-controller-exact-mount-cache-cleanup"; cleanup.lifetime = .keepAlways; add(cleanup)
    try validate(result, id: id, filename: filename, phase: "returned-clean")
    XCTAssertEqual(result["fileExists"] as? Bool, false)
    XCTAssertEqual(result["directoryExists"] as? Bool, false)
    XCTAssertFalse(captions.firstMatch.exists)
    XCTAssertTrue(probe.isHittable, "The native flow must return to the adapter without an unresolved sheet.")
  }

  @MainActor
  private func observeProvider(_ app: XCUIApplication, document: XCUIElement, filename: String, basename: String) throws -> XCUIElement {
    let ownName = NSPredicate(format: "value == %@ OR value == %@", filename, basename)
    let bars = document.navigationBars.matching(identifier: "FullDocumentManagerViewControllerNavigationBar")
    let back = bars.firstMatch.buttons.matching(NSPredicate(format: "identifier == %@ AND label == %@", "BackButton", "Browse"))
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      document.textFields.matching(ownName).count == 1 && bars.count == 1
        && bars.firstMatch.staticTexts.matching(NSPredicate(format: "label == %@", "On My iPhone")).count == 1
        && back.count == 1 && back.firstMatch.isEnabled && back.firstMatch.isHittable
        && document.buttons.matching(identifier: "DOCPicker.dismissButton").count == 1
    }, object: document)
    let settled = XCTWaiter.wait(for: [ready], timeout: 10)
    try captureHostedControls(document, filename: filename, basename: basename, phase: "settled-before-one-browse-back")
    guard settled == .completed else { throw failure("The Native19 observed owned document, local heading, BackButton/Browse and exact Cancel must settle before one navigation observation.") }
    // One observed navigation action, with no Save, new folder or filename edit.
    back.firstMatch.tap()
    let locations = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      document.textFields.matching(ownName).count == 1
        && document.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Locations")).allElementsBoundByIndex.contains {
          $0.exists && !$0.frame.intersection(app.frame).isEmpty
        }
    }, object: document)
    let observed = XCTWaiter.wait(for: [locations], timeout: 10)
    try captureHostedControls(document, filename: filename, basename: basename, phase: "after-one-browse-back")
    guard observed == .completed else { throw failure("One observed Browse back did not expose a fresh Locations scope while retaining this owned filename. No alternative path or provider is guessed.") }

    let localPredicate = NSPredicate(format: "label == %@", "On My iPhone")
    let local = document.cells.matching(localPredicate)
    let structures = document.collectionViews.allElementsBoundByIndex + document.tables.allElementsBoundByIndex
    let scopes = structures.filter { scope in
      scope.cells.matching(NSPredicate(format: "identifier == %@ AND label == %@", "DOC.sidebar.header.Locations", "Locations")).count == 1
        && scope.cells.matching(NSPredicate(format: "identifier == %@ AND label == %@", "DOC.sidebar.item.On My iPhone", "On My iPhone")).count == 1
    }.sorted { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height }
    var selected = false
    if let scope = scopes.first, local.count == 1, local.firstMatch.exists,
      local.firstMatch.isEnabled, local.firstMatch.isHittable, app.frame.contains(local.firstMatch.frame) {
      let provider = scope.cells.matching(localPredicate)
      try requireProviderBoundary(app, document: document, scope: scope, filename: filename, basename: basename)
      // Record the freshly observed role and identifier before selecting it.
      try attachMetadata(["phase": "fresh-hosted-locations-provider", "scope": publicControl(scope),
        "provider": publicControl(provider.firstMatch)], name: "hosted-save-provider-before-explicit-local-selection")
      let row = XCTAttachment(screenshot: provider.firstMatch.screenshot())
      row.name = "hosted-save-observed-local-provider-row"; row.lifetime = .keepAlways; add(row)
      try requireProviderBoundary(app, document: document, scope: scope, filename: filename, basename: basename)
      provider.firstMatch.tap()
      let localReady = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
        document.textFields.matching(ownName).count == 1 && bars.count == 1
          && bars.firstMatch.staticTexts.matching(localPredicate).count == 1
          && document.buttons.matching(identifier: "DOCPicker.dismissButton").count == 1
      }, object: document)
      let adopted = XCTWaiter.wait(for: [localReady], timeout: 10)
      try captureHostedControls(document, filename: filename, basename: basename, phase: "after-explicit-local-provider-selection")
      guard adopted == .completed else { throw failure("The explicitly selected hosted local provider did not retain its own filename and actual local heading. No Save is attempted.") }
      selected = true
    }
    try attachMetadata(["phase": "hosted-provider-observation-result", "localProviderSelected": selected,
      "locationsScopeCount": scopes.count, "exactLocalCellCount": local.count,
      "limits": "One Browse navigation observation. Optional local selection requires fresh actual semantic Locations/provider IDs in the hosted controller. Different IDs are recorded without selection. No Save, New Folder, filename edit or file-list capture. A false selection value leaves full-save provider provenance unverified."],
      name: "hosted-save-provider-observation-result")
    return document
  }

  @MainActor
  private func requireProviderBoundary(_ app: XCUIApplication, document: XCUIElement, scope: XCUIElement, filename: String, basename: String) throws {
    let fields = document.textFields.matching(NSPredicate(format: "value == %@ OR value == %@", filename, basename))
    let marker = scope.cells.matching(NSPredicate(format: "identifier == %@ AND label == %@", "DOC.sidebar.header.Locations", "Locations"))
    let local = document.cells.matching(NSPredicate(format: "label == %@", "On My iPhone"))
    let provider = scope.cells.matching(NSPredicate(format: "identifier == %@ AND label == %@", "DOC.sidebar.item.On My iPhone", "On My iPhone"))
    guard fields.count == 1, fields.firstMatch.exists, scope.exists,
      marker.count == 1,
      marker.allElementsBoundByIndex.contains(where: { $0.exists && !$0.frame.intersection(app.frame).isEmpty }),
      local.count == 1, provider.count == 1, provider.firstMatch.exists,
      local.firstMatch.identifier == provider.firstMatch.identifier,
      local.firstMatch.frame == provider.firstMatch.frame,
      provider.firstMatch.isEnabled, provider.firstMatch.isHittable, app.frame.contains(provider.firstMatch.frame) else {
      throw failure("The same exact owned field, fresh visible Locations scope and globally unique local Cell must remain current immediately before provider capture or selection.")
    }
  }

  @MainActor
  private func publicControl(_ element: XCUIElement) -> [String: Any] {
    let frame = element.frame
    return ["role": element.elementType.rawValue, "identifier": element.identifier,
      "enabled": element.isEnabled, "hittable": element.isHittable,
      "frame": [frame.minX, frame.minY, frame.width, frame.height]]
  }

  @MainActor
  private func captureHostedControls(_ document: XCUIElement, filename: String, basename: String, phase: String) throws {
    let fields = document.textFields.matching(NSPredicate(format: "value == %@ OR value == %@", filename, basename))
    guard fields.count == 1, fields.firstMatch.exists else {
      try attachMetadata(["phase": phase, "ownedFilename": filename, "ownedFieldUnique": false,
        "limits": "Current document ownership was lost. No toolbar or provider crop was taken."],
        name: "hosted-save-owned-field-lost")
      throw failure("A fresh unique exact owned filename is required before capturing document controls.")
    }
    let labels = ["Locations", "On My iPhone", "Browse", "Save", "Cancel", "New Folder", "iCloud Drive"]
    var controls: [[String: Any]] = []
    for label in labels {
      for element in document.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).allElementsBoundByIndex {
        var value = publicControl(element); value["label"] = label; controls.append(value)
      }
    }
    let knownBars = document.navigationBars.allElementsBoundByIndex.filter { bar in
      ["On My iPhone", "Browse"].contains { title in
        bar.staticTexts.matching(NSPredicate(format: "label == %@", title)).count == 1
      }
    }
    for bar in knownBars {
      for button in bar.buttons.allElementsBoundByIndex {
        var value = publicControl(button); value["label"] = button.label; value["navigationIdentifier"] = bar.identifier
        controls.append(value)
      }
    }
    for field in fields.allElementsBoundByIndex {
      var value = publicControl(field); value["ownedFilename"] = filename; controls.append(value)
    }
    let metadata = ["phase": phase, "ownedFilename": filename, "controls": controls] as [String: Any]
    let data = try JSONSerialization.data(withJSONObject: metadata, options: [.sortedKeys, .prettyPrinted])
    let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
    attachment.name = "hosted-save-public-controls-\(phase)"; attachment.lifetime = .keepAlways; add(attachment)
    // Only toolbar and exact generated-name screenshots, never file-list rows.
    for (index, bar) in knownBars.enumerated() where bar.exists {
      guard fields.count == 1, fields.firstMatch.exists else { throw failure("Document ownership changed before its toolbar capture.") }
      let image = XCTAttachment(screenshot: bar.screenshot())
      image.name = "hosted-save-toolbar-\(phase)-\(index)"; image.lifetime = .keepAlways; add(image)
    }
    guard fields.count == 1, fields.firstMatch.exists else { throw failure("Document ownership changed before its exact-name capture.") }
    let image = XCTAttachment(screenshot: fields.firstMatch.screenshot())
    image.name = "hosted-save-owned-name-\(phase)"; image.lifetime = .keepAlways; add(image)
  }

  @MainActor
  private func closeOwnedShare(_ share: XCUIElement, caption: XCUIElement, basename: String) throws {
    let navigation = share.navigationBars.matching(identifier: "UIActivityContentView")
    let close = navigation.firstMatch.buttons.matching(NSPredicate(format: "identifier == %@ AND label == %@", "header.closeButton", "Close"))
    guard share.exists, caption.exists, caption.label == basename, navigation.count == 1, close.count == 1,
      close.firstMatch.isEnabled, close.firstMatch.isHittable else {
      throw failure("Only the Native18 observed header.closeButton in the exact owned Share navigation bar may dismiss it.")
    }
    close.firstMatch.tap()
  }

  @MainActor
  private func captureDocumentControls(_ app: XCUIApplication, filename: String, basename: String) {
    // Retain controller/toolbar roles and this owned filename, never the user's
    // file-list rows or a full document-browser screenshot.
    let lines = app.debugDescription.split(separator: "\n").map(String.init)
    var navigationDepth: Int?
    let filtered = lines.filter { line in
      let depth = line.prefix(while: { $0 == " " }).count
      if let previous = navigationDepth, depth <= previous { navigationDepth = nil }
      if line.trimmingCharacters(in: .whitespaces).hasPrefix("NavigationBar,") { navigationDepth = depth }
      return navigationDepth != nil || line.contains(filename) || line.contains(basename)
        || line.contains("label: 'Cancel'") || line.contains("label: 'Save'")
    }
    let roles = XCTAttachment(string: "Only the observed Save to Files activity was opened. No Save, New Folder, provider selection or filename edit occurred. Owned file: \(filename).\n" + filtered.joined(separator: "\n"))
    roles.name = "save-document-controller-buttons-and-owned-name-AX"; roles.lifetime = .keepAlways; add(roles)
  }

  @MainActor
  private func observeShare(_ share: XCUIElement, caption: XCUIElement, basename: String, phase: String) throws {
    guard share.exists, caption.exists, caption.label == basename else {
      throw failure("Unknown or changed Share ownership refuses tree or screenshot capture.")
    }
    // The captured system tree belongs only to the exact generated export.
    // Capture action-group rows and navigation, omitting share-target subtrees.
    let snapshot = share.debugDescription
    let lines = snapshot.split(separator: "\n").map(String.init)
    var excludedDepth: Int?
    let filtered = lines.filter { line in
      let depth = line.prefix(while: { $0 == " " }).count
      if let prior = excludedDepth, depth <= prior { excludedDepth = nil }
      if line.contains("identifier: 'shareCell'") { excludedDepth = depth; return false }
      if excludedDepth != nil { return false }
      return true
    }
    let roles = XCTAttachment(string: "Exact owned basename: \(basename). Phase: \(phase). Only View More expansion is allowed; no Save, Photos, clipboard, contact, recipient, app or provider action is activated.\n" + filtered.joined(separator: "\n"))
    roles.name = "share-owned-actions-\(phase)-AX"; roles.lifetime = .keepAlways; add(roles)
    let captionImage = XCTAttachment(screenshot: caption.screenshot())
    captionImage.name = "share-owned-caption-\(phase)"; captionImage.lifetime = .keepAlways; add(captionImage)
    let groups = share.cells.matching(identifier: "actionGroupCell")
    for index in 0..<min(groups.count, 20) {
      let row = groups.element(boundBy: index)
      if row.exists && row.isHittable {
        let image = XCTAttachment(screenshot: row.screenshot())
        image.name = "share-owned-action-\(phase)-\(index)"; image.lifetime = .keepAlways; add(image)
      }
    }
  }

  @MainActor
  private func reveal(_ element: XCUIElement, in app: XCUIApplication) throws {
    for _ in 0..<8 { if element.isHittable { break }; app.scrollViews.firstMatch.swipeUp() }
    guard element.exists, element.isHittable, element.isEnabled else { throw failure("The exact test-only probe control must be visibly available.") }
  }
  @MainActor
  private func state(_ element: XCUIElement) throws -> [String: Any] {
    guard let data = element.label.data(using: .utf8), let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw failure("Actual generated-cache metadata is required.") }
    return value
  }
  private func attachMetadata(_ value: [String: Any], name: String) throws {
    let metadata = XCTAttachment(data: try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .prettyPrinted]), uniformTypeIdentifier: "public.json")
    metadata.name = name; metadata.lifetime = .keepAlways; add(metadata)
  }
  private func validate(_ value: [String: Any], id: String, filename: String, phase: String) throws {
    guard value["id"] as? String == id, value["filename"] as? String == filename,
      value["phase"] as? String == phase, value["width"] as? Int == 80, value["height"] as? Int == 40,
      value["mimeType"] as? String == "image/png", let size = value["bytes"] as? Int, (1...1_000_000).contains(size) else { throw failure("The exact actual 80x40 generated PNG and bounded phase must be observed.") }
    if phase == "ready", value["fileExists"] as? Bool != true || value["directoryExists"] as? Bool != true { throw failure("The generated cache copy must exist before sharing.") }
  }
  private func failure(_ message: String) -> NSError { NSError(domain: "NativeSaveControllerProbe", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
}
