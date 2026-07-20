---
id: P255
node: ui-container
title: "Konformitäts-Pass ui-container (leicht) — kein Katalog, `events` (onShow/onHide) ungetestet + Inert-Verdacht; Varianten/Layout solide"
epic: aspects/node-conformance
status: done
dependencies: []
verify: browser
spec: docs/nodes/display/ui-container.md
tests: tests/e2e/nodes/composite/ui-container.tests.md
---
# P255 — Konformitäts-Pass ui-container (leicht)

> Audit 2026-07-17. Kern **solide** — 10 outcome-E2E (sl-card-Wrapper, Kind-Mount,
> mehrere Kinder, grid-Layout, **alle 5 Varianten** card/panel/section/transparent/
> span inkl. span-inline), Base-Fields (`installBaseFields`).

## findings

### A. Kein Test-Katalog (Dimension 5)
Kein `tests/e2e/nodes/composite/ui-container.tests.md`.

### B. `events` (onShow/onHide) ungetestet + Inert-Verdacht
Schema `events: z.array(z.enum(["onShow","onHide"]))`. Kein E2E feuert sie; grep
nach `onShow`/`onHide` im Serializer/Renderer/webapp.js ist **leer** ⇒ zu
verifizieren, ob die Events real emittiert werden. Wo nein → implementieren **oder**
aus Schema+Spec entfernen.

### C. Solide (nicht neu aufbauen)
Alle 5 Varianten (surface roles), Layout-Preset (grid), Kind-Mounting, span-inline.

## acceptance
- **`events` aufgelöst:** onShow/onHide feuern beim Ein-/Ausblenden mit korrektem
  `msg.ui`-Envelope (gemessen) — oder aus Schema+Spec entfernt.
- **Katalog** `ui-container.tests.md` angelegt.
- **E2E grün**; Tripwires + `pnpm validate` grün.

## verify
`browser` — onShow/onHide gemessen; die 10 bestehenden bleiben grün.

## spec
`docs/nodes/display/ui-container.md` — events-Wahrheit.

## tests
`tests/e2e/nodes/composite/ui-container.spec.ts` + neuer Katalog.

## Result

**Done 2026-07-20.** Owner-Entscheid **implementieren**: onShow/onHide feuern jetzt
real. Ein echter Prerequisite-Bug wurde nebenbei gefunden und gefixt.

### onShow/onHide — gemessen inert → implementiert

Vor der Änderung existierten sie nur im Editor-HTML (Event-Checkboxen) + Schema —
**keine Emission** in Serializer/Renderer/webapp.js. Implementiert über einen
Client-seitigen Lifecycle-Transitions-Detektor:
1. **`webapp.js`** (`toComponentDefinitions`): aktive Events als
   `props.lifecycleEvents` (freier Record, keine Schema-Änderung — onShow/onHide sind
   nicht im geschlossenen Interaction-Event-Enum).
2. **`webapp-serializer.js`** (`wrapRenderedComponentHtml`): `data-webapp-lifecycle=
   "onShow onHide"` auf den Container-Wrapper — **nur** wenn `lifecycleEvents.length>0`.
3. **`webapp-client.js`** (`detectLifecycleTransitions`): difft die Präsenz von
   `[data-webapp-lifecycle]` nach **jedem** `applySnapshot` (Initial-Hydrate + jeder
   SSE-Push) und POSTet `/event` — onShow bei neu-präsent, onHide bei neu-abwesend.
   Idempotent (ein bleibender Container feuert nicht erneut).

### Prerequisite-Bug gefunden + gefixt (visible→visibleIf auf Container)

`toComponentDefinitions` verdrahtete das `visible`-Base-Field des Containers **nie**
in `visibleIf` (anders als der generische p16Kind-Pfad) → ein store/state-gebundenes
`visible` hatte auf Container **keine Wirkung**. Gefixt (gehört zur bekannten
Bug-Klasse aus `task_4bf1fff7`, hier für Container gelöst; die anderen hand-branch
Knoten bleibt der Chip). Ungebundenes `visible` normalisiert weiter über
`applyDynamicStateSlots` (imperativer show/hide-op bleibt), kein Default-Regress.

### Gemessener Envelope-Beleg (echter POST /event via `interceptNextEvent`)

- **onShow**: store-`visible` false→true (Inject→SSE) → `body.event==="onShow"`,
  `body.sourceId==="ctnShow1"`; kein spurious onShow beim Laden (Container absent).
- **onHide**: true→false → `body.event==="onHide"`, `sourceId==="ctnHide1"`.
- **Negativ-Gate**: Container ohne aktivierte Events → kein `[data-webapp-lifecycle]`,
  **null** POST /event beim Show-Toggle.

### Verifikation (Haupt-Checkout, autoritativ)

**E2E 815 passed, 0 failed, `--retries=0`** (24,9 min — erhöhte Maschinenlast im Lauf,
aber vollständig grün; +4 P255-Tests; der Per-Snapshot-Detektor verursacht keinen
Regress über die 811 übrigen). Client+Serializer+webapp.js geändert → Voll-Suite
gerechtfertigt. Container-Spec 14/14. `pnpm build` + `pnpm validate` + Tripwires grün
(**Katalog `ui-container.tests.md` angelegt → letzte `check:roadmap`-Warnung geräumt**).
Gating unabhängig geprüft: Marker nur bei `lifecycleEvents.length>0`, Detektor nur auf
markierten Elementen → keine Fremd-Knoten-Events. Agent committete VOR der Verifikation,
stoppte alle Prozesse (Port 1882 frei), Haupt-Checkout unberührt.
