# Node Catalog

## Zweck

Dieses Dokument beschreibt die aktuell vorhandenen Node-RED-Knoten des Projekts in ihrem heutigen Zustand. Es trennt dabei bewusst zwischen:

- dem deklarativen Vertrag, den ein Knoten ins gemeinsame Modell einbringt
- dem aktuellen Laufzeitverhalten im MVP
- den offenen Punkten, die vor einer schaerferen Produktspezifikation geklaert werden sollten

Das Dokument ist damit kein reiner Benutzerleitfaden, sondern die Arbeitsgrundlage fuer die naechste Spezifikationsrunde.

## Kategorien

- Struktur: `ui-app`, `ui-layout`, `ui-region`, `ui-route`, `ui-dialog`
- View: `ui-text`, `ui-button`, `ui-table`, `ui-form`
- State: `ui-store`, `ui-query`
- Verhalten: `ui-action`, `ui-navigation`

## Gemeinsame Modellregeln

- `appId` ordnet alle Knoten ausser `ui-app` genau einer App zu.
- `id` ist die stabile Referenz, gegen die Mounts, Actions und Navigationen aufloesen.
- Struktur und Verhalten sind getrennt: Wires bilden nicht die UI-Hierarchie ab, sondern Daten- oder Ereignisfluss.
- View-Knoten werden ueber `mount` an eine Route-, Dialog- oder Layout-Region gebunden.
- Das gemeinsame Schema validiert heute vor allem Feldpraesenz und Grundform, nicht die vollstaendige fachliche Semantik.

## Strukturknoten

### `ui-app`

Zweck:
Definiert die Wurzel einer deklarativen Web-App.

Deklarativer Vertrag:
- Pflichtfelder: `id`, `title`
- Liefert die App-Identitaet fuer alle anderen Knoten.

Aktuelles MVP-Verhalten:
- Genau eine `ui-app` wird pro assembliertem Knotensatz akzeptiert.
- Dient als Einstieg fuer Runtime-API, Renderer und Editor-Strukturansicht.

Offene Spezifikation:
- Soll eine App kuenftig globale Metadaten wie Theme, Basisroute oder Berechtigungen tragen?
- Ist genau eine App pro Flow gewollt oder nur genau eine pro zusammenhaengendem Deploy-Slice?

### `ui-layout`

Zweck:
Definiert einen benannten Seiten- oder Dialog-Container mit Regionen.

Deklarativer Vertrag:
- Pflichtfelder: `appId`, `id`
- Optional: `title`

Aktuelles MVP-Verhalten:
- Regionen werden ueber `ui-region` zu einem Baum pro Layout aufgebaut.
- Routen und Dialoge verweisen ueber `layoutId` auf ein Layout.

Offene Spezifikation:
- Fehlen explizite Layout-Typen wie Shell, Dialog-Shell oder Tabs-Container.
- Es gibt noch keine deklarativen Layout-Varianten fuer Responsiveness oder Breakpoints.

### `ui-region`

Zweck:
Definiert einen benannten Slot innerhalb eines Layouts.

Deklarativer Vertrag:
- Pflichtfelder: `appId`, `id`, `layoutId`, `name`
- Optional: `parentRegionId`, `title`, `order`

Aktuelles MVP-Verhalten:
- Regionen werden als Baum validiert.
- Geschwister duerfen denselben Namen nicht doppelt verwenden.
- View-Knoten mounten indirekt in diese Regionen.

Offene Spezifikation:
- Region-Namen sind heute frei, aber nicht typisiert. Es gibt kein festes Slot-Vokabular.
- Es ist noch nicht geklaert, ob Regionen rein strukturell bleiben oder kuenftig Styling- und Sichtbarkeitsregeln tragen.

### `ui-route`

Zweck:
Definiert eine URL-Route und bindet sie an ein Layout.

Deklarativer Vertrag:
- Pflichtfelder: `appId`, `id`, `path`, `layoutId`
- Optional: `title`

Aktuelles MVP-Verhalten:
- Pfade mit Parametern wie `/customers/:id` werden aufgeloest.
- Der Renderer ermittelt daraus die aktive Route und Route-Parameter.

Offene Spezifikation:
- Route Guards, Loader, Titelauflosung und verschachtelte Routen fehlen.
- Die Beziehung zwischen Route und Query-Lebenszyklus ist noch nicht explizit modelliert.

### `ui-dialog`

Zweck:
Definiert einen Dialog mit eigenem Layout.

Deklarativer Vertrag:
- Pflichtfelder: `appId`, `id`, `layoutId`
- Optional: `title`, `routeId`, `modal`

Aktuelles MVP-Verhalten:
- Dialoge werden ueber Preview-State geoeffnet und geschlossen.
- View-Knoten koennen ueber `dialog:<dialogId>/...` in Dialogregionen mounten.

Offene Spezifikation:
- Das Oeffnen und Schliessen ist heute nicht generisch modelliert, sondern im Preview-Pfad teilhart codiert.
- Es fehlt ein klares Dialogmodell fuer Fokus, Backdrop, Escape-Verhalten und Rueckgabewerte.

## View-Knoten

### `ui-text`

Zweck:
Rendert einen Textwert an einem Mount-Ziel.

Deklarativer Vertrag:
- Pflichtfelder: `appId`, `id`, `mount`, `value`
- Optional: `variant`, `order`

Aktuelles MVP-Verhalten:
- Unterstuetzt Literal-, State-, Query- und Route-Param-Bindings ueber das gemeinsame Binding-Modell.
- Dient fuer Ueberschriften, Labels und Statusanzeigen.

Offene Spezifikation:
- Es ist unklar, ob `ui-text` nur Plaintext oder auch formatierte Inhalte unterstuetzen soll.
- Varianten sind heute frei benannt, aber noch nicht als Design-Tokens festgelegt.

### `ui-button`

Zweck:
Rendert einen klickbaren Button, der eine Action referenziert.

Deklarativer Vertrag:
- Pflichtfelder: `appId`, `id`, `mount`, `label`, `action`
- Optional: `disabled`, `order`

Aktuelles MVP-Verhalten:
- Rendert einen Link bzw. Trigger auf `/webapp/:appId/action/:actionId`.
- Emittiert standardisierte `msg.ui`-Ereignisse.
- Kann einen deaktivierten Zustand aus einem Binding beziehen.

Offene Spezifikation:
- Der Knoten kennt nur die Action-ID, aber keine deklarative Aussage ueber Variant, Intent, Busy-Zustand oder Bestaetigungslogik.
- Fuer produktive Nutzung braucht es wahrscheinlich ein reichhaltigeres Action- oder Command-Modell.

### `ui-table`

Zweck:
Rendert tabellarische Query-Daten und optional eine Selektionsaktion.

Deklarativer Vertrag:
- Pflichtfelder: `appId`, `id`, `mount`, `columns`, `rows`
- Optional: `selectAction`, `order`

Aktuelles MVP-Verhalten:
- Erwartet eine Zeilenliste ueber ein Query-Binding.
- Kann pro Zeile eine Action beim Selektieren ausloesen.
- Treibt im CRUD-Beispiel die Listen- und Detailnavigation.

Offene Spezifikation:
- Sortierung, Formatierung, Pagination, Spaltentypen und Mehrfachselektion sind nicht modelliert.
- `columns` ist heute nur eine Liste von Strings und damit fuer echte Tabellen zu schwach.

### `ui-form`

Zweck:
Rendert ein Formular aus Feldnamen, Model-Binding und Submit-Action.

Deklarativer Vertrag:
- Pflichtfelder: `appId`, `id`, `mount`, `fields`, `model`, `submitAction`
- Optional: `order`

Aktuelles MVP-Verhalten:
- Rendert aktuell Text-Inputs aus einer einfachen Feldliste.
- Schreibt beim Submit ein standardisiertes UI-Event.
- Der Preview-Pfad persistiert Werte im CRUD-Beispiel ueber eine formularbezogene Sonderlogik.

Offene Spezifikation:
- `fields` ist nur eine Liste von Namen. Es fehlen Typ, Label, Validierung, Default, Required, Optionen und Layout.
- Fuer eine echte Formularabstraktion braucht es eigene Felddefinitionen oder separate Input-Knoten.

## State-Knoten

### `ui-store`

Zweck:
Beschreibt einen zentralen UI-State-Slice.

Deklarativer Vertrag:
- Pflichtfelder: `appId`, `id`, `statePath`
- Optional: `initialValue`

Aktuelles MVP-Verhalten:
- Initialwerte werden beim Preview-State-Aufbau unter dem angegebenen Pfad gesetzt.
- Als Node-RED-Node reicht er eingehende Nachrichten einfach weiter.

Offene Spezifikation:
- Es ist noch nicht definiert, wie Store-Updates deklarativ beschrieben werden.
- Unklar ist, ob `ui-store` nur Zustand beschreibt oder auch Schreibregeln, Persistenz und Derived State kapseln soll.

### `ui-query`

Zweck:
Beschreibt eine benannte geladene Datenquelle fuer die UI.

Deklarativer Vertrag:
- Pflichtfelder: `appId`, `id`, `queryPath`
- Optional: `source`, `refreshAction`

Aktuelles MVP-Verhalten:
- Preview initialisiert Query-Statusfelder unter `ui.queries.<id>`.
- `refreshAction` verknuepft eine Action-ID mit Query-Refresh-Metadaten.
- Als Node-RED-Node reicht `ui-query` Nachrichten durch.

Offene Spezifikation:
- Es gibt noch kein explizites Modell fuer Laden, Fehler, Stale-Daten, Parameter oder Caching.
- `source` ist bisher kaum semantisch belegt und muss entweder klar definiert oder entfernt werden.

## Verhaltensknoten

### `ui-action`

Zweck:
Repraesentiert eine benannte UI-Aktion als Referenz- und Verdrahtungspunkt.

Deklarativer Vertrag:
- Pflichtfelder: `appId`, `id`
- Optional: `description`

Aktuelles MVP-Verhalten:
- Buttons und Formulare referenzieren nur die Action-ID.
- Die Runtime fuehrt keine generische Action-Semantik aus; sie emittiert Messages an den Action-Node und andere beteiligte Nodes.
- Die Preview enthaelt fuer das CRUD-Beispiel teils hart codierte Aktionseffekte wie `openCustomerEditor`, `saveCustomer` oder `refreshCustomers`.

Offene Spezifikation:
- Das ist aktuell der schwaechste Knoten im Modell: Er ist als Konzept sinnvoll, aber fachlich unterdefiniert.
- Es muss geklaert werden, ob `ui-action` nur ein Ereignisanker bleibt oder ein echtes deklaratives Command-Modell bekommt, zum Beispiel mit State-Patch, Query-Trigger, Dialogeffekt, Navigationseffekt und Payload-Mapping.

### `ui-navigation`

Zweck:
Repraesentiert eine benannte Navigation zu einer Zielroute.

Deklarativer Vertrag:
- Pflichtfelder: `appId`, `id`, `to`

Aktuelles MVP-Verhalten:
- Der Preview-Pfad kann Routenparameter in `to` einsetzen.
- Bei Navigation wird ein `msg.ui`-Ereignis mit Navigationsmetadaten emittiert.

Offene Spezifikation:
- Navigation ist aktuell ein eigener Knotentyp neben `ui-action`, obwohl beides Verhalten repraesentiert.
- Es ist offen, ob Navigation langfristig ein Spezialfall von Action sein sollte oder bewusst getrennt bleibt.

## Querschnittliche Designluecken

### 1. Verhalten ist noch nicht ausreichend modelliert

Das MVP zeigt erfolgreich, dass Struktur, Rendering und UI-Ereignisse zusammenarbeiten. Die eigentliche Verhaltensschicht ist jedoch noch nicht sauber spezifiziert. Besonders `ui-action` und teilweise `ui-navigation` markieren eher Integrationspunkte als vollstaendige Domaintypen.

### 2. Formulare und Tabellen sind semantisch zu flach

`ui-form` und `ui-table` funktionieren fuer das CRUD-Beispiel, tragen aber noch nicht genug Struktur fuer reale Anwendungen. Beide Knoten brauchen wahrscheinlich reichhaltigere Untermodelle oder zusaetzliche spezialisierte Knoten.

### 3. Preview und Produktmodell sind noch enger gekoppelt als gewuenscht

Die Preview-Laufzeit enthaelt beispielspezifische Sonderfaelle fuer den Customer-CRUD-Flow. Das ist als MVP-Hardening legitim, darf aber nicht mit der langfristigen Knotenspezifikation verwechselt werden.

## Empfohlene Naechste Schritte fuer die Spezifikation

1. Zuerst die Verhaltensschicht klaeren: `ui-action`, `ui-navigation`, Query-Trigger, Dialogeffekte, State-Patches.
2. Danach das Formularmodell schaerfen: Feldtypen, Labels, Validierung, Bindings und Layout.
3. Anschliessend die Tabellen- und Listenmodelle erweitern: Spaltendefinitionen, Formatierung, Selektion, Pagination.
4. Erst danach neue Knotentypen aus dem PRD hinzufuegen, damit sie auf einer konsistenten Semantik aufbauen.