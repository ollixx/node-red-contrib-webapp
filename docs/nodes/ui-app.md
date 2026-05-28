# `ui-app`

## Zusammenfassung

Definiert die Wurzel einer deklarativen Web-App.

Aktuelles Verhalten:
- Es kann mehrere `ui-app` geben.
- Dient als Einstieg für Runtime-API, Renderer und Editor-Strukturansicht.
- Die App ist unter `/webapp/<root>` erreichbar

## Abhängigkeiten

**Parent-Knoten:**
- Keiner. `ui-app` ist der Root-Knoten einer Anwendung.

**Gemeinsam genutzte Services und Komponenten:**
- Runtime-API: stellt den Einstiegspunkt `/webapp/<root>` bereit
- Editor-Strukturansicht: App ist Wurzel der Knotenhierarchie

## Editor

**Pflichtfelder:**
- `root`: der erste URL-Teil der app hinter /webapp, root für diese Anwendung.
  - Validierung: unique über alle ui-app Knoten, valider URL part
- `layout`: Referenz auf ein bekanntes Layout
  - Default: `vertical` (kinder werden untereinander dargestellt)

**Optionale Felder:**
- `name`: reines Node-RED-Anzeigefeld. Wird bei der Darstellung des Knotens (auch bei der Auswahl als Parent) angezeigt. Wenn nicht gesetzt, wird die Knoten ID angezeigt.

## Input

## Output

## Besonderheiten

- Das routing nach "root", also /webapp/<appName> erfolgt über diesen Knoten und funktioniert exakt wie bei ui-route. Hier sollte ggf. gemeinsamer code genutzt werden

Siehe für das mehrfach genutzte Layout-Konzept auch [layout.md](layout.md).

Eine App braucht künftig ein Basis-Layout. Dieses Basis-Layout soll nicht zwingend immer über einen frei modellierten `ui-layout`-Knoten entstehen.
- Stattdessen soll es eine Liste von Standard-Layouts geben, die direkt als Preset ausgewählt werden können, zum Beispiel:
  - `horizontal`
  - `vertical`
  - `app` mit den Slots `header`, `navbar`, `content`, `footer`
  - weitere spätere Standard-Layouts
- Für die App-Konfiguration bedeutet das: entweder ein Layout-Preset wählen oder explizit `custom` verwenden.
- Bei `custom` wird das Basis-Layout über `ui-layout` und `ui-slot` frei modelliert.

Offene Spezifikation:
- Soll eine App künftig globale Metadaten wie Theme, Basisroute oder Berechtigungen tragen?
  - Später: Themeauswahl. Erfordert ein Theme-Konzept
  - Authorization ist ein offener Punkt, könnte aber eine Auswahl aus verfügbaren Lösungen sein (OAuth2, OICD, ...)
- Ist genau eine App pro Flow gewollt oder nur genau eine pro zusammenhängendem Deploy-Slice?
  - Es gibt ein Repository pro node-red instanz. Die Knoten sind unabhängig von flows.
