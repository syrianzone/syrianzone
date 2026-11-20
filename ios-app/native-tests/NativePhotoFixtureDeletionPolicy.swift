import Foundation

// Only used after exact-ID PhotoKit provenance checks and for one pending deletion kind.
enum NativePhotoFixtureDeletionPolicy {
  enum Kind: Hashable { case album, photo }
  enum Action { case approve, decline }

  static func action(kind: Kind, objectPresent: Bool, albumTitle: String, alertLabels: [String], buttonLabels: [String]) -> Action? {
    guard allows(kind: kind, albumTitle: albumTitle, alertLabels: alertLabels, buttonLabels: buttonLabels) else { return nil }
    return objectPresent ? .approve : .decline
  }

  static func recoveryFinished(accepted: Set<Kind>, albumPresent: Bool, photoPresent: Bool) -> Bool {
    accepted.contains(.album) && !albumPresent || accepted.contains(.photo) && !photoPresent
  }

  static func allows(kind: Kind, albumTitle: String, alertLabels: [String], buttonLabels: [String]) -> Bool {
    let prefix = "Syrian Zone Native QA "
    guard albumTitle.hasPrefix(prefix), UUID(uuidString: String(albumTitle.dropFirst(prefix.count))) != nil else { return false }
    let buttons = buttonLabels.map(normalize)
    guard buttons.count == 2, Set(buttons) == ["Don't Allow", "Delete"] else { return false }
    let titles: [String]
    switch kind {
    case .album: titles = ["Allow \"SyrianZoneUITests-Runner\" to delete the album \"\(albumTitle)\"?"]
    case .photo: titles = ["Allow \"SyrianZoneUITests-Runner\" to delete 1 photo?", "Allow \"SyrianZoneUITests-Runner\" to delete this photo?"]
    }
    return alertLabels.map(normalize).contains(where: titles.contains)
  }

  private static func normalize(_ value: String) -> String {
    value.replacingOccurrences(of: "\u{201c}", with: "\"")
      .replacingOccurrences(of: "\u{201d}", with: "\"")
      .replacingOccurrences(of: "\u{2019}", with: "'")
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }
}
