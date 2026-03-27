pub struct DocService;

impl DocService {
    /// Extract word count from Slate JSON content.
    ///
    /// Recursively traverses Slate nodes: for CJK characters each counts as one word,
    /// for Latin text whitespace-separated tokens are counted.
    pub fn count_words(content: &serde_json::Value) -> i32 {
        fn extract_text(value: &serde_json::Value, buf: &mut String) {
            match value {
                serde_json::Value::Object(obj) => {
                    if let Some(serde_json::Value::String(text)) = obj.get("text") {
                        buf.push_str(text);
                        buf.push(' ');
                    }
                    if let Some(children) = obj.get("children") {
                        extract_text(children, buf);
                    }
                }
                serde_json::Value::Array(arr) => {
                    for item in arr {
                        extract_text(item, buf);
                    }
                }
                _ => {}
            }
        }

        let mut text = String::new();
        extract_text(content, &mut text);

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
