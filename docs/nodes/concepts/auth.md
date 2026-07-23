# Auth — Identität, Enforcement-Fläche und Betrieb

> Konzept-Dokument zu [ADR 0041](../../adr/0041-auth-model-idp-agnostic-identity-trusted-header-first.md)
> (IdP-agnostische Identität, trusted-header zuerst, deklarative Guards, keine
> eigenen Credentials). Eingeführt mit **P260** (Contract + Konfiguration);
> **erzwungen seit P261**: bei `auth.mode: "trusted-header"` läuft jede Anfrage
> an jeden App-Endpoint durch die eine Auth-Guard-Middleware (401 bzw.
> `redirect`), und die Identität ist als Binding-Quelle `user` in jeder
> Wert-Bindung auflösbar. `mode: "none"` (Default) ist exakt das offene
> Verhalten von vorher.

## Der `user`-Contract

Es gibt **einen** internen User-Contract, unabhängig davon, woher die Identität
stammt (`userIdentitySchema` in `packages/schema`, ADR 0041 §1):

```ts
user = {
    id: string,        // Pflicht, nicht leer — der stabile Identifikator
    name?: string,     // Anzeigename
    email?: string,
    groups: string[]   // Default [] — immer iterierbar, nie undefined
}
```

**Herkunfts-Abstraktion:** Jede Auth-Quelle mappt in genau dieses Objekt.
Flows, Bindings und Guards sehen ausschließlich `user` — nie Tokens, Header
oder Provider-Spezifika. Heute ist die erste Quelle `trusted-header`
(Reverse-Proxy-Header); ein späteres `mode: "oidc"` (P264) liefert dasselbe
Objekt aus einem ID-Token. Konsumenten sind dadurch quellen-agnostisch:
`user.groups` funktioniert identisch, egal wer die Identität festgestellt hat.

## Die `ui-app.auth`-Konfiguration

`ui-app` trägt **ein** `auth`-Objekt (bewusst kein Satz flacher Einzelfelder —
ein künftiger Modus erweitert das Objekt, ohne die Feldliste zu fluten):

| Schlüssel | Pflicht | Default | Beschreibung |
|---|---|---|---|
| `mode` | ja | `none` | `none` (keine Identität) oder `trusted-header` (Identität aus Proxy-Headern). `oidc` ist als künftiger Wert reserviert (P264). |
| `headerUser` | optional | `X-Forwarded-User` | Header, aus dem `user.id` gelesen wird. |
| `headerEmail` | optional | `X-Forwarded-Email` | Header für `user.email`. |
| `headerGroups` | optional | `X-Forwarded-Groups` | Header für `user.groups` (kommasepariert). |
| `redirect` | optional | — (401) | Ziel-URL für unauthentifizierte Requests statt einer nackten 401 (z. B. `/oauth2/sign_in`). |

Leere optionale Felder bedeuten „dokumentierten Default verwenden"; die
Defaults wendet der **Leser** der Konfiguration an (seit P261:
`resolveEffectiveAuth` in `nodes/webapp.js`), nicht der Editor.

## Enforcement-Matrix — die sieben Runtime-Endpoints

Ein Guard nur auf der Seite wäre Theater: **alle sieben** `RED.httpNode`-Endpoints
tragen App-Daten oder nehmen Kommandos an und laufen seit P261 durch **eine**
gemeinsame Auth-Middleware (`appAuthGuard`). Erzwungen wird das strukturell:
jeder App-Endpoint registriert über **`registerAppEndpoint(RED, method, path,
…handlers)`** (nodes/webapp.js, Z. 4688), das die Guard-Middleware
**unbedingt** voranstellt — ein direkt via `RED.httpNode.get/post`
registrierter Endpoint existiert nicht mehr. Datei:Zeile verifiziert gegen
`nodes/webapp.js` (Stand P261, 2026-07-23):

| Endpoint | Methode | Registrierung (`nodes/webapp.js`) | Enforcement |
|---|---|---|---|
| Page `/webapp/:appId` | GET | Zeile 4738 | erzwungen via `registerAppEndpoint` |
| `/webapp/:appId/stream` (SSE) | GET | Zeile 4756 | erzwungen via `registerAppEndpoint` |
| `/webapp/:appId/event` | POST | Zeile 4812 | erzwungen via `registerAppEndpoint` |
| `/webapp/:appId/dynamic-state` | POST | Zeile 4845 | erzwungen via `registerAppEndpoint` |
| `/webapp/:appId/asset/:id` | GET | Zeile 4864 | erzwungen via `registerAppEndpoint` |
| `/webapp/:appId/snapshot` | GET | Zeile 4969 | erzwungen via `registerAppEndpoint` |
| SPA-Fallback `/webapp/:appId/*` | GET | Zeile 4989 | erzwungen via `registerAppEndpoint` |

**Regel (nicht verhandelbar):** *Jeder künftige Runtime-Endpoint registriert
über `registerAppEndpoint` — nie direkt via `RED.httpNode`.* Ein daran vorbei
registrierter Handler ist ein Sicherheitsfehler — `/snapshot` allein liefert
den kompletten App-Zustand aus.

Die Guard-Semantik je Anfrage (`appAuthGuard`, Z. 4659): `mode: "none"` →
durchlassen (exakt das bisherige Verhalten). `mode: "trusted-header"` →
User-Header (konfigurierter Name, Default `X-Forwarded-User`) vorhanden ⇒
`user`-Objekt in den Request-Kontext (Groups: kommasepariert, tolerant geparst
— getrimmt, leere Einträge verworfen); fehlend/leer ⇒ **401**, bzw. **302** auf
`auth.redirect`, wenn gesetzt. Bei einer SSE-Verbindung prüft die Guard **beim
Verbindungsaufbau**; die Identität wird an die Verbindung gebunden — jedes
spätere Re-Render dieses Clients (Store-Push, Deploy-Push) nutzt genau diese
Identität, ohne die Header je Event neu zu lesen und ohne Leck zwischen
Verbindungen.

Die Admin-Endpoints (`RED.httpAdmin`: `/webapp/icons/manifest` Z. 4704,
`/webapp/apps` Z. 4708, `/webapp/:appId/model` Z. 4723, `/webapp/:appId/assets`
GET Z. 4893 / POST Z. 4922) sind **nicht** Teil dieser Matrix — sie hängen am
Editor und sind über Node-REDs `adminAuth` abgedeckt (siehe
[Abgrenzungen](#abgrenzungen)).

## `user` als Binding-Quelle

Die Identität ist als Binding-Quelle `user` (typedInput-Typ „User") in jeder
Wert-Bindung auflösbar — wie `state`/`routeParam` (ADR 0041 §3, ADR 0012):

| Bindung | liefert |
|---|---|
| `user.id` | den stabilen Identifikator (Wert des User-Headers) |
| `user.name` | den Anzeigenamen (bei trusted-header identisch mit `user.id` — die Proxy-Header tragen keinen separaten Anzeigenamen) |
| `user.email` | die E-Mail (oder `undefined` → Fallback) |
| `user.groups` | das `string[]` — auch strukturell nutzbar; `user.groups.0` liest einen Eintrag |

Aufgelöst wird im Renderer aus dem Request- bzw. SSE-Verbindungs-Kontext; bei
`mode: "none"` (keine Identität) löst jede `user`-Bindung `undefined` auf (→
Fallback). Vollständiges Binding-Vokabular: [stores.md](stores.md).

## Tier-0-Betrieb: hinter einem authentifizierenden Proxy

Die Betriebs-Grundlage: die App ausschließlich hinter einem
authentifizierenden Reverse-Proxy erreichbar machen. Der Proxy erzwingt das
Login und setzt die Identitäts-Header; das Framework (seit P261) liest sie und
erzwingt zusätzlich selbst — `auth.mode: "trusted-header"` am `ui-app`.

> **Warnung — Header sind nur hinter dem Proxy vertrauenswürdig.** Die
> `X-Forwarded-*`-Header kann jeder Client selbst setzen. Sie sind **nur** dann
> eine Identität, wenn die App ausschließlich durch den authentifizierenden
> Proxy erreichbar ist (Firewall/Netzwerk-Policy: Node-RED-Port nicht direkt
> exponiert) und der Proxy einkommende `X-Forwarded-*`-Header von außen
> **verwirft/überschreibt**. Ohne diese Deployment-Voraussetzung ist
> `trusted-header` wertlos: die Guard prüft die **Anwesenheit** der Header —
> ihre **Vertrauenswürdigkeit** erzwingt allein das Deployment.

**Optionale Härtung (`trustProxy`, dokumentierte Option):** Als zusätzlicher
Gürtel zur Hose kann die Annahme „Header kommen nur vom Proxy" auch
Node-RED-seitig geprüft werden — z. B. in `settings.js` via
`httpNodeMiddleware` nur Requests akzeptieren, deren `req.socket.remoteAddress`
die konfigurierte Upstream-Adresse des Proxys ist (bzw. Express'
`trust proxy`-Einstellung entsprechend setzen). Ein eigenes
`auth.trustProxy`-Feld am `ui-app` ist bewusst **nicht** eingeführt: die
Upstream-Quelle ist eine Deployment-Eigenschaft der Node-RED-Instanz, keine
Eigenschaft einer einzelnen App — die Prüfung gehört in die Instanz-Settings.

### Beispiel: oauth2-proxy

```yaml
# oauth2-proxy.cfg — vor Node-RED geschaltet, OIDC-Provider beliebig
http_address = "0.0.0.0:4180"
upstreams = [ "http://127.0.0.1:1880/" ]
provider = "oidc"
oidc_issuer_url = "https://idp.example.com/realms/main"
client_id = "webapp"
client_secret = "…"
cookie_secret = "…"
email_domains = [ "*" ]
# Identitäts-Header an den Upstream durchreichen:
pass_user_headers = true      # X-Forwarded-User / X-Forwarded-Email
set_xauthrequest = true
# Gruppen als Header (Provider-abhängig, z. B. via oidc_groups_claim)
oidc_groups_claim = "groups"
```

### Beispiel: Authelia + Traefik ForwardAuth

```yaml
# traefik: dynamic config — jede Anfrage erst durch Authelia
http:
  middlewares:
    authelia:
      forwardAuth:
        address: "http://authelia:9091/api/authz/forward-auth"
        authResponseHeaders:
          - "Remote-User"      # → ui-app.auth.headerUser: Remote-User
          - "Remote-Email"     # → headerEmail: Remote-Email
          - "Remote-Groups"    # → headerGroups: Remote-Groups
  routers:
    webapp:
      rule: "PathPrefix(`/webapp`)"
      middlewares: [ "authelia" ]
      service: nodered
```

Authelia/ForwardAuth setzt `Remote-User`/`-Email`/`-Groups` statt der
`X-Forwarded-*`-Defaults — dafür gibt es die `headerUser`/`headerEmail`/
`headerGroups`-Felder am `ui-app`.

### Node-RED `httpNodeMiddleware`

Node-RED bietet in `settings.js` den Haken `httpNodeMiddleware`, der vor
**allen** `RED.httpNode`-Routen läuft — also auch vor allen sieben Endpoints
der Matrix. Er bleibt als Instanz-weite Zusatzschicht nützlich (z. B. für die
`trustProxy`-Härtung oben oder Nicht-Webapp-HTTP-Nodes):

```js
// settings.js
httpNodeMiddleware: function (req, res, next) {
    if (!req.headers["x-forwarded-user"]) {
        return res.status(401).send("Unauthorized");
    }
    next();
}
```

Das ist der Node-RED-native Vorläufer der Middleware, die P261 als
Framework-Bestandteil (pro App, `ui-app.auth`-gesteuert) eingezogen hat — die
Framework-Guard ersetzt ihn für die Webapp-Endpoints, der Haken bleibt für
Instanz-weite Zusatzprüfungen.

## Abgrenzungen

- **`adminAuth` = Editor, nicht App.** Der Node-RED-Editor und die
  `RED.httpAdmin`-Endpoints werden über Node-REDs eigenes `adminAuth`
  abgesichert. Das ist dokumentierter Bestand — dieses Konzept regelt nur die
  **App**-Endpoints (`RED.httpNode`).
- **`clientId` bleibt, was sie ist: Geräte-Identität.** Die `clientId` (P87,
  [multi-user.md](multi-user.md)) identifiziert einen Browser/Tab und keyed
  per-Client-State. Sie sagt nichts darüber, *wer* die App benutzt. `user` ist
  orthogonal dazu; beide existieren nebeneinander.
- **„visibleIf ist UX, Guard ist Sicherheit"** (Vorgriff auf P262): UI über
  `visibleIf user.groups` auszublenden ist Bedienkomfort — die Daten liegen
  trotzdem im Snapshot/Stream. Sicherheit entsteht ausschließlich durch
  server-seitige Guards (`requiresGroup[]` an Routen/Dialogen, P262), die Page,
  `/snapshot`, Navigation und Event-Dispatch erzwingen.
- **Nicht-Ziele:** Das Framework speichert oder prüft **niemals** Passwörter;
  Passkeys/MFA gehören dem IdP hinter dem Proxy (bzw. später dem OIDC-Issuer,
  P264). Auch **API-Token** (Machine-to-Machine-Auth für die Endpoints) sind
  kein Ziel dieses Modells.

## Referenzen

- [ADR 0041](../../adr/0041-auth-model-idp-agnostic-identity-trusted-header-first.md) — Entscheidung und Staffelung (P260–P264)
- [`ui-app`](../structure/ui-app.md) — das `auth`-Feld in der Feldtabelle
- [multi-user.md](multi-user.md) — `clientId`/Geräte-Identität
- [messages.md](messages.md) — Transport (`/stream`, `/event`)
