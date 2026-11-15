import Foundation

// Called on the main queue. The native operation returns there before settling
// a request, so an old owner's deactivation cannot race a new owner's activation.
final class AudioSessionQueue {
  typealias Completion = (Error?) -> Void
  private let perform: (Bool, @escaping Completion) -> Void
  private var pending: [(Bool, Completion)] = []
  private var active = false

  init(perform: @escaping (Bool, @escaping Completion) -> Void) { self.perform = perform }

  func setActive(_ value: Bool, completed: @escaping Completion = { _ in }) {
    pending.append((value, completed))
    drain()
  }

  private func drain() {
    guard !active, !pending.isEmpty else { return }
    active = true
    let request = pending.removeFirst()
    var settled = false
    perform(request.0) { [self] error in
      guard !settled else { return }
      settled = true
      // Keep active true through callbacks, including reentrant requests.
      request.1(error)
      active = false
      drain()
    }
  }
}
