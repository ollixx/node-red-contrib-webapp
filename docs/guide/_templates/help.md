# Template: editor help (`nodes/<cat>/locales/<lang>/<node>.html`)

> For authors (P265, ADR 0042). The editor help is a **summary, not a
> duplicate** of the guide doc — hard length cap: **≤ ~30 lines / ≤ 2000
> characters** of HTML body. It lives in the Node-RED locale mechanism (file
> locations, fallback and migration rules: see the
> [guide README](../README.md#how-node-help-i18n-works-proven-mechanic--binding-for-p267p271)).
> `locales/en-US/<node>.html` and `locales/de/<node>.html` are **always
> authored in the same change**; the inline `data-help-name` block is removed.

## Skeleton (EN — `locales/en-US/<node>.html`)

```html
<script type="text/html" data-help-name="ui-<node>">
<p>Purpose in 1–2 sentences.</p>
<h3>Key fields</h3>
<ul>
    <li><b>Field</b> — what it does, notable variants, bindability.</li>
    <li>…only the fields a user must know; the guide doc has all of them.</li>
</ul>
<h3>Inputs</h3>
<p>MANDATORY section — the node's msg behaviour, even when it is "none":
input port yes/no, what <code>msg.payload</code> does, supported
<code>msg.ui.*</code> ops, pass-through.</p>
<h3>Outputs / Events</h3>
<p>Which events fire and when — or "none".</p>
<h3>Full docs</h3>
<p><a href="https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/guide/nodes/ui-<node>.md" target="_blank">docs/guide/nodes/ui-&lt;node&gt;.md</a></p>
</script>
```

## Skelett (DE — `locales/de/<node>.html`)

```html
<script type="text/html" data-help-name="ui-<node>">
<p>Zweck in 1–2 Sätzen.</p>
<h3>Wichtige Felder</h3>
<ul>
    <li><b>Feld</b> — was es tut, wichtige Varianten, Bindbarkeit.</li>
</ul>
<h3>Eingang</h3>
<p>PFLICHT-Abschnitt — das msg-Verhalten, auch wenn es „keines" ist.</p>
<h3>Ausgänge / Events</h3>
<p>Welche Events wann feuern — oder „keine".</p>
<h3>Vollständige Doku</h3>
<p><a href="https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/guide/de/nodes/ui-<node>.md" target="_blank">docs/guide/de/nodes/ui-&lt;node&gt;.md</a></p>
</script>
```

## Rules

- **Language link rule**: EN help links the EN guide doc
  (`docs/guide/nodes/<node>.md`), DE help links the DE guide doc
  (`docs/guide/de/nodes/<node>.md`).
- The Inputs section is mandatory in BOTH languages (guardrail-checked by
  `pnpm check:help` for migrated nodes).
- Input-behaviour statements come from the conformance-measured truth
  (`docs/nodes/**`, P230–P258) — never guessed.
- Reference rendered example: `nodes/view/locales/en-US/ui-divider.html` /
  `locales/de/ui-divider.html` (the P265 pilot).
