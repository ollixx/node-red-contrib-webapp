# Demo Deployment

Deploys the Customers CRUD example app to a Hetzner server via GitHub Actions,
Docker, GHCR (GitHub Container Registry), and Caddy (reverse proxy with
auto-TLS and Basic-Auth).

## Architecture

```
GitHub Actions
  └── build Dockerfile (multi-stage: pnpm build → nodered/node-red image)
  └── push to ghcr.io/<owner>/node-red-contrib-webapp:latest + :<sha>
  └── SSH into Hetzner server
        └── docker compose pull
        └── docker compose up -d
              ├── node-red  (GHCR image, port 1880 on 127.0.0.1 only)
              └── caddy     (ports 80/443, auto-TLS, Basic-Auth → proxy → node-red:1880)
```

Node-RED data is **ephemeral** — every deploy re-seeds the Customers CRUD
demo flow for a clean reviewer experience. No volume is mounted for `/data`.

## One-time server setup

1. **Provision a Hetzner server** (CX22 or similar, Ubuntu 24.04).
2. **Install Docker + Compose plugin**:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER  # or use a dedicated deploy user
   ```
3. **Create a DNS A record** pointing `DEMO_DOMAIN` to the server's IP.
4. **Create a deploy user** (optional but recommended):
   ```bash
   sudo adduser deploy
   sudo usermod -aG docker deploy
   ```
5. **Add the CI SSH public key** to `~/.ssh/authorized_keys` on the server.
6. **Copy `docker-compose.yml` and `Caddyfile` to `~/demo/`** on the server:
   ```bash
   scp deploy/docker-compose.yml deploy/Caddyfile deploy@<host>:~/demo/
   ```
   The CI workflow runs `cd ~/demo && docker compose pull && docker compose up -d`.
7. **Create `~/demo/.env`** on the server with the runtime variables:
   ```env
   DEMO_IMAGE=ghcr.io/<owner>/node-red-contrib-webapp:latest
   DEMO_DOMAIN=demo.example.com
   DEMO_BASIC_AUTH_HASH=<caddy hash-password output>
   NODE_RED_CREDENTIAL_SECRET=<random string>
   ```
   Generate the Basic-Auth hash locally:
   ```bash
   docker run --rm caddy:2-alpine caddy hash-password --plaintext 'your-password'
   ```

## GitHub Secrets (Environment: `demo`)

Configure these in **Settings → Environments → demo → Secrets**:

| Secret | Description |
|--------|-------------|
| `HETZNER_SSH_HOST` | Server IP or hostname |
| `HETZNER_SSH_USER` | SSH user (e.g. `deploy`) |
| `HETZNER_SSH_KEY` | Private SSH key (Ed25519) |
| `DEMO_DOMAIN` | Public hostname, e.g. `demo.example.com` |
| `DEMO_BASIC_AUTH_HASH` | Output of `caddy hash-password` |
| `NODE_RED_CREDENTIAL_SECRET` | (Optional) stable Node-RED credential secret |

## Trigger

The workflow runs on:
- **Manual dispatch** — GitHub UI → Actions → "Deploy demo" → Run workflow
- **Push to `develop`** — auto-deploys after every merge to develop

It is **never** triggered by pull requests or fork events so secrets remain safe.

## Extraction for public release

When this repo goes public, move the deploy machinery to a private deploy repo:

1. Move `deploy/` and `.github/workflows/deploy-demo.yml` to the private repo.
2. In the private repo workflow, replace:
   ```yaml
   - uses: actions/checkout@v4
   ```
   with:
   ```yaml
   - uses: actions/checkout@v4
     with:
       repository: <owner>/node-red-contrib-webapp
       ref: develop
       token: ${{ secrets.DEPLOY_REPO_PAT }}
   ```
3. Change the trigger to include `repository_dispatch` so the main repo can
   kick off a deploy after CI passes.
4. Remove `.github/workflows/deploy-demo.yml` from this repo.
