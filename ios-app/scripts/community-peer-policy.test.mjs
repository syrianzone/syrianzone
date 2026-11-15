import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Compile the actual iOS helper with the Mac CI job's Swift toolchain.
test.skipIf(process.platform !== 'darwin')('the actual Swift community peer sends only the exact local Origin and exposes protocol rejection', () => {
  const source = readFileSync(fileURLToPath(new URL('../native-tests/NativeCommunityPeerPolicy.swift', import.meta.url)), 'utf8');
  const directory = mkdtempSync(path.join(os.tmpdir(), 'syrianzone-community-policy-'));
  try {
    const file = path.join(directory, 'policy.swift');
    writeFileSync(file, `${source}
func check(_ value: Bool, _ message: String) { if !value { FileHandle.standardError.write(Data((message + "\\n").utf8)); exit(1) } }
let request = try NativeCommunityPeerPolicy.request(origin: "https://127.0.0.1:9443", key: "public_fixture_key")
check(request.value(forHTTPHeaderField: "Origin") == "https://127.0.0.1:9443", "The real WebSocket request must carry Origin")
check(request.allHTTPHeaderFields?.count == 1 && request.httpBody == nil && request.httpMethod == "GET", "No bearer, cookie or body may be supplied")
let url = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!
check(url.scheme == "wss" && url.host == "127.0.0.1" && url.port == 9443 && url.path == "/app/public_fixture_key", "The peer must remain on local WSS")
check(url.queryItems?.first(where: { $0.name == "protocol" })?.value == "7", "Preserve protocol version")
for origin in ["https://syrian.zone", "https://localhost:9443", "http://127.0.0.1:9443", "https://127.0.0.1:9443/", "https://127.0.0.1:9443\\r\\nAuthorization: injected"] {
  var refused = false
  do { _ = try NativeCommunityPeerPolicy.request(origin: origin, key: "public_fixture_key") } catch { refused = true }
  check(refused, "A noncanonical or nonlocal origin was accepted")
}
for key in ["", "key?escape=1", "key/path", "key\\r\\nCookie: injected", String(repeating: "x", count: 129)] {
  var refused = false
  do { _ = try NativeCommunityPeerPolicy.request(origin: "https://127.0.0.1:9443", key: key) } catch { refused = true }
  check(refused, "An invalid public key was accepted")
}
check(NativeCommunityPeerPolicy.rejection(["event":"state", "data":["code":4009]]) == nil, "Ordinary events must remain available")
check(NativeCommunityPeerPolicy.rejection(["event":"pusher:error", "data":["code":4009,"message":"private payload must not escape"]]) == "Local Reverb rejected the peer connection (Pusher code 4009).", "Pusher error should fail immediately with a code")
check(NativeCommunityPeerPolicy.rejection(["event":"pusher:error", "data":["code":"private payload"]]) == "Local Reverb rejected the peer connection.", "Malformed error content must stay private")
check(NativeCommunityPeerPolicy.rejection(["event":"pusher:error", "data":["code":4009.5]]) == "Local Reverb rejected the peer connection.", "Fractional codes must not be misreported")
print("18 community-peer policy cases passed")
`, { mode: 0o600 });
    const result = Bun.spawnSync({ cmd: ['swift', file], stdout: 'pipe', stderr: 'pipe', timeout: 20000 });
    const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
    expect(result.exitCode, output).toBe(0);
    expect(output).toContain('18 community-peer policy cases passed');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
