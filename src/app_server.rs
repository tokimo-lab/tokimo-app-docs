//! Embedded axum HTTP server, listening on a local socket.
//!
//! Route layout (server-side `/api/apps/docs/<rest>` proxies to this sock's `/<rest>`):
//! - All doc CRUD routes from router.rs
//! - `GET /assets/{*path}` → static assets
//!
//! Single sock serves control plane + data plane + assets; server side only needs one proxy rule.

use std::sync::Arc;

use axum::Router;
use tokimo_bus_protocol::{BusListener, DataPlaneSocket};
use tracing::{error, info};

use crate::{assets, handlers, handlers::AppCtx, router};

/// Start axum server on local socket, return `DataPlaneSocket` for broker registration.
pub async fn spawn(service: &str, ctx: Arc<AppCtx>) -> anyhow::Result<DataPlaneSocket> {
    let (listener, socket) = BusListener::bind_for_app(service)?;
    info!(?socket, "docs: app server listening");

    let app_router = build_router(ctx);

    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app_router).await {
            error!(error = %e, "docs: app server stopped");
        }
    });

    Ok(socket)
}

fn build_router(ctx: Arc<AppCtx>) -> Router {
    router::build_docs_routes(ctx)
        .route("/assets/{*path}", axum::routing::get(assets::serve))
}
