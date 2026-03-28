use crate::db::repos::doc_repo::{DocRepo, DocVersionRepo};
use crate::error::AppError;
use sea_orm::DatabaseConnection;
use uuid::Uuid;

pub struct DocService;

impl DocService {
    /// Update a doc and create a version snapshot if enough time has passed.
    pub async fn update_doc_with_version(
        db: &DatabaseConnection,
        doc_id: Uuid,
        title: Option<String>,
        content: Option<Option<serde_json::Value>>,
        icon: Option<Option<String>>,
        cover_image: Option<Option<String>>,
        tags: Option<Vec<String>>,
    ) -> Result<crate::db::entities::docs::Model, AppError> {
        // Compute word count and search text if content is being updated
        let word_count = content.as_ref().and_then(|opt_content| {
            opt_content.as_ref().map(|c| Self::count_words(c))
        });

        let search_text = content.as_ref().and_then(|opt_content| {
            opt_content.as_ref().map(|c| Self::extract_text(c))
        });

        // If content changed, snapshot a version before applying
        if content.is_some() {
            if let Some(existing) = DocRepo::get_by_id(db, doc_id).await? {
                let snap_title = title.as_deref().unwrap_or(&existing.title).to_string();
                let snap_content = existing.content.clone();
                let snap_word_count = existing.word_count;
                let _ = DocVersionRepo::create_if_due(
                    db,
                    doc_id,
                    snap_title,
                    snap_content,
                    snap_word_count,
                )
                .await;
            }
        }

        let doc = DocRepo::update(
            db,
            doc_id,
            title,
            content,
            icon,
            cover_image,
            word_count,
            search_text,
            tags,
        )
        .await?
        .ok_or_else(|| AppError::NotFound("doc not found".into()))?;

        Ok(doc)
    }

    /// Extract word count from Slate JSON content.
    ///
    /// Recursively traverses Slate nodes: for CJK characters each counts as one word,
    /// for Latin text whitespace-separated tokens are counted.
    pub fn count_words(content: &serde_json::Value) -> i32 {
        let text = Self::extract_text(content);

        // Mixed CJK + Latin word count:
        // - Each CJK character counts as 1
        // - Each Latin word (whitespace-separated) counts as 1
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
    matches!(ch,
        '\u{4E00}'..='\u{9FFF}'   // CJK Unified Ideographs
        | '\u{3400}'..='\u{4DBF}' // CJK Extension A
        | '\u{F900}'..='\u{FAFF}' // CJK Compatibility Ideographs
        | '\u{3000}'..='\u{303F}' // CJK Symbols and Punctuation
        | '\u{3040}'..='\u{309F}' // Hiragana
        | '\u{30A0}'..='\u{30FF}' // Katakana
        | '\u{AC00}'..='\u{D7AF}' // Hangul Syllables
    )
}
