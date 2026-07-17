---
id: P241
node: ui-skeleton
title: "Konformitäts-Pass ui-skeleton — der Knoten rendert NICHTS: echtes Output (sl-skeleton), Base-Fields, Spec-Drift, Validierung, frische Tests"
epic: aspects/node-conformance
status: pending
dependencies: []
verify: browser
spec: docs/nodes/feedback/ui-skeleton.md
tests: tests/e2e/nodes/view/ui-skeleton.tests.md
---
# P241 — Konformitäts-Pass ui-skeleton

> Audit 2026-07-17 (node-conformance, worst-first). **Sonderfall:** anders als alle
> bisherigen Konformitäts-Pässe fand dieser keinen Drift *in einem funktionierenden
> Knoten* — der Knoten ist **funktional nicht vorhanden**. Die Spec ist ein
> Versprechen, die Laufzeit ein No-op.

## findings

### A. Der Knoten rendert NICHTS (Kern-Befund)

`ui-skeleton`s Zweck laut Spec: *„rendert einen **animierten Lade-Platzhalter**, der
die Form des eigentlichen Inhalts imitiert"*. **Gemessener Ist-Zustand:**

- **Kein Serializer-Zweig für `skeleton`** — `packages/renderer/src/**` erwähnt
  „skeleton" an **keiner Stelle**; `KIND_TO_SHOELACE` (`shoelace-adapter.ts`) hat
  **keinen** `skeleton`-Eintrag.
- `displayType` (`text`/`avatar`/`card`/`table`) und `lines` haben damit **null
  beobachtbare Wirkung**. `visible` gated nichts Sichtbares.
- **Beleg aus dem Programm selbst:** P233 (done) notierte beim Löschen der
  No-Crash-Tests: *„ui-skeleton ×2 (**rendern Leerstring**; Sibling-Content-Test
  bleibt)"*.
- **Der einzige verbliebene E2E-Test** (`tests/e2e/nodes/view/ui-skeleton.spec.ts`)
  prüft nur, dass ein **Geschwister**-`ui-text` noch rendert. Sein Kommentar:
  > „ui-skeleton has **NO dedicated serializer element yet** (sl-skeleton is not in
  > the bundled Shoelace set) — it currently **emits no chrome of its own**
  > (deferred; **a per-node conformance pass will give it real output**)."
- **Die dort genannte Begründung ist FALSCH.** `sl-skeleton` **ist** vendored:
  `resources/shoelace/components/skeleton/skeleton.js` (ADR 0008 / P63 kopiert das
  **ganze** CDN-Build nach `resources/shoelace/`; der Autoloader lädt Komponenten-
  Chunks lazy unter demselben lokalen Pfad). Der Blocker, der das Rendering
  „deferred" hat, existiert nicht.

### B. Base-Fields fehlen im Editor (ADR 0015 §3)

- Das Schema trägt `...baseFieldsSchema` ⇒ **`disabled` und `color` sind im
  Schema** (`bindingSchema.optional()`).
- Der Editor ruft **`installBaseFields` gar nicht auf** — er baut nur `visible`
  von Hand (P138, älter als der Helfer P139). **`disabled` und `color` haben im
  Editor keine Zeile — nicht einmal als N/A-mit-Hinweis**, was ADR 0015 §3 fordert
  (*„A base field that does not apply to a node is rendered but disabled, with a
  short hint why"*). Der Autor kann sie nicht setzen; die Spec dokumentiert sie nicht.
- **`visible` ist handgebaut** und dupliziert die Helfer-Logik (P181 originally-empty-
  Tracking, P202 Neutral-`true`-Seeding) → Drift-Risiko gegen `installBaseFields`.

### C. Spec-Drift (Dimension 2)

| Stelle | Spec sagt | Realität |
|---|---|---|
| `visible` Label | „**Visible Path**" | Editor-Label ist „**Visible**" (`ui-skeleton.html:114`) |
| `visible` Pflicht | „Pflicht: **ja**" | Schema `.optional()`, Editor-Default `null`, Inline-Hilfe: „**Leer = immer sichtbar**" ⇒ **optional** |
| Gruppe „Platzierung" | **fehlt komplett** | Editor hat `order`/`row`/`col`/`colSize`/`rowSize`/`layoutX`/`layoutY` (via `installLayoutChildPropRows()`) — jeder Vergleichsknoten (checkbox/datepicker/slider/image) dokumentiert die Gruppe |
| `disabled`/`color` | **nicht dokumentiert** | im Schema vorhanden (B) |
| Input `msg.ui.patch` | *„überschreibt beliebige Felder (`displayType`, `lines`)"* | **falsch** — ui-skeleton nutzt `componentStateInputHandler` (`webapp.js:7679`), der **nur** `msg.ui.component.op` kennt und alles andere durchreicht. Kein Patch. |

### D. Validierungs-Lücke `lines`

Editor: `validate: value === "" || RED.validators.number()(value)` ⇒ **`0` und
negative Werte passieren den Editor**. Schema: `z.number().int().positive()` ⇒
Deploy-Zeit-Fehler statt Editor-Fehler. Die Spec fordert „Zahlenfeld (**≥ 1**)";
das `min="1"` im HTML wird von Node-REDs Validierung nicht durchgesetzt.

### E. Kleinkram

- **Inline-Hilfe leakt interne Phasen-Ids an Nutzer:** Überschrift „**Visible (P138)**".
  (Doku-Link ist vorhanden ✓ — P232.)
- **Undokumentierter Legacy-Zwilling:** `mapConfig` hat
  `displayType: config.displayType || **config.variant** || undefined`
  (`webapp.js:7672`) — ein `variant`-Fallback, den weder Spec noch Editor kennen.

## acceptance

- **Der Skeleton rendert sichtbar.** Browser: ein ui-skeleton mit `visible=true`
  erzeugt eigenes Chrome im DOM — **gemessen**, nicht per Tag/Klasse geraten
  ([[verify-rendering-by-measurement-not-tags]]): das Element hat eine
  **Bounding-Box mit Höhe > 0** und ist sichtbar. Heute ist die Box leer/nicht
  vorhanden.
- **`displayType` hat eine beobachtbare Wirkung** — die vier Formen sind
  **voneinander unterscheidbar** gerendert:
  - `text` (Default) → `lines` Platzhalter-Zeilen; **gemessen**: die Zahl der
    Zeilen-Elemente entspricht `lines`, und ihre Bounding-Boxen liegen
    **vertikal untereinander** (aufsteigendes `y`).
  - `avatar` → ein **rundes** Platzhalter-Element (gemessen: Breite ≈ Höhe,
    `border-radius` ≥ 50 % der Box — computed style).
  - `card` → ein Block-Platzhalter, dessen Bounding-Box **höher und breiter** ist
    als eine einzelne Text-Zeile.
  - `table` → mehrere Zeilen-Platzhalter in Zeilen-Anordnung, unterscheidbar von
    `text` (z. B. Spalten-Aufteilung — konkrete Anatomie siehe *Owner-Entscheid* unten).
- **`lines` wirkt und ist validiert.** Browser: `lines=5` bei `displayType=text`
  ⇒ **5** gemessene Zeilen-Boxen; `lines=1` ⇒ 1. Editor: `lines=0` oder negativ ⇒
  **Validierungsfehler vor Deploy** (Knoten rot, Deploy blockiert) — nicht erst im
  Schema. `lines` bleibt bei `avatar`/`card`/`table` disabled mit Hinweis (bestehendes
  Verhalten, erhalten).
- **`visible` gated sichtbar.** Browser: `visible=false` ⇒ Skeleton **nicht** im
  Layout (Box weg); `visible=true` ⇒ sichtbar; ein **Store-Binding** blendet live
  um (SSE-Re-Render, gemessen). Legacy `visiblePath` migriert weiterhin verlustfrei.
- **Base-Fields nach ADR 0015 §3.** `disabled` und `color` sind im Editor
  **vorhanden** — entweder wirksam oder **gerendert-disabled mit Hinweis, warum
  N/A** (Begründung node-lokal; ein Lade-Platzhalter ist nicht interaktiv ⇒
  `disabled` ist der N/A-Kandidat; `color` ist zu entscheiden, s. u.). `visible`
  läuft über den **gemeinsamen Helfer** (`installBaseFields` + `omit`-Muster), nicht
  über handkopierte P181/P202-Logik — Round-trip verlustfrei (`check:roundtrip` grün),
  Neutral-`true` bleibt erhalten.
- **Spec entdriftet (Detail-Bar).** Label „Visible" statt „Visible Path";
  `visible` als **optional** (leer = immer sichtbar); **Gruppe „Platzierung"
  dokumentiert**; `disabled`/`color` dokumentiert (inkl. N/A-Begründung); der
  Input-Abschnitt sagt die **Wahrheit** über `msg.ui.patch` (s. *Abgrenzung*);
  `displayType`s vier Formen mit ihrer **beobachtbaren Render-Wirkung** beschrieben.
- **Inline-Hilfe ohne interne Phasen-Ids** („Visible (P138)" → „Visible");
  Doku-Link bleibt.
- **Legacy-`variant`-Fallback** in `mapConfig` entweder dokumentiert **oder**
  entfernt (mit Migration) — nicht stillschweigend belassen.
- **Frische, outcome-basierte Tests** nach `.ai/agents/node-testing.md`: je Feature
  ein gemessener Test (oben), Katalog `ui-skeleton.tests.md` aktuell. Der alte
  Sibling-rendert-noch-Test entfällt oder wird ersetzt — er war nur der Notnagel
  für einen Knoten ohne Output.
- **E2E grün** (Haupt-Checkout).

## verify

`browser` — jede Form/`lines`/`visible`-Wirkung per **Bounding-Box bzw. computed
style** am echten DOM gemessen; Editor-Validierung (`lines=0`) real im Editor
geprüft; `check:specs`/`check:fields`/`check:help`/`check:roundtrip`/`check:links`
+ `pnpm validate` grün.

## spec

`docs/nodes/feedback/ui-skeleton.md` — Felder (inkl. Platzierung + Base-Fields),
Input-Wahrheit, `displayType`-Formen mit Render-Wirkung, `lines`-Validierung.

## tests

`tests/e2e/nodes/view/ui-skeleton.spec.ts` + `ui-skeleton.tests.md` (der Katalog
listet heute nur „Geplante Testziele (P138)" — Stub, ist zu füllen). Unit: die
Serializer-Abbildung `skeleton` → Element + `displayType`/`lines`-Komposition.

## notes for the implementer

- **`sl-skeleton` ist da** — `resources/shoelace/components/skeleton/skeleton.js`
  (ADR 0008: ganzes CDN-Build vendored, Autoloader lädt lazy). Die Behauptung im
  alten Test-Kommentar, es sei „not in the bundled Shoelace set", ist **falsch** und
  ist beim Umbau **zu entfernen**, damit sie niemanden erneut fehlleitet.
- **Muster:** `KIND_TO_SHOELACE` in `packages/renderer/src/shoelace-adapter.ts`
  (`progress: "sl-progress-bar"` etc.). Ein `skeleton`-Eintrag beendet den
  `data-wa-fallback`-Pfad. Die vier `displayType`-Formen sind eine **Komposition**
  mehrerer `sl-skeleton` (ADR 0021: semantische Intent-Vokabel, per Adapter
  gemappt — die Form bleibt backend-neutral im Schema).
- **Abgrenzung `msg.ui.patch`:** ui-skeleton nutzt `componentStateInputHandler`; der
  Nachbar-Knoten direkt darüber in `webapp.js` nutzt `viewNodePatchInputHandler`
  (patch-fähig). Ob Patch implementiert oder die Spec korrigiert wird, ist **dieselbe
  offene, knotenübergreifende Entscheidung wie der ui-icon-`msg.payload`-Follow-up
  aus P235** — **nicht** hier einseitig entscheiden. In diesem Paket: die Spec sagt
  die Wahrheit über das **heutige** Verhalten; die Richtungsentscheidung bleibt beim
  Owner (eigene Phase).
- **Nicht** `ui-empty-state` mitfixen (P152-Redesign, bewusst ausgeklammert), obwohl
  es dieselbe Base-Field-/Leerstring-Signatur hat.

## Owner-Entscheid (vor Umsetzung zu bestätigen)

1. **`table`-Anatomie:** Wie viele Zeilen/Spalten imitiert der Table-Skeleton —
   fix (z. B. 3×3) oder von `lines` gesteuert? (Heute steuert `lines` laut Spec
   *nur* `text`.)
2. **`color` auf ui-skeleton:** wirksam (Platzhalter-/Shimmer-Farbe) oder N/A mit
   Hinweis? Die Spec sagt heute, die Farben folgen den **neutralen** Design-Tokens
   (`colorNeutral`/`colorSurface`) — das spricht für **N/A**, widerspricht aber dem
   Base-Field-Standard nach ADR 0039. Berührt **P240** (variant-vs-color-Review).
