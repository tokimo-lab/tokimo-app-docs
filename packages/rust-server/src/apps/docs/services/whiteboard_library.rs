use serde::Deserialize;
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::warn;

const CATALOG_URL: &str =
    "https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries.json";
const GITHUB_RAW_BASE: &str =
    "https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main";
const CACHE_TTL: Duration = Duration::from_secs(24 * 60 * 60);

/// Raw entry from the upstream libraries.json catalog.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawLibraryEntry {
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub authors: Vec<RawAuthor>,
    pub source: String,
    #[serde(default)]
    pub preview: String,
    #[serde(default)]
    pub created: String,
    #[serde(default)]
    pub updated: String,
    #[serde(default)]
    pub item_names: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RawAuthor {
    pub name: String,
    pub url: Option<String>,
}

struct CatalogCache {
    entries: Vec<RawLibraryEntry>,
    fetched_at: Instant,
}

static CATALOG: OnceLock<RwLock<Option<CatalogCache>>> = OnceLock::new();

fn catalog_lock() -> &'static RwLock<Option<CatalogCache>> {
    CATALOG.get_or_init(|| RwLock::new(None))
}

/// Fetch (or return cached) the library catalog.
pub async fn get_catalog(
    http: &reqwest::Client,
) -> Result<Vec<RawLibraryEntry>, crate::error::AppError> {
    // Fast path: read lock
    {
        let guard = catalog_lock().read().await;
        if let Some(cache) = guard.as_ref()
            && cache.fetched_at.elapsed() < CACHE_TTL
        {
            return Ok(cache.entries.clone());
        }
    }

    // Slow path: fetch + write lock
    let resp = http
        .get(CATALOG_URL)
        .send()
        .await
        .map_err(|e| crate::error::AppError::Internal(format!("fetch catalog: {e}")))?;

    let mut entries: Vec<RawLibraryEntry> = resp
        .json()
        .await
        .map_err(|e| crate::error::AppError::Internal(format!("parse catalog: {e}")))?;

    // Fill in empty IDs with a hash of the source field for entries missing id
    entries = entries.into_iter().map(|mut e| {
        if e.id.is_empty() {
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            let mut hasher = DefaultHasher::new();
            e.source.hash(&mut hasher);
            e.id = format!("gen_{:x}", hasher.finish());
        }
        e
    }).collect();

    let mut guard = catalog_lock().write().await;
    *guard = Some(CatalogCache {
        entries: entries.clone(),
        fetched_at: Instant::now(),
    });

    Ok(entries)
}

/// Find the `source` path for a library by ID.
pub async fn get_library_source_url(
    http: &reqwest::Client,
    id: &str,
) -> Result<String, crate::error::AppError> {
    let catalog = get_catalog(http).await?;
    let entry = catalog
        .iter()
        .find(|e| e.id == id)
        .ok_or_else(|| crate::error::AppError::NotFound(format!("library {id} not found")))?;
    Ok(format!("{GITHUB_RAW_BASE}/libraries/{}", entry.source))
}

/// Find the `preview` path for a library by ID.
pub async fn get_library_preview_url(
    http: &reqwest::Client,
    id: &str,
) -> Result<String, crate::error::AppError> {
    let catalog = get_catalog(http).await?;
    let entry = catalog
        .iter()
        .find(|e| e.id == id)
        .ok_or_else(|| crate::error::AppError::NotFound(format!("library {id} not found")))?;
    if entry.preview.is_empty() {
        return Err(crate::error::AppError::NotFound(format!(
            "library {id} has no preview"
        )));
    }
    Ok(format!("{GITHUB_RAW_BASE}/libraries/{}", entry.preview))
}

const CACHE_DIR_LIBS: &str = "data/excalidraw-libraries/libs";
const CACHE_DIR_PREVIEWS: &str = "data/excalidraw-libraries/previews";

/// Fetch a raw file from GitHub, using local disk cache.
pub async fn fetch_cached_file(
    http: &reqwest::Client,
    url: &str,
    cache_dir: &str,
    filename: &str,
) -> Result<(Vec<u8>, &'static str), crate::error::AppError> {
    let dir = std::path::Path::new(cache_dir);
    let path = dir.join(filename);

    // Check disk cache
    if let Ok(bytes) = tokio::fs::read(&path).await {
        let ct = guess_content_type(filename);
        return Ok((bytes, ct));
    }

    // Fetch from upstream
    let resp = http
        .get(url)
        .send()
        .await
        .map_err(|e| crate::error::AppError::Internal(format!("fetch file: {e}")))?;

    if !resp.status().is_success() {
        warn!("upstream returned {} for {url}", resp.status());
        return Err(crate::error::AppError::Internal(format!(
            "upstream returned {}",
            resp.status()
        )));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| crate::error::AppError::Internal(format!("read body: {e}")))?
        .to_vec();

    // Write to disk cache (best-effort)
    if let Err(e) = tokio::fs::create_dir_all(dir).await {
        warn!("cannot create cache dir {cache_dir}: {e}");
    } else if let Err(e) = tokio::fs::write(&path, &bytes).await {
        warn!("cannot write cache {}: {e}", path.display());
    }

    let ct = guess_content_type(filename);
    Ok((bytes, ct))
}

fn guess_content_type(filename: &str) -> &'static str {
    use std::path::Path;
    let ext = Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    match ext.to_ascii_lowercase().as_str() {
        "png" => "image/png",
        "excalidrawlib" | "json" => "application/json",
        _ => "application/octet-stream",
    }
}

pub fn lib_cache_dir() -> &'static str {
    CACHE_DIR_LIBS
}

pub fn preview_cache_dir() -> &'static str {
    CACHE_DIR_PREVIEWS
}
