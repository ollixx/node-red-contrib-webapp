# Komposition — die Naht-Verträge der Container-Knoten

> **Querschnitts-Konzept.** Dieses Dokument hält die **Naht-Verträge** fest, die
> jeder *kind-tragende* Knoten (Container-Art) einhält. Es beschreibt den
> *gewünschten* Vertrag (wie jede Node-Spec), nicht den Implementierungsstand —
> die ausführbare Seite lebt in den Properties (siehe unten) und den ADRs.

## Warum ein eigenes Dokument

Das System ist ein **Baum beliebig tief verschachtelter Knoten** — Container,
`ui-repeat`, Tabs, Accordions, Component-Instanzen tragen Kinder; Blätter (Text,
Buttons, Inputs …) tragen Werte. Die naive Test-/Vertrags-Frage „funktioniert
*jede* Kombination aus Knoten × Container × Tiefe × Binding × Layout?" ist ein
unendliches Kreuzprodukt.

[ADR 0024](../../adr/0024-compositional-testing-seam-invariants-property-based.md)
beantwortet sie **induktiv**: Wenn **jeder** kind-tragende Knoten seinen
Naht-Vertrag einhält, dann funktioniert **jede** Verschachtelung *per Induktion* —
ohne die Verschachtelungen aufzuzählen. Die Verträge sind hier zentral
dokumentiert, statt in jeder Container-Spec wiederholt zu werden.

## Die kind-tragenden Knoten (Container-Arten)

Über diese Knoten-Arten sind die Verträge **parametrisiert** (O(N), nicht O(Nᵏ)):

- [`ui-container`](../display/ui-container.md) — generischer Layout-Container.
- [`ui-repeat`](../display/ui-repeat.md) — Template-Container mit Render-Zeit-Scope
  (`item`/`index`), [ADR 0017](../../adr/0017-ui-repeat-template-container-render-time-scope.md).
- [`ui-tabs`](../navigation/ui-tabs.md) / [`ui-tab`](../navigation/ui-tab.md) —
  Tab-Container und seine Tab-Slots.
- [`ui-accordion`](../navigation/ui-accordion.md) /
  [`ui-accordion-section`](../navigation/ui-accordion-section.md) — Accordion-Container
  und seine Abschnitte.
- [`ui-component-definition` / `ui-component-instance`](../structure/ui-component.md) —
  parametrierte, wiederverwendbare Subbäume mit `prop`-Scope,
  [ADR 0020](../../adr/0020-component-model-dedicated-ui-component-node.md).
- Die struktur-tragenden [`ui-route`](../structure/ui-route.md) /
  [`ui-dialog`](../structure/ui-dialog.md) / [`ui-app`](../structure/ui-app.md) —
  oberste Slots des Baums.

## Die vier Naht-Invarianten

Jeder kind-tragende Knoten hält **alle vier** Verträge an seiner Naht (= der
Übergabe an seine Kinder) ein:

### 1. Scope propagiert durch jeden kind-tragenden Knoten

Ein Render-Zeit-Scope (`item`/`index` aus `ui-repeat`, `prop` aus einer
Component-Definition) **propagiert transitiv durch jeden zwischenliegenden
Container** zu seinen Blättern. Ein scope-gebundenes Kind löst seinen Scope auch
dann auf, wenn zwischen ihm und dem Scope-Erzeuger beliebig viele neutrale
Container (z. B. `ui-container`/`ui-tabs`) liegen — es kommt **nie** zum
Scope-Verlust-Marker `"?"`. (Das ist die P192-Eigenschaft, als Gesetz.) Hintergrund
zu den scope-lokalen Binding-Arten:
[stores.md → Scope-lokale Binding-Arten](stores.md#scope-lokale-binding-arten-p182-adr-0017--adr-0020).

### 2. Mount löst eindeutig auf

Jeder gemountete Knoten besetzt **genau eine** Region. Ein Mount-Pfad
(`<type>:<id>/<slot>`, siehe [layout.md](layout.md)) löst zu **genau einer** Slot-
Region auf — **kein Waise** (unaufgelöster Mount) und **keine Kollision** (zwei
Knoten in derselben Region durch denselben Pfad). Unbekannte Scopes/Slots werden
abgelehnt.

### 3. Per-Instanz-Re-Id ist eindeutig

Wo ein Container seinen Subbaum **pro Instanz vervielfältigt** (`ui-repeat` pro
Item, `ui-component-instance` pro Expansion), werden die geklonten Knoten-Ids
**eindeutig re-id't** — Schema `<itemKey>#<childId>` bzw.
`<instanceId>#<innerNodeId>`. Über den gesamten gerenderten Baum sind die
`data-webapp-node`-Ids damit **kollisionsfrei**, egal wie tief oder wie oft
verschachtelt wird.

### 4. Slot-Layout gilt

Das Layout-Preset des Container-Slots bestimmt, **welche** Platzierungs-Felder der
direkten Kinder gelten (`order` bei `vertical`/`horizontal`; `row`/`col`/`colSize`/
`rowSize` bei `grid`; `layoutX`/`layoutY` bei `absolute`). Das Preset des Slots —
nicht der Knotentyp des Kindes — entscheidet die Anordnung. Details:
[layout.md](layout.md).

## Ausführbare Seite (Properties)

Die Invarianten sind nicht nur Prosa — sie sind am **reinen Renderer**
(`AppModel → snapshot`) als property-based Tests kodiert (P194,
[ADR 0024 §2](../../adr/0024-compositional-testing-seam-invariants-property-based.md)):

- [`packages/renderer/test/p194-invariants.property.test.ts`](../../../packages/renderer/test/p194-invariants.property.test.ts)
  — Totalität, Determinismus/Idempotenz, **Scope-Auflösung** (Invariante 1),
  **Id-Eindeutigkeit** (Invariante 3), **Mount-Eindeutigkeit** (Invariante 2) und
  die **Wrap-Invarianz** (Verschachteln in pass-through `ui-container` ändert die
  Per-Item-Auflösung nicht — das P192-Gesetz).
- [`packages/renderer/test/p192-repeat-scope-through-containers.test.ts`](../../../packages/renderer/test/p192-repeat-scope-through-containers.test.ts)
  — Scope durch verschachtelte Container, parametrisiert über die Container-Arten.

Diese Properties **ergänzen** (ersetzen nicht) die per-Knoten-Verträge (die
Feld-Tabellen der Specs, gegen den Code abgesichert durch `pnpm check:specs`) und
das Zod-Schema (Datenform).

## Referenzen

- [ADR 0024](../../adr/0024-compositional-testing-seam-invariants-property-based.md) — Naht-Invarianten, property-based + metamorphisches Testen.
- [ADR 0017](../../adr/0017-ui-repeat-template-container-render-time-scope.md) — `ui-repeat` Render-Zeit-Scope (`item`/`index`).
- [ADR 0020](../../adr/0020-component-model-dedicated-ui-component-node.md) — Component-Modell (`prop`-Scope, Re-Id, Expansion).
- [layout.md](layout.md) — Presets, Slots, Mount-Grammatik, Child-Platzierung.
- [stores.md](stores.md) — Binding-Arten inkl. der scope-lokalen.
