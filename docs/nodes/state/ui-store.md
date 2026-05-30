# `ui-store`

## Zusammenfassung

Beschreibt einen zentralen Daten- oder Formularzustands-Slice und ist der einzige deklarative Pfad für fachliche Zustandsänderungen.

Aktuelles MVP-Verhalten:
- Initialwerte werden beim Preview-State-Aufbau unter dem angegebenen Pfad gesetzt.
- Als Node-RED-Node verarbeitet er `msg.ui.store` mit `set`, `patch`, `delete`, `replace` und `reset`, aktualisiert den Preview-State und emittiert eine `ui.store changed`-Notification.

Beschlossene MVP-Spezifikation:
- Ein `ui-store` repräsentiert einen benannten Store-Slice im Client, auf den über relative Pfade zugegriffen wird.
- Ein Store kann mehrere verschachtelte Werte halten. Für mehrere Felder innerhalb desselben zusammengehörigen Zustandsbereichs wird kein neuer Store-Knoten benötigt.
- Schreibzugriffe auf den Store laufen über den In-Port des Knotens.
- Der Knoten emittiert über den Out-Port Änderungsnachrichten, wenn der Store über Node-RED oder später vom Client aus geändert wird.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`: Pflicht. Die App ist der Routing-Kontext — sie bestimmt, an welchen Client Store-Notifications gesendet werden und welche eingehenden Messages überhaupt für diesen Store bestimmt sind. Ohne Parent-App ist der Knoten nicht funktionsfähig.

**Gemeinsam genutzte Services und Komponenten:**
- Client-State: hält einen benannten State-Slice
- Wird von `ui-input` über `storeId` referenziert

## Editor

**Pflichtfelder:**
- `parent`: Auswahl einer `ui-app`. Bestimmt den Routing-Kontext für alle Store-Messages.
- `statePath`: Der Name des Store-Slice im Client-State. Muss ein einzelner Bezeichner ohne Punkte oder Slashes sein — kein Pfad, sondern ein Slice-Name. Beispiel: `draft`, `customers`, `session`
  - Validierung: nur alphanumerische Zeichen und `_`, keine Punkte oder Slashes
  - Validierung: innerhalb einer App muss `statePath` eindeutig sein

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Wird bei der Darstellung des Knotens und in Auswahlfeldern angezeigt.
  - Default: `"Store N"` (fortlaufende Nummer aller ui-store-Knoten, startend bei 1)
- `initialValue`
- `persist`: Ob der Store-Slice im `localStorage` des Clients persistiert wird. Ermöglicht Offline-Resilienz und automatische Synchronisation bei Wiederverbindung. Details in [multi-user.md](../concepts/multi-user.md).
  - Default: `false`

## Input

Bevorzugtes Nachrichtenformat:
- `msg.ui.store.id`: Store-ID, muss zum Knoten passen
- `msg.ui.store.op`: `set | patch | delete | replace | reset`
- `msg.ui.store.path`: relativer Pfad innerhalb des Stores, optional für Root-Operationen
- `msg.ui.store.value`: neuer Wert, wo für die Operation nötig
- `msg.ui.clientId` _(optional)_: Wenn gesetzt, wird das Update nur im State des angegebenen Clients angewendet und die Notification nur an diesen Client gesendet. Ohne `clientId` wird der Update an alle verbundenen Clients der App gebroadcastet.

Bedeutung der Operationen:
- `set`: setzt einen Wert an einem relativen Pfad
- `patch`: merged React-freundlich ein Objekt in einen bestehenden Objektwert
- `delete`: entfernt einen Wert an einem relativen Pfad
- `replace`: ersetzt den kompletten Store-Slice
- `reset`: setzt den Store-Slice auf den konfigurierten `initialValue` zurück

## Output

Der Knoten emittiert eine standardisierte Store-Notification auf `msg.ui.store` mit mindestens:
- `id`
- `event: changed`
- `op`
- `path`
- `fullPath`
- `value`
- `previousValue`
- `origin`

## Besonderheiten

Abgrenzung:
- `ui-store` beschreibt und verändert lokalen Zustand.
- `ui-query` beschreibt geladene Datenquellen und deren Ladezustand.
- `ui-action` beschreibt UI-Verhalten, nicht fachliche Datenupdates.

Offene Spezifikation:
- Initialwerte sollen zusätzlich Node-RED-typisch über Typed-Input-Felder oder über eingehende Initialisierungsnachrichten gesetzt werden können.
- Noch offen ist, ob `ui-store` später auch Persistenz, Derived State oder Synchronisationsregeln kapseln soll.
