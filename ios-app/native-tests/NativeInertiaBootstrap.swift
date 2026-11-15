import Foundation

// Test observer only. Mirrors the website's Home bootstrap without evaluating scripts.
enum NativeInertiaBootstrap {
  static func version(in html: String) throws -> String {
    guard html.utf8.count <= 2_000_000 else { throw failure() }
    let scripts = try captures(#"<script\b[^>]*data-page="app"[^>]*>([\s\S]*?)</script>"#, in: html)
    let attributes = try captures(#"\bdata-page="(\{[^"]+)""#, in: html)
    guard scripts.count + attributes.count == 1 else { throw failure() }
    let literal = scripts.first ?? attributes[0].replacingOccurrences(of: "&quot;", with: "\"")
      .replacingOccurrences(of: "&#039;", with: "'").replacingOccurrences(of: "&lt;", with: "<")
      .replacingOccurrences(of: "&gt;", with: ">").replacingOccurrences(of: "&amp;", with: "&")
    guard let data = literal.data(using: .utf8),
      let page = try JSONSerialization.jsonObject(with: data) as? [String: Any], page["component"] as? String == "Home" else {
      throw failure()
    }
    if page["version"] is NSNull { return "" }
    guard let version = page["version"] as? String, version.utf8.count <= 256,
      version.unicodeScalars.allSatisfy({ (32...126).contains($0.value) }) else { throw failure() }
    return version
  }

  static func headers(version: String) -> [String: String] {
    ["X-Inertia": "true", "X-Inertia-Version": version, "X-Requested-With": "XMLHttpRequest"]
  }

  private static func captures(_ pattern: String, in input: String) throws -> [String] {
    let expression = try NSRegularExpression(pattern: pattern)
    return expression.matches(in: input, range: NSRange(input.startIndex..., in: input)).compactMap { match in
      guard let range = Range(match.range(at: 1), in: input) else { return nil }
      return String(input[range])
    }
  }
  private static func failure() -> NSError {
    NSError(domain: "NativeInertiaBootstrap", code: 1, userInfo: [NSLocalizedDescriptionKey: "The bounded local Home bootstrap and its current asset version are required."])
  }
}
