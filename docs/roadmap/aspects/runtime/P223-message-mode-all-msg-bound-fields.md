---
id: P223
node: ui-alert
title: "Runtime: Message mode treibt JEDES msg-gebundene Feld (nicht nur das Primärfeld) — `ui-alert.visible = msg.<prop>` funktioniert; Live-Patch trägt visible/disabled"
epic: aspects/runtime
status: in_progress
dependencies: []
verify: browser
spec: docs/nodes/concepts/inputs.md
tests: tests/e2e/nodes/view/ui-alert.tests.md
---
# P223 — Message mode für alle msg-gebundenen Felder

> Rationale: [ADR 0036](../../../adr/0036-message-mode-applies-to-every-msg-bound-field.md).

## findings

Owner-Report (2026-07-13, verbatim):

> „ui-alert und der typedInput für ‚Visible': Wie funktioniert ‚msg.' als type?
> Ich schicke eine `msg.visible = true` und `msg.visibility = true` und nix
> passiert."

Getrackt (`nodes/webapp.js`): der Message-mode-Push (`viewNodePatchInputHandler`)
aktualisiert **nur das Primärfeld** (`VIEW_NODE_PRIMARY_FIELD`, ui-alert →
`message`). Ein `msg`-gebundenes `visible` wird nie gelesen; der Live-Patch-Merge
(`VIEW_NODE_BINDING_FIELDS` = value/src/message/rows/items) trägt `visible`/
`visibleIf` nicht; und zur Render-Zeit löst eine `msg`-Bindung zu `""` → `false` auf
(Alert bliebe versteckt). Der `msg`-Typ ist damit auf `visible`/`disabled` (und
jedem Nicht-Primärfeld) ein Footgun.

## acceptance

- **Alle msg-gebundenen Felder werden getrieben.** Trifft eine Message ein,
  aktualisiert `viewNodePatchInputHandler` **jedes** Feld, dessen gespeicherte
  Bindung `{kind:"msg", path}` ist — jeweils aus dessen **eigener** konfigurierter
  Message-Property (Source-Path pro Feld einmalig gecaptured, wie heute fürs
  Primärfeld). Nicht nur `VIEW_NODE_PRIMARY_FIELD`.
- **`ui-alert.visible = msg.<prop>` schaltet live.** Mit `visible` = Typ `msg`
  (path z.B. `visible`) blendet `msg.visible = true` die Alert **ein**,
  `msg.visible = false` **aus** — im laufenden App bewiesen. Wert wird zu Boolean
  koerziert (`true`/`false` und `"true"`/`"false"`).
- **Live-Patch trägt visible/disabled.** Der Snapshot-Merge (buildDefinitions /
  `VIEW_NODE_BINDING_FIELDS`) wird generalisiert, sodass ein zur Laufzeit
  aktualisiertes `visible`/`disabled` (→ `visibleIf`/`enabledIf`) den gepushten
  Snapshot erreicht.
- **Back-compat.** Der Legacy-Fall (bare `msg.payload` ohne explizite `msg`-Bindung
  aktualisiert das Primärfeld) bleibt erhalten. Bestehende ui-text/ui-image/…
  Message-Mode-Tests bleiben grün.
- **JSONata analog.** Ein JSONata-gebundenes Nicht-Primärfeld wird ebenso gegen die
  eingehende `msg` ausgewertet (konsistent zum Primärfeld-JSONata-Pfad).
- **Katalog/Spec.** `docs/nodes/concepts/inputs.md` dokumentiert: Message mode gilt
  pro Feld (nicht nur Primärfeld); `visible`/`disabled` sind message-treibbar.

## verify

`browser` — `ui-alert` mit `visible = msg.show`; ein `inject`/`trigger` mit
`msg.show = false`/`true` blendet die Alert im laufenden App aus/ein (Playwright).

## spec

`docs/nodes/concepts/inputs.md` — Message-mode-Kontrakt pro Feld.

## tests

`tests/e2e/nodes/view/ui-alert.tests.md` (+ ggf. ein generischer Message-mode-Test)
— `visible = msg` toggelt die Alert; ein zweites Nicht-Primärfeld message-getrieben.

## notes for the implementer

- Kernstellen: `viewNodePatchInputHandler` (~5827), `VIEW_NODE_PRIMARY_FIELD`
  (~5679), `VIEW_NODE_BINDING_FIELDS` (~5705), der Live-Patch-Merge in
  buildDefinitions (~2884). `visible`→`visibleIf` / `disabled`→`enabledIf` Mapping
  existiert in mapConfig (P172) — der Push muss den Wert so einspeisen, dass der
  Merge ihn trägt.
- Renderer bleibt unverändert (reaktive Auflösung existiert; der Wert kommt jetzt
  als Literal über den Push).
- Kein Editor-Change nötig — der `msg`-Typ wird bereits angeboten.
- **Separater, optionaler Follow-up (nicht dieses Paket):** `ui-alert` (und weitere
  fehlende Knoten) ins imperative `show`/`hide`-Verben-System einbinden
  (`INTERACTION_VERBS_BY_TYPE`) — ui-alert fehlt dort komplett.
