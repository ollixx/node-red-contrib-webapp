---
id: P246
node: ui-log
title: "Konformitäts-Pass ui-log (leicht) — fehlender Test-Katalog, anomales editierbares `uiId`-Feld, Hilfe-Detail; Knoten sonst solide"
epic: aspects/node-conformance
status: pending
dependencies: []
verify: browser
spec: docs/nodes/feedback/ui-log.md
tests: tests/e2e/nodes/view/ui-log.tests.md
---
# P246 — Konformitäts-Pass ui-log (leicht)

> Audit 2026-07-17 (node-conformance). ui-log ist **solide** — detaillierte,
> akkurate Spec (Felder, Input/Output=keine, Eintragsformat, ui-toast-Abgrenzungs-
> tabelle, Theming); gute Inline-Hilfe; korrekte Base-Fields (`installBaseFields`,
> `visible` aktiv, `disabled`/`color` N/A mit Hinweisen); **5 outcome-E2E** über
> alle drei Felder (minSeverity-Filter, maxEntries-Cap, collapsed-Default,
> Backend-Fehler erscheint, sl-details-Panel). Nur kleine Lücken.

## findings

### A. Kein Test-Katalog (Dimension 5)
Es gibt **kein** `tests/e2e/nodes/view/ui-log.tests.md`. Der Katalog ist laut
`.ai/agents/node-testing.md` + `roadmap-phase-schema.md` **Pflicht**; die fünf
bestehenden E2E-Tests sind nirgends als Testziele katalogisiert.

### B. Anomales editierbares `uiId`-Feld
Der Editor exponiert `uiId` als editierbares Textfeld
(`defaults.uiId: { value:"", required:true }` + `<input id="node-input-uiId">`,
Label „Node ID"). **Nur drei Knoten** tun das: ui-log,
`ui-component-instance`, `ui-component-definition` — die beiden Component-Knoten
haben einen legitimen Grund (sie werden **per id referenziert**). **ui-log hat
keinen:** keine Ports, nichts referenziert ein ui-log per id, `mapConfig` nutzt
das Standard-`getUiId(config)`. Der übrige View-Knoten-Satz (skeleton, menu, …)
trägt `uiId` **gar nicht** in den Editor-`defaults`. ⇒ Ein Fußangel-Feld: der Autor
kann eine interne Id ohne Zweck eintippen (Kollisions-/Bruch-Risiko).

### C. Inline-Hilfe: fehlender `forwardErrorsToClient`-Hinweis
Die Hilfe ist gut (Zweck, SSE, ui-toast-Kontrast, drei Felder, Doku-Link), aber
die Spec schreibt ausdrücklich einen **Hinweis auf `forwardErrorsToClient`** (am
`ui-app`) vor — ohne diese App-Einstellung zeigt ui-log **nie** Einträge. Der
tatsächliche Hilfetext nennt es nicht; ein Autor sieht ein leeres Panel ohne Grund.

### D. `collapsed=true`-Richtung ungetestet
Der E2E prüft `collapsed=false` (Panel offen per Default). Die andere Richtung
(`collapsed=true` → Panel startet eingeklappt, `sl-details` **ohne** `open`) ist
nicht belegt.

### E. Was solide ist (nicht anfassen)
minSeverity-Filter, maxEntries-FIFO-Cap, Backend-Fehler-Anzeige, sl-details-Render,
Base-Fields, Spec, ui-toast-Abgrenzung — alle korrekt/getestet.

## acceptance

- **Test-Katalog angelegt.** `tests/e2e/nodes/view/ui-log.tests.md` existiert und
  listet die (bestehenden + neuen) Tests mit Testziel, Format nach
  `.ai/agents/node-testing.md` — mindestens: sl-details-Render, minSeverity-Filter,
  maxEntries-Cap, collapsed=false (offen), collapsed=true (eingeklappt),
  Backend-Fehler erscheint.
- **`uiId`-Feld entfernt.** Das editierbare `uiId`-Textfeld und der
  `defaults.uiId`-Eintrag sind aus `nodes/view/ui-log.html` **entfernt**; ui-log
  bezieht seine `uiId` wie jeder andere View-Knoten (runtime `getUiId`, kein
  Editor-Feld). Öffnen→Speichern eines bestehenden ui-log bleibt verlustfrei
  (`check:roundtrip` grün); der Knoten rendert unverändert.
- **`collapsed=true` beobachtbar belegt.** Neuer E2E (gemessen): `collapsed:true`
  ⇒ das `sl-details`-Panel startet **eingeklappt** (kein `open`-Attribut / Inhalt
  nicht sichtbar), abgrenzbar vom bestehenden collapsed=false-Test.
- **Inline-Hilfe** ergänzt den `forwardErrorsToClient`-Hinweis (ohne diese App-
  Einstellung keine Einträge); Doku-Link bleibt.
- **Keine Regression** der soliden Teile; `check:specs`/`check:fields`/`check:help`/
  `check:roundtrip`/`check:links` + `pnpm validate` + E2E (Haupt-Checkout) grün.

## verify

`browser` — `collapsed=true`/`=false` per gemessenem `sl-details`-Zustand belegt;
der entfernte `uiId`-Roundtrip verlustfrei; die vier bestehenden Feld-Tests bleiben grün.

## spec

`docs/nodes/feedback/ui-log.md` — akkurat; ggf. den Hilfe-Vorgabetext an den
`forwardErrorsToClient`-Hinweis angleichen. Keine Feld-Änderung nötig (uiId ist im
Schema kein ui-log-spezifisches Feld — nur das Editor-Leak wird entfernt).

## tests

Neu: `tests/e2e/nodes/view/ui-log.tests.md` (Katalog) + `collapsed=true`-Test in
`tests/e2e/nodes/view/ui-log.spec.ts`.

## notes for the implementer

- **`uiId`-Entfernung:** prüfen, dass ui-log auch ohne das Editor-Feld eine stabile
  `uiId` bekommt (das tun alle anderen View-Knoten). Falls ein Alt-Flow ein
  getipptes `uiId` trägt, bleibt es als Node-Property erhalten — nur die
  Editier-Zeile verschwindet. **Nicht** die Component-Knoten anfassen (dort ist das
  Feld legitim).
- **Nicht** die soliden minSeverity/maxEntries/Backend-Fehler-Tests neu aufbauen —
  nur den Katalog nachziehen und collapsed=true ergänzen.
- Leichter Pass — Umfang strikt auf A–D halten.
