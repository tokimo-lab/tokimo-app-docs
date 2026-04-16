use crate::apps::docs::repos::node_repo::{DocNodeRepo, UpdateDocNodeInput};
use crate::apps::docs::repos::version_repo::DocNodeVersionRepo;
use crate::error::AppError;
use crate::error::OptionExt;
use sea_orm::DatabaseConnection;
use uuid::Uuid;

pub struct DocsService;

impl DocsService {
    /// Update a node and create a version snapshot if enough time has passed.
    pub async fn update_node_with_version(
        db: &DatabaseConnection,
        node_id: Uuid,
        title: Option<String>,
        content: Option<Option<serde_json::Value>>,
        icon: Option<Option<String>>,
        cover_image: Option<Option<String>>,
        tags: Option<Vec<String>>,
    ) -> Result<crate::db::entities::doc_nodes::Model, AppError> {
        // Compute word count and search text if content is being updated
        let word_count = content
            .as_ref()
            .and_then(|opt_content| opt_content.as_ref().map(Self::count_words));

        let search_text = content
            .as_ref()
            .and_then(|opt_content| opt_content.as_ref().map(Self::extract_text));

        // If content changed, snapshot a version before applying
        if content.is_some()
            && let Some(existing) = DocNodeRepo::get_by_id(db, node_id).await?
        {
            let snap_title = title.as_deref().unwrap_or(&existing.title).to_string();
            let snap_content = existing.content.clone();
            let snap_word_count = existing.word_count;
            let _ = DocNodeVersionRepo::create_if_due(db, node_id, snap_title, snap_content, snap_word_count).await;
        }

        let node = DocNodeRepo::update(
            db,
            node_id,
            UpdateDocNodeInput {
                title,
                content,
                icon,
                cover_image,
                word_count,
                search_text,
                tags,
            },
        )
        .await?
        .not_found("node not found")?;

        Ok(node)
    }

    /// Extract word count from Slate JSON content.
    ///
    /// Recursively traverses Slate nodes: for CJK characters each counts as one word,
    /// for Latin text whitespace-separated tokens are counted.
    pub fn count_words(content: &serde_json::Value) -> i32 {
        let text = Self::extract_text(content);

        let mut count: i32 = 0;
        let mut in_latin_word = false;

        for ch in text.chars() {
            if is_cjk(ch) {
                if in_latin_word {
                    count += 1;
                    in_latin_word = false;
                }
                count += 1;
            } else if ch.is_alphanumeric() {
                in_latin_word = true;
            } else if in_latin_word {
                count += 1;
                in_latin_word = false;
            }
        }
        if in_latin_word {
            count += 1;
        }

        count
    }

    /// Extract plaintext from Slate JSON for full-text search.
    pub fn extract_text(content: &serde_json::Value) -> String {
        fn collect(value: &serde_json::Value, buf: &mut String) {
            match value {
                serde_json::Value::Object(obj) => {
                    if let Some(serde_json::Value::String(text)) = obj.get("text") {
                        buf.push_str(text);
                        buf.push(' ');
                    }
                    if let Some(children) = obj.get("children") {
                        collect(children, buf);
                    }
                }
                serde_json::Value::Array(arr) => {
                    for item in arr {
                        collect(item, buf);
                    }
                }
                _ => {}
            }
        }

        let mut text = String::new();
        collect(content, &mut text);
        text
    }
}

fn is_cjk(ch: char) -> bool {
    matches!(
        ch,
        '\u{4E00}'..='\u{9FFF}'   // CJK Unified Ideographs
        | '\u{3400}'..='\u{4DBF}' // CJK Extension A
        | '\u{F900}'..='\u{FAFF}' // CJK Compatibility Ideographs
        | '\u{3000}'..='\u{303F}' // CJK Symbols and Punctuation
        | '\u{3040}'..='\u{309F}' // Hiragana
        | '\u{30A0}'..='\u{30FF}' // Katakana
        | '\u{AC00}'..='\u{D7AF}' // Hangul Syllables
    )
}
