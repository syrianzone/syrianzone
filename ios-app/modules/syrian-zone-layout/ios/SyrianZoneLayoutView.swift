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
