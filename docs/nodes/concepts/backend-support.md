# Backend-Fähigkeiten & nicht nativ unterstützte Felder

> **Anforderungs-Dokument.** Beschreibt den *gewünschten* Vertrag, nicht den
> aktuellen Implementierungsstand. Teile sind heute noch **nicht implementiert**
> und unten als solche markiert.

Dieses Konzept gilt für **alle** Webapp-Knoten. Es beschreibt **einmal**, wie ein
Feld behandelt wird, das das aktive Render-Backend **nicht nativ** unterstützt.
Node-Docs **referenzieren** dieses Konzept, statt das Verhalten pro Knoten neu zu
beschreiben — so bleibt es konsistent und redundanzfrei.

> **Kontext.** Heute gibt es **genau einen** Adapter: Shoelace. Es gibt kein
> `backend`-Konfigurationsfeld (siehe [theming.md](theming.md)). „Aktives Backend"
> meint also derzeit immer Shoelace. Das Modell ist aber bewusst backend-neutral
> formuliert, damit weitere Adapter (Bootstrap/Material/…) möglich bleiben — und
> genau deshalb ist das Verhalten *hier* zentral definiert, nicht in den Knoten.

---

## 0. Achsen: Adapter ≠ Theme

Vier **orthogonale** Achsen werden oft mit „Theme" verwechselt. Sie sind getrennt:

| Achse | Was variiert | Beispiel | Heute |
|---|---|---|---|
| **Adapter / Backend** | das GUI-**Framework**: Markup, Komponenten, native Fähigkeiten, optische Framework-Eigenheiten | Shoelace ↔ Bootstrap ↔ Material | nur Shoelace |
| **Theme** | Design-**Tokens**: Farbe, Typografie, Radii | violett/serif vs. blau/sans | `tokens` am `ui-app` |
| **Variant** | semantische Farbrolle | `danger`, `success` | implementiert |
| **DisplayType** | Form | `pill`, `square` | implementiert |

- **„Theme" ist eng:** nur Tokens (Farbe/Typografie/Radii), siehe [theming.md](theming.md).
  Ein Framework-Wechsel ist **kein** Theme.
- **Adapter ist die Framework-Achse.** *Dieses* Dokument beschreibt deren
  **Capability**-Facette (welches Feld ein Backend nativ kann). Tokens sind
  adapter-neutral gedacht (ein `radiusMd` gilt in jedem Adapter).
- Das künftige `ui-app`-Konfigurationsfeld für die Backend-Wahl heißt folglich
  **`adapter`/`backend`**, nicht `theme` (heute n/a — nur Shoelace).

---

## 1. Fähigkeits-Modell (Capability)

Jedes komponentennahe Feld ist entweder vom aktiven Backend **nativ unterstützt**
oder **nicht**. „Nativ unterstützt" heißt: der Adapter bildet das Feld auf ein
echtes Attribut/Verhalten der Backend-Komponente ab (z. B. Shoelace `pill`,
`pulse`). „Nicht nativ" heißt: die Backend-Komponente kennt das Feld nicht.

**Single source of truth.** Welche Felder ein Backend nativ kann, wird **aus dem
Contract/Schema** abgeleitet — analog zum Variant-Vokabular, das die Editor-
SelectBox aus `COMPONENT_VARIANT_VOCABULARY` speist (siehe [editor.md](editor.md)).
Die Fähigkeits-Tabelle ist **nie** im Editor oder pro Knoten hartcodiert.

> **Noch nicht implementiert:** eine deklarative Capability-Map
> (`SUPPORT_BY_BACKEND[field]` o. ä.) im `packages/schema`-Contract. Bis dahin ist
> die Liste der „nicht nativ von Shoelace unterstützten" Felder die unten in §2
> genannte. Eine Umsetzung muss zuerst diese Map einführen.

---

## 2. Laufzeit-Regel: nicht droppen, sondern als `data-*` emittieren

Ein nicht nativ unterstütztes Feld wird **nicht verworfen**. Der Adapter emittiert
es als `data-<feld>`-Attribut auf dem gerenderten Element, damit es per CSS
gestaltbar bleibt und ein künftiger Adapter es nativ aufgreifen kann.

| Feld | Native Unterstützung (Shoelace) | Emission ohne native Unterstützung |
|---|---|---|
| `size` (`sm`/`md`/`lg`) | nein (z. B. `sl-badge`, `sl-avatar`) | `data-size="<wert>"` (CSS-Targeting) |
| `variant` | je Komponente unterschiedlich (z. B. `sl-avatar`: nein) | `data-variant="<wert>"` |
| `displayType` = `square` (badge) | nein | `data-display-type="square"` |
| `pulsating` | `sl-badge`: ja (`pulse`); andere: ggf. nein | CSS-Animations-Fallback |

> Die Tabelle nennt die **heute** bekannten Fälle. Sie ist die provisorische
> Capability-Liste, bis §1 schemagetrieben ist. Neue Felder dieser Art werden
> **hier** ergänzt, nicht in der jeweiligen Node-Doc.

**Konsequenz für Tests:** Eine Render-Garantie für ein „nicht nativ"-Feld prüft
das beobachtbare Ergebnis (das `data-*`-Attribut **und** der davon abhängige
sichtbare CSS-Effekt), nicht bloße DOM-Präsenz. Mit einem Backend, das das Feld
nativ kann, prüft der Test stattdessen den nativen Effekt (vgl.
[node-testing.md](../../../.ai/agents/node-testing.md)).

---

## 3. Editor-Regel: Trennlinie + standardisierte Warnung

Ist ein Feld vom aktiven Backend **nicht nativ** unterstützt, stellt das Property-
Panel es **unterhalb einer Trennlinie** dar, getrennt von den voll unterstützten
Feldern, mit einer **standardisierten Warnung**, die das aktive Backend benennt —
z. B.:

> ⚠️ *„Size" wird vom aktiven Backend (Shoelace) nicht nativ unterstützt. Der Wert
> wird als `data-size` emittiert und kann per CSS/Theme gestaltet werden.*

**Regeln:**
- **Genau eine** Informationsquelle: die Warnung ersetzt etwaige per-Feld-Info-
  Marker. Ein zusätzliches einzelnes „i"-Icon hinter dem Feld ist **falsch** und
  entfällt, sobald die Warnung erscheint.
- Das Feld bleibt **bedienbar** (es ist ja funktional, §2) — es wird nicht
  deaktiviert, nur unter die Trennlinie verschoben und annotiert.
- **Gemeinsamer Helfer, keine Duplikate.** Umgesetzt über **einen** Helfer in
  `resources/lib/editor-common.js` (kanonische Editor-Helfer-Datei, siehe
  [editor.md](editor.md)) — z. B. `installBackendSupportNotice({ fields })`. Kein
  Knoten implementiert die Trennlinie/Warnung selbst.

> **Noch nicht implementiert:** der gemeinsame Helfer und die schemagetriebene
> Auswahl, welche Felder unter die Linie wandern. Erste Umsetzung führt den Helfer
> ein und stellt zugleich `ui-badge`/`ui-avatar` darauf um.

---

## 4. Referenzierungs-Regel

Eine Node-Doc, die ein backend-bedingtes Feld trägt (`size`, `variant`,
`pulsating`, `displayType=square`, …), **verlinkt dieses Konzept** an der
betreffenden Feldzeile, statt Trennlinie/Warnung/`data-*`-Emission selbst
auszuformulieren. Beispiel: „Backend-Verhalten: siehe
[backend-support.md](../concepts/backend-support.md)."

---

## Siehe auch

- [theming.md](theming.md) — Variant-Vokabular, `variant` vs. `displayType`, „nur Shoelace heute"
- [editor.md](editor.md) — gemeinsame Editor-Helfer, schemagetriebene SelectBoxen
- [node-testing.md](../../../.ai/agents/node-testing.md) — Render-Garantie für size/variant pro Backend

## Offene Punkte

- Schemagetriebene Capability-Map (§1) — Ort und Form im Contract.
- Verhalten, wenn *mehrere* Backends existieren und der Anwender eines wählt
  (heute n/a — nur Shoelace).
