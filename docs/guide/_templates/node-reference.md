# Template: node reference (`docs/guide/nodes/<node>.md`)

> For authors (P265, ADR 0042). Copy the skeleton below for
> `docs/guide/nodes/<node>.md` (EN) and translate it 1:1 for
> `docs/guide/de/nodes/<node>.md` — **always both in the same change**.
> Facts come from the checked contract doc (`docs/nodes/<cat>/<node>.md`) and
> the conformance results (P230–P258); the guide must never contradict them.
> Write at **user level**: what to pick when — not schema notation.

## Skeleton (EN)

```markdown
# ui-<node>

One-sentence purpose.

## Purpose

2–4 sentences: what the node renders/does and where it fits.

## When to use

Bullet list of concrete situations (and, if helpful, when NOT to use it /
which node to use instead).

## Fields

One subsection or table row per field — EVERY field, including the base
fields. For each: what it does, its variants/options and what to pick when,
the default, and whether it is bindable (and to what).

| Field | What it does | Values / variants | Default |
|---|---|---|---|

## Inputs

MANDATORY — the node's msg behaviour, even (especially) when it is "none":
input port yes/no; what `msg.payload` does; `msg.ui.*` ops if supported;
pass-through behaviour.

## Outputs / Events

Which events the node emits, their `msg.ui` shape, and when they fire —
or "none".

## Examples

1–3 importable examples. For each:
1. What it shows (one sentence).
2. The flow file: `examples/guide/<node>[-variant].json`.
3. Import instructions: Node-RED menu → Import → select the file's JSON
   (or paste its content) → Import → Deploy → open the app.

## Related

Links to related guide pages and node references.
```

---

## Skelett (DE — für `docs/guide/de/nodes/<node>.md`)

```markdown
# ui-<node>

Zweck in einem Satz.

## Zweck

2–4 Sätze: was der Knoten rendert/tut und wo er hingehört.

## Wann einsetzen

Konkrete Situationen als Liste (und ggf. wann NICHT / welcher Knoten
stattdessen).

## Felder

Ein Abschnitt oder eine Tabellenzeile je Feld — JEDES Feld, inklusive der
Basis-Felder: was es tut, Varianten/Optionen und wann man was wählt, Default,
Bindbarkeit.

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|

## Eingang

PFLICHT — das msg-Verhalten, auch (gerade) wenn es „keines" ist:
Eingangs-Port ja/nein; was `msg.payload` bewirkt; unterstützte
`msg.ui.*`-Operationen; Durchreich-Verhalten.

## Ausgänge / Events

Welche Events der Knoten emittiert, ihre `msg.ui`-Form und wann sie feuern —
oder „keine".

## Beispiele

1–3 importierbare Beispiele. Je Beispiel: was es zeigt, die Flow-Datei
(`examples/guide/<node>[-variante].json`) und die Import-Anleitung
(Node-RED-Menü → Import → Datei/JSON einfügen → Import → Deploy → App öffnen).

## Verwandt

Links auf verwandte Guide-Seiten und Knoten-Referenzen.
```
