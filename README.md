# tokimo-app-docs

Tokimo Docs app — document editor and management.

## Architecture

```
Browser
  │  /api/apps/docs/<route>
  ▼
tokimo-server (5678)        — auth, CORS, inject X-Tokimo-User-Id header
  │  transparent reverse proxy → UDS
  ▼
$DATA_LOCAL_PATH/apps/docs.sock
  │
this binary
  ├─ axum router (src/handlers/)       all routes on the same sock
  ├─ tokimo-bus client                 register sock + cross-app calls
  └─ Postgres direct (schema=docs)     run migrations/ on startup
```

## Local Development

### Rust

```bash
cargo build -p tokimo-app-docs
pkill -f tokimo-app-docs
```

### UI

```bash
pnpm -C apps/tokimo-app-docs/ui build --watch
# Hard refresh in browser
```

### Standalone (outside monorepo)

```bash
git clone git@github.com:tokimo-lab/tokimo-app-docs.git
cd tokimo-app-docs/ui
pnpm install
pnpm dev
```

## License

MIT OR Apache-2.0.
