---
id: P189
title: "Editor-UX: Item-/Prop-Pfadfeld erklären — Hinweis/Placeholder 'Feldpfad · leer = ganzes Element', damit niemand 'item' als Wert tippt (→ item.item → ?)"
epic: aspects/editor
findings:
  - "Owner (2026-06-19): 'wenn ich in ui-text mit Type item als wert item eingebe, wird nichts angezeigt, bzw. ?. Das entspricht nicht der Definition in ui-repeat.'"
  - "Diagnose: bei Typ 'Item (Repeat)' ist das Wertfeld der FELDPFAD im Element (das item.-Präfix IST der Typ). Wert 'item' → Pfad 'item' → item.item → existiert nicht → '?'. Ganzes Element = Feld LEER (P184, bereits gemergt). Das Feld gibt aber keinerlei Hinweis darauf → Bedien-Fallstrick."
acceptance:
  - "Bei gewähltem Typ 'Item (Repeat)' (und 'Prop (Component)') zeigt das Wertfeld einen klaren Hinweis/Placeholder: sinngemäß 'Feldpfad (z. B. name, address.city) — leer = ganzes Element'."
  - "Der Hinweis erscheint nur, wenn der Typ tatsächlich item/prop ist; er stört die anderen Typen nicht."
  - "'Index (Repeat)' bleibt pfadlos (kein Wertfeld) — unverändert; ggf. ein kurzer Hinweis 'nullbasierte Position, kein Pfad'."
  - "Klarstellung dokumentiert (ui-repeat-Spec / editor.md): das Editor-Wertfeld ist der Pfad NACH dem item., leer = ganzes Element — gegen den 'item als Wert tippen'-Fehlschluss."
verify: browser
spec: docs/nodes/display/ui-repeat.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: []
status: pending
---
# P189 — Item-/Prop-Pfadfeld erklären (Editor-UX)

> Kleiner, gezielter Editor-Hinweis. P184 hat das **leere** Pfad-Feld (ganzes
> Element) technisch repariert; hier kommt die **Erklärung im UI** dazu, damit der
> Nutzer nicht `item` als Wert tippt und `?` erntet.

## Umfang

1. **Hinweis/Placeholder** am Wert-typedInput, wenn Typ = `item` bzw. `prop`:
   „Feldpfad (z. B. `name`, `address.city`) — leer = ganzes Element". Mechanik wie
   `installRepeatScopeHint` (dynamischer Hinweis bei Typwechsel) oder ein
   Placeholder auf dem Value-Input des Typs.
2. **`index`** bleibt pfadlos; optional ein Mini-Hinweis „nullbasierte Position".
3. **Doku-Klarstellung** (ui-repeat-Spec §„Im Editor" + editor.md): das Wertfeld
   trägt **nur den Pfad nach `item.`**; **leer = ganzes Element**; `item` als Wert
   bedeutet das Feld `item` (nicht das Element).

## acceptance / verify

- `verify: browser` — der Hinweis erscheint bei Typ item/prop, verschwindet sonst;
  ein leeres item-Feld in einem Repeat zeigt das ganze String-Element (Regression
  zu P184). E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- **Reine UX/Doku** — kein Schema-/Renderer-Wechsel (P184 trägt die Auflösung).
- Nebenbefund prüfen: der Editor-`prop`-Typ verlangt aktuell einen **nicht-leeren**
  Pfad (validate), während das Schema `prop` ohne Pfad (ganzes Prop) erlaubt — ggf.
  hier mit angleichen (leerer prop-Pfad = ganzes Prop), konsistent zu `item`.
