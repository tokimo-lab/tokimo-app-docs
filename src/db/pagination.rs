use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageInput {
    pub page: u64,
    pub page_size: u64,
}

impl Default for PageInput {
    fn default() -> Self {
        Self {
            page: 1,
            page_size: 20,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Page<T: Serialize> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: u64,
    pub page_size: u64,
    pub total_pages: u64,
}

impl<T: Serialize> Page<T> {
    pub fn new(items: Vec<T>, total: i64, input: &PageInput) -> Self {
        let total_pages = if input.page_size == 0 {
            0
        } else {
            (total as u64 + input.page_size - 1) / input.page_size
        };
        Self {
            items,
            total,
            page: input.page,
            page_size: input.page_size,
            total_pages,
        }
    }
}
