import ExpoModulesCore
import UIKit

// Adapted from pingdotgg/t3code T3LayoutMetricsView at 629242b8d3ab6f1c626c5098bf932345d7926285. See ../LICENSE.
final class SyrianZoneLayoutView: ExpoView {
  let onMetricsChange = EventDispatcher()
  private var lastMetrics: NSDictionary?
  private var hasHinge = false

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = false
    registerForTraitChanges([UITraitHorizontalSizeClass.self, UITraitVerticalSizeClass.self]) { (view: SyrianZoneLayoutView, _: UITraitCollection) in
      view.publishMetrics()
    }
    // Swift 6.4 also ships with the older SDK, so test UIKit's SDK version independently.
    #if canImport(UIKit, _version: 9127.0.85)
    if #available(iOS 27.1, *) {
      addInteraction(UIHingeInteraction { [weak self] _, update in
        guard let self, self.window != nil else { return }
        self.hasHinge = self.hasHinge || update.hinge != nil
        self.publishMetrics()
      })
      registerForTraitChanges(UITraitCollection.systemTraitsAffectingVerticalBarEdge) { (view: SyrianZoneLayoutView, _: UITraitCollection) in
        view.publishMetrics()
      }
    }
    #endif
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    lastMetrics = nil
    publishMetrics()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    publishMetrics()
  }

  override func safeAreaInsetsDidChange() {
    super.safeAreaInsetsDidChange()
    publishMetrics()
  }

  private func publishMetrics() {
    guard window != nil, bounds.width > 0, bounds.height > 0 else { return }
    var verticalBarEdge = "none"
    var regions: [[String: Any]] = []
    #if canImport(UIKit, _version: 9127.0.85)
    if #available(iOS 27.1, *) {
      let rtl = effectiveUserInterfaceLayoutDirection == .rightToLeft
      switch traitCollection.verticalBarEdge {
      case .leading: verticalBarEdge = rtl ? "right" : "left"
      case .trailing: verticalBarEdge = rtl ? "left" : "right"
      default: break
      }
      for kind in [UIView.ReservedRegion.Kind.division, .occlusion] {
        for region in reservedRegions(kind: kind) where region.isActive {
          // UIKit includes the interactive-content margins in this view-local frame.
          let frame = region.frame.intersection(bounds)
          guard !frame.isNull, !frame.isEmpty else { continue }
          regions.append([
            "kind": kind == .division ? "division" : "occlusion",
            "x": frame.minX, "y": frame.minY,
            "width": frame.width, "height": frame.height,
          ])
        }
      }
    }
    #endif
    let metrics: [String: Any] = [
      "width": bounds.width, "height": bounds.height,
      "hasHinge": hasHinge,
      "horizontalSizeClass": traitCollection.horizontalSizeClass == .regular ? "regular" : "compact",
      "verticalBarEdge": verticalBarEdge,
      "safeArea": [
        "top": safeAreaInsets.top, "bottom": safeAreaInsets.bottom,
        "left": safeAreaInsets.left, "right": safeAreaInsets.right,
      ],
      "reservedRegions": regions,
    ]
    let next = metrics as NSDictionary
    guard lastMetrics?.isEqual(next) != true else { return }
    lastMetrics = next
    onMetricsChange(metrics)
  }
}

final class SyrianKeyCommandsView: ExpoView {
  let onKeyCommand = EventDispatcher()
  var active = false { didSet { if oldValue != active { updateFocus() } } }
  var physicalDirections = false { didSet { if oldValue != physicalDirections { refreshCommands() } } }
  var commands: [String] = [] {
    didSet { if oldValue != commands { refreshCommands() } }
  }
  private let supported = Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "w", "a", "s", "d", "W", "A", "S", "D", "h", "l", "[", "]", "1", "2", "3", "4", "5"])

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    for name in [UITextField.textDidEndEditingNotification, UITextView.textDidEndEditingNotification] {
      NotificationCenter.default.addObserver(self, selector: #selector(textEditingEnded(_:)), name: name, object: nil)
    }
  }
  deinit { NotificationCenter.default.removeObserver(self) }

  override var canBecomeFirstResponder: Bool { active && !hasTextEntryFocus }
  override var keyCommands: [UIKeyCommand]? {
    guard active else { return nil }
    return commands.filter { supported.contains($0) }.flatMap { value in
      let input: String
      switch value {
      case "ArrowLeft": input = UIKeyCommand.inputLeftArrow
      case "ArrowRight": input = UIKeyCommand.inputRightArrow
      case "ArrowUp": input = UIKeyCommand.inputUpArrow
      case "ArrowDown": input = UIKeyCommand.inputDownArrow
      default: input = value.lowercased()
      }
      // Match the source's lowercase, Shift, Caps Lock, and Shift+Caps WASD.
      let modifiers: [UIKeyModifierFlags] = ["W", "A", "S", "D"].contains(value) ? [.shift, .alphaShift]
        : ["w", "a", "s", "d"].contains(value) ? [[], [.shift, .alphaShift]] : [[]]
      return modifiers.map { flags in
        let command = UIKeyCommand(input: input, modifierFlags: flags, action: #selector(receiveKey(_:)))
        command.allowsAutomaticMirroring = !physicalDirections
        return command
      }
    }
  }
  override func didMoveToWindow() { super.didMoveToWindow(); updateFocus() }

  @objc private func textEditingEnded(_ notification: Notification) {
    guard let view = notification.object as? UIView, let window, view.window === window else { return }
    // A field-to-field focus change must settle before considering game shortcuts.
    DispatchQueue.main.async { [weak self] in self?.updateFocus() }
  }
  private var hasTextEntryFocus: Bool {
    func focusedInput(_ view: UIView) -> Bool {
      (view.isFirstResponder && view is any UIKeyInput) || view.subviews.contains(where: focusedInput)
    }
    return window.map(focusedInput) ?? false
  }
  private func refreshCommands() {
    guard active, isFirstResponder else { return }
    _ = resignFirstResponder()
    updateFocus()
  }
  private func updateFocus() {
    if active && window != nil && !hasTextEntryFocus { _ = becomeFirstResponder() }
    else if isFirstResponder { _ = resignFirstResponder() }
  }
  @objc private func receiveKey(_ command: UIKeyCommand) {
    guard active, isFirstResponder, !hasTextEntryFocus, let input = command.input else { return }
    let key: String
    switch input {
    case UIKeyCommand.inputLeftArrow: key = "ArrowLeft"
    case UIKeyCommand.inputRightArrow: key = "ArrowRight"
    case UIKeyCommand.inputUpArrow: key = "ArrowUp"
    case UIKeyCommand.inputDownArrow: key = "ArrowDown"
    default: key = command.modifierFlags.contains(.shift) != command.modifierFlags.contains(.alphaShift) ? input.uppercased() : input
    }
    if supported.contains(key) && commands.contains(key) { onKeyCommand(["key": key]) }
  }
}
