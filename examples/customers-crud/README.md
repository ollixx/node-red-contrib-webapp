# Customers CRUD Example

Dieses Beispiel ist der Referenzfall fuer das MVP aus Phase P7. Es zeigt einen durchgaengigen Customer-CRUD-Flow auf Basis der vorhandenen Node-Typen und der Registry-zentrierten Architektur.

## Enthaltene Journey

- Listenroute `/customers` mit Tabellenansicht
- Detailroute `/customers/:id`
- gemeinsamer Dialog `customerEditor` fuer Anlegen und Bearbeiten
- Formular mit State-Binding auf `draft.customer`
- Navigation von Tabelle zu Detail und von Detail zurueck zur Liste
- Delete-Aktion als Navigationspfad zurueck zur Liste

## Wichtige Dateien

- Importierbarer Flow: [flow.json](flow.json)
- Architekturkontext: [../../docs/architecture-overview.md](../../docs/architecture-overview.md)

## Lokal pruefen

1. `corepack pnpm install`
2. `corepack pnpm example:customers-crud`

Der Smoke-Run prueft drei Dinge:

- das Schema akzeptiert den shipped Example-Flow
- die Runtime assembliert und kompiliert daraus ein fehlerfreies App-Modell
- der Renderer laeuft den CRUD-Journey fuer Liste, Dialog, Detail, Edit und Delete durch

## Hinweise zur Nutzung in Node-RED

`flow.json` ist als Referenz fuer die Node-RED-Knotenstruktur gedacht. Die Registry bleibt die Quelle fuer UI-Struktur. Wires koennen fuer Event- und Datenfluss verwendet werden, die Platzierung im UI kommt weiterhin aus `mount`, `route`, `layout` und `dialog`.