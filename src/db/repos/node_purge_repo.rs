use sea_orm::sea_query::Expr;
use sea_orm::sea_query::extension::postgres::PgFunc;
use sea_orm::{ColumnTrait, Condition, ConnectionTrait, EntityTrait, QueryFilter};
use uuid::Uuid;

use crate::db::entities::{
    docs_base_records, docs_node_attachments, docs_node_comments, docs_node_meta, docs_node_versions,
    docs_node_view_states,
};
use crate::error::AppError;

pub struct NodePurgeRepo;

impl NodePurgeRepo {
    /// Delete every path-bound row for one node or directory subtree.
    /// Returns attachment metadata so the caller can remove binary storage after commit.
    pub async fn delete_related<C: ConnectionTrait>(
        db: &C,
        space_id: Uuid,
        rel_path: &str,
        is_dir: bool,
    ) -> Result<Vec<docs_node_attachments::Model>, AppError> {
        let attachment_filter = path_filter(docs_node_attachments::Column::RelPath, rel_path, is_dir);
        let attachments = docs_node_attachments::Entity::find()
            .filter(docs_node_attachments::Column::SpaceId.eq(space_id))
            .filter(attachment_filter.clone())
            .all(db)
            .await?;

        docs_node_comments::Entity::delete_many()
            .filter(docs_node_comments::Column::SpaceId.eq(space_id))
            .filter(path_filter(docs_node_comments::Column::RelPath, rel_path, is_dir))
            .exec(db)
            .await?;
        docs_node_versions::Entity::delete_many()
            .filter(docs_node_versions::Column::SpaceId.eq(space_id))
            .filter(path_filter(docs_node_versions::Column::RelPath, rel_path, is_dir))
            .exec(db)
            .await?;
        docs_node_view_states::Entity::delete_many()
            .filter(docs_node_view_states::Column::SpaceId.eq(space_id))
            .filter(path_filter(docs_node_view_states::Column::RelPath, rel_path, is_dir))
            .exec(db)
            .await?;
        docs_base_records::Entity::delete_many()
            .filter(docs_base_records::Column::SpaceId.eq(space_id))
            .filter(path_filter(docs_base_records::Column::RelPath, rel_path, is_dir))
            .exec(db)
            .await?;
        docs_node_attachments::Entity::delete_many()
            .filter(docs_node_attachments::Column::SpaceId.eq(space_id))
            .filter(attachment_filter)
            .exec(db)
            .await?;
        docs_node_meta::Entity::delete_many()
            .filter(docs_node_meta::Column::SpaceId.eq(space_id))
            .filter(path_filter(docs_node_meta::Column::RelPath, rel_path, is_dir))
            .exec(db)
            .await?;

        Ok(attachments)
    }
}

fn path_filter<C>(column: C, rel_path: &str, is_dir: bool) -> Condition
where
    C: ColumnTrait + Copy,
{
    let filter = Condition::any().add(column.eq(rel_path.to_string()));
    if is_dir {
        filter.add(Expr::expr(PgFunc::starts_with(
            column.into_expr(),
            format!("{rel_path}/"),
        )))
    } else {
        filter
    }
}

#[cfg(test)]
mod tests {
    use sea_orm::{DatabaseBackend, EntityTrait, QueryFilter, QueryTrait};

    use super::path_filter;
    use crate::db::entities::docs_node_meta;

    #[test]
    fn subtree_filter_treats_percent_and_underscore_as_literal_path_characters() {
        let statement = docs_node_meta::Entity::find()
            .filter(path_filter(docs_node_meta::Column::RelPath, "项目 100%_done", true))
            .build(DatabaseBackend::Postgres)
            .to_string();

        assert!(statement.contains("STARTS_WITH"));
        assert!(statement.contains("'项目 100%_done/'"));
        assert!(!statement.contains("LIKE"));
    }

    #[test]
    fn single_node_filter_does_not_match_descendants() {
        let statement = docs_node_meta::Entity::find()
            .filter(path_filter(
                docs_node_meta::Column::RelPath,
                "文档.tokimo-doc.json",
                false,
            ))
            .build(DatabaseBackend::Postgres)
            .to_string();

        assert!(!statement.contains("STARTS_WITH"));
    }
}
