---
id: P111
title: "ui-text: variant→style (typografische Rolle) + neue Farb-variant, size entfernen"
epic: nodes/ui-text
node: ui-text
status: in_progress
dependencies: [P20b]
verify: browser
spec: docs/nodes/display/ui-text.md
tests: tests/e2e/nodes/view/ui-text.tests.md
---
# P111 — ui-text: style/variant-Achsen + Farbe

> **Offenes Paket.** Sammelpaket aus dem ui-text-Review. Die erste Tranche
> (Achsen-Split + Farbe + size-Entfernung) ist geliefert; weitere Findings zum
> ui-text werden hier angehängt, bevor das Paket geschlossen wird.

## findings (Nutzer-Wortlaut)

- "nächster knoten zum review: ui-text" — beim Review fiel auf: die `variant`-Werte
  (heading-1/…/muted) erzeugen **keinen sichtbaren Unterschied** (einziges CSS war
  `.webapp-text { font-size:1.05rem }`); eine Überschrift sah aus wie Fließtext.
- "ja, (color) variants gibt es für text: siehe bootstrap-vue color-variants /
  shoelace color tokens."
- "Size macht keinen Sinn."
- "Dafür sollten wir das jetzige Feld variants umbenennen in style. Das entspricht
  ja dem HTML Tag, das für den Text genutzt wird."

## acceptance (observierbar)

- **Browser:** `style: "heading-1"` rendert ein `<h1>` mit Klasse
  `webapp-text--heading-1`; eine Überschrift ist sichtbar größer/fetter als `body`.
  `style: "code"` rendert ein `<code>` in Monospace. `body` rendert ein `<p>`.
- **Browser:** `variant` ist die **Farb-Achse** (`default`/`muted`/`primary`/
  `success`/`warning`/`danger`/`neutral`). `variant: "danger"` ergänzt die Klasse
  `webapp-text--color-danger` und färbt den Text rot; `default` erbt die Textfarbe.
- **Schema/Editor:** Das `size`-Feld existiert nicht mehr (weder im Schema, im
  Editor-Dialog noch in der Doku); ein `size`-Wert wird ignoriert/abgelehnt.
- **Editor:** Es gibt einen **Style**-Select (typografische Rolle) und einen
  **Variant**-Select (Farbe); kein Size-Select mehr.
- **Back-Compat (Browser):** Ein Alt-Flow mit `variant: "heading-2"` wird zur
  Laufzeit auf die `style`-Achse migriert und rendert als `<h2>`; der alte
  `muted`-Rollenwert migriert auf `variant: "muted"` (Farbe).

## Result (erste Tranche — geliefert)

**Delivered:**
- Schema: `TEXT_VARIANTS` aufgeteilt in `TEXT_STYLES` (Rolle) + `TEXT_COLOR_VARIANTS`
  (Farbe); `uiTextNodeDefinitionSchema` führt `style` + `variant`, `size` entfernt.
- Runtime (`nodes/webapp.js`): ui-text `mapConfig` mit transparenter Legacy-Migration
  (`variant`-Rolle → `style`, alter `muted`-Rollenwert → Farbe), Page-CSS für alle
  Rollen + Farben.
- Serializer (`resources/lib/webapp-serializer.js`): Text rendert das semantische
  Tag (`h1/h2/h3/p/small/span/code`) + `webapp-text--<rolle>` + `webapp-text--color-<farbe>`.
- Editor: `installTextStyleSelectBox` (Style-Select) neu, `variant`-Select = Farbe,
  Size-Select entfernt (`editor-common.js`, `ui-text.html`); Editor-Package-Typen.
- Doku + Tests-Katalog aktualisiert.

**Stats:** Build + Lint + alle Unit-Tests grün (`pnpm validate` EXIT=0); ui-text-E2E
grün (inkl. neuer style/variant/back-compat Specs).

## Tranche 2 — Wert-Quellen / typedInput schärfen

### findings (Nutzer-Wortlaut)

- "Die Typed Inputs müssen geschärft werden. Ich hatte msg. probiert, aber eine
  incoming message wird da nicht verarbeitet. Das ist konzeptionell auch
  unterschiedlich."
- "Wenn ich 'Store' nutze, muss das Feld gebunden werden, reactive. Wenn ich 'Msg'
  wähle, dann muss der quasi statische Wert auch irgendwo gespeichert werden im
  Frontend, aber dann eben nicht in einem Store (bzw. keinem, der ein ui-store im
  backend hat)."

### Befund (technisch)

- Der Renderer (`packages/renderer`, Snapshot-Wahrheit) löst nur 5 Binding-Arten
  auf: `literal`, `state`, `query`, `routeParam`, `store`. `msg`/`flow`/`global`/
  `jsonata`/`env` fallen durch → rendern `"?"`.
- Der ui-text-Editor bot genau die nicht-auflösbaren Arten an (`msg/flow/global/
  jsonata/env`) und **ließ `store` weg** (obwohl Renderer + Doku es führen).
- `webapp.js#resolveBinding` (kann msg/flow/global/env) ist **toter Code**.
- Eine eingehende Message wird **nicht** über das `{kind:"msg"}`-Binding verarbeitet,
  sondern über `viewNodePatchInputHandler`: `msg.payload` → als **Literal** verpackt
  → Live-Definition (backend) → Snapshot-Push. Das ist ein **anderes Konzept** als
  ein reaktives Binding.

### Entscheidungen (Owner)

- **Wert-Quellen für ui-text:** `Literal`, `Store`, `Query`, `Route-Param`
  (reaktiv) **+ `flow`/`global`/`env`** (serverseitig EINMALIG aufgelöst, nicht
  reaktiv) **+ `msg`** (Standard-Node-RED-Binding mit Pfad-Feld). **`jsonata` und
  `state` entfallen** aus dem ui-text-Editor — `state` ist zu mächtig / nicht klar
  gegen `store` abgegrenzt. (Schema + Renderer behalten `state`-Support für andere
  Knoten; nur die ui-text-Editor-Option fällt weg. Das Beispiel nutzt `state` nur auf
  ui-button/ui-table/ui-badge/ui-input, nicht auf ui-text — kein Bruch.)
- **`msg` (Standard-Node-RED-Binding):** backend-seitig — der Input-Handler liest die
  **konfigurierte Message-Property** (z. B. `payload`, `payload.label`, `topic`) der
  eingehenden Nachricht, hält den letzten Wert in der Live-Definition, teilt ihn mit
  allen Clients (verloren bei Redeploy/Neustart); vor der ersten passenden Message
  rendert das Feld **leer** (nicht `"?"`).
  - _Korrektur ggü. erstem Entwurf: zunächst war ein pfadloser „Message"-Modus
    umgesetzt; der Owner wollte das **normale** node-red `msg`-Binding mit Pfad._

### acceptance (observierbar)

- **Editor:** Der Wert-typedInput bietet `Literal`, `Store` (Picker), `Query`,
  `Route-Param`, `msg` (Standard mit Pfad), `flow`, `global`, `env`.
  **Kein** `jsonata`, **kein** `state`.
- **Browser (reaktiv):** `Store` gewählt → Text ist an den ui-store gebunden; ändert
  sich der Store, aktualisiert sich der Text (wie `state`).
- **Browser (server-resolved):** `flow`/`global`/`env` → der Wert wird serverseitig
  aus dem Node-RED-Kontext/Env aufgelöst und als Text gerendert (einmalig pro
  Render; nicht reaktiv auf Kontextänderung ohne Re-Render).
- **Browser (msg):** `msg` mit Pfad `payload` → Feld rendert zunächst **leer**; eine
  an den Knoten gesendete Nachricht setzt den Text aus der konfigurierten Property und
  pusht ihn an alle Clients. Mit Pfad `payload.label` wird die **verschachtelte**
  Property gelesen (nicht der ganze Payload).
- **Kein `"?"` mehr** für eine im Editor wählbare Quelle (die kaputten Arten sind weg
  bzw. aufgelöst).

### Result (Tranche 2 — geliefert)

**Delivered:**
- Renderer (`packages/renderer`): `msg`-Binding rendert **leer** (nicht `"?"`) bis ein
  Wert gepusht wird.
- Runtime (`nodes/webapp.js`): `resolveContextBindingsForDef` löst `flow`/`global`/`env`
  Wert-Bindings serverseitig pro Render in Literale auf (über den Node-Kontext /
  `RED.util.evaluateNodeProperty`); eingehängt in `readDeployDefinitions`. Der
  Input-Handler `viewNodePatchInputHandler` ist **pfad-bewusst**: bei einem
  `msg`-gebundenen Feld liest er die konfigurierte Message-Property (einmalig captured,
  da der erste Push das Binding zum Literal überschreibt) via `evaluateNodeProperty`.
- Editor (`ui-text.html`): typedInput-Set = `Literal, Store (Picker), Query,
  Route-Param, msg (Standard mit Pfad), flow, global, env`. `jsonata` + `state` raus,
  `store` rein. Hilfetext nach den drei Kategorien gegliedert.
- Doku (`ui-text.md`): neue Sektion „Wert-Quellen" (3 Kategorien) + Feldtabelle +
  Input-Sektion aktualisiert. Tests-Katalog erweitert.

**Stats:** `pnpm validate` EXIT=0 (1143 Unit-Tests, Lint, Tripwires); ui-text-E2E 10/10
grün (inkl. Store-Binding + `msg`-Binding mit `payload` und verschachteltem
`payload.label`); Regression p104 (11) + layout-apps grün.

### Hinweis (systemweit, Folge-Paket)

`bindingTypedInputTypes` (geteilt, von ui-alert/ui-breadcrumb genutzt) bietet
denselben kaputten Satz an (`msg`/`jsonata`). Dieselbe Schärfung gehört dorthin —
als eigenes cross-cutting Paket, wenn die betroffenen Knoten an der Review-Reihe
sind. Die serverseitige `flow`/`global`/`env`-Auflösung ist bereits generisch (greift
für alle Knoten), sodass dort nur noch die Editor-Sätze nachzuziehen sind.

## Offen (kommt noch dazu)

- _Weitere ui-text-Findings aus dem laufenden Review hier ergänzen, bevor das Paket
  nach `done/` wandert._
