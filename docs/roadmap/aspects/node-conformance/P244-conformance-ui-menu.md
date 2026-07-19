---
id: P244
node: ui-menu
title: "Konformitäts-Pass ui-menu — displayType ist inert (kein Render-Unterschied), collapsed ist totes Feld, dropdown fehlt im Editor; Daten-/Event-Ebene ist solide"
epic: aspects/node-conformance
status: pending
dependencies: []
verify: browser
spec: docs/nodes/navigation/ui-menu.md
tests: tests/e2e/nodes/view/ui-menu.tests.md
---
# P244 — Konformitäts-Pass ui-menu

> Audit 2026-07-17 (node-conformance). Die **Daten-/Event-Ebene** von ui-menu ist
> solide (6 outcome-basierte E2E: json/store-items reaktiv, activeRoute-Highlight,
> Legacy-Migration, navigate-Event-POST, href-no-hook; Base-Fields korrekt via
> `installBaseFields`; Doku-Link vorhanden). Die **Darstellungs-Ebene** ist
> dagegen weitgehend Fiktion: das Haupt-Feld `displayType` rendert nichts
> Beobachtbares, `collapsed` ist tot, `dropdown` ist unerreichbar.

## findings

### A. `displayType` ist inert — kein beobachtbarer Render-Unterschied
Die Spec sagt: *„Durch `displayType` wird bestimmt, wie das Menü räumlich
dargestellt wird … Jeder Modus kann das Layout und die Interaktion des Menüs
**wesentlich verändern**."* **Gemessener Ist-Zustand:** kein Code verzweigt auf
`sidebar`/`topbar`/`dropdown`:
- `packages/renderer/src/renderer.ts` (`component.kind === "menu"`, ~Z. 1029) löst
  nur `items` + `activeItem` auf; `displayType` bleibt ein generischer Prop.
- `shoelace-adapter.ts` mappt `menu → sl-menu` **ohne** displayType-Verzweigung.
- Weder Renderer noch `nodes/webapp.js` emittieren eine displayType-abhängige
  Klasse/Attribut. sidebar, topbar und dropdown rendern **identisch** (ein nacktes
  `sl-menu`). **Kein Test** prüft einen displayType-Unterschied.
⇒ Das primäre „Darstellung"-Feld des Knotens hat **null Wirkung**.

### B. `collapsed` ist ein totes Feld
`collapsed: bindingSchema.optional()` steht im Schema und die Spec dokumentiert es
ausführlich (Items-Gruppe, `msg.ui.patch`, ein eigenes Wiring-Szenario). Aber:
- **Nicht im Editor** — kein `defaults`-Eintrag, keine Formzeile, kein typedInput.
  Unerreichbar für den Autor.
- **Nicht in `mapConfig`** (`nodes/webapp.js` ui-menu-Block Z. ~7912) — die Laufzeit
  liest `config.collapsed` nie. (Der `collapsed`-Treffer bei webapp.js:8169 gehört
  zu **ui-log**, nicht ui-menu.)
⇒ Weder setzbar noch gelesen noch gerendert: reine Phantom-Funktion.

### C. `dropdown` fehlt im Editor und ist unfertig
- Schema `displayType: z.enum(["sidebar","topbar","dropdown"])`, Spec beschreibt
  alle drei — aber die Editor-SelectBox bietet nur **`sidebar`/`topbar`**;
  `dropdown` ist **nicht wählbar**.
- Die Spec-„Offene Punkte" geben es selbst zu: *„dropdown-Modus: Wer öffnet das
  Dropdown (Trigger-Element)? … noch nicht modelliert."*
⇒ Ein dokumentierter Enum-Wert ohne Editor-Weg und ohne fertiges Modell.

### D. Kleinere Drifts
- **Label-Drift:** Spec sagt Editor-Label „Items **State Path**" / „Active Route
  **Path**"; der Editor zeigt „Items" / „Active Route".
- **Undokumentierter Legacy-Zwilling:** `mapConfig` hat
  `displayType: config.displayType || config.variant || undefined` — ein
  `variant`-Fallback, den weder Spec noch Editor kennen (gleiches Muster wie
  ui-skeleton).
- **`msg.payload`-Input** (Items-Ersatz) und **`msg.ui.patch`** sind in der Spec
  zugesagt — Konsum ist zu verifizieren (interactionInputHandler +
  componentStateInputHandler); ggf. wie beim ui-icon-`msg.payload`-Follow-up (P235)
  behandeln.

### E. Was solide ist (Beleg, nicht neu aufbauen)
`items` (json/store/reactive, Legacy-`itemsPath`-Migration), `activeItem`-Highlight,
`navigate`-Event (route-Item POSTet, href-Item nicht), Base-Fields
(visible/disabled/color via `installBaseFields`, size N/A-Hinweis) — alle
outcome-getestet. **Nicht** neu aufbauen.

## acceptance

- **`displayType` wirkt beobachtbar ODER die Spec sagt die Wahrheit.** Zieltrennung
  ist ein Owner-Entscheid (s. u.). In *beiden* Fällen gilt: nach diesem Paket
  stimmen Spec und beobachtbares Verhalten überein.
  - *Falls implementieren:* jeder gewählte Modus erzeugt einen **gemessenen**
    Unterschied im DOM (z. B. distinkte Wrapper-Klasse `webapp-menu--sidebar` /
    `--topbar` und eine messbare Layout-Folge — sidebar vertikal, topbar horizontal;
    per Bounding-Box, nicht per Tag — [[verify-rendering-by-measurement-not-tags]]),
    je ein Test.
  - *Falls dokumentieren:* die Spec beschreibt die **tatsächliche** (heute: keine)
    Render-Wirkung und markiert die nicht-realisierten Modi klar als noch nicht
    umgesetzt; kein Versprechen „verändert das Layout wesentlich" ohne Deckung.
- **`collapsed` aufgelöst** — Owner-Entscheid implementieren **oder** entfernen:
  - *implementieren:* Editor-typedInput + `mapConfig`-Konsum + beobachtbarer Effekt
    (sidebar eingeklappt → nur Icons, gemessen) + Test; Spec bleibt.
  - *entfernen:* Feld raus aus Schema **und** Spec **und** `msg.ui.patch`-Liste; kein
    totes Feld bleibt.
- **`dropdown` aufgelöst** — implementieren (inkl. Trigger-Modell + Editor-Option +
  Test) **oder** aus Schema + Spec entfernen. Der Editor darf keinen Enum anbieten,
  der nicht funktioniert, und das Schema keinen Wert führen, den der Editor nicht kennt.
- **Label-Drift behoben** — Spec-Editor-Labels stimmen mit dem HTML überein
  („Items", „Active Route").
- **`variant`-Legacy-Fallback** in `mapConfig` dokumentiert **oder** entfernt
  (mit Migration) — nicht stillschweigend.
- **Input-Wahrheit** — `msg.payload`/`msg.ui.patch`-Zusagen der Spec gegen den realen
  Handler geprüft; Spec sagt das tatsächliche Verhalten (keine erfundene Patch-Fähigkeit).
- **Katalog** `ui-menu.tests.md` spiegelt die neuen/entfernten Tests.
- **E2E grün** (Haupt-Checkout); `check:specs`/`check:fields`/`check:help`/
  `check:roundtrip`/`check:links` + `pnpm validate` grün.

## verify

`browser` — jeder realisierte displayType/collapsed-Effekt per Bounding-Box/Klasse
am echten DOM gemessen; entfernte Felder erzeugen keine Schema/Spec/Editor-Reste
(Tripwires); die soliden Daten-/Event-Tests bleiben grün.

## spec

`docs/nodes/navigation/ui-menu.md` — displayType-Render-Wirkung wahrheitsgemäß,
`collapsed`/`dropdown` je nach Entscheid, Labels korrigiert, Input-Abschnitt real.

## tests

`tests/e2e/nodes/view/ui-menu.spec.ts` + `ui-menu.tests.md`. Neu: displayType-
Unterschied (falls implementiert), collapsed (falls implementiert). Die 6
bestehenden outcome-Tests bleiben.

## notes for the implementer

- **Nicht** die soliden items/activeItem/navigate/Base-Field-Tests anfassen.
- Der `config.variant`-Fallback ist dasselbe Muster wie in ui-skeleton (P241) —
  konsistent behandeln.
- `msg.ui.patch`/`msg.payload`: dieselbe knotenübergreifende Frage wie der
  ui-icon-`msg.payload`-Follow-up (P235) — hier nur die **Wahrheit** dokumentieren,
  die Richtungsentscheidung nicht einseitig treffen.

## Owner-Entscheid (vor Umsetzung zu bestätigen)

1. **`displayType`:** Die drei Layout-Modi **implementieren** (sidebar/topbar
   real unterschiedlich rendern; dropdown inkl. Trigger) — oder die Spec auf die
   **reale** (heute inerte) Wirkung **herunterschreiben** und die Modi als geplant
   markieren? Betrifft, ob ui-menu ein echtes Layout-Feature oder ein
   Daten-/Event-Knoten mit kosmetischem Enum ist.
2. **`collapsed`:** implementieren oder als totes Feld entfernen?
3. **`dropdown`:** implementieren (Trigger-Modell) oder aus Schema+Spec entfernen?
