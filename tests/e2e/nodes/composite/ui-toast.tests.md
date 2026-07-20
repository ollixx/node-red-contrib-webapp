# Testkatalog: ui-toast

> Format gemäß `.ai/agents/node-testing.md`. Angelegt im Konformitäts-Pass P254
> (Audit 2026-07-17). ui-toast wird client-seitig via SSE gerendert
> (`sl-alert.webapp-toast`, an `document.body` angehängt) — es hat **kein** mount
> (App-globaler Layer, kein Slot-Kind). Der Toast wird durch eine eingehende
> `msg.ui.toast`-Message (bzw. `msg.payload` als Text-Fallback) ausgelöst.

## P45 — Basis: Sichtbarkeit, SSE-Render, Severity

Browser-E2E: `ui-toast.spec.ts`.

| Ziel | Spec / Test | Beobachtung |
|---|---|---|
| Nicht sichtbar per Default | „not visible by default — no toast in DOM on page load" | Nach Seitenladen und ohne Input-Message ist **kein** `sl-alert.webapp-toast` im DOM (`toHaveCount(0)`). |
| Input-Port-Message → Toast via SSE | „input port message → sl-alert.webapp-toast appears in DOM via SSE" | Inject → `sl-alert.webapp-toast` erscheint (an `body` angehängt), enthält den Payload-Text. |
| Severity aus der Node-Definition | „toast carries the severity from the node definition" | Node `severity: warning` → Toast trägt `variant="warning"`. |

## P254 — `duration` beobachtbar (Auto-Dismiss client-seitig)

Browser-E2E: `ui-toast.spec.ts`.

`duration` ist die Auto-Dismiss-Zeit in ms. Ein positiver Wert `N` armiert einen
Client-Timer (`setTimeout` in `webapp-client.js`), der den Toast nach ~`N` ms per
`el.remove()` aus dem DOM entfernt. `0` (oder ein nicht gesetzter Wert) armiert
**keinen** Timer — der Toast bleibt, bis der Nutzer ihn schließt.

| Ziel | Spec / Test | Beobachtung |
|---|---|---|
| `duration=N` → nach ~N ms aus dem DOM entfernt (gemessen) | „duration=N → toast is removed from the DOM after ~N ms (measured)" | Node `duration: 700`. Toast sichtbar; bei +300 ms noch da (`toHaveCount(1)` — nicht sofort verschwunden); danach entfernt (`toHaveCount(0)`, Auto-Wait ≤ 3 s). |
| `duration=0` → bleibt (kein Auto-Dismiss) | „duration=0 → toast persists (no auto-dismiss)" | Node `duration: 0`. Toast auch nach 1500 ms noch im DOM (`toHaveCount(1)`). |

## P254 — `position` beobachtbar (vier distinkte Platzierungen)

Browser-E2E: `ui-toast.spec.ts`.

`position` verankert den Toast per `position:fixed` an einer Ecke: vertikal
`top`/`bottom`, horizontal rechtsbündig (`-right`, `right:1rem`) bzw.
viewport-zentriert (`-center`, `left:50%;transform:translateX(-50%)`). Jeder Wert
trägt zusätzlich die Klasse `webapp-toast--<position>`.

| Ziel | Spec / Test | Beobachtung |
|---|---|---|
| Vier Werte → messbar unterschiedliche Platzierung | „position → four values produce distinct, measured placements" | Vier Toasts (`top-right`, `top-center`, `bottom-right`, `bottom-center`) gleichzeitig. Gemessene Bounding-Boxes: `top-*` in oberer, `bottom-*` in unterer Viewport-Hälfte; `-center` mittig (mid-x nahe Viewport-Mitte, Toleranz 40 px), `-right` rechts der Mitte; center- und right-Mid-x unterscheiden sich um > 40 px. |

## Unit-/Nicht-Browser-Belege

- Schema `duration: z.number().int().min(0)` + `position`-Enum
  (`top-right`/`top-center`/`bottom-right`/`bottom-center`):
  `packages/schema/src/node-definitions.ts` (`uiToastNodeDefinitionSchema`).
- `mapConfig` reicht `severity`/`duration`/`position` in die Definition durch;
  `toastInputHandler` baut die SSE-Nutzlast (msg-Override > Node-Default > Fallback:
  `duration` → 0 = kein Auto-Dismiss, `position` → `bottom-right`):
  `nodes/webapp.js`.
