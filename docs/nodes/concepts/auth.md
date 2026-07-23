# Auth — Identität, Enforcement-Fläche und Betrieb

> Konzept-Dokument zu [ADR 0041](../../adr/0041-auth-model-idp-agnostic-identity-trusted-header-first.md)
> (IdP-agnostische Identität, trusted-header zuerst, deklarative Guards, keine
> eigenen Credentials). Eingeführt mit **P260**.
>
> **Stand P260: konfiguriert, noch nicht erzwungen — Enforcement kommt mit
> P261.** Dieses Dokument beschreibt den Vertrag und die Enforcement-Fläche;
> das `ui-app.auth`-Feld ist bereits konfigurierbar, aber **kein**
> Runtime-Endpoint liest es heute. Bis P261 schützt allein der vorgelagerte
> Reverse-Proxy (siehe [Tier-0-Betrieb](#tier-0-betrieb-hinter-einem-authentifizierenden-proxy)).

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
Defaults wendet der **Leser** der Konfiguration an (P261), nicht der Editor.

## Enforcement-Matrix — die sieben Runtime-Endpoints

Ein Guard nur auf der Seite wäre Theater: **alle sieben** `RED.httpNode`-Endpoints
tragen App-Daten oder nehmen Kommandos an und müssen ab P261 durch **eine**
gemeinsame Auth-Middleware laufen. Datei:Zeile verifiziert gegen
`nodes/webapp.js` (Stand P260, 2026-07-23):

| Endpoint | Methode | Registrierung (`nodes/webapp.js`) | Enforcement |
|---|---|---|---|
| Page `/webapp/:appId` | GET | Zeile 4613 | muss Guard tragen (P261) |
| `/webapp/:appId/stream` (SSE) | GET | Zeile 4631 | muss Guard tragen (P261) |
| `/webapp/:appId/event` | POST | Zeile 4687 | muss Guard tragen (P261) |
| `/webapp/:appId/dynamic-state` | POST | Zeile 4720 | muss Guard tragen (P261) |
| `/webapp/:appId/asset/:id` | GET | Zeile 4739 | muss Guard tragen (P261) |
| `/webapp/:appId/snapshot` | GET | Zeile 4844 | muss Guard tragen (P261) |
| SPA-Fallback `/webapp/:appId/*` | GET | Zeile 4864 | muss Guard tragen (P261) |

**Regel (nicht verhandelbar):** *Jeder künftige Runtime-Endpoint registriert
durch die Auth-Middleware.* Ein neuer `RED.httpNode`-Handler, der an der
Middleware vorbei registriert wird, ist ein Sicherheitsfehler — `/snapshot`
allein liefert den kompletten App-Zustand aus.

Die Admin-Endpoints (`RED.httpAdmin`: `/webapp/icons/manifest` Z. 4579,
`/webapp/apps` Z. 4583, `/webapp/:appId/model` Z. 4598, `/webapp/:appId/assets`
GET Z. 4768 / POST Z. 4797) sind **nicht** Teil dieser Matrix — sie hängen am
Editor und sind über Node-REDs `adminAuth` abgedeckt (siehe
[Abgrenzungen](#abgrenzungen)).

## Tier-0-Betrieb: hinter einem authentifizierenden Proxy

Sofort nutzbar — ganz ohne Framework-Enforcement: die App ausschließlich hinter
einem authentifizierenden Reverse-Proxy erreichbar machen. Der Proxy erzwingt
das Login und setzt die Identitäts-Header; ab P261 liest das Framework sie und
erzwingt zusätzlich selbst.

> **Warnung — Header sind nur hinter dem Proxy vertrauenswürdig.** Die
> `X-Forwarded-*`-Header kann jeder Client selbst setzen. Sie sind **nur** dann
> eine Identität, wenn die App ausschließlich durch den authentifizierenden
> Proxy erreichbar ist (Firewall/Netzwerk-Policy: Node-RED-Port nicht direkt
> exponiert) und der Proxy einkommende `X-Forwarded-*`-Header von außen
> **verwirft/überschreibt**. Ohne diese Deployment-Voraussetzung ist
> `trusted-header` wertlos.

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
der Matrix. Wer heute (vor P261) hart absichern will, kann dort selbst prüfen:

```js
// settings.js
httpNodeMiddleware: function (req, res, next) {
    if (!req.headers["x-forwarded-user"]) {
        return res.status(401).send("Unauthorized");
    }
    next();
}
```

Das ist der Node-RED-native Vorläufer genau der Middleware, die P261 als
Framework-Bestandteil (pro App, `ui-app.auth`-gesteuert) einzieht.

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
