import Foundation

// Time is accumulated only across native playing transitions. Buffering and
// paused gaps cannot become listening time when the media observer resumes.
final class ListeningClock {
  private let now: () -> Double
  private var previous: Double
  private var playing = false
  private(set) var seconds = 0.0

  init(now: @escaping () -> Double = { ProcessInfo.processInfo.systemUptime }) {
    self.now = now
    self.previous = now()
  }

  func update(playing next: Bool) {
    let current = now()
    if playing { seconds += max(0, current - previous) }
    previous = current
    playing = next
  }
}

// The native playback owner, rather than a mounted screen or JavaScript interval,
// owns the timer. Generation checks make cancelled timer callbacks harmless.
final class SleepDeadline {
  private let now: () -> Double
  private let schedule: (Double, @escaping () -> Void) -> (() -> Void)
  private let onExpire: () -> Void
  private var cancel: (() -> Void)?
  private var generation = 0
  private(set) var until: Double?

  init(now: @escaping () -> Double = { Date().timeIntervalSince1970 },
       schedule: @escaping (Double, @escaping () -> Void) -> (() -> Void),
       onExpire: @escaping () -> Void) {
    self.now = now
    self.schedule = schedule
    self.onExpire = onExpire
  }

  func set(_ value: Double?) {
    generation += 1
    cancel?()
    cancel = nil
    until = value
    guard let value else { return }
    let token = generation
    cancel = schedule(max(0, value - now())) { [weak self] in
      guard let self, token == self.generation, let until = self.until else { return }
      if self.now() < until {
        self.set(until)
      } else {
        self.set(nil)
        self.onExpire()
      }
    }
  }

  deinit { cancel?() }
}
