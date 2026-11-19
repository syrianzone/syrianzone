import ExpoModulesCore

@ExpoModule("SyrianZoneLayout")
public final class SyrianZoneLayoutModule: Module {
  public func definition() -> ModuleDefinition {
    View(SyrianZoneLayoutView.self) {
      ViewName("Metrics")
      Events("onMetricsChange")
    }
    View(SyrianKeyCommandsView.self) {
      ViewName("Keys")
      Events("onKeyCommand")
      Prop("active") { (view: SyrianKeyCommandsView, value: Bool) in view.active = value }
      Prop("physicalDirections") { (view: SyrianKeyCommandsView, value: Bool) in view.physicalDirections = value }
      Prop("commands") { (view: SyrianKeyCommandsView, value: [String]) in view.commands = value }
    }
  }
}
