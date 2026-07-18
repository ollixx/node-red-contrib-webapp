# Testkatalog: ui-skeleton

> Format gemäß `.ai/agents/node-testing.md`. Frisch neu geschrieben in **P241**
> (Konformitäts-Pass): der Knoten renderte zuvor NICHTS, der einzige Alt-Test prüfte
> nur, dass ein Geschwister-Knoten noch rendert — dieser Notnagel ist ersetzt. Alle
> Tests beweisen ihre Aussage **per Messung am echten DOM** (Bounding-Box / computed
> style), nicht per Tag/Klasse ([[verify-rendering-by-measurement-not-tags]]).

## Unit (`packages/runtime/test/p241-skeleton-render-pipeline.test.ts`)

- **Adapter:** `skeleton` → `sl-skeleton` (kein `data-wa-fallback` mehr).
- **`toComponentDefinitions`:** `ui-skeleton` → kind `skeleton`; `color`-Binding →
  `bind.color`; `visible`-Binding → `visibleIf`; `displayType`/`lines` in props;
  Plain-String-`color` bleibt in props (nur Binding-Objekte gehen an `bind.color`).
- **Serializer-Komposition:** `text` → `lines` `.webapp-skeleton-line`; `lines=1`→1;
  fehlend/`0`/negativ → Default 3 (Serializer als letzte Verteidigung); `avatar` →
  rund (`--border-radius:50%`, Breite=Höhe); `card` → Medien-Block + Zeilen in
  umrandeter Box; `table` → `lines` Zeilen × 3 Spalten; `color` → `sl-skeleton
  --color` (CSS-Wert + semantischer Token); `effect="pulse"`.

## E2E (`tests/e2e/nodes/view/ui-skeleton.spec.ts`)

- **Sichtbares Chrome:** ein `visible`-Skeleton erzeugt eigenes Chrome —
  Bounding-Box-Höhe **> 0** (gemessen; war zuvor leer).
- **displayType unterscheidbar (gemessen):**
  - `text` → `lines=5` ergibt **5** Zeilen-Boxen, Bounding-Boxen mit **aufsteigendem
    y** (vertikal gestapelt); `lines=1` → **1** Box.
  - `avatar` → Breite ≈ Höhe (|Δ| ≤ 2 px), Indikator-`border-radius` ≥ 50 % der
    halben Box (computed style im Shadow-DOM).
  - `card` → Bounding-Box **höher UND breiter** als eine einzelne Text-Zeile
    (gemessen gegen ein parallel gerendertes `text`-Skeleton mit `lines=1`).
  - `table` → **4** `.webapp-skeleton-row`, je **3** `.webapp-skeleton-cell` mit
    **aufsteigendem x**; kein `.webapp-skeleton--text` vorhanden (unterscheidbar).
- **`visible` Render-Gate:** Store=`false` ⇒ kein Chrome im gelieferten HTML;
  Store=`true` ⇒ Chrome vorhanden. **Live:** ein Inject kippt den gebundenen Store
  `false→true`, das Skeleton erscheint per **SSE-Re-Render** (gemessen, Höhe > 0).
- **Base-Field `color`:** gelieferte Markup trägt `--color:rgb(255, 0, 0)`; der
  **Shadow-Indikator** hat computed `background-color` = `rgb(255, 0, 0)` (die Farbe
  wirkt wirklich auf dem Chrome, dank `effect="pulse"`).
- **`lines`-Validierung (Editor):** `lines=0` ⇒ nach *Done* meldet Node-RED den
  Knoten **invalid** (Deploy blockiert); ein positiver Wert macht ihn wieder valid.
  Real im Editor getrieben (nicht Schema-seitig geprüft).
- **Ports:** genau **1 Input** (`componentStateInputHandler` — `msg.ui.component.op`),
  **0 Outputs**.
