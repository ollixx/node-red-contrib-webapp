---
id: P257
node: ui-action
title: "ui-action `select`-Verb implementieren — cross-node Item-Aktivierung (tabs/stepper/menu/table)"
epic: aspects/node-conformance
status: done
dependencies: []
verify: browser
spec: docs/nodes/behavior/ui-action.md
tests: tests/e2e/nodes/behavior/ui-action.tests.md
---
# P257 — ui-action `select`-Verb real machen

> Ausgekoppelt aus **P256** (2026-07-20). Der Konformitäts-Pass maß `select` als
> **inert** und der Owner entschied **implementieren** (statt aus dem `actionType`-
> Enum entfernen). Weil echtes `select` mehrere Knoten mit je eigener Aktivierungs-
> Semantik + Serializer-Hooks berührt, ist es ein eigenes Feature-Paket, kein
> „leichter" Rest.

## findings (gemessen in P256)

- Das `select`-Command **wird gepusht**, aber der Client löst den `part` via
  `[name="<part>"]` auf — das trifft bei ui-tabs den **`sl-tab-panel[name]`-Body**,
  **nicht** das aktivierende **`sl-tab[slot="nav"][panel="<id>"]`-Nav-Element**
  (bestätigt in `webapp-serializer.js`: tabs rendern `sl-tab slot="nav" panel="<id>"`
  **+** `sl-tab-panel name="<id>"`). Ein Klick/Aktivieren des Panel-Bodys wechselt
  den aktiven Tab nie ⇒ `select` ist wirkungslos.
- Anders als ui-accordion (dessen `sl-details` einen `data-webapp-part`-Hook tragen,
  P247) exponieren **tab/stepper/menu/table-Items keinen auflösbaren Aktivierungs-
  Hook**. Das ist die Lücke.
- Der P256-Test `select(part) → der Ziel-Tab wird aktiv` liegt als lauffähiger
  `test.fixme` in `tests/e2e/nodes/behavior/p256-verbs-focus-reset-select.spec.ts`
  vor — Ausgangspunkt.

## acceptance

- **Aktivierungs-Hook je aktivierbarem Knoten.** Der Serializer emittiert auf dem
  **aktivierenden** Element (nicht dem Inhalt) einen auflösbaren Part-Hook
  (Muster: ui-accordions `data-webapp-part`, P247):
  - **ui-tabs** → auf `sl-tab[slot="nav"]` (das Nav-Tab, nicht das Panel).
  - **ui-stepper** → auf dem Step-Button.
  - **ui-menu** → auf dem Menü-Item.
  - **ui-table** → auf der Zeile (Row-Select-Semantik; ggf. Abgleich mit dem
    bestehenden `rowSelect`-Pfad — kein Doppel-Mechanismus).
- **Client-`select` aktiviert das per `part` benannte Item** am richtigen Element
  (nicht am Body). Für jeden Knotentyp die native Aktivierung auslösen (Tab
  aktiv-setzen, Step aktivieren, Menü-Item markieren, Zeile selektieren).
- **Beobachtbar gemessen (Browser)** je Knoten: `ui-action(select, target=<node>,
  part=<id>)` → das benannte Item ist **aktiv** (gemessener DOM-Zustand: `active`-
  Attribut / aktive Klasse / Selektion), abgrenzbar vom Vorzustand
  ([[verify-rendering-by-measurement-not-tags]]). Der P256-`fixme` wird zu grün.
- **Kein Regress** an den soliden Item-/Event-Pfaden (tabs tabChange, stepper change,
  menu navigate, table rowSelect) — die bestehenden E2E bleiben grün.
- **Spec** `docs/nodes/behavior/ui-action.md`: `select` mit beobachtbarer Wirkung je
  Ziel-Typ dokumentiert; Katalog `ui-action.tests.md` gespiegelt.
- **E2E grün** (Haupt-Checkout); Tripwires + `pnpm validate` grün.

## verify

`browser` — je Knotentyp die Aktivierung per gemessenem DOM-Zustand belegt; der
Serializer-Hook sitzt auf dem aktivierenden Element; keine Regression der
bestehenden Item-Event-Tests.

## spec

`docs/nodes/behavior/ui-action.md` — `select`-Verb: pro aktivierbarem Ziel-Typ die
Aktivierungs-Semantik + beobachtbare Wirkung.

## tests

`tests/e2e/nodes/behavior/p256-verbs-focus-reset-select.spec.ts` (den `select`-
`fixme` zu einem echten Test je Knotentyp ausbauen) + `ui-action.tests.md`.

## notes for the implementer

- **Präzedenz ist ui-accordions `data-webapp-part`** (P247) — nicht neu erfinden.
- **ui-table:** prüfen, ob `select` den bestehenden `rowSelect`-Pfad
  (`webapp.js:2647`) nutzen soll statt eines zweiten Mechanismus.
- Umfang groß genug für inkrementelle Commits (ein Knotentyp pro Commit) —
  Ausfallsicherheit.

## Result

**Done 2026-07-21.** Das `select`-Verb aktiviert jetzt real ein Item über **alle vier**
Knotentypen — Serializer-Hook am aktivierenden Element (nicht am Inhalt), Client-
Aktivierung per `findActivationElement`, idempotent (Re-Stamp nach jedem Snapshot
feuert keine Events erneut).

### Je Knotentyp (gemessen, grün)

- **ui-tabs** — Hook auf `sl-tab[slot="nav"]` (`data-webapp-part=<tab id>`); Client
  klickt das Nav-Tab → Shoelace schaltet das Panel. Ziel-`sl-tab` bekommt `active`,
  das vorherige verliert es.
- **ui-stepper** — Hook auf dem Step-Button; unbound `activeStep` round-trippt nicht,
  daher client-seitig `webapp-step--active` single-active markiert (kein Klick).
- **ui-menu** — Hook auf `sl-menu-item`; `data-webapp-active="true"` + `aria-current`
  single-active, ohne zu navigieren.
- **ui-table** — Hook auf der selektierbaren `<tr>`; **Entscheidung: bestehenden
  `rowSelect`-Pfad wiederverwenden** (kein zweiter Mechanismus). Client-`select`
  klickt den rowSelect-Link → feuert das dokumentierte Event (via `interceptNextEvent`
  gemessen: `event:"rowSelect"`, `params.rowId:"r2"`), event-only (kein Overlay-Record,
  sonst Re-Fire bei jedem Render).

Alle vier implementiert, nichts zurückgestellt. Der P256-`select`-`fixme` ist zu
echten Tests je Knotentyp gewachsen (nur `reset` bleibt `fixme` → P258).

### Nebenfund + gefixt: ui-tabs E01 deterministisch gemacht

Der autoritative Voll-Lauf war zunächst **819/1**: `ui-tabs.spec.ts:226` E01 (30 s
Timeout). Ursache: P257s **single-active Re-Stamp** aktiviert den Default-Tab vor
Shoelaces Upgrade und **unterdrückt** dessen Upgrade-`sl-tab-show`-Auto-Emit, auf den
E01s fragiler `defaultTabEvent`-Drain wartete → kippte E01 von „flakt unter Last"
(P170/P239) in „flakt isoliert" (~50 %). Das Feature war intakt (E01 grün in 70 ms,
wenn es nicht rennt). Fix (Commit `d948921`): E01 wartet per Prädikat auf **sein
eigenes** `details`-Change-Event statt auf den Shoelace-eigenen Upgrade-Emit (nicht
der Vertrag dieses Knotens; D01 deckt Default-Aktiv). **Isoliert 4/4 grün, ~2,6 s;**
löst die wiederkehrende E01-Flake (`task_c1239d9c`).

### Verifikation (Haupt-Checkout, autoritativ)

**E2E 820 passed, 0 failed, `--retries=0`, 15,2 min** — der erste **voll grüne**
Voll-Lauf ohne E01-Retry/Flake. Serializer+Client geändert → Voll-Suite. `pnpm build`
+ `pnpm validate` + alle Tripwires grün. Agent committete inkrementell (2 Commits)
VOR der Verifikation, stoppte alle Prozesse (Port 1882 frei), Haupt-Checkout unberührt.
Spec `ui-action.md` + Katalog spiegeln die per-Ziel-Aktivierungssemantik + die
ui-table-Entscheidung.
