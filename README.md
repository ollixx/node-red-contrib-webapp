# node-red-contrib-webapp

Declarative Web-App-Bausteine fuer Node-RED. Dieses Repository haelt das MVP als TypeScript-Workspace mit gemeinsamem Schema, Runtime-Registry, Renderer-Snapshots und Editor-Helfern zusammen.

## Schnellstart

1. `corepack pnpm install`
2. `corepack pnpm validate`
3. `corepack pnpm example:customers-crud`

Der dritte Schritt fuehrt die Customer-CRUD-Smoke-Checks fuer Schema, Runtime und Renderer aus. Damit kann ein neuer Beitragender das Beispiel lokal nachvollziehen, ohne zuerst eigene Hilfsskripte schreiben zu muessen.

## Wichtigste Einstiege

- Architekturueberblick: [docs/architecture-overview.md](docs/architecture-overview.md)
- Referenzbeispiel: [examples/customers-crud/README.md](examples/customers-crud/README.md)
- Importierbarer Beispiel-Flow: [examples/customers-crud/flow.json](examples/customers-crud/flow.json)
- Produkt- und Phasenrahmen: [prd.md](prd.md) und [docs/implementation-plan.md](docs/implementation-plan.md)

## Workspace-Struktur

- `packages/schema`: gemeinsame Vertrage, Validierung, Fixtures und Mount-Aufloesung
- `packages/runtime`: Registry-Kompilierung, Node-Set-Assembly und Runtime-API
- `packages/renderer`: Route-, Slot- und Event-Snapshots fuer das MVP
- `packages/editor`: Editor-Knoten und Strukturansicht
- `examples/customers-crud`: die referenzierte CRUD-Beispiel-App fuer P7

## Aktueller MVP-Stand

Das Projekt liefert noch keinen vollstaendigen Browser-Build. Der lokale Ausfuehrungspfad fuer das MVP ist deshalb bewusst testgetrieben: Das Beispiel wird aus dem Flow kompiliert, durch die Runtime exponiert und ueber Renderer-Smoke-Tests entlang des CRUD-Journeys validiert.