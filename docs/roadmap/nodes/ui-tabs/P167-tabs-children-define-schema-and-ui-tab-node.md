---
id: P167
node: ui-tabs
epic: nodes/ui-tabs
title: "ui-tabs: Kinder definieren Tabs — neues ui-tab-Kind (label/icon/order + Slot), tabs-JSON entfällt, Migration"
findings:
  - "Owner-Idee (2026-06-12): Ein Container mit N Slots. Jedes Kindelement des ui-tabs ist ein Slot, der Slot heißt wie das Kind. Die müssen eindeutig sein (Validierung). Die Tabs werden NICHT über die Option im Editor festgelegt."
  - "Owner-Entscheidung (2026-06-12): Modell 1a (Kinder definieren Tabs) statt Config-Array oder umgekehrter Verknüpfung."
acceptance:
  - "Neues Knoten-Schema ui-tab: Container-Kind mit label (Wert-typedInput), icon (optional), order (Zahl) und einem Default-Slot; validiert in Fixtures."
  - "ui-tabs-Schema: tabs-JSON-Feld entfernt; ui-tabs akzeptiert ui-tab-Kinder und leitet pro Kind einen Slot ab (Slot-Key = Kind-id)."
  - "Validierung: Kind-Namen/-ids innerhalb eines ui-tabs eindeutig — Duplikat → Schema-/Validierungsfehler."
  - "activeTab trägt jetzt die Kind-id; Default = erstes Kind nach order (Schema-Default dokumentiert)."
  - "Migration: ein bestehender ui-tabs-Knoten mit tabs:[{id,label}] wird auf ui-tab-Kinder abgebildet (ein Kind je Eintrag, id/label erhalten); bestehende tab:<id>-Child-Mounts zeigen auf den neuen Kind-Slot. Als reine Mapping-Funktion test-bar."
verify: unit
spec: docs/nodes/navigation/ui-tabs.md
tests: tests/e2e/nodes/view/ui-tabs.tests.md
dependencies: []
status: in_progress
---
# P167 — ui-tabs: Kinder-definieren-Tabs (Schema + ui-tab-Knoten)

> Erste Schicht von ADR 0018. Rein im `packages/schema` (+ Migrations-Mapping).
> Renderer/Editor/Browser-Beweis sind P168.

## Umfang

1. **Neuer Knoten `ui-tab`** (Schema): Container-Kind mit `label`
   (Wert-typedInput), `icon` (optional), `order` (Zahl), **Default-Slot** für den
   Tab-Inhalt. Mountet in einen `ui-tabs`-Knoten.
2. **`ui-tabs`-Umbau:** `tabs`-JSON-Feld **entfernt**; `ui-tabs` ist
   Container-fähig für `ui-tab`-Kinder; **ein Slot pro Kind** (Key = Kind-id).
3. **Eindeutigkeit:** Kind-id/-name innerhalb des `ui-tabs` eindeutig (Validierung
   mit klarer Fehlermeldung).
4. **`activeTab`:** trägt die Kind-id; Default = erstes Kind nach `order`.
5. **Migration:** reine Mapping-Funktion `tabs:[{id,label}]` → `ui-tab`-Kinder
   (id/label erhalten), `tab:<id>`-Mounts → neuer Kind-Slot. Unit-getestet.

## acceptance / verify

- `verify: unit` — Schema-Tests + Migrations-Unit in `packages/schema/test`.

## Risiken / Hinweise

- **Invariante:** `packages/schema` importiert aus keinem anderen Repo-Paket.
- **Breaking Change** — die Spec `docs/nodes/navigation/ui-tabs.md` wird in P168 auf
  das neue Modell umgeschrieben; ein `ui-tab`-Spec-Doc kommt dort hinzu.
- `examples/customers-crud/flow.json` nur via `pnpm gen:example` (falls betroffen).
