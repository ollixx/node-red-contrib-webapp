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
- Keiner. `ui-store` ist ein unabhängiger State-Knoten.

**Gemeinsam genutzte Services und Komponenten:**
- Client-State: hält einen benannten State-Slice
- Wird von `ui-input` über `storeId` referenziert

## Editor

**Pflichtfelder:**
- `id`
- `statePath`: Der Wurzelpfad des Stores im Client-State. Dieser Pfad bezeichnet einen Store-Slice, nicht nur einen einzelnen Wert. Beispiel: `draft` oder `draft.customer`

**Optionale Felder:**
- `initialValue`

## Input

Bevorzugtes Nachrichtenformat:
- `msg.ui.store.id`: Store-ID, muss zum Knoten passen
- `msg.ui.store.op`: `set | patch | delete | replace | reset`
- `msg.ui.store.path`: relativer Pfad innerhalb des Stores, optional für Root-Operationen
- `msg.ui.store.value`: neuer Wert, wo für die Operation nötig

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
