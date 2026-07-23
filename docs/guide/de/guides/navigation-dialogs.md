# Navigation & Dialoge

Mehrseitige Apps: Routen, die drei Navigate-Modi, Dialoge mit
`open`/`close` und das Scoping eines Dialogs auf eine Route.

> English (canonical): [../../guides/navigation-dialogs.md](../../guides/navigation-dialogs.md)

## Ziel

Eine App mit mehreren Seiten und einem Dialog bauen: in allen drei Modi
zwischen Routen navigieren, einen Dialog aus dem Flow öffnen/schließen und
verstehen, wann man einen Dialog auf eine Route scopet.

## Voraussetzungen

- [Erste Schritte](../getting-started.md) und
  [Actions & Events](actions-events.md) (die Wire-vs.-Referenz-Idee kehrt
  hier zurück).

## Routen

Eine `ui-route` fügt der App eine Seite unter einem Pfad hinzu (`/about`,
`/items/:id`). Komponenten mounten in die Slots der Route genauso wie in
die App; der Inhalt der Route ersetzt den `content`-Slot der App, solange
die Route aktiv ist. Pfad-Segmente mit führendem `:` sind **Parameter** —
innerhalb der Route liest sie ein **Route-Param**-Binding (z. B. einen
Text an den Parameter `id` von `/items/:id` binden).

Routen emittieren `onEnter`- und `onLeave`-Events an ihrem Output-Port —
der Standard-Trigger, um Daten beim Öffnen einer Seite zu laden (siehe
[Daten anzeigen](displaying-data.md)).

## Navigation: eine Action, drei Modi

Navigation ist eine `ui-action` mit Action-Typ `navigate`. Der
**Ziel-Modus** entscheidet, woher das Ziel kommt:

| Modus | Ziel kommt aus | Einsatz |
|---|---|---|
| **wire** | der `ui-route`, die am Output der Action hängt — die Route baut die Location aus ihrem eigenen Pfad (plus Params aus der Message) | der klassische Fall: ein Button, eine bekannte Seite |
| **route** | einer per Referenz gewählten Route plus einer typisierten **Params**-Liste (jeder Param Name + Wert; Werte können aus der Message kommen) | parametrisierte Ziele: „öffne Item 42" |
| **url** | einem `to`-Wert (String, oder dynamisch aus msg/flow/global/JSONata), der den ganzen Pfad trägt | berechnete Ziele, externe URLs, „zurück zu /" |

Alle drei Modi emittieren die `onEnter`/`onLeave`-Events der betroffenen
Routen. Ein Navigate auf eine URL außerhalb der App-Routen verlässt die
App.

## Dialoge

Ein `ui-dialog` ist ein Overlay mit eigenen Slots (`header`,
`header-actions`, `content`, `footer` — das `dialog`-Layout-Preset). Er
wird mit den Action-Verben **`open`** und **`close`** geöffnet und
geschlossen: eine `ui-action` (Typ `open` bzw. `close`) an den
Dialog-Knoten verdrahten, genau wie das Hide/Show-Muster in
[Actions & Events](actions-events.md). Der Dialog emittiert
`onOpen`/`onClose`-Events an seinem Output-Port.

**Route-Scoping:** ein Dialog kann optional eine **Parent Route**
deklarieren. Ist sie gesetzt, ist der Dialog nur darstellbar, solange
diese Route aktiv ist — bei jeder anderen Route wird er gar nicht
gerendert (auch nicht, wenn sein Open-State per URL erzwungen wird). Ohne
Parent Route ist der Dialog auf jeder Seite der App verfügbar. Scope
einen Dialog auf eine Route, wenn er zum Workflow dieser Seite gehört
(ein Edit-Dialog auf einer Detailseite); lass ihn ungescoped für
app-weite Dialoge (eine globale Bestätigung).

## Schritte

1. Erstelle eine App mit einem Home-Text und zwei Routen: `/about` (Text
   und Zurück-Button) und `/items/:id` (Text, gebunden an Route-Param
   `id`, und Zurück-Button).
2. Füge eine „wired"-Navigation hinzu: Button → `ui-action` (navigate,
   Modus *wire*) → den Output der Action mit der `/about`-Route
   verdrahten. Deploy und Klick: die App wechselt nach `/about`.
3. Füge eine „route-mode"-Navigation hinzu: Button → `ui-action`
   (navigate, Modus *route*), die `/items/:id`-Route wählen und den Param
   `id` = `42` eintragen. Klick: die App öffnet `/items/42`, der gebundene
   Text zeigt `42`.
4. Füge eine „url-mode"-Navigation hinzu: Button → `ui-action` (navigate,
   Modus *url*) mit `to = /about`. Die Zurück-Buttons beider Routen nutzen
   denselben Modus mit `to = /`.
5. Füge einen `ui-dialog` mit einem Text im `content` und einem
   Close-Button im `footer` hinzu. Verdrahte: ein „Open dialog"-Button →
   `ui-action` (`open`) → Dialog, und der Close-Button → `ui-action`
   (`close`) → Dialog. Deploy: der Dialog öffnet und schließt per Klick.

## Beispiel-Flow

Das fertige Ergebnis der Schritte:
[`examples/guide/navigation-dialogs.json`](../../../../examples/guide/navigation-dialogs.json)

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. Die Datei `examples/guide/navigation-dialogs.json` auswählen (oder ihr
   JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/navApp/` öffnen — alle drei
   Navigate-Buttons und den Dialog ausprobieren.

## Wie weiter

- [Auth](auth.md) — Routen und Dialoge mit `requiresGroup` schützen.
- [Daten anzeigen](displaying-data.md) — Daten beim Routen-Eintritt laden.
