# Erste Schritte

Paket installieren und die erste Web-App bauen — eine Begrüßungsseite mit
einem Button, der auf eine zweite Seite navigiert — in unter zehn Minuten.

> English (canonical): [../getting-started.md](../getting-started.md)

## Voraussetzungen

- Eine laufende [Node-RED](https://nodered.org/docs/getting-started/)-Instanz
  (Version 4.x empfohlen).
- Grundkenntnisse im Node-RED-Editor (Knoten hinzufügen, Deploy).

## Installation

**Über den Palette-Manager (empfohlen):** im Node-RED-Editor das Menü (☰) →
**Palette verwalten** → **Installieren** öffnen, nach
`node-red-contrib-webapp` suchen und **Installieren** klicken.

**Über npm:** im Node-RED-User-Verzeichnis (üblicherweise `~/.node-red`):

```bash
npm install node-red-contrib-webapp
```

Danach Node-RED neu starten. Nach dem Neustart zeigt die Palette die neuen
`ui-*`-Knoten (gruppiert unter *webapp*).

## Deine erste App, Schritt für Schritt

Du baust: eine App-Hülle, einen Begrüßungstext und einen Button, der auf eine
zweite Seite navigiert.

1. **Einen `ui-app`-Knoten hinzufügen.** Auf den Canvas ziehen und öffnen.
   Nenne ihn `My first app`. Der App-Knoten ist die Wurzel von allem — er
   bestimmt die URL, unter der die App ausgeliefert wird, und das
   Basis-Layout (behalte das Default-Layout `app`: Slots header / navbar /
   content / footer). Du siehst: einen einzelnen App-Knoten auf dem Canvas,
   keine Fehler.
2. **Einen `ui-text`-Knoten hinzufügen.** Öffnen und unter **Parent Slot**
   den **content**-Slot deiner App wählen (der Mount-Picker zeigt einen Baum
   aller verfügbaren Slots). Text: `Hello from Node-RED!`. Das ist die
   Struktur-Regel in Aktion: der Text lebt *in* der App wegen seines
   **mount** — nicht wegen irgendeines Wires.
3. **Einen `ui-button`-Knoten hinzufügen.** In denselben **content**-Slot
   mounten, Label: `Say hello`.
4. **Einen `ui-route`-Knoten hinzufügen.** Pfad `/hello`, im **App**-Feld
   deine App wählen, Layout `vertical`. Einen weiteren `ui-text` in den
   **content**-Slot der Route mounten mit dem Text
   `Hello! You navigated to your second page.`
5. **Die Navigation verdrahten.** Einen `ui-action`-Knoten hinzufügen,
   **App** setzen, Action-Typ `navigate` wählen und den Ziel-Modus
   *verdrahtete Route* auswählen. Jetzt verdrahten: Button-Output →
   Action-Input, und Action-Output → Route-Input. Das Wire sagt der Action,
   *welche Route* das Ziel ist — ein Daten-/Event-Wire, keine Hierarchie.
6. **Deploy.** Auf **Deploy** klicken. Der Status des App-Knotens wird grün
   und zeigt die Zahl der verbundenen Clients.
7. **App öffnen.** `http://localhost:1880/webapp/<deine-app-id>/` aufrufen
   (die Info-Sidebar des App-Knotens zeigt die genaue URL — die id ist die
   id des App-Knotens). Du siehst den Begrüßungstext und den Button; ein
   Klick navigiert nach `/hello` und zeigt die zweite Seite.

## Der komplette Flow zum Import

Das fertige Ergebnis der Schritte liegt als importierbarer Flow bei:
[`examples/guide/getting-started.json`](../../../examples/guide/getting-started.json)

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. Die Datei `examples/guide/getting-started.json` auswählen (oder ihren
   JSON-Inhalt einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/firstApp/` öffnen — mit **Say hello**
   auf die zweite Seite navigieren.

## Troubleshooting

- **Falscher Port / Seite nicht gefunden.** Die App wird von *deiner
  Node-RED-Instanz* ausgeliefert — gleicher Host, gleicher Port (Default
  `1880`). Wenn du `uiPort` in `settings.js` geändert hast, nimm diesen
  Port. Der Pfad ist immer `/webapp/<app-id>/` (mit abschließendem Slash);
  `<app-id>` ist die id des `ui-app`-Knotens.
- **„Unknown node type: ui-app" nach dem Import.** Das Paket ist in dieser
  Node-RED-Instanz nicht installiert, oder Node-RED wurde nach einem
  npm-Install nicht neu gestartet. Über den Palette-Manager installieren
  (kein Neustart nötig) oder Node-RED nach dem npm-Install neu starten.
- **Leere Seite.** Prüfe, dass die Komponenten ein **mount** deklarieren —
  ein View-Knoten ohne Parent-Slot ist nicht Teil der Struktur und kann
  nicht rendern. Zusätzlich Browser-Konsole und Node-RED-Debug-Sidebar auf
  strukturierte Fehler prüfen.
- **Änderungen erscheinen nicht.** Jede strukturelle Änderung braucht ein
  **Deploy**. Verbundene Browser re-rendern nach dem Deploy automatisch
  (kein manuelles Neuladen nötig).

## Wie weiter

- [Einführung](introduction.md) — das mentale Modell hinter dem, was du
  gerade gebaut hast.
- [Layout & Slots](guides/layout-slots.md) — wie Mounting und
  Layout-Presets funktionieren.
- [Actions & Events](guides/actions-events.md) — was der Button-Klick
  wirklich getan hat, und die zwei Wege, UI-Verhalten auszulösen.
