# PRD – Node-RED UI-System für Web-Apps

## 1. Ziel

Es soll ein neues UI-System für Node-RED entstehen, das nicht primär wie ein klassisches Dashboard funktioniert, sondern die Entwicklung vollständiger Web-Apps ermöglicht.
Die Lösung soll weiterhin auf Knoten basieren, aber deutlich intuitiver modellierbar sein als ein hierarchischer „Child sendet Definition an Parent“-Ansatz.

Das System soll daher:

* UI-Struktur deklarativ beschreibbar machen
* Node-RED-Stärken für Daten- und Eventfluss nutzen
* Hierarchie nicht aus der Verkabelung ableiten
* komplexere Web-App-Muster wie Routen, Layouts, State, Dialoge und Formulare unterstützen
* wiederverwendbare Komponenten ermöglichen

---

## 2. Problem

Bestehende Dashboard-orientierte Ansätze in Node-RED sind stark widget-zentriert und für einfache Oberflächen geeignet, aber nur eingeschränkt für echte Web-App-Strukturen.

Ein früherer Ansatz basierte darauf, dass Knoten ihre UI-Definition entlang eines Flusses weiterreichen und ein übergeordneter Knoten daraus eine Hierarchie zusammensetzt. Dieser Ansatz hatte folgende Nachteile:

* unnatürliche Denkrichtung
* schlechte Intuition beim Modellieren
* Verkabelung musste gleichzeitig Struktur und Verhalten ausdrücken
* schwer wartbar bei komplexeren UIs
* unklare Trennung zwischen Aufbau, Datenbindung und Laufzeitlogik

---

## 3. Produktvision

Das Produkt ist ein deklaratives UI-System für Node-RED, das Web-Apps als Kombination aus:

* Routen
* Layouts
* Regionen/Slots
* View-Komponenten
* State
* Actions
* Events

modelliert.

Die Verkabelung zwischen Knoten zeigt dabei primär:

* Datenfluss
* Eventfluss
* Aktionen und Seiteneffekte

Die UI-Hierarchie selbst wird über deklarative Metadaten wie `route`, `mount`, `slot` und `bind` definiert.

---

## 4. Produktprinzipien

### 4.1 Hierarchie nicht aus Verdrahtung ableiten

Die Anordnung im UI darf nicht davon abhängen, wie Knoten verbunden sind.

### 4.2 Verdrahtung zeigt Verhalten

Verbindungen zwischen Knoten repräsentieren Daten- oder Eventfluss, nicht DOM-Elternschaft.

### 4.3 Deklarative Platzierung

Jede UI-Komponente gibt explizit an, wo sie gerendert wird, z. B. über `mount`.

### 4.4 Trennung von Struktur, Darstellung und Verhalten

Struktur, Rendering, State und Aktionen sind getrennte Konzepte.

### 4.5 Wiederverwendbarkeit

Komplexe UI-Bausteine sollen als Subflows bzw. Komponenten nutzbar sein.

---

## 5. Zielgruppen

### Primäre Zielgruppe

* Node-RED-Nutzer, die statt Dashboards interaktive Web-Apps bauen möchten

### Sekundäre Zielgruppe

* Entwickler von internen Fachanwendungen
* Low-Code- und Prototyping-Teams
* Nutzer mit Bedarf an CRUD-Oberflächen, Formularen, Listen, Dialogen und Navigation

---

## 6. Use Cases

### 6.1 CRUD-Anwendung

Ein Nutzer erstellt eine Kundenverwaltung mit:

* Listenansicht
* Detailansicht
* Formularen
* Dialogen
* Aktionen wie Speichern, Löschen, Filtern

### 6.2 Interne Business-App

Eine Anwendung mit:

* mehreren Routen
* wiederverwendbaren Layouts
* rollenabhängiger Sichtbarkeit
* API-Anbindung
* zentralem State

### 6.3 Komponentenbasierte UIs

Ein Nutzer erstellt wiederverwendbare UI-Bausteine, z. B.:

* Kundenkarte
* Toolbar
* Suchformular
* Dialog-Komponenten

---

## 7. Funktionsumfang

## 7.1 Knotenkategorien

### A. Struktur-Knoten

Definieren die App-Struktur.

Beispiele:

* `ui-app`
* `ui-route`
* `ui-layout`
* `ui-slot`
* `ui-tabs`
* `ui-dialog`
* `ui-container`

### B. View-Knoten

Definieren sichtbare UI-Elemente.

Beispiele:

* `ui-text`
* `ui-button`
* `ui-table`
* `ui-chart`
* `ui-input`
* `ui-select`
* `ui-card`
* `ui-list`

### C. State-/Daten-Knoten

Verwalten Datenquellen und Zustand.

Beispiele:

* `ui-store`
* `ui-query`
* `ui-transform`
* `ui-selection`
* `ui-filter`
* `ui-computed`

### D. Verhaltens-Knoten

Steuern Interaktion und Seiteneffekte.

Beispiele:

* `ui-action`
* `ui-event`
* `ui-navigation`
* `ui-command`
* `ui-visibility`

---

## 7.2 Deklaratives Mounting

Jede View-Komponente muss unabhängig von ihrer Verdrahtung angeben können, wo sie gerendert wird.

Pflichtattribute bzw. zentrale Attribute:

* `id`
* `mount`
* optional `order`
* optional `visibleIf`
* optional `enabledIf`
* optional `bind`

Beispiele:

* Komponente rendert in `customers.header`
* Tabelle rendert in `route:/customers/content`
* Formular rendert in `dialog:customerCreate/content`

---

## 7.3 Slot-/Region-Modell

Layouts und Container definieren benannte Regionen bzw. Slots.

Beispiele:

* `header`
* `sidebar`
* `content`
* `footer`
* `tab:overview`
* `tab:orders`

Andere Knoten können sich gezielt in diese Slots einhängen.

---

## 7.4 Routing

Das System muss Routing für Web-Apps unterstützen.

Anforderungen:

* Definition von Routen
* Zuordnung von Layouts zu Routen
* Navigation zwischen Routen
* optional Parameter wie `/customers/:id`
* Route als Kontext für Komponenten und Events

---

## 7.5 State-Management

Das System benötigt ein explizites State-Modell.

Anforderungen:

* zentrale Stores
* Bindings von UI-Komponenten auf State
* Updates durch Actions oder Queries
* abgeleitete Werte über Computed/Transform-Knoten
* Sichtbarkeits- und Aktivierungsregeln auf Basis des State

---

## 7.6 Event- und Action-Modell

UI-Ereignisse sollen in Node-RED-Flows weiterverarbeitet werden können.

Beispiele:

* Klick auf Button
* Formular absenden
* Zeile in Tabelle auswählen
* Route ändern
* Dialog öffnen/schließen

UI-Events sollen standardisiert beschrieben werden.

Beispielhafte Event-Struktur:

```js
msg.ui = {
  event: "click",
  componentId: "newBtn",
  route: "/customers",
  params: {},
  statePatch: {}
}
```

---

## 7.7 UI-Definition als Registry-Modell

Die UI soll intern nicht über live propagierte Parent/Child-Nachrichten aufgebaut werden, sondern über eine zentrale Registry.

Jeder UI-Knoten registriert dort seinen Beitrag.

Anforderungen:

* eindeutige Komponenten-IDs
* deklarative Definition pro Knoten
* Zusammenführung zu einem App-Modell
* Rendering auf Basis dieses Modells

Beispielhafte interne Repräsentation:

* Routen
* Layouts
* Regionen
* Komponenten
* Bindings
* Sichtbarkeitsregeln

---

## 7.8 Wiederverwendbare Komponenten

Komponenten sollen als Subflows oder definierte UI-Bausteine wiederverwendbar sein.

Anforderungen:

* definierte Inputs
* definierte Outputs
* optionale Slots
* kapselbare interne Logik
* mehrfach einsetzbar

Beispiele:

* `customer-card`
* `search-toolbar`
* `detail-dialog`

---

## 8. UX-Anforderungen im Editor

Da Node-RED als Canvas nur begrenzt für Hierarchien geeignet ist, braucht das Produkt zusätzlich zur Flow-Darstellung eine Strukturansicht.

### Anforderungen

* Knoten bearbeiten Verhalten und Bindings im Flow
* Seitenleiste zeigt die UI-Struktur als Baum
* Sicht auf:

  * App
  * Routen
  * Regionen
  * Komponenten
  * Slots

Beispiel:

* App

  * Route `/customers`

    * header

      * button `newBtn`
    * content

      * table `customerTable`

Dadurch wird die strukturelle Lesbarkeit verbessert, ohne die Flow-Logik zu überladen.

---

## 9. Nicht-Ziele

Dieses Produkt soll zunächst nicht:

* ein klassischer Dashboard-Ersatz mit Fokus auf einfache Widgets sein
* DOM-Baumaufbau direkt über Verkabelung modellieren
* HTML/CSS in Rohform durch den Nutzer erfordern
* beliebige Frontend-Frameworks 1:1 nachbilden
* vollständig generischer Website-Builder sein

---

## 10. Technische Architektur

## 10.1 Zwei Ebenen

### Ebene 1: Declarative UI Graph (AppModel)

Beschreibt die statische bzw. halb-statische UI-Struktur. Wird serverseitig aus der Registry kompiliert und ist während der Laufzeit eines Deployments unveränderlich:

* Routen
* Layouts
* Slots
* Komponenten
* Bindings
* Action-Definitionen

### Ebene 2: Runtime Event Graph

Beschreibt die dynamische Ausführung. Läuft primär auf dem Server, bestimmte Teile werden im Client ausgeführt:

* Klicks und UI-Events
* Submit-Events
* API-Requests und Queries
* State-Updates und Patches
* Navigation
* Dialogsteuerung

Diese Trennung nutzt Node-RED dort, wo es stark ist: in der Ereignis- und Datenorchestrierung.

---

## 10.2 Server-seitige Registry

Die Registry ist die zentrale Datenhaltung auf dem Server.

Kernprinzipien:

* jeder UI-Knoten registriert sich beim Deploy in der zentralen UI-Registry
* die Registry kompiliert daraus ein typsicheres AppModel
* das AppModel ist während der Laufzeit unveränderlich (read-only)
* bei Re-Deploy wird das AppModel neu kompiliert und alle verbundenen Clients werden benachrichtigt
* die Registry ist nicht user-spezifisch — sie beschreibt die Struktur der App, nicht ihren Zustand

---

## 10.3 Client-seitige Runtime (SPA)

Die Browser-Runtime ist eine vollständige Single Page Application, die auf Basis des AppModels und des laufenden States rendert.

Technologie-Stack:

* **React + Vite** als SPA-Framework — professionell, komponentenbasiert, großes Ökosystem
* Reaktiver State-Store im Browser (z. B. Zustand oder Jotai) für sofortige UI-Updates ohne Server-Round-Trip
* Clientseitiges Routing (React Router oder TanStack Router) für Navigation ohne Seitenreload
* Das AppModel wird einmalig beim Verbindungsaufbau geladen und gecacht

Die Runtime ist verantwortlich für:

* Empfang und Anwendung von State-Patches vom Server
* Rendering des Komponenten-Baums auf Basis von AppModel + State
* Auslösen von Events und Actions über den Kommunikationskanal
* Ausführung von client-seitiger Logik (siehe 10.6)

---

## 10.4 Kommunikationsprotokoll

Das System verwendet einen Hybridansatz:

### HTTP (Bootstrap)

* Ausliefern der SPA-Shell (HTML + JS-Bundle)
* Laden des initialen AppModels (`GET /webapp/:appId/model`)
* Optionale REST-Endpunkte für einfache, zustandslose Operationen

### WebSocket (Laufzeit)

WebSocket ist der primäre Kanal für alle Laufzeit-Kommunikation zwischen Client und Server.

Client → Server (Messages):

```json
{ "type": "event", "actionId": "...", "componentId": "...", "payload": { ... } }
{ "type": "query:refresh", "queryId": "..." }
{ "type": "session:init", "appId": "..." }
```

Server → Client (Messages):

```json
{ "type": "state:patch", "patch": { ... } }
{ "type": "query:result", "queryId": "...", "data": [ ... ] }
{ "type": "navigate", "to": "/customers/42" }
{ "type": "model:updated" }
```

Eigenschaften des WS-Kanals:

* eine Verbindung pro Browser-Tab
* automatisches Reconnect mit Backoff
* Heartbeat/Ping für Verbindungsüberwachung
* alle Messages sind JSON mit typisiertem `type`-Feld

---

## 10.5 Multi-User-Modell

Das System ist von Grund auf für mehrere gleichzeitige Nutzer ausgelegt.

Sessionkonzept:

* jeder verbundene Client erhält eine eindeutige `sessionId`
* der Server verwaltet State und Query-Ergebnisse pro Session
* State-Patches werden gezielt nur an die jeweilige Session gesendet

State-Scoping:

* **Session-State (Default):** jeder User hat seinen eigenen isolierten State — Änderungen eines Users sind für andere nicht sichtbar. Dies ist der Standard für alle `ui-store`-Knoten.
* **Shared State (opt-in):** ein `ui-store`-Knoten kann explizit als `scope: "shared"` markiert werden — Änderungen werden an alle verbundenen Clients desselben `appId` gebroadcastet. Geeignet für kollaborative Szenarien oder globale App-Zustände (z. B. Benachrichtigungen).

AppModel ist shared:

* das kompilierte AppModel ist für alle Sessions identisch
* bei Re-Deploy werden alle Clients über `{ "type": "model:updated" }` informiert und laden das Modell neu

---

## 10.6 Client/Server-Logikgrenze

Logik läuft primär auf dem Server (Node-RED Flows). Bestimmte Operationen werden jedoch client-seitig ausgeführt, um sofortige UI-Reaktionen ohne Netzwerk-Latenz zu ermöglichen.

| Action-Typ | Ausführung | Begründung |
|---|---|---|
| `navigate` | Client | Sofortiges Routing ohne Server-Round-Trip |
| `show` / `hide` | Client | Lokaler State-Toggle |
| `enable` / `disable` | Client | Lokaler State-Toggle |
| `trigger` | Server | Löst Node-RED Flow aus |
| `submit` (Formular) | Server | Daten-Mutation über Flow |
| Query laden / refreshen | Server | Datenquelle liegt auf Server |
| State-Patch anwenden | Client | Empfang und Anwendung von Server-Patches |

Grundprinzip: der Server ist die einzige Source of Truth für persistente Daten und Business-Logik. Der Client darf lokalen UI-State optimistisch anpassen, muss aber auf Server-Patches reagieren.

---

## 10.7 Standardisierte Komponentendefinition

Jede UI-Komponente im AppModel hat folgende Struktur:

* `id` — eindeutige Komponenten-ID
* `type` — Knotentyp (z. B. `ui-button`)
* `mount` — Ziel-Slot
* `props` — statische Eigenschaften
* `bindings` — dynamische Bindings auf State oder Query-Pfade
* `events` — gemappte Event → Action Zuordnungen
* `visibleIf` — optionaler State-Pfad für bedingte Sichtbarkeit
* `enabledIf` — optionaler State-Pfad für bedingte Aktivierung
* `clientActions` — Liste von Actions, die client-seitig ausgeführt werden

---

## 10.8 Datengetriebene / repeating Komponenten

Die Registry beschreibt **Templates**, nicht Instanzen. Ein repeating Element ist ein einzelner Registry-Eintrag — die Runtime entscheidet zur Laufzeit, wie viele Instanzen gerendert werden.

### Grundprinzip

```
AppModel (statisch, 1 Eintrag):
  ui-list
    bind: queries.customers.data   ← Datenquelle (Array)
    itemTemplate:                  ← wird N-mal gerendert
      ui-text  bind: item.name
      ui-button action: selectRow

Runtime (dynamisch):
  → 42 Einträge in der Query
  → rendert itemTemplate 42× mit eigenem item-Kontext
```

Jede Template-Instanz erhält einen **Item-Kontext** mit:

* `item` — der aktuelle Datensatz
* `index` — die Position im Array (0-basiert)
* `isFirst`, `isLast` — Hilfswerte für Styling

Bindings innerhalb eines Templates referenzieren diesen Kontext: `bind: item.name`, `bind: item.status`.

### Drei Abstraktionsstufen

**Stufe 1 — `ui-table`**

Spalten werden statisch als Props definiert, Rows kommen aus einer Query oder einem State-Pfad. Kein explizites Item-Template nötig — built-in Rendering.

Geeignet für: tabellarische Daten mit einheitlichem Schema.

**Stufe 2 — `ui-list`**

Ein Container mit einem expliziten `item`-Slot. Der Inhalt des Slots ist das Template und wird pro Datensatz gerendert. Komponenten im Slot können beliebige View-Knoten sein.

Geeignet für: Card-Listen, Suchergebnisse, Feed-Ansichten.

**Stufe 3 — `ui-repeat`**

Wie `ui-list`, aber ohne eigene Wrapper-Struktur — das Template wird direkt in den Parent-Slot eingebettet. Ermöglicht verschachtelte Repeats (z. B. Gruppen mit Untereinträgen).

Geeignet für: hierarchische Listen, gruppierte Ansichten.

### Item-Kontext in Bindings

Innerhalb eines Templates sind neben dem globalen State und Query-Ergebnissen zusätzlich Item-Pfade verfügbar:

```json
{ "kind": "item", "path": "name" }       // → item.name
{ "kind": "item", "path": "status" }     // → item.status
{ "kind": "index" }                      // → aktueller Index
```

### Interaktion aus repeating Elementen

Actions aus einem Item-Template müssen das ausgewählte Item identifizieren können. Dafür wird beim Auslösen einer Action automatisch ein `itemPayload` mitgegeben:

```json
{
  "type": "event",
  "actionId": "selectRow",
  "componentId": "selectButton",
  "itemPayload": { "id": "cust-42", "name": "Acme GmbH" }
}
```

Der Server-Flow empfängt dieses Payload und kann damit den richtigen Datensatz identifizieren — ohne dass die Registry wissen muss, wie viele Items es gibt.

### Abgrenzung zur Registry

Die Registry bleibt zu jeder Zeit statisch:

* sie kennt den `ui-list`-Knoten und sein Template — aber nie die Anzahl der Items
* neue Items in einer Query erzeugen keine neuen Registry-Einträge
* das AppModel wächst nicht mit den Daten

Die Runtime ist alleinig verantwortlich für das Auffalten des Templates zur Laufzeit.

---

## 11. Funktionale Anforderungen

### Muss

* deklarative Platzierung über `mount`
* Routen und Layouts
* sichtbare Komponenten als Knoten
* Eventfluss über Node-RED
* State-/Store-Konzept mit Session-Scope (Default)
* UI-Registry zur Zusammenführung aller Definitionen
* Strukturansicht im Editor
* Dialoge und Formulare
* Wiederverwendbarkeit über Subflows/Komponenten
* React-SPA als Browser-Runtime (Vite-Build)
* WebSocket-Kanal für Laufzeit-Kommunikation (State-Patches, Events, Query-Ergebnisse)
* HTTP-Endpunkt für AppModel-Bootstrap
* Session-Management für Multi-User-Betrieb
* Client-seitige Ausführung für `navigate`, `show/hide`, `enable/disable`
* Server-seitige Ausführung für `trigger`, `submit`, Queries

### Sollte

* Tabs und verschachtelte Regionen
* Sichtbarkeitsregeln über State-Pfade
* Computed Values
* Shared State (opt-in per `ui-store`)
* Standard-Pattern für CRUD-Anwendungen
* Automatisches Client-Reconnect bei Verbindungsabbruch
* `model:updated`-Benachrichtigung bei Re-Deploy

### Kann

* Theming
* Rollen-/Rechteintegration
* responsive Layout-Vorlagen
* Komponentenbibliothek
* Hot-Reload/Live-Preview im Editor
* Optimistische UI-Updates (Client wendet Action sofort an, wartet auf Server-Bestätigung)

---

## 12. Erfolgskriterien

Das Produkt ist erfolgreich, wenn:

* Nutzer komplexere UIs bauen können, ohne Parent/Child-Flusslogik „rückwärts“ denken zu müssen
* die Verkabelung im Flow überwiegend Verhalten statt Struktur ausdrückt
* typische Web-App-Muster modellierbar sind
* Komponenten wiederverwendbar sind
* die UI-Struktur trotz Canvas-basiertem Editor verständlich bleibt
* ein CRUD-Beispiel mit Routen, Tabelle, Formular und Dialog ohne unnatürliche Knotenverkabelung abbildbar ist

---

## 13. Offene Fragen

* Wie strikt soll das interne Komponentenmodell vorgegeben sein?
* Wie flexibel soll das Layout-/Slot-System sein?
* Soll Styling rein konfigurationsbasiert oder komponentenbasiert erfolgen?
* Wie tief soll die State-Logik in Node-RED selbst integriert werden?
* Wie werden Subflows als UI-Komponenten am besten parametrisiert?
* Authentifizierung: Soll die SPA eine eigene Auth-Schicht haben oder setzt sie auf Node-RED-Middleware auf?
* WS-Skalierung: Soll Horizontal Scaling (mehrere Node-RED-Instanzen) unterstützt werden — und wenn ja, über welchen Broker (Redis Pub/Sub)?
* Soll es einen Entwicklungs-Modus geben, der State-Patches im Editor-Panel visualisiert (DevTools)?
* Wie wird mit optimistischen Client-Updates umgegangen, wenn der Server den State abbricht (Rollback-Strategie)?

---

## 14. MVP-Vorschlag

Für ein erstes MVP:

* `ui-app`
* `ui-route`
* `ui-layout`
* `ui-slot`
* `ui-text`
* `ui-button`
* `ui-table`
* `ui-container`
* `ui-input`
* `ui-dialog`
* `ui-store`
* `ui-query`
* `ui-action`
* `ui-navigation`

MVP-Fähigkeit:

* einfache Multi-Page-App
* ein Layout mit Slots
* Daten laden
* Tabelle anzeigen
* Dialog öffnen
* zusammenhängende Eingaben über Container, Inputs und Actions bearbeiten
* Daten aktualisieren
* zwischen Seiten navigieren

---

## 15. Zusammenfassung

Das geplante Produkt ist ein deklaratives, knotenbasiertes UI-System für Node-RED zur Entwicklung echter Web-Apps.

Der Kernansatz besteht darin, UI-Struktur nicht aus der Verkabelung abzuleiten, sondern über Routen, Slots, Mountpoints und Bindings zu definieren. Die Node-RED-Flows bleiben für Daten- und Eventlogik zuständig.

Die technische Architektur basiert auf drei klar getrennten Schichten:

* **Registry (Server):** Kompiliert Node-RED-Knoten-Definitionen in ein unveränderliches AppModel
* **Runtime (Client):** React-SPA, die das AppModel empfängt, State verwaltet und die Web-App rendert
* **Kommunikation:** HTTP für Bootstrap, WebSocket für alle Laufzeit-Interaktion (State-Patches, Events, Queries)

Das System ist für Multi-User-Betrieb ausgelegt: State ist per Session isoliert (Default) oder kann explizit als Shared State konfiguriert werden. Logik läuft primär auf dem Server — einfache UI-Operationen wie Navigation und Show/Hide werden client-seitig ausgeführt, um sofortige Reaktion ohne Netzwerk-Latenz zu gewährleisten.
