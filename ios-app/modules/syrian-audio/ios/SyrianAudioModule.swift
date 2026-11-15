import AVFoundation
import ExpoModulesCore
import MediaPlayer
import UIKit

@ExpoModule("SyrianAudio")
public final class SyrianAudioModule: Module {
  private var owner: QuranAudioOwner?

  private func audio() -> QuranAudioOwner {
    if let owner { return owner }
    let next = QuranAudioOwner { [weak self] event, body in self?.sendEvent(event, body) }
    owner = next
    return next
  }

  public func definition() -> ModuleDefinition {
    Events("onStatus", "onRemote")
    AsyncFunction("load") { (url: String, seconds: Double, token: Int, promise: Promise) in
      do {
        try self.audio().load(url: url, seconds: seconds, token: token) { error in
          if let error { promise.reject(Exception(name: "audio_session", description: "تعذر تفعيل تشغيل الصوت.", code: "audio_session").causedBy(error)) }
          else { promise.resolve() }
        }
      } catch { promise.reject(Exception(name: "audio_source", description: "مصدر التلاوة غير صالح.", code: "audio_source").causedBy(error)) }
    }.runOnQueue(.main)
    AsyncFunction("play") { (promise: Promise) in
      self.audio().play { error in
        if let error { promise.reject(Exception(name: "audio_session", description: "تعذر تفعيل تشغيل الصوت.", code: "audio_session").causedBy(error)) }
        else { promise.resolve() }
      }
    }.runOnQueue(.main)
    AsyncFunction("pause") { self.audio().pause() }.runOnQueue(.main)
    AsyncFunction("stop") { self.owner?.stop() }.runOnQueue(.main)
    AsyncFunction("seek") { (seconds: Double, token: Int) in self.audio().seek(seconds, token: token) }.runOnQueue(.main)
    AsyncFunction("volume") { (value: Double, muted: Bool) in self.audio().volume(value, muted: muted) }.runOnQueue(.main)
    AsyncFunction("sleep") { (until: Double?) in try self.audio().setSleep(until) }.runOnQueue(.main)
    AsyncFunction("metadata") { (title: String, artist: String) in self.audio().metadata(title: title, artist: artist) }.runOnQueue(.main)
    AsyncFunction("release") {
      self.owner?.dispose()
      self.owner = nil
    }.runOnQueue(.main)
    OnDestroy {
      let owner = self.owner
      self.owner = nil
      DispatchQueue.main.async { owner?.dispose() }
    }
  }
}

private enum NativeAudioSession {
  static let worker = DispatchQueue(label: "zone.syrian.audio-session", qos: .userInitiated)
  static let requests = AudioSessionQueue { active, completed in
    worker.async {
      let session = AVAudioSession.sharedInstance()
      let finish: (Bool, Error?) -> Void = { succeeded, error in
        let failure = error ?? (succeeded ? nil : NSError(domain: "SyrianAudio", code: 4))
        DispatchQueue.main.async { completed(failure) }
      }
      do {
        if active { try session.setCategory(.playback, mode: .spokenAudio) }
        if #available(iOS 27.0, *) {
          if active { session.activate(options: [], completionHandler: finish) }
          else { session.deactivate(options: .notifyOthersOnDeactivation, completionHandler: finish) }
        } else {
          try session.setActive(active, options: active ? [] : .notifyOthersOnDeactivation)
          finish(true, nil)
        }
      } catch { finish(false, error) }
    }
  }
}

private final class QuranAudioOwner {
  private let player = AVPlayer()
  private let emit: (String, [String: Any?]) -> Void
  private var observation: NSKeyValueObservation?
  private var controlObservation: NSKeyValueObservation?
  private var periodic: Any?
  private var notifications: [NSObjectProtocol] = []
  private var commands: [(MPRemoteCommand, Any)] = []
  private var generation = 0
  private var intent = false
  private var interrupted = false
  private var disposed = false
  private var seekPending = false
  private var sessionPending = false
  private var sessionReady = false
  private var activationGeneration = 0
  private var error: String?
  private var info: [String: Any] = [:]
  private let listening = ListeningClock()
  private var lastMetadataAt = 0.0
  private var lastMetadataRate: Float = -1
  private lazy var deadline = SleepDeadline(schedule: { delay, callback in
    let timer = Timer.scheduledTimer(withTimeInterval: max(0.001, delay), repeats: false) { _ in callback() }
    return { timer.invalidate() }
  }, onExpire: { [weak self] in self?.pause(); self?.status() })

  init(emit: @escaping (String, [String: Any?]) -> Void) {
    self.emit = emit
    player.automaticallyWaitsToMinimizeStalling = true
    controlObservation = player.observe(\.timeControlStatus, options: [.initial, .new]) { [weak self] _, _ in
      guard let self else { return }
      if Thread.isMainThread { self.status() }
      else { DispatchQueue.main.async { [weak self] in self?.status() } }
    }
    periodic = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.1, preferredTimescale: 600), queue: .main) { [weak self] _ in self?.status() }
    let center = NotificationCenter.default
    notifications.append(center.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: nil, queue: .main) { [weak self] note in
      guard let self, let item = note.object as? AVPlayerItem, item === self.player.currentItem else { return }
      self.intent = false
      self.status(ended: true)
    })
    notifications.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in self?.interruption(note) })
    notifications.append(center.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] note in
      if note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt == AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue { self?.pause() }
    })
    notifications.append(center.addObserver(forName: UIApplication.significantTimeChangeNotification, object: nil, queue: .main) { [weak self] _ in
      guard let self else { return }
      self.deadline.set(self.deadline.until)
    })
    installCommands()
  }

  func load(url: String, seconds: Double, token: Int, completed: @escaping (Error?) -> Void) throws {
    guard let source = URL(string: url), source.scheme == "https", source.user == nil, source.password == nil,
          ["cdn.mp3quran.net", "everyayah.com"].contains(source.host ?? ""), source.path.hasSuffix(".mp3"),
          source.query == nil, source.fragment == nil, seconds.isFinite, seconds >= 0,
          (source.host == "cdn.mp3quran.net" && source.path.hasPrefix("/audio/")) ||
          (source.host == "everyayah.com" && source.path.hasPrefix("/data/")) else {
      throw NSError(domain: "SyrianAudio", code: 1, userInfo: [NSLocalizedDescriptionKey: "مصدر التلاوة غير صالح."])
    }
    generation = token
    intent = true
    error = nil
    seekPending = true
    observation?.invalidate()
    player.pause()
    let item = AVPlayerItem(url: source)
    player.replaceCurrentItem(with: item)
    observation = item.observe(\.status, options: [.initial, .new]) { [weak self, weak item] _, _ in
      DispatchQueue.main.async {
        guard let self, !self.disposed, let item, item === self.player.currentItem else { return }
        if item.status == .readyToPlay {
          self.seek(seconds)
        } else if item.status == .failed {
          self.intent = false
          self.seekPending = false
          self.error = "تعذر تشغيل التلاوة. تحقق من الاتصال ثم أعد المحاولة."
          self.status()
        }
      }
    }
    activateSession(completed: completed)
    status()
  }

  func play(completed: @escaping (Error?) -> Void = { _ in }) {
    guard player.currentItem != nil, !disposed else { completed(nil); return }
    intent = true
    activateSession(completed: completed)
    status()
  }
  private func activateSession(completed: @escaping (Error?) -> Void) {
    activationGeneration += 1
    let request = activationGeneration
    sessionReady = false
    sessionPending = true
    NativeAudioSession.requests.setActive(true) { [weak self] error in
      guard let self, !self.disposed, request == self.activationGeneration else {
        completed(NSError(domain: "SyrianAudio", code: 3))
        return
      }
      self.sessionPending = false
      self.sessionReady = error == nil
      if error != nil {
        self.intent = false
        self.player.pause()
        self.error = "تعذر تفعيل تشغيل الصوت. حاول مجدداً."
      } else if self.intent && !self.seekPending {
        self.error = nil
        self.player.play()
      }
      self.status()
      completed(error)
    }
  }
  func pause() { intent = false; player.pause(); status() }
  func seek(_ seconds: Double, token requestedToken: Int? = nil) {
    guard seconds.isFinite else { return }
    if let requestedToken { generation = requestedToken }
    let token = generation
    seekPending = true
    player.seek(to: CMTime(seconds: max(0, seconds), preferredTimescale: 1000), toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] finished in
      DispatchQueue.main.async {
        guard let self, token == self.generation else { return }
        self.seekPending = false
        if finished && self.intent && self.sessionReady { self.player.play() }
        self.status()
      }
    }
  }
  func volume(_ value: Double, muted: Bool) { player.volume = Float(min(1, max(0, value))); player.isMuted = muted; status() }
  func setSleep(_ until: Double?) throws {
    if let until, !until.isFinite {
      throw NSError(domain: "SyrianAudio", code: 2, userInfo: [NSLocalizedDescriptionKey: "موعد الإيقاف غير صالح."])
    }
    deadline.set(until.map { $0 / 1000 })
    status()
  }
  func metadata(title: String, artist: String) {
    info[MPMediaItemPropertyTitle] = title
    info[MPMediaItemPropertyArtist] = artist
    info[MPMediaItemPropertyAlbumTitle] = "تلاوة القرآن"
    updateMetadata(force: true)
  }
  func stop() {
    intent = false
    activationGeneration += 1
    sessionReady = false
    sessionPending = false
    generation += 1
    observation?.invalidate()
    observation = nil
    player.pause()
    player.replaceCurrentItem(with: nil)
    deadline.set(nil)
    error = nil
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    NativeAudioSession.requests.setActive(false)
    status()
  }
  private func updateMetadata(force: Bool = false) {
    guard player.currentItem != nil else { return }
    let now = ProcessInfo.processInfo.systemUptime
    let rate = player.timeControlStatus == .playing ? player.rate : 0
    guard force || now - lastMetadataAt >= 1 || rate != lastMetadataRate else { return }
    lastMetadataAt = now
    lastMetadataRate = rate
    let duration = player.currentItem?.duration.seconds ?? 0
    info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = player.currentTime().seconds.isFinite ? player.currentTime().seconds : 0
    info[MPNowPlayingInfoPropertyPlaybackRate] = rate
    if duration.isFinite { info[MPMediaItemPropertyPlaybackDuration] = duration }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }
  private func status(ended: Bool = false) {
    guard !disposed else { return }
    let wasPlaying = player.timeControlStatus == .playing
    listening.update(playing: wasPlaying)
    updateMetadata()
    let position = player.currentTime().seconds
    let duration = player.currentItem?.duration.seconds ?? 0
    emit("onStatus", ["token": generation, "seconds": position.isFinite ? position : 0,
      "duration": duration.isFinite ? duration : 0, "listenedSeconds": listening.seconds,
      "playing": wasPlaying, "loading": player.currentItem != nil && (sessionPending || seekPending || player.currentItem?.status == .unknown || player.timeControlStatus == .waitingToPlayAtSpecifiedRate),
      "loaded": player.currentItem?.status == .readyToPlay, "ended": ended, "error": error,
      "sleepUntil": deadline.until.map { $0 * 1000 }])
  }
  private func installCommands() {
    let remote = MPRemoteCommandCenter.shared()
    for (command, action) in [(remote.playCommand, "play"), (remote.pauseCommand, "pause"), (remote.nextTrackCommand, "next"), (remote.previousTrackCommand, "previous")] {
      command.isEnabled = true
      let target = command.addTarget { [weak self] _ in
        DispatchQueue.main.async {
          guard let self, !self.disposed else { return }
          if action == "play" { self.play() }
          else if action == "pause" { self.pause() }
          else { self.emit("onRemote", ["action": action, "token": self.generation]) }
        }
        return .success
      }
      commands.append((command, target))
    }
  }
  private func interruption(_ note: Notification) {
    guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
    if type == .began {
      interrupted = intent
      sessionReady = false
      player.pause()
      status()
    } else {
      let options = AVAudioSession.InterruptionOptions(rawValue: note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0)
      if interrupted && intent && options.contains(.shouldResume) { play() }
      interrupted = false
    }
  }
  func dispose() {
    guard !disposed else { return }
    stop()
    disposed = true
    if let periodic { player.removeTimeObserver(periodic) }
    periodic = nil
    controlObservation?.invalidate()
    controlObservation = nil
    notifications.forEach { NotificationCenter.default.removeObserver($0) }
    notifications = []
    commands.forEach { $0.0.removeTarget($0.1) }
    commands = []
  }
}
