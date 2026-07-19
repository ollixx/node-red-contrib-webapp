---
id: P254
node: ui-toast
title: "Konformitäts-Pass ui-toast — dünne Coverage (3 E2E), kein Katalog, `duration`/`position` ungetestet und vermutlich nicht im Render-Pfad konsumiert"
epic: aspects/node-conformance
status: pending
dependencies: []
verify: browser
spec: docs/nodes/feedback/ui-toast.md
tests: tests/e2e/nodes/composite/ui-toast.tests.md
---
# P254 — Konformitäts-Pass ui-toast

> Audit 2026-07-17. ui-toast ist **dünn**: nur 3 E2E (nicht sichtbar per Default,
> Input→Toast via SSE, severity), **kein** `.tests.md`-Katalog, und zwei der vier
> Felder sind ungetestet und stehen unter Inert-Verdacht.

## findings

### A. `duration` + `position` ungetestet und vermutlich nicht konsumiert
Schema `duration: z.number().int().min(0)` (Auto-Dismiss-ms) und
`position: z.enum(["top-right","top-center","bottom-right","bottom-center"])`.
`mapConfig` (webapp.js:7642–7643) trägt beide durch. Aber grep nach toast-`duration`/
`position` im Serializer + Renderer + Client-Bundle ist **leer** (die Treffer
gehören zu ui-alert-`duration` bzw. CSS/reactive) ⇒ Verdacht, dass der Toast-Render-/
Dismiss-Pfad sie nicht liest. **Zu verifizieren:**
- `duration`: verschwindet der Toast nach `duration` ms? (gemessen)
- `position`: erscheint der Toast an der konfigurierten Ecke? (gemessen)
Wo keine Wirkung → implementieren **oder** aus Schema+Editor+Spec entfernen.

### B. Kein Test-Katalog (Dimension 5)
Es gibt **kein** `tests/e2e/nodes/composite/ui-toast.tests.md`.

### C. Solide (nicht neu aufbauen)
Nicht-sichtbar-per-Default, Input-Port-Message → `sl-alert.webapp-toast` via SSE,
severity-Übernahme. Base-Fields (`installBaseFields`, nur `visible`).

## acceptance

- **`duration` beobachtbar:** ein Toast mit `duration=N` wird nach ~N ms aus dem DOM
  entfernt (gemessen); `duration=0`/absent → bleibt (bzw. dokumentierter Default) —
  oder Feld entfernt.
- **`position` beobachtbar:** die vier Positionen erzeugen einen **gemessenen**
  Unterschied (Container-Ecke / Klasse) — oder Feld entfernt.
- **Katalog** `ui-toast.tests.md` angelegt (bestehende + neue Tests mit Testziel).
- **E2E grün** (Haupt-Checkout); Tripwires + `pnpm validate` grün.

## verify

`browser` — duration (Verschwinden nach ms) + position (Ecke) gemessen; die 3
bestehenden Tests bleiben grün.

## spec

`docs/nodes/feedback/ui-toast.md` — duration/position wahrheitsgemäß (Wirkung oder
Entfernung), Abgrenzung zu ui-log (bereits vorhanden).

## tests

`tests/e2e/nodes/composite/ui-toast.spec.ts` + neuer Katalog.

## notes for the implementer

- Toast wird client-seitig via SSE gerendert (`sl-alert.webapp-toast`) — duration/
  position werden, falls implementiert, im Client-Bundle/Serializer gehandhabt; dort
  prüfen, nicht nur in mapConfig (Inert-Muster wie ui-menu displayType / ui-dialog modal).
- ui-toast hat **keinen** mount (kein Slot-Kind — es ist ein App-globaler Layer);
  das ist korrekt, kein Finding.
