---
id: P184
node: ui-repeat
epic: nodes/ui-repeat
title: "Scope-lokale Bindings mit leerem Pfad reparieren: whole-`item` (z. B. String-Element) und `index` werden mit path:'' serialisiert/validiert → 'Binding paths must not be empty' + 'must not carry a path'"
findings:
  - "Owner (2026-06-14): 'Wie binde ich ein ui-text an das item, wenn es nur ein String ist?' — der vorgesehene Weg (Typ 'Item (Repeat)', Pfad leer = ganzes Element) schlägt fehl."
  - "Owner (2026-06-14): Binding-Typ 'index' liefert einen Fehler: 'Invalid ui-text definition: value.path: Binding paths must not be empty. value: An index binding is the bare item position — it must not carry a path.'"
  - "Code-Befund: bindingSchema (packages/schema/src/contracts.ts:198) hat path: z.string().min(1).optional() — .optional() greift nur bei undefined, NICHT bei ''. Der Editor serialisiert aber index als {kind:'index', path:''} (und whole-item als path:'') → die .min(1)-Regel UND die index/item-Refines feuern beide. Whole-item (String-Element) bricht identisch."
acceptance:
  - "Ein ui-text mit Binding {kind:'item'} (ganzes Element, KEIN Pfad) auf ein String-Element rendert den String — keine Validierungsfehler."
  - "Ein ui-text mit Binding {kind:'index'} (KEIN Pfad) rendert die nullbasierte Position — kein 'must not be empty' / 'must not carry a path'."
  - "Editor-Serialisierung: whole-item und index werden OHNE path-Schlüssel gespeichert (leerer Pfad wird weggelassen, nicht als '' gesetzt); item MIT Feldpfad speichert den Pfad weiterhin."
  - "Schema-Toleranz/Migration: ein bestehend gespeichertes path:'' auf item/index/prop wird wie 'kein Pfad' behandelt (normalisiert), sodass Altflows validieren statt rot zu werden."
  - "Negativ bleibt rot: ein index MIT echtem (nicht-leerem) Pfad; ein item-Pfad, der dem dotted-field-Muster nicht entspricht."
  - "prop (whole, kein Pfad) verhält sich analog (gleiche Leerpfad-Behandlung)."
verify: browser
spec: docs/nodes/display/ui-repeat.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: []
status: pending
---
# P184 — Scope-lokale Bindings mit leerem Pfad reparieren

> **Bug, blockiert ui-repeat-Grundnutzung.** Man kann derzeit weder an ein
> **String-Element** (whole `item`) noch an **`index`** binden — beide tragen
> `path:''`, und das Schema lehnt leere Pfade ab. Frage 1 + 2 des Owners sind
> dieselbe Ursache.

## Kern des Fixes (zwei Seiten)

1. **Editor (Serialisierung):** `index` als `{kind:'index'}` und whole-`item`/
   whole-`prop` als `{kind:'item'}`/`{kind:'prop'}` speichern — **leeren Pfad
   weglassen**, nicht `path:''` setzen (`applyValueBinding`, `resources/lib/
   editor-common.js`).
2. **Schema (Toleranz):** in `contracts.ts` `path` für die scope-lokalen Kinds so
   behandeln, dass `''` ≡ „kein Pfad" ist — z. B. `path` vor der `.min(1)`-Prüfung
   auf `undefined` normalisieren, wenn leer, **bevor** die index/item/prop-Refines
   laufen. So validieren auch Altflows mit `path:''` (Migration ohne Re-Save).

Damit löst sich **Frage 1** (String-Element binden = Typ „Item (Repeat)", Pfad
leer) **und Frage 2** (index) zugleich.

## acceptance / verify

- `verify: browser` — im laufenden Repeat: String-Items via whole-`item`,
  Positionen via `index`; E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).
- Schema-Unit: `{kind:'item'}`/`{kind:'index'}`/`{kind:'prop'}` ohne Pfad gültig;
  `path:''` toleriert; `index` mit Pfad + malformierter item-Pfad rot.

## Risiken / Hinweise

- **Invariante:** `packages/schema` importiert aus keinem anderen Repo-Paket.
- Sofort-Workaround für den Owner bis zum Fix: Items als Objekte `{label:"A"}`
  modellieren und `item.label` binden (item-MIT-Pfad ist nicht betroffen).
- Reine Form-Validierung + Editor-Serialisierung — **kein** Renderer-/Scope-
  Auflösungs-Wechsel (P164 bleibt).
