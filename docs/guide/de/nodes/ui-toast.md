# ui-toast

Eine flüchtige Pop-up-Meldung, aus dem Flow ausgelöst, die sich selbst schließt.

> English (canonical): [nodes/ui-toast.md](../../nodes/ui-toast.md)

## Zweck

`ui-toast` zeigt eine **transiente Benachrichtigung**, die über der App schwebt
und sich nach einer konfigurierbaren Zeit selbst schließt. Anders als die meisten
View-Knoten wird er nicht in einen Slot gemountet — er lebt auf **App-Ebene** und
wird imperativ durch eine eingehende `msg.ui.toast`-Message ausgelöst. Inhalt
(Text, Severity, Position, Dauer) kommt zur Laufzeit aus der Message; die Felder
des Knotens liefern nur die Defaults, wenn die Message die Felder auslässt.

Er ist **nicht** [`ui-log`](ui-log.md): `ui-log` ist ein persistentes
Operator-Log am Fehlerkanal; ein Toast ist ein kurzlebiger Endnutzer-Hinweis, den
man explizit auslöst.

## Wann einsetzen

- Eine Aktion für den Nutzer bestätigen („Gespeichert", „Gelöscht") aus dem Flow.
- Eine schnelle, selbst-schließende Status-Meldung zeigen, die keinen Layout-Platz
  belegen soll.
- Für einen **Inline**-Hinweis, der in der Seite bleibt, stattdessen
  [`ui-alert`](ui-alert.md); für ein persistentes Entwickler-/Betreiber-Log
  [`ui-log`](ui-log.md).

## Felder

Die Felder setzen die **Defaults**; jedes ist pro Message überschreibbar.

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Toast N` |
| **App** (`app`) | Die Parent-`ui-app` — Toasts erscheinen app-weit, nicht slot-gebunden. Pflicht. | App-Picker | — |
| **Severity** (`severity`) | Default-Farbrolle, wenn die Message kein `severity` hat. | `primary`, `info`, `success`, `warning`, `danger`, `neutral` | `info` |
| **Duration (ms)** (`duration`) | Default-Auto-Dismiss-Zeit. Positives `N` entfernt den Toast nach ~N ms; `0` oder leer = kein Auto-Dismiss (bleibt, bis der Nutzer schließt). | Integer ≥ 0 | `4000` |
| **Position** (`position`) | Default-Bildschirmecke. | `top-right`, `top-center`, `bottom-right`, `bottom-center` | `bottom-right` |
| **Visible** (`visible`) | Basis-Feld — deklarative Sichtbarkeit (bindbarer Boolean). | Boolean-Binding | sichtbar |

`Disabled`, `Color` und `Size` sind N/A (ein Toast hat keinen interaktiven
Zustand; seine Farbe kommt aus der Severity; er hat keine Größen-Stufen).

## Eingang

`ui-toast` **hat einen Eingangs-Port**. Er wird durch eine Message mit
`msg.ui.toast` ausgelöst:

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `msg.ui.toast.message` | **ja** | der angezeigte Text |
| `msg.ui.toast.severity` | nein | überschreibt den Knoten-Default |
| `msg.ui.toast.position` | nein | überschreibt den Knoten-Default |
| `msg.ui.toast.duration` | nein | überschreibt den Knoten-Default (ms) |
| `msg.ui.clientId` | nein | gesetzt → nur dieser Client; fehlt → Broadcast |

`msg.ui.toast.message` ist das einzige Pflichtfeld. Eine Message ohne es gilt als
nicht für diesen Knoten bestimmt und wird **unverändert durchgereicht**; nicht
erkannte / fachfremde Messages ebenso.

## Ausgänge / Events

`ui-toast` **hat einen Output-Port**. Pass-Through-Messages verlassen ihn
unverändert. Zusätzlich emittiert er ein `dismiss`-Event, wenn der Nutzer den
Toast **manuell** schließt — **nicht** beim Auto-Dismiss nach `duration`.

| Event | Wann | `msg.ui`-Felder |
|---|---|---|
| `dismiss` | Nutzer klickt den Schließen-Button | `event: "dismiss"`, `appId`, `clientId`, `sourceId` |

## Beispiele

### 1. Einen Erfolgs-Toast aus einem Inject feuern

Ein `ui-toast` auf App-Ebene, ein Inject-Knoten, der
`msg.ui.toast = { message, severity }` sendet, und eine Überschrift, damit der
App-Root nie leer ist. Deployen, App öffnen, dann den Inject-Knoten im Editor
klicken, um den Toast zu feuern.

Flow-Datei: [`examples/guide/ui-toast.json`](../../../../examples/guide/ui-toast.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-toast.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideToast/` öffnen.
5. Den Button des **Send toast**-Inject-Knotens klicken — ein grüner
   „Saved successfully"-Toast erscheint unten rechts und schließt sich selbst.

## Verwandt

- [`ui-alert`](ui-alert.md) — eine Inline-Hinweisleiste in der Seite
- [`ui-log`](ui-log.md) — ein persistentes Operator-Log (das Gegenstück)
- Contract-Doc (intern, deutsch): `docs/nodes/feedback/ui-toast.md`
