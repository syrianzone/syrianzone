# ios: port the phone directory and its editor

Search categories and numbers, call with the native phone action and edit directory entries using the server's capabilities.

Preserve category filtering, grid/table display, number copy, WhatsApp and source links. The native editor includes category/entry CRUD, ordering and active-state controls, with explicit category cascade confirmation.

Validation: Source-derived model/API tests passed. Public28 passed native number search, category selection, card/list layouts and empty-search/reset. Calls, copying, WhatsApp/source destinations and controlled native editing remain pending. The overall public28 cohort had eight passes and six failures.

Dependencies: Shared directory administration and guarded backend transport.

Remaining checks: New administration routes require a backend release.

Local review draft only. No GitHub PR, push, deployment or production mutation has been performed for this draft.
