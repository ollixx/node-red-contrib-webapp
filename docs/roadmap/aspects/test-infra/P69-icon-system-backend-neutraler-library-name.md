---
id: P69
title: "Icon-System — backend-neutraler {library,name}-Wert + global registrierbare Icon-Libraries (lokal) + Icon-Picker-Dialog (Vorschau/Suche/Lib-Filter); Icon-Felder für ui-button/ui-avatar (+ui-icon), bindbar"
epic: aspects/test-infra
status: done
dependencies: [P63, P68]
---
# P69 — Icon-System — backend-neutraler {library,name}-Wert + global registrierbare Icon-Libraries (lokal) + Icon-Picker-Dialog (Vorschau/Suche/Lib-Filter); Icon-Felder für ui-button/ui-avatar (+ui-icon), bindbar

## Result

**Delivered:** Backend-neutral { library, name } icon system: schema iconValue/iconField + normalizeIconValue (bare-string & library:name back-compat), binding-capable icon fields on ui-icon/ui-button(prefix)/ui-avatar(fallback), renderer/serializer kind "icon" + sl-icon rendering, a module-level icon-library registry seeded from RED.settings.webappIconLibraries with a GET /webapp/icons/manifest endpoint and client registerIconLibrary() head-script, and an editor icon-picker dialog (P68 chrome: preview grid, name search, library filter, perf cap).

**Stats:** ~14 files (3 schema, 1 renderer, 1 serializer, webapp.js, new nodes/icon-library.js, 3 node HTML, editor-common.js, 3 docs); +43 unit tests across 3 new files (schema icon block, p69-icon-serializer, p69-icon-library, p69-icon-render) + 3 E2E (p69-icon-picker); 0 new nodes (ui-icon now actually renders — resolves P77).

**Notes:** Resolved the roadmap's open design points: library config lives in RED.settings.webappIconLibraries (module-level registry); editor picker previews via <img> on the locally-served vendored SVGs (no Shoelace in the editor); 600-tile render cap + search for the 2000+-icon default set. The default library renders as a plain <sl-icon name> (no library attr) so it uses the autoloader's built-in set — no client registration needed. P69 also enables ui-icon rendering (added to the components filter), which is exactly what P77 was filed to fix — P77 can be closed/dismissed as superseded. ui-icon.md was a pure requirement doc predating P69's owner decisions; synced it (plus ui-button.md/ui-avatar.md) to the implemented { library, name } contract during validation Step 3. examples/customers-crud/flow.json regenerated via pnpm gen:example — no diff (fixture uses no icon fields). pnpm validate fully green; full E2E 276 passed (was 273).


**Cost:** session ac90fea92546239c5, 37m
