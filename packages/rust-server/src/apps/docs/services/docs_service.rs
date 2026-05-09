pub struct DocsService;

impl DocsService {
    pub fn count_words(content: &serde_json::Value) -> i32 {
        let text = Self::extract_text(content);
        let mut count = 0;
        let mut in_latin = false;
        for ch in text.chars() {
            if is_cjk(ch) {
                if in_latin {
                    count += 1;
                    in_latin = false;
                }
                count += 1;
            } else if ch.is_alphanumeric() {
                in_latin = true;
            } else if in_latin {
                count += 1;
                in_latin = false;
            }
        }
        if in_latin {
            count += 1;
        }
        count
    }
    pub fn extract_text(content: &serde_json::Value) -> String {
        fn collect(v: &serde_json::Value, out: &mut String) {
            match v {
                serde_json::Value::String(s) => {
                    out.push_str(s);
                    out.push(' ');
                }
                serde_json::Value::Array(a) => {
                    for item in a {
                        collect(item, out);
                    }
                }
                serde_json::Value::Object(o) => {
                    if let Some(serde_json::Value::String(text)) = o.get("text").or_else(|| o.get("content")) {
                        out.push_str(text);
                        out.push(' ');
                    }
                    for v in o.values() {
                        collect(v, out);
                    }
                }
                _ => {}
            }
        }
        let mut out = String::new();
        collect(content, &mut out);
        out
    }
}
fn is_cjk(ch: char) -> bool {
    matches!(ch, '\u{4E00}'..='\u{9FFF}' | '\u{3400}'..='\u{4DBF}' | '\u{F900}'..='\u{FAFF}' | '\u{3040}'..='\u{30FF}' | '\u{AC00}'..='\u{D7AF}')
}
