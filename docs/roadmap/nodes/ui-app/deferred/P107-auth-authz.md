---
id: P107
title: "ui-app: App-weite Authentifizierung/Autorisierung modellieren (OAuth2/OIDC) — Designentscheidung offen"
epic: nodes/ui-app
status: deferred
deferred_reason: "Großes eigenes Thema, Designentscheidung offen (welches Auth-Modell, wo erzwungen, wie per-Route). Erfasst als deferred, damit der Doc-Offene-Punkt nachverfolgt ist; vor Umsetzung ADR + Owner-Entscheidung nötig."
dependencies: []
node: ui-app
spec: docs/nodes/structure/ui-app.md
---
# P107 — ui-app: Auth/Authz modellieren

## Findings
> Doc-eigener offener Punkt ([ui-app.md](../../../../nodes/structure/ui-app.md) „Offene Punkte").

- App-weite Metadaten wie Authentifizierung/Autorisierung (z. B. OAuth2/OIDC) sind noch nicht modelliert.

## Acceptance
> Noch nicht spezifizierbar — deferred. Vor Umsetzung zu klären (ADR-würdig):

- Welches Auth-Modell (OAuth2/OIDC, Basic, Node-RED-eigene Auth, Reverse-Proxy-Vertrauen)?
- Wo erzwungen — am `httpNode`-Eintritt, pro App, pro Route?
- Wie interagiert das mit dem `clientId`-Modell und dem SSE-Hub?
- Editor-Felder am `ui-app` vs. eigener Auth-Knoten?

## Notes
- Bewusst deferred: erst Owner-Entscheidung + ADR, dann Pakete. Dieses File hält nur den offenen Punkt nachverfolgbar.
