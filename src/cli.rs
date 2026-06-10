//! CLI entrypoints for docs.

use anyhow::Context;
use chrono::Utc;
use tokimo_bus_auth::db::verify_token;
use tokimo_bus_cli::{Credentials, TokimoAuthArgs};
use uuid::Uuid;

use crate::{
    SpacesCmd,
    db::{init_pool, repos::space_repo::DocSpaceRepo},
};

pub async fn run_spaces(auth: TokimoAuthArgs, cmd: SpacesCmd) -> anyhow::Result<()> {
    let (db, _user_id) = init(auth).await?;

    match cmd {
        SpacesCmd::List => {
            let spaces = DocSpaceRepo::list_all(&db)
                .await
                .context("list spaces failed")?;
            if spaces.is_empty() {
                println!("No doc spaces.");
                return Ok(());
            }

            println!("{:<36}  {:<25}  Name", "ID", "Created At");
            for space in spaces {
                println!(
                    "{:<36}  {:<25}  {}",
                    space.id,
                    space.created_at
                        .map(|d| d.with_timezone(&Utc).to_rfc3339())
                        .unwrap_or_default(),
                    space.name
                );
            }
        }
    }

    Ok(())
}

async fn init(auth: TokimoAuthArgs) -> anyhow::Result<(sea_orm::DatabaseConnection, Uuid)> {
    let credentials = Credentials::resolve(&auth).context("resolve Tokimo credentials failed")?;
    let db = init_pool().await.context("connect database failed")?;
    let verified = verify_token(&db, &credentials.token)
        .await
        .context("verify Tokimo token failed")?;
    Ok((db, verified.user_id))
}
