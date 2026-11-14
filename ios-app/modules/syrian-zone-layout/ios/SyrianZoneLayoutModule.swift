import ExpoModulesCore

@ExpoModule("SyrianZoneLayout")
public final class SyrianZoneLayoutModule: Module {
  public func definition() -> ModuleDefinition {
    View(SyrianZoneLayoutView.self) {
      ViewName("Metrics")
      Events("onMetricsChange")
    }
  }
}
