---
id: P118
node: ui-action
epic: nodes/ui-action
title: "ui-action/ui-navigation: explizite Zielquelle (wire | route | url) im Schema + Laufzeit-Adressierungs-Vorrang (Route kapert keine adressierte Navigation)"
findings:
  - "Jetzt verstehe ich gerade nicht, wie das funktionieren soll. Da wird ja für eine Action ein Wert für einen Page Parameter eingegeben. Das macht doch gar keinen Sinn. (Anm.: Richtung der params-Sektion unverständlich)"
  - "Die 3 Wege das zu konfigurieren sind nicht einfach. Und sie sind so auch nicht korrekt umgesetzt. Ich frage mich, ob man da so viel Flexibilität braucht."
  - "Wir haben immer noch die Prämisse node-red first, also wiring muss immer auch ein Weg sein."
  - "Wir brauchen da ein Modus-Konzept, das eine Doppel-Konfig technisch ausschließt. Wenn der User dann eine unsinnige Verdrahtung baut, dann ist das seine Verantwortung."
  - "Was passiert, wenn er verdrahtet hat und zusätzlich eine andere ui-route auswählt? (Anm.: Konfliktfall muss wohldefiniert sein)"
verify: browser
spec: docs/nodes/behavior/ui-action.md
tests: tests/e2e/nodes/behavior/ui-action.tests.md
dependencies: []
status: in_progress
---
# P118 — Navigate-Zielquelle: Schema + Laufzeit

> Entscheidung & Begründung: [ADR 0011](../../../adr/0011-ui-action-navigation-target-modes-and-dual-path-coding.md).
> Dieses Paket liefert die **Unterbau-Semantik** (Schema, Runtime, Migration).
> Die Editor-UI (Modus-Umschalter, Wire-Scan, Mapping-Tabelle, Badges) ist
> **P119** — hier nur so viel Editor-Anpassung, dass Bestands-Panels nicht
> brechen.

## Zielmodell

### 1. Schema (`packages/schema`)

`ui-action`- und `ui-navigation`-Definitionen erhalten für `navigate`:

- `targetMode`: `"wire" | "route" | "url"` — die gespeicherte Absicht.
- `routeId`: Referenz auf eine `ui-route` (nur Modus `route`; bei
  `ui-navigation` existiert das Feld bereits — Semantik vereinheitlichen).
- `params`: statt JSON-Objekt `{k: "literal"}` eine **Liste typisierter
  Einträge** `[{ name, value, valueType }]` mit `valueType` ∈
  `str | msg | jsonata | flow | global | env`.
- `to`/`toType`: unverändert (nur Modus `url`).
- **Modus schließt Doppel-Konfig technisch aus:** das Schema erlaubt pro
  Modus nur die zugehörigen Felder als gesetzt (route ⇒ `routeId`, kein `to`;
  url ⇒ `to`, kein `routeId`; wire ⇒ weder noch); Verstöße sind
  Validierungsfehler beim Compile.

### 2. Migration (Lade-Shim, Muster `withUiIdMigration`)

Bestands-Configs ohne `targetMode`: `to` gesetzt → `url`; sonst → `wire`.
Legacy-`params`-Objekt → Liste mit `valueType: "str"`. Verlustfrei, im Result
dokumentieren.

### 3. Laufzeit (`nodes/webapp.js`, `packages/runtime`)

- **Modus `route`:** `ui-action` löst `routeId` app-global zur Routen-`path`
  auf, evaluiert die `params`-Werte **zur Action-Zeit gegen die auslösende
  msg** (`RED.util.evaluateNodeProperty` bzw. JSONata-Auswertung — die
  Mechanik, die auch `toType` nutzt), baut die Location und reichert
  `msg.ui.action` mit dem expliziten Ziel an.
- **Modus `url`:** wie heute (`to` typedInput), `params`-Sektion entfällt —
  eine gebaute URL trägt ihre Werte selbst.
- **Modus `wire`:** kein explizites Ziel in der msg; die empfangende
  `ui-route` baut die Location aus ihrem eigenen `path` (heutiges Verhalten).
- **Adressierungs-Vorrang (ADR 0011 §3) in `ui-route`:** Trägt eine
  eingehende navigate-msg bereits ein explizites Ziel (aus Modus
  `route`/`url` oder `msg.ui.action.to`-Override), behandelt die Route sie
  als **adressierte Navigation und reicht sie unverändert durch** — sie setzt
  NICHT ihren eigenen Pfad darauf. Nur zielloses navigate löst das heutige
  „Route baut Location"-Verhalten aus.
- **Alte Mehrdeutigkeits-Validierung entfernen:** die Regel „verdrahtet +
  `to` = Deploy-Fehler" (Spec P66) entfällt ersatzlos — der Modus macht sie
  gegenstandslos. Unsinnige Verdrahtung ist per Owner-Entscheid
  Nutzer-Verantwortung; es gibt KEINE scan-basierte Laufzeit-/Deploy-Prüfung.
- `msg.ui.action.to` / `.params` bleiben als Laufzeit-Overrides erhalten
  (ADR 0007, anreichern statt ersetzen).

## acceptance (observierbar; unit + browser via E2E-Fixture)

- **Modus route:** Action (Modus `route`, `routeId` → `/customers/:id`,
  params `id` = msg `payload.id`) erhält msg `{payload:{id:"42"}}` →
  Browser navigiert auf `/customers/42`; `routeParam`-Bindings der Zielroute
  zeigen `42`.
- **Vorrang:** dieselbe Action zusätzlich über eine ANDERE `ui-route`
  (`/other`) verdrahtet → Navigation geht weiterhin auf `/customers/42`;
  `/other` wird nicht aktiviert (Route reicht adressierte Navigation durch).
- **Modus wire:** Action (Modus `wire`) → switch → zwei Routen verdrahtet:
  je nach switch-Pfad landet der Client auf der Route, die die msg empfängt —
  beide Zweige per E2E belegt; kein Deploy-Fehler trotz Verzweigung.
- **Modus url:** `toType: jsonata`, Ausdruck baut `/customers/42` aus der msg
  → Browser navigiert entsprechend; eine konfigurierte `params`-Liste wird im
  url-Modus ignoriert/nicht serialisiert.
- **Doppel-Konfig ausgeschlossen (unit):** Config mit `targetMode:"route"` UND
  gesetztem `to` wird vom Schema abgelehnt; analog die anderen Kombinationen.
- **Migration (unit):** Legacy-Config (`to` gesetzt, params-Objekt) lädt als
  `url`-Modus mit str-typisierten params; Legacy ohne `to` als `wire`.
- **Typisierte params (unit):** `valueType: jsonata`-Wert wird gegen die
  auslösende msg ausgewertet; `flow`/`global`/`env` gegen den Kontext.

## spec / tests — Pflichten

- `docs/nodes/behavior/ui-action.md`: Felder-Tabelle der Gruppe „Navigation"
  vollständig neu (targetMode, routeId, typisierte params, Modus-Exklusivität,
  Migration); die P66-Mehrdeutigkeitsregel streichen.
- `docs/nodes/behavior/ui-navigation.md`: auf dasselbe Zielmodell heben.
- `docs/nodes/structure/ui-route.md` + `docs/nodes/concepts/messages.md`:
  Adressierungs-Vorrang (Durchreichen adressierter Navigationen) ergänzen.
- Testkataloge `tests/e2e/nodes/behavior/ui-action.tests.md` (und der
  ui-navigation-Katalog) um die obigen Fälle erweitern.
