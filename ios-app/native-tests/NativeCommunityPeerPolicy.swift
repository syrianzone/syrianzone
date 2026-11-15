import Foundation

// This test-only peer uses the same strict Origin policy as the product client.
enum NativeCommunityPeerPolicy {
  static func request(origin: String, key: String) throws -> URLRequest {
    guard origin == "https://127.0.0.1:9443",
      key.range(of: "^[A-Za-z0-9_-]{1,128}$", options: .regularExpression) != nil,
      let url = URL(string: "wss://127.0.0.1:9443/app/\(key)?protocol=7&client=native-community-xctest&version=1.0&flash=false") else {
      throw NSError(domain: "NativeCommunityFixture", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "The peer requires the exact local Origin and public fixture key."])
    }
    var request = URLRequest(url: url)
    request.setValue(origin, forHTTPHeaderField: "Origin")
    return request
  }

  static func rejection(_ event: [String: Any]) -> String? {
    guard event["event"] as? String == "pusher:error" else { return nil }
    let data = event["data"] as? [String: Any]
    if let number = data?["code"] as? NSNumber {
      let value = number.doubleValue
      if value.isFinite, value >= 1000, value <= 99999, value.rounded() == value {
        return "Local Reverb rejected the peer connection (Pusher code \(Int(value)))."
      }
    }
    // Provider text and payloads can contain identifiers. Report no raw data.
    return "Local Reverb rejected the peer connection."
  }
}
