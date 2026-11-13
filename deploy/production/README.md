# Production server files

Source of the files the production VPS runs. They are **not** synced by CI:
after changing one, copy it to the server.

| File | Installed at |
|---|---|
| `docker-compose.yml` | `/opt/syrianzone/docker-compose.yml` |
| `deploy.sh` | `/opt/syrianzone/deploy.sh` (executable) |
| `Caddyfile.syrian.zone` | the `syrian.zone { … }` block of `/opt/caddy/Caddyfile` (shared with other sites; validate and reload as described in the deployment doc) |

How the blue/green switch works and how to operate it:
[docs/getting-started/deployment.md](../../docs/getting-started/deployment.md).
Why: [docs/adr/0003-zero-downtime-deploys.md](../../docs/adr/0003-zero-downtime-deploys.md).
