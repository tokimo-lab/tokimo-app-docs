//! Docs app — multi-process architecture with embedded axum + UDS.
//!
//! Startup flow:
//! 1. Connect to broker (for supervisor health check + optional cross-app calls)
//! 2. Start axum router listening on `<runtime_dir>/apps/docs.sock`
//! 3. Report the socket to broker (via `data_plane_socket` field)
//! 4. Server-side `/api/apps/docs/<rest>` proxies to this sock's `/<rest>`

/// Compile-time embedded app manifest; shared with the library crate via lib.rs.
const MANIFEST: &str = include_str!("../tokimo-app.toml");

mod app_server;
mod assets;
mod bus_clients;
mod cli;
mod db;
mod error;
mod handlers;
mod models;
mod router;
mod services;

use std::sync::{Arc, OnceLock};

use axum::{Json, http::StatusCode, response::IntoResponse};
use clap::{Parser, Subcommand};
use tokimo_bus_cli::TokimoAuthArgs;
use tokimo_bus_client::{BusClient, ClientConfig};
use tracing::{error, info};

/// Unified error response (shared with lib.rs; binary crate modules reference via `crate::AppError`).
#[derive(Debug)]
pub struct AppError {
    pub status: StatusCode,
    pub message: String,
}

impl AppError {
    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: msg.into(),
        }
    }
    pub fn internal(msg: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: msg.into(),
        }
    }
    pub fn not_found(msg: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: msg.into(),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let body = serde_json::json!({ "error": self.message });
        (self.status, Json(body)).into_response()
    }
}

impl From<sea_orm::DbErr> for AppError {
    fn from(e: sea_orm::DbErr) -> Self {
        Self::internal(format!("db: {e}"))
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for AppError {}

#[derive(Parser, Debug)]
#[command(
    name = "tokimo-app-docs",
    about = "Docs — Tokimo document editor app CLI",
    long_about = "Docs CLI — directly read/write Tokimo database, manage doc spaces and nodes.\n\nCLI reads/writes the database directly; does not require the main server to be running.",
    term_width = 100
)]
struct Cli {
    #[command(flatten)]
    auth: TokimoAuthArgs,
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Manage doc spaces
    #[command(
        subcommand_required = false,
        arg_required_else_help = false,
        long_about = "Manage doc spaces",
        term_width = 100
    )]
    Spaces {
        #[command(subcommand)]
        cmd: Option<SpacesCmd>,
    },
}

#[derive(Subcommand, Debug)]
pub(crate) enum SpacesCmd {
    /// List all doc spaces
    List,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let Cli { auth, command } = Cli::parse();

    match command {
        None if std::env::var_os("TOKIMO_BUS_SOCKET").is_some() => {
            // server mode: spawned by supervisor with no args (TOKIMO_BUS_SOCKET injected)
            tracing_subscriber::fmt()
                .with_env_filter(
                    tracing_subscriber::EnvFilter::try_from_default_env()
                        .unwrap_or_else(|_| "info,tokimo_bus_client=info,tokimo_app_docs=debug".into()),
                )
                .init();
            if let Err(error) = run_server().await {
                error!(%error, "docs: fatal");
                std::process::exit(1);
            }
        }
        None => {
            // manual run with no args: print CLI help instead of entering server mode
            use clap::CommandFactory;
            let mut cmd = Cli::command();
            tokimo_bus_cli::print_help_unified(&mut cmd);
            std::process::exit(0);
        }
        Some(cmd) => {
            // CLI mode: plain text errors, no tracing logs
            let result = match cmd {
                Command::Spaces { cmd: None } => {
                    use clap::CommandFactory;
                    let mut root = Cli::command();
                    root.build();
                    if let Some(spaces_cmd) = root.find_subcommand_mut("spaces") {
                        tokimo_bus_cli::print_help_unified(spaces_cmd);
                    }
                    std::process::exit(0);
                }
                Command::Spaces { cmd: Some(c) } => cli::run_spaces(auth, c).await,
            };
            if let Err(error) = result {
                eprintln!("Error: {error:#}");
                std::process::exit(1);
            }
        }
    }

    Ok(())
}

async fn run_server() -> anyhow::Result<()> {
    let cfg = ClientConfig::from_env().map_err(|e| anyhow::anyhow!("ClientConfig: {e}"))?;
    info!(endpoint = ?cfg.endpoint, "docs: connecting to broker");

    let db = db::init_pool().await?;
    info!("docs: db connected (schema managed by host)");

    // BusClient still exists for:
    // 1) letting broker know docs is online (supervisor health check)
    // 2) providing cross-app `bus.call("notification_center", "notify", ...)` channel
    let client_slot: Arc<OnceLock<Arc<BusClient>>> = Arc::new(OnceLock::new());
    let http_client = reqwest::Client::builder()
        .build()
        .map_err(|e| anyhow::anyhow!("reqwest client: {e}"))?;
    let collab = Arc::new(services::collab_mod::CollabService::new(db.clone()));
    let ctx = Arc::new(handlers::AppCtx {
        db,
        client: Arc::clone(&client_slot),
        http_client,
        collab,
    });

    // Start axum router listening on UDS (business + assets + data all on this sock)
    let app_socket = app_server::spawn("docs", Arc::clone(&ctx))
        .await
        .map_err(|e| anyhow::anyhow!("app_server spawn: {e}"))?;

    // Report the sock to broker via `data_plane_socket` (server uses it as reverse proxy target)
    let client = BusClient::builder(cfg)
        .service("docs", env!("CARGO_PKG_VERSION"))
        .data_plane(app_socket)
        .build()
        .await
        .map_err(|e| anyhow::anyhow!("bus build: {e}"))?;
    client_slot
        .set(Arc::clone(&client))
        .map_err(|_| anyhow::anyhow!("client_slot already set"))?;

    info!("docs: registered with broker");

    let shutdown = {
        let client = Arc::clone(&client);
        tokio::spawn(async move { client.run_until_shutdown().await })
    };

    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            info!("docs: SIGINT received");
            client.shutdown();
        }
        _ = shutdown => info!("docs: broker sent Shutdown"),
    }

    Ok(())
}
