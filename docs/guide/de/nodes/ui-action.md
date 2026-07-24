# ui-action

Der typisierte Emitter von Interaktions-Kommandos — navigate, show/hide,
open/close, select, enable/disable, focus, reset. Er ändert
Interaktionszustand, nie fachliche Daten.

> English: [../../nodes/ui-action.md](../../nodes/ui-action.md)

## Zweck

`ui-action` ist der bequeme, **typisierte Emitter** des `msg.ui.action`-Contracts.
Bei Eingang baut er aus seiner Konfiguration (überschreibbar durch
`msg.ui.action.*`) eine schema-valide `msg.ui.action` und gibt die angereicherte
Message aus. Eine Action ändert ausschließlich den **Interaktionszustand** der UI
(Navigation, Sichtbarkeit, Aktivierung, Fokus) — **nie fachliche Daten** (das ist
[`ui-store`](ui-store.md)). Den SSE-Push führt der **verdrahtete Zielknoten** aus,
nicht `ui-action`. Navigation ist ab jetzt **allein** ein `ui-action` mit
`navigate` (der stillgelegte `ui-navigation`-Knoten — ADR 0040).

## Wann einsetzen

- Zu einer Route oder URL navigieren (aus einem Button/Flow).
- Ein Ziel show/hide oder enable/disable (während eines Requests, unter einer
  Bedingung).
- Einen Dialog, Drawer, eine Accordion-Sektion öffnen/schließen; genau eines aus
  einer Geschwister-Gruppe wählen.
- Ein Text-Control fokussieren; ein Form-Control auf den Initialwert zurücksetzen.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor und in Pickern. | Freitext | `Action N` |
| **App** | Die Parent-`ui-app` — der Routing-Kontext. Pflicht. | App-Referenz | — |
| **Action-Typ** (`actionType`) | Das voreingestellte Verb (überschreibbar via `msg.ui.action.type`). Leer = unspezifiziert (Typ kommt aus der msg). | siehe Verben unten | leer |
| **Beschreibung** (`description`) | Freitext-Notiz zur Dokumentation im Editor. | Freitext | leer |
| **Ziel** (`targetMode` + `route`/`to`) | Navigations-Zielquelle, nur bei `navigate` — ein Segment-Schalter: **via Wire** (die empfangende Route baut die Location), **Route** (eine gepickte `ui-route` + typisierte Params), **URL** (eine ganze URL in `to`). | `wire` / `route` / `url` | per Migration |
| **Ziel-Knoten** (`targets`) | Optionale per-Canvas gewählte Zielknoten-IDs — der sekundäre „wireless"-Pfad (Zustellung via `receive()`). Primär ist das Wiring des Output-Ports. | Knoten-IDs | leer |
| **Teil (Sub-ID)** (`part`) | Sub-ID im Ziel für `open` / `close` / `select` (z. B. Accordion-Sektion, Tab-Name). Überschreibbar via `msg.ui.action.part`. | Sub-ID | leer |

## Die Verben

Jedes Verb wird an das **verdrahtete Ziel** zugestellt; ein Ziel, das das Verb
nicht besitzt, reicht es unverändert durch.

| Verb | Was es tut | Mini-Beispiel |
|---|---|---|
| `navigate` | ändert die Location (drei Modi unten) — der **kanonische** Navigations-Weg | `ui-button → ui-action(navigate, url:/customers)` |
| `show` | schreibt `visible` des Ziels auf true (durch einen Store, wenn gebunden) | `ui-action(show) → ui-container „Fehler"` |
| `hide` | schreibt `visible` des Ziels auf false | `ui-action(hide) → ui-alert` |
| `open` | legt ein aufklappbares Element offen (Dialog, Drawer, Accordion) — optional `part` | `ui-action(open) → ui-dialog „Bestätigen"` |
| `close` | schließt ein aufklappbares Element | `ui-action(close) → ui-dialog` |
| `select` | aktiviert genau eines aus einer Geschwister-Gruppe via `part` | `ui-action(select, part:tab2) → ui-tabs` |
| `enable` | schreibt `disabled` des Ziels auf false | `ui-action(enable) → ui-button „Speichern"` |
| `disable` | schreibt `disabled` des Ziels auf true (z. B. während eines Requests) | `ui-action(disable) → ui-button „Speichern"` |
| `focus` | fokussiert ein Text-Control ([`ui-input`](ui-input.md)/[`ui-textarea`](ui-textarea.md)/[`ui-datepicker`](ui-datepicker.md)) | `ui-action(focus) → ui-input „Suche"` |
| `reset` | setzt ein Form-Control auf den Initialwert und feuert `change` | `ui-action(reset) → ui-input „Name"` |

`show`/`hide` und `enable`/`disable` schreiben den einen dynamic-state-Wert des
Ziels (ADR 0037); `open`/`close`/`select`/`focus` pushen ein SSE-Kommando.
`openDialog` / `closeDialog` bleiben als Aliase von `open` / `close`.

### Die drei Navigate-Modi (ADR 0011)

- **wire** — kein explizites Ziel in der Message; die empfangende `ui-route`
  baut die Location aus ihrem eigenen `path`.
- **route** — die gepickte Routen-Referenz wird app-global aufgelöst; die
  typisierten `params` füllen ihre `:platzhalter`; die Location fährt in
  `msg.ui.action.to`.
- **url** — `to` / `toType` liefern die ganze URL; kein `params`.

Eine bereits adressierte Navigation (Modus `route`/`url` oder `msg.ui.action.to`)
wird von einer empfangenden Route durchgereicht — eine verdrahtete Route kapert
sie nicht.

## Eingang

Der In-Port empfängt eine `msg`. Relevante Felder:

```
msg.ui.action.type   = "navigate" | "show" | "hide" | "open" | "close" | "select" | "enable" | "disable" | "focus" | "reset"
msg.ui.action.target = <node-id>   ← optionaler Ziel-Override (sonst löst der Zielknoten auf sich selbst auf)
msg.ui.action.part   = <sub-id>    ← für open / close / select
msg.ui.action.to     = <pfad>      ← explizites Navigationsziel (Modus route/url)
msg.ui.action.params = { k: v }    ← benannte URL-Parameter für navigate (Laufzeit-Override)
msg.ui.clientId      = <client>    ← schränkt die Action auf einen Client ein (sonst Broadcast)
```

`ui-action` **reichert** die Message an (ersetzt sie nicht — fremde Felder reisen
mit) und emittiert sie am Output-Port. Unbekannte / fachfremde Messages werden
unverändert durchgereicht.

## Ausgänge / Events

Der Output-Port emittiert die mit `msg.ui.action` angereicherte Message. Der
verdrahtete Zielknoten verarbeitet das ihm bekannte Verb; ein Verb, das er nicht
besitzt, wird durchgereicht. `ui-action` selbst führt keinen SSE-Push aus.

## Beispiele

### 1. Ein Button, der navigiert (kanonisch)

Ein Startseiten-Button feuert ein `navigate` (url-Modus) zu einer zweiten Route;
der Inhalt der Route rendert nach der Navigation.

Flow-Datei: [`examples/guide/ui-action.json`](../../../../examples/guide/ui-action.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-action.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideAction/` öffnen und **Go to page 2**
   klicken — die URL wird `/webapp/guideAction/page2`.

## Verwandt

- [Actions & Events](../guides/actions-events.md) — die Richtungsregel, Wire vs. Referenz
- [Navigation & Dialogs](../guides/navigation-dialogs.md) — die drei Navigate-Modi
- [`ui-route`](ui-route.md) / [`ui-dialog`](ui-dialog.md) — Navigations-/Offenlegungs-Ziele
- [`ui-store`](ui-store.md) — fachliche Daten (Abgrenzung)
- Contract-Doc (intern, Deutsch): `docs/nodes/behavior/ui-action.md`
