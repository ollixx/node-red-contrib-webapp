# `ui-navigation`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

**Deprecated.** `ui-navigation` ist ein **Alias für [`ui-action`](ui-action.md)
vom Typ `navigate`**. Navigation ist fachlich ein Spezialfall einer Action und
kein eigenständiges Verhaltenskonzept — der Knoten besteht nur aus
Abwärtskompatibilität für bestehende Flows weiter.

**Für neue Flows: [`ui-action`](ui-action.md) mit `actionType: navigate`
verwenden.** Dort sind die zwei Navigations-Szenarien (verdrahtet mit einer
`ui-route` vs. `to`-typedInput), das `params`-Modell und die Zieladressierung
ausführlich beschrieben.

## Einordnung

- **Parent:** genau eine `ui-app`. Die App ist der Routing-Kontext für die Navigation.
- **Kinder:** keine.
- **Rolle zur Laufzeit:** verhält sich wie eine `ui-action` vom Typ `navigate`.

## Felder

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Navigation N`. |
| `parent` | „App" | Node-Picker-Dialog (Preset Apps) | **ja** | Die Parent-`ui-app`. |
| `to` | „Zielpfad" | Textfeld | **ja** | Der Ziel-Routenpfad (entspricht `to` einer `navigate`-Action). |

## Input / Output

Format und Verhalten identisch mit [`ui-action`](ui-action.md) vom Typ
`navigate`. Nicht erkannte / fachfremde Messages werden **unverändert
durchgereicht** (Pass-Through), Framework-Fehler gemäß
[logs-errors.md](../concepts/logs-errors.md) gemeldet.

## Referenzen

- [`ui-action`](ui-action.md) — der kanonische Knoten (Typ `navigate`)
- [actions.md](../concepts/actions.md) — Navigation als Action
- [messages.md](../concepts/messages.md) — Navigations-Format

## Offene Punkte

- Offen ist nur noch, ob langfristig ein eigener Komfort-Knoten im Editor sinnvoll
  bleibt oder ob `ui-navigation` ganz in `ui-action` aufgeht.
