# Testkatalog: ui-switch

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit der Planung von P125
> (ADR 0012 — Binding-Ubiquität).

## Testziele

### P44 — Basis-Rendering + Events
- `value` (literal boolean) → `sl-switch` ist sichtbar mit Label.
- `disabled: { kind:"literal", value:true }` → `sl-switch[disabled]` ist sichtbar.
- `sl-change`-Event → POST /event `{ event:"change", params:{ checked: bool } }`.

### P73 — labelOn / labelOff
- `labelOn`/`labelOff` werden als `label-on`/`label-off`-Attribute auf `sl-switch` gerendert.
- Ohne `labelOn`/`labelOff` keine entsprechenden Attribute.

### P125 — value → kanonischer typedInput + valuePath-Migration + bindbares disabled

#### value-Binding (kanonischer typedInput, voller Satz)
- Neuer Knoten ohne `valuePath`: `value` öffnet als `bool`-Literal (Default-Typ).
- `value: { kind:"literal", value:true }` → Switch ist initial eingeschaltet.
- `value: { kind:"literal", value:false }` → Switch ist initial ausgeschaltet.

#### valuePath-Migration (Legacy → state-Binding)
- Knoten mit Legacy-`valuePath:"darkMode"` und `value:null` → Runtime liest
  `{ kind:"state", path:"darkMode" }` aus `mapConfig` (bereits serverseitig
  implementiert); Editor öffnet beim nächsten Öffnen das state-Binding.
- Nach Speichern ist `valuePath` leer und `value` enthält das Binding-Objekt.

#### disabled — Boolean-Zustand-typedInput inkl. Store
- `disabled: { kind:"literal", value:true }` → `sl-switch[disabled]` sichtbar.
- `disabled: { kind:"literal", value:false }` → `sl-switch` aktiv (kein disabled-Attribut).
- `disabled` mit Store-Binding (truthy) deaktiviert den Switch live, sobald der
  Store-Wert truthy ist.
- `disabled` ohne Binding (null / leer) → Switch bleibt aktiv.

#### writeTo Write-Back (P204 / ADR 0027 — gemessen, keine Verdrahtung)
- **W01** — `value=store(x).on` UND `writeTo=store(x).on`: Toggle (`sl-change`,
  `checked=true`) schreibt per-client in den Store; ein ZWEITER an `store(x).on`
  gebundener `ui-text` flippt live (SSE, Textinhalt `false`→`true`), ohne
  function-Knoten. Switch hat keine Submit-Geste → schreibt bei `change`
  unabhängig vom `writeTrigger`.
