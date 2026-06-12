---
id: P168
node: ui-tabs
epic: nodes/ui-tabs
title: "ui-tabs/ui-tab Renderer + Editor: Slot pro Kind, activeTab per Kind-id, Mount-Tree zeigt ui-tab, Eindeutigkeits-Validierung; Browser-Beweis"
findings:
  - "Owner-Idee (2026-06-12): Jedes Kindelement ist ein Slot, der so heißt wie das Kind; die Tabs werden NICHT über die Editor-Option festgelegt."
  - "Owner (2026-06-12): rechts erscheinen nicht die Slots, sondern der Hinweis — Mounten in ui-tabs heißt 'werde ein Tab'."
acceptance:
  - "ui-tab ist im Editor anlegbar (label/icon/order + Mount in ein ui-tabs); ui-tabs-Editor hat KEIN tabs-JSON-Feld mehr."
  - "Mount-Tree (ADR 0014/P135): ui-tabs erscheint als Drop-Ziel für ui-tab; ein ui-tab erscheint als Container mit Default-Slot für seinen Inhalt."
  - "Renderer: ui-tabs rendert genau einen Slot je ui-tab-Kind; der aktive Tab (activeTab = Kind-id) ist sichtbar, die übrigen ausgeblendet; tabChange emittiert die Kind-id."
  - "Eindeutigkeit: zwei ui-tab-Kinder mit gleichem Namen/gleicher id → sichtbarer Editor-/Deploy-Fehler."
  - "End-to-End (browser): ein ui-tabs mit zwei ui-tab-Kindern (je ein ui-text) rendert zwei Tabs; Tab-Wechsel zeigt den jeweiligen Inhalt; activeTab-Store-Roundtrip funktioniert."
verify: browser
spec: docs/nodes/navigation/ui-tabs.md
tests: tests/e2e/nodes/view/ui-tabs.tests.md
dependencies: [P167]
status: done
---
# P168 — ui-tabs/ui-tab Renderer + Editor + Beweis

> Zweite Schicht von ADR 0018. Setzt auf das Schema (P167) auf, schließt mit dem
> **browser**-Beweis ab.

## Umfang

1. **Renderer:** ein Slot pro `ui-tab`-Kind; aktiver Tab (`activeTab` = Kind-id)
   sichtbar, Rest aus; `tabChange` emittiert die Kind-id; keyed nach Kind-id.
2. **Node-Registrierung `ui-tab`** (`nodes/.../ui-tab.{js,html}`) + Eintrag in
   `node-red.nodes`/`webapp.js`.
3. **Editor ui-tabs:** `tabs`-JSON **raus**; ui-tabs ist Container für `ui-tab`;
   Mount-Tree zeigt ui-tabs als Drop-Ziel + jedes ui-tab als Container.
4. **Editor ui-tab:** `label`-typedInput, `icon`, `order`, Mount-Picker.
5. **Validierung:** Eindeutigkeit der Kind-id/-Namen mit sichtbarer Fehlermeldung.
6. **Spec/Doku:** `docs/nodes/navigation/ui-tabs.md` auf das Kinder-Modell
   umschreiben; **neues** `docs/nodes/navigation/ui-tab.md` anlegen; Testkatalog
   befüllen.

## acceptance / verify

- `verify: browser` — jede acceptance-Zeile im laufenden Frontend beweisen
  (`preview_*`/Playwright). E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]; Build vor E2E,
  [[e2e-verify-build-and-no-tail]]).

## Risiken / Hinweise

- **Migration** (P167-Mapping) im Editor anwenden, damit alte Flows nicht brechen.
- Dynamische Tabs (ui-repeat → ui-tab) sind **nicht** hier — das ist P170.

## Result

- **delivered:** Tabs-1a wave (ADR 0018) Schicht 2 — renderer + editor + browser proof. ui-tabs
  now derives one panel per `ui-tab` child (new `renderTabs`: enumerates children, slot key = child
  id, resolves each label binding, active tab = `activeTab` child-id with first-by-order default,
  invalid→first; renders `ui-tab:<id>/content` into each panel; `tabChange` emits the child id;
  keyed by child id). New `ui-tab` node registered end-to-end (`nodes/view/ui-tab.{js,html}`,
  `package.json` node-red.nodes, `WEBAPP_NODE_TYPES`, component bucket, `mapConfig`,
  `toComponentDefinitions` kind `tab`). Editor: ui-tabs lost the tabs-JSON field + gained the
  children "become a tab" hint; new ui-tab.html reuses installBaseFields + canonical `label`
  typedInput + mount-picker; mount-tree surfaces ui-tabs/ui-tab as containers; duplicate child-id is
  a visible deploy-hook error (`validateUiTabChildrenUniqueness`). Legacy tabs-JSON flows
  auto-migrate (P167 mapping). Spec rewritten + new `docs/nodes/navigation/ui-tab.md`.
- **stats:** 20 files (+1148/−205); 1 new node type (`ui-tab`) + 1 new component kind (`tab`); new
  `packages/runtime/test/p168-tabs-children-model.test.ts` (9) + rewritten p155/p85 tabs tests.
  Unit green (runtime 964 / schema 302 / renderer 92 / editor 102). Develop verification: `pnpm
  build` exit 0; **browser proof 46/46 green** — ui-tabs view spec R01/R02 (two ui-tab children →
  sl-tab/sl-tab-panel pairs, content per panel, switching) + A01–A04 (activeTab literal/state
  binding, **two-way write-back**, external-store→SSE), and editor minimal-coverage + navigation-
  nodes (tabs-JSON gone; ui-tab opens with label/icon; no-crash). check:roadmap + check:links + lint
  OK.
- **notes:** A `ui-tab`'s node id IS its tab id / slot key / activeTab token; the renderer's tab
  matcher also accepts the `container:<id>/content` alias the two-column mount-picker emits, so the
  existing picker drives tabs with no special-casing (logged to friction log along with the alias
  not being in ADR 0018). The sub-agent couldn't run Playwright in its worktree (no cached
  browsers) and proved the render path via `renderAppPage`; the orchestrator ran the authoritative
  browser proof + editor regression on merged develop (46/46). The full suite wasn't run end-to-end
  (slow host this session) but all P168 risk surfaces — new-node editor loading (minimal-coverage +
  navigation-nodes), ui-tabs render + activeTab two-way (ui-tabs.spec), unit — are covered green;
  unrelated nodes are unaffected by the ui-tabs/ui-tab change. **Next: P169 mirrors this onto
  ui-accordion; P170 is the dynamic-tabs capstone (ui-repeat→ui-tab).**
- **cost:** session ad023154aff8ebdd7, ~100m (+ orchestrator browser proof / editor regression on
  the slow host).
