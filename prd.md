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

### Ebene 1: Declarative UI Graph

Beschreibt die statische bzw. halb-statische UI-Struktur:

* Routen
* Layouts
* Slots
* Komponenten
* Bindings

### Ebene 2: Runtime Event Graph

Beschreibt die dynamische Ausführung:

* Klicks
* Submit-Events
* API-Requests
* State-Updates
* Navigation
* Dialogsteuerung

Diese Trennung nutzt Node-RED dort, wo es stark ist: in der Ereignis- und Datenorchestrierung.

---

## 10.2 Registry statt Parent-Sammellogik

Interne Kernidee:

* jeder UI-Knoten registriert sich in einer zentralen UI-Registry
* Renderer erzeugt daraus die Web-App
* Verdrahtung dient nur der Laufzeitlogik

---

## 10.3 Standardisierte Definitionsstruktur

Beispielhaft soll jede UI-Komponente intern Eigenschaften haben wie:

* `id`
* `type`
* `mount`
* `props`
* `bindings`
* `events`
* `visibleIf`
* `enabledIf`

---

## 11. Funktionale Anforderungen

### Muss

* deklarative Platzierung über `mount`
* Routen und Layouts
* sichtbare Komponenten als Knoten
* Eventfluss über Node-RED
* State-/Store-Konzept
* UI-Registry zur Zusammenführung aller Definitionen
* Strukturansicht im Editor
* Dialoge und Formulare
* Wiederverwendbarkeit über Subflows/Komponenten

### Sollte

* Tabs und verschachtelte Regionen
* Sichtbarkeitsregeln
* Computed Values
* Navigation als eigener Knotentyp
* Standard-Pattern für CRUD-Anwendungen

### Kann

* Theming
* Rollen-/Rechteintegration
* responsive Layout-Vorlagen
* Komponentenbibliothek
* Hot-Reload/Live-Preview

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
* Soll die Laufzeit ein eigenes Frontend-Framework nutzen oder ein abstrahiertes Renderer-Modell?
* Wie werden Subflows als UI-Komponenten am besten parametrisiert?

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
Der Kernansatz besteht darin, UI-Struktur nicht aus der Verkabelung abzuleiten, sondern über Routen, Slots, Mountpoints und Bindings zu definieren. Die Node-RED-Flows bleiben für Daten- und Eventlogik zuständig. Dadurch entsteht ein deutlich intuitiveres und skalierbareres Modell als bei einem rückwärts gedachten Parent/Child-Ansatz.
