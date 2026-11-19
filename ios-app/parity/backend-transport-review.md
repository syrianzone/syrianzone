# Native editing transport

Canonical administration routes now use Sanctum API authentication. Browser
requests retain stateful CSRF checks, and the existing legacy poll and game
mounts remain available. Shared route factories preserve method aliases,
route names and each action's server capability.

The private page and API boundary accepts browser sessions and the existing
Google-authenticated mobile token marker. It refuses banned accounts and
scoped or wildcard agent credentials. Agent calls keep their dedicated MCP
authorizer. Private responses use `Cache-Control: no-store, private`.

Mobile accounts may manage their own agent credentials through the same token
controller as browser accounts. Owner restrictions, live capability clamps,
expiry choices and protection of mobile sessions remain enforced. An agent
credential cannot acquire the reserved mobile marker through that controller.

Native JSON mutations receive explicit acknowledgements. Inertia submissions
retain their redirects. Staff poll reads include disabled groups and archived
candidates without changing public poll visibility.

Source contract regressions also preserve named government-app store links and
allow an explicit, bounded JSON multipart attribute list for Guess Who uploads.

Validation: 296 affected backend tests and 1,626 assertions pass. This includes
real CSRF enforcement, private page reads, action capabilities, mobile token
administration and existing browser behavior. Independent review identified
and fixed the private page token boundary before this result.

These changes are local. Native authenticated interaction tests and production
rollout remain separate work. The broader backend run also found existing
search test failures and a missing website asset build; it is not recorded as
a passing full repository gate.
