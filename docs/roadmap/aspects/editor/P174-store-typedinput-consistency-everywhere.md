---
id: P174
title: "Store-typedInput überall an ADR 0013 §4 angleichen: zweizeiliges Soll-Layout (Name + eingerückter Sub-Pfad) konsistent auf allen 26 Wertfeldern; Live-Abweichung beheben"
epic: aspects/editor
findings:
  - "Owner (2026-06-13, mit Screenshot ui-pagination): 'die Controls für die beiden Felder machen NULL Sinn und haben keine Funktion.' Die Store-Felder wirken einzeilig/gequetscht — also wie die von P134 zu korrigierende P132-Variante, nicht wie das zweizeilige Soll."
  - "Owner (2026-06-13): 'Ich möchte, dass wir das Store Binding überall gleich realisieren wie dokumentiert.'"
acceptance:
  - "Das Store-typedInput rendert das ADR-0013-§4-Soll-Layout (Skizze docs/adr/assets/0013-store-field-states.svg): Zeile 1 = Store-NAME im Wertbereich + native '…'-Expand (öffnet app-scoped Picker); Zeile 2 = ZWEITE, eingerückte typedInput für den Sub-Pfad (storePath-Quellensatz). Kein einzeiliges Quetschen, keine rohe Node-id, kein 'Store ändern'-Button."
  - "Konsistenz: identisches Layout/Verhalten auf ALLEN Wertfeldern, die valueBindingTypes nutzen (26 Node-Editoren) — Stichproben-Beweis an mind. ui-pagination, ui-list, ui-button, ui-text (gleiche zwei Zeilen, gleicher Picker, gleiche Autocomplete)."
  - "Vor Store-Auswahl: nur Zeile 1 mit Soft-Hinweis 'Store über ... auswählen', KEINE Sub-Pfad-Zeile."
  - "Leaf-Form (Sub-Pfad-Quelle = Store) zeigt NUR den Namen, keine verschachtelte Sub-Pfad-Zeile (Ein-Ebenen-Regel ADR 0013 §3)."
  - "Roundtrip: Store + Literal-Sub-Pfad 'c' speichert/lädt unverändert als {kind:store, path, subPath}; msg/JSONata-Sub-Pfad ebenso."
verify: browser
spec: docs/nodes/concepts/editor.md
tests: tests/e2e/nodes/editor/store-binding-subpath.spec.ts
dependencies: []
status: pending
---
# P174 — Store-typedInput überall konsistent (ADR 0013 §4)

> Repariert die **Live-Abweichung** vom dokumentierten Store-Layout. ADR 0013 §4
> (Korrektur 2026-06-11) + die Skizze
> [0013-store-field-states.svg](../../../adr/assets/0013-store-field-states.svg)
> sind der **Soll-Zustand**. P134 sollte das schon liefern; der Owner sieht live
> aber die einzeilige/gequetschte Variante → hier konsistent für **alle** Felder
> sicherstellen. **Reines Editor-Layout** — kein Schema-/Renderer-/Modellwechsel
> (`{kind:"store", path, subPath}` bleibt).

## Worum es geht

Das Store-Control kommt aus **einer** geteilten Stelle — `storeTypedInputType` in
`resources/lib/editor-common.js` — und steckt im kanonischen `valueBindingTypes`-
Satz. Es erscheint damit auf **26 Node-Editoren** (jedes bindbare Wertfeld). Der
Fix ist deshalb **zentral**, nicht 26×.

## Umfang

1. **Soll-Layout verifizieren/erzwingen** im `storeTypedInputType.valueLabel`:
   - Zeile 1: Store-**Name** (resolveStoreName) im Wertbereich; vor Auswahl der
     Soft-Hinweis; das DB-Icon ist das Typ-Icon; die native **„…"**-Expand öffnet
     den app-scoped Picker (P68/P117). **Keine** rohe id, **kein** Button in der
     Zeile.
   - Zeile 2: die **zweite, eingerückte** Sub-Pfad-typedInput (`category:
     "storePath"`), **unter** dem Namen, in der Wertspalte (Feld-Label bleibt in
     Spalte 1). Nur wenn ein Store gewählt **und** nicht `leaf`.
2. **Render-Abweichung finden:** warum wirkt es live einzeilig? (z. B. fehlende
   `flex-direction: column`-Wirkung, Breiten-/Höhen-Clipping der typedInput-
   Wertzelle, CSS-Konflikt, oder ein Pfad, der noch die Alt-P132-Variante zieht).
   Den konkreten Defekt beheben — **kein** paralleler zweiter Code-Pfad.
3. **Konsistenz-Sweep:** sicherstellen, dass jedes Wertfeld dasselbe rendert
   (alle gehen über `valueBindingTypes` → `storeTypedInputType`; kein Knoten baut
   ein abweichendes Store-Control). Abweichler angleichen.

## acceptance / verify

- `verify: browser` — Stichproben an mehreren Knoten (ui-pagination, ui-list,
  ui-button, ui-text) beweisen das identische Zwei-Zeilen-Layout; E2E im
  Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).
- Bestehende `tests/e2e/nodes/editor/store-binding-subpath.spec.ts` erweitern:
  die Zwei-Zeilen-Struktur (Name-Zeile + eingerückte Sub-Pfad-Zeile) explizit
  assertieren, plus Cross-Node-Konsistenz an ≥2 Knoten.

## Risiken / Hinweise

- `resources/lib/editor-common.js` ist die **einzige kanonische Kopie** der
  Editor-Helfer — Fix nur dort.
- **Kein** Modell-/Schema-/Renderer-Wechsel; reine Editor-Darstellung. Falls der
  Defekt doch im Schema/Serialisieren läge, zurückmelden statt Vertrag ändern.
