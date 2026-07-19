---
id: P253
title: "Muster-4-Abschluss (input/switch/textarea) — Binding-Doku + `ui-textarea.placeholder`-Serializer-Fix (live Bug) + Binding-Tests; check:binding-docs-Allowlist → leer"
epic: aspects/node-conformance
status: pending
dependencies: []
verify: browser
spec: docs/nodes/input/ui-textarea.md
tests: tests/e2e/nodes/view/ui-textarea.tests.md
---
# P253 — Muster-4-Abschluss: input / switch / textarea

> Rationale: der **empfohlene Follow-up aus P237** (done). P237s Guardrail
> `check:binding-docs` fand die Muster-4-Drift auf drei weiteren Knoten und
> allowlistete sie mit dem Grund „je eigener Konformitäts-Pass". Dieses Paket
> schließt den Sweep ab und treibt die Allowlist auf **leer**. Setzt
> [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md)
> durch (wie P237). Kein neuer ADR.

## findings

Aus P237 (Guardrail-Ertrag, je per Probe bestätigt: Bindung löst auf):
- **`ui-input.label`** — bindbar (Schema-Union), aber Spec-Zeile dokumentiert es nicht
  als bindbar; Bindung löst auf + rendert. **Allowlisted.**
- **`ui-switch.label` / `labelOn` / `labelOff`** — alle drei bindbar; Bindung löst auf
  (label / `label-on` / `label-off`-Attr). **Allowlisted.**
- **`ui-textarea.label`** — bindbar; löst auf. **Allowlisted.**
- **`ui-textarea.placeholder` — LIVE BUG:** die Bindung löst auf, aber der
  `sl-textarea`-Serializer **omittiert das `placeholder`-Attribut** (exakt der
  Bug-Typ, den P237 an `ui-datepicker.placeholder` fixte). **Allowlisted.**

Alle drei Knoten sind **sonst konform** (input 20 E2E, switch 13, textarea 9 —
alle mit Katalog, Base-Fields, Write-Back-Tests). Dies ist der einzige Restpunkt.

## acceptance

- **Doku-Fix (Muster 4):** in `docs/nodes/input/ui-input.md`,
  `docs/nodes/input/ui-switch.md`, `docs/nodes/input/ui-textarea.md` sind die
  betroffenen Felder als **bindbar** dokumentiert (typedInput, Binding-Kinds) — im
  kanonischen Wortlaut; keine „Textfeld"/„kein Binding"-Aussage auf einem
  bindbaren Feld mehr.
- **`ui-textarea.placeholder`-Serializer-Fix:** der `sl-textarea`-Serializer
  (`resources/lib/webapp-serializer.js`) emittiert das aufgelöste `placeholder`-Attribut
  (Muster: der datepicker-Fix aus P237). Browser: ein `state`/`store`-gebundener
  Placeholder erscheint **gemessen** als `placeholder="<aufgelöst>"` am `sl-textarea`.
- **Binding-Test-Lock je Feld:** eine gemessene Assertion, dass ein gebundener Wert
  auflöst + rendert (Muster: `packages/runtime/test/p237-*-binding.test.ts`):
  input.label, switch.label/labelOn/labelOff, textarea.label, textarea.placeholder.
- **Allowlist leer:** `scripts/check-binding-docs.js` läuft mit **leerer** Allowlist
  grün (die 6 Einträge sind entfernt).
- **Kataloge** der drei Knoten spiegeln die neuen Tests.
- **E2E grün** (Haupt-Checkout); `check:binding-docs`/`check:specs`/`check:fields`/
  `check:help`/`check:roundtrip`/`check:links` + `pnpm validate` grün.

## verify

`browser` — der textarea-placeholder-Fix im echten DOM gemessen; die Binding-
Auflösungen belegt; `check:binding-docs` grün mit leerer Allowlist.

## spec

`docs/nodes/input/ui-input.md`, `ui-switch.md`, `ui-textarea.md` — betroffene
Felder als bindbar.

## tests

Neue Binding-Tests (Unit-Muster p237-*) + ggf. E2E für textarea.placeholder;
Kataloge der drei Knoten.

## notes for the implementer

- **`ui-textarea.placeholder` ist ein echter Bug** (nicht nur Doku) — der
  datepicker-Fix aus P237 (`webapp-serializer.js`) ist die exakte Vorlage.
- Die anderen fünf Felder sind reiner Doku + Test-Lock (Bindung löst schon auf).
- Nach dem Fix: die 6 Allowlist-Einträge in `scripts/check-binding-docs.js` löschen;
  der Check muss mit `{}` grün bleiben — sonst ist ein Feld noch nicht sauber.
- **Nicht** die umfangreiche bestehende Coverage der drei Knoten neu aufbauen.
