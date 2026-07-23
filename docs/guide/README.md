# node-red-contrib-webapp — User Guide

> This is the **user documentation** (ADR 0042): task-oriented, example-driven,
> written for people building web apps with these nodes. **English is
> canonical**; [`de/`](de/README.md) mirrors the tree as the German
> translation. The internal *contract* docs live in `docs/nodes/**` (German,
> requirement-level, for implementers) — a different genre; user docs must
> never contradict them.

## Contents

- **[Introduction](introduction.md)** — what node-red-contrib-webapp is and
  how it thinks (the core model on one page)
- **[Getting started](getting-started.md)** — install, first app, first
  deploy, troubleshooting
- **Guides** — the big topics, each with an importable example flow:
  - [Layout & Slots](guides/layout-slots.md) — mount paths, layout presets,
    placement fields
  - [Bindings & State](guides/bindings-state.md) — the binding kinds (incl.
    the `user` source), stores, store operations
  - [Actions & Events](guides/actions-events.md) — the direction rule and
    the two ways: wire vs. reference
  - [Navigation & Dialogs](guides/navigation-dialogs.md) — routes, the three
    navigate modes, dialog open/close, route scoping
  - [Displaying data](guides/displaying-data.md) — the query loop, tables,
    lists, repeat, pagination
  - [Forms](guides/forms.md) — the input family, bidirectional
    value/writeTo, write triggers
  - [Auth](guides/auth.md) — trusted-header operation, `user` binding,
    `requiresGroup` guards
  - [Theming & Components](guides/theming-components.md) — design tokens,
    variants vs. colours, reusable components
- **Node reference** — one page per node under [`nodes/`](nodes/ui-divider.md):
  purpose, every field with its variants at user level, input behaviour,
  events, and 1–3 importable examples
  - [`ui-divider`](nodes/ui-divider.md) — the pilot; the batches P267–P271 add
    the rest
- **Templates** — [`_templates/`](_templates/node-reference.md) for authors:
  [node reference](_templates/node-reference.md) ·
  [guide](_templates/guide.md) · [editor help](_templates/help.md)

## Deutsch

Die deutsche Übersetzung spiegelt diesen Baum unter [`de/`](de/README.md).
**German is not optional**: every page is authored EN + DE in the same change
(the drift rule — never merge EN without DE).

---

## How node help i18n works (PROVEN mechanic — binding for P267–P271)

The editor help of every node lives in **Node-RED's per-node locale
mechanism**, not in an inline `data-help-name` block. The mechanic below was
**measured in the real editor** on the pilot `ui-divider` (P265, node-red
4.0.5, `tests/e2e/nodes/editor/help-i18n-locales.spec.ts`) — follow it exactly.

### File locations

For a node registered as `nodes/<cat>/<node>.js` (see `package.json`
`node-red.nodes`), the help files are:

```
nodes/<cat>/locales/en-US/<node>.html   ← English help (canonical)
nodes/<cat>/locales/de/<node>.html      ← German help
```

The runtime resolves `path.dirname(<node>.js) + /locales/<lang>/<node>.html`
(`@node-red/registry/lib/loader.js`, `loadNodeHelp`). The `locales/` directory
is **shared per category folder** — all `nodes/view/*` nodes use
`nodes/view/locales/`.

### File format

Each locale file contains the **full help script block**, exactly as an inline
help would — Node-RED appends the file content verbatim to the node's config
HTML:

```html
<script type="text/html" data-help-name="<node>">
  ...help HTML...
</script>
```

Write the content per the [help template](_templates/help.md): Purpose (1–2
sentences) · Key fields · **Inputs (mandatory section)** · Outputs/Events ·
"Full docs" link. The help is a *summary*, never a duplicate of the guide doc.

### Language selection + fallback (measured)

- The editor sends `Accept-Language: localStorage["editor-language"] ||
  detected browser language` on `GET /nodes`. The **User Settings → View →
  Language** dropdown persists exactly that `editor-language` key — switching
  it reloads the node configs with the other locale's help.
- Server-side fallback chain per request:
  **exact language** (`de-DE`) → **language prefix** (`de`) → **`en-US`**
  (Node-RED's `defaultLang`). So `en-US` + `de` directories cover
  `en-US`, `en`, `de`, `de-DE`, `de-AT`, …; any other language falls back to
  English. Never create `de-DE/` — `de/` is the correct directory.

### Migration rules (per node, per batch)

1. Create `locales/en-US/<node>.html` **and** `locales/de/<node>.html` in the
   same change (EN + DE together, always).
2. **Delete the node's inline `data-help-name` block** from
   `nodes/<cat>/<node>.html`. If the inline block stays, it wins for the
   default language and the locale files are dead weight — remove it.
3. The "Full docs" link targets the **user guide doc**:
   - EN help → `https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/guide/nodes/<node>.md`
   - DE help → `…/blob/develop/docs/guide/de/nodes/<node>.md`
4. Author the guide doc pair (`docs/guide/nodes/<node>.md` +
   `docs/guide/de/nodes/<node>.md`, per the
   [node-reference template](_templates/node-reference.md)) and ≥1 importable
   example under `examples/guide/` in the same change.
5. Shrink the transition lists: remove the node from `TRANSITION_INLINE` in
   `scripts/check-help.js` and from `ALLOWLIST` in `scripts/check-guide.js`,
   and add it to `LOCALE_MIGRATED` in
   `tests/e2e/nodes/editor/help-docs-link.spec.ts`.
6. Editor **form-label** i18n (`data-i18n` on form rows) follows the P272
   mechanic below ("How editor-label i18n works") — migrate the node's labels
   in the same batch change.

### Guardrails

- `pnpm check:help` — every registered node has en-US **and** de help (locales,
  or transitionally inline) with a resolvable doc link.
- `pnpm check:guide` — every registered node has an EN + DE guide doc and ≥1
  example (allowlist shrinks to empty over P267–P271).
- `tests/e2e/guide-examples-smoke.spec.ts` — every `examples/guide/**.json`
  deploys and renders.
- `pnpm check:links` — every markdown link under `docs/guide/**` resolves.

---

## How editor-label i18n works (PROVEN mechanic — binding for P267–P271)

Editor **form labels** (field names, select options, placeholders, N/A hints)
are translated through Node-RED's per-node **message catalogs** — proven on the
pilot `ui-divider` (P272, ADR 0042 §3, node-red 4.0.5,
`tests/e2e/nodes/editor/label-i18n-locales.spec.ts` +
`label-i18n-shared-strings.spec.ts`). Follow it exactly.

### File locations + namespace (measured)

For a node registered as `nodes/<cat>/<node>.js`, the message catalogs are:

```
nodes/<cat>/locales/en-US/<node>.json   ← English labels (canonical)
nodes/<cat>/locales/de/<node>.json      ← German labels
```

`@node-red/registry/lib/loader.js` (`loadNodeLocales`): when a `locales/`
directory exists next to the registered `.js`, the catalog file
`<basename>.json` is registered under the node **set id** as its i18next
namespace — for this package always `node-red-contrib-webapp/<node>`. The
editor loads **all** node catalogs at startup via `GET /nodes/messages?lng=…`
for the editor language (`localStorage["editor-language"]`, the same User
Settings dropdown the help mechanic proved) plus the `en-US` fallback; a key
missing in `de` falls back to `en-US` client-side.

### Key convention (binding)

The catalog's top-level key is the node name; inside it:

| What | Key | Example |
|---|---|---|
| form-row label | `<node>.label.<field>` | `ui-divider.label.orientation` |
| select option | `<node>.option.<field>.<value>` | `ui-divider.option.orientation.vertical` |
| input placeholder | `<node>.placeholder.<field>` | `ui-divider.placeholder.label` |
| base-field N/A hint | `<node>.hints.<field>` | `ui-divider.hints.disabled` |

In the edit template the label carries `data-i18n="<node>.label.<field>"`
**without** a namespace: `RED.editor.buildEditForm` prefixes every
un-namespaced `data-i18n` key with `node._def.set.id + ":"`, then
`trayBody.i18n()` (jquery-i18next) replaces the element text — this runs
**after** `oneditprepare`, so dynamically injected elements with explicit
namespaced keys are translated too. Attribute targets use the standard
jquery-i18next prefix: `data-i18n="[placeholder]<node>.placeholder.<field>"`.
The `Name` row uses Node-RED's own catalog — `data-i18n="node-red:common.label.name"`
— which is translated in every core language for free. Keep the English text
as the element's literal content (authoring reference; it is replaced at edit
time).

Interplay with `common.registerNodeType` (measured): none to worry about — the
wrapper registers the type synchronously inside the set's config script, so
the editor attributes the type to the correct set and `set.id` (the data-i18n
prefix) is always `node-red-contrib-webapp/<node>`.

### Shared strings (editor-common.js)

`resources/lib/editor-common.js` is a statically served resource with **no
node set of its own**, so its shared strings (base-field rows + N/A default
hints, picker buttons/titles, layout & reference selector captions, shared
SelectBox options) live in the dedicated **catalog-carrier set**
`webapp-common`:

```
nodes/webapp-common.js                     ← registers NO types (carrier only)
nodes/locales/en-US/webapp-common.json     ← shared strings, namespace
nodes/locales/de/webapp-common.json          node-red-contrib-webapp/webapp-common
```

Keys follow `common.<area>.<key>` (e.g. `common.baseFields.heading`,
`common.picker.chooseIcon`). editor-common resolves them **lazily** at
oneditprepare/dialog-open time via `sharedI18n(key, fallback)` —
`RED._("node-red-contrib-webapp/webapp-common:common.<key>")` with the en-US
literal as fallback, so a missing key never renders raw. Do **not** duplicate
shared strings into per-node catalogs.

Per-node **N/A hints**: put them in the node's own catalog under
`<node>.hints.<field>` and set `i18nNode: "<node>"` in the node's
`BASE_FIELDS` — `installBaseFields` resolves them via `nodeI18n()` (node
catalog → literal `hints` override → shared default), see ui-divider.

### Migration rules (per node, per batch)

1. Create `locales/en-US/<node>.json` **and** `locales/de/<node>.json` in the
   same change (EN + DE together, always — one file per language, shared with
   nothing).
2. Add `data-i18n` per the key table to every form row of the node's template
   (labels, options, placeholders); switch `Name` to
   `node-red:common.label.name`.
3. Replace literal German `hints` in `BASE_FIELDS` with catalog keys +
   `i18nNode`.
4. Shrink the transition list: remove the node from `LABEL_TRANSITION` in
   `scripts/check-help.js` (the label-catalog guardrail then enforces en-US +
   de catalogs and `data-i18n` usage for the node).
5. Specs must assert **en-US texts or structural selectors** (`data-i18n`
   keys, ids, `data-*` markers) — never German texts.

### Guardrails

- `pnpm check:help` — additionally to the help rules: every label-migrated
  node (not on `LABEL_TRANSITION`) uses `data-i18n` in its template and has an
  en-US **and** de label catalog with mirrored key structure; the shared
  `webapp-common` catalogs must exist and mirror each other.
