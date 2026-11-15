# ios: port all 14 Board widgets and dashboard editing

Port all 14 actual widgets and the complete dashboard document: gallery, singletons, configuration, resize, native drag/reorder, dashboard controls, local recovery and authenticated sync. Preserve unknown v1 widget configuration and source conflict rules.

The widget set is clock, weather, prayer, Quran, Pomodoro, notes, to-do, RSS, latest answers, today's events, guides, nearby places, transit cities and recipe of the day. Recipe and answer details stay in their original sibling applications.

Validation: All 14 declaration goldens match exact source sizes/config/seeds. The 42-test cohort passes 1537 assertions, including serialized local writes and body limits. Parent iPhone 17 landing/weather rendering passed. The account-native06 rename case also saved through the real local account, reopened, verified persistence and restored the original dashboard name.

The standard iPhone 17 Civic06 case passed in 121.603765 seconds. It created an owned board and two widgets, changed their order by dragging, changed work minutes and retained that value after reopening the editor. It then deleted its owned board and restored the original selection. This establishes editor retention within the running process, not cold process/disk configuration persistence. The completed Civic06 cohort passed three cases with zero failures, skips or runtime warnings; local cleanup passed and the product bundle was restored. Board02 remains a historical native failure. Its retained, unselected QA board `مدني 7E8EFE` was later removed through reviewed recovery of only that exact record. The selected dashboard, all other board fields and user state stayed unchanged; both scoped local Board keys were absent.

Still required: Verify drag autoscroll, resize, remaining widget configuration, configuration after a cold reload, task/note durability, keyboard/large-text layout and full widget-document synchronization on the isolated test account. The API body limit preserves oversized documents locally and reports sync failure.

These are local review drafts. No GitHub PR, push, publication or production mutation is authorized.
