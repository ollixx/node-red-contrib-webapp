# Node-RED Webapp – Übersicht und gemeinsame Konzepte

## Zweck

Dieser Ordner beschreibt die aktuell vorhandenen Node-RED-Knoten des Projekts in ihrem heutigen Zustand. Er trennt dabei bewusst zwischen:

- dem deklarativen Vertrag, den ein Knoten ins gemeinsame Modell einbringt
- dem aktuellen Laufzeitverhalten im MVP
- den offenen Punkten, die vor einer schärferen Produktspezifikation geklärt werden sollten

Die Dokumente sind damit keine reinen Benutzerleitfäden, sondern die Arbeitsgrundlage für die nächste Spezifikationsrunde.

Das mehrfach genutzte Layout-Feature ist zusätzlich zentral in [layout.md](layout.md) dokumentiert.

## Kategorien

- Struktur: [`ui-app`](ui-app.md), [`ui-route`](ui-route.md), [`ui-dialog`](ui-dialog.md)
- View: [`ui-text`](ui-text.md), [`ui-button`](ui-button.md), [`ui-table`](../display/ui-table.md), [`ui-container`](ui-container.md), [`ui-input`](ui-input.md)
- State: [`ui-store`](../state/ui-store.md), [`ui-query`](ui-query.md)
- Verhalten: [`ui-action`](ui-action.md), [`ui-navigation`](ui-navigation.md)

## Gemeinsame Modellregeln

- Eine App wird heute fachlich über `uiId` bzw. im gemeinsamen Modell über `id` identifiziert. Dieser Wert muss eindeutig sein.
- ~~Die Node-RED-interne Knoten-ID reicht nicht als fachliche ID für das gemeinsame UI-Modell~~. Doch, die IDs reichen aus, um Knoten zu referenzieren
- View-Knoten werden über `mount` an Route-, Dialog- oder Preset-Layout-Slots gebunden.
- Die Editor-Oberfläche bietet für gängige Referenzen wie `layoutId`, `routeId`, `mount`, `action` und `storeId` vorbelegte Auswahllisten aus den vorhandenen Webapp-Knoten.
- Strukturgeführte Parent- oder Baum-Selektoren existieren weiterhin nicht; die Auswahl bleibt feldbasiert und arbeitet auf den fachlichen IDs bzw. Mount-Strings.
- Das gemeinsame Schema validiert heute vor allem Feldpräsenz und Grundform, nicht die vollständige fachliche Semantik.

## Ereignis- und Zustandsmodell

- UI-Zustand und UI-Verhalten sind getrennte Konzepte.
- Fachlicher oder eingabebezogener Datenzustand läuft ausschließlich über `ui-store`.
- Veränderungen am Verhalten oder am Interaktionszustand von UI-Elementen laufen über `ui-action`.
- `ui-event` bezeichnet ausschließlich Ereignisse vom Client zum Backend.
- Fachliche Events sind davon getrennt. Sie können im Client explizit ausgelöst oder vom Backend an den Client weitergeleitet werden, wenn nicht direkt eine `ui-action` ausgeführt werden soll.

Abgrenzung:
- `ui-action`: beschreibt, was die UI tun soll
- `ui-store`: beschreibt, welcher Zustand gehalten und geändert wird
- `ui-event`: beschreibt, was der Client dem Backend meldet
- fachliches Event: beschreibt eine fachliche Nachricht zwischen Frontend und Backend ohne unmittelbare UI-Aktionssemantik

## UI-Events und fachliche Events

### `ui-event`

Zweck:
Beschreibt ausschließlich Ereignisse, die vom Client zum Backend gemeldet werden.

Typische Beispiele:
- `click`
- gemeldete UI-Statusänderungen wie Sichtbarkeit, Enabled-State oder ähnliche Zustandswechsel

Regel:
- `ui-events` laufen nur vom Client zum Backend, nie in die andere Richtung.

### Fachliche Events

Zweck:
Beschreibt fachliche Nachrichten außerhalb der direkten UI-Aktionssemantik.

Anwendung:
- können explizit im Client ausgelöst werden
- können vom Backend an den Client weitergeleitet werden
- sind sinnvoll, wenn nicht unmittelbar eine `ui-action` ausgeführt werden soll, sondern ein fachlicher Event-Handler reagieren soll

Offene Spezifikation:
- Es ist noch offen, ob dafür ein eigener Knotentyp nötig ist oder ob dies über ein allgemeines Event-Handler-Konzept im Client modelliert wird.
- Idee:
  - Der ui-app Knoten emitted alle diese Events, so dass sie in node-red verarbeitet werden können.
  - Genauso können messages an den ui-app Knoten gehen, die dann an den/die clients gesendet werden. Hier ist aber unklar, wie diese Events im Client verarbeitet werden.

## Querschnittliche Designlücken

### 1. Verhalten ist noch nicht ausreichend modelliert

Das MVP zeigt erfolgreich, dass Struktur, Rendering und UI-Ereignisse zusammenarbeiten. Die Verhaltensschicht muss aber klar entlang von `ui-action` für UI-Verhalten, `ui-store` für Zustand und getrennten UI-/fachlichen Events geschnitten werden. Besonders `ui-navigation` sollte in diesem Modell als Spezialfall von `ui-action` verstanden werden.

### 2. Inputs und Tabellen sind semantisch zu flach

`ui-input` und `ui-table` funktionieren für das CRUD-Beispiel, tragen aber noch nicht genug Struktur für reale Anwendungen. Beide Knoten brauchen wahrscheinlich reichhaltigere Untermodelle oder zusätzliche spezialisierte Knoten.

### 3. Preview und Produktmodell sind noch enger gekoppelt als gewünscht

Die Preview-Laufzeit enthält beispielspezifische Sonderfälle für den Customer-CRUD-Flow. Das ist als MVP-Hardening legitim, darf aber nicht mit der langfristigen Knotenspezifikation verwechselt werden.

## Empfohlene Nächste Schritte für die Spezifikation

1. `ui-action` formal typisieren: mindestens `navigate`, `disable`, `enable`, `show`, `hide`, `trigger`.
2. `ui-navigation` auf einen klaren Platz festlegen: eigener Komfort-Knoten oder Alias für `ui-action:navigate`.
3. `ui-store` als alleinigen Pfad für Zustandsänderungen modellieren: set, patch, delete, Output-Semantik.
4. UI-Events und fachliche Events explizit trennen und entscheiden, ob dafür ein eigener Event-Handler-Knoten oder ein Client-Event-Modell gebraucht wird.
5. Danach die Input-Familie schärfen: Feldtypen, Labels, Validierung, Bindings und eventuelle Spezialisierungen wie Select oder Checkbox.
6. Anschließend die Tabellen- und Listenmodelle erweitern: Spaltendefinitionen, Formatierung, Selektion, Pagination.
