# Node Catalog

## Zweck

Dieses Dokument beschreibt die aktuell vorhandenen Node-RED-Knoten des Projekts in ihrem heutigen Zustand. Es trennt dabei bewusst zwischen:

- dem deklarativen Vertrag, den ein Knoten ins gemeinsame Modell einbringt
- dem aktuellen Laufzeitverhalten im MVP
- den offenen Punkten, die vor einer schaerferen Produktspezifikation geklaert werden sollten

Das Dokument ist damit kein reiner Benutzerleitfaden, sondern die Arbeitsgrundlage fuer die naechste Spezifikationsrunde.

## Kategorien

- Struktur: `ui-app`, `ui-layout`, `ui-slot`, `ui-route`, `ui-dialog`
- View: `ui-text`, `ui-button`, `ui-table`, `ui-container`, `ui-input`
- State: `ui-store`, `ui-query`
- Verhalten: `ui-action`, `ui-navigation`

## Gemeinsame Modellregeln

- Eine App wird heute fachlich ueber `uiId` bzw. im gemeinsamen Modell ueber `id` identifiziert. Dieser Wert muss eindeutig sein.
- Die Node-RED-interne Knoten-ID reicht nicht als fachliche ID fuer das gemeinsame UI-Modell.
- View-Knoten werden ueber `mount` an Route-, Dialog- oder Layout-Slots gebunden.
- Die Editor-Oberflaeche bietet fuer gaengige Referenzen wie `layoutId`, `routeId`, `mount`, `action` und `storeId` vorbelegte Auswahllisten aus den vorhandenen Webapp-Knoten.
- Strukturgefuehrte Parent- oder Baum-Selektoren existieren weiterhin nicht; die Auswahl bleibt feldbasiert und arbeitet auf den fachlichen IDs bzw. Mount-Strings.
- Das gemeinsame Schema validiert heute vor allem Feldpraesenz und Grundform, nicht die vollstaendige fachliche Semantik.

## Ereignis- und Zustandsmodell

- UI-Zustand und UI-Verhalten sind getrennte Konzepte.
- Fachlicher oder eingabebezogener Datenzustand laeuft ausschliesslich ueber `ui-store`.
- Veraenderungen am Verhalten oder am Interaktionszustand von UI-Elementen laufen ueber `ui-action`.
- `ui-event` bezeichnet ausschliesslich Ereignisse vom Client zum Backend.
- Fachliche Events sind davon getrennt. Sie koennen im Client explizit ausgeloest oder vom Backend an den Client weitergeleitet werden, wenn nicht direkt eine `ui-action` ausgefuehrt werden soll.

Abgrenzung:
- `ui-action`: beschreibt, was die UI tun soll
- `ui-store`: beschreibt, welcher Zustand gehalten und geaendert wird
- `ui-event`: beschreibt, was der Client dem Backend meldet
- fachliches Event: beschreibt eine fachliche Nachricht zwischen Frontend und Backend ohne unmittelbare UI-Aktionssemantik

## Strukturknoten

### `ui-app`

Zweck:
Definiert die Wurzel einer deklarativen Web-App.

Deklarativer Vertrag:
- Pflichtfelder:
  - `id`: fachliche App-ID. Im Node-RED-Editor kommt sie aktuell aus `uiId`.
  - `title`: sichtbarer Titel der App.
- Optional:
  - `name`: reines Node-RED-Anzeigefeld ohne Bedeutung fuer das gemeinsame Modell.

Aktuelles MVP-Verhalten:
- Es kann mehrere `ui-app` geben.
- Dient als Einstieg fuer Runtime-API, Renderer und Editor-Strukturansicht.
- Die App ist unter `/webapp/<appId>` erreichbar; eine getrennte `rootUrl`-Eigenschaft existiert heute nicht.

Offene Spezifikation:
- Es ist offen, ob `id` langfristig zugleich URL-Segment bleibt oder ob dafuer spaeter ein eigenes Feld wie `rootUrl` eingefuehrt wird.
- Soll eine App kuenftig globale Metadaten wie Theme, Basisroute oder Berechtigungen tragen?
  - Später: Themeauswahl. Erfordert ein Theme-Konzept
  - Authorization ist ein offener Punkt, könnte aber eine Auswahl aus verfügbaren Lösungen sein (OAuth2, OICD, ...)
- Ist genau eine App pro Flow gewollt oder nur genau eine pro zusammenhaengendem Deploy-Slice?
  - Es gibt ein Repository pro node-red instanz. Die Knoten sind unabhängig von flows.

### `ui-layout`

Zweck:
Definiert einen benannten Seiten- oder Dialog-Container mit Slots.

Deklarativer Vertrag:
- Pflichtfelder:
  - `id`: fachliche Layout-ID
- Optional:
  - `title`: sichtbarer Titel des Layouts

Aktuelles MVP-Verhalten:
- Slots werden ueber `ui-slot` flach pro Layout aufgebaut.
- Routen und Dialoge verweisen ueber `layoutId` auf ein Layout.
- Layouts sind heute app-gescoped. Sie werden nicht direkt ueber ein generisches `parent`-Feld an Route oder Dialog gebunden.

Offene Spezifikation:
- Fehlen explizite Layout-Typen wie Shell, Dialog-Shell oder Tabs-Container. Weitere Ideen: `horizontal`, `vertical`, `stack`, `absolute`
- Es gibt noch keine deklarativen Layout-Varianten fuer Responsiveness oder Breakpoints.

### `ui-slot`

Zweck:
Definiert einen benannten Mount-Slot innerhalb eines Layouts.

Deklarativer Vertrag:
- Pflichtfelder:
  - `id`: fachliche Slot-ID
  - `layoutId`: Layout, in dem dieser Slot lebt
  - `name`: Bezeichnet diesen Slot. Darf nicht leer sein und muss fuer sein Layout eindeutig sein.
- Optional:
  - `title`: sichtbarer Titel des Slots
  - `order`: Sortierreihenfolge; im Schema effektiv mit Default `0`

Aktuelles MVP-Verhalten:
- Slots werden flach pro Layout validiert.
- Geschwister duerfen denselben Namen nicht doppelt verwenden.
- View-Knoten mounten direkt in Route-, Dialog- oder Layout-Slots.

Offene Spezifikation:
- Slot-Namen sind heute frei, aber nicht typisiert. Es gibt kein festes Slot-Vokabular.
- Es ist noch nicht geklaert, ob Slots rein strukturell bleiben oder kuenftig Styling- und Sichtbarkeitsregeln tragen.
- Die fruehere Vermischung von Slot und verschachteltem Container ist aufgeloest: Verschachtelung laeuft ueber `ui-container` mit Child-Layout, nicht ueber geschachtelte Slot-Pfade.

### `ui-route`

Zweck:
Definiert eine URL-Route und bindet sie an ein Layout.n Aka "Page".

Deklarativer Vertrag:
- Pflichtfelder:
  - `id`: fachliche Route-ID
  - `path`: Das URL element, das die Route definiert (Beispiel: /webapp/appName/<path>)
  - `layoutId`: Layout, das fuer diese Route gerendert wird
- Optional:
  - `title`: sichtbarer Titel der Route

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
- Pflichtfelder: `id`, `layoutId`
- Optional: 
  - `title`: sichtbarer Titel des Dialogs
  - `routeId`: optionale Route-Verknuepfung
  - `modal`: Legt fest, ob der rest der webapp geblockt wird (light box) oder nicht.

Aktuelles MVP-Verhalten:
- Dialoge werden ueber einen State in einem Store geoeffnet und geschlossen.
  - Frage: macht es Sinn, ein flag nach Schema `<store-name>:<flag-name>` hier zu definieren?
- View-Knoten koennen ueber `dialog:<dialogId>/...` in Dialog-Slots mounten.

Offene Spezifikation:
- Das Oeffnen und Schliessen ist heute nicht generisch modelliert, sondern im Preview-Pfad teilhart codiert.
- Es fehlt ein klares Dialogmodell fuer Fokus, Backdrop, Escape-Verhalten und Rueckgabewerte.

## View-Knoten

### `ui-text`

Zweck:
Rendert einen Textwert an einem Mount-Ziel.

Deklarativer Vertrag:
- Pflichtfelder: 
  - `id`
  - `mount`
  - `value`: Binding-Ausdruck (siehe unten)
- Optional: `variant`, `order`

Aktuelles MVP-Verhalten:
- Unterstuetzt Literal-, State-, Query- und Route-Param-Bindings ueber das gemeinsame Binding-Modell.
  - Das Binding muss genauer beschrieben werden. Ideal wäre es, nur Elemente aus einem Store zu verwenden, um Resposiveness zu gewährleisten. Alternativ statische Werte. Hier könnten auch eingehene Messages mit dynamischen Werten - wie in node-red üblich - eingesetzt werden, die dann per Event im Store (client seitig) verändert werden.
- Dient fuer Ueberschriften, Labels und Statusanzeigen.

Offene Spezifikation:
- Es ist unklar, ob `ui-text` nur Plaintext oder auch formatierte Inhalte unterstuetzen soll.
- Varianten sind heute frei benannt, aber noch nicht als Design-Tokens festgelegt.

### `ui-button`

Zweck:
Rendert einen klickbaren Button, der eine Action referenziert.

Deklarativer Vertrag:
- Pflichtfelder:
  - `id`
  - `mount`
  - `label`: aktuell ein einfacher String, kein Binding-Ausdruck
  - `action`: Action-ID
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
- Pflichtfelder:
  - `id`
  - `mount`
  - `columns`: mindestens eine Spalte
  - `rows`: Binding auf die Zeilenliste
- Optional: `selectAction`, `order`

Aktuelles MVP-Verhalten:
- Erwartet eine Zeilenliste ueber ein Query-Binding.
- Kann pro Zeile eine Action beim Selektieren ausloesen.
- Treibt im CRUD-Beispiel die Listen- und Detailnavigation.

Offene Spezifikation:
- Sortierung, Formatierung, Pagination, Spaltentypen und Mehrfachselektion sind nicht modelliert.
- `columns` ist heute nur eine Liste von Strings und damit fuer echte Tabellen zu schwach.

### `ui-container`

Zweck:
Mountet einen Container an einen Slot und rendert darin ein Child-Layout.

Deklarativer Vertrag:
- Pflichtfelder: `id`, `mount`, `layoutId`
- Optional: `title`, `order`

Aktuelles MVP-Verhalten:
- Rendert aktuell das referenzierte Child-Layout rekursiv.
- Ist die vorgesehene Antwort auf verschachtelte UI-Struktur statt verschachtelter Slot-Pfade.
- Der Preview-Pfad nutzt Container mit Child-Layout, um Dialoginhalte inklusive Eingaben und Actions zu gruppieren.

Offene Spezifikation:
- Es ist noch offen, ob Container spaeter eigene Layout- oder Stylingvarianten tragen sollen.
- Child-Layouts brauchen mittelfristig bessere Editor-Unterstuetzung fuer Parent-Auswahl und Visualisierung.

### `ui-input`

Zweck:
Rendert ein generisches Eingabefeld mit State-Binding und optionalem Store-Binding.

Deklarativer Vertrag:
- Pflichtfelder: `id`, `mount`, `label`, `value`
- Optional: `storeId`, `path`, `inputType`, `placeholder`, `order`

Aktuelles MVP-Verhalten:
- Rendert einfache HTML-Inputs fuer Text, E-Mail und Zahlen.
- Schreibt Aenderungen im Renderer in den gebundenen State-Pfad.
- Kann im Preview zusammen mit `ui-container` und Action-Buttons als dialogartige Eingabegruppe arbeiten.

Offene Spezifikation:
- Validierung, Select-Optionen, Mehrzeiligkeit und komplexere Feldtypen fehlen noch.
- Das Zusammenspiel zwischen direktem State-Binding und Store-Operationen muss weiter geschaerft werden.

## State-Knoten

### `ui-store`

Zweck:
Beschreibt einen zentralen Daten- oder Formularzustands-Slice und ist der einzige deklarative Pfad fuer fachliche Zustandsaenderungen.

Deklarativer Vertrag:
- Pflichtfelder: 
  - `id`
  - `statePath`: Der Wurzelpfad des Stores im Client-State. Dieser Pfad bezeichnet einen Store-Slice, nicht nur einen einzelnen Wert. Beispiel: `draft` oder `draft.customer`
- Optional: `initialValue`

Aktuelles MVP-Verhalten:
- Initialwerte werden beim Preview-State-Aufbau unter dem angegebenen Pfad gesetzt.
- Als Node-RED-Node verarbeitet er `msg.ui.store` mit `set`, `patch`, `delete`, `replace` und `reset`, aktualisiert den Preview-State und emittiert eine `ui.store changed`-Notification.

Beschlossene MVP-Spezifikation:
- Ein `ui-store` repraesentiert einen benannten Store-Slice im Client, auf den ueber relative Pfade zugegriffen wird.
- Ein Store kann mehrere verschachtelte Werte halten. Fuer mehrere Felder innerhalb desselben zusammengehoerigen Zustandsbereichs wird kein neuer Store-Knoten benoetigt.
- Schreibzugriffe auf den Store laufen ueber den In-Port des Knotens.
- Der Knoten emittiert ueber den Out-Port Aenderungsnachrichten, wenn der Store ueber Node-RED oder spaeter vom Client aus geaendert wird.

MVP-Input-Vertrag:
- Bevorzugtes Nachrichtenformat:
  - `msg.ui.store.id`: Store-ID, muss zum Knoten passen
  - `msg.ui.store.op`: `set | patch | delete | replace | reset`
  - `msg.ui.store.path`: relativer Pfad innerhalb des Stores, optional fuer Root-Operationen
  - `msg.ui.store.value`: neuer Wert, wo fuer die Operation noetig
- Bedeutung der Operationen:
  - `set`: setzt einen Wert an einem relativen Pfad
  - `patch`: merged React-freundlich ein Objekt in einen bestehenden Objektwert
  - `delete`: entfernt einen Wert an einem relativen Pfad
  - `replace`: ersetzt den kompletten Store-Slice
  - `reset`: setzt den Store-Slice auf den konfigurierten `initialValue` zurueck

MVP-Output-Vertrag:
- Der Knoten emittiert eine standardisierte Store-Notification auf `msg.ui.store` mit mindestens:
  - `id`
  - `event: changed`
  - `op`
  - `path`
  - `fullPath`
  - `value`
  - `previousValue`
  - `origin`

Abgrenzung:
- `ui-store` beschreibt und veraendert lokalen Zustand.
- `ui-query` beschreibt geladene Datenquellen und deren Ladezustand.
- `ui-action` beschreibt UI-Verhalten, nicht fachliche Datenupdates.

Offene Spezifikation:
- Initialwerte sollen zusaetzlich Node-RED-typisch ueber Typed-Input-Felder oder ueber eingehende Initialisierungsnachrichten gesetzt werden koennen.
- Noch offen ist, ob `ui-store` spaeter auch Persistenz, Derived State oder Synchronisationsregeln kapseln soll.

### `ui-query`

Zweck:
Beschreibt eine benannte geladene Datenquelle fuer die UI.

Deklarativer Vertrag:
- Pflichtfelder: `id`, `queryPath`
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
Repraesentiert eine benannte UI-Aktion. UI-Actions beschreiben ausschliesslich Veraenderungen am Verhalten oder Interaktionszustand von UI-Elementen, nicht die fachliche Datenhaltung.

Deklarativer Vertrag:
- Pflichtfelder:
  - `id`
- Optional:
  - `actionType`: `navigate | disable | enable | show | hide | trigger`
  - `targetMode`: `out-port | path`
  - `target`: Pflicht fuer `targetMode: path`, verboten fuer `targetMode: out-port`
  - `to`: Zielpfad fuer `actionType: navigate`
  - `description`

Aktuelles MVP-Verhalten:
- Buttons und Tabellen referenzieren nur die Action-ID.
- Die Runtime fuehrt keine generische Action-Semantik aus; sie emittiert Messages an den Action-Node und andere beteiligte Nodes.
- Die Preview enthaelt fuer das CRUD-Beispiel teils hart codierte Aktionseffekte wie `openCustomerEditor`, `saveCustomer` oder `refreshCustomers`.

Kompatibilitaet:
- `actionType`, `targetMode`, `target` und `to` sind heute optional, damit Legacy-Actions ohne typed fields weiter funktionieren.

Angedachtes Verhalten:
- ui-action erzeugt eine spezifische Message und diese muss an das Target-Element geschickt werden. 
  - Das kann entwerde in node-red modelliert werden, in dem der output des ui-action Knotens an den passenden z.B. ui-Input geschickt wird. 
  - Alternativ muss das Target über einen eindeutigen Pfad oder seine ID definiert werden. Das ist eventuell notwendig, um dynamisch erzeugte elemente (Liste, oder repeat element) zu bestimmen

Offene Spezifikation:
- `ui-action` soll das zentrale Modell fuer UI-Verhalten werden.
- Alle Veraenderungen am Interaktionszustand oder Verhalten von UI-Elementen sollen ueber `ui-action` beschrieben werden.
- Dazu gehoeren nach heutigem Stand mindestens diese Typen:
  - `navigate`: navigiert zu einer Route oder einer externen URL
  - `disable`: deaktiviert ein UI-Element
  - `enable`: aktiviert ein UI-Element
  - `show`: blendet ein UI-Element ein
  - `hide`: blendet ein UI-Element aus
  - `trigger`: loest ein anderes UI-Element aus, zum Beispiel einen Button oder Link
- Nicht zu `ui-action` gehoeren fachliche Datenupdates. Diese laufen ueber `ui-store`.
- Offen bleibt, wie Ziele adressiert werden: direkte Knotenreferenz, semantische ID, Parent/Child-Relation oder Selektoren.
- Ebenfalls offen bleibt, ob komplexere UI-Actions spaeter als zusammengesetzte Sequenzen modelliert werden.

### `ui-navigation`

**Deprecated**

Zweck:
Repraesentiert im aktuellen MVP eine benannte Navigation zu einer Zielroute. Fachlich ist Navigation jedoch ein Spezialfall von `ui-action`.

Deklarativer Vertrag:
- Pflichtfelder: `id`, `to`

Aktuelles MVP-Verhalten:
- Der Preview-Pfad kann Routenparameter in `to` einsetzen.
- Bei Navigation wird ein `msg.ui`-Ereignis mit Navigationsmetadaten emittiert.

Offene Spezifikation:
- Navigation sollte langfristig nicht als eigenstaendiges Verhaltenskonzept neben `ui-action` bestehen bleiben.
- Sinnvoller ist, `ui-navigation` als MVP-kompatiblen Alias oder Editor-Helfer fuer `ui-action` vom Typ `navigate` zu behandeln.
- Offen ist nur noch, ob dafuer weiterhin ein eigener Komfort-Knoten im Editor sinnvoll ist oder ob der Knoten ganz in `ui-action` aufgeht.

## UI-Events und fachliche Events

### `ui-event`

Zweck:
Beschreibt ausschliesslich Ereignisse, die vom Client zum Backend gemeldet werden.

Typische Beispiele:
- `click`
- gemeldete UI-Statusaenderungen wie Sichtbarkeit, Enabled-State oder aehnliche Zustandswechsel

Regel:
- `ui-events` laufen nur vom Client zum Backend, nie in die andere Richtung.

### Fachliche Events

Zweck:
Beschreibt fachliche Nachrichten ausserhalb der direkten UI-Aktionssemantik.

Anwendung:
- koennen explizit im Client ausgeloest werden
- koennen vom Backend an den Client weitergeleitet werden
- sind sinnvoll, wenn nicht unmittelbar eine `ui-action` ausgefuehrt werden soll, sondern ein fachlicher Event-Handler reagieren soll

Offene Spezifikation:
- Es ist noch offen, ob dafuer ein eigener Knotentyp noetig ist oder ob dies ueber ein allgemeines Event-Handler-Konzept im Client modelliert wird.
- Idee: 
  - Der ui-app Knoten emitted alle diese Events, so dass sie in node-red verarbeitet werden können. 
  - Genauso können messages an den ui-app Knoten gehen, die dann an den/die clients gesendet werden. Hier ist aber unklar, wie diese Events im Client verarbeitet werden.

## Querschnittliche Designluecken

### 1. Verhalten ist noch nicht ausreichend modelliert

Das MVP zeigt erfolgreich, dass Struktur, Rendering und UI-Ereignisse zusammenarbeiten. Die Verhaltensschicht muss aber klar entlang von `ui-action` fuer UI-Verhalten, `ui-store` fuer Zustand und getrennten UI-/fachlichen Events geschnitten werden. Besonders `ui-navigation` sollte in diesem Modell als Spezialfall von `ui-action` verstanden werden.

### 2. Inputs und Tabellen sind semantisch zu flach

`ui-input` und `ui-table` funktionieren fuer das CRUD-Beispiel, tragen aber noch nicht genug Struktur fuer reale Anwendungen. Beide Knoten brauchen wahrscheinlich reichhaltigere Untermodelle oder zusaetzliche spezialisierte Knoten.

### 3. Preview und Produktmodell sind noch enger gekoppelt als gewuenscht

Die Preview-Laufzeit enthaelt beispielspezifische Sonderfaelle fuer den Customer-CRUD-Flow. Das ist als MVP-Hardening legitim, darf aber nicht mit der langfristigen Knotenspezifikation verwechselt werden.

## Empfohlene Naechste Schritte fuer die Spezifikation

1. `ui-action` formal typisieren: mindestens `navigate`, `disable`, `enable`, `show`, `hide`, `trigger`.
2. `ui-navigation` auf einen klaren Platz festlegen: eigener Komfort-Knoten oder Alias fuer `ui-action:navigate`.
3. `ui-store` als alleinigen Pfad fuer Zustandsaenderungen modellieren: set, patch, delete, Output-Semantik.
4. UI-Events und fachliche Events explizit trennen und entscheiden, ob dafuer ein eigener Event-Handler-Knoten oder ein Client-Event-Modell gebraucht wird.
5. Danach die Input-Familie schaerfen: Feldtypen, Labels, Validierung, Bindings und eventuelle Spezialisierungen wie Select oder Checkbox.
6. Anschliessend die Tabellen- und Listenmodelle erweitern: Spaltendefinitionen, Formatierung, Selektion, Pagination.