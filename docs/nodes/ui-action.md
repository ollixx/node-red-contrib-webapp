# `ui-action`

## Zusammenfassung

Repräsentiert eine benannte UI-Aktion. UI-Actions beschreiben ausschließlich Veränderungen am Verhalten oder Interaktionszustand von UI-Elementen, nicht die fachliche Datenhaltung.

Aktuelles MVP-Verhalten:
- Buttons und Tabellen referenzieren nur die Action-ID.
- Die Runtime führt keine generische Action-Semantik aus; sie emittiert Messages an den Action-Node und andere beteiligte Nodes.
- Die Preview enthält für das CRUD-Beispiel teils hart codierte Aktionseffekte wie `openCustomerEditor`, `saveCustomer` oder `refreshCustomers`.

## Abhängigkeiten

**Parent-Knoten:**
- Keiner. `ui-action` ist ein unabhängiger Verhaltensknoten.

**Gemeinsam genutzte Services und Komponenten:**
- Wird von `ui-button` über `action` referenziert
- Wird von `ui-table` über `selectAction` referenziert
- Wird von `ui-query` über `refreshAction` referenziert
- Wird von `ui-navigation` als Spezialisierung verwendet

## Editor

**Pflichtfelder:**
- `id`

**Optionale Felder:**
- `actionType`: `navigate | disable | enable | show | hide | trigger`
- `targetMode`: `out-port | path`
- `target`: Pflicht für `targetMode: path`, verboten für `targetMode: out-port`
- `to`: Zielpfad für `actionType: navigate`
- `description`

## Input

Ausgelöst durch Client-Events, zum Beispiel Button-Klick oder Tabellenselektion.

## Output

Die Runtime emittiert Messages an den Action-Node und andere beteiligte Nodes.

## Besonderheiten

Kompatibilität:
- `actionType`, `targetMode`, `target` und `to` sind heute optional, damit Legacy-Actions ohne typed fields weiter funktionieren.

Angedachtes Verhalten:
- ui-action erzeugt eine spezifische Message und diese muss an das Target-Element geschickt werden.
  - Das kann entweder in node-red modelliert werden, in dem der output des ui-action Knotens an den passenden z.B. ui-Input geschickt wird.
  - Alternativ muss das Target über einen eindeutigen Pfad oder seine ID definiert werden. Das ist eventuell notwendig, um dynamisch erzeugte elemente (Liste, oder repeat element) zu bestimmen

Offene Spezifikation:
- `ui-action` soll das zentrale Modell für UI-Verhalten werden.
- Alle Veränderungen am Interaktionszustand oder Verhalten von UI-Elementen sollen über `ui-action` beschrieben werden.
- Dazu gehören nach heutigem Stand mindestens diese Typen:
  - `navigate`: navigiert zu einer Route oder einer externen URL
  - `disable`: deaktiviert ein UI-Element
  - `enable`: aktiviert ein UI-Element
  - `show`: blendet ein UI-Element ein
  - `hide`: blendet ein UI-Element aus
  - `trigger`: löst ein anderes UI-Element aus, zum Beispiel einen Button oder Link
- Nicht zu `ui-action` gehören fachliche Datenupdates. Diese laufen über `ui-store`.
- Offen bleibt, wie Ziele adressiert werden: direkte Knotenreferenz, semantische ID, Parent/Child-Relation oder Selektoren.
- Ebenfalls offen bleibt, ob komplexere UI-Actions später als zusammengesetzte Sequenzen modelliert werden.
