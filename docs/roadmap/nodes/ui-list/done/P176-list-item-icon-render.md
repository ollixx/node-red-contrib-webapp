---
id: P176
node: ui-list
epic: nodes/ui-list
title: "ui-list: per-Item-Icon rendern (führendes <sl-icon>) — row.icon wird vom Serializer ignoriert"
findings:
  - "Owner (2026-06-14): 'ich habe in ui-list auch ein item mit icon gesetzt. Das Icon wird nicht gerendert.'"
  - "Code-Befund: der list-Block im Serializer (resources/lib/webapp-serializer.js, ~Z. 1092–1130) baut label + value (secondary/badge), liest aber row.icon NIE. Der vorhandene renderIconHtml-Helfer (erzeugt <sl-icon>, von ui-button/ui-icon/ui-breadcrumb genutzt) wird für die Liste nicht aufgerufen."
acceptance:
  - "Ein Item mit icon (bare String wie 'user' ODER {library?,name}) rendert ein FÜHRENDES <sl-icon> vor dem Label (via renderIconHtml, backend-neutral); fehlt icon → kein Icon (unverändert)."
  - "Icon rendert konsistent in allen Zuständen: interaktiv (itemClick/selectable, innerhalb des <a>) und nicht-interaktiv (nacktes <li>); zusammen mit value (secondary/badge) und displayType."
  - "String-Kurzform (Item ist ein String) hat kein icon — kein Bruch."
  - "E2E: eine Liste mit gemischten Items (mit/ohne icon) zeigt die Icons an den richtigen Zeilen; Snapshot/Spec/Testkatalog aktualisiert."
verify: browser
spec: docs/nodes/display/ui-list.md
tests: tests/e2e/nodes/view/ui-list.tests.md
dependencies: []
status: done
---
# P176 — ui-list: per-Item-Icon rendern

> Kleiner, klar umrissener Bugfix. Das Item-Schema verspricht ein führendes
> `icon` (Spec [Item-Schema](../../../../nodes/display/ui-list.md#item-schema--das-datenmodell)),
> der Serializer setzt es aber nicht um.

## Kern des Fixes

Im `kind === "list"`-Block von `resources/lib/webapp-serializer.js` pro Zeile das
Icon erzeugen und **vor** das Label setzen:

```js
const iconHtml = renderIconHtml(row.icon, { /* leading, ggf. slot/size */ });
// interaktiv:    ... >" + iconHtml + label + valueHtml + "</a></li>"
// nicht-interakt: "<li ...>" + iconHtml + label + valueHtml + "</li>"
```

`renderIconHtml` ist schon im Serializer vorhanden (normalisiert
`{library?,name}` / bare String → `<sl-icon>`, Shoelace-Default-Library). **Kein**
neuer Helfer, **kein** Schema-/Renderer-Wechsel — nur die fehlende Zeile im
List-Block.

## Spec / Tests

- Spec: den „Offene Punkte"-Eintrag zum Icon-Rendering schließen — `icon` ist ein
  **backend-neutraler** Icon-Wert (bare Name gegen die Shoelace-Default-Library
  oder `{library,name}`), gerendert als führendes `<sl-icon>`. Item-Schema-Tabelle
  ggf. präzisieren.
- Tests: `ui-list.tests.md` + E2E um eine Icon-Zeile erweitern (mit/ohne icon,
  interaktiv/nicht-interaktiv).

## acceptance / verify

- `verify: browser` — Icons im laufenden Frontend sichtbar; E2E im Haupt-Checkout
  durch den Orchestrator ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- Position/`slot`: bei `<li>`/`<a>` gibt es keinen Shoelace-`slot` — das Icon
  einfach als führendes Inline-`<sl-icon>` vor das Label setzen (Abstand via CSS-
  Klasse, z. B. `webapp-list-item-icon`).
- Konsistenz mit ui-icon/ui-button (gleicher `renderIconHtml`-Pfad) wahren.

## Result

- **delivered:** Fixed the per-item icon in ui-list — the `kind==="list"` serializer block
  (`resources/lib/webapp-serializer.js`) now calls the pre-existing `renderIconHtml(row.icon, …)`
  per row and injects a **leading `<sl-icon class="webapp-list-item-icon …">`** before the label in
  BOTH the interactive (`<a>`, itemClick/selectable) and non-interactive (`<li>`) branches;
  backend-neutral (bare string vs `{library?,name}`, Shoelace default library), the same path
  ui-button/ui-icon/ui-breadcrumb use. Missing `icon` → no icon (unchanged); string-shorthand items
  (no `.icon`) untouched. No schema/renderer/editor change.
- **stats:** 3 files (+156); +4 ui-list E2E (I01–I04). Develop verification: `pnpm build` exit 0;
  unit **1537** green; ui-list view spec **16/16 green** — I01 (non-interactive bare-string icon, no
  icon when absent), I02 (interactive icon inside `<a>`), I03 (object-form `{name}` + string-shorthand
  safety), I04 (icon + badge coexist: icon leads, badge follows). check:roadmap + check:links + lint
  OK; minimal-coverage unaffected (no editor field change).
- **notes:** Pure serializer fix using the existing helper — no new mechanism. Spec doc's
  item-schema icon open-point closed.
- **cost:** session ac6c3eeee912473ca, ~8m (+ orchestrator develop E2E).
