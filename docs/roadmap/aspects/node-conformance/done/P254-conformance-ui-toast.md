---
id: P254
node: ui-toast
title: "Konformitäts-Pass ui-toast — dünne Coverage (3 E2E), kein Katalog, `duration`/`position` ungetestet und vermutlich nicht im Render-Pfad konsumiert"
epic: aspects/node-conformance
status: done
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

## Result

**Done 2026-07-20.** Owner-Entscheid **implementieren** für beide Felder umgesetzt;
Katalog angelegt.

### Gemessen inert → implementiert

- **`position` — voll inert (tiefere Ursache gemessen).** Shoelaces `sl-alert`-Host
  ist `display:contents` → **keine positionierbare Box**, `position:fixed` +
  Ecken-Offsets wirkungslos; alle vier Werte lieferten `getBoundingClientRect`
  `{0,0,0,0}`. Fix (`webapp-client.js`): `display:block` am Host erzwingen; `-center`
  via `left:50%;translateX(-50%)`, `-right` via `right:1rem`; Server+Client-Default
  auf Spec-`bottom-right` angeglichen (`webapp.js`).
- **`duration` — Positivwert wirkte, aber der Absent-Default war falsch.** Positives
  `N` dismisste bereits, `duration=0` blieb — aber ein **absentes** Node-Default fiel
  auf `3000ms` zurück, gegen den Owner-Entscheid (absent → bleibt). Absent-Default in
  Server+Client auf `0` (kein Timer) korrigiert.

### Gemessener Beleg (E2E, `--retries=0`) — 6/6

- `duration=700`: bei +300ms präsent, nach dem Timer `toHaveCount(0)`.
- `duration=0`: nach 1500ms weiter präsent.
- `position`: vier distinkte `getBoundingClientRect`-Boxen — top `y=16` vs bottom
  `y≈637`; `-center` mid-x ≈640 (Viewport-Mitte) vs `-right` mid-x ≈1176 (>500px Δ).

### Auch geliefert

- **Katalog** `tests/e2e/nodes/composite/ui-toast.tests.md` angelegt → räumt die
  P254-`check:roadmap`-Warnung ab (jetzt nur noch 1 Warnung, P255).
- **Spec** wahrheitsgemäß: duration-Semantik (N→dismiss, 0/absent→bleibt, Editor
  füllt 4000 vor) + position-Anchoring (4 messbare Platzierungen).

### Verifikation (Haupt-Checkout, autoritativ)

**E2E 811 passed, 0 failed, `--retries=0`, 15,2 min** (E01 grün). Client-Bundle +
webapp.js geändert (Serializer unberührt) → Voll-Suite gerechtfertigt. `pnpm build` +
`pnpm validate` + Tripwires grün. Agent committete VOR der Verifikation, stoppte alle
Prozesse (Port 1882 frei), Haupt-Checkout unberührt.
