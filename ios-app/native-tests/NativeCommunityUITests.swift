import XCTest

// These cases require the account fixture bundle and its verified loopback gate.
// They never provision a production session or select an existing library photo.
final class NativeCommunityUITests: LocalFixtureTestCase {
  @MainActor
  func testGuessWhoNativeGuestAndSecondLocalClientExchangeRealRoomEvents() async throws {
    let app = try launch("member", id: 101)
    let backend = try CommunityBackend(environment: ProcessInfo.processInfo.environment)
    defer { backend.close() }
    try await backend.prepare()
    open("guesswho", app: app)
    let category = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "عشوائي من كل الفئات")).firstMatch
    XCTAssertTrue(category.waitForExistence(timeout: 15))
    reveal(category, app: app)
    category.tap()
    assertLocal(app, user: "member", id: 101)
    tap("أنشئ غرفة اللعب", app: app)
    let codeElement = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", CommunityBackend.uuidPattern)).firstMatch
    XCTAssertTrue(codeElement.waitForExistence(timeout: 20), "The native create response must navigate to its actual room.")
    let code = codeElement.label
    let characters = try await backend.characters(in: code)
    XCTAssertGreaterThanOrEqual(characters.count, 12)
    XCTAssertLessThanOrEqual(characters.count, 24)
    XCTAssertTrue(app.staticTexts["بانتظار اتصال الخصم"].firstMatch.waitForExistence(timeout: 20), "The native Pusher connection must establish before adding a peer.")

    let identity = UUID().uuidString.lowercased()
    let joined = try await backend.request("/api/v1/guesswho/rooms/\(code)/join", identity: identity, body: ["player_session": identity])
    XCTAssertEqual(joined["status"] as? String, "joined")
    XCTAssertEqual(joined["role"] as? String, "player_2", "The UI-created guest owns the first slot.")
    let peer = try await backend.subscribe(room: code, identity: identity)
    defer { peer.close() }
    XCTAssertTrue(app.staticTexts["الخصم متصل"].firstMatch.waitForExistence(timeout: 20), "Actual presence subscription must reach the native SDK.")

    tap("اختيار الشخصية", app: app)
    XCTAssertTrue(app.staticTexts["تأكيد الشخصية السرية"].firstMatch.waitForExistence(timeout: 5))
    // A page sheet retains the board in the app query tree. Inspect its own
    // confirmation scroll view instead of counting the background roster.
    let confirmations = app.scrollViews.containing(.staticText, identifier: "تأكيد الشخصية السرية")
    XCTAssertEqual(confirmations.count, 1, "The actual confirmation sheet must have one content scroll view.")
    let confirmation = confirmations.firstMatch
    let selected = characters.filter { confirmation.staticTexts[$0.name].exists }
    XCTAssertEqual(selected.count, 1, "Only the selected secret should be exposed inside the confirmation sheet.")
    let ownSecret = try XCTUnwrap(selected.first)
    let captionTree = XCTAttachment(string: confirmation.debugDescription)
    captionTree.name = "guesswho-confirmation-caption-AX"; captionTree.lifetime = .keepAlways; add(captionTree)
    // React Native exposes one caption as nested matching StaticText nodes.
    let captionLeaves = confirmation.staticTexts.matching(identifier: ownSecret.name).allElementsBoundByIndex.filter {
      $0.descendants(matching: .staticText).matching(identifier: ownSecret.name).count == 0
    }
    XCTAssertEqual(captionLeaves.count, 1, "The confirmation sheet must contain one selected-name caption.")
    XCTAssertEqual(confirmation.images.matching(identifier: ownSecret.name).count, 1, "The selected character's named portrait must render in the sheet.")
    let confirm = confirmation.buttons["نعم، تأكيد"]
    XCTAssertTrue(confirm.isHittable && confirm.isEnabled)
    XCTAssertTrue(confirmation.buttons["إلغاء"].isHittable)
    capture("guesswho-one-selected-name-and-portrait-in-confirmation-sheet", app: app)
    confirm.tap()
    XCTAssertTrue(app.staticTexts["اخترت شخصيتك. انتظر صديقك."].firstMatch.waitForExistence(timeout: 10))
    let secondSecret = try XCTUnwrap(characters.first { $0.id != ownSecret.id })
    let ready = try await backend.action(room: code, identity: identity, action: "select_ready", payload: ["id": secondSecret.id])
    XCTAssertEqual((ready["state"] as? CommunityObject)?["status"] as? String, "playing")
    let playing = try await peer.next { $0["event"] as? String == "state" && ($0["data"] as? CommunityObject)?["status"] as? String == "playing" }
    let state = try XCTUnwrap(playing["data"] as? CommunityObject)
    let nativeIdentity = try XCTUnwrap(state["turn"] as? String)
    XCTAssertNotEqual(nativeIdentity, identity)
    XCTAssertNotNil(nativeIdentity.range(of: CommunityBackend.uuidPattern, options: .regularExpression))
    XCTAssertNil(state["myCharacterId"])
    XCTAssertNil(state["opponentCharacterId"], "Broadcasts must not disclose either secret.")
    XCTAssertTrue(app.staticTexts["دورك الآن"].firstMatch.waitForExistence(timeout: 15), "The second player's HTTP action must arrive through native WSS without refresh.")
    XCTAssertTrue(app.staticTexts["شخصيتك السرية: \(ownSecret.name)"].firstMatch.exists)
    XCTAssertTrue(app.staticTexts["شخصيات الخصم المتبقية: \(characters.count)"].firstMatch.exists)

    tap("استبعاد", app: app)
    _ = try await peer.next { event in
      let remaining = (event["data"] as? CommunityObject)?["remaining"] as? CommunityObject
      return event["event"] as? String == "state" && (remaining?[nativeIdentity] as? NSNumber)?.intValue == characters.count - 1
    }
    let afterElimination = try await backend.snapshot(room: code, identity: identity)
    XCTAssertEqual((afterElimination["opponentRemaining"] as? NSNumber)?.intValue, characters.count - 1)
    XCTAssertTrue(app.buttons["إرجاع"].firstMatch.exists, "The native board must retain its acknowledged elimination.")
    tap("إنهاء دورك", app: app)
    _ = try await peer.next { $0["event"] as? String == "state" && ($0["data"] as? CommunityObject)?["turn"] as? String == identity }
    XCTAssertTrue(app.staticTexts["دور الخصم"].firstMatch.waitForExistence(timeout: 10))
    XCTAssertFalse(app.buttons["إنهاء دورك"].firstMatch.isEnabled)
    let opponentTurn = try await backend.snapshot(room: code, identity: identity)
    XCTAssertEqual(opponentTurn["turn"] as? String, identity)

    let guessed = try await backend.action(room: code, identity: identity, action: "guess", payload: ["character_id": ownSecret.id])
    XCTAssertEqual((guessed["state"] as? CommunityObject)?["status"] as? String, "finished")
    _ = try await peer.next { $0["event"] as? String == "state" && ($0["data"] as? CommunityObject)?["winner"] as? String == identity }
    XCTAssertTrue(app.staticTexts["انتهت اللعبة وفاز الخصم."].firstMatch.waitForExistence(timeout: 15))
    let finished = try await backend.snapshot(room: code, identity: identity)
    XCTAssertEqual(finished["status"] as? String, "finished")
    XCTAssertEqual(finished["winner"] as? String, identity)
    capture("guesswho-real-native-and-second-local-client-finished", app: app)
    assertLocal(app, user: "member", id: 101)
    // The source has no room-deletion endpoint. Only this new fixture room is
    // retained for the source expiry job or an explicit local fixture reset.
    open("guesswho", app: app)
    XCTAssertTrue(app.buttons["أنشئ غرفة اللعب"].waitForExistence(timeout: 10))
  }

  @MainActor
  func testMishwarContributionValidationPhotoPickerCancelAndDraftDiscard() throws {
    let app = try launch("member", id: 101)
    open("places?q=34.75%2C39&view=list", app: app)
    let coordinate = app.buttons["الانتقال إلى 34.75, 39"].firstMatch
    XCTAssertTrue(coordinate.waitForExistence(timeout: 15))
    reveal(coordinate, app: app)
    coordinate.tap()
    XCTAssertTrue(app.maps.firstMatch.waitForExistence(timeout: 10))
    assertLocal(app, user: "member", id: 101)
    tap("أضف مكاناً", app: app)
    XCTAssertTrue(app.staticTexts["حرّك الخريطة وضع علامة المركز فوق المكان، ثم أكّد الموقع."].firstMatch.waitForExistence(timeout: 5))
    tap("استخدام هذا الموقع", app: app)
    let form = app.textFields.matching(NSPredicate(format: "label BEGINSWITH %@", "اسم المكان")).firstMatch
    let nearby = app.buttons["متابعة الإضافة على أي حال"].firstMatch
    if nearby.waitForExistence(timeout: 3) { tap("متابعة الإضافة على أي حال", app: app) }
    XCTAssertTrue(form.waitForExistence(timeout: 20))
    let point = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", #"34\.75[0-9]{3}, 39\.00[0-9]{3}"#)).firstMatch
    XCTAssertTrue(point.exists, "The real native map selection must populate the form coordinates.")
    tap("إرسال المكان", app: app)
    XCTAssertTrue(app.staticTexts["تحقق من الحقول المحددة."].firstMatch.waitForExistence(timeout: 5))
    XCTAssertTrue(form.label.contains("أدخل اسم المكان، حتى 160 حرفاً."))
    XCTAssertTrue(app.staticTexts["اختر التصنيف."].firstMatch.exists)
    XCTAssertTrue(app.staticTexts["وصف المكان يجب أن يكون بين 20 و1000 حرف."].firstMatch.exists)
    XCTAssertTrue(app.staticTexts["أضف من صورة واحدة إلى عشر صور."].firstMatch.exists)

    let ownName = "مكان تحقق مجتمعي محلي"
    let description = "وصف مكان اختباري محلي للتحقق من حفظ المسودة وإلغاء منتقي الصور بأمان."
    replace(form, with: ownName)
    let detail = app.textViews.matching(NSPredicate(format: "label BEGINSWITH %@", "الوصف (20 إلى 1000 حرف)")).firstMatch
    XCTAssertTrue(detail.waitForExistence(timeout: 5))
    replace(detail, with: description)
    tap("التصنيف", app: app)
    tap("تاريخي", app: app)
    tap("اختيار صور", app: app)
    let cancel = app.buttons.matching(NSPredicate(format: "label IN %@", ["Cancel", "إلغاء"])).firstMatch
    XCTAssertTrue(cancel.waitForExistence(timeout: 10), "The system photo picker must present a cancellation control.")
    cancel.tap()
    XCTAssertTrue(app.buttons["اختيار صور"].firstMatch.waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts["الصور (0 / 10)"].firstMatch.exists)
    XCTAssertEqual(form.value as? String, ownName)
    XCTAssertEqual(detail.value as? String, description)
    capture("mishwar-native-photo-picker-cancelled-without-selection", app: app)
    tap("إرسال المكان", app: app)
    XCTAssertTrue(app.staticTexts["أضف من صورة واحدة إلى عشر صور."].firstMatch.waitForExistence(timeout: 5))
    XCTAssertEqual(app.textFields["اسم المكان"].value as? String, ownName)
    XCTAssertEqual(app.textViews["الوصف (20 إلى 1000 حرف)"].value as? String, description)
    XCTAssertFalse(app.staticTexts["تم إرسال المكان وسيظهر على الخريطة بعد الموافقة."].exists)
    tap("إغلاق", app: app)
    let discard = app.alerts["إغلاق دون إرسال؟"]
    XCTAssertTrue(discard.waitForExistence(timeout: 5))
    discard.buttons["متابعة"].tap()
    XCTAssertEqual(app.textFields["اسم المكان"].value as? String, ownName)
    tap("إغلاق", app: app)
    XCTAssertTrue(discard.waitForExistence(timeout: 5))
    discard.buttons["تجاهل وإغلاق"].tap()
    XCTAssertTrue(app.buttons["أضف مكاناً"].firstMatch.waitForExistence(timeout: 5))
    XCTAssertFalse(app.textFields["اسم المكان"].exists)
    assertLocal(app, user: "member", id: 101)
    capture("mishwar-photo-required-and-confirmed-local-draft-discard", app: app)
  }

  @MainActor
  private func capture(_ name: String, app: XCUIApplication) {
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}

private typealias CommunityObject = [String: Any]
private struct CommunityCharacter { let id: Int; let name: String }
private func communityFailure(_ message: String) -> NSError {
  NSError(domain: "NativeCommunityFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
}

// The second player uses the same guest HTTP contract and real Reverb presence
// protocol as the source. It never receives a mobile bearer or bypasses TLS.
private final class CommunityBackend: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  static let uuidPattern = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
  private let origin = "https://127.0.0.1:9443"
  private var version = ""
  private var key = ""
  private var session: URLSession!
  private var socketSession: URLSession!

  init(environment: [String: String]) throws {
    guard environment["SZ_NATIVE_FIXTURE_ORIGIN"] == "https://127.0.0.1:9443",
      let gate = environment["SZ_NATIVE_FIXTURE_GATE"], gate.range(of: "^[A-Za-z0-9_-]{16,256}$", options: .regularExpression) != nil else {
      throw communityFailure("The exact private local fixture environment is required.")
    }
    super.init()
    session = URLSession(configuration: Self.configuration(resourceTimeout: 20), delegate: self, delegateQueue: nil)
    // A WebSocket remains open across UI actions. Its resource deadline must
    // bound the whole peer lifetime rather than the shorter HTTP transaction.
    socketSession = URLSession(configuration: Self.configuration(resourceTimeout: 180), delegate: self, delegateQueue: nil)
  }

  private static func configuration(resourceTimeout: TimeInterval) -> URLSessionConfiguration {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieStorage = nil
    configuration.httpShouldSetCookies = false
    configuration.urlCredentialStorage = nil
    configuration.urlCache = nil
    configuration.timeoutIntervalForRequest = 15
    configuration.timeoutIntervalForResource = resourceTimeout
    return configuration
  }

  func close() { session.invalidateAndCancel(); socketSession.invalidateAndCancel() }

  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
    completionHandler(nil)
  }

  func prepare() async throws {
    let data = try await data("/", headers: ["Accept": "text/html"])
    guard let html = String(data: data, encoding: .utf8) else { throw communityFailure("Local bootstrap was not UTF-8.") }
    let script = try capture(#"<script\b[^>]*data-page="app"[^>]*>([\s\S]*?)</script>"#, in: html)
    let encoded = try capture(#"\bdata-page="(\{[^"]+)""#, in: html)
    let literal = script ?? encoded?.replacingOccurrences(of: "&quot;", with: "\"").replacingOccurrences(of: "&#039;", with: "'")
      .replacingOccurrences(of: "&lt;", with: "<").replacingOccurrences(of: "&gt;", with: ">").replacingOccurrences(of: "&amp;", with: "&")
    guard let literal, let pageData = literal.data(using: .utf8), let page = try JSONSerialization.jsonObject(with: pageData) as? CommunityObject,
      page["component"] as? String == "Home", page["version"] is String || page["version"] is NSNull else { throw communityFailure("Local Inertia bootstrap contract failed.") }
    version = page["version"] as? String ?? ""
    guard let settings = try capture(#"window\.REVERB_CONFIG\s*=\s*window\.REVERB_CONFIG\s*\|\|\s*\{([^{}]*)\}"#, in: html),
      try capture(#"host\s*:\s*"([^"]+)""#, in: settings) == "127.0.0.1",
      try capture(#"port\s*:\s*([0-9]+)"#, in: settings) == "9443",
      try capture(#"scheme\s*:\s*"([^"]+)""#, in: settings) == "https",
      let localKey = try capture(#"key\s*:\s*"([A-Za-z0-9_-]{1,128})""#, in: settings) else { throw communityFailure("Realtime configuration must remain on exact local WSS.") }
    key = localKey
  }

  func characters(in room: String) async throws -> [CommunityCharacter] {
    try validateRoom(room)
    let bytes = try await data("/guesswho/room/\(room)", headers: ["X-Inertia": "true", "X-Inertia-Version": version, "X-Requested-With": "XMLHttpRequest"])
    let page = try object(bytes)
    guard page["component"] as? String == "GuessWho/Room", let props = page["props"] as? CommunityObject,
      let game = props["game"] as? CommunityObject, game["room_code"] as? String == room,
      let category = game["category"] as? CommunityObject, let rows = category["characters"] as? [CommunityObject] else { throw communityFailure("The created room roster was not confirmed.") }
    return try rows.map { row in
      guard let id = row["id"] as? Int, id > 0, let name = row["name_ar"] as? String, !name.isEmpty else { throw communityFailure("A local room character was invalid.") }
      return CommunityCharacter(id: id, name: name)
    }
  }

  func request(_ path: String, identity: String, body: CommunityObject? = nil) async throws -> CommunityObject {
    guard path.hasPrefix("/api/v1/guesswho/"), identity.range(of: Self.uuidPattern, options: .regularExpression) != nil else { throw communityFailure("Only a UUID guest may use the local game API.") }
    let bytes = try await data(path, headers: ["X-Guess-Who-Session-ID": identity], body: body)
    return try object(bytes)
  }

  func snapshot(room: String, identity: String) async throws -> CommunityObject {
    try validateRoom(room)
    return try await request("/api/v1/guesswho/rooms/\(room)/state?sender_session=\(identity)", identity: identity)
  }

  func action(room: String, identity: String, action: String, payload: CommunityObject) async throws -> CommunityObject {
    try validateRoom(room)
    let response = try await request("/api/v1/guesswho/rooms/\(room)/actions", identity: identity, body: ["sender_session": identity, "action": action, "payload": payload])
    guard response["status"] as? String == "ok", response["state"] is CommunityObject else { throw communityFailure("The real game action was not acknowledged.") }
    return response
  }

  func subscribe(room: String, identity: String) async throws -> CommunityPeer {
    try validateRoom(room)
    guard !key.isEmpty else { throw communityFailure("Local realtime bootstrap is missing.") }
    let socketRequest = try NativeCommunityPeerPolicy.request(origin: origin, key: key)
    let peer = CommunityPeer(socket: socketSession.webSocketTask(with: socketRequest))
    do {
      let established = try await peer.next { $0["event"] as? String == "pusher:connection_established" }
      guard let establishedData = established["data"] as? CommunityObject, let socket = establishedData["socket_id"] as? String else { throw communityFailure("Local Reverb did not establish a socket.") }
      let channel = "presence-guesswho.\(room)"
      let authorization = try await request("/api/v1/guesswho/broadcasting/auth", identity: identity,
        body: ["channel_name": channel, "socket_id": socket, "session_id": identity])
      guard let auth = authorization["auth"] as? String, let channelData = authorization["channel_data"] as? String else { throw communityFailure("Local presence authorization failed.") }
      try await peer.send(["event": "pusher:subscribe", "data": ["channel": channel, "auth": auth, "channel_data": channelData]])
      let subscription = try await peer.next { $0["event"] as? String == "pusher_internal:subscription_succeeded" && $0["channel"] as? String == channel }
      guard let subscriptionData = subscription["data"] as? CommunityObject, let presence = subscriptionData["presence"] as? CommunityObject,
        let ids = presence["ids"] as? [String], ids.contains(identity), ids.count == 2 else { throw communityFailure("Both actual room members must be present.") }
      return peer
    } catch { peer.close(); throw error }
  }

  private func validateRoom(_ room: String) throws {
    guard room.range(of: Self.uuidPattern, options: .regularExpression) != nil else { throw communityFailure("A new local UUID room is required.") }
  }

  private func data(_ path: String, headers: [String: String] = [:], body: CommunityObject? = nil) async throws -> Data {
    guard path == "/" || path.hasPrefix("/api/v1/guesswho/") || path.hasPrefix("/guesswho/room/"),
      let url = URL(string: origin + path), url.scheme == "https", url.host == "127.0.0.1", url.port == 9443,
      url.user == nil, url.password == nil else { throw communityFailure("A community request escaped the exact local origin.") }
    var request = URLRequest(url: url)
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.setValue("SyrianZone-iOS/0.1", forHTTPHeaderField: "User-Agent")
    for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }
    if let body {
      request.httpMethod = "POST"
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
      request.httpBody = try JSONSerialization.data(withJSONObject: body)
    }
    let (data, response) = try await session.data(for: request)
    guard let response = response as? HTTPURLResponse, response.statusCode == 200, response.url == url, data.count <= 2_000_000 else {
      throw communityFailure("The real local HTTP request did not confirm a bounded response with status 200.")
    }
    return data
  }

  private func object(_ data: Data) throws -> CommunityObject {
    guard let value = try JSONSerialization.jsonObject(with: data) as? CommunityObject else { throw communityFailure("A local JSON object was required.") }
    return value
  }

  private func capture(_ pattern: String, in input: String) throws -> String? {
    let regex = try NSRegularExpression(pattern: pattern)
    guard let match = regex.firstMatch(in: input, range: NSRange(input.startIndex..., in: input)), let range = Range(match.range(at: 1), in: input) else { return nil }
    return String(input[range])
  }
}

private final class CommunityPeer: @unchecked Sendable {
  private let socket: URLSessionWebSocketTask
  private let lock = NSLock()
  private var events: [CommunityObject] = []
  private var failure: Error?
  private var receiver: Task<Void, Never>?
  init(socket: URLSessionWebSocketTask) {
    self.socket = socket
    socket.resume()
    // Keep protocol pongs flowing while XCTest interacts with native controls.
    receiver = Task { [weak self, socket] in
      do {
        while !Task.isCancelled {
          let message = try await socket.receive()
          let bytes: Data
          switch message {
          case .string(let text): bytes = Data(text.utf8)
          case .data(let data): bytes = data
          @unknown default: throw communityFailure("Local Reverb sent an unsupported message.")
          }
          guard bytes.count <= 65_536, var event = try JSONSerialization.jsonObject(with: bytes) as? CommunityObject else { throw communityFailure("A bounded local Reverb object was required.") }
          if let encoded = event["data"] as? String { event["data"] = try JSONSerialization.jsonObject(with: Data(encoded.utf8)) }
          if let rejection = NativeCommunityPeerPolicy.rejection(event) { throw communityFailure(rejection) }
          if event["event"] as? String == "pusher:ping" {
            try await socket.send(.string("{\"event\":\"pusher:pong\",\"data\":{}}"))
          } else { try self?.append(event) }
        }
      } catch { self?.fail(error) }
    }
  }
  func close() { receiver?.cancel(); socket.cancel(with: .normalClosure, reason: nil) }

  func send(_ value: CommunityObject) async throws {
    let data = try JSONSerialization.data(withJSONObject: value)
    guard let message = String(data: data, encoding: .utf8) else { throw communityFailure("Local presence message was not UTF-8.") }
    try await socket.send(.string(message))
  }

  func next(where matches: @escaping (CommunityObject) -> Bool) async throws -> CommunityObject {
    let deadline = Date().addingTimeInterval(15)
    while Date() < deadline {
      if let event = try take(where: matches) { return event }
      try await Task.sleep(nanoseconds: 50_000_000)
    }
    throw communityFailure("The actual local room event timed out.")
  }

  private func append(_ event: CommunityObject) throws {
    lock.lock(); defer { lock.unlock() }
    guard events.count < 100 else { throw communityFailure("The local room event queue exceeded its test bound.") }
    events.append(event)
  }

  private func fail(_ error: Error) { lock.lock(); defer { lock.unlock() }; failure = error }

  private func take(where matches: (CommunityObject) -> Bool) throws -> CommunityObject? {
    lock.lock(); defer { lock.unlock() }
    if let index = events.firstIndex(where: matches) { return events.remove(at: index) }
    if let failure { throw failure }
    return nil
  }
}
