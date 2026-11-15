import XCTest
import Darwin

// Requires the separately bundled adapter entry and an English Simulator UI.
final class NativeLocalFilesUITests: XCTestCase {
  private var provenLocalBrowsers: [ObjectIdentifier: String] = [:]
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  func testGeneratedPNGSaveToOnMyiPhonePreviewAndOwnedCleanup() throws {
    try requireSimulatorRunner()
    let app = XCUIApplication(bundleIdentifier: "zone.syrian.ios")
    let files = XCUIApplication(bundleIdentifier: "com.apple.DocumentsApp")
    var journal: LocalFilesJournal?
    do {
      app.terminate(); app.launch()
      try demand(app.staticTexts["adapter.fixture"].waitForExistence(timeout: 15), "The isolated adapter entry is required.")
      let metadata = app.staticTexts["adapter.status.local-files-metadata"].firstMatch
      try demand(metadata.waitForExistence(timeout: 15), "The fixture must expose its exact mount-owned export metadata.")
      let ownMetadata = metadata.label
      files.activate()
      let relaunchedEmptyRoot = try dismissObservedRetainedLocalMoreMenuIfPresent(in: files)
      try closeRetainedNative30SearchIfPresent(in: files)
      try selectFilesAppLocalRoot(in: files)
      if relaunchedEmptyRoot { try requireReestablishedEmptyLocalRoot(in: files) }
      let owned = try LocalFilesJournal(metadata: ownMetadata)
      journal = owned
      // The private recovery record exists before the first Files creation.
      try owned.record(phase: "planned")
      try verifyFolderAbsent(owned.folder, in: files)
      try owned.record(phase: "folder-creation-attempt")
      try createFolder(owned, in: files)
      try owned.record(phase: "empty-folder-created")
      try returnToLocalRoot(from: owned, in: files)

      app.activate()
      let share = app.buttons["adapter.local-files-share"].firstMatch
      try revealAdapter(share, app: app)
      try tap(share)
      try openOwnedSaveActivity(in: app, owned: owned)
      let document = try selectHostedSaveLocalRoot(in: app, owned: owned)
      try openHostedOwnedFolder(owned, document: document, in: app)
      try requireEmptyHostedOwnedFolder(owned, document: document, in: app)
      try owned.record(phase: "save-presented-in-owned-empty-folder")
      try saveHostedOwnedPNG(owned, document: document, in: app)
      let returned = app.staticTexts["adapter.status.localFiles"].firstMatch
      try demand(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@", "LOCAL FILES RETURNED \(owned.filename)"), object: returned)], timeout: 20) == .completed,
        "The actual native share must return; this alone does not prove a saved file.")

      files.activate()
      try selectFilesAppLocalRoot(in: files)
      try openOwnedFolder(owned, in: files)
      let saved = try onlyOwnedFile(owned, in: files)
      try owned.record(phase: "saved-file-observed")
      try tap(saved)
      try inspectAndDismissOwnedPreview(owned)
      files.activate()
      try selectFilesAppLocalRoot(in: files)
      try openOwnedFolder(owned, in: files)
      _ = try onlyOwnedFile(owned, in: files)
      try deleteOwnedEntry(owned, in: files)
      try requireEmptyOwnedFolder(owned, in: files)
      try owned.record(phase: "saved-file-removed")
      // Reopen immediately before deleting the folder to verify it is empty.
      try returnToLocalRoot(from: owned, in: files)
      try openOwnedFolder(owned, in: files)
      try requireEmptyOwnedFolder(owned, in: files)
      try returnToLocalRoot(from: owned, in: files)
      try deleteOwnedEmptyFolder(owned, in: files)
      try requireLocalRoot(in: files)
      let rootContents = files.collectionViews.matching(identifier: "File View")
      try demand(rootContents.count == 1 && rootContents.firstMatch.cells.count == 0
        && rootContents.firstMatch.cells.matching(identifier: owned.folder + ", Folder").count == 0,
        "The exact empty UUID folder must be absent from the same zero-cell local root after cleanup.")
      try owned.record(phase: "owned-folder-removed")
      try owned.finish()
      attach("local-files-owned-file-and-empty-folder-removed", app: files)
      app.activate()
    } catch {
      if journal == nil {
        let note = XCTAttachment(string: "The pre-journal Files preflight refused. No Files tree, screenshot, foreign query or file contents were captured. No new recovery record or user-file creation was attempted.")
        note.name = "local-files-pre-journal-refusal"; note.lifetime = .keepAlways; add(note)
      } else {
        attachFailure(app: app, files: files, journal: journal)
      }
      // Unknown UI or unexpected contents are retained with the recovery record.
      throw error
    }
  }

  @MainActor
  func testObserveRetainedNative30SearchHeaderWithoutFileActions() throws {
    try requireSimulatorRunner()
    let files = XCUIApplication(bundleIdentifier: "com.apple.DocumentsApp")
    files.activate()
    let expected = "SyrianZone Native Files QA 72d98ffb-219f-42ab-8214-3fba317f4b2d"
    let fields = files.searchFields.matching(NSPredicate(format: "value == %@", expected))
    try demand(fields.firstMatch.waitForExistence(timeout: 10) && fields.count == 1
      && files.frame.contains(fields.firstMatch.frame),
      "Only Native30's exact retained synthetic search may be observed. No alternative navigation is attempted.")
    let field = fields.firstMatch, bounds = field.frame
    func attributes(_ element: XCUIElement) -> [String: Any] {
      ["role": element.elementType.rawValue, "identifier": element.identifier, "label": element.label,
        "frame": [element.frame.minX, element.frame.minY, element.frame.width, element.frame.height],
        "enabled": element.isEnabled, "hittable": element.isHittable, "selected": element.isSelected]
    }
    let header = files.buttons.allElementsBoundByIndex.filter {
      $0.exists && $0.frame.minY >= bounds.minY - 8 && $0.frame.maxY <= bounds.maxY + 8
        && files.frame.contains($0.frame)
    }
    let scopes = files.segmentedControls.buttons.matching(NSPredicate(format: "label IN %@", ["Recents", "On My iPhone"]))
      .allElementsBoundByIndex
    let metadata: [String: Any] = ["ownedSearch": expected, "field": attributes(field),
      "headerButtons": header.map(attributes), "scopeButtons": scopes.map(attributes),
      "keyboardPresent": files.keyboards.firstMatch.exists,
      "limits": "Read-only retained-search observation. No title was adopted as provider proof. No button, provider, result, file, create, save or delete action was activated."]
    let record = XCTAttachment(data: try JSONSerialization.data(withJSONObject: metadata, options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
    record.name = "files-native30-owned-search-header-and-scope-AX"; record.lifetime = .keepAlways; add(record)
    for (index, element) in ([field] + header + scopes).enumerated() where element.exists && element.isHittable {
      try demand(fields.count == 1 && fields.firstMatch.value as? String == expected,
        "The exact owned search must remain current before a header-only screenshot.")
      let image = XCTAttachment(screenshot: element.screenshot())
      image.name = "files-native30-owned-search-control-\(index)"; image.lifetime = .keepAlways; add(image)
    }
  }

  @MainActor
  func testObserveLocationsAfterOneGuardedBackWithoutFileWrites() throws {
    try requireSimulatorRunner()
    let files = XCUIApplication(bundleIdentifier: "com.apple.DocumentsApp")
    files.activate()
    let browse = files.tabBars["DOC.browsingModeTabBar"].buttons["Browse"].firstMatch
    try demand(browse.waitForExistence(timeout: 15) && browse.isHittable, "The observed native Files Browse tab is required for this read-only probe.")
    if !browse.isSelected { try tap(browse) }
    let bar = files.navigationBars["FullDocumentManagerViewControllerNavigationBar"].firstMatch
    let back = bar.buttons.matching(identifier: "DOC.navBarButton.backInHistory")
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      browse.exists && browse.isSelected && bar.exists && bar.staticTexts["On My iPhone"].exists
        && back.count == 1 && back.firstMatch.isHittable && back.firstMatch.isEnabled
    }, object: files)
    let initial = XCTWaiter.wait(for: [ready], timeout: 15)
    attachNavigationProbe("files-navigation-before-one-back", in: files)
    try demand(initial == .completed, "This probe requires the observed selected Browse tab, On My iPhone header and unique enabled history Back control. A title alone does not prove the provider.")
    // Exactly one observed public history action. No provider or file row is tapped.
    try tap(back.firstMatch)
    let locations = files.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Locations"))
    let localProvider = files.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "On My iPhone"))
    let changed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      locations.firstMatch.exists && localProvider.firstMatch.exists
    }, object: files)
    let observed = XCTWaiter.wait(for: [changed], timeout: 10)
    attachNavigationProbe("files-navigation-after-one-back", in: files)
    try demand(observed == .completed, "One guarded Back did not expose both public Locations and On My iPhone labels. Retain the actual metadata; do not guess another path or provider.")
    let limits = XCTAttachment(string: "Read-only system-navigation observation. No share, create, save, delete, file-content read, provider selection or local-root adoption occurred. Locations and provider roles remain actual captured metadata, not an assumed table or collection-cell contract. The On My iPhone header before Back never established provider provenance.")
    limits.name = "files-navigation-read-only-limits"; limits.lifetime = .keepAlways; add(limits)
  }

  @MainActor
  func testObserveLocationsAfterOneBrowseReselectionWithoutFileWrites() throws {
    try requireSimulatorRunner()
    let files = XCUIApplication(bundleIdentifier: "com.apple.DocumentsApp")
    files.activate()
    let tabs = files.tabBars.matching(identifier: "DOC.browsingModeTabBar")
    let browse = tabs.firstMatch.buttons.matching(identifier: "Browse")
    let available = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      files.state == .runningForeground && tabs.count == 1 && browse.count == 1
        && browse.firstMatch.exists && browse.firstMatch.isHittable && browse.firstMatch.isEnabled
    }, object: files)
    let presented = XCTWaiter.wait(for: [available], timeout: 15)
    if presented != .completed { attachNavigationProbe("files-browse-reselect-missing-control", in: files) }
    try demand(presented == .completed, "The observed unique Files Browse tab is required. No alternative navigation or provider is guessed.")
    if !browse.firstMatch.isSelected { try tap(browse.firstMatch) }
    let selected = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      tabs.count == 1 && browse.count == 1 && browse.firstMatch.exists && browse.firstMatch.isSelected
        && files.navigationBars["FullDocumentManagerViewControllerNavigationBar"].exists
    }, object: files)
    let settled = XCTWaiter.wait(for: [selected], timeout: 15)
    attachNavigationProbe("files-browse-selected-before-optional-reselect", in: files)
    try demand(settled == .completed, "Browse must be selected with the observed navigation controller before a possible reselect.")
    if visibleLocationsLabels(in: files) {
      attachNavigationProbe("files-locations-visible-without-reselect", in: files)
    } else {
      // Apple's iOS 27 guide documents tapping Browse again to show Browse.
      // https://support.apple.com/en-ca/guide/iphone/iphe4bff8827/27/ios/27
      try demand(tabs.count == 1 && browse.count == 1 && browse.firstMatch.isSelected
        && browse.firstMatch.isHittable && browse.firstMatch.isEnabled,
        "Only the same observed selected Browse control may be reselected once.")
      try tap(browse.firstMatch)
      let locations = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
        self.visibleLocationsLabels(in: files)
      }, object: files)
      let result = XCTWaiter.wait(for: [locations], timeout: 10)
      attachNavigationProbe("files-locations-after-one-browse-reselect", in: files)
      try demand(result == .completed, "One Browse reselect did not expose visible Locations and On My iPhone labels. Retain actual role metadata; do not navigate again or guess a provider.")
    }
    let limits = XCTAttachment(string: "Read-only Browse observation, with at most one activation tap and one guarded reselect of the same selected Browse tab. No Back, provider selection, local-root adoption, share, create, save, delete, file-content read or journal construction occurred. The captured Locations/provider roles remain observations for a future explicit provider-selection contract.")
    limits.name = "files-browse-reselect-read-only-limits"; limits.lifetime = .keepAlways; add(limits)
  }

  @MainActor
  private func visibleLocationsLabels(in files: XCUIApplication) -> Bool {
    for label in ["Locations", "On My iPhone"] {
      let first = files.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
      if !first.exists || first.frame.intersection(files.frame).isEmpty { return false }
    }
    return true
  }

  @MainActor
  private func attachNavigationProbe(_ name: String, in files: XCUIApplication) {
    let lines = files.debugDescription.split(separator: "\n").map(String.init)
    let labels = ["Browse", "Locations", "On My iPhone", "Recents", "Shared", "iCloud Drive", "Back", "Forward", "More"]
    var included = Set<Int>(), ancestors: [(depth: Int, index: Int)] = []
    for (index, line) in lines.enumerated() {
      let depth = line.prefix(while: { $0 == " " }).count
      while let last = ancestors.last, last.depth >= depth { ancestors.removeLast() }
      if labels.contains(where: { line.contains("label: '\($0)'") })
        || line.contains("identifier: 'FullDocumentManagerViewControllerNavigationBar'")
        || line.contains("identifier: 'DOC.browsingModeTabBar'") {
        included.insert(index)
        for item in ancestors where ["NavigationBar,", "TabBar,", "Table,", "CollectionView,", "Cell,"].contains(where: { lines[item.index].contains($0) }) { included.insert(item.index) }
      }
      ancestors.append((depth, index))
    }
    // One immutable AX snapshot, restricted to public controls and their structural owners.
    // No existing filename, folder row, thumbnail or file content is attached.
    let metadata = XCTAttachment(string: included.sorted().map { lines[$0] }.joined(separator: "\n"))
    metadata.name = name; metadata.lifetime = .keepAlways; add(metadata)
  }

  private func requireSimulatorRunner() throws {
    #if targetEnvironment(simulator)
    guard Bundle.main.bundleIdentifier == "zone.syrian.ios.uitests.xctrunner",
      let device = ProcessInfo.processInfo.environment["SIMULATOR_UDID"], UUID(uuidString: device) != nil else {
      throw localFilesFailure("Only the Simulator UI-test runner may create a local export fixture.")
    }
    #else
    throw localFilesFailure("Local Files verification refuses physical devices.")
    #endif
  }

  @MainActor
  private func observedLocalMoreCollections(in files: XCUIApplication) -> [XCUIElement] {
    files.collectionViews.containing(.button, identifier: "New Folder").allElementsBoundByIndex.filter { collection in
      collection.buttons.matching(NSPredicate(format: "label == %@", "New Folder")).count == 1
        && collection.images.matching(identifier: "folder.badge.plus").count == 1
        && collection.buttons.matching(identifier: "DOC.sortMenuButton.name.ascending").count == 1
        && collection.buttons.matching(identifier: "DOC.sortMenuButton.kind").count == 1
        && collection.buttons.matching(identifier: "DOC.sortMenuButton.dateModified").count == 1
        && collection.buttons.matching(identifier: "DOC.sortMenuButton.size").count == 1
        && collection.buttons.matching(identifier: "DOC.sortMenuButton.tags").count == 1
    }
  }

  @MainActor
  private func dismissObservedRetainedLocalMoreMenuIfPresent(in files: XCUIApplication) throws -> Bool {
    let folders = files.buttons.matching(NSPredicate(format: "label == %@", "New Folder"))
    guard folders.count > 0 else { return false }
    let menus = observedLocalMoreCollections(in: files)
    let local = files.otherElements.matching(identifier: "DOC.browsingRoot Source: com.apple.FileProvider.LocalStorage, Title: On My iPhone")
    let contents = files.collectionViews.matching(identifier: "File View")
    try demand(files.state == .runningForeground && menus.count == 1 && folders.count == 1 && local.count == 1 && contents.count == 1
      && contents.firstMatch.cells.count == 0 && files.staticTexts["On My iPhone is Empty"].firstMatch.exists
      && files.alerts.count == 0 && files.keyboards.count == 0,
      "Only Native34's exact observed More collection above the unchanged empty local root may be dismissed before a new journal.")
    let select = menus[0].buttons.matching(NSPredicate(format: "label == %@", "Select"))
    let icons = menus[0].buttons.matching(NSPredicate(format: "label == %@", "Icons"))
    try demand(select.count == 1 && !select.firstMatch.isEnabled && icons.count == 1 && icons.firstMatch.isSelected
      && folders.firstMatch.isEnabled && folders.firstMatch.isHittable && files.frame.contains(folders.firstMatch.frame)
      && menus[0].frame.contains(folders.firstMatch.frame),
      "The retained empty-root More controls must match Native34. Unknown menus remain untouched.")
    // Native47 retained this exact menu after Escape. Relaunch only Files,
    // after the known empty local-root proof, without selecting any menu item.
    provenLocalBrowsers[ObjectIdentifier(files)] = nil
    files.terminate()
    files.launch()
    let gone = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      files.state == .runningForeground && self.observedLocalMoreCollections(in: files).isEmpty
        && folders.count == 0 && files.alerts.count == 0
    }, object: files)
    try demand(XCTWaiter.wait(for: [gone], timeout: 15) == .completed,
      "One normal Files relaunch must remove the exact known retained menu. Unknown or restored menus refuse before any journal.")
    return true
  }

  @MainActor
  private func requireReestablishedEmptyLocalRoot(in files: XCUIApplication) throws {
    // The caller has explicitly selected the real local provider again.
    try requireLocalRoot(in: files)
    let local = files.otherElements.matching(identifier: "DOC.browsingRoot Source: com.apple.FileProvider.LocalStorage, Title: On My iPhone")
    let contents = files.collectionViews.matching(identifier: "File View")
    try demand(files.state == .runningForeground && local.count == 1 && contents.count == 1
      && contents.firstMatch.cells.count == 0 && files.staticTexts["On My iPhone is Empty"].firstMatch.exists
      && observedLocalMoreCollections(in: files).isEmpty && files.buttons.matching(NSPredicate(format: "label == %@", "New Folder")).count == 0
      && files.alerts.count == 0 && files.keyboards.count == 0,
      "The explicitly reselected local root must still be the exact empty location before constructing any journal. Changed contents remain untouched.")
  }

  @MainActor
  private func closeRetainedNative30SearchIfPresent(in files: XCUIApplication) throws {
    let expected = "SyrianZone Native Files QA 72d98ffb-219f-42ab-8214-3fba317f4b2d"
    let local = files.segmentedControls.buttons.matching(NSPredicate(format: "label == %@", "On My iPhone"))
    let recents = files.segmentedControls.buttons.matching(NSPredicate(format: "label == %@", "Recents"))
    let close = files.buttons.matching(NSPredicate(format: "label == %@", "Close"))
    guard local.count > 0 || recents.count > 0 || close.count > 0 else { return }
    let fields = files.searchFields.matching(NSPredicate(format: "value == %@", expected))
    try demand(fields.count == 1 && local.count == 1 && recents.count == 1
      && local.firstMatch.isSelected != recents.firstMatch.isSelected && close.count == 1,
      "An active search must be exactly the retained Native30 synthetic query. A foreign or ambiguous search is left untouched before any new journal.")
    let field = fields.firstMatch
    try demand(field.value as? String == expected && files.frame.contains(field.frame)
      && close.firstMatch.isEnabled && close.firstMatch.isHittable && files.frame.contains(close.firstMatch.frame)
      && close.firstMatch.frame.minX >= field.frame.maxX && close.firstMatch.frame.minY >= field.frame.minY
      && close.firstMatch.frame.maxY <= field.frame.maxY + 8,
      "Only the Native32 observed unique header Close beside the current exact retained owned query may be tapped.")
    try tap(close.firstMatch)
    let closed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      close.count == 0 && local.count == 0 && recents.count == 0 && fields.count == 0
    }, object: files)
    try demand(XCTWaiter.wait(for: [closed], timeout: 5) == .completed,
      "The exact retained owned search must close before starting the next independent Files preflight.")
  }

  @MainActor
  private func selectFilesAppLocalRoot(in files: XCUIApplication) throws {
    let browser = ObjectIdentifier(files)
    provenLocalBrowsers[browser] = nil
    let tabs = files.tabBars.matching(identifier: "DOC.browsingModeTabBar")
    let browse = tabs.firstMatch.buttons.matching(identifier: "Browse")
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      tabs.count == 1 && browse.count == 1 && browse.firstMatch.exists
        && browse.firstMatch.isEnabled && browse.firstMatch.isHittable
    }, object: files)
    try demand(XCTWaiter.wait(for: [ready], timeout: 15) == .completed, "The observed unique Files.app Browse control is required.")
    if !browse.firstMatch.isSelected { try tap(browse.firstMatch) }
    let selected = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      browse.firstMatch.exists && browse.firstMatch.isSelected
        && files.navigationBars["FullDocumentManagerViewControllerNavigationBar"].exists
    }, object: files)
    try demand(XCTWaiter.wait(for: [selected], timeout: 15) == .completed, "The observed Files.app Browse controller must settle before locating a provider.")
    if !isObservedFilesLocationsScreen(files) {
      try demand(tabs.count == 1 && browse.count == 1 && browse.firstMatch.isSelected
        && browse.firstMatch.isHittable && browse.firstMatch.isEnabled,
        "Only the same selected Browse control may be reselected once.")
      try tap(browse.firstMatch)
      let locations = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.isObservedFilesLocationsScreen(files) }, object: files)
      try demand(XCTWaiter.wait(for: [locations], timeout: 10) == .completed, "The observed Files.app Locations collection must appear after one Browse reselect.")
    }
    let collection = files.collectionViews.matching(identifier: "Browse View")
    let provider = collection.firstMatch.cells.matching(identifier: "DOC.sidebar.item.On My iPhone")
    try demand(collection.count == 1 && isObservedFilesLocationsScreen(files) && provider.count == 1
      && provider.firstMatch.label == "On My iPhone" && provider.firstMatch.isEnabled && provider.firstMatch.isHittable
      && files.frame.contains(provider.firstMatch.frame),
      "Only the unique observed On My iPhone provider cell inside the real Locations collection may establish local provenance.")
    attachNavigationProbe("local-files-observed-locations-before-explicit-selection", in: files)
    attach("local-files-observed-locations-before-explicit-selection", app: files)
    try tap(provider.firstMatch)
    try demand(waitForFilesHeader("On My iPhone", in: files, timeout: 10), "The explicit local-provider selection must adopt its observed Files.app header.")
    provenLocalBrowsers[browser] = "root"
    try requireLocalRoot(in: files)
  }

  @MainActor
  private func isObservedFilesLocationsScreen(_ files: XCUIApplication) -> Bool {
    let collection = files.collectionViews.matching(identifier: "Browse View")
    let headers = collection.firstMatch.cells.matching(identifier: "DOC.sidebar.header.Locations")
    let local = collection.firstMatch.cells.matching(identifier: "DOC.sidebar.item.On My iPhone")
    return hasFilesHeader("Browse", in: files) && collection.count == 1 && headers.count == 1
      && headers.firstMatch.exists && local.count == 1 && local.firstMatch.exists
  }

  @MainActor
  private func hasFilesHeader(_ title: String, in files: XCUIApplication) -> Bool {
    let bars = files.navigationBars.matching(identifier: "FullDocumentManagerViewControllerNavigationBar")
    let heading = bars.firstMatch.staticTexts.matching(identifier: title)
    return bars.count == 1 && heading.count == 1 && heading.firstMatch.exists
      && !heading.firstMatch.frame.intersection(files.frame).isEmpty
  }

  @MainActor
  private func waitForFilesHeader(_ title: String, in files: XCUIApplication, timeout: TimeInterval) -> Bool {
    let expected = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.hasFilesHeader(title, in: files) }, object: files)
    return XCTWaiter.wait(for: [expected], timeout: timeout) == .completed
  }

  @MainActor
  private func requireLocalRoot(in files: XCUIApplication) throws {
    try demand(provenLocalBrowsers[ObjectIdentifier(files)] == "root"
      && waitForFilesHeader("On My iPhone", in: files, timeout: 10),
      "The exact explicitly selected On My iPhone location is required. A title alone or another provider is insufficient.")
  }

  @MainActor
  private func openOwnedSaveActivity(in app: XCUIApplication, owned: LocalFilesJournal) throws {
    let captions = app.otherElements.matching(identifier: "LP.CaptionBar.TopCaption")
    try demand(captions.firstMatch.waitForExistence(timeout: 15) && captions.count == 1
      && captions.firstMatch.label == owned.basename,
      "Only the exact recorded PNG basename may establish Share-sheet ownership.")
    let shares = app.otherElements.matching(identifier: "ShareSheet.RemoteContainerView")
    try demand(shares.count == 1 && shares.firstMatch.otherElements.matching(identifier: "LP.CaptionBar.TopCaption").count == 1,
      "The actual owned Share container must be unique.")
    let share = shares.firstMatch
    let more = share.cells.matching(NSPredicate(format: "identifier == %@ AND label == %@", "actionGroupCell", "View More"))
    try demand(more.count == 1 && more.firstMatch.isEnabled && more.firstMatch.isHittable,
      "Only the Native19 observed View More action-group Cell may expand this owned Share sheet.")
    let before = share.cells.matching(identifier: "actionGroupCell").allElementsBoundByIndex.map { $0.label }
    try tap(more.firstMatch)
    let expanded = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      share.cells.matching(identifier: "actionGroupCell").allElementsBoundByIndex.map { $0.label } != before
    }, object: share)
    try demand(XCTWaiter.wait(for: [expanded], timeout: 10) == .completed,
      "The real Share action rows must change after the observed expansion.")
    let save = share.cells.matching(NSPredicate(format: "identifier == %@ AND label == %@", "actionGroupCell", "Save to Files"))
    try demand(captions.count == 1 && captions.firstMatch.label == owned.basename && save.count == 1
      && save.firstMatch.isEnabled && save.firstMatch.isHittable,
      "Only the Native19 observed Save to Files Cell may open this recorded PNG.")
    try tap(save.firstMatch)
    let fields = app.textFields.matching(NSPredicate(format: "identifier == %@ AND (value == %@ OR value == %@)", "DOCPicker.filenameTextField", owned.filename, owned.basename))
    try demand(fields.firstMatch.waitForExistence(timeout: 15) && fields.count == 1,
      "The actual document controller must retain exactly the recorded PNG name before any location is adopted.")
  }

  @MainActor
  private func selectHostedSaveLocalRoot(in app: XCUIApplication, owned: LocalFilesJournal) throws -> XCUIElement {
    provenLocalBrowsers[ObjectIdentifier(app)] = nil
    let presented = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      self.hasHostedFilename(owned, in: app)
        && app.navigationBars.matching(identifier: "FullDocumentManagerViewControllerNavigationBar").count == 1
        && app.buttons.matching(identifier: "DOCPicker.dismissButton").count == 1
    }, object: app)
    try demand(XCTWaiter.wait(for: [presented], timeout: 10) == .completed,
      "The actual owned document field, navigation and Cancel must be present before resolving their common controller.")
    let field = NSPredicate(format: "elementType == %lu AND identifier == %@ AND (value == %@ OR value == %@)", XCUIElement.ElementType.textField.rawValue, "DOCPicker.filenameTextField", owned.filename, owned.basename)
    let candidates = app.otherElements.containing(field).allElementsBoundByIndex.filter { candidate in
      self.hasHostedFilename(owned, in: candidate)
        && candidate.navigationBars.matching(identifier: "FullDocumentManagerViewControllerNavigationBar").count == 1
        && candidate.buttons.matching(identifier: "DOCPicker.dismissButton").count == 1
    }.sorted { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height }
    guard let document = candidates.first else { throw localFilesFailure("The exact generated filename, actual document navigation and owned Cancel must share one hosted controller.") }
    let bars = document.navigationBars.matching(identifier: "FullDocumentManagerViewControllerNavigationBar")
    let back = bars.firstMatch.buttons.matching(NSPredicate(format: "identifier == %@ AND label == %@", "BackButton", "Browse"))
    let contents = document.collectionViews.matching(identifier: "File View")
    let initial = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      self.hasHostedFilename(owned, in: document) && self.hasHostedHeader("On My iPhone", document: document)
        && contents.count == 1
        && back.count == 1 && back.firstMatch.isEnabled && back.firstMatch.isHittable
    }, object: document)
    try demand(XCTWaiter.wait(for: [initial], timeout: 10) == .completed,
      "Only the Native91 observed owned document with its local heading, File View and BackButton/Browse may begin provider verification.")
    try tap(back.firstMatch)
    let collection = document.collectionViews.matching(identifier: "Browse View")
    let header = collection.firstMatch.cells.matching(NSPredicate(format: "identifier == %@ AND label == %@", "DOC.sidebar.header.Locations", "Locations"))
    let provider = collection.firstMatch.cells.matching(NSPredicate(format: "identifier == %@ AND label == %@", "DOC.sidebar.item.On My iPhone", "On My iPhone"))
    let locations = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      self.hasHostedFilename(owned, in: document) && self.hasHostedHeader("Browse", document: document)
        && collection.count == 1 && header.count == 1 && header.firstMatch.exists
        && !header.firstMatch.frame.intersection(app.frame).isEmpty
        && provider.count == 1 && provider.firstMatch.isEnabled && provider.firstMatch.isHittable
        && app.frame.contains(provider.firstMatch.frame)
    }, object: document)
    try demand(XCTWaiter.wait(for: [locations], timeout: 10) == .completed,
      "The actual hosted Browse View must expose the unique semantic Locations header Cell and On My iPhone provider Cell.")
    try owned.record(phase: "hosted-local-provider-selection-attempt")
    try requireHostedLocations(owned, document: document, in: app)
    try tap(provider.firstMatch)
    let adopted = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      self.hasHostedFilename(owned, in: document) && self.hasHostedHeader("On My iPhone", document: document)
        && contents.count == 1 && contents.firstMatch.exists
    }, object: document)
    try demand(XCTWaiter.wait(for: [adopted], timeout: 10) == .completed,
      "The explicit hosted local-provider selection must retain this exact generated filename and the Native91 observed local File View.")
    try owned.record(phase: "hosted-local-provider-selected")
    try demand(hasHostedFilename(owned, in: document) && hasHostedHeader("On My iPhone", document: document)
      && contents.count == 1 && contents.firstMatch.exists,
      "The hosted local-provider proof must still be current before adoption.")
    provenLocalBrowsers[ObjectIdentifier(app)] = "root"
    return document
  }

  @MainActor
  private func hasHostedFilename(_ owned: LocalFilesJournal, in document: XCUIElement) -> Bool {
    let fields = document.textFields.matching(identifier: "DOCPicker.filenameTextField")
    guard fields.count == 1, fields.firstMatch.exists, let value = fields.firstMatch.value as? String else { return false }
    return value == owned.filename || value == owned.basename
  }

  @MainActor
  private func hasHostedHeader(_ title: String, document: XCUIElement) -> Bool {
    let bars = document.navigationBars.matching(identifier: "FullDocumentManagerViewControllerNavigationBar")
    return bars.count == 1 && bars.firstMatch.staticTexts.matching(NSPredicate(format: "label == %@", title)).count == 1
  }

  @MainActor
  private func hasHostedOwnedFolderHeader(_ owned: LocalFilesJournal, document: XCUIElement) -> Bool {
    let roots = document.otherElements.matching(NSPredicate(format: "identifier == %@",
      "DOC.browsingRoot Source: com.apple.FileProvider.LocalStorage, Title: " + owned.folder))
    let bars = document.navigationBars.matching(identifier: "FullDocumentManagerViewControllerNavigationBar")
    let title = bars.firstMatch.buttons.matching(NSPredicate(format: "label == %@", owned.folder + ", Actions Menu"))
    return roots.count == 1 && bars.count == 1 && title.count == 1 && title.firstMatch.exists
  }

  @MainActor
  private func requireHostedLocations(_ owned: LocalFilesJournal, document: XCUIElement, in app: XCUIApplication) throws {
    let collection = document.collectionViews.matching(identifier: "Browse View")
    let header = collection.firstMatch.cells.matching(NSPredicate(format: "identifier == %@ AND label == %@", "DOC.sidebar.header.Locations", "Locations"))
    let provider = collection.firstMatch.cells.matching(NSPredicate(format: "identifier == %@ AND label == %@", "DOC.sidebar.item.On My iPhone", "On My iPhone"))
    let globalProvider = document.cells.matching(NSPredicate(format: "identifier == %@ AND label == %@", "DOC.sidebar.item.On My iPhone", "On My iPhone"))
    try demand(hasHostedFilename(owned, in: document) && hasHostedHeader("Browse", document: document)
      && collection.count == 1 && header.count == 1 && header.firstMatch.exists
      && !header.firstMatch.frame.intersection(app.frame).isEmpty
      && provider.count == 1 && globalProvider.count == 1 && provider.firstMatch.exists
      && provider.firstMatch.frame == globalProvider.firstMatch.frame
      && provider.firstMatch.isEnabled && provider.firstMatch.isHittable && app.frame.contains(provider.firstMatch.frame),
      "The fresh owned filename, actual Locations Cell and unique visible local-provider Cell must remain current immediately before selection.")
  }

  @MainActor
  private func hostedCollection(_ owned: LocalFilesJournal, title: String, document: XCUIElement, in app: XCUIApplication) throws -> XCUIElement {
    let expectedProof = title == "On My iPhone" ? "root" : owned.id
    let headerMatches = title == "On My iPhone" ? hasHostedHeader("On My iPhone", document: document)
      : title == owned.folder && hasHostedOwnedFolderHeader(owned, document: document)
    let collection = document.collectionViews.matching(identifier: "File View")
    try demand(provenLocalBrowsers[ObjectIdentifier(app)] == expectedProof
      && hasHostedFilename(owned, in: document) && headerMatches
      && collection.count == 1 && collection.firstMatch.exists,
      "Only the explicitly verified hosted local root or this exact recorded child folder may supply a document collection.")
    return collection.firstMatch
  }

  @MainActor
  private func openHostedOwnedFolder(_ owned: LocalFilesJournal, document: XCUIElement, in app: XCUIApplication) throws {
    let collection = try hostedCollection(owned, title: "On My iPhone", document: document, in: app)
    let byText = collection.cells.containing(.staticText, identifier: owned.folder)
    let byLabel = collection.cells.matching(NSPredicate(format: "label == %@", owned.folder))
    let available = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in byText.count > 0 || byLabel.count > 0 }, object: collection)
    try demand(XCTWaiter.wait(for: [available], timeout: 10) == .completed,
      "The recorded UUID folder must arrive in the current hosted local collection.")
    let folders = byText.count > 0 ? byText : byLabel
    try demand(folders.count == 1 && folders.firstMatch.exists,
      "Exactly the recorded UUID folder created in Files.app must appear under the independently verified hosted local root.")
    _ = try hostedCollection(owned, title: "On My iPhone", document: document, in: app)
    try tap(folders.firstMatch)
    let opened = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      self.hasHostedFilename(owned, in: document) && self.hasHostedOwnedFolderHeader(owned, document: document)
        && document.collectionViews.matching(identifier: "File View").count == 1
    }, object: document)
    try demand(XCTWaiter.wait(for: [opened], timeout: 10) == .completed,
      "Only this recorded immediate child of the proven hosted local root may be adopted.")
    provenLocalBrowsers[ObjectIdentifier(app)] = owned.id
  }

  @MainActor
  private func requireEmptyHostedOwnedFolder(_ owned: LocalFilesJournal, document: XCUIElement, in app: XCUIApplication) throws {
    let collection = try hostedCollection(owned, title: owned.folder, document: document, in: app)
    let roots = document.otherElements.matching(NSPredicate(format: "identifier == %@",
      "DOC.browsingRoot Source: com.apple.FileProvider.LocalStorage, Title: " + owned.folder))
    try demand(roots.count == 1 && roots.firstMatch.exists, "Only the exact recorded LocalStorage child root may supply its empty-state text.")
    let empty = roots.firstMatch.staticTexts.matching(NSPredicate(format: "label == %@", "Folder is Empty"))
    try demand(empty.firstMatch.waitForExistence(timeout: 10) && roots.count == 1 && empty.count == 1 && collection.cells.count == 0,
      "Only the exact empty UUID folder may receive this generated PNG. Extra or unknown items refuse Save.")
  }

  @MainActor
  private func saveHostedOwnedPNG(_ owned: LocalFilesJournal, document: XCUIElement, in app: XCUIApplication) throws {
    try requireEmptyHostedOwnedFolder(owned, document: document, in: app)
    let bars = document.navigationBars.matching(identifier: "FullDocumentManagerViewControllerNavigationBar")
    let save = bars.firstMatch.buttons.matching(NSPredicate(format: "identifier == %@ AND label == %@", "DOCPicker.actionButton", "Save"))
    try demand(bars.count == 1 && save.count == 1 && save.firstMatch.isEnabled && save.firstMatch.isHittable
      && hasHostedFilename(owned, in: document) && hasHostedOwnedFolderHeader(owned, document: document),
      "Only the Native95 observed Save action under this exact owned empty folder and filename may write the PNG.")
    try tap(save.firstMatch)
  }

  @MainActor
  private func verifyFolderAbsent(_ folder: String, in app: XCUIApplication) throws {
    try requireLocalRoot(in: app)
    let search = app.searchFields["Search"].firstMatch
    try demand(search.waitForExistence(timeout: 5), "A local Files search must preflight the exact UUID folder.")
    try tap(search)
    search.typeText(folder)
    try demand(search.value as? String == folder, "The complete UUID folder must be entered before creation.")
    let searchKey = app.keyboards.buttons["Search"].firstMatch
    if searchKey.exists { try tap(searchKey) }
    // Search initially selects Recents on Native32. Local provenance from the
    // preceding browser does not establish this separate search scope.
    provenLocalBrowsers[ObjectIdentifier(app)] = nil
    let local = app.segmentedControls.buttons.matching(NSPredicate(format: "label == %@", "On My iPhone"))
    let recents = app.segmentedControls.buttons.matching(NSPredicate(format: "label == %@", "Recents"))
    try demand(local.count == 1 && recents.count == 1 && search.value as? String == folder
      && local.firstMatch.isEnabled && local.firstMatch.isHittable && app.frame.contains(local.firstMatch.frame)
      && local.firstMatch.frame.minY >= search.frame.maxY && local.firstMatch.frame.minY == recents.firstMatch.frame.minY,
      "Only the observed local search scope below this exact UUID query may be selected.")
    if !local.firstMatch.isSelected { try tap(local.firstMatch) }
    let localSelected = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      local.count == 1 && recents.count == 1 && local.firstMatch.isSelected && !recents.firstMatch.isSelected
        && search.value as? String == folder
    }, object: app)
    try demand(XCTWaiter.wait(for: [localSelected], timeout: 5) == .completed,
      "The exact UUID absence check must use On My iPhone, never Recents or a foreign provider.")
    let noResults = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "No Results")).firstMatch
    try demand(noResults.waitForExistence(timeout: 10), "A preexisting or ambiguous UUID folder refuses creation.")
    try demand(cells(named: folder, alternate: nil, in: app).count == 0 && local.count == 1
      && local.firstMatch.isSelected && search.value as? String == folder,
      "A matching existing folder or changed search scope must never be adopted.")
    let close = app.buttons.matching(NSPredicate(format: "label == %@", "Close"))
    try demand(close.count == 1 && close.firstMatch.isEnabled && close.firstMatch.isHittable
      && app.frame.contains(close.firstMatch.frame) && close.firstMatch.frame.minX >= search.frame.maxX
      && close.firstMatch.frame.minY >= search.frame.minY && close.firstMatch.frame.maxY <= search.frame.maxY + 8
      && search.value as? String == folder && local.firstMatch.isSelected,
      "Only the Native32 observed search-header Close beside the exact owned query may end this search.")
    try tap(close.firstMatch)
    let closed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      !close.firstMatch.exists && !local.firstMatch.exists
    }, object: app)
    try demand(XCTWaiter.wait(for: [closed], timeout: 5) == .completed, "The observed search header and search scope must disappear after Close.")
    // Re-establish provider provenance through explicit Locations selection.
    try selectFilesAppLocalRoot(in: app)
  }

  @MainActor
  private func createFolder(_ owned: LocalFilesJournal, in app: XCUIApplication) throws {
    try requireLocalRoot(in: app)
    let more = app.navigationBars.buttons.matching(NSPredicate(format: "label == %@", "More"))
    try demand(more.count == 1 && more.firstMatch.isEnabled && more.firstMatch.isHittable,
      "Only the observed unique local-root More button may offer the New Folder action.")
    try tap(more.firstMatch)
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.observedLocalMoreCollections(in: app).count == 1 }, object: app)
    try demand(XCTWaiter.wait(for: [ready], timeout: 5) == .completed,
      "Native34 exposes New Folder as a Button inside the known More CollectionView, without a Menu role.")
    try requireLocalRoot(in: app)
    let menus = observedLocalMoreCollections(in: app)
    try demand(menus.count == 1, "Only the unique observed More collection may create the recorded UUID folder.")
    let newFolder = menus[0].buttons.matching(NSPredicate(format: "label == %@", "New Folder"))
    try demand(newFolder.count == 1 && newFolder.firstMatch.images.matching(identifier: "folder.badge.plus").count == 1
      && newFolder.firstMatch.isEnabled && newFolder.firstMatch.isHittable
      && app.frame.contains(newFolder.firstMatch.frame) && menus[0].frame.contains(newFolder.firstMatch.frame),
      "Only the actual visible New Folder Button and its observed folder.badge.plus symbol may open creation.")
    let contents = app.collectionViews.matching(identifier: "File View")
    try demand(contents.count == 1 && contents.firstMatch.cells.count == 0 && app.staticTexts["On My iPhone is Empty"].firstMatch.exists
      && app.textViews.matching(identifier: "DOC.inlineRenameField").count == 0 && app.keyboards.count == 0,
      "The known local root must still be empty before this one action materializes a default folder. Existing contents remain untouched.")
    try tap(newFolder.firstMatch)
    let rows = contents.firstMatch.cells.matching(identifier: "untitled folder, Folder")
    let editors = app.textViews.matching(identifier: "DOC.inlineRenameField")
    let inline = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      contents.count == 1 && contents.firstMatch.cells.count == 1 && rows.count == 1
        && rows.firstMatch.textViews.matching(identifier: "DOC.inlineRenameField").count == 1
        && editors.count == 1 && editors.firstMatch.value as? String == "untitled folder"
        && editors.firstMatch.isEnabled && editors.firstMatch.isHittable && app.frame.contains(editors.firstMatch.frame)
        && app.alerts.count == 0 && self.observedLocalMoreCollections(in: app).isEmpty
    }, object: app)
    try demand(XCTWaiter.wait(for: [inline], timeout: 10) == .completed,
      "Native49 creates one default folder with an inline rename TextView. An unknown or ambiguous new row is retained for recovery.")
    try owned.record(phase: "inline-default-folder-observed")
    let entryDone = app.keyboards.descendants(matching: .any).matching(NSPredicate(format: "identifier == %@ AND label == %@", "Done", "done"))
    try demand(matchesProvenLocalFolderRoot(app) && contents.count == 1 && contents.firstMatch.cells.count == 1
      && rows.count == 1 && rows.firstMatch.textViews.matching(identifier: "DOC.inlineRenameField").count == 1
      && editors.count == 1 && editors.firstMatch.value as? String == "untitled folder" && entryDone.count == 1
      && [.button, .key].contains(entryDone.firstMatch.elementType) && app.keyboards.count == 1
      && observedLocalMoreCollections(in: app).isEmpty,
      "Full default-row/root/editor/value/Done uniqueness is required before measuring the entry target.")
    let entryEditors = editors.allElementsBoundByAccessibilityElement
    let entryRows = rows.allElementsBoundByAccessibilityElement
    try demand(entryEditors.count == 1 && entryRows.count == 1, "Only the verified editor and sole default row may be bound.")
    let name = entryEditors[0], entryRow = entryRows[0]
    let entryFrames = try requireSettledFolderControls(in: app, stage: "before-inline-UUID-entry",
      observedFrames: { [entryRow.frame] }) {
      guard app.state == .runningForeground && name.exists && name.identifier == "DOC.inlineRenameField",
        name.value as? String == "untitled folder", entryRow.exists && entryRow.identifier == "untitled folder, Folder" else { return nil }
      return [name]
    }
    try demand(entryFrames.count == 2 && matchesProvenLocalFolderRoot(app) && contents.count == 1
      && contents.firstMatch.cells.count == 1 && rows.count == 1
      && rows.firstMatch.textViews.matching(identifier: "DOC.inlineRenameField").count == 1
      && editors.count == 1 && editors.firstMatch.value as? String == "untitled folder" && entryDone.count == 1
      && [.button, .key].contains(entryDone.firstMatch.elementType) && app.keyboards.count == 1
      && observedLocalMoreCollections(in: app).isEmpty && name.exists && entryRow.exists
      && name.frame == entryFrames[0] && editors.firstMatch.frame == entryFrames[0]
      && entryRow.frame == entryFrames[1] && rows.firstMatch.frame == entryFrames[1],
      "Immediate full ownership, value, uniqueness and unchanged bound geometry must follow entry measurement before typing.")
    try tap(name)
    name.typeKey("a", modifierFlags: .command)
    name.typeText(XCUIKeyboardKey.delete.rawValue)
    name.typeText(owned.folder)
    try demand(editors.count == 1 && name.value as? String == owned.folder, "The inline folder name must exactly match its recovery record before commit.")
    try owned.record(phase: "inline-UUID-name-entered")
    // Native70 exposes the same Done ID/label as a modern Key. Resolve its current role only after typing.
    let done = app.keyboards.descendants(matching: .any).matching(NSPredicate(format: "identifier == %@ AND label == %@", "Done", "done"))
    try demand(matchesProvenLocalFolderRoot(app) && contents.count == 1 && contents.firstMatch.cells.count == 1
      && contents.firstMatch.cells.firstMatch.textViews.matching(identifier: "DOC.inlineRenameField").count == 1
      && editors.count == 1 && editors.firstMatch.value as? String == owned.folder && done.count == 1 && app.keyboards.count == 1
      && [.button, .key].contains(done.firstMatch.elementType)
      && observedLocalMoreCollections(in: app).isEmpty,
      "Full root/sole-row/editor/exact UUID value/Done uniqueness must hold before commit measurement.")
    let commitEditors = editors.allElementsBoundByAccessibilityElement
    let commitRows = contents.firstMatch.cells.allElementsBoundByAccessibilityElement
    try demand(done.count == 1 && commitEditors.count == 1 && commitRows.count == 1,
      "Only the verified Done, current exact-value editor and sole row may bind commit.")
    // Native75 showed that identity binding retains legacy Button metadata for the dynamic keyboard Key.
    let commit = done.element(boundBy: 0), commitEditor = commitEditors[0], commitRow = commitRows[0]
    let doneFrames = try requireSettledFolderControls(in: app, stage: "before-inline-UUID-Done",
      observedFrames: { [commitRow.frame, commitEditor.frame] }) {
      guard app.state == .runningForeground && commitEditor.exists && commitEditor.identifier == "DOC.inlineRenameField",
        commitEditor.value as? String == owned.folder && commitRow.exists else { return nil }
      return [commit]
    }
    try demand(doneFrames.count == 3 && matchesProvenLocalFolderRoot(app) && contents.count == 1
      && contents.firstMatch.cells.count == 1
      && contents.firstMatch.cells.firstMatch.textViews.matching(identifier: "DOC.inlineRenameField").count == 1
      && editors.count == 1 && editors.firstMatch.value as? String == owned.folder && done.count == 1 && app.keyboards.count == 1
      && [.button, .key].contains(done.firstMatch.elementType)
      && observedLocalMoreCollections(in: app).isEmpty && commit.exists && commitEditor.exists && commitRow.exists
      && [.button, .key].contains(commit.elementType) && commit.identifier == "Done" && commit.label == "done" && commit.frame == doneFrames[0]
      && done.firstMatch.frame == doneFrames[0] && commitRow.frame == doneFrames[1]
      && contents.firstMatch.cells.firstMatch.frame == doneFrames[1]
      && commitEditor.frame == doneFrames[2] && editors.firstMatch.frame == doneFrames[2],
      "Immediate full ownership, exact typed UUID, uniqueness and unchanged observed geometry must follow Done measurement.")
    try tap(commit)
    let committed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      self.matchesOwnedRootFolder(owned, in: app)
    }, object: app)
    try demand(XCTWaiter.wait(for: [committed], timeout: 10) == .completed,
      "The committed row must expose the exact recorded name-plus-Folder identifier in the same sole-cell local root, with no editor or keyboard. Its composite label is not a selector.")
    try owned.record(phase: "inline-folder-name-committed")
    try openOwnedFolder(owned, in: app)
    try requireEmptyOwnedFolder(owned, in: app)
  }

  @MainActor
  private func openOwnedFolder(_ owned: LocalFilesJournal, in app: XCUIApplication) throws {
    try requireLocalRoot(in: app)
    let row = try exactOwnedRootFolder(owned, in: app)
    try tap(row)
    provenLocalBrowsers[ObjectIdentifier(app)] = owned.id
    try requireOwnedFolder(owned, in: app)
  }

  @MainActor
  private func matchesProvenLocalFolderRoot(_ app: XCUIApplication) -> Bool {
    provenLocalBrowsers[ObjectIdentifier(app)] == "root" && app.state == .runningForeground
      && app.otherElements.matching(identifier: "DOC.browsingRoot Source: com.apple.FileProvider.LocalStorage, Title: On My iPhone").count == 1
      && hasFilesHeader("On My iPhone", in: app) && app.alerts.count == 0
  }

  @MainActor
  private func matchesOwnedRootFolder(_ owned: LocalFilesJournal, in app: XCUIApplication) -> Bool {
    let contents = app.collectionViews.matching(identifier: "File View")
    let rows = contents.firstMatch.cells.matching(identifier: owned.folder + ", Folder")
    return matchesProvenLocalFolderRoot(app) && contents.count == 1 && contents.firstMatch.cells.count == 1
      && rows.count == 1 && rows.firstMatch.exists && finiteContainedFolderFrame(rows.firstMatch.frame, in: app)
      && app.textViews.matching(identifier: "DOC.inlineRenameField").count == 0 && app.keyboards.count == 0
  }

  @MainActor
  private func exactOwnedRootFolder(_ owned: LocalFilesJournal, in app: XCUIApplication) throws -> XCUIElement {
    try requireLocalRoot(in: app)
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.matchesOwnedRootFolder(owned, in: app) }, object: app)
    try demand(XCTWaiter.wait(for: [ready], timeout: 10) == .completed,
      "Only the recorded UUID name-plus-Folder identifier in the sole local-root cell may be opened or removed. Composite labels are not matched.")
    let row = app.collectionViews.matching(identifier: "File View").firstMatch.cells.matching(identifier: owned.folder + ", Folder")
    try demand(matchesOwnedRootFolder(owned, in: app) && row.count == 1 && row.firstMatch.isEnabled && row.firstMatch.isHittable,
      "The exact canonical owned folder row must remain enabled and hittable.")
    return row.firstMatch
  }

  private var observedFolderContextLabels: [String] { ["Copy", "Move", "Share", "Get Info", "Rename", "Compress", "Duplicate", "Favorite", "Delete"] }

  @MainActor
  private func observedFolderContextCollections(in app: XCUIApplication) -> [XCUIElement] {
    let collections = app.collectionViews.allElementsBoundByAccessibilityElement
    guard collections.count <= 6 else { return [] }
    return collections.filter { collection in
      guard collection.buttons.count >= 9, collection.buttons.count <= 16 else { return false }
      let cells = collection.cells.allElementsBoundByAccessibilityElement
      guard !cells.isEmpty, cells.count <= 16 else { return false }
      return observedFolderContextLabels.allSatisfy { label in
        let buttons = collection.buttons.matching(NSPredicate(format: "label == %@", label))
        return buttons.count == 1 && buttons.firstMatch.exists && buttons.firstMatch.identifier.isEmpty
          && cells.filter { $0.buttons.matching(NSPredicate(format: "label == %@", label)).count == 1 }.count == 1
      }
    }
  }

  @MainActor
  private func deleteOwnedEmptyFolder(_ owned: LocalFilesJournal, in app: XCUIApplication) throws {
    // The caller has just reopened this exact UUID folder and proved No Items before returning to the root.
    let row = try exactOwnedRootFolder(owned, in: app)
    try demand(app.menus.count == 0 && app.sheets.count == 0
      && app.buttons.matching(NSPredicate(format: "label IN %@", observedFolderContextLabels)).count == 0,
      "An existing unknown context is refused before the owned empty folder's one long-press.")
    try requireSettledFolderControls(in: app, stage: "before-empty-UUID-folder-context") {
      guard self.matchesOwnedRootFolder(owned, in: app), app.menus.count == 0, app.sheets.count == 0,
        app.buttons.matching(NSPredicate(format: "label IN %@", self.observedFolderContextLabels)).count == 0 else { return nil }
      return [row]
    }
    try demand(matchesOwnedRootFolder(owned, in: app), "The same canonical UUID row must remain current before long-press.")
    row.press(forDuration: 1)
    let deleteSignal = app.buttons.matching(NSPredicate(format: "label == %@", "Delete"))
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      deleteSignal.count == 1 && deleteSignal.firstMatch.exists
    }, object: app)
    try demand(XCTWaiter.wait(for: [ready], timeout: 5) == .completed,
      "The own-row long-press must present a Delete signal. This does not authorize an action before full folder-context validation.")
    let verifiedContexts = observedFolderContextCollections(in: app)
    try demand(matchesOwnedRootFolder(owned, in: app) && verifiedContexts.count == 1
      && app.buttons.matching(NSPredicate(format: "label == %@", "Delete")).count == 1,
      "Only the actual55 nine-known-command folder context and same sole owned UUID row may authorize Delete.")
    let pinnedDeletes = verifiedContexts[0].buttons.matching(NSPredicate(format: "label == %@", "Delete")).allElementsBoundByAccessibilityElement
    let pinnedRows = app.collectionViews.matching(identifier: "File View").firstMatch.cells.matching(identifier: owned.folder + ", Folder").allElementsBoundByAccessibilityElement
    try demand(pinnedDeletes.count == 1 && pinnedRows.count == 1,
      "The fully verified Delete and UUID row must each have a unique accessibility binding.")
    let pinnedDelete = pinnedDeletes[0], pinnedRow = pinnedRows[0]
    let measured = try requireSettledFolderControls(in: app, stage: "before-empty-UUID-folder-Delete",
      observedFrames: { [pinnedRow.frame] }) {
      guard app.state == .runningForeground && pinnedRow.exists && pinnedRow.isEnabled,
        pinnedRow.identifier == owned.folder + ", Folder" else { return nil }
      return [pinnedDelete]
    }
    try demand(measured.count == 2, "The stable Delete and UUID-row frames must both be retained.")
    let contexts = observedFolderContextCollections(in: app)
    try demand(matchesOwnedRootFolder(owned, in: app) && contexts.count == 1
      && app.buttons.matching(NSPredicate(format: "label == %@", "Delete")).count == 1,
      "Full same-folder/context verification must immediately follow the bounded geometry poll.")
    let remove = contexts[0].buttons.matching(NSPredicate(format: "label == %@", "Delete"))
    try demand(remove.count == 1 && remove.firstMatch.identifier.isEmpty && pinnedDelete.exists && pinnedRow.exists
      && pinnedDelete.frame == measured[0] && pinnedRow.frame == measured[1] && remove.firstMatch.frame == measured[0]
      && finiteContainedFolderFrame(remove.firstMatch.frame, in: app),
      "Only the same settled fully visible Delete and unchanged UUID row within the verified semantic folder context may be used.")
    let contextFrame = contexts[0].frame, appFrame = app.frame
    let components = [contextFrame.minX, contextFrame.minY, contextFrame.width, contextFrame.height]
    let finite = components.allSatisfy(\.isFinite)
    let geometry = try JSONSerialization.data(withJSONObject: [
      "contextFrameFinite": finite, "contextFrame": finite ? components : [],
      "appFrame": [appFrame.minX, appFrame.minY, appFrame.width, appFrame.height],
      "verifiedDeleteFrame": [measured[0].minX, measured[0].minY, measured[0].width, measured[0].height],
      "verifiedOwnedRowFrame": [measured[1].minX, measured[1].minY, measured[1].width, measured[1].height],
      "contextFullyInsideApp": finite && appFrame.contains(contextFrame),
      "contextContainsDelete": finite && contextFrame.contains(measured[0]),
      "ancestorGeometryIsDiagnosticOnly": true, "deleteFullyInsideAppRequired": true,
      "semanticContextAndOwnershipRevalidated": true], options: [.sortedKeys])
    let note = XCTAttachment(data: geometry, uniformTypeIdentifier: "public.json")
    note.name = "local-files-verified-UUID-folder-Delete-geometry"; note.lifetime = .keepAlways; add(note)
    try tap(remove.firstMatch)
    let outcome = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      self.emptyProvenLocalFolderRoot(app) || app.alerts.count > 0 || app.sheets.count > 0
    }, object: app)
    try demand(XCTWaiter.wait(for: [outcome], timeout: 10) == .completed,
      "Folder deletion must reach its empty original root or an exact-name confirmation. Unknown state retains the journal.")
    if !emptyProvenLocalFolderRoot(app) {
      try demand(exactFolderDeleteConfirmation(owned, in: app), "An optional folder confirmation must show only its exact UUID name with Delete and Cancel.")
      try requireSettledFolderControls(in: app, stage: "before-exact-UUID-folder-confirmation") {
        guard self.exactFolderDeleteConfirmation(owned, in: app) else { return nil }
        return [app.alerts.firstMatch.buttons.matching(NSPredicate(format: "label == %@", "Delete")).firstMatch]
      }
      try demand(exactFolderDeleteConfirmation(owned, in: app), "The same exact UUID-name confirmation must remain current.")
      try tap(app.alerts.firstMatch.buttons.matching(NSPredicate(format: "label == %@", "Delete")).firstMatch)
    }
    let removed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.emptyProvenLocalFolderRoot(app) }, object: app)
    try demand(XCTWaiter.wait(for: [removed], timeout: 15) == .completed,
      "The original explicit local root must contain zero cells after deleting only the proved empty UUID folder.")
  }

  @MainActor
  private func exactFolderDeleteConfirmation(_ owned: LocalFilesJournal, in app: XCUIApplication) -> Bool {
    guard app.state == .runningForeground && app.alerts.count == 1 && app.sheets.count == 0 else { return false }
    let alert = app.alerts.firstMatch
    return alert.staticTexts.matching(NSPredicate(format: "label == %@", owned.folder)).count == 1
      && alert.buttons.count == 2 && alert.buttons.matching(NSPredicate(format: "label == %@", "Cancel")).count == 1
      && alert.buttons.matching(NSPredicate(format: "label == %@", "Delete")).count == 1
  }

  @MainActor
  private func emptyProvenLocalFolderRoot(_ app: XCUIApplication) -> Bool {
    let contents = app.collectionViews.matching(identifier: "File View")
    return matchesProvenLocalFolderRoot(app) && contents.count == 1 && contents.firstMatch.cells.count == 0
      && app.staticTexts.matching(identifier: "On My iPhone is Empty").count == 1
      && app.menus.count == 0 && app.sheets.count == 0 && app.keyboards.count == 0
      && app.buttons.matching(NSPredicate(format: "label IN %@", observedFolderContextLabels)).count == 0
  }

  @MainActor
  private func finiteContainedFolderFrame(_ frame: CGRect, in app: XCUIApplication) -> Bool {
    let window = app.frame
    return [window, frame].allSatisfy {
      [$0.minX, $0.minY, $0.width, $0.height].allSatisfy(\.isFinite) && $0.width > 0 && $0.height > 0
    } && window.contains(frame)
  }

  @MainActor
  @discardableResult
  private func requireSettledFolderControls(in app: XCUIApplication, stage: String,
    observedFrames: @escaping () -> [CGRect] = { [] }, elements: @escaping () -> [XCUIElement]?) throws -> [CGRect] {
    var frames: [CGRect] = [], since: TimeInterval?, samples = 0, observations = 0
    var lastBindingsMatched = false, lastContained = false
    var lastFlags: [[String: Bool]] = [], lastFiniteFrames: [CGRect] = [], lastFiniteAppFrame: [CGFloat] = []
    let began = ProcessInfo.processInfo.systemUptime
    let predicate = NSPredicate { _, _ in
      observations += 1
      guard let targets = elements(), !targets.isEmpty, targets.count <= 3 else {
        frames = []; since = nil; samples = 0; lastBindingsMatched = false; lastContained = false; lastFlags = []; lastFiniteFrames = []; lastFiniteAppFrame = []
        return false
      }
      lastBindingsMatched = true
      let observed = observedFrames()
      guard observed.count <= 3 else { frames = []; since = nil; samples = 0; lastContained = false; lastFlags = []; lastFiniteFrames = []; return false }
      let current = targets.map(\.frame) + observed, appFrame = app.frame
      let finite = ([appFrame] + current).allSatisfy {
        [$0.minX, $0.minY, $0.width, $0.height].allSatisfy(\.isFinite) && $0.width > 0 && $0.height > 0
      }
      lastFiniteFrames = finite ? current : []
      lastFiniteAppFrame = finite ? [appFrame.minX, appFrame.minY, appFrame.width, appFrame.height] : []
      lastContained = finite && current.allSatisfy({ appFrame.contains($0) })
      lastFlags = targets.map { ["exists": $0.exists, "enabled": $0.isEnabled, "hittable": $0.isHittable] }
      guard lastContained, lastFlags.allSatisfy({ $0["exists"] == true && $0["enabled"] == true && $0["hittable"] == true }) else {
        frames = []; since = nil; samples = 0; return false
      }
      let now = ProcessInfo.processInfo.systemUptime
      if frames == current { samples += 1 } else { frames = current; since = now; samples = 1 }
      return samples >= 3 && now - (since ?? now) >= 0.2
    }
    let ready = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: predicate, object: app)], timeout: 5) == .completed
    var values: [String: Any] = ["stage": stage, "settled": ready, "sameGeometrySamples": samples,
      "finiteContainedFrames": frames.map { [$0.minX, $0.minY, $0.width, $0.height] },
      "observations": observations, "elapsedMilliseconds": (ProcessInfo.processInfo.systemUptime - began) * 1000]
    if !ready && ["before-inline-UUID-entry", "before-inline-UUID-Done"].contains(stage) {
      values["lastPinnedBindingsMatched"] = lastBindingsMatched
      values["lastAllFramesContained"] = lastContained
      values["lastActionTargetFlags"] = lastFlags
      values["lastFinitePinnedFrames"] = lastFiniteFrames.map { [$0.minX, $0.minY, $0.width, $0.height] }
      values["lastFiniteAppFrame"] = lastFiniteAppFrame
      values["observationalFramesAreNotHitTargets"] = true
    }
    let data = try JSONSerialization.data(withJSONObject: values, options: [.sortedKeys])
    let note = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
    note.name = "local-files-folder-settled-" + stage; note.lifetime = .keepAlways; add(note)
    try demand(ready, "The exact action target must be enabled/hittable and all pinned geometry must settle inside the app before interaction.")
    return frames
  }

  @MainActor
  private func hasOwnedFolderHeader(_ owned: LocalFilesJournal, in app: XCUIApplication) -> Bool {
    let roots = app.otherElements.matching(NSPredicate(format: "identifier == %@", "DOC.browsingRoot Source: com.apple.FileProvider.LocalStorage, Title: " + owned.folder))
    let bars = app.navigationBars.matching(identifier: "FullDocumentManagerViewControllerNavigationBar")
    let title = bars.firstMatch.buttons.matching(NSPredicate(format: "label == %@", owned.folder + ", Actions Menu"))
    return app.state == .runningForeground && roots.count == 1 && bars.count == 1
      && title.count == 1 && title.firstMatch.exists && finiteContainedFolderFrame(title.firstMatch.frame, in: app)
      && app.alerts.count == 0
  }

  @MainActor
  private func requireOwnedFolder(_ owned: LocalFilesJournal, in app: XCUIApplication) throws {
    try demand(provenLocalBrowsers[ObjectIdentifier(app)] == owned.id,
      "The exact owned folder must have been entered from its proven immediate-child root row.")
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.hasOwnedFolderHeader(owned, in: app) }, object: app)
    try demand(XCTWaiter.wait(for: [ready], timeout: 10) == .completed,
      "The recorded UUID folder must retain its exact local-provider root and observed Actions Menu title Button.")
  }

  @MainActor
  private func requireEmptyOwnedFolder(_ owned: LocalFilesJournal, in app: XCUIApplication) throws {
    try requireOwnedFolder(owned, in: app)
    let contents = app.collectionViews.matching(identifier: "File View")
    let empty = app.staticTexts.matching(NSPredicate(format: "label == %@", "Folder is Empty"))
    try demand(empty.firstMatch.waitForExistence(timeout: 10) && empty.count == 1
      && contents.count == 1 && contents.firstMatch.cells.count == 0,
      "Only the recorded empty UUID folder may be used or removed. Unexpected items are retained.")
  }

  @MainActor
  private func returnToLocalRoot(from owned: LocalFilesJournal, in app: XCUIApplication) throws {
    try requireOwnedFolder(owned, in: app)
    // History Back can cross tabs. Re-establish the explicit provider instead.
    try selectFilesAppLocalRoot(in: app)
  }


  @MainActor
  private func inspectAndDismissOwnedPreview(_ owned: LocalFilesJournal) throws {
    let preview = XCUIApplication(bundleIdentifier: "com.apple.Preview")
    try demand(preview.wait(for: .runningForeground, timeout: 15), "The exact saved PNG must hand off to the observed iOS Preview app.")
    let bars = preview.navigationBars.matching(NSPredicate(format: "identifier == %@", owned.basename))
    let title = bars.firstMatch.buttons.matching(NSPredicate(format: "label == %@", owned.basename + ", Actions Menu"))
    let backs = bars.firstMatch.buttons.matching(NSPredicate(format: "label == %@", "Back"))
    func fullImages() -> [XCUIElement] {
      preview.images.allElementsBoundByAccessibilityElement.filter { image in
        image.exists && image.frame.width >= 100 && image.frame.height >= 50 && self.finiteContainedFolderFrame(image.frame, in: preview)
      }
    }
    func ownedPreview() -> Bool {
      preview.state == .runningForeground && bars.count == 1 && bars.firstMatch.exists
        && self.finiteContainedFolderFrame(bars.firstMatch.frame, in: preview)
        && title.count == 1 && title.firstMatch.exists && self.finiteContainedFolderFrame(title.firstMatch.frame, in: preview)
        && backs.count == 1 && backs.firstMatch.exists && backs.firstMatch.isEnabled && backs.firstMatch.isHittable
        && self.finiteContainedFolderFrame(backs.firstMatch.frame, in: preview) && fullImages().count == 1
    }
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in ownedPreview() }, object: preview)
    try demand(XCTWaiter.wait(for: [ready], timeout: 10) == .completed,
      "The actual Preview must identify this exact basename, its Actions Menu, one full contained image and one scoped Back.")
    let back = backs.allElementsBoundByAccessibilityElement[0], image = fullImages()[0]
    let frames = try requireSettledFolderControls(in: preview, stage: "before-owned-PNG-Preview-Back",
      observedFrames: { [title.firstMatch.frame, image.frame] }) {
      guard ownedPreview() else { return nil }
      return [back]
    }
    try demand(ownedPreview() && frames.count == 3 && back.exists && back.frame == frames[0]
      && title.firstMatch.frame == frames[1] && image.exists && image.frame == frames[2],
      "The exact Preview document, image and same Back geometry must remain current before its one normal Back action.")
    attach("local-files-saved-own-PNG-native-preview", app: preview)
    try owned.record(phase: "native-preview-observed")
    try demand(ownedPreview() && back.frame == frames[0], "Only this same owned Preview Back may dismiss the document.")
    try tap(back)
    let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      bars.count == 0 && title.count == 0
    }, object: preview)
    try demand(XCTWaiter.wait(for: [dismissed], timeout: 10) == .completed,
      "The same owned Preview document must disappear before returning through Files' explicit provider.")
  }

  @MainActor
  private func onlyOwnedFile(_ owned: LocalFilesJournal, in app: XCUIApplication) throws -> XCUIElement {
    try requireOwnedFolder(owned, in: app)
    let entry = try exactCell(owned.filename, alternate: owned.basename, in: app)
    try demand(app.collectionViews.cells.count == 1, "The owned folder must contain only its one recorded PNG. Extra items refuse cleanup.")
    return entry
  }

  @MainActor
  private func cells(named name: String, alternate: String?, in app: XCUIApplication) -> XCUIElementQuery {
    let predicate = alternate.map { NSPredicate(format: "label == %@ OR label == %@", name, $0) }
      ?? NSPredicate(format: "label == %@", name)
    return app.collectionViews.cells.containing(.staticText, identifier: name).count > 0
      ? app.collectionViews.cells.containing(.staticText, identifier: name)
      : app.collectionViews.cells.matching(predicate)
  }

  @MainActor
  private func exactCell(_ name: String, alternate: String?, in app: XCUIApplication) throws -> XCUIElement {
    var query = cells(named: name, alternate: alternate, in: app)
    if query.count == 0, let alternate { query = cells(named: alternate, alternate: nil, in: app) }
    try demand(query.firstMatch.waitForExistence(timeout: 10) && query.count == 1,
      "Exactly one native Files row must identify the recorded name: \(name).")
    return query.firstMatch
  }

  private var observedFileContextLabels: [String] {
    ["Copy", "Move", "Share", "Quick Look", "Open With", "Get Info", "Rename", "Compress", "Duplicate", "New Folder with Item", "Tags…", "Quick Actions", "Delete"]
  }

  private var observedScrolledFileContextLabels: [String] {
    ["Quick Look", "Open With", "Get Info", "Rename", "Compress", "Duplicate", "New Folder with Item", "Tags…", "Quick Actions", "Delete"]
  }

  @MainActor
  private func observedFileContextCollections(in app: XCUIApplication) -> [XCUIElement] {
    let collections = app.collectionViews.allElementsBoundByAccessibilityElement
    guard collections.count <= 6 else { return [] }
    return collections.filter { collection in
      let commandCount = collection.buttons.count
      guard collection.identifier.isEmpty && (commandCount == 13 || commandCount == 10) else { return false }
      let cells = collection.cells.allElementsBoundByAccessibilityElement
      guard cells.count == commandCount else { return false }
      var labels: [String] = []
      for cell in cells {
        let buttons = cell.buttons.allElementsBoundByAccessibilityElement
        guard buttons.count == 1 && buttons[0].exists && buttons[0].identifier.isEmpty else { return false }
        labels.append(buttons[0].label)
      }
      return (commandCount == 13 && Set(labels) == Set(observedFileContextLabels))
        || (commandCount == 10 && Set(labels) == Set(observedScrolledFileContextLabels))
    }
  }

  @MainActor
  private func matchesOwnedPNGFolder(_ owned: LocalFilesJournal, in app: XCUIApplication) -> Bool {
    let views = app.collectionViews.matching(identifier: "File View")
    let rows = views.firstMatch.cells.matching(NSPredicate(format: "identifier == %@", owned.basename + ", png"))
    return provenLocalBrowsers[ObjectIdentifier(app)] == owned.id && hasOwnedFolderHeader(owned, in: app)
      && views.count == 1 && views.firstMatch.cells.count == 1 && rows.count == 1 && rows.firstMatch.exists
      && rows.firstMatch.isEnabled && finiteContainedFolderFrame(rows.firstMatch.frame, in: app)
      && rows.firstMatch.staticTexts.matching(NSPredicate(format: "label == %@", owned.basename)).count == 1
      && app.alerts.count == 0 && app.sheets.count == 0
  }

  @MainActor
  private func deleteOwnedEntry(_ owned: LocalFilesJournal, in app: XCUIApplication) throws {
    _ = try onlyOwnedFile(owned, in: app)
    let rows = app.collectionViews.matching(identifier: "File View").firstMatch.cells
      .matching(NSPredicate(format: "identifier == %@", owned.basename + ", png"))
    try demand(matchesOwnedPNGFolder(owned, in: app) && app.menus.count == 0 && observedFileContextCollections(in: app).isEmpty,
      "Only the same sole canonical owned PNG without a presented context may receive its one long-press.")
    let row = rows.allElementsBoundByAccessibilityElement[0]
    let frames = try requireSettledFolderControls(in: app, stage: "before-owned-PNG-context") {
      guard app.state == .runningForeground && row.exists && row.isEnabled
        && row.identifier == owned.basename + ", png" else { return nil }
      return [row]
    }
    try demand(frames.count == 1 && matchesOwnedPNGFolder(owned, in: app) && row.exists && row.frame == frames[0]
      && app.menus.count == 0 && observedFileContextCollections(in: app).isEmpty,
      "The exact same owned PNG row and settled geometry must remain current immediately before long-press.")
    row.press(forDuration: 1)
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      let signal = app.buttons.matching(NSPredicate(format: "label == %@", "Delete"))
      return signal.count == 1 && signal.firstMatch.exists
    }, object: app)
    try demand(XCTWaiter.wait(for: [ready], timeout: 5) == .completed,
      "The actual complete or scrolled file context must appear for this same sole PNG. Unknown contexts are retained.")
    try deleteFromObservedOwnedFileContext(owned, in: app)
  }

  @MainActor
  private func attachOwnedFileContextRefusal(_ owned: LocalFilesJournal, in app: XCUIApplication, stage: String,
    decisions: [String: Bool], frames: [String: CGRect] = [:]) throws {
    var recordCurrent = false
    do { try owned.requireCurrentRecord(); recordCurrent = true } catch { }
    func geometry(_ frame: CGRect) -> [CGFloat] {
      [frame.minX, frame.minY, frame.width, frame.height].allSatisfy(\.isFinite)
        ? [frame.minX, frame.minY, frame.width, frame.height] : []
    }
    var values: [String: Any] = ["fixture": "owned-PNG-context-refusal", "stage": stage, "readOnly": true,
      "recordCurrent": recordCurrent, "foreground": app.state == .runningForeground, "guardDecisions": decisions,
      "capturedFrames": frames.mapValues(geometry), "sequentialObservations": true,
      "limits": "Fixed public command counts and own canonical PNG geometry only. No raw labels, identifiers, file contents, tree, screenshot, extra action or guard change."]
    if recordCurrent && app.state == .runningForeground {
      values["browserProofMatches"] = provenLocalBrowsers[ObjectIdentifier(app)] == owned.id
      values["exactOwnedFolderHeader"] = hasOwnedFolderHeader(owned, in: app)
      values["menus"] = app.menus.count; values["sheets"] = app.sheets.count; values["alerts"] = app.alerts.count
      let views = app.collectionViews.matching(identifier: "File View")
      let ownRows = views.firstMatch.cells.matching(NSPredicate(format: "identifier == %@", owned.basename + ", png"))
      values["fileViewCount"] = views.count
      values["cellsInUniqueFileView"] = views.count == 1 ? views.firstMatch.cells.count : -1
      values["ownCanonicalPNGCount"] = ownRows.count
      if ownRows.count == 1 && ownRows.firstMatch.exists {
        let row = ownRows.firstMatch
        values["ownPNG"] = ["role": row.elementType.rawValue, "frame": geometry(row.frame),
          "enabled": row.isEnabled, "hittable": row.isHittable,
          "exactBasenameTextCount": row.staticTexts.matching(NSPredicate(format: "label == %@", owned.basename)).count]
      }
      let collections = app.collectionViews.allElementsBoundByAccessibilityElement
      values["collectionCount"] = collections.count; values["collectionsOmitted"] = collections.count > 6
      if collections.count <= 6 {
        values["collections"] = collections.map { collection -> [String: Any] in
          let cells = collection.cells.allElementsBoundByAccessibilityElement
          var commands: [[String: Any]] = []
          for label in observedFileContextLabels {
            let buttons = collection.buttons.matching(NSPredicate(format: "label == %@", label))
            let anyRole = collection.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label))
            var row: [String: Any] = ["knownCommand": label, "buttonCount": buttons.count, "anyRoleCount": anyRole.count]
            if buttons.count == 1 && buttons.firstMatch.exists {
              let button = buttons.firstMatch
              row["button"] = ["role": button.elementType.rawValue, "frame": geometry(button.frame),
                "enabled": button.isEnabled, "hittable": button.isHittable, "identifierEmpty": button.identifier.isEmpty]
            }
            commands.append(row)
          }
          return ["frame": geometry(collection.frame), "exists": collection.exists, "enabled": collection.isEnabled,
            "hittable": collection.isHittable, "isFileView": collection.identifier == "File View", "identifierEmpty": collection.identifier.isEmpty,
            "cellCount": cells.count, "buttonCount": collection.buttons.count,
            "buttonsPerCell": cells.count <= 16 ? cells.map { $0.buttons.count } : [], "commands": commands]
        }
      }
    }
    let data = try JSONSerialization.data(withJSONObject: values, options: [.sortedKeys])
    try demand(data.count <= 32768, "Owned current-context refusal metadata must remain bounded.")
    let note = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
    note.name = "owned-PNG-context-refusal-" + stage; note.lifetime = .keepAlways; add(note)
  }

  @MainActor
  private func revealOwnedFileContextDelete(_ owned: LocalFilesJournal, in app: XCUIApplication) throws {
    for attempt in 0...4 {
      try owned.requireCurrentRecord()
      let contexts = observedFileContextCollections(in: app)
      try demand(matchesOwnedPNGFolder(owned, in: app) && contexts.count == 1 && app.menus.count == 0
        && app.buttons.matching(NSPredicate(format: "label == %@", "Delete")).count == 1,
        "Only the unchanged owned PNG and actual complete or scrolled file context may reveal its Delete control.")
      let context = contexts[0]
      let remove = context.buttons.matching(NSPredicate(format: "label == %@", "Delete")).firstMatch
      if remove.exists && remove.isEnabled && remove.isHittable && finiteContainedFolderFrame(remove.frame, in: app) { return }
      try demand(attempt < 4 && context.exists && context.isEnabled && context.isHittable
        && finiteContainedFolderFrame(context.frame.intersection(app.frame), in: app)
        && context.frame.intersection(app.frame).height > 100,
        "Delete must become truly hittable within four ordinary swipes of this same visible context; AX screen bounds alone do not prove popup visibility.")
      let row = app.collectionViews.matching(identifier: "File View").firstMatch.cells
        .matching(NSPredicate(format: "identifier == %@", owned.basename + ", png")).firstMatch
      let rowFrame = row.frame, contextFrame = context.frame
      context.swipeUp(velocity: .slow)
      try owned.requireCurrentRecord()
      let after = observedFileContextCollections(in: app)
      let ownPNGMatches = matchesOwnedPNGFolder(owned, in: app), oneContext = after.count == 1
      let pinnedContextExists = context.exists, pinnedRowExists = row.exists, noMenus = app.menus.count == 0
      let pinnedContextFrame = pinnedContextExists ? context.frame : nil, freshContextFrame = oneContext ? after[0].frame : nil
      let currentRowFrame = pinnedRowExists ? row.frame : nil
      let sameContextFrame = oneContext && pinnedContextExists && freshContextFrame == pinnedContextFrame
      let sameRowFrame = pinnedRowExists && currentRowFrame == rowFrame
      let unchanged = ownPNGMatches && oneContext && pinnedContextExists && sameContextFrame && pinnedRowExists && sameRowFrame && noMenus
      if !unchanged {
        var observedFrames = ["contextBeforeSwipe": contextFrame, "rowBeforeSwipe": rowFrame]
        if let pinnedContextFrame { observedFrames["pinnedContextAfterSwipe"] = pinnedContextFrame }
        if let freshContextFrame { observedFrames["freshContextAfterSwipe"] = freshContextFrame }
        if let currentRowFrame { observedFrames["pinnedRowAfterSwipe"] = currentRowFrame }
        try attachOwnedFileContextRefusal(owned, in: app, stage: "after-swipe-\(attempt + 1)",
          decisions: ["preGuardPassed": true, "recordAfterSwipeVerified": true, "ownPNGMatches": ownPNGMatches,
            "exactlyOneStrictContext": oneContext, "pinnedContextExists": pinnedContextExists, "sameContextFrame": sameContextFrame,
            "pinnedRowExists": pinnedRowExists, "sameRowFrame": sameRowFrame, "noMenus": noMenus, "unchanged": unchanged], frames: observedFrames)
      }
      try demand(unchanged,
        "The same context, current record and exact unchanged underlay PNG must survive each scoped menu swipe. Unknown changes refuse Delete.")
    }
  }

  @MainActor
  private func deleteFromObservedOwnedFileContext(_ owned: LocalFilesJournal, in app: XCUIApplication) throws {
    try revealOwnedFileContextDelete(owned, in: app)
    var contexts = observedFileContextCollections(in: app)
    try demand(matchesOwnedPNGFolder(owned, in: app) && contexts.count == 1 && app.menus.count == 0
      && app.buttons.matching(NSPredicate(format: "label == %@", "Delete")).count == 1,
      "Only the actual complete or scrolled file context and exact sole canonical PNG in its recorded folder may authorize Delete.")
    let deletes = contexts[0].buttons.matching(NSPredicate(format: "label == %@", "Delete")).allElementsBoundByAccessibilityElement
    let rows = app.collectionViews.matching(identifier: "File View").firstMatch.cells
      .matching(NSPredicate(format: "identifier == %@", owned.basename + ", png")).allElementsBoundByAccessibilityElement
    try demand(deletes.count == 1 && rows.count == 1, "The actual Delete and canonical owned PNG row must have unique accessibility bindings.")
    let remove = deletes[0], row = rows[0]
    let frames = try requireSettledFolderControls(in: app, stage: "before-owned-PNG-Delete", observedFrames: { [row.frame] }) {
      guard app.state == .runningForeground && row.exists && row.isEnabled
        && row.identifier == owned.basename + ", png" else { return nil }
      return [remove]
    }
    contexts = observedFileContextCollections(in: app)
    try demand(matchesOwnedPNGFolder(owned, in: app) && contexts.count == 1 && app.menus.count == 0
      && app.buttons.matching(NSPredicate(format: "label == %@", "Delete")).count == 1 && frames.count == 2
      && remove.exists && remove.frame == frames[0] && row.exists && row.frame == frames[1]
      && contexts[0].buttons.matching(NSPredicate(format: "label == %@", "Delete")).count == 1
      && contexts[0].buttons.matching(NSPredicate(format: "label == %@", "Delete")).firstMatch.frame == frames[0]
      && finiteContainedFolderFrame(remove.frame, in: app),
      "Full same-folder, sole-file, semantic-context and settled Delete proof must be current immediately before the actual normal tap.")
    try owned.requireCurrentRecord()
    try tap(remove)
    let alert = app.alerts.firstMatch
    if alert.waitForExistence(timeout: 1) {
      let names = [owned.filename, owned.basename]
      try demand(names.contains(where: { name in
        alert.label.contains(name) || alert.staticTexts.allElementsBoundByIndex.contains(where: { $0.label.contains(name) })
      }), "An unnamed or multi-item deletion prompt is refused.")
      let confirm = alert.buttons.matching(NSPredicate(format: "label == %@", "Delete"))
      try demand(confirm.count == 1 && finiteContainedFolderFrame(confirm.firstMatch.frame, in: app),
        "Only the same exact PNG deletion confirmation may be activated.")
      try tap(confirm.firstMatch)
    }
    try requireEmptyOwnedFolder(owned, in: app)
    try demand(app.collectionViews.matching(identifier: "File View").firstMatch.cells
      .matching(NSPredicate(format: "identifier == %@", owned.basename + ", png")).count == 0,
      "The exact canonical owned PNG must be absent from its proven original empty folder after deletion.")
  }

  @MainActor
  private func revealAdapter(_ element: XCUIElement, app: XCUIApplication) throws {
    try demand(element.waitForExistence(timeout: 10), "The generated export action must exist in the adapter fixture.")
    for _ in 0..<8 {
      if element.isHittable { return }
      app.scrollViews.firstMatch.swipeUp()
    }
    try demand(element.isHittable, "The adapter export action must be visibly hittable.")
  }

  @MainActor
  private func tap(_ element: XCUIElement) throws {
    try demand(element.waitForExistence(timeout: 10) && element.isHittable && element.isEnabled,
      "The expected native Files control must be available: \(element.label).")
    element.tap()
  }

  private func demand(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    if !condition() { throw localFilesFailure(message) }
  }

  @MainActor
  private func attach(_ name: String, app: XCUIApplication) {
    let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = name; shot.lifetime = .keepAlways; add(shot)
  }

  @MainActor
  private func attachFailure(app: XCUIApplication, files: XCUIApplication, journal: LocalFilesJournal?) {
    for (name, target) in [("adapter", app), ("files", files)] {
      let tree = XCTAttachment(string: target.debugDescription); tree.name = "local-files-failure-\(name)-AX"; tree.lifetime = .keepAlways; add(tree)
      attach("local-files-failure-\(name)", app: target)
    }
    if let journal, let data = try? journal.recoveryData(), let text = String(data: data, encoding: .utf8) {
      let record = XCTAttachment(string: text); record.name = "local-files-own-recovery-record"; record.lifetime = .keepAlways; add(record)
    }
  }
}

private func localFilesFailure(_ message: String) -> NSError {
  NSError(domain: "NativeLocalFilesFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
}

private func preparePrivateFilesRecoveryDirectory(_ directory: URL) throws {
  var initial = stat()
  let status = directory.path.withCString { Darwin.lstat($0, &initial) }
  if status != 0 {
    guard errno == ENOENT else { throw localFilesFailure("The private Files recovery directory could not be inspected.") }
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
  }
  var current = stat()
  guard directory.path.withCString({ Darwin.lstat($0, &current) }) == 0,
    current.st_mode & mode_t(S_IFMT) == mode_t(S_IFDIR), current.st_uid == geteuid(),
    current.st_mode & 0o777 == 0o700 else {
    throw localFilesFailure("Only the runner's real private 0700 recovery directory may be created or reused. Files, links and foreign directories are refused unchanged.")
  }
  guard try FileManager.default.contentsOfDirectory(atPath: directory.path).isEmpty else {
    throw localFilesFailure("A previous private Files recovery record must be resolved before another export.")
  }
}

private final class LocalFilesJournal {
  let id: String, filename: String, basename: String, folder: String
  private let recordURL: URL
  private var phase = "planned"

  init(metadata: String) throws {
    let prefix = "LOCAL FILES METADATA "
    guard metadata.hasPrefix(prefix), let bytes = metadata.dropFirst(prefix.count).data(using: .utf8),
      let value = try JSONSerialization.jsonObject(with: bytes) as? [String: Any],
      Set(value.keys) == Set(["version", "id", "filename"]), value["version"] as? Int == 1,
      let id = value["id"] as? String, UUID(uuidString: id)?.uuidString.lowercased() == id,
      let filename = value["filename"] as? String, filename == "native-files-\(id).png" else {
      throw localFilesFailure("Only exact UUID metadata from the current adapter mount may name a file.")
    }
    self.id = id; self.filename = filename; basename = "native-files-\(id)"; folder = "SyrianZone Native Files QA \(id)"
    let cache = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    let directory = cache.appendingPathComponent("SyrianZoneNativeLocalFiles", isDirectory: true)
    try preparePrivateFilesRecoveryDirectory(directory)
    recordURL = directory.appendingPathComponent(id).appendingPathExtension("json")
  }

  func requireCurrentRecord() throws {
    let expected = try recoveryData()
    for (path, kind, mode) in [(recordURL.deletingLastPathComponent(), mode_t(S_IFDIR), mode_t(0o700)),
      (recordURL, mode_t(S_IFREG), mode_t(0o600))] {
      var info = stat()
      guard path.path.withCString({ Darwin.lstat($0, &info) }) == 0 && info.st_mode & mode_t(S_IFMT) == kind
        && info.st_uid == geteuid() && info.st_mode & 0o777 == mode
        && (kind != mode_t(S_IFREG) || (info.st_nlink == 1 && info.st_size == expected.count)) else {
        throw localFilesFailure("Only this current exact private regular journal may authorize a remaining-file action.")
      }
    }
    guard try Data(contentsOf: recordURL) == expected else {
      throw localFilesFailure("A changed current journal refuses all remaining-file actions unchanged.")
    }
  }

  func record(phase: String) throws {
    self.phase = phase
    try recoveryData().write(to: recordURL, options: [.atomic, .completeFileProtection])
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: recordURL.path)
  }

  func recoveryData() throws -> Data {
    try JSONSerialization.data(withJSONObject: ["version": 1, "id": id, "filename": filename, "folder": folder,
      "location": "On My iPhone", "filesBundle": "com.apple.DocumentsApp", "phase": phase], options: [.sortedKeys])
  }

  func finish() throws {
    guard phase == "owned-folder-removed", try Data(contentsOf: recordURL) == recoveryData() else {
      throw localFilesFailure("Only the exact completed recovery record may be removed.")
    }
    try FileManager.default.removeItem(at: recordURL)
  }
}
